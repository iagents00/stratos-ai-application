// Do not treat the API's row cap as the end of the dataset. Callers must use
// a stable, unique final sort (id) and scope the query to the active organization.
export async function readAllRows(makeQuery, pageSize = 500, { concurrency = 1, onProgress } = {}) {
  const rows = [];
  // The first response discovers PostgREST's actual row cap. Keep offsets at
  // that size so parallel requests never skip rows when the cap is below 500.
  let stride = pageSize;
  let width = 1;
  const parallel = Math.max(1, Math.min(3, Math.floor(concurrency) || 1));
  try {
    for (let page = 0; page < 20000; page++) {
      const start = rows.length;
      const batch = await Promise.all(Array.from({ length: width }, (_, index) => {
        const from = start + index * stride;
        return makeQuery().range(from, from + stride - 1);
      }));
      for (const { data, error } of batch) {
        if (error) return { data: null, error };
        if (!Array.isArray(data)) return { data: null, error: { message: "Respuesta de datos no válida." } };
      }
      let ended = false;
      for (const { data } of batch) {
        if (data.length === 0) { ended = true; break; }
        rows.push(...data);
      }
      if (ended) return { data: rows, error: null };
      onProgress?.(rows.slice());
      if (page === 0) stride = Math.min(pageSize, rows.length);
      width = parallel;
    }
    return { data: null, error: { message: "La carga no pudo completarse. Reduce el rango y vuelve a intentar." } };
  } catch (error) {
    return { data: null, error: { message: error?.message || "No se pudo conectar con el servidor." } };
  }
}
