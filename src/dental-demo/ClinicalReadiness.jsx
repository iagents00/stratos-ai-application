import { useEffect, useId, useState } from "react";
import { Download, ExternalLink, FileCheck2 } from "lucide-react";
import {
  buildClinicalReadiness,
  clinicalReadinessText,
  CLINICAL_SOURCES,
  verifiedClinicalRelease,
} from "./clinical-readiness.mjs";
import "./clinical-readiness.css";

export default function ClinicalReadiness({ metadata }) {
  const simulation = metadata?.mode === "demo";
  const headingId = useId();
  const [release, setRelease] = useState(null);
  const [exportStatus, setExportStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/release.json", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!controller.signal.aborted)
          setRelease(verifiedClinicalRelease(data) ? data : null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const report = buildClinicalReadiness(metadata, release);
  function download() {
    let url;
    try {
      const snapshot = buildClinicalReadiness(metadata, release);
      url = URL.createObjectURL(
        new Blob([clinicalReadinessText(snapshot)], {
          type: "text/plain;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `stratos-huli-preparacion-${snapshot.generatedAt.slice(0, 10)}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      setExportStatus(
        "Ficha descargada. Reúne los documentos pendientes junto con esta ficha.",
      );
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (url) URL.revokeObjectURL(url);
      setExportStatus(
        "No pudimos descargar la ficha. Reintenta desde el navegador.",
      );
    }
  }
  return (
    <section
      className="clinical-readiness huli-panel"
      aria-labelledby={headingId}
    >
      <div className="clinical-readiness-heading">
        <h2 id={headingId}>
          <FileCheck2 size={20} aria-hidden="true" />
          Preparación para revisión sanitaria
        </h2>
        <span>Evidencia documental pendiente</span>
      </div>
      <p>
        {simulation
          ? "Esta demo muestra acceso por rol, enlaces y borradores con datos ficticios. Las credenciales son públicas y los permisos se simulan en el navegador. Para expedientes reales se requiere autenticar y autorizar cada acceso en el servidor, además de validar la configuración clínica y documental."
          : "Desde Stratos consultas pacientes, citas y horarios. El expediente, los consentimientos y el cierre de la atención se gestionan en Huli con la configuración validada por la clínica. Una conexión activa no acredita por sí sola cumplimiento sanitario."}
      </p>
      <dl className="clinical-verification">
        <div>
          <dt>Conexión Huli</dt>
          <dd>
            {simulation
              ? "No utilizada en la demo"
              : report.technicalChecks.authenticatedHuliConnection
                ? "Verificada en esta sesión"
                : "Sin referencia verificable"}
          </dd>
        </div>
        <div>
          <dt>Versión de Stratos</dt>
          <dd>
            {report.release
              ? report.release.commit.slice(0, 12)
              : "Pendiente de identificar"}
          </dd>
        </div>
        <div>
          <dt>Certificación de tu cuenta Huli</dt>
          <dd>Pendiente de documento, versión y alcance de la integración</dd>
        </div>
      </dl>
      <h3>
        {simulation
          ? "Antes de una versión real"
          : "Documentos que debes reunir"}
      </h3>
      <ul className="clinical-documents">
        {report.pendingDocuments.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            <span>Pendiente de verificar</span>
          </li>
        ))}
      </ul>
      <p>
        {simulation ? "Para una futura integración real, solicita" : "Solicita"}{" "}
        a Huli el certificado DGIS vigente y la versión exacta habilitada en tu
        cuenta, incluida la confirmación del alcance de la API. La certificación
        del proveedor no se extiende automáticamente a Stratos.
      </p>
      <button type="button" className="huli-secondary" onClick={download}>
        <Download size={16} aria-hidden="true" />
        Descargar ficha de integración
      </button>
      <p className="clinical-export-status" role="status">
        {exportStatus}
      </p>
      <details className="clinical-sources">
        <summary>Consultar normas y guías oficiales</summary>
        <ul>
          {CLINICAL_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </details>
      <p className="clinical-readiness-note">
        La ficha contiene alcance, referencia técnica y pendientes, sin datos de
        pacientes. No sustituye el certificado, la documentación de la clínica
        ni una revisión del responsable sanitario.
      </p>
    </section>
  );
}
