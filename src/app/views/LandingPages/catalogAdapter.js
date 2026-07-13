/**
 * catalogAdapter.js — Puente entre el catálogo maestro y el generador de landings
 * ─────────────────────────────────────────────────────────────────────────────
 * El catálogo real de desarrollos vive en src/app/data/catalogoProyectos.js
 * (auto-generado del Google Sheet "DRIVES DUKE DEL CARIBE"; el ERP lo muestra).
 * Aquí lo convertimos al shape que consume el generador de landing pages, para
 * que TODAS las propiedades con carpeta de Drive aparezcan al seleccionar las
 * de un cliente — sin duplicar datos ni tocar la base de datos.
 *
 * Nunca se exponen datos internos (masterbroker / contacto) a la landing del
 * cliente: no se copian a la prop.
 *
 * También expone la codificación de la landing en la URL: la presentación se
 * comparte como /p#d=<base64url> auto-contenido (el cliente la abre sin login y
 * sin backend). Ver PublicLanding.jsx.
 */
import { CATALOGO_SECCIONES } from "../../data/catalogoProyectos";

const ACCENTS = ["#6EE7C2", "#7EB8F0", "#A78BFA", "#F0B86E", "#5DC8D9", "#86EFAC", "#F0A3BB", "#93C5FD", "#67E8C3", "#B7A6F3"];
export const accentForName = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
};

export const gradientFor = (accent = "#6EE7C2") =>
  `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 55%, #0a2a3a 45%) 45%, #061019 100%)`;

