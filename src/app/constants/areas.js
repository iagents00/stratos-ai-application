/**
 * app/constants/areas.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Las ÁREAS de Duke y la carpeta de Drive de cada una.
 *
 * Contexto (30-jul-2026): dirección arrancó el «Plan de Trabajo Semanal» — cada
 * quien registra y mantiene su plan, y los líderes lo revisan los viernes. Cada
 * área ya tenía su carpeta de Drive; esto la mete DENTRO de Stratos para que la
 * persona no viva saltando entre pestañas: su espacio es su plan + su día + su
 * Copilot + su Drive.
 *
 * `profiles.area` (mig 227) es lo que amarra a la persona con su área. Si alguien
 * no tiene área, no ve el módulo «Mi Drive» — no rompe nada, simplemente no está.
 *
 * Las carpetas son de `rh.stratosgrup@gmail.com` y están compartidas por enlace,
 * así que el embed carga sin pedirle a nadie una cuenta de Google. Si RRHH cierra
 * el enlace de alguna, ese embed deja de renderizar y hay que compartirla de nuevo
 * (o cambiarle el id acá).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Áreas conocidas. La clave es el valor exacto de `profiles.area`. */
export const AREAS = {
  Marketing: {
    label: "Marketing",
    driveId: "12qISLSnl01oND1YhUJyM0W6y5JpYPscG",
    driveName: "MARKETING",
  },
  Comercial: {
    label: "Comercial",
    driveId: "1isZuXqk66snirDxIqFbUUyaRPBux-mAl",
    driveName: "COMERCIAL",
  },
  Operativo: {
    label: "Operativo",
    driveId: "1sfA6dMDtNFgtW_KDntH9c3mB4u1POTjy",
    driveName: "OPERATIVO",
  },
  Administrativo: {
    label: "Administrativo",
    driveId: "1eaJEQeo3B3s905R-b7ZgawUdnE4EH6fh",
    driveName: "ADMINISTRACIÓN",
  },
  Finanzas: {
    label: "Finanzas",
    driveId: "1oWFTcmIXWefyIdqdczogNGLbex-Rq7-w",
    driveName: "FINANZAS",
  },
  RRHH: {
    label: "Recursos Humanos",
    driveId: "1dJZBaIb9PdYkglBBKf9OIFSUaRKNr1xJ",
    driveName: "RRHH",
  },
};

/** Orden en que se listan cuando hay que mostrarlas todas (Comando/admin). */
export const AREA_ORDER = [
  "Marketing", "Comercial", "Operativo", "Administrativo", "Finanzas", "RRHH",
];

/** Opciones para el desplegable «Puesto/Área» del reporte diario. */
export const AREA_OPTIONS = AREA_ORDER.map(k => AREAS[k].label);

/**
 * Resuelve el área de un usuario. Tolerante: acepta el nombre corto («RRHH»),
 * el largo («Recursos Humanos») y variantes con mayúsculas/acentos, porque el
 * campo `area` de los reportes viejos se escribió a mano.
 */
export function getArea(area) {
  if (!area) return null;
  const raw = String(area).trim();
  if (AREAS[raw]) return AREAS[raw];
  const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const norm = fold(raw);
  for (const key of AREA_ORDER) {
    const a = AREAS[key];
    if ([key, a.label, a.driveName].some(c => fold(c) === norm)) return a;
  }
  return null;
}

/** URL para abrir la carpeta en Drive (pestaña nueva). */
export function driveUrlOf(area) {
  const a = getArea(area);
  return a ? `https://drive.google.com/drive/folders/${a.driveId}` : null;
}

/**
 * URL del visor embebible. Es la vista de solo-lectura que Google expone para
 * iframes; el botón «Abrir en Drive» es el que da la carpeta completa (subir,
 * renombrar, comentar).
 */
export function driveEmbedUrlOf(area) {
  const a = getArea(area);
  return a ? `https://drive.google.com/embeddedfolderview?id=${a.driveId}#grid` : null;
}
