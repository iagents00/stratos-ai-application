export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
const FILE_TYPES = new Map([
  ['application/pdf', 'pdf'], ['image/jpeg', 'jpg'], ['image/png', 'png'],
  ['image/webp', 'webp'], ['image/heic', 'heic'], ['image/heif', 'heif'],
]);

export function documentFileExtension(file) {
  if (!file || !file.size) throw new Error('Selecciona un archivo que tenga contenido.');
  if (file.size > DOCUMENT_MAX_BYTES) throw new Error('El archivo debe pesar como máximo 15 MB.');
  const extension = FILE_TYPES.get(file.type);
  if (!extension) throw new Error('Usa un PDF o una imagen JPG, PNG, WebP o HEIC.');
  return extension;
}

// The original identification remains visible without rewriting existing leads.
// Its deterministic ID also lets the server edit/remove it on the first save.
export function leadDocuments(lead) {
  if (Array.isArray(lead?.documents) && lead.documents.length) return lead.documents;
  if (!lead?.id_document?.trim() && !lead?.id_document_path) return [];
  return [{ id: String(lead.id), kind: 'identity', name: lead.n || lead.name || 'Titular',
    number: lead.id_document || '', path: lead.id_document_path || null,
    filename: lead.id_document_path?.split('/').pop() || null }];
}

export function contactChannels(contact, field) {
  const values = Array.isArray(contact?.[`${field}s`]) && contact[`${field}s`].length
    ? contact[`${field}s`] : [contact?.[field]];
  const seen = new Set();
  return values.map(value => String(value || '').trim()).filter(value => {
    const key = field === 'email' ? value.toLowerCase() : value;
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
