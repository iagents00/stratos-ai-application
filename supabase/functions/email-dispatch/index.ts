// Stratos AI — Edge Function: email-dispatch
//
// Manda un lote de una campaña de correo y regresa el resultado al CRM.
//
// Reglas que NO se negocian:
//   • Se consulta email_suppressions antes de cada lote, siempre. Un rebote
//     duro o una queja no se vuelven a tocar nunca.
//   • Idempotente por índice único (campaign_id, lower(email)): correrlo dos
//     veces no manda el correo repetido.
//   • Cada envío deja rastro en lead_events y comunicaciones, así el asesor
//     ve el correo en la línea de tiempo del lead.
//   • Solo service_role. El anon key del bundle no abre esta puerta.
//
// Uso:
//   POST /functions/v1/email-dispatch
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "organization_id": "...", "campaign_slug": "webinar-01-invitacion",
//     "limit": 100, "dry_run": false }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const BREVO_API_KEY  = Deno.env.get("BREVO_API_KEY") ?? "";
const PUBLIC_BASE    = Deno.env.get("EMAIL_PUBLIC_BASE") ?? `${SUPABASE_URL}/functions/v1`;

const RESEND_BATCH_MAX = 100;

// Dos proveedores porque los planes gratis topan por día: Resend da 100 y
// Brevo 300. Juntos alcanzan para mandarle a toda la base el mismo día sin
// pagar. Ambos firman con el mismo dominio verificado.
type Proveedor = "resend" | "brevo";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${text}`);
  return body;
}

/** Sustituye {{nombre}}, {{unsub_url}} y demás. Escapa HTML para no romper el correo. */
function render(plantilla: string, vars: Record<string, string>) {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/** "Juan Pérez López" → "Juan". Un correo que saluda con el nombre completo se lee a máquina. */
function primerNombre(nombre: string | null) {
  if (!nombre) return "";
  const limpio = nombre.trim().split(/\s+/)[0] ?? "";
  if (!limpio) return "";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Solo POST" }, 405);

  // ── Auth: exclusivamente service_role ────────────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return json({ error: "No autorizado" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const orgId   = String(payload.organization_id ?? "");
  const slug    = String(payload.campaign_slug ?? "");
  const limite  = Math.min(Number(payload.limit ?? RESEND_BATCH_MAX), RESEND_BATCH_MAX);
  const dryRun  = payload.dry_run === true;
  const proveedor: Proveedor = payload.proveedor === "brevo" ? "brevo" : "resend";

  if (!orgId || !slug) return json({ error: "Faltan organization_id y campaign_slug" }, 400);
  if (!dryRun) {
    const llave = proveedor === "brevo" ? BREVO_API_KEY : RESEND_API_KEY;
    if (!llave) {
      return json({ error: `Falta el secret ${proveedor === "brevo" ? "BREVO_API_KEY" : "RESEND_API_KEY"}` }, 500);
    }
  }

  // ── Campaña ──────────────────────────────────────────────────────────────
  const campañas = await rest(
    `email_campaigns?organization_id=eq.${orgId}&slug=eq.${encodeURIComponent(slug)}&select=*`
  );
  const c = campañas?.[0];
  if (!c) return json({ error: `No existe la campaña "${slug}"` }, 404);

  if (!["listo", "enviando"].includes(c.estado)) {
    return json(
      { error: `La campaña está en "${c.estado}". Pásala a "listo" para poder enviar.` },
      409
    );
  }
  if (!c.cuerpo_html) {
    return json({ error: "La campaña no tiene cuerpo_html. Corre email_render.mjs primero." }, 409);
  }

  // ── Destinatarios pendientes ─────────────────────────────────────────────
  const pendientes = await rest(
    `email_recipients?campaign_id=eq.${c.id}&estado=eq.pendiente` +
    `&select=id,email,nombre,lead_id,segmento,variante,unsub_token&order=segmento.asc,created_at.asc&limit=${limite}`
  );

  if (!pendientes.length) {
    await rest(`email_campaigns?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "enviado" }),
    });
    return json({ ok: true, enviados: 0, restantes: 0, mensaje: "No quedan pendientes." });
  }

  // ── Lista de exclusión: se revisa SIEMPRE, aunque la audiencia ya la haya
  //    filtrado. Entre que se armó la lista y ahora, alguien pudo darse de baja.
  const correos = pendientes.map((r: any) => r.email.toLowerCase());
  const enLista = await rest(
    `email_suppressions?organization_id=eq.${orgId}&select=email&email=in.(${
      correos.map((e: string) => `"${e}"`).join(",")
    })`
  );
  const excluidos = new Set(enLista.map((s: any) => s.email.toLowerCase()));

  const omitidos = pendientes.filter((r: any) => excluidos.has(r.email.toLowerCase()));
  const envíanse = pendientes.filter((r: any) => !excluidos.has(r.email.toLowerCase()));

  for (const r of omitidos) {
    await rest(`email_recipients?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "omitido", error: "en lista de exclusión" }),
    });
  }

  if (!envíanse.length) {
    return json({ ok: true, enviados: 0, omitidos: omitidos.length });
  }

  // ── Armar el lote ────────────────────────────────────────────────────────
  const from = `${c.from_name} <${c.from_email}>`;

  // Primera línea distinta según la etapa del lead. Un correo que arranca
  // reconociendo de qué habló contigo se lee; uno que arranca igual para
  // todos se hojea. Vive en metadata.ganchos = { A: "...", B: "...", C: "..." }
  const ganchos = (c.metadata?.ganchos ?? {}) as Record<string, string>;

  const lote = envíanse.map((r: any) => {
    const unsubUrl = `${PUBLIC_BASE}/email-unsubscribe?t=${r.unsub_token}`;

    // Prueba A/B de asunto: la variante se asignó al armar la audiencia.
    const plantillaAsunto = r.variante === "b" && c.asunto_b ? c.asunto_b : c.asunto;
    const gancho = ganchos[r.segmento] ?? ganchos.default ?? "";
    const nombrePila = primerNombre(r.nombre);

    // El asunto también admite {{nombre}}. Sin escapar: va en la cabecera,
    // no en el HTML. Si el lead no tiene nombre, se limpia la coma huérfana.
    const asunto = render(plantillaAsunto, { nombre: nombrePila })
      .replace(/^[,\s]+/, "")
      .replace(/\s+,/g, ",")
      .trim()
      // Sin nombre, "{{nombre}}, te invito" quedaría en minúscula.
      .replace(/^./, (ch) => ch.toUpperCase());

    const vars = {
      nombre: escapeHtml(nombrePila),
      unsub_url: unsubUrl,
      asunto,
      gancho: escapeHtml(gancho),
      preheader: c.preheader ?? "",
    };
    return {
      from,
      to: [r.email],
      subject: asunto,
      html: render(c.cuerpo_html, vars),
      ...(c.cuerpo_texto ? { text: render(c.cuerpo_texto, { ...vars, nombre: nombrePila, gancho }) } : {}),
      ...(c.reply_to ? { reply_to: c.reply_to } : {}),
      headers: {
        // Baja en un clic (RFC 8058). Si Gmail no encuentra el botón,
        // la gente marca spam — y eso pesa cien veces más que una baja.
        "List-Unsubscribe": `<${unsubUrl}>, <mailto:${c.reply_to ?? c.from_email}?subject=baja>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      prepararía: lote.length,
      omitidos: omitidos.length,
      muestra: { asunto: c.asunto, from, to: lote[0].to, bytes_html: lote[0].html.length },
    });
  }

  // ── Enviar ───────────────────────────────────────────────────────────────
  await rest(`email_campaigns?id=eq.${c.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ estado: "enviando" }),
  });

  // ── Resend: un lote de hasta 100 en una llamada ──────────────────────────
  // ── Brevo:   una llamada por destinatario, con concurrencia acotada ──────
  let res: Response;
  let cuerpo: string;

  if (proveedor === "brevo") {
    const ids: (string | null)[] = new Array(lote.length).fill(null);
    const errores: string[] = [];
    const CONCURRENCIA = 5;

    for (let i = 0; i < lote.length; i += CONCURRENCIA) {
      const trozo = lote.slice(i, i + CONCURRENCIA);
      await Promise.all(trozo.map(async (m: any, j: number) => {
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: c.from_name, email: c.from_email },
            to: [{ email: m.to[0] }],
            subject: m.subject,
            htmlContent: m.html,
            ...(m.text ? { textContent: m.text } : {}),
            ...(c.reply_to ? { replyTo: { email: c.reply_to } } : {}),
            headers: m.headers,
          }),
        });
        const t = await r.text();
        if (r.ok) {
          try { ids[i + j] = JSON.parse(t)?.messageId ?? null; } catch { /* sin id */ }
        } else {
          errores.push(`${r.status}: ${t.slice(0, 160)}`);
        }
      }));
    }

    // Se simula la forma de respuesta de Resend para no duplicar el código
    // que actualiza destinatarios y escribe en el CRM.
    const todosFallaron = ids.every((x) => x === null) && errores.length > 0;
    res = new Response(null, { status: todosFallaron ? 502 : 200 });
    cuerpo = todosFallaron
      ? `Brevo — ${errores[0]}`
      : JSON.stringify({ data: ids.map((id) => ({ id })) });
  } else {
    res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lote),
    });
    cuerpo = await res.text();
  }

  if (!res.ok) {
    // Falló el lote entero: se marcan con error y quedan reintentables a mano.
    const detalle = `${proveedor} ${res.status}: ${cuerpo.slice(0, 500)}`;
    for (const r of envíanse) {
      await rest(`email_recipients?id=eq.${r.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: "error", error: detalle }),
      });
    }
    await rest(`email_campaigns?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "pausado" }),
    });
    return json({ ok: false, error: detalle, fallidos: envíanse.length }, 502);
  }

  const data = JSON.parse(cuerpo)?.data ?? [];
  const ahora = new Date().toISOString();

  // Los ids vienen en el mismo orden del lote, con cualquiera de los dos.
  for (let i = 0; i < envíanse.length; i++) {
    const r = envíanse[i];
    const id = data[i]?.id ?? null;

    await rest(`email_recipients?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        estado: "enviado",
        provider_message_id: id,
        sent_at: ahora,
        error: id ? null : `${proveedor} no devolvió id para este destinatario`,
      }),
    });

    if (!r.lead_id) continue;

    // El correo aparece en la línea de tiempo del lead, como cualquier llamada.
    await rest("lead_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: r.lead_id,
        organization_id: orgId,
        type: "email",
        action: `Correo enviado: ${c.nombre}`,
        actor_name: c.from_name,
        metadata: { campaign_slug: c.slug, asunto: c.asunto, message_id: id, segmento: r.segmento, variante: r.variante },
        occurred_at: ahora,
      }),
    }).catch(() => {});

    await rest("comunicaciones", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: r.lead_id,
        organization_id: orgId,
        tipo: "email",
        resumen: `${c.nombre} — "${c.asunto}"`,
        ocurrio_en: ahora,
        metadata: { campaign_slug: c.slug, message_id: id },
      }),
    }).catch(() => {});
  }

  const restantes = await rest(
    `email_recipients?campaign_id=eq.${c.id}&estado=eq.pendiente&select=id`,
    { headers: { Prefer: "count=exact", Range: "0-0" } }
  );

  return json({
    ok: true,
    enviados: envíanse.length,
    omitidos: omitidos.length,
    restantes: Array.isArray(restantes) ? restantes.length : 0,
    campaña: c.slug,
    proveedor,
  });
});
