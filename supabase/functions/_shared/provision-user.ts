// Supabase Auth writes custom app_metadata after the initial user INSERT.
// A single-use ticket binds that INSERT to the server-authorized organization.
export async function createProvisionedUser(admin: any, attributes: any) {
  const token = crypto.randomUUID();
  const { error } = await admin.from("auth_provisioning_tickets").insert({
    token, email: String(attributes.email).trim().toLowerCase(),
    organization_id: attributes.app_metadata.stratos_organization_id,
    role: attributes.app_metadata.stratos_role,
  });
  if (error) return { data: { user: null }, error };
  try {
    return await admin.auth.admin.createUser({
      ...attributes,
      user_metadata: { ...attributes.user_metadata, stratos_provisioning_ticket: token },
    });
  } finally {
    // Consumed tickets are already gone. Failed/duplicate Auth requests leave
    // no usable ticket; expiry also bounds a network failure during cleanup.
    const cleanup = await admin.from("auth_provisioning_tickets").delete().eq("token", token);
    if (cleanup.error) console.error("[provision-user] ticket cleanup failed");
  }
}
