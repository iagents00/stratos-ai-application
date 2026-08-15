import { ArrowRight, LockKeyhole } from "lucide-react";

// Espejo del pool `duke_ads_round_robin` en Supabase. Si cambia un teléfono allá,
// cambiarlo aquí también: esta landing no consulta la BD, resuelve por ?advisor=.
const ADVISOR_PHONES = {
  marco: "529848763357",
  ken: "529842181660",
  carlos: "529841794415",
};

function getWhatsAppUrl() {
  const params = new URLSearchParams(window.location.search);
  const advisor = (params.get("advisor") || params.get("asesor") || "marco").toLowerCase();
  const phone = ADVISOR_PHONES[advisor] || ADVISOR_PHONES.marco;
  const message = [
    "Hola, quiero invertir inteligentemente en Riviera Maya.",
    "Me gustaría conocer las opciones de Duke del Caribe.",
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function DukeLeadRouter() {
  const whatsAppUrl = getWhatsAppUrl();

  return (
    <main className="duke-editorial">
      <style>{`
        html, body, #root { min-height: 100%; }
        body {
          margin: 0;
          overflow-x: hidden;
          background: #fbfaf7;
        }
        @keyframes duke-editorial-cta-breathe {
          0%, 78%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 14px 34px rgba(17, 17, 17, 0.14);
          }
          88% {
            transform: translateY(-1px) scale(1.006);
            box-shadow: 0 18px 42px rgba(17, 17, 17, 0.18);
          }
        }
        @keyframes duke-editorial-arrow-drift {
          0%, 72%, 100% { transform: translateX(0); }
          84% { transform: translateX(3px); }
        }
        .duke-editorial {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-sizing: border-box;
          color: #111111;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(251, 250, 247, 0.98) 45%, #f7f3ec 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .duke-editorial-brand-panel {
          width: min(100%, 980px);
          padding: clamp(28px, 3.8vw, 50px) 24px clamp(20px, 2.5vw, 30px);
          box-sizing: border-box;
          text-align: center;
        }
        .duke-editorial-brand {
          margin: 0;
          font-family: Didot, "Bodoni 72", "Bodoni 72 Smallcaps", Georgia, serif;
          font-size: clamp(31px, 6.3vw, 58px);
          font-weight: 400;
          letter-spacing: clamp(0.14em, 0.8vw, 0.28em);
          line-height: 1.08;
        }
        .duke-editorial-hero-wrap {
          width: min(calc(100% - 40px), 800px);
          aspect-ratio: 1.58;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(17, 17, 17, 0.08);
          border-radius: clamp(18px, 3vw, 28px);
          box-shadow: 0 18px 48px rgba(70, 58, 36, 0.12);
        }
        .duke-editorial-hero {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
        }
        .duke-editorial-content {
          width: min(100%, 920px);
          padding: clamp(28px, 3.6vw, 42px) clamp(22px, 5vw, 68px) clamp(42px, 5vw, 68px);
          box-sizing: border-box;
          text-align: center;
        }
        .duke-editorial h1 {
          max-width: 640px;
          margin: 0 auto;
          font-family: Didot, "Bodoni 72", Georgia, serif;
          font-size: clamp(38px, 5vw, 68px);
          font-weight: 400;
          line-height: 1.02;
          letter-spacing: 0;
        }
        .duke-editorial h1 span {
          display: block;
          white-space: nowrap;
        }
        .duke-editorial-rule {
          width: 64px;
          height: 1px;
          margin: clamp(20px, 3vw, 28px) auto clamp(18px, 2.6vw, 26px);
          background: rgba(184, 148, 92, 0.8);
        }
        .duke-editorial-copy {
          max-width: 680px;
          margin: 0 auto;
          color: #7c8288;
          font-size: clamp(20px, 3.3vw, 30px);
          line-height: 1.32;
          letter-spacing: 0;
        }
        .duke-editorial-cta {
          width: min(100%, 580px);
          min-height: clamp(58px, 7vw, 70px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: clamp(18px, 4vw, 32px);
          margin: clamp(24px, 3.4vw, 34px) auto 0;
          padding: 0 clamp(20px, 5vw, 42px);
          border: 1px solid #111111;
          border-radius: 8px;
          box-sizing: border-box;
          background: linear-gradient(145deg, #101010 0%, #1b1b1b 100%);
          box-shadow: 0 14px 34px rgba(17, 17, 17, 0.14);
          color: #ffffff;
          font-size: clamp(19px, 3vw, 28px);
          font-weight: 650;
          line-height: 1.1;
          text-decoration: none;
          transform-origin: center;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
          animation: duke-editorial-cta-breathe 5.6s ease-in-out infinite;
        }
        .duke-editorial-cta:hover {
          background: #242424;
          transform: translateY(-1px);
          box-shadow: 0 18px 42px rgba(17, 17, 17, 0.18);
        }
        .duke-editorial-cta:active {
          transform: translateY(0) scale(0.99);
        }
        .duke-editorial-cta svg {
          width: clamp(27px, 4vw, 36px);
          height: clamp(27px, 4vw, 36px);
          flex: 0 0 auto;
          animation: duke-editorial-arrow-drift 5.6s ease-in-out infinite;
        }
        .duke-editorial-cta span {
          min-width: 0;
        }
        .duke-editorial-assurance {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 28px;
          color: #8a9094;
          font-size: clamp(17px, 3.4vw, 26px);
          line-height: 1;
        }
        .duke-editorial-assurance svg {
          width: 24px;
          height: 24px;
        }
        .duke-editorial-footer {
          width: min(100%, 860px);
          margin: clamp(54px, 7vw, 78px) auto 0;
          padding-top: 35px;
          border-top: 1px solid rgba(17, 17, 17, 0.12);
          color: #858b90;
          font-size: clamp(15px, 2.6vw, 22px);
          line-height: 1.8;
          text-align: center;
        }
        .duke-editorial-footer a {
          color: inherit;
          text-decoration: none;
        }
        .duke-editorial-footer a:hover {
          color: #111111;
        }
        @media (max-width: 560px) {
          .duke-editorial-brand-panel {
            padding-top: 28px;
            padding-bottom: 18px;
          }
          .duke-editorial-brand {
            white-space: nowrap;
            font-size: clamp(24px, 6.6vw, 30px);
            letter-spacing: 0.14em;
          }
          .duke-editorial-hero {
            object-position: 43% center;
          }
          .duke-editorial-content {
            padding-top: 36px;
            padding-right: 16px;
            padding-left: 16px;
          }
          .duke-editorial h1 {
            font-size: clamp(34px, 9.4vw, 42px);
          }
          .duke-editorial-cta {
            width: 100%;
            min-height: 60px;
            margin-top: 22px;
            justify-content: space-between;
            text-align: left;
            gap: 14px;
            padding: 0 18px;
            box-shadow: 0 16px 36px rgba(17, 17, 17, 0.22);
            font-size: 17px;
          }
          .duke-editorial-cta span {
            white-space: nowrap;
          }
        }
        @media (min-width: 561px) and (max-width: 920px) {
          .duke-editorial-brand-panel {
            padding-top: 56px;
            padding-bottom: 36px;
          }
          .duke-editorial-hero-wrap {
            width: min(calc(100% - 40px), 780px);
          }
          .duke-editorial-content {
            padding-top: 42px;
          }
          .duke-editorial h1 {
            font-size: clamp(46px, 7vw, 64px);
          }
          .duke-editorial-copy {
            font-size: clamp(23px, 4vw, 32px);
          }
          .duke-editorial-cta {
            width: min(100%, 760px);
            max-width: 760px;
            min-height: 68px;
            margin-top: 30px;
            justify-content: space-between;
            box-shadow: 0 18px 42px rgba(17, 17, 17, 0.22);
            font-size: clamp(20px, 3vw, 26px);
          }
          .duke-editorial-cta svg {
            width: 34px;
            height: 34px;
          }
        }
        @media (max-width: 360px) {
          .duke-editorial-brand {
            font-size: 22px;
            letter-spacing: 0.12em;
          }
          .duke-editorial h1 {
            font-size: 30px;
          }
          .duke-editorial-cta {
            width: 100%;
            min-height: 58px;
            gap: 10px;
            padding: 0 16px;
            font-size: 15px;
          }
          .duke-editorial-cta svg {
            width: 24px;
            height: 24px;
          }
        }
        @media (min-width: 1200px) {
          .duke-editorial-brand-panel {
            padding-top: 52px;
          }
          .duke-editorial-hero-wrap {
            width: min(calc(100% - 64px), 800px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .duke-editorial-cta,
          .duke-editorial-cta svg {
            animation: none;
            transition: none;
          }
        }
      `}</style>

      <section className="duke-editorial-brand-panel" aria-label="Duke del Caribe">
        <p className="duke-editorial-brand">DUKE DEL CARIBE</p>
      </section>

      <div className="duke-editorial-hero-wrap">
        <img
          className="duke-editorial-hero"
          src="/duke/desarrollos-97k/duke-riviera-hero.jpg"
          alt="Terraza residencial frente al mar en Riviera Maya"
          width="1728"
          height="1122"
          fetchPriority="high"
        />
      </div>

      <section className="duke-editorial-content">
        <h1>
          <span>Invertir con</span>
          <span>inteligencia</span>
        </h1>
        <div className="duke-editorial-rule" aria-hidden="true" />
        <p className="duke-editorial-copy">Oportunidades desde USD $97,000 en Cancún, Playa del Carmen y Tulum.</p>

        <a className="duke-editorial-cta" href={whatsAppUrl} rel="nofollow noopener">
          <span>Quiero conocer las opciones</span>
          <ArrowRight aria-hidden="true" strokeWidth={1.7} />
        </a>

        <div className="duke-editorial-assurance" aria-label="Sin compromiso">
          <LockKeyhole aria-hidden="true" strokeWidth={1.6} />
          <span>Sin compromiso</span>
        </div>

        <footer className="duke-editorial-footer">
          <a href="/politica-de-privacidad">Aviso de privacidad</a>
          <br />
          © 2026 Duke del Caribe · Stratos Capital Group
        </footer>
      </section>
    </main>
  );
}

export default DukeLeadRouter;
