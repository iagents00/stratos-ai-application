import { useState, useEffect } from "react";
import { ArrowLeft, Globe, Mail, Trash2, MessageSquare, Clock, ShieldCheck } from "lucide-react";

/* ═══════════════════════════════════
   DESIGN TOKENS — alineados con LandingMarketing
   ═══════════════════════════════════ */
const P = {
  bg: "#04080F",
  surface: "#080D17",
  glass: "rgba(255,255,255,0.028)",
  border: "rgba(255,255,255,0.06)",
  accent: "#52D9B8",
  accentS: "rgba(82,217,184,0.07)",
  accentB: "rgba(82,217,184,0.13)",
  w: "#FFFFFF",
  txt: "#EDF2F7",
  txt2: "#8A97AA",
  txt3: "#3D4A5C",
  r: 14,
};
const font  = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`;
const fontD = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`;

const CSS = `
  .dd-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; }
  .dd-wrap *, .dd-wrap *::before, .dd-wrap *::after { box-sizing: border-box; }
  .dd-wrap a { color: ${P.accent}; text-decoration: none; }
  .dd-wrap a:hover { text-decoration: underline; }
  .dd-wrap h1, .dd-wrap h2, .dd-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.02em; }
  .dd-wrap p, .dd-wrap li { line-height: 1.7; color: ${P.txt}; font-size: 15px; }
  .dd-wrap li { margin-bottom: 6px; }
  .dd-wrap ul, .dd-wrap ol { padding-left: 22px; margin: 8px 0 16px; }
  .dd-wrap section { scroll-margin-top: 96px; }
  .dd-wrap section + section { margin-top: 32px; }
  .dd-card { background: ${P.glass}; border: 1px solid ${P.border}; border-radius: ${P.r}px; padding: 20px 24px; }
  .dd-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: ${P.accentS}; border: 1px solid ${P.accentB}; color: ${P.accent}; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
  .dd-icon-row { display: flex; gap: 14px; align-items: flex-start; }
  .dd-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; background: ${P.accentS}; border: 1px solid ${P.accentB}; display: flex; align-items: center; justify-content: center; color: ${P.accent}; }
  @media (max-width: 720px) {
    .dd-wrap p, .dd-wrap li { font-size: 14.5px; }
  }
`;

