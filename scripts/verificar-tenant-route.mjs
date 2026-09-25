/** Regresión de identidad URL ↔ organización y barrera de render. */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { getClientConfig, matchClientFromLocation, resolveRedirectForUser } =
    await vite.ssrLoadModule("/src/clients/index.js");
  const { crearValorCliente } = await vite.ssrLoadModule("/src/clients/_shared/client-value.js");
  const { AuthContext } = await vite.ssrLoadModule("/src/contexts/AuthContext.jsx");
  const { ClientContext } = await vite.ssrLoadModule("/src/contexts/ClientContext.jsx");
  const { ClientOrgGuard } = await vite.ssrLoadModule("/src/contexts/ClientOrgGuard.jsx");

  const origin = "https://app.stratoscapitalgroup.com";
  const nsgOrg = "4a17b181-35d2-41b3-b639-6e0bd4c38acc";
  const dukeOrg = "00000000-0000-0000-0000-000000000001";
  const cases = [
    { name: "NSG en raíz", path: "/", org: nsgOrg, redirect: `${origin}/nsg`, visible: false },
    { name: "Duke en raíz", path: "/", org: dukeOrg, redirect: null, visible: true },
    { name: "NSG en /nsg", path: "/nsg", org: nsgOrg, redirect: null, visible: true },
    { name: "NSG offline conocido en raíz", path: "/", org: nsgOrg, offline: true, redirect: `${origin}/nsg`, visible: false },
    { name: "Org nueva en raíz", path: "/", org: "99999999-9999-9999-9999-999999999999", redirect: `${origin}/tenant`, visible: false },
    { name: "Offline org nueva sin ruta verificable", path: "/", org: "99999999-9999-9999-9999-999999999999", offline: true, redirect: `${origin}/tenant`, visible: true },
    { name: "Ruta pública", path: "/politica-de-privacidad", org: nsgOrg, enabled: false, redirect: `${origin}/nsg/politica-de-privacidad`, visible: true },
  ];

  for (const test of cases) {
    const location = { origin, hostname: "app.stratoscapitalgroup.com", pathname: test.path, search: "", hash: "" };
    globalThis.window = { location };
    const clientId = matchClientFromLocation(location);
    const user = { id: "prueba", organizationId: test.org, ...(test.offline ? { _offline: true } : {}) };
    assert.equal(resolveRedirectForUser(user, clientId, location), test.redirect, `${test.name}: ruta`);
    const html = renderToStaticMarkup(
      createElement(AuthContext.Provider, { value: { user } },
        createElement(ClientContext.Provider, { value: crearValorCliente(getClientConfig(clientId)) },
          createElement(ClientOrgGuard, { enabled: test.enabled !== false },
            createElement("div", { id: "app-sentinel" }, "contenido"))))
    );
    assert.equal(html.includes("app-sentinel"), test.visible, `${test.name}: barrera`);
    console.log(`✓ ${test.name}`);
  }
} finally {
  delete globalThis.window;
  await Promise.race([vite.close(), new Promise(resolve => setTimeout(resolve, 3000))]);
}
process.exit(0);
