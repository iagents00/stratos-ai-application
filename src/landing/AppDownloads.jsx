import { ArrowUpRight, Smartphone, Globe } from "lucide-react";
import "./AppDownloads.css";

export const appStoreUrl = "https://apps.apple.com/app/stratos-ai/id6804826565";

export default function AppDownloads({ loginUrl }) {
  return <section id="descargar" className="smk-section smk-container smk-downloads" aria-labelledby="smk-download-title">
    <div className="smk-download-panel">
      <div className="smk-download-copy">
        <img src="/branding/stratos-logo-web-20261016.webp" alt="" width="52" height="52" loading="lazy" />
        <h2 id="smk-download-title">Tu operación,<br />contigo.</h2>
        <p>Clientes, agenda y Copilot. Continúa tu trabajo desde el teléfono, con el contexto de tu equipo a la mano.</p>
        <span className="smk-download-account">Accede con la cuenta de tu organización.</span>
      </div>
      <div className="smk-download-options">
        <div className="smk-download-option">
          <div className="smk-download-label"><Smartphone size={20} aria-hidden="true" /><span>Para iPhone</span><span className="smk-download-available">Disponible</span></div>
          <a className="smk-download-link" href={appStoreUrl} target="_blank" rel="noopener noreferrer" aria-label="Descargar Stratos AI en App Store (abre en otra pestaña)"><span><small>Descárgala en</small><strong>App Store</strong></span><ArrowUpRight size={22} aria-hidden="true" /></a>
        </div>
        <div className="smk-download-option">
          <div className="smk-download-label"><Globe size={20} aria-hidden="true" /><span>Para Android</span><span className="smk-download-web">Versión web</span></div>
          <a className="smk-download-link smk-download-link-web" href={loginUrl}><span><small>Accede desde tu navegador</small><strong>Abrir Stratos AI</strong></span><ArrowUpRight size={22} aria-hidden="true" /></a>
          <p className="smk-download-note">En Android, utiliza la versión web de Stratos AI.</p>
        </div>
      </div>
    </div>
  </section>;
}
