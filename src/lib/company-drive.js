// Only folder URLs saved by this company can become embedded Drive viewers.
export function driveFolder(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com'
        || parsed.username || parsed.password || parsed.port) return null;
    const id = parsed.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]{8,200})\/?$/)?.[1];
    if (!id) return null;
    return { id, url: `https://drive.google.com/drive/folders/${id}`,
      embed: `https://drive.google.com/embeddedfolderview?id=${id}#grid` };
  } catch { return null; }
}

export function companyDriveFolders(documents) {
  const folders = new Map();
  for (const document of Array.isArray(documents) ? documents : []) {
    const folder = driveFolder(document?.url);
    if (folder && !folders.has(folder.id)) folders.set(folder.id, {
      ...folder, title: typeof document.title === 'string' && document.title.trim() || 'Carpeta de Drive',
    });
  }
  return [...folders.values()];
}
