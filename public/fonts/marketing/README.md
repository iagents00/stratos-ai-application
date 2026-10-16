# Tipografías de la web comercial Stratos

Fuentes originales verificadas el 16 de octubre de 2026. Estos archivos y los
alias CSS `Stratos Switzer` / `Stratos Inter` se destinan a la landing comercial;
no cambian la tipografía de la plataforma ni las marcas de clientes.

## Switzer

- Autor: Jérémie Hornus / Indian Type Foundry.
- Familia oficial: [Switzer en Fontshare](https://www.fontshare.com/fonts/switzer).
- Archivo utilizado: `switzer-variable.woff2`, normal, pesos 100–900; incluye
  Regular 400, Medium 500 y Semibold 600 en un único archivo de 43,220 bytes.
- Procedencia: [API oficial, variante variable](https://api.fontshare.com/v2/css?f[]=switzer@1&display=swap).
- Descarga fijada:
  `https://cdn.fontshare.com/wf/HJHZ26OECMTXRH7JXPFC7EVIHDSLT2RA/LJRNLR7WCPF3PY3SZ7B2LHNUTQMFNCHL/4MCJYGQDIOOXHWSIIB2OYNDBEALJSOGN.woff2`.
- SHA-256: `d1bf801ffb1a6096def70a7c532255722ad87d948b13a8a586e342f7091f8ee4`.
- Licencia original incluida: [Switzer-FFL.txt](Switzer-FFL.txt), ITF Free Font
  License 2.0, 17 de agosto de 2026, obtenida del paquete oficial de Fontshare.

La sección 01 permite uso comercial y autohospedaje en los sitios y aplicaciones
propios del licenciatario, con `@font-face`. La sección 02 restringe la
redistribución del binario en repositorios y servicios de fuentes para terceros.
Por ello el binario Switzer **no se versiona en este repositorio público**:
`scripts/prepare-marketing-font.mjs` lo descarga desde Fontshare antes de
`npm run dev` y `npm run build`, verifica su hash y lo escribe de forma atómica
en esta carpeta. Vite lo copia al sitio compilado para su autohospedaje. Una
copia local válida se reutiliza; una instalación nueva requiere conexión a
Fontshare y dispone de 15 segundos para la descarga.

La ruta, URL y SHA-256 se comparten desde `scripts/marketing-font-spec.mjs`.
El control de fuente productiva acepta exclusivamente ese archivo generado
cuando es un archivo regular y su contenido coincide con el hash fijado.
Rechaza enlaces simbólicos, bytes distintos y cualquier otro archivo ajeno a main.

No se modifica, renombra internamente, convierte ni recorta el archivo de
fuente. El nombre `Stratos Switzer` es únicamente un alias de `@font-face`. No
utilizar este archivo como fuente seleccionable en generadores o plantillas de
clientes ni distribuirlo en otros repositorios. Cada tercero debe obtener su
propia copia desde Fontshare según la licencia.

## Inter

- Autor: The Inter Project Authors, proyecto de Rasmus Andersson.
- Fuente oficial: [rsms.me/inter](https://rsms.me/inter/).
- Archivo utilizado: `inter-variable.woff2`, normal, pesos 100–900, versión 4.1,
  352,240 bytes. Es el archivo original completo, con Latin y Latin Extended;
  no se ha hecho subsetting ni conversión.
- Descarga: `https://rsms.me/inter/font-files/InterVariable.woff2?v=4.1`.
- SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`.
- Licencia original: [Inter-OFL.txt](Inter-OFL.txt), SIL Open Font License 1.1,
  obtenida del [repositorio oficial](https://github.com/rsms/inter/blob/master/LICENSE.txt).

La OFL permite uso comercial, inclusión y redistribución con el software
manteniendo el aviso y la licencia. Este archivo sí puede versionarse y
autohospedarse con el sitio. El alias `Stratos Inter` no modifica el binario.
