import { useEffect, useId, useState } from "react";
import { Download, ExternalLink, FileCheck2 } from "lucide-react";
import {
  buildClinicalReadiness,
  clinicalReadinessText,
  CLINICAL_SOURCES,
  verifiedClinicalRelease,
} from "./clinical-readiness.mjs";
import "./clinical-readiness.css";

function AuditMatrix({ audit }) {
  if (!audit) return null;
  return (
    <div className="clinical-audit-matrix">
      <div
        className="clinical-audit-decision"
        role="note"
        aria-label="Resultado de la auditoría simulada"
      >
        <strong>Expedientes reales: uso no habilitado</strong>
        <p>
          {audit.scenario.name}. {audit.decision} Esta revisión es interna; no
          es una visita ni aprobación de COFEPRIS.
        </p>
      </div>
      <h3>Controles que puedes probar en la demo</h3>
      <ul className="clinical-audit-controls">
        {audit.demonstratedControls.map((item) => (
          <li key={item.id}>
            <details>
              <summary>{item.name}</summary>
              <p>{item.limit}</p>
              <span>{item.status}</span>
            </details>
          </li>
        ))}
      </ul>
      <h3>Criterios por actividad</h3>
      <p>
        Fuentes revisadas el {audit.sourceReviewDate}. La aplicabilidad
        definitiva depende de los servicios, equipos y establecimientos reales.
        No se marca una norma como cumplida o exenta desde esta pantalla.
      </p>
      <ul className="clinical-audit-standards">
        {audit.standards.map((item) => (
          <li key={item.id}>
            <details>
              <summary>
                <strong>{item.name}</strong>
                <span>{item.applicability}</span>
              </summary>
              <dl>
                <div>
                  <dt>Numerales de referencia</dt>
                  <dd>{item.clauses}</dd>
                </div>
                <div>
                  <dt>Actividad</dt>
                  <dd>{item.activity}</dd>
                </div>
                <div>
                  <dt>Evidencia necesaria</dt>
                  <dd>{item.evidence}</dd>
                </div>
                <div>
                  <dt>Resultado de la revisión</dt>
                  <dd>
                    {item.finding} {item.status}.
                  </dd>
                </div>
              </dl>
              <a href={item.url} target="_blank" rel="noreferrer">
                Consultar texto oficial{" "}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </details>
          </li>
        ))}
      </ul>
      <h3>Requisitos para una versión clínica real</h3>
      <p>
        Estos bloqueos permanecen abiertos. Para cerrar cada uno se necesita
        documento identificable, vigencia, sede y servicio, responsable y
        resultado de verificación.
      </p>
      <ul className="clinical-audit-blockers">
        {audit.realUseBlockers.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.evidence}</p>
            <span>{item.status} · Responsable por designar</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  function download(format = "text") {
    let url;
    try {
      const snapshot = buildClinicalReadiness(metadata, release);
      url = URL.createObjectURL(
        new Blob(
          [
            format === "json"
              ? JSON.stringify(snapshot, null, 2)
              : clinicalReadinessText(snapshot),
          ],
          {
            type:
              format === "json"
                ? "application/json;charset=utf-8"
                : "text/plain;charset=utf-8",
          },
        ),
      );
      const link = document.createElement("a");
      link.href = url;
      const date = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(snapshot.generatedAt));
      link.download = `stratos-clinica-auditoria-${date}.${format === "json" ? "json" : "txt"}`;
      document.body.append(link);
      link.click();
      link.remove();
      setExportStatus(
        "Informe descargado sin pacientes, notas ni credenciales. Los requisitos de una operación real permanecen pendientes.",
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
      <AuditMatrix audit={report.audit} />
      <details className="clinical-documents-group">
        <summary>
          {simulation
            ? "Índice de documentos antes de una versión real"
            : "Documentos que debes reunir"}{" "}
          ({report.pendingDocuments.length})
        </summary>
        <ul className="clinical-documents">
          {report.pendingDocuments.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <span>Pendiente de verificar</span>
            </li>
          ))}
        </ul>
      </details>
      <p>
        {simulation ? "Para una futura integración real, solicita" : "Solicita"}{" "}
        a Huli el certificado DGIS vigente y la versión exacta habilitada en tu
        cuenta, incluida la confirmación del alcance de la API. La certificación
        del proveedor no se extiende automáticamente a Stratos.
      </p>
      <div className="clinical-audit-downloads">
        <button
          type="button"
          className="huli-secondary"
          onClick={() => download("text")}
        >
          <Download size={16} aria-hidden="true" />
          Descargar informe de preparación
        </button>
        <button
          type="button"
          className="huli-secondary"
          onClick={() => download("json")}
        >
          <Download size={16} aria-hidden="true" />
          Descargar matriz JSON
        </button>
      </div>
      <p className="clinical-export-status" role="status">
        {exportStatus}
      </p>
      <details className="clinical-sources">
        <summary>Consultar normas y guías oficiales</summary>
        <ul>
          {CLINICAL_SOURCES.filter(
            (source) => source.authority !== "provider",
          ).map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </details>
      <details className="clinical-sources">
        <summary>Guías del proveedor Huli</summary>
        <p>
          Información del proveedor; no sustituye el cotejo del certificado, la
          cuenta ni la configuración de la integración.
        </p>
        <ul>
          {CLINICAL_SOURCES.filter(
            (source) => source.authority === "provider",
          ).map((source) => (
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
