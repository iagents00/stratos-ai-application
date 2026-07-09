#!/usr/bin/env python3
"""
importar_catalogo.py
────────────────────────────────────────────────────────────────────────────
Genera src/app/data/catalogoProyectos.js a partir de una exportación .xlsx del
Google Sheet «DRIVES DUKE DEL CARIBE» (fileId 1csNwUK4QsV7woRAUHJ6Z_mtqukTEbZr9XdIYQHK2z1Q).

Cómo usar:
  1. Archivo → Descargar → Microsoft Excel (.xlsx) desde el Sheet.
  2. python3 tools/importar_catalogo.py ruta/al/DRIVES_DUKE_DEL_CARIBE.xlsx

Extrae celdas + hipervínculos (los links viven en el .xlsx, NO en el CSV) y
normaliza cada pestaña a un mismo esquema de item. Solo depende de la stdlib.
"""
import sys, re, json, zipfile, datetime
from urllib.parse import unquote
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
RELNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

CATALOG = [
    ("riviera-maya", "Proyectos Riviera Maya"), ("top-desarrollos", "Top Desarrollos"),
    ("terrenos", "Terrenos"), ("merida", "Proyectos Mérida"),
    ("los-cabos", "Proyectos Los Cabos"), ("miami", "Proyectos Miami"),
    ("dubai", "Proyectos Dubai"),
]
FIELD = {
    "UBICACIÓN": "ubicacion", "ZONA": "zona", "DESARROLLO": "desarrollo",
    "MASTERBROKER": "masterbroker", "TICKET": "ticket", "CLASIFICACIÓN": "clasificacion",
    "ENTREGA": "entrega", "FINANCIAMIENTO": "financiamiento", "CÓMO SE ENTREGA": "entregaComo",
    "TIPOLOGÍA": "tipologia", "HIGHLIGHTS": "highlights", "MANTENIMIENTO": "mantenimiento",
    "CONTACTO": "contacto", "DRIVE": "drive", "MAPS": "maps",
}
FIELDS_ORDER = ["desarrollo", "ubicacion", "zona", "masterbroker", "ticket", "clasificacion",
                "tipologia", "entrega", "financiamiento", "entregaComo", "highlights",
                "mantenimiento", "contacto", "asesor", "drive", "maps"]
ASESORES = {"ROBERT", "ANGELY", "TITAN", "KEN", "FER", "ALEX", "ALAN", "BIANCA", "YAIR", "YULIANA"}


