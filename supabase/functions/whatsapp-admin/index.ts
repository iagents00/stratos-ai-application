import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as XLSX from "npm:xlsx@0.18.5";

const SUPABASE_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const INFOBIP_BASE_URL = (Deno.env.get("INFOBIP_BASE_URL") ?? "https://api.infobip.com").replace(/\/$/, "");
const INFOBIP_API_KEY = Deno.env.get("INFOBIP_API_KEY") ?? "";

const VALID_ROLES = new Set(["super_admin", "admin", "director", "ceo", "asesor", "marketing", "colaborador"]);
const VALID_STATUSES = new Set(["draft", "waiting_customer", "meta_finished", "infobip_registering", "ready_to_test", "active", "failed", "disconnected"]);
const MAX_CATALOG_FILE_BYTES = 15 * 1024 * 1024;
const MAX_CATALOG_ROWS = 2500;
const CATALOG_COLUMNS = [
  "desarrollo", "ubicacion", "zona", "masterbroker", "ticket", "clasificacion",
  "tipologia", "entrega", "financiamiento", "entrega_como", "highlights",
  "mantenimiento", "contacto", "asesor", "drive", "maps",
] as const;

const HEADER_ALIASES: Record<string, typeof CATALOG_COLUMNS[number]> = {
  desarrollo: "desarrollo", proyecto: "desarrollo", propiedad: "desarrollo", nombre: "desarrollo",
  ubicacion: "ubicacion", location: "ubicacion", ciudad: "ubicacion",
  zona: "zona", sector: "zona",
  masterbroker: "masterbroker", broker: "masterbroker", desarrollador: "masterbroker",
  ticket: "ticket", precio: "ticket", presupuesto: "ticket", rango: "ticket",
  clasificacion: "clasificacion", categoria: "clasificacion", tipo: "clasificacion",
  tipologia: "tipologia", recamaras: "tipologia", habitaciones: "tipologia",
  entrega: "entrega", fechaentrega: "entrega",
  financiamiento: "financiamiento", financiacion: "financiamiento",
  comoseentrega: "entrega_como", entregacomo: "entrega_como", equipamiento: "entrega_como",
  highlights: "highlights", destacados: "highlights", caracteristicas: "highlights",
  mantenimiento: "mantenimiento", cuota: "mantenimiento",
  contacto: "contacto", telefono: "contacto",
  asesor: "asesor", agente: "asesor",
  drive: "drive", carpeta: "drive", catalogo: "drive", enlace: "drive", link: "drive", documentos: "drive",
  maps: "maps", mapa: "maps", googlemaps: "maps", localizacion: "maps",
};

