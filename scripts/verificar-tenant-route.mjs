/** Regresión de identidad URL ↔ organización y barrera de render. */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { getClientConfig, resolveClientFromLocation, resolveRedirectForUser } =
    await vite.ssrLoadModule("/src/clients/index.js");
  const { crearValorCliente } = await vite.ssrLoadModule("/src/clients/_shared/client-value.js");
  const { AuthContext } = await vite.ssrLoadModule("/src/contexts/AuthContext.jsx");
  const { ClientContext } = await vite.ssrLoadModule("/src/contexts/ClientContext.jsx");
  const { ClientOrgGuard } = await vite.ssrLoadModule("/src/contexts/ClientOrgGuard.jsx");
  const { default: LoginScreen } = await vite.ssrLoadModule("/src/landing/LoginScreen.jsx");

  const origin = "https://app.stratoscapitalgroup.com";
  const nsgOrg = "4a17b181-35d2-41b3-b639-6e0bd4c38acc";
  const dukeOrg = "00000000-0000-0000-0000-000000000001";
  const cases = [
    { name: "NSG en raíz aplica empresa sin cambiar URL", path: "/", org: nsgOrg, redirect: null, visible: false },
    { name: "Duke en raíz espera configuración propia", path: "/", org: dukeOrg, redirect: null, visible: false },
    { name: "NSG en raíz con configuración verificada", path: "/", org: nsgOrg, appliedClient: "nsg", redirect: null, visible: true },
    { name: "NSG en login fijo", path: "/login", org: nsgOrg, redirect: null, visible: false },
    { name: "NSG en login fijo con configuración verificada", path: "/login", org: nsgOrg, appliedClient: "nsg", redirect: null, visible: true },
    { name: "NSG en /nsg", path: "/nsg", org: nsgOrg, redirect: null, visible: true },
    { name: "NSG en white-label ajeno conserva redirección", path: "/grupo28", org: nsgOrg, redirect: `${origin}/nsg`, visible: false },
    { name: "NSG offline conserva interfaz actual", path: "/", org: nsgOrg, offline: true, redirect: null, visible: true },
    { name: "App nativa espera su configuración", path: "/", org: nsgOrg, native: true, redirect: null, visible: false },
    { name: "Org nueva en raíz usa configuración neutral", path: "/", org: "99999999-9999-9999-9999-999999999999", redirect: null, visible: true },
    { name: "Offline org nueva sin ruta verificable", path: "/", org: "99999999-9999-9999-9999-999999999999", offline: true, redirect: null, visible: true },
    { name: "Ruta pública", path: "/politica-de-privacidad", org: nsgOrg, enabled: false, redirect: `${origin}/nsg/politica-de-privacidad`, visible: true },
  ];

  for (const test of cases) {
    const location = { origin, hostname: "app.stratoscapitalgroup.com", pathname: test.path, search: "", hash: "" };
    globalThis.window = { location, ...(test.native ? { Capacitor: { isNativePlatform: () => true } } : {}) };
    const clientId = test.appliedClient || resolveClientFromLocation(location).id;
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

  for (const path of ["/login", "/", "/tgenius"]) {
    globalThis.window = { location: { origin, hostname: "app.stratoscapitalgroup.com", pathname: path, search: "" } };
    const html = renderToStaticMarkup(createElement(ClientContext.Provider, { value: crearValorCliente(getClientConfig("tgenius")) }, createElement(LoginScreen, { onLogin: () => {} })));
    assert.equal(html.includes("TGenius"), path === "/tgenius", `${path}: portada fija o específica`);
    assert.equal(html.includes('auth-email'), true, `${path}: formulario disponible`);
  }
  console.log("✓ Portada Stratos fija y portada white-label conservada");
} finally {
  delete globalThis.window;
  await Promise.race([vite.close(), new Promise(resolve => setTimeout(resolve, 3000))]);
}
process.exit(0);
