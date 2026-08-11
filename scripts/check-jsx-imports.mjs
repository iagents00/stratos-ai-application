// El build de Vite NO avisa si usás <Componente/> o un hook useX() sin
// importarlo: lo trata como variable global y revienta recién en el navegador
// («useClient is not defined» tumbó la app entera el 11-ago — PR #607/#608).
// Esto lo caza antes. Sin argumentos, barre TODO src/ (antes, sin args no
// revisaba nada y cantaba «Todo importado ✓» igual).
import fs from "fs";
import path from "path";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const archivos = process.argv.slice(2).length ? process.argv.slice(2) : walk("src");

// Hooks de React que existen sin import explícito solo si se importa React.* —
// acá los tratamos como builtins porque el patrón del repo es importarlos bien
// y el objetivo es cazar hooks PROPIOS (useClient, useAuth…) sin su import.
const REACT_HOOKS = new Set([
  "useState","useEffect","useMemo","useCallback","useRef","useLayoutEffect",
  "useContext","useReducer","useId","useTransition","useDeferredValue",
  "useSyncExternalStore","useImperativeHandle","useInsertionEffect","useDebugValue",
]);

let malos = 0;
for (const f of archivos) {
  // Sin comentarios ni strings: el encabezado de Marketing.jsx menciona <TaskRow/>
  // como ejemplo, y hay textos que dicen "useClient()" en prosa.
  const src = fs.readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

  const declarados = new Set();
  for (const m of src.matchAll(/import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]+)\})?\s*from/g)) {
    if (m[1]) declarados.add(m[1]);
    if (m[2]) m[2].split(",").forEach(x => declarados.add(x.trim().split(/\s+as\s+/).pop().trim()));
  }
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) declarados.add(m[1]);
  // Nombres que llegan por props/destructuring y se renombran: ({ icon: Icon }) => <Icon/>
  for (const m of src.matchAll(/:\s*([A-Za-z_$][\w$]*)\s*(?:=[^,}]+)?[,}]/g)) declarados.add(m[1]);
  // Parámetros de función simples: (Comp) => <Comp/>
  for (const m of src.matchAll(/\(([^)]*)\)\s*(?:=>|\{)/g)) {
    m[1].split(",").forEach(x => {
      const n = x.trim().split(/[=:]/)[0].trim().replace(/[{}\[\]\.]/g, "");
      if (n) declarados.add(n);
    });
  }

  // Tags de componentes solo en .jsx — en .js un <Tag> es XML dentro de un
  // template (docx.js) y daba falsos positivos.
  const faltanComp = !f.endsWith(".jsx") ? [] :
    [...new Set([...src.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map(m => m[1]))]
    .filter(u => !declarados.has(u) && !["React","Fragment"].includes(u));
  const faltanHooks = [...new Set([...src.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g)].map(m => m[1]))]
    .filter(h => !declarados.has(h) && !REACT_HOOKS.has(h));

  const faltan = [...faltanComp, ...faltanHooks];
  if (faltan.length) { malos++; console.log(`MAL  ${f} → sin importar: ${faltan.join(", ")}`); }
}
console.log(malos ? `\n⚠ ${malos} archivo(s) con componentes u hooks sin importar` : `\nTodo importado ✓ (${archivos.length} archivos)`);
process.exit(malos ? 1 : 0);
