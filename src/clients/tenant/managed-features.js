// Solo estos módulos se pueden administrar sin una integración o política de
// acceso adicional. Las empresas históricas conservan su config de código.
export const MANAGED_TENANT_FEATURES = Object.freeze([
  { key: "teamAdmin", label: "Gestión de usuarios", defaultEnabled: true },
  { key: "mktModule", label: "Proyectos y tareas (administradores)", defaultEnabled: false },
  { key: "comandoDirectivo", label: "Comando directivo (administradores)", defaultEnabled: false },
]);

export function managedTenantFeatures(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(MANAGED_TENANT_FEATURES.map(item => [
    item.key,
    typeof source[item.key] === "boolean" ? source[item.key] : item.defaultEnabled,
  ]));
}
