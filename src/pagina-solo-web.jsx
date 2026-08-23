/**
 * pagina-solo-web.jsx — Reemplazo de las páginas públicas en la app nativa
 * ─────────────────────────────────────────────────────────────────────────────
 * La app de iPhone empaqueta el bundle dentro del binario. Sin este stub, ese
 * binario cargaría también la landing de marketing, la política de privacidad
 * y los siete manuales de cliente: ~365 kB que la app NUNCA abre, porque en
 * nativo `isApp` siempre es true.
 *
 * Peor que el peso: Apple revisa lo que va dentro del paquete. Encontrar un
 * sitio de marketing completo ahí adentro refuerza justo la lectura que hay que
 * evitar — que la app es una web enlatada.
 *
 * En el build `--mode app`, vite.config.js apunta todas esas rutas acá. Si
 * alguna llegara a renderizarse sería un bug de ruteo, así que en vez de
 * devolver null mostramos algo honesto y con salida.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const WEB = "https://app.stratoscapitalgroup.com";

export default function PaginaSoloWeb() {
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#030810", color: "#E2E8F0", padding: 32, textAlign: "center",
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ maxWidth: 320 }}>
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", color: "#8A97AA" }}>
          Esta página vive en el sitio web, no en la app.
        </p>
        <a
          href={WEB}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block", padding: "12px 22px", borderRadius: 999,
            background: "#6EE7C2", color: "#041016", fontSize: 14, fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Abrir en el navegador
        </a>
      </div>
    </div>
  );
}
