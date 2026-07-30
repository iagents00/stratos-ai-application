// El build de Vite NO avisa si usás <Componente/> sin importarlo: lo trata como
// variable global y revienta recién en el navegador. Esto lo caza antes.
import fs from "fs";
const archivos = process.argv.slice(2);
let malos = 0;
for (const f of archivos) {
  // Sin comentarios: el encabezado de Marketing.jsx menciona <TaskRow/> y <JSX/>
  // como ejemplos de lo que NO hay que hacer, y no son usos reales.
  const src = fs.readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const usados = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map(m => m[1]));
  const declarados = new Set();
  for (const m of src.matchAll(/import\s+(?:([A-Z][A-Za-z0-9_]*)\s*,?\s*)?(?:\{([^}]+)\})?\s*from/g)) {
    if (m[1]) declarados.add(m[1]);
    if (m[2]) m[2].split(",").forEach(x => declarados.add(x.trim().split(/\s+as\s+/).pop().trim()));
  }
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)/g)) declarados.add(m[1]);
  // Componentes que llegan por props y se renombran: ({ icon: Icon }) => <Icon/>
  for (const m of src.matchAll(/:\s*([A-Z][A-Za-z0-9_]*)\s*(?:=[^,}]+)?[,}]/g)) declarados.add(m[1]);
  const faltan = [...usados].filter(u => !declarados.has(u) && !["React","Fragment"].includes(u));
  if (faltan.length) { malos++; console.log(`MAL  ${f} → sin importar: ${faltan.join(", ")}`); }
  else console.log(`OK   ${f} (${usados.size} componentes, todos declarados)`);
}
console.log(malos ? `\n⚠ ${malos} archivo(s) con componentes sin importar` : "\nTodo importado ✓");
process.exit(malos ? 1 : 0);