const ES = {
  meta: {
    title: "Instrucciones para eliminar tus datos — Stratos Capital Group",
    description:
      "Cómo solicitar la eliminación de tus datos personales recopilados por Stratos Capital Group a través de WhatsApp Business, Meta Lead Ads y nuestro sitio web.",
  },
  ui: {
    back: "Volver al inicio",
    pill: "Eliminación de datos",
    title: "Cómo eliminar tus datos",
    subtitle:
      "Tienes derecho a solicitar la eliminación de tus datos personales en cualquier momento. Este es el procedimiento — claro, gratuito y sin trámites complicados.",
    updated: "Última actualización: 30 de abril de 2026",
  },
  body: () => (
    <>
      <section>
        <h2>1. Qué datos puedes pedir eliminar</h2>
        <p>
          Si has interactuado con Stratos Capital Group por WhatsApp, has llenado un formulario de Meta Lead Ads, o
          nos has escrito por correo, podemos tener guardados los siguientes datos sobre ti:
        </p>
        <ul>
          <li>Tu número de teléfono y nombre de perfil de WhatsApp.</li>
          <li>El historial de tus conversaciones con nuestros asesores.</li>
          <li>Tu correo electrónico y respuestas a formularios de anuncios.</li>
          <li>Notas internas sobre tu interés en propiedades, etapa del seguimiento y citas agendadas.</li>
        </ul>
        <p>
          Puedes pedir que se eliminen <strong>todos</strong> tus datos o solo una parte específica
          (por ejemplo: "borra mi historial de conversaciones pero conserva mi contacto").
        </p>
      </section>

      <section>
        <h2>2. Tres formas de solicitar la eliminación</h2>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><Mail size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Por correo electrónico (recomendado)</h3>
              <p style={{ marginBottom: 8 }}>Escribe a cualquiera de estos correos:</p>
              <ul style={{ marginTop: 0 }}>
                <li><a href="mailto:info@stratoscapitalgroup.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20personales">info@stratoscapitalgroup.com</a> (principal)</li>
                <li><a href="mailto:duke_realtor@icloud.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20personales">duke_realtor@icloud.com</a></li>
              </ul>
              <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
                <strong>Asunto sugerido:</strong> "Solicitud de eliminación de datos personales"
              </p>
            </div>
          </div>
        </div>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><MessageSquare size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Por WhatsApp (instantáneo)</h3>
              <p>
                En cualquiera de nuestros números de WhatsApp Business, escribe una de estas palabras y se
                detendrán los mensajes inmediatamente:
              </p>
              <ul style={{ marginTop: 6 }}>
                <li><strong>BAJA</strong></li>
                <li><strong>STOP</strong></li>
                <li><strong>CANCELAR</strong></li>
              </ul>
              <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
                Para eliminación completa de tu historial, complementa con un correo a alguno de los buzones
                indicados arriba.
              </p>
            </div>
          </div>
        </div>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><Trash2 size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Bloqueo directo</h3>
              <p>
                También puedes bloquear nuestro número de WhatsApp directamente desde tu aplicación. Eso impide
                cualquier contacto futuro de inmediato, aunque no elimina los registros que ya tenemos. Para la
                eliminación completa, usa cualquiera de las opciones anteriores.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>3. Qué información incluir en tu solicitud</h2>
        <p>Para poder identificar tus datos y procesar la solicitud, indícanos:</p>
        <ol>
          <li>Tu nombre completo.</li>
          <li>El número de WhatsApp o correo con el que has interactuado con nosotros.</li>
          <li>Si quieres eliminar todos tus datos o solo una parte específica.</li>
          <li>Una copia de tu identificación oficial (para verificar tu identidad — esto evita que un tercero pida borrar tus datos sin tu permiso).</li>
        </ol>
      </section>

      <section>
        <h2>4. Qué pasa después</h2>
        <div className="dd-card">
          <div className="dd-icon-row">
            <div className="dd-icon"><Clock size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Plazo de respuesta</h3>
              <ul style={{ marginTop: 4 }}>
                <li><strong>20 días hábiles</strong> bajo la LFPDPPP (México).</li>
                <li><strong>30 días</strong> bajo el GDPR (Unión Europea).</li>
                <li>Confirmaremos por correo cuando el proceso termine.</li>
              </ul>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 14 }}>
          La eliminación cubre los datos almacenados en nuestros sistemas (CRM, copias de respaldo y notas internas).
          Los mensajes que ya circularon por la infraestructura de Meta para WhatsApp Business Cloud API se eliminan
          automáticamente de los servidores de Meta a los <strong>30 días</strong>, conforme a su política oficial.
        </p>

        <p>
          Hay un caso en el que <strong>no</strong> podemos eliminar ciertos datos: los que estamos obligados a
          conservar por ley, como comprobantes fiscales (5 años en México). Si esto aplica a tu caso, te lo
          explicaremos por correo.
        </p>
      </section>

      <section>
        <h2>5. Costo</h2>
        <div className="dd-card">
          <div className="dd-icon-row">
            <div className="dd-icon"><ShieldCheck size={18} /></div>
            <div>
              <p style={{ margin: 0 }}>
                <strong>Sin costo.</strong> Solicitar la eliminación de tus datos es completamente gratuito y no
                afecta de ninguna forma cualquier servicio o relación que mantengas con Stratos.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>6. Más detalles</h2>
        <p>
          Esta página es la versión resumida y operativa. Para el marco completo de cómo tratamos tus datos,
          consulta nuestra <a href="/politica-de-privacidad">Política de Privacidad</a>, en particular la sección
          12 (Derechos del titular) y la sección 13 (Cómo ejercer tus derechos).
        </p>
      </section>
    </>
  ),
};

