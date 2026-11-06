// Catálogo de módulos administrables. La instalación nueva incluye siempre los
// cinco módulos estándar; la lectura de empresas previas conserva sus flags.
export const MANAGED_TENANT_FEATURES = Object.freeze([
  { key: "teamAdmin", label: "Gestión de usuarios", defaultEnabled: true },
  { key: "mktModule", label: "Gestión de tareas (administradores)", defaultEnabled: false },
  { key: "comandoDirectivo", label: "Comando", defaultEnabled: false, requiredOnCreate: true },
  { key: "erp", label: "Proyectos", defaultEnabled: false, requiredOnCreate: true },
  { key: "finanzas", label: "Finanzas", defaultEnabled: false, requiredOnCreate: true },
  { key: "miDrive", label: "Mi Drive", defaultEnabled: false, requiredOnCreate: true },
  { key: "landingPages", label: "Create", defaultEnabled: false, requiredOnCreate: true },
]);

export function managedTenantFeatures(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(MANAGED_TENANT_FEATURES.map(item => [
    item.key,
    typeof source[item.key] === "boolean" ? source[item.key] : item.defaultEnabled,
  ]));
}

export function newCompanyFeatures(value) {
  return { ...managedTenantFeatures(value), ...Object.fromEntries(
    MANAGED_TENANT_FEATURES.filter(item => item.requiredOnCreate).map(item => [item.key, true])
  ) };
}
