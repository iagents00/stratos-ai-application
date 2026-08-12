#!/usr/bin/env node
/**
 * scripts/check-tenant-modules.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Verificación MÓDULO POR MÓDULO de cada tenant, ejecutando el CÓDIGO REAL
 * del front (canAccessModule + configs + nav + íconos) vía Vite SSR — no grep.
 *
 * Qué verifica, por tenant × rol (admin y asesor):
 *   1. La cadena de vista inicial (espejo de resolverAccesible en App.jsx)
 *      SIEMPRE aterriza en un módulo accesible → jamás «Acceso restringido».
 *   2. Con features.crm === false, NADIE ve el CRM ni la Papelera.
 *   3. No hay dos entradas visibles del menú con el MISMO nombre.
 *   4. Todo módulo visible tiene glifo propio en ios-icons (no cae al fallback
 *      de 4 cuadrados).
 *   5. Regla anti-duplicado: si el módulo mkt se llama «Actividades», la
 *      sección suelta mkt_reporte se oculta para quien puede abrir el módulo.
 *
 * Uso:  node scripts/check-tenant-modules.mjs        (todos los tenants)
 *       node scripts/check-tenant-modules.mjs gasil  (uno solo)
 *
 * ⚠️ La cadena de candidatos de vista inicial es un ESPEJO de la de
 * resolverAccesible() en App.jsx — si cambia allá, cambiarla acá.
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
  root, appType: "custom", logLevel: "error",
  server: { middlewareMode: true },
});

const nav = await server.ssrLoadModule("/src/app/constants/navigation.js");
const clients = await server.ssrLoadModule("/src/clients/index.js");

// Glifos: los mapas no se exportan → se leen del archivo (solo las CLAVES).
const iconsSrc = readFileSync(join(root, "src/app/icons/ios-icons.jsx"), "utf8");
const glyphKeys = new Set();
{
  // PREMIUM_ICON_OVERRIDES: multilínea con claves sin comillas
  const prem = iconsSrc.match(/const PREMIUM_ICON_OVERRIDES\s*=\s*\{([\s\S]*?)\n\};/);
  if (prem) for (const k of prem[1].matchAll(/^\s*([a-z_][a-z0-9_]*)\s*:/gim)) glyphKeys.add(k[1]);
  // G: objeto en una sola línea con claves entre comillas ("c":{...})
  const gLine = iconsSrc.split("\n").find((l) => l.includes("const G = {"));
  if (gLine) for (const k of gLine.matchAll(/"([a-z_][a-z0-9_]*)":\{/g)) glyphKeys.add(k[1]);
}

// Espejo de resolverAccesible() en App.jsx (mantener en sync).
const CANDIDATOS = ["mkt", "c", "d", "copilot", "miespacio", "perfil"];

const soloTenant = process.argv[2] || null;
const tenants = clients.REGISTERED_CLIENT_IDS.filter((id) => !soloTenant || id === soloTenant);
const roles = ["admin", "asesor"];

let fallos = 0;
const fail = (msg) => { fallos++; console.log(`  🔴 ${msg}`); };

for (const clientId of tenants) {
  const cfg = clients.getClientConfig(clientId);
  const orgId = clients.getOrgIdByClientId(clientId);
  if (!cfg) { fail(`${clientId}: sin config`); continue; }
  console.log(`\n▸ ${clientId} (${cfg.name || "?"})`);

  for (const role of roles) {
    const user = { role, organizationId: orgId || "org-desconocida", crmOnly: false, isMarketingAdmin: false, isDemo: false };
    const visibles = nav.nav.filter((it) => {
      try { return nav.canAccessModule(it.id, user, cfg); } catch { return false; }
    });

    // 1. Vista inicial: algún candidato accesible
    const inicial = CANDIDATOS.find((m) => {
      try { return nav.canAccessModule(m, user, cfg); } catch { return false; }
    });
    if (!inicial) fail(`${clientId}/${role}: NINGÚN candidato de vista inicial accesible (bucle «Acceso restringido»)`);

    // 2. CRM apagado ⇒ ni CRM ni Papelera
    if (cfg?.features?.crm === false) {
      for (const m of ["c", "trash"]) {
        if (nav.canAccessModule(m, user, cfg)) fail(`${clientId}/${role}: crm:false pero «${m}» accesible`);
      }
    }

    // 3. Nombres duplicados en el menú visible
    const porNombre = new Map();
    for (const it of visibles) {
      const label = ((cfg?.navLabels?.[it.id] ?? it.l) || "").trim().toLowerCase();
      if (!label) continue;
      if (porNombre.has(label)) fail(`${clientId}/${role}: dos entradas visibles se llaman «${label}» (${porNombre.get(label)} y ${it.id})`);
      else porNombre.set(label, it.id);
    }

    // 4. Glifo por módulo visible
    for (const it of visibles) {
      if (!glyphKeys.has(it.id)) fail(`${clientId}/${role}: módulo visible «${it.id}» SIN glifo en ios-icons (cae al fallback)`);
    }

    // 5. Anti-duplicado Actividades
    if (cfg?.features?.mktModule === true
        && (cfg?.navLabels?.mkt || "").trim().toLowerCase() === "actividades"
        && nav.MODULE_ROLES.mkt.includes(role)
        && nav.canAccessModule("mkt_reporte", user, cfg)) {
      fail(`${clientId}/${role}: módulo «Actividades» + sección mkt_reporte visibles a la vez`);
    }

    console.log(`  ${role}: inicial=${inicial || "∅"} · ve ${visibles.length} módulos: ${visibles.map((i) => i.id).join(", ")}`);
  }
}

await server.close();
console.log(fallos === 0 ? `\n✅ Todo en orden (${tenants.length} tenants × ${roles.length} roles)` : `\n🔴 ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