const cleanText = (value: unknown, max = 500) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const headerKey = (value: unknown) => cleanText(value, 100)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "");
const safeExternalUrl = (value: unknown) => {
  const raw = cleanText(value, 2000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch { return null; }
};

const workbookDownloadUrl = (source: string) => {
  let parsed: URL;
  try { parsed = new URL(source); } catch { throw new Error("Pega un enlace completo que empiece por https://."); }
  if (parsed.protocol !== "https:") throw new Error("El enlace del catálogo debe usar https://.");
  const host = parsed.hostname.toLowerCase();
  const googleSheet = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (host === "docs.google.com" && googleSheet) {
    return `https://docs.google.com/spreadsheets/d/${googleSheet[1]}/export?format=xlsx`;
  }
  const googleDrive = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (host === "drive.google.com" && googleDrive) {
    return `https://drive.usercontent.google.com/download?id=${googleDrive[1]}&export=download&confirm=t`;
  }
  const allowed = host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith(".sharepoint.com")
    || host === "drive.usercontent.google.com" || host === "docs.googleusercontent.com";
  if (!allowed) throw new Error("Usa un enlace público de Google Sheets, Google Drive, OneDrive o SharePoint.");
  if ((host === "onedrive.live.com" || host.endsWith(".sharepoint.com")) && !parsed.searchParams.has("download")) {
    parsed.searchParams.set("download", "1");
  }
  return parsed.toString();
};

async function readCatalogWorkbook(source: string) {
  const downloadUrl = workbookDownloadUrl(source);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response: Response;
  try { response = await fetch(downloadUrl, { redirect: "follow", signal: controller.signal }); }
  catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error("El enlace tardó demasiado. Comprueba que sea público.");
    throw new Error("No se pudo descargar el catálogo. Comprueba que cualquiera con el enlace pueda verlo.");
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error(`No se pudo descargar el catálogo (HTTP ${response.status}). Comprueba que el enlace sea público.`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_CATALOG_FILE_BYTES) throw new Error("El archivo supera el máximo de 15 MB.");
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) throw new Error("El enlace abrió una pantalla de acceso. Comparte el archivo para cualquiera con el enlace.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_CATALOG_FILE_BYTES) throw new Error("El archivo supera el máximo de 15 MB.");

  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(new Uint8Array(bytes), { type: "array", cellDates: true }); }
  catch { throw new Error("El enlace no contiene un Excel válido (.xlsx o .xls)."); }

  const rows: Array<Record<string, string | null>> = [];
  const sheets: Array<{ name: string; rows: number }> = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    let headerIndex = -1;
    let columns = new Map<number, typeof CATALOG_COLUMNS[number]>();
    for (let index = 0; index < Math.min(matrix.length, 25); index += 1) {
      const candidate = new Map<number, typeof CATALOG_COLUMNS[number]>();
      (matrix[index] || []).forEach((cell, cellIndex) => {
        const field = HEADER_ALIASES[headerKey(cell)];
        if (field && ![...candidate.values()].includes(field)) candidate.set(cellIndex, field);
      });
      if ([...candidate.values()].includes("desarrollo")) { headerIndex = index; columns = candidate; break; }
    }
    if (headerIndex < 0) continue;
    let sheetRows = 0;
    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length && rows.length < MAX_CATALOG_ROWS; rowIndex += 1) {
      const sourceRow = matrix[rowIndex] || [];
      const row: Record<string, string | null> = {};
      for (const field of CATALOG_COLUMNS) row[field] = null;
      for (const [cellIndex, field] of columns) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: cellIndex });
        const cell = sheet[address] as XLSX.CellObject & { l?: { Target?: string } };
        const linked = safeExternalUrl(cell?.l?.Target);
        const value = cleanText(sourceRow[cellIndex], field === "drive" || field === "maps" ? 2000 : 500);
        row[field] = (field === "drive" || field === "maps") ? (linked || safeExternalUrl(value)) : (value || null);
      }
      const developmentColumn = [...columns.entries()].find(([, field]) => field === "desarrollo")?.[0];
      if (!row.desarrollo || developmentColumn == null) continue;
      if (!row.drive) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: developmentColumn });
        const linked = safeExternalUrl((sheet[address] as XLSX.CellObject & { l?: { Target?: string } })?.l?.Target);
        if (linked?.includes("drive.google") || linked?.includes("sharepoint") || linked?.includes("1drv.ms")) row.drive = linked;
      }
      row.seccion = slugify(sheetName) || "catalogo";
      row.seccion_nombre = cleanText(sheetName, 120) || "Catálogo";
      rows.push(row);
      sheetRows += 1;
    }
    if (sheetRows) sheets.push({ name: cleanText(sheetName, 120), rows: sheetRows });
    if (rows.length >= MAX_CATALOG_ROWS) break;
  }
  if (!rows.length) throw new Error("No encontré una columna llamada Desarrollo, Proyecto, Propiedad o Nombre en el Excel.");
  return {
    rows,
    sheets,
    withDrive: rows.filter(row => Boolean(row.drive)).length,
    truncated: rows.length >= MAX_CATALOG_ROWS,
  };
}

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const respond = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) },
  });

const slugify = (value: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

const normalizePhone = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
};

const infobipHeaders = () => ({
  Authorization: INFOBIP_API_KEY.startsWith("App ") ? INFOBIP_API_KEY : `App ${INFOBIP_API_KEY}`,
  "Content-Type": "application/json",
});

const rowsFrom = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload.filter(row => row && typeof row === "object") as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== "object") return [];
  const object = payload as Record<string, unknown>;
  for (const key of ["results", "senders", "data", "items"]) {
    if (Array.isArray(object[key])) return rowsFrom(object[key]);
  }
  return [];
};

const senderPhone = (row: Record<string, unknown>) => normalizePhone(
  row.sender ?? row.phoneNumber ?? row.displayPhoneNumber ?? row.number ?? row.phone,
);