// Title-case suave para ubicaciones del Sheet ("Playa del carmen" → "Playa del Carmen").
const MINOR = new Set(["de", "del", "la", "las", "los", "y", "el"]);
const titleCase = (s = "") =>
  s.trim().toLowerCase().split(/\s+/).map((w, i) =>
    (i > 0 && MINOR.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");

// Etiqueta corta de tipo a partir de la clasificación del Sheet.
const TYPE_LABEL = {
  STUDIO: "Estudio", CONDO: "Condominio", DEPARTAMENTO: "Departamento",
  VILLA: "Villa", VILLAS: "Villas", PENTHOUSE: "Penthouse", LUXURY: "Lujo",
  "CONDO LOCK OFF": "Condominio", "RENTA VACACIONAL": "Renta vacacional",
};
const typeLabel = (clase = "") => {
  const c = clase.trim().toUpperCase();
  if (!c || ["SIN INFO", "REPETIDO", "VENDIDO", "N/A"].includes(c)) return "";
  return TYPE_LABEL[c] || (c.length <= 16 ? titleCase(c) : "");
};

// Rango numérico aprox. (USD) desde el ticket del Sheet: "150k a 250k", "0 a 150 k",
// "450k < +", "350k a 450k". Devuelve {priceFrom, priceTo} (0/0 si no se puede leer).
export const ticketToRange = (ticket = "") => {
  const nums = (ticket.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => !isNaN(n));
  if (nums.length === 0) return { priceFrom: 0, priceTo: 0 };
  const k = (n) => Math.round(n * (n < 10000 ? 1000 : 1)); // el Sheet usa miles ("150k")
  if (nums.length === 1) {
    const a = k(nums[0]);
    return /(\+|<|desde|>)/i.test(ticket) ? { priceFrom: a, priceTo: Math.round(a * 2) } : { priceFrom: a, priceTo: a };
  }
  return { priceFrom: k(Math.min(...nums)), priceTo: k(Math.max(...nums)) };
};

// clasificaciones que NO se ofrecen al cliente
const EXCLUDE_CLASS = new Set(["VENDIDO", "REPETIDO"]);

/** Convierte una fila del catálogo maestro al shape de landing prop. */
const itemToProp = (it, secId, idx) => {
  const name = (it.desarrollo || "").trim();
  const accent = accentForName(name);
  const location = titleCase(it.ubicacion || "") || "Riviera Maya";
  const { priceFrom, priceTo } = ticketToRange(it.ticket || "");
  const highlights = [
    it.highlights && titleCase(it.highlights),
    it.entregaComo && `Entrega: ${it.entregaComo}`,
    it.financiamiento && `Financiamiento ${it.financiamiento}`,
    it.mantenimiento && `Mantenimiento ${it.mantenimiento}`,
  ].filter(Boolean);
  return {
    id: `cat:${secId}:${idx}`,
    name,
    brand: "",
    location,
    zone: it.zona ? titleCase(it.zona) : location,
    type: typeLabel(it.clasificacion),
    bedrooms: (it.tipologia || "").trim(),
    ticket: (it.ticket || "").trim(),
    priceFrom, priceTo,
    roi: "", roiNum: 0,
    delivery: (it.entrega || "").trim(),
    badge: secId === "top-desarrollos" ? "TOP" : "CATÁLOGO",
    unitsAvailable: 0, totalUnits: 0,
    featured: secId === "top-desarrollos",
    amenities: [],
    sizes: [],
    highlights,
    description: [
      `${name} en ${location}${it.zona ? ` · ${titleCase(it.zona)}` : ""}.`,
      it.tipologia && `Tipología: ${it.tipologia}.`,
      it.entrega && `Entrega ${it.entrega}.`,
      "Desarrollo del catálogo del equipo con material disponible.",
    ].filter(Boolean).join(" "),
    img: gradientFor(accent),
    accent,
    driveLink: it.drive || "",
    mapsUrl: it.maps || "",
    fromCatalog: true,
  };
};

/** Todas las propiedades del catálogo con carpeta de Drive, listas para el selector. */
export const catalogToLandingProps = () => {
  const out = [];
  const seen = new Set();
  for (const sec of CATALOGO_SECCIONES || []) {
    (sec.items || []).forEach((it, idx) => {
      const name = (it.desarrollo || "").trim();
      if (!name || !it.drive) return; // solo desarrollos con material de Drive
      if (EXCLUDE_CLASS.has((it.clasificacion || "").trim().toUpperCase())) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return; // el mismo desarrollo puede repetirse entre pestañas
      seen.add(key);
      out.push(itemToProp(it, sec.id, idx));
    });
  }
  return out.sort((a, b) => (b.featured - a.featured) || a.location.localeCompare(b.location, "es") || a.name.localeCompare(b.name, "es"));
};

// ─── Landing auto-contenida en la URL (sin backend) ──────────────────────────

const toB64Url = (str) => btoa(unescape(encodeURIComponent(str)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (b64) => {
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
};

const clip = (s, n) => (s || "").toString().slice(0, n);

/** Construye el payload compacto de una landing para meterlo en la URL. */
export const encodeLanding = ({ client, mensaje, asesor, asesorWA, asesorCal, agencyName, properties, driveLinks = {} }) => {
  const payload = {
    v: 1,
    c: clip(client, 80),
    m: clip(mensaje, 600),
    a: clip(asesor, 60),
    w: clip(asesorWA, 30),
    k: clip(asesorCal, 200),
    g: clip(agencyName, 60),
    p: (properties || []).slice(0, 12).map(pr => ({
      n: clip(pr.name, 80),
      br: clip(pr.brand, 60),
      l: clip(pr.location, 60),
      z: clip(pr.zone, 80),
      ty: clip(pr.bedrooms || pr.type, 60),
      tk: clip(pr.ticket, 40),
      e: clip(pr.delivery, 40),
      ro: clip(pr.roi, 16),
      h: (pr.highlights || []).slice(0, 6).map(x => clip(x, 90)),
      am: (pr.amenities || []).slice(0, 10).map(x => clip(x, 40)),
      de: clip(pr.description, 320),
      d: clip(driveLinks[pr.id] || pr.driveLink, 400),
      mp: clip(pr.mapsUrl, 400),
      ac: clip(pr.accent, 9),
      pf: pr.priceFrom || 0,
      pt: pr.priceTo || 0,
    })),
  };
  return toB64Url(JSON.stringify(payload));
};

/** Decodifica el payload de la URL de vuelta a props de landing. */
export const decodeLanding = (b64) => {
  try {
    const o = JSON.parse(fromB64Url(b64));
    if (!o || !Array.isArray(o.p)) return null;
    return {
      client: o.c || "", mensaje: o.m || "", asesor: o.a || "",
      asesorWA: o.w || "", asesorCal: o.k || "", agencyName: o.g || "STRATOS REALTY",
      properties: o.p.map((s, i) => {
        const accent = s.ac || accentForName(s.n || `p${i}`);
        return {
          id: `s${i}`, name: s.n || "", brand: s.br || "",
          location: s.l || "", zone: s.z || s.l || "",
          type: "", bedrooms: s.ty || "", ticket: s.tk || "",
          delivery: s.e || "", roi: s.ro || "", roiNum: 0,
          badge: "", featured: false, sizes: [],
          highlights: Array.isArray(s.h) ? s.h : [],
          amenities: Array.isArray(s.am) ? s.am : [],
          description: s.de || "",
          priceFrom: s.pf || 0, priceTo: s.pt || 0,
          accent, img: gradientFor(accent),
          driveLink: s.d || "", mapsUrl: s.mp || "",
        };
      }),
    };
  } catch { return null; }
};