const EN = {
  meta: {
    title: "Data Deletion Instructions — Stratos Capital Group",
    description:
      "How to request deletion of your personal data collected by Stratos Capital Group through WhatsApp Business, Meta Lead Ads and our website.",
  },
  ui: {
    back: "Back to home",
    pill: "Data deletion",
    title: "How to delete your data",
    subtitle:
      "You have the right to request deletion of your personal data at any time. This is the procedure — clear, free of charge, and with no complicated paperwork.",
    updated: "Last updated: April 30, 2026",
  },
  body: () => (
    <>
      <section>
        <h2>1. What data you can request deleted</h2>
        <p>
          If you have interacted with Stratos Capital Group through WhatsApp, filled out a Meta Lead Ads form, or
          contacted us by email, we may have the following data about you:
        </p>
        <ul>
          <li>Your phone number and WhatsApp profile name.</li>
          <li>The history of your conversations with our advisors.</li>
          <li>Your email address and answers to ad forms.</li>
          <li>Internal notes about your property interests, follow-up stage and scheduled appointments.</li>
        </ul>
        <p>
          You can request deletion of <strong>all</strong> your data or only a specific part
          (for example: "delete my conversation history but keep my contact").
        </p>
      </section>

      <section>
        <h2>2. Three ways to request deletion</h2>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><Mail size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>By email (recommended)</h3>
              <p style={{ marginBottom: 8 }}>Write to either of these addresses:</p>
              <ul style={{ marginTop: 0 }}>
                <li><a href="mailto:info@stratoscapitalgroup.com?subject=Personal%20data%20deletion%20request">info@stratoscapitalgroup.com</a> (primary)</li>
                <li><a href="mailto:duke_realtor@icloud.com?subject=Personal%20data%20deletion%20request">duke_realtor@icloud.com</a></li>
              </ul>
              <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
                <strong>Suggested subject:</strong> "Personal data deletion request"
              </p>
            </div>
          </div>
        </div>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><MessageSquare size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>By WhatsApp (instant)</h3>
              <p>
                On any of our WhatsApp Business numbers, send one of these words and messaging will stop
                immediately:
              </p>
              <ul style={{ marginTop: 6 }}>
                <li><strong>UNSUBSCRIBE</strong></li>
                <li><strong>STOP</strong></li>
                <li><strong>CANCEL</strong></li>
              </ul>
              <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
                For full deletion of your history, follow up with an email to one of the addresses above.
              </p>
            </div>
          </div>
        </div>

        <div className="dd-card" style={{ marginTop: 12 }}>
          <div className="dd-icon-row">
            <div className="dd-icon"><Trash2 size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Direct block</h3>
              <p>
                You can also block our WhatsApp number directly from your app. That prevents any future contact
                immediately, although it does not delete the records we already have. For full deletion, use
                either of the options above.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>3. What to include in your request</h2>
        <p>To identify your data and process the request, please tell us:</p>
        <ol>
          <li>Your full name.</li>
          <li>The WhatsApp number or email you have used to contact us.</li>
          <li>Whether you want to delete all your data or only a specific part.</li>
          <li>A copy of your government-issued ID (to verify your identity — this prevents a third party from requesting deletion of your data without your permission).</li>
        </ol>
      </section>

      <section>
        <h2>4. What happens next</h2>
        <div className="dd-card">
          <div className="dd-icon-row">
            <div className="dd-icon"><Clock size={18} /></div>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Response time</h3>
              <ul style={{ marginTop: 4 }}>
                <li><strong>20 business days</strong> under LFPDPPP (Mexico).</li>
                <li><strong>30 days</strong> under GDPR (European Union).</li>
                <li>We will confirm by email when the process is complete.</li>
              </ul>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 14 }}>
          Deletion covers data stored in our systems (CRM, backups and internal notes). Messages that have already
          been transmitted through Meta's WhatsApp Business Cloud API infrastructure are automatically deleted
          from Meta's servers after <strong>30 days</strong>, in accordance with its official policy.
        </p>

        <p>
          There is one case in which we <strong>cannot</strong> delete certain data: information we are required
          by law to retain, such as fiscal records (5 years in Mexico). If this applies to your case, we will
          explain it to you by email.
        </p>
      </section>

      <section>
        <h2>5. Cost</h2>
        <div className="dd-card">
          <div className="dd-icon-row">
            <div className="dd-icon"><ShieldCheck size={18} /></div>
            <div>
              <p style={{ margin: 0 }}>
                <strong>Free of charge.</strong> Requesting the deletion of your data is completely free and does
                not affect in any way any service or relationship you may have with Stratos.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>6. More details</h2>
        <p>
          This page is the operational summary. For the complete framework on how we handle your data, see our
          <a href="/privacy-policy"> Privacy Policy</a>, particularly Section 12 (Rights of the data subject)
          and Section 13 (How to exercise your rights).
        </p>
      </section>
    </>
  ),
};

