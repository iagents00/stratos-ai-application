const RELEASE_PROJECT = "stratos-ai-application";
const RELEASE_PROJECT_ID = "prj_Epv30SFnQmJGnxy3LdYLKV8NwDLi";
const REPOSITORY = "iagents00/stratos-ai-application";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export const CLINICAL_SOURCES = Object.freeze([
  {
    label: "NOM-004 · Expediente clínico",
    url: "https://dof.gob.mx/normasOficiales/4909/SALUD/SALUD.html",
  },
  {
    label: "NOM-013 · Atención odontológica",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5462039",
  },
  {
    label: "NOM-024 · Sistemas de información en salud",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5280847",
  },
  {
    label: "COFEPRIS · Guía de autoverificación de consultorios",
    url: "https://www.gob.mx/cofepris/documentos/guia-autoverificacion-establecimientos-de-atencion-medica-ambulatoria-o-consultorios-medicos-generales-y-de-especialidad",
  },
  {
    label: "DGIS · Certificado publicado de HuliPractice",
    url: "http://www.dgis.salud.gob.mx/intercambio/certificados/02_HULILABS_Certificado_20260918_v29.pdf?v=2026.09.21",
  },
  {
    label: "Huli · Activación y uso de la certificación",
    url: "https://help.hulipractice.com/es/collections/10394899-certificaciones",
  },
]);

export const CLINICAL_DOCUMENTS = Object.freeze([
  {
    id: "establishment",
    title: "Identidad y autorizaciones de la clínica",
    detail:
      "Nombre, domicilio, servicios, profesionales y cédulas; aviso de funcionamiento, responsable sanitario y licencia cuando corresponda al servicio.",
  },
  {
    id: "certificate",
    title: "Certificado y configuración de Huli",
    detail:
      "Certificado DGIS vigente, versión exacta de tu cuenta, activación NOM-024 y confirmación escrita del alcance de la API e integración.",
  },
  {
    id: "records",
    title: "Expedientes y consentimientos",
    detail:
      "Comprobar en Huli contenido, autoría, fecha, hora, firma, cierre y conservación del expediente. Para odontología, revisar también la NOM-013.",
  },
  {
    id: "privacy",
    title: "Privacidad y contratos",
    detail:
      "Aviso de privacidad de la clínica, finalidades, base jurídica del tratamiento, derechos ARCO y contratos con Huli, Stratos y sus proveedores.",
  },
  {
    id: "access",
    title: "Accesos individuales y bajas",
    detail:
      "Este piloto autoriza una cuenta administradora. Documentar permisos y revocación; antes de sumar personal, habilitar y probar cuentas individuales.",
  },
  {
    id: "continuity",
    title: "Bitácoras y recuperación",
    detail:
      "Acreditar retención y acceso a registros, copias de seguridad, restauración probada, incidentes y continuidad. Los logs del servidor no son una bitácora clínica firmada.",
  },
]);

export function verifiedClinicalRelease(release) {
  if (
    release?.project !== RELEASE_PROJECT ||
    release.projectId !== RELEASE_PROJECT_ID ||
    release.repository !== REPOSITORY ||
    !/^[a-f0-9]{40}$/i.test(release.commit || "") ||
    release.dirty !== false ||
    !Number.isFinite(Date.parse(release.builtAt))
  )
    return null;
  return {
    project: RELEASE_PROJECT,
    repository: REPOSITORY,
    commit: release.commit,
    builtAt: release.builtAt,
  };
}

