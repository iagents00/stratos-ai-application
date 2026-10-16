const EDITABLE_TABLES = new Set([
  'mkt_tasks', 'mkt_projects', 'mkt_requests', 'mkt_pipeline_items',
  'mkt_pipeline_columns', 'mkt_daily_reports',
]);

// RLS can acknowledge an UPDATE while changing zero rows. Require the saved
// record before the UI closes an editor or reports a completed operation.
export async function updateMarketingRecord(client, table, id, organizationId, fields) {
  if (!EDITABLE_TABLES.has(table) || !id || !organizationId) {
    return { data: null, error: new Error('Falta un registro de tu organización para guardar.') };
  }
  try {
    const result = await client.from(table).update(fields)
      .eq('id', id).eq('organization_id', organizationId).select('id').single();
    if (result.error) return result;
    if (result.data?.id !== id) {
      return { data: null, error: new Error('El registro ya no está disponible para guardar.') };
    }
    return result;
  } catch (error) {
    return { data: null, error };
  }
}