export default function DataDeletion() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/eliminar-mis-datos";
  const initialLang = path.startsWith("/data-deletion") ? "en" : "es";
  const [lang, setLang] = useState(initialLang);

  const content = lang === "en" ? EN : ES;

  useEffect(() => {
    document.title = content.meta.title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", content.meta.description);
    document.documentElement.lang = lang;
  }, [lang, content.meta.title, content.meta.description]);

  const handleLangSwitch = (newLang) => {
    setLang(newLang);
    const newPath = newLang === "en" ? "/data-deletion" : "/eliminar-mis-datos";
    if (window.history && window.location.pathname !== newPath) {
      window.history.replaceState(null, "", newPath);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const Body = content.body;

  return (
    <div className="dd-wrap">
      <style>{CSS}</style>

      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(4,8,15,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: P.txt,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            {content.ui.back}
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={14} color={P.txt2} />
            <button
              onClick={() => handleLangSwitch("es")}
              style={{
                background: lang === "es" ? P.accentS : "transparent",
                border: `1px solid ${lang === "es" ? P.accentB : P.border}`,
                color: lang === "es" ? P.accent : P.txt2,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: font,
              }}
            >
              Español
            </button>
            <button
              onClick={() => handleLangSwitch("en")}
              style={{
                background: lang === "en" ? P.accentS : "transparent",
                border: `1px solid ${lang === "en" ? P.accentB : P.border}`,
                color: lang === "en" ? P.accent : P.txt2,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: font,
              }}
            >
              English
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ borderBottom: `1px solid ${P.border}`, background: P.surface }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 48px" }}>
          <span className="dd-pill">
            <Trash2 size={12} />
            {content.ui.pill}
          </span>
          <h1
            style={{
              fontSize: "clamp(30px, 4.5vw, 46px)",
              fontWeight: 700,
              marginTop: 16,
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            {content.ui.title}
          </h1>
          <p
            style={{
              fontSize: 17,
              color: P.txt2,
              maxWidth: 720,
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            {content.ui.subtitle}
          </p>
          <p style={{ fontSize: 13, color: P.txt3 }}>{content.ui.updated}</p>
        </div>
      </div>

      {/* Body */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 96px" }}>
        <Body />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: `1px solid ${P.border}`,
          background: P.surface,
          padding: "32px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            color: P.txt2,
            fontSize: 13,
          }}
        >
          <div>
            © {new Date().getFullYear()} Stratos Capital Group · {content.ui.updated}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <a
              href="mailto:info@stratoscapitalgroup.com"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Mail size={14} />
              info@stratoscapitalgroup.com
            </a>
            <a
              href={lang === "en" ? "/privacy-policy" : "/politica-de-privacidad"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {lang === "en" ? "Privacy Policy" : "Política de Privacidad"}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