export function buildClinicalReadiness(metadata, release, now = new Date()) {
  const simulation = metadata?.mode === "demo";
  const verification = metadata?.verification;
  const connectionVerified =
    metadata?.authenticated === true &&
    metadata?.mode === "read-only" &&
    verification?.status === 200 &&
    UUID.test(verification?.requestId || "") &&
    Number.isFinite(Date.parse(verification?.checkedAt));
  const safeRelease = verifiedClinicalRelease(release);
  // Explicit allowlist. Never export patients, prompts, sessions, raw metadata,
  // API keys, contact information, or clinical documents in this preparation file.
  return {
    schemaVersion: 1,
    simulation,
    generatedAt: now.toISOString(),
    title: simulation
      ? "Ficha de preparación de la demo clínica Stratos AI"
      : "Ficha de integración Stratos AI / Huli",
    regulatoryStatus:
      "Evidencia documental pendiente de verificar con la clínica y Huli",
    notice: `${simulation ? "Demostración con datos ficticios y permisos simulados en el navegador. No consulta Huli ni protege expedientes reales. " : ""}Preparación técnica; no es un certificado, dictamen sanitario ni expediente clínico. La certificación de Huli no acredita automáticamente esta integración.`,
    scope: simulation
      ? [
          "Tres escenarios ficticios: consulta, odontología y multiespecialidad",
          "Enlaces a expedientes con acceso y roles simulados",
          "Consulta y revisión de borradores ficticios con Copilot, sin envío a modelos de IA externos",
        ]
      : [
          "Consulta de nombres de pacientes",
          "Consulta de citas y disponibilidad",
          "Copilot administrativo con comandos definidos, sin envío a modelos de IA externos",
        ],
    clinicalRecord: simulation
      ? "En esta demo sólo se consultan expedientes sintéticos y se preparan borradores sin firma. Antes de una versión real, validar dónde y cómo el profesional registra, firma y cierra la atención."
      : "Registrar, firmar y cerrar la atención en Huli con la configuración validada por la clínica.",
    technicalChecks: {
      authenticatedHuliConnection: connectionVerified,
      ...(connectionVerified
        ? {
            checkedAt: verification.checkedAt,
            requestId: verification.requestId,
          }
        : {}),
      identifiedRelease: !!safeRelease,
    },
    release: safeRelease,
    pendingDocuments: CLINICAL_DOCUMENTS.map((item) => ({
      ...item,
      ...(simulation && item.id === "access"
        ? {
            detail:
              "Antes de una versión real, implementar cuentas individuales, autorización en servidor por clínica y expediente, revisión de roles, caducidad y revocación de sesiones.",
          }
        : {}),
      status: simulation
        ? "Antes de una versión real: pendiente de evidencia"
        : "Pendiente de evidencia documental",
      responsible: "Por designar",
      verifiedAt: null,
    })),
    sources: CLINICAL_SOURCES.map((item) => ({ ...item })),
  };
}

export function clinicalReadinessText(report) {
  return [
    report.title,
    `Generado: ${report.generatedAt}`,
    "",
    report.notice,
    "",
    "ALCANCE",
    ...report.scope.map((item) => `- ${item}`),
    report.clinicalRecord,
    "",
    "VERIFICACIÓN TÉCNICA",
    `Conexión autenticada Huli: ${report.technicalChecks.authenticatedHuliConnection ? "Verificada en esta sesión" : "Sin evidencia verificable en esta ficha"}`,
    ...(report.technicalChecks.requestId
      ? [
          `Consulta: ${report.technicalChecks.checkedAt}`,
          `Referencia: ${report.technicalChecks.requestId}`,
        ]
      : []),
    `Versión Stratos: ${report.release?.commit || "Pendiente de identificar"}`,
    "",
    "DOCUMENTOS PENDIENTES",
    ...report.pendingDocuments.flatMap((item) => [
      `- ${item.title}: ${item.status}. Responsable: ${item.responsible}.`,
      `  ${item.detail}`,
    ]),
    "",
    "FUENTES",
    ...report.sources.map((item) => `${item.label}: ${item.url}`),
    "",
    "Esta ficha se genera en el navegador. Conservar junto con los documentos originales, su vigencia, responsables y las pruebas fechadas de la clínica. No incluye información de pacientes.",
  ].join("\n");
}
