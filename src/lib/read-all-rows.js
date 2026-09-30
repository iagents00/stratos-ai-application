// Do not treat the API's row cap as the end of the dataset. Callers must use
// a stable, unique final sort (id) and scope the query to the active organization.
export async function readAllRows(makeQuery, pageSize = 500) {
  const rows = [];
  try {
    for (let page = 0; page < 20000; page++) {
      const { data, error } = await makeQuery().range(rows.length, rows.length + pageSize - 1);
      if (error) return { data: null, error };
      if (!Array.isArray(data)) return { data: null, error: { message: "Respuesta de datos no válida." } };
      if (data.length === 0) return { data: rows, error: null };
      rows.push(...data);
    }
    return { data: null, error: { message: "La carga no pudo completarse. Reduce el rango y vuelve a intentar." } };
  } catch (error) {
    return { data: null, error: { message: error?.message || "No se pudo conectar con el servidor." } };
  }
}
