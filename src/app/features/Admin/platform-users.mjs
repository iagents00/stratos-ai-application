export const PLATFORM_USER_ROLES = [
  ["asesor", "Asesor"], ["admin", "Administrador"], ["super_admin", "Superadministrador"],
  ["director", "Director"], ["ceo", "CEO"], ["marketing", "Marketing"], ["colaborador", "Colaborador"],
];

export const MARKETING_ADMIN_ROLES = ["admin", "super_admin", "director", "ceo", "marketing"];
export const platformRoleLabel = role => PLATFORM_USER_ROLES.find(([value]) => value === role)?.[1] || role || "Sin rol";
export const isMarketingUser = user => user?.role === "marketing" || user?.is_marketing_admin === true;
export const isProtectedPlatformUser = (user, currentUserId) => user?.id === currentUserId
  || user?.protected_from_access_changes === true || user?.platform_admin?.active === true;

const searchText = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filterPlatformUsers(users, organizations, { query = "", organizationId = "", role = "", status = "", marketing = false } = {}) {
  const names = new Map(organizations.map(org => [org.id, org.name]));
  const words = searchText(query).trim().split(/\s+/).filter(Boolean);
  return users.filter(user => {
    if (organizationId && (organizationId === "unassigned" ? !!user.organization_id : user.organization_id !== organizationId)) return false;
    if (role && user.role !== role) return false;
    if (status && (user.active !== false) !== (status === "active")) return false;
    if (marketing && !isMarketingUser(user)) return false;
    const text = searchText(`${user.name || ""} ${user.email || ""} ${names.get(user.organization_id) || ""}`);
    return words.every(word => text.includes(word));
  });
}

export function platformUserDraft(user) {
  return {
    name: user.name || "", role: user.role || "", active: user.active !== false,
    organization_id: user.organization_id || "", is_marketing_admin: user.is_marketing_admin === true,
    crm_only: user.crm_only === true, area: user.area || "", confirm_move: false,
  };
}

export function platformUserChanged(draft, user) {
  if (!draft || !user) return false;
  const original = platformUserDraft(user);
  return Object.keys(original).filter(key => key !== "confirm_move").some(key => draft[key] !== original[key]);
}

export function validatePlatformUserDraft(draft, user, organizations, currentUserId) {
  if (!draft || !user) return "Selecciona un usuario antes de guardar.";
  if (user.profile_missing || user.identity_missing) return "Esta cuenta necesita recuperar su perfil o su identidad de acceso antes de editarla.";
  if (!draft.name.trim() || draft.name.trim().length > 120) return "Escribe un nombre de entre 1 y 120 caracteres.";
  if (!PLATFORM_USER_ROLES.some(([role]) => role === draft.role)) return "Selecciona un rol válido.";
  if (draft.area.trim().length > 100) return "El área admite hasta 100 caracteres.";
  if (draft.is_marketing_admin && (!MARKETING_ADMIN_ROLES.includes(draft.role) || draft.crm_only)) {
    return "La administración de Marketing requiere un rol compatible y acceso completo al CRM.";
  }
  const changedOrganization = (user.organization_id || "") !== draft.organization_id;
  if (isProtectedPlatformUser(user, currentUserId)
    && ["role", "active", "organization_id", "is_marketing_admin", "crm_only"].some(key => draft[key] !== platformUserDraft(user)[key])) {
    return "Esta cuenta está protegida. Solo puedes editar su nombre y área.";
  }
  if (changedOrganization) {
    const destination = organizations.find(org => org.id === draft.organization_id);
    if (!destination) return "Selecciona la empresa de destino.";
    if (draft.active && destination.active === false) return "Activa la empresa de destino antes de mover un usuario activo.";
    if (!draft.confirm_move) return "Confirma el traslado de la cuenta a la empresa seleccionada.";
  }
  return "";
}
