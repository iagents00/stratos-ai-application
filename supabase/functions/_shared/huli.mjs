const BASE = 'https://api.huli.io/practice/v2';
export class HuliError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export function parseHuliCommand(text) {
  if (typeof text !== 'string' || !/^huli(?:\s|$)/i.test(text.trim())) return null;
  const words = text.trim().split(/\s+/);
  if (words.length === 1 || (words.length === 2 && /^(estado|ayuda)$/i.test(words[1]))) return { action: words[1]?.toLowerCase() || 'ayuda' };
  if (words.length === 6 && words[1].toLowerCase() === 'disponibilidad' && words.slice(2,4).every(x => /^[1-9]\d*$/.test(x)) && words.slice(4).every(validDate)) {
    const [, , doctorId, clinicId, from, to] = words;
    const span = Date.parse(to) - Date.parse(from);
    if (span > 0 && span <= 31 * 86400000) return { action: 'disponibilidad', doctorId, clinicId, from, to };
  }
  return { action: 'ayuda' };
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
export function requireAllowedPair(config, command) {
  if (!(config.allowedPairs || []).some(pair => String(pair.doctorId) === command.doctorId && String(pair.clinicId) === command.clinicId)) {
    throw new HuliError('Este médico y sede no están habilitados para tu organización.', 403);
  }
}
export class HuliClient {
  constructor(config, fetcher = fetch) {
    if (!config?.apiKey || !/^[1-9]\d*$/.test(config.organizationId)) throw new HuliError('Conexión Huli sin configurar.', 503);
    this.config = config; this.fetcher = fetcher;
  }
  async json(path, options = {}) {
    let response;
    try { response = await this.fetcher(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(15000) }); }
    catch { throw new HuliError('Huli no respondió. Intenta de nuevo.', 504); }
    if (!response.ok) throw new HuliError(response.status === 401 || response.status === 403 ? 'Huli rechazó el acceso. Revisa la conexión y permisos.' : 'Huli no pudo completar la consulta.', response.status === 401 || response.status === 403 ? 503 : 502);
    try { return await response.json(); } catch { throw new HuliError('Respuesta inválida de Huli.'); }
  }
  async authenticate() {
    const data = await this.json('/authorization/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: this.config.apiKey }) });
    if (typeof data.data?.jwt !== 'string' || !data.data.jwt) throw new HuliError('Huli no devolvió un token válido.');
    this.jwt = data.data.jwt;
  }
  async get(path) {
    if (!this.jwt) await this.authenticate();
    return this.json(path, { headers: { Authorization: `Bearer ${this.jwt}`, id_organization: this.config.organizationId } });
  }
  async status() {
    const data = await this.get('/organization');
    const org = data.organizations?.find(o => String(o.idOrganization) === this.config.organizationId);
    if (!org || org.status !== 'ACTIVE') throw new HuliError('La organización Huli no está activa o no corresponde a esta conexión.', 403);
    return { organizationId: String(org.idOrganization), name: org.name, status: org.status };
  }
  async availability(command) {
    requireAllowedPair(this.config, command);
    await this.status();
    const query = new URLSearchParams({ from: command.from, to: command.to });
    const data = await this.get(`/availability/doctor/${command.doctorId}/clinic/${command.clinicId}?${query}`);
    if (String(data.idDoctor) !== command.doctorId || String(data.idClinic) !== command.clinicId || !Array.isArray(data.slotDates)) throw new HuliError('Huli devolvió disponibilidad fuera del alcance solicitado.');
    return data.slotDates.flatMap(day => (day.slots || []).map(slot => slot.dateTime)).filter(value => typeof value === 'string').slice(0, 40);
  }
}
export const HULI_HELP = 'Huli: usa «huli estado» para verificar la conexión, o «huli disponibilidad ID_MEDICO ID_SEDE DESDE HASTA». Fechas ISO con zona horaria, por ejemplo 2026-10-01T08:00:00-07:00. Rango máximo: 31 días. Las consultas requieren una conexión habilitada para tu organización. Esta versión consulta disponibilidad; no crea ni modifica citas.';