const sanitizePipeline = (value: unknown) => {
  if (!Array.isArray(value)) return { error: "El pipeline debe ser una lista de etapas.", pipeline: [] };
  if (value.length < 2 || value.length > 30) {
    return { error: "El pipeline debe tener entre 2 y 30 etapas.", pipeline: [] };
  }
  const pipeline: Array<{ name: string; color: string }> = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return { error: "Hay una etapa inválida.", pipeline: [] };
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim().replace(/\s+/g, " ");
    const color = String(row.color ?? "").trim().toUpperCase();
    if (name.length < 2 || name.length > 48) {
      return { error: "Cada etapa debe tener entre 2 y 48 caracteres.", pipeline: [] };
    }
    if (!/^#[0-9A-F]{6}$/.test(color)) {
      return { error: `El color de “${name}” no es válido.`, pipeline: [] };
    }
    const key = name.toLocaleLowerCase("es");
    if (seen.has(key)) return { error: `La etapa “${name}” está repetida.`, pipeline: [] };
    seen.add(key);
    pipeline.push({ name, color });
  }
  return { error: null, pipeline };
};

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) return respond({ ok: false, error: "server_misconfigured" }, 500, origin);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return respond({ ok: false, error: "Tu sesión venció. Vuelve a entrar." }, 401, origin);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user?.id) return respond({ ok: false, error: "Sesión inválida." }, 401, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const callerId = authData.user.id;
  let scopeSchemaReady = true;
  let { data: platformAdmin, error: platformAdminError } = await admin.from("platform_admins")
    .select("user_id, active, scope_organization_id").eq("user_id", callerId).eq("active", true).maybeSingle();
  // Despliegue compatible en dos pasos: la interfaz y las acciones de pipeline
  // pueden salir antes que la migración 244. Mientras la columna de alcance no
  // exista solo operan los platform_admins raíz ya autorizados; nunca se infiere
  // ni se concede un scope desde el cliente.
  if (platformAdminError?.code === "42703") {
    scopeSchemaReady = false;
    const fallback = await admin.from("platform_admins")
      .select("user_id, active").eq("user_id", callerId).eq("active", true).maybeSingle();
    platformAdmin = fallback.data ? { ...fallback.data, scope_organization_id: null } : null;
    platformAdminError = fallback.error;
  }
  if (platformAdminError) return respond({ ok: false, error: platformAdminError.message }, 500, origin);
  if (!platformAdmin) return respond({ ok: false, error: "Acceso restringido a administradores de plataforma." }, 403, origin);

  // Un operador raíz (scope NULL) ve toda la plataforma. Un distribuidor ve
  // únicamente su organización y las empresas que creó debajo de ella. La
  // comprobación vive en servidor: ocultar opciones en React no sería control
  // de acceso y expondría clientes de otros distribuidores.
  const scopeOrganizationId = platformAdmin.scope_organization_id as string | null;
  const organizationIsVisible = async (organizationId: string) => {
    if (!organizationId) return false;
    if (!scopeOrganizationId) return true;
    const { data } = await admin.from("organizations").select("id")
      .eq("id", organizationId)
      .or(`id.eq.${scopeOrganizationId},parent_organization_id.eq.${scopeOrganizationId}`)
      .maybeSingle();
    return Boolean(data?.id);
  };

  const visibleOrganizations = async () => {
    let query = scopeSchemaReady
      ? admin.from("organizations")
        .select("id,name,slug,plan,seats,active,subscription_status,meta_config,parent_organization_id,created_at")
        .order("created_at", { ascending: false })
      : admin.from("organizations")
        .select("id,name,slug,plan,seats,active,subscription_status,meta_config,created_at")
        .order("created_at", { ascending: false });
    if (scopeOrganizationId) {
      query = query.or(`id.eq.${scopeOrganizationId},parent_organization_id.eq.${scopeOrganizationId}`);
    }
    return await query;
  };

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return respond({ ok: false, error: "bad_json" }, 400, origin); }
  const action = String(body.action ?? "bootstrap");

  try {
    if (action === "bootstrap") {
      const orgs = await visibleOrganizations();
      if (orgs.error) throw orgs.error;
      const visibleIds = (orgs.data ?? []).map(row => row.id);
      const [profiles, channels, runs] = visibleIds.length ? await Promise.all([
        admin.from("profiles").select("id,organization_id,name,role,active,phone").in("organization_id", visibleIds).order("name"),
        admin.from("whatsapp_numero_asesor").select("id,organization_id,numero_whatsapp,asesor_id,asesor_name,waba_id,phone_number_id,estado_conexion,quality_rating,active,updated_at").in("organization_id", visibleIds).order("updated_at", { ascending: false }),
        admin.from("whatsapp_onboarding_runs").select("*").in("organization_id", visibleIds).order("created_at", { ascending: false }).limit(300),
      ]) : [
        { data: [], error: null }, { data: [], error: null }, { data: [], error: null },
      ];
      const firstError = profiles.error || channels.error || runs.error;
      if (firstError) throw firstError;
      return respond({
        ok: true,
        organizations: orgs.data ?? [], profiles: profiles.data ?? [],
        channels: channels.data ?? [], runs: runs.data ?? [],
        access: { root: !scopeOrganizationId, scopeOrganizationId },
        provider: {
          infobipConfigured: Boolean(INFOBIP_API_KEY),
          portalRegistrationReady: Boolean(INFOBIP_API_KEY),
          embeddedSignupReady: Boolean(INFOBIP_API_KEY),
        },
      }, 200, origin);
    }

    if (action === "get_pipeline") {
      const organizationId = String(body.organization_id ?? "");
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const [{ data: organization, error: orgError }, { data: leadStages, error: leadsError }] = await Promise.all([
        admin.from("organizations").select("id,name,meta_config").eq("id", organizationId).maybeSingle(),
        admin.from("leads").select("stage").eq("organization_id", organizationId).is("deleted_at", null).limit(5000),
      ]);
      if (orgError || leadsError) throw orgError || leadsError;
      if (!organization) return respond({ ok: false, error: "La empresa no existe." }, 404, origin);
      const usage: Record<string, number> = {};
      for (const row of leadStages ?? []) {
        const stage = String(row.stage ?? "").trim();
        if (stage) usage[stage] = (usage[stage] ?? 0) + 1;
      }
      const meta = organization.meta_config && typeof organization.meta_config === "object"
        ? organization.meta_config as Record<string, unknown> : {};
      const crm = meta.crm && typeof meta.crm === "object"
        ? meta.crm as Record<string, unknown> : {};
      return respond({
        ok: true,
        organization: { id: organization.id, name: organization.name },
        pipeline: Array.isArray(crm.pipeline) ? crm.pipeline : null,
        usage,
      }, 200, origin);
    }

    if (action === "get_catalog") {
      const organizationId = String(body.organization_id ?? "");
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const [{ data: organization, error: orgError }, countResult, sampleResult] = await Promise.all([
        admin.from("organizations").select("id,name,meta_config").eq("id", organizationId).maybeSingle(),
        admin.from("catalogo_proyectos").select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId).eq("visible", true),
        admin.from("catalogo_proyectos")
          .select("desarrollo,ubicacion,ticket,drive,seccion_nombre,origen")
          .eq("organization_id", organizationId).eq("visible", true)
          .order("created_at", { ascending: false }).limit(12),
      ]);
      if (orgError || countResult.error || sampleResult.error) throw orgError || countResult.error || sampleResult.error;
      if (!organization) return respond({ ok: false, error: "La empresa no existe." }, 404, origin);
      const meta = organization.meta_config && typeof organization.meta_config === "object"
        ? organization.meta_config as Record<string, unknown> : {};
      return respond({
        ok: true,
        organization: { id: organization.id, name: organization.name },
        total: countResult.count ?? 0,
        sample: sampleResult.data ?? [],
        catalog: meta.catalog && typeof meta.catalog === "object" ? meta.catalog : null,
      }, 200, origin);
    }

    if (action === "preview_catalog") {
      const organizationId = String(body.organization_id ?? "");
      const sourceUrl = String(body.source_url ?? "").trim();
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      if (!sourceUrl) return respond({ ok: false, error: "Pega el enlace público del Excel o Google Sheet." }, 400, origin);
      const parsed = await readCatalogWorkbook(sourceUrl);
      return respond({
        ok: true,
        summary: { total: parsed.rows.length, with_drive: parsed.withDrive, sheets: parsed.sheets, truncated: parsed.truncated },
        sample: parsed.rows.slice(0, 12),
      }, 200, origin);
    }

    if (action === "import_catalog") {
      const organizationId = String(body.organization_id ?? "");
      const sourceUrl = String(body.source_url ?? "").trim();
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      if (!sourceUrl) return respond({ ok: false, error: "Pega el enlace público del Excel o Google Sheet." }, 400, origin);
      const { data: organization, error: orgError } = await admin.from("organizations")
        .select("id,name,meta_config").eq("id", organizationId).maybeSingle();
      if (orgError) throw orgError;
      if (!organization) return respond({ ok: false, error: "La empresa no existe." }, 404, origin);

      const parsed = await readCatalogWorkbook(sourceUrl);
      const batchOrigin = `admin:${crypto.randomUUID()}`;
      const payload = parsed.rows.map(row => ({
        organization_id: organizationId,
        seccion: row.seccion,
        seccion_nombre: row.seccion_nombre,
        desarrollo: row.desarrollo,
        ubicacion: row.ubicacion,
        zona: row.zona,
        masterbroker: row.masterbroker,
        ticket: row.ticket,
        clasificacion: row.clasificacion,
        tipologia: row.tipologia,
        entrega: row.entrega,
        financiamiento: row.financiamiento,
        entrega_como: row.entrega_como,
        highlights: row.highlights,
        mantenimiento: row.mantenimiento,
        contacto: row.contacto,
        asesor: row.asesor,
        drive: row.drive,
        maps: row.maps,
        visible: false,
        origen: batchOrigin,
      }));

      let activated = false;
      try {
        for (let index = 0; index < payload.length; index += 400) {
          const { error } = await admin.from("catalogo_proyectos").insert(payload.slice(index, index + 400));
          if (error) throw error;
        }
        const { error: activateError } = await admin.from("catalogo_proyectos")
          .update({ visible: true }).eq("organization_id", organizationId).eq("origen", batchOrigin);
        if (activateError) throw activateError;
        activated = true;

        // Las cargas anteriores se conservan para reversa, pero quedan ocultas.
        // Las propiedades añadidas manualmente desde el CRM (`origen=app`) no se tocan.
        const [hideLegacy, hideImports] = await Promise.all([
          admin.from("catalogo_proyectos").update({ visible: false })
            .eq("organization_id", organizationId).eq("visible", true).is("origen", null),
          admin.from("catalogo_proyectos").update({ visible: false })
            .eq("organization_id", organizationId).eq("visible", true)
            .not("origen", "is", null).neq("origen", "app").neq("origen", batchOrigin),
        ]);
        if (hideLegacy.error || hideImports.error) throw hideLegacy.error || hideImports.error;

        const meta = organization.meta_config && typeof organization.meta_config === "object"
          ? organization.meta_config as Record<string, unknown> : {};
        const nextMeta = {
          ...meta,
          catalog: {
            sourceUrl,
            importedAt: new Date().toISOString(),
            importedBy: callerId,
            origin: batchOrigin,
            total: payload.length,
            withDrive: parsed.withDrive,
            sheets: parsed.sheets,
          },
        };
        const { error: metaError } = await admin.from("organizations")
          .update({ meta_config: nextMeta }).eq("id", organizationId);
        if (metaError) throw metaError;
      } catch (error) {
        if (!activated) {
          await admin.from("catalogo_proyectos").update({ visible: false })
            .eq("organization_id", organizationId).eq("origen", batchOrigin);
        }
        throw error;
      }

      return respond({
        ok: true,
        total: payload.length,
        with_drive: parsed.withDrive,
        sheets: parsed.sheets,
        origin: batchOrigin,
      }, 200, origin);
    }

    if (action === "save_pipeline") {
      const organizationId = String(body.organization_id ?? "");
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const sanitized = sanitizePipeline(body.pipeline);
      if (sanitized.error) return respond({ ok: false, error: sanitized.error }, 400, origin);

      const [{ data: organization, error: orgError }, { data: leadStages, error: leadsError }] = await Promise.all([
        admin.from("organizations").select("id,meta_config").eq("id", organizationId).maybeSingle(),
        admin.from("leads").select("stage").eq("organization_id", organizationId).is("deleted_at", null).limit(5000),
      ]);
      if (orgError || leadsError) throw orgError || leadsError;
      if (!organization) return respond({ ok: false, error: "La empresa no existe." }, 404, origin);

      const currentMeta = organization.meta_config && typeof organization.meta_config === "object"
        ? organization.meta_config as Record<string, unknown> : {};
      const currentCrm = currentMeta.crm && typeof currentMeta.crm === "object"
        ? currentMeta.crm as Record<string, unknown> : {};
      const currentPipeline = Array.isArray(currentCrm.pipeline)
        ? currentCrm.pipeline as Array<Record<string, unknown>> : [];
      const nextPipeline = [...sanitized.pipeline];
      const nextNames = new Set(nextPipeline.map(stage => stage.name.toLocaleLowerCase("es")));
      const preserved: Record<string, number> = {};
      for (const row of leadStages ?? []) {
        const stage = String(row.stage ?? "").trim();
        if (stage && !nextNames.has(stage.toLocaleLowerCase("es"))) preserved[stage] = (preserved[stage] ?? 0) + 1;
      }
      for (const name of Object.keys(preserved)) {
        const previous = currentPipeline.find(stage => String(stage.name ?? "").trim().toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
        nextPipeline.push({ name, color: /^#[0-9A-F]{6}$/i.test(String(previous?.color ?? "")) ? String(previous?.color).toUpperCase() : "#64748B" });
      }
      if (nextPipeline.length > 30) {
        return respond({ ok: false, error: "El pipeline supera 30 etapas al conservar las columnas que todavía tienen clientes. Mueve esos clientes antes de publicar." }, 409, origin);
      }

      const nextMeta = {
        ...currentMeta,
        crm: {
          ...currentCrm,
          pipeline: nextPipeline,
          pipelineUpdatedAt: new Date().toISOString(),
          pipelineUpdatedBy: callerId,
        },
      };
      const { data, error } = await admin.from("organizations")
        .update({ meta_config: nextMeta })
        .eq("id", organizationId)
        .select("id,name,meta_config")
        .single();
      if (error) throw error;
      return respond({ ok: true, organization: data, pipeline: nextPipeline, preserved_stages: preserved }, 200, origin);
    }

    if (action === "create_organization") {
      const name = String(body.name ?? "").trim();
      const slug = slugify(String(body.slug || name));
      const seats = Math.max(1, Math.min(1000, Number(body.seats ?? 30) || 30));
      if (name.length < 2) return respond({ ok: false, error: "Escribe el nombre de la empresa." }, 400, origin);
      if (!slug) return respond({ ok: false, error: "El nombre debe incluir al menos una letra o un número." }, 400, origin);
      const metaConfig = {
        onboarding: { status: "draft", createdFrom: "whatsapp_admin", createdAt: new Date().toISOString() },
        features: { crm: true, teamAdmin: true, whatsappSignup: true, whatsappModule: false, whatsappChat: false },
      };
      const organizationRow: Record<string, unknown> = {
        name, slug, seats, plan: "custom", active: true, subscription_status: "trial", meta_config: metaConfig,
      };
      if (scopeSchemaReady) organizationRow.parent_organization_id = scopeOrganizationId || null;
      const { data, error } = await admin.from("organizations").insert(organizationRow)
        .select("id,name,slug,seats,plan,active,subscription_status,meta_config,created_at").single();
      if (error?.code === "23505") return respond({ ok: false, error: "Ya existe una empresa con ese nombre o identificador." }, 409, origin);
      if (error) throw error;
      return respond({ ok: true, organization: data }, 200, origin);
    }

    if (action === "create_user") {
      const organizationId = String(body.organization_id ?? "");
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = String(body.role ?? "asesor");
      const platform = body.platform_admin === true;
      const suppliedPassword = String(body.password ?? "");
      const password = suppliedPassword || tempPassword();
      if (!organizationId || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return respond({ ok: false, error: "Empresa, nombre y correo válido son obligatorios." }, 400, origin);
      }
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      if (!VALID_ROLES.has(role)) return respond({ ok: false, error: "Rol inválido." }, 400, origin);
      if (platform && !scopeSchemaReady) {
        return respond({ ok: false, error: "El alcance seguro de distribuidores todavía no está habilitado." }, 503, origin);
      }
      if (password.length < 12) return respond({ ok: false, error: "La contraseña debe tener al menos 12 caracteres." }, 400, origin);
      const { data: org } = await admin.from("organizations").select("id,name,seats").eq("id", organizationId).eq("active", true).maybeSingle();
      if (!org) return respond({ ok: false, error: "La empresa no existe o está inactiva." }, 404, origin);
      const { count: activeUsers, error: countError } = await admin.from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);
      if (countError) throw countError;
      if ((activeUsers ?? 0) >= Number(org.seats || 0)) {
        return respond({ ok: false, error: `${org.name} ya utiliza sus ${org.seats} licencias. Amplía el límite o desactiva un usuario.` }, 409, origin);
      }
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (createError) throw createError;
      const userId = created.user?.id;
      if (!userId) throw new Error("Auth no devolvió el id del usuario.");
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, organization_id: organizationId, name, role, active: true,
      });
      if (profileError) {
        // No borrar automáticamente una identidad si falla el perfil. Se
        // bloquea para que quede auditable y pueda repararse manualmente.
        await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" }).catch(() => null);
        throw profileError;
      }
      if (platform) {
        const { error: grantError } = await admin.from("platform_admins").upsert({
          user_id: userId,
          active: true,
          granted_by: callerId,
          // Una alta desde la interfaz nunca crea otro operador raíz. El nuevo
          // administrador queda limitado al portafolio donde fue creado.
          scope_organization_id: scopeOrganizationId || organizationId,
        });
        if (grantError) throw grantError;
      }
      return respond({ ok: true, user: { id: userId, email, name, role, organization_id: organizationId }, temp_password: password }, 200, origin);
    }

    if (action === "create_run") {
      const organizationId = String(body.organization_id ?? "");
      const advisorId = String(body.advisor_id ?? "") || null;
      const phone = normalizePhone(body.phone_e164);
      const ownerType = body.owner_type === "advisor" ? "advisor" : "company";
      if (!organizationId) return respond({ ok: false, error: "Selecciona la empresa." }, 400, origin);
      if (!await organizationIsVisible(organizationId)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      if (body.phone_e164 && !phone) return respond({ ok: false, error: "El número debe estar en formato internacional." }, 400, origin);
      if (body.registration_mode === "infobip_portal" && !phone) {
        return respond({ ok: false, error: "El registro rápido necesita el número en formato internacional." }, 400, origin);
      }
      if (advisorId) {
        const { data: advisor } = await admin.from("profiles").select("id").eq("id", advisorId).eq("organization_id", organizationId).eq("active", true).maybeSingle();
        if (!advisor) return respond({ ok: false, error: "El asesor no pertenece a esa empresa." }, 400, origin);
      }
      const { data, error } = await admin.from("whatsapp_onboarding_runs").insert({
        organization_id: organizationId, requested_by: callerId, advisor_id: advisorId,
        owner_type: ownerType, owner_name: String(body.owner_name ?? "").trim() || null,
        phone_e164: phone, status: "waiting_customer",
        provider_state: body.registration_mode === "infobip_portal" ? { mode: "infobip_portal" } : {},
      }).select("*").single();
      if (error) throw error;
      return respond({ ok: true, run: data }, 200, origin);
    }

    if (action === "verify_portal_sender") {
      if (!INFOBIP_API_KEY) return respond({ ok: false, error: "Falta configurar INFOBIP_API_KEY en el servidor." }, 503, origin);
      const runId = String(body.run_id ?? "");
      const { data: run } = await admin.from("whatsapp_onboarding_runs").select("*").eq("id", runId).maybeSingle();
      if (!run) return respond({ ok: false, error: "No encontré ese proceso." }, 404, origin);
      if (!await organizationIsVisible(run.organization_id)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const phone = normalizePhone(run.phone_e164);
      if (!phone) return respond({ ok: false, error: "Este proceso no tiene un número internacional válido." }, 400, origin);

      const qualityResponse = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/senders/quality`, { headers: infobipHeaders() });
      const qualityPayload = await qualityResponse.json().catch(() => ({}));
      if (!qualityResponse.ok) {
        const errorPayload = qualityPayload && typeof qualityPayload === "object"
          ? qualityPayload as Record<string, unknown> : {};
        const requestError = errorPayload.requestError && typeof errorPayload.requestError === "object"
          ? errorPayload.requestError as Record<string, unknown> : {};
        const serviceException = requestError.serviceException && typeof requestError.serviceException === "object"
          ? requestError.serviceException as Record<string, unknown> : {};
        const message = String(serviceException.text ?? errorPayload.message ?? `Infobip HTTP ${qualityResponse.status}`);
        return respond({ ok: false, error: `Infobip no permitió comprobar los remitentes: ${message}` }, 502, origin);
      }
      const sender = rowsFrom(qualityPayload).find(row => senderPhone(row) === phone);
      if (!sender) {
        return respond({
          ok: false,
          error: "El número todavía no aparece como remitente en Infobip. Termina el registro en Channels and Numbers → WhatsApp → Register sender y vuelve a verificar.",
        }, 409, origin);
      }
      const senderStatus = String(sender.status ?? sender.state ?? "REGISTERED").toUpperCase();
      if (["FAILED", "REJECTED", "BLOCKED", "DISCONNECTED", "INACTIVE"].includes(senderStatus)) {
        return respond({ ok: false, error: `Infobip encontró el número, pero su estado es ${senderStatus}. Corrige el registro antes de asignarlo.` }, 409, origin);
      }

      const { data: activeChannels, error: channelError } = await admin.from("whatsapp_numero_asesor")
        .select("id,organization_id,numero_whatsapp").eq("active", true).limit(5000);
      if (channelError) throw channelError;
      const sameNumber = (activeChannels ?? []).find(channel => normalizePhone(channel.numero_whatsapp) === phone);
      if (sameNumber && sameNumber.organization_id !== run.organization_id) {
        return respond({ ok: false, error: "Ese número ya está asignado a otra empresa. No se modificó ninguna conexión." }, 409, origin);
      }

      const { data: advisor } = run.advisor_id
        ? await admin.from("profiles").select("id,name").eq("id", run.advisor_id).eq("organization_id", run.organization_id).maybeSingle()
        : { data: null };
      const qualityRating = String(sender.qualityRating ?? sender.quality ?? sender.qualityScore ?? "").trim() || null;
      const channel = {
        organization_id: run.organization_id,
        numero_whatsapp: phone,
        asesor_id: advisor?.id ?? null,
        asesor_name: advisor?.name ?? run.owner_name ?? "Sin asignar",
        platform_type: "CLOUD_API",
        quality_rating: qualityRating,
        onboarded_via: "manual",
        onboarded_at: new Date().toISOString(),
        estado_conexion: "INFOBIP_REGISTERED",
        active: true,
        ultimo_error: null,
      };
      if (sameNumber?.id) {
        const { error } = await admin.from("whatsapp_numero_asesor").update(channel).eq("id", sameNumber.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("whatsapp_numero_asesor").insert(channel);
        if (error) throw error;
      }

      const safeProviderState = {
        mode: "infobip_portal",
        sender: phone,
        status: senderStatus,
        qualityRating,
        checkedAt: new Date().toISOString(),
      };
      const { error: runError } = await admin.from("whatsapp_onboarding_runs").update({
        status: "ready_to_test", provider_state: safeProviderState,
        provider_completed_at: new Date().toISOString(), last_error: null,
      }).eq("id", runId);
      if (runError) throw runError;
      return respond({ ok: true, run_id: runId, status: "ready_to_test", sender: safeProviderState }, 200, origin);
    }

    if (action === "complete_signup" || action === "retry_share") {
      const runId = String(body.run_id ?? "");
      const { data: run } = await admin.from("whatsapp_onboarding_runs").select("*").eq("id", runId).maybeSingle();
      if (!run) return respond({ ok: false, error: "No encontré ese proceso." }, 404, origin);
      if (!await organizationIsVisible(run.organization_id)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const wabaId = String(body.waba_id ?? run.waba_id ?? "").trim();
      const phoneNumberId = String(body.phone_number_id ?? run.phone_number_id ?? "").trim() || null;
      if (!wabaId) return respond({ ok: false, error: "Meta no devolvió el WABA ID." }, 400, origin);
      await admin.from("whatsapp_onboarding_runs").update({
        waba_id: wabaId, phone_number_id: phoneNumberId, status: "meta_finished",
        meta_completed_at: new Date().toISOString(), last_error: null,
      }).eq("id", runId);
      if (!INFOBIP_API_KEY) return respond({ ok: false, error: "Falta configurar INFOBIP_API_KEY en el servidor.", run_id: runId }, 503, origin);
      await admin.from("whatsapp_onboarding_runs").update({ status: "infobip_registering" }).eq("id", runId);
      const infobip = await fetch(`${INFOBIP_BASE_URL}/whatsapp/1/embedded-signup/registrations/share-waba`, {
        method: "POST",
        headers: infobipHeaders(),
        body: JSON.stringify({ businessAccountId: wabaId }),
      });
      const responseBody = await infobip.json().catch(() => ({}));
      if (!infobip.ok) {
        const message = String(responseBody?.requestError?.serviceException?.text ?? responseBody?.message ?? `Infobip HTTP ${infobip.status}`);
        await admin.from("whatsapp_onboarding_runs").update({ status: "failed", last_error: message, provider_state: responseBody }).eq("id", runId);
        return respond({ ok: false, error: message }, 502, origin);
      }
      await admin.from("whatsapp_onboarding_runs").update({ provider_state: responseBody }).eq("id", runId);
      return respond({ ok: true, run_id: runId, status: "infobip_registering" }, 200, origin);
    }

    if (action === "approve_tests") {
      const runId = String(body.run_id ?? "");
      const checks = body.checks as Record<string, unknown> | undefined;
      const required = ["inbound", "outbound", "media", "isolation"];
      if (!checks || required.some(key => checks[key] !== true)) {
        return respond({ ok: false, error: "Deben pasar entrada, salida, multimedia y aislamiento." }, 400, origin);
      }
      const { data: run } = await admin.from("whatsapp_onboarding_runs").select("id,organization_id,phone_e164,phone_number_id,status").eq("id", runId).maybeSingle();
      if (!run || run.status !== "ready_to_test") return respond({ ok: false, error: "El canal todavía no está listo para aprobar pruebas." }, 409, origin);
      if (!await organizationIsVisible(run.organization_id)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      await admin.from("whatsapp_onboarding_runs").update({ status: "active", verified_at: new Date().toISOString() }).eq("id", runId);
      if (run.phone_number_id) {
        await admin.from("whatsapp_numero_asesor").update({ estado_conexion: "CONNECTED", verificado_at: new Date().toISOString(), ultimo_error: null }).eq("phone_number_id", run.phone_number_id);
      } else if (run.phone_e164) {
        const { data: candidates } = await admin.from("whatsapp_numero_asesor")
          .select("id,numero_whatsapp").eq("organization_id", run.organization_id).eq("active", true).limit(100);
        const channel = (candidates ?? []).find(candidate => normalizePhone(candidate.numero_whatsapp) === normalizePhone(run.phone_e164));
        if (channel?.id) {
          await admin.from("whatsapp_numero_asesor").update({ estado_conexion: "CONNECTED", verificado_at: new Date().toISOString(), ultimo_error: null }).eq("id", channel.id);
        }
      }
      return respond({ ok: true, status: "active" }, 200, origin);
    }

    if (action === "set_status") {
      const runId = String(body.run_id ?? "");
      const status = String(body.status ?? "");
      if (!VALID_STATUSES.has(status)) return respond({ ok: false, error: "Estado inválido." }, 400, origin);
      const { data: statusRun } = await admin.from("whatsapp_onboarding_runs").select("organization_id").eq("id", runId).maybeSingle();
      if (!statusRun) return respond({ ok: false, error: "No encontré ese proceso." }, 404, origin);
      if (!await organizationIsVisible(statusRun.organization_id)) {
        return respond({ ok: false, error: "No tienes acceso a esa empresa." }, 403, origin);
      }
      const { error } = await admin.from("whatsapp_onboarding_runs").update({ status }).eq("id", runId);
      if (error) throw error;
      return respond({ ok: true, status }, 200, origin);
    }

    return respond({ ok: false, error: "Acción no reconocida." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return respond({ ok: false, error: message }, 500, origin);
  }
});