def parse(path):
    Z = zipfile.ZipFile(path)
    sst = []
    if "xl/sharedStrings.xml" in Z.namelist():
        for si in ET.fromstring(Z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            sst.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(Z.read("xl/workbook.xml"))
    sheets = [{"name": s.get("name"), "rid": s.get("{%s}id" % RELNS)}
              for s in wb.find("m:sheets", NS).findall("m:sheet", NS)]
    rid2t = {rel.get("Id"): rel.get("Target")
             for rel in ET.fromstring(Z.read("xl/_rels/workbook.xml.rels"))}
    out = {}
    for sh in sheets:
        tgt = rid2t[sh["rid"]]
        path_ws = "xl/" + tgt.lstrip("/")
        ws = ET.fromstring(Z.read(path_ws))
        rp = "xl/worksheets/_rels/%s.rels" % path_ws.split("/")[-1]
        hl = {}
        if rp in Z.namelist():
            hl = {rel.get("Id"): rel.get("Target") for rel in ET.fromstring(Z.read(rp))}
        ref2url = {}
        hls = ws.find("m:hyperlinks", NS)
        if hls is not None:
            for h in hls.findall("m:hyperlink", NS):
                rid = h.get("{%s}id" % RELNS)
                if rid in hl:
                    ref2url[h.get("ref")] = hl[rid]
        rows = []
        for row in ws.find("m:sheetData", NS).findall("m:row", NS):
            cells = []
            for c in row.findall("m:c", NS):
                ref, t = c.get("r"), c.get("t")
                v, isn = c.find("m:v", NS), c.find("m:is", NS)
                val = ""
                if t == "s" and v is not None:
                    val = sst[int(v.text)]
                elif t == "inlineStr" and isn is not None:
                    val = "".join(x.text or "" for x in isn.iter("{%s}t" % NS["m"]))
                elif v is not None:
                    val = v.text or ""
                url = ref2url.get(ref, "")
                if val.strip() or url:
                    cells.append({"ref": ref, "v": val.strip(), "url": url})
            if cells:
                rows.append(cells)
        out[sh["name"]] = rows
    return out


def unwrap(u):
    u = (u or "").strip()
    if "google.com/url" in u:
        m = re.search(r"[?&]q=([^&]+)", u)
        if m:
            return unquote(m.group(1))
    return u


def clean(s):
    s = (s or "").strip()
    return "" if s in ("-", "—", "´´", "·") else s


def fmt_entrega(s):
    s = (s or "").strip()
    m = re.match(r"^(\d+)(\.0)?$", s)
    if m:
        n = int(m.group(1))
        if 30000 <= n <= 60000:
            base = datetime.date(1899, 12, 30) + datetime.timedelta(days=n)
            meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
            return "%s %d" % (meses[base.month - 1], base.year)
        if 1900 <= n <= 2100:
            return str(n)
    return s


def build(sheets):
    def cell(row, col):
        for c in row:
            if re.match(r"^%s\d+$" % col, c["ref"]):
                return c
        return None

    def val(row, col):
        c = cell(row, col)
        return c["v"] if c else ""

    def url(row, col):
        c = cell(row, col)
        if not c:
            return ""
        if c["url"].startswith("http"):
            return unwrap(c["url"])
        if c["v"].startswith("http"):
            return unwrap(c["v"])
        return ""

    sections = []
    for sid, sname in CATALOG:
        rows = sheets.get(sname, [])
        items = []
        if rows:
            colmap = {}
            for c in rows[0]:
                f = FIELD.get(c["v"].strip().upper())
                if f:
                    colmap[f] = re.match(r"([A-Z]+)", c["ref"]).group(1)
            for row in rows[1:]:
                it = {f: clean(val(row, col)) for f, col in colmap.items() if f not in ("drive", "maps")}
                it["drive"] = url(row, colmap["drive"]) if "drive" in colmap else ""
                it["maps"] = url(row, colmap["maps"]) if "maps" in colmap else ""
                nc = cell(row, colmap["desarrollo"]) if "desarrollo" in colmap else None
                nurl = unwrap(nc["url"]) if (nc and nc.get("url", "").startswith("http")) else ""
                if not it.get("drive") and "drive.google" in nurl:
                    it["drive"] = nurl
                it["entrega"] = fmt_entrega(it.get("entrega", ""))
                if not it.get("ubicacion") and it.get("zona"):
                    it["ubicacion"] = it["zona"]
                if it.get("desarrollo"):
                    items.append(it)
        sections.append({"id": sid, "nombre": sname, "items": items})

    # Grilla por asesor (pestaña DRIVES DC)
    dc = sheets.get("DRIVES DC", [])
    dc_items = []
    tiers = [("B", "C", "D"), ("E", "F", "G"), ("H", "I", "J"), ("K", "L", "M")]
    labels, asesor = {}, ""
    for row in dc:
        a = clean(val(row, "A"))
        if a.upper().startswith("PROYECTOS") or a.upper().startswith("TERRENOS"):
            labels = {t[0]: clean(val(row, t[0])) for t in tiers}
            continue
        if a.upper() in ASESORES:
            asesor = a.title()
        for pc, hc, dc_ in tiers:
            nm = clean(val(row, pc))
            if not nm:
                continue
            dc_items.append({"desarrollo": nm, "highlights": clean(val(row, hc)),
                             "drive": url(row, dc_), "ticket": labels.get(pc, ""),
                             "asesor": asesor, "ubicacion": "Tulum", "zona": "Tulum"})
    sections.append({"id": "drives-dc", "nombre": "Drives DC (por asesor)", "items": dc_items})

    # Pestañas ocultas "sastre" (base detallada por zona) — otro esquema de columnas.
    SASTRE = [("tulum-sastre", "Tulum (Sastre)", "PTULUMSASTRE", "Tulum"),
              ("pdc-sastre", "Playa del Carmen (Sastre)", "PPDCSASTRE", "Playa del Carmen")]
    SFIELD = {"DESARROLLO": "desarrollo", "DESAROLLO": "desarrollo", "MASTER BROKER": "masterbroker",
              "FECHA DE ENTREGA": "entrega", "# DE HAB": "tipologia",
              "UBICACIÓN": "ubicacion", "UBICACION": "ubicacion", "CONTACTO": "contacto", "DRIVE": "drive"}
    for sid, sname, tab, zona in SASTRE:
        rows = sheets.get(tab, [])
        items = []
        if rows:
            colmap = {}
            for c in rows[0]:
                f = SFIELD.get(c["v"].strip().upper())
                if f:
                    colmap[f] = re.match(r"([A-Z]+)", c["ref"]).group(1)
            for row in rows[1:]:
                it = {f: clean(val(row, col)) for f, col in colmap.items() if f != "drive"}
                nc = cell(row, colmap.get("desarrollo", "A"))
                nurl = unwrap(nc["url"]) if (nc and nc.get("url", "").startswith("http")) else ""
                drive = url(row, colmap["drive"]) if "drive" in colmap else ""
                if not drive and "drive.google" in nurl:
                    drive = nurl
                if "/maps" in nurl or "maps.google" in nurl or "goo.gl/maps" in nurl:
                    it["maps"] = nurl
                it["drive"] = drive
                it["entrega"] = fmt_entrega(it.get("entrega", ""))
                it["zona"] = zona
                if not it.get("ubicacion"):
                    it["ubicacion"] = zona
                if it.get("desarrollo"):
                    items.append(it)
        sections.append({"id": sid, "nombre": sname, "items": items})

    return sections


def emit(sections):
    def esc(s):
        return (s or "").replace("\\", "\\\\").replace('"', '\\"')
    out = ['// AUTO-GENERADO desde el Google Sheet "DRIVES DUKE DEL CARIBE" (10 pestañas).',
           "// Catálogo maestro de proyectos de corretaje de Duke del Caribe.",
           "// Regenerar: python3 tools/importar_catalogo.py <export.xlsx>. NO editar a mano.",
           "", "export const CATALOGO_SECCIONES = ["]
    total = 0
    for s in sections:
        out.append("  {")
        out.append('    id: "%s", nombre: "%s", items: [' % (s["id"], esc(s["nombre"])))
        for it in s["items"]:
            total += 1
            pairs = ['%s: "%s"' % (f, esc(it[f])) for f in FIELDS_ORDER if it.get(f)]
            out.append("      { " + ", ".join(pairs) + " },")
        out.append("    ] },")
    out.append("];")
    out.append("")
    out.append("export const CATALOGO_TOTAL = %d;" % total)
    return "\n".join(out) + "\n", total


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: python3 tools/importar_catalogo.py <export.xlsx>")
        sys.exit(1)
    sheets = parse(sys.argv[1])
    sections = build(sheets)
    js, total = emit(sections)
    dest = "src/app/data/catalogoProyectos.js"
    open(dest, "w").write(js)
    print("✓ %s — %d desarrollos" % (dest, total))
    for s in sections:
        print("   %-28s %d" % (s["nombre"], len(s["items"])))
