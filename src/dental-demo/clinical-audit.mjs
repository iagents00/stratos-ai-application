// Internal preparation matrix for a synthetic prototype. This is not a
// regulatory determination, an inspection of a clinic, or a SIRES certificate.
const SCENARIOS = Object.freeze({
  "demo-clinic-simple": {
    id: "demo-clinic-simple",
    name: "Consulta general · Demo",
    services: "Consulta no especializada ficticia",
  },
  "demo-clinic-dental": {
    id: "demo-clinic-dental",
    name: "Odontología · Demo",
    services: "Consulta odontológica ficticia",
  },
  "demo-clinic-complex": {
    id: "demo-clinic-complex",
    name: "Multiespecialidad · Demo",
    services:
      "Colaboración ficticia de profesionales; no representa un hospital",
  },
});

const STANDARDS = [
  {
    id: "nom004",
    name: "NOM-004-SSA3-2012",
    clauses: "5.1–5.14 y 6",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5272787",
    activity: "Integración y uso de expediente clínico en atención real.",
    evidence:
      "Expediente único por paciente dentro del establecimiento; historia y notas pertinentes, identificación, autor, fecha, hora y firma. Integridad, confidencialidad y conservación mínima de cinco años desde el último acto médico.",
    finding:
      "La demo sólo contiene resúmenes sintéticos y borradores sin firma. No representa un expediente completo ni acredita su conservación.",
  },
  {
    id: "nom013",
    name: "NOM-013-SSA2-2015",
    clauses: "Capítulos 8 y 9",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5462039",
    activity: "Atención odontológica.",
    evidence:
      "Historia, odontograma y periodontograma iniciales y de seguimiento, evolución, estudios, plan, autoría, firmas y consentimientos pertinentes; prevención de riesgos y prácticas verificadas.",
    finding:
      "El escenario dental es parcial. No incluye un odontograma validado, consentimiento clínico ni verificación de esterilización.",
  },
  {
    id: "nom024",
    name: "NOM-024-SSA3-2012",
    clauses: "1–2, 6.6 y 7.4–7.5",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5280847",
    activity:
      "SIRES e intercambio de información dentro de su campo de aplicación; evaluar la integración concreta.",
    evidence:
      "Aplicabilidad documentada, certificado y dictamen, GIIS, versión y configuración cubiertas; seguridad, autenticación, autorización, integridad y trazabilidad.",
    finding:
      "El login de esta demo es local y público. El certificado del proveedor no certifica automáticamente Stratos ni esta integración.",
  },
  {
    id: "nom005",
    name: "NOM-005-SSA3-2018",
    clauses: "2, 5, 6.1, 6.4 y apéndices A/B",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5596456",
    activity:
      "Consultorios de atención no especializada; incluye disposiciones de estomatología.",
    evidence:
      "Avisos aplicables, infraestructura, equipamiento, higiene y operaciones por sede. En odontología, revisar también las áreas y el equipamiento específicos.",
    finding:
      "No se inspeccionaron instalaciones, equipos ni documentos de un consultorio. Una pantalla no acredita condiciones físicas.",
  },
  {
    id: "nom016",
    name: "NOM-016-SSA3-2012",
    clauses: "2, 7 y 8",
    url: "https://sidof.segob.gob.mx/notas/docFuente/5284306",
    activity:
      "Consultorios de especialidad y hospitales, según los servicios efectivos.",
    evidence:
      "Tipo de establecimiento, áreas y equipo de cada especialidad, avisos o licencias y responsable sanitario que correspondan.",
    finding:
      "Multiespecialidad es una colaboración ficticia. No se evaluaron requisitos hospitalarios ni de una especialidad real.",
  },
  {
    id: "nom087",
    name: "NOM-087-SEMARNAT-SSA1-2002",
    clauses: "2, 4–6",
    url: "https://sidof.segob.gob.mx/notas/docFuente/704675",
    activity:
      "Generación o manejo de residuos peligrosos biológico-infecciosos.",
    evidence:
      "Clasificación de residuos y generador, separación, recipientes, almacenamiento, recolección, tratamiento, contingencias y soportes del manejo efectivo según categoría.",
    finding:
      "La demo no genera residuos ni verifica prestadores. No toda basura de un consultorio se clasifica como RPBI.",
  },
  {
    id: "nom229",
    name: "NOM-229-SSA1-2002",
    clauses: "1.2, 5–8 y 17–19; modificaciones 2011 y 2014",
    url: "https://sidof.segob.gob.mx/notas/docFuente/4931612",
    activity:
      "Diagnóstico con rayos X; incluye panorámica dental. El 1.2 excluye aplicaciones odontológicas convencionales y densitometría de esta NOM, sin eliminar otras obligaciones.",
    evidence:
      "Clasificación de modalidad y equipo, autorizaciones aplicables, instalaciones, responsables, calidad, mantenimiento y protección radiológica.",
    finding:
      "No hay equipos o servicios radiológicos auditados. La aplicabilidad requiere identificar la modalidad real.",
  },
];

const CONTROLS = [
  {
    id: "isolation",
    name: "Datos sintéticos y consultas locales",
    limit:
      "La demo no consulta Huli ni envía preguntas a modelos externos. No equivale a una evaluación de privacidad con datos reales.",
  },
  {
    id: "access",
    name: "Roles y asignaciones simulados",
    limit:
      "Recepción y dirección operativa no abren contenido clínico; el médico ve sus expedientes ficticios asignados. La autorización real debe ejecutarse en servidor.",
  },
  {
    id: "links",
    name: "Enlaces sin credenciales",
    limit:
      "La URL sólo identifica el ejemplo. Conocer o compartir el enlace no concede permiso dentro del flujo simulado.",
  },
  {
    id: "drafts",
    name: "Revisión de borradores sin firma",
    limit:
      "Preparar, confirmar o descartar una nota no produce firma clínica, receta ni cierre de atención.",
  },
  {
    id: "session",
    name: "Sesión y estado temporal",
    limit:
      "La caducidad, el cierre y el reinicio eliminan el estado temporal. Esto no sustituye conservación de expedientes ni una bitácora persistente.",
  },
  {
    id: "export",
    name: "Ficha sin contenido clínico",
    limit:
      "La descarga incluye versión, criterios y pendientes; excluye pacientes, preguntas, notas y credenciales.",
  },
];

const BLOCKERS = [
  {
    id: "server-authorization",
    title: "Autenticación y autorización reales",
    evidence:
      "Cuentas individuales; permisos por organización, expediente y acción en servidor; pruebas de revocación, caducidad y acceso cruzado.",
  },
  {
    id: "record-integrity",
    title: "Expediente completo, autoría y conservación",
    evidence:
      "Muestra cotejada por el responsable clínico, firmas aplicables, expediente único, integridad y conservación verificadas. Los ejemplos actuales no satisfacen este criterio.",
  },
  {
    id: "persistent-audit",
    title: "Trazabilidad y recuperación",
    evidence:
      "Bitácora protegida, retención y acceso definidos, copias de seguridad y ensayo de restauración e incidentes.",
  },
  {
    id: "privacy",
    title: "Privacidad y responsabilidades",
    evidence:
      "Identificación del responsable, aviso, finalidades y fundamento, consentimientos cuando procedan, ARCO, contratos y tratamiento por proveedores.",
  },
  {
    id: "provider-scope",
    title: "Versión y alcance efectivo de Huli",
    evidence:
      "Cotejo de la cuenta, certificado y configuración, módulos y API cubiertos, GIIS y análisis de aplicabilidad de la integración Stratos.",
  },
  {
    id: "establishment",
    title: "Establecimiento y servicios",
    evidence:
      "Documentos originales de clínica y profesionales, avisos/licencias aplicables y revisión física por sede, servicio y equipo.",
  },
  {
    id: "special-services",
    title: "Servicios especializados fuera de la demo",
    evidence:
      "Evaluación adicional antes de habilitar cirugía, anestesia, urgencias, hospitalización, laboratorio, farmacia u otros servicios. Esta matriz no es una lista exhaustiva de todas sus normas.",
  },
];

export function buildClinicalAudit(scenarioId) {
  const scenario =
    typeof scenarioId === "string" && Object.hasOwn(SCENARIOS, scenarioId)
      ? SCENARIOS[scenarioId]
      : {
          id: null,
          name: "Escenario no identificado",
          services:
            "Aplicabilidad por confirmar; no se excluye ninguna obligación por falta de datos.",
        };
  return {
    reviewType: "Auditoría simulada de preparación",
    sourceReviewDate: "2026-10-16",
    officialApproval: false,
    realClinicalUseEnabled: false,
    decision:
      "Demostración con datos ficticios; uso con expedientes reales no habilitado.",
    scenario: { ...scenario },
    demonstratedControls: CONTROLS.map((item) => ({
      ...item,
      status: "Simulado con datos ficticios",
    })),
    standards: STANDARDS.map((item) => ({
      ...item,
      applicability:
        item.id === "nom013"
          ? scenario.id === "demo-clinic-dental"
            ? "Revisar para atención odontológica real"
            : "Condicionada a que se preste atención odontológica"
          : item.id === "nom005"
            ? ["demo-clinic-simple", "demo-clinic-dental"].includes(scenario.id)
              ? "Revisar para consulta no especializada real"
              : "Condicionada al tipo efectivo de consulta"
            : item.id === "nom016"
              ? scenario.id === "demo-clinic-complex"
                ? "Revisar por cada especialidad real; hospital no evaluado"
                : "Condicionada a especialidad u hospitalización"
              : item.id === "nom087"
                ? "Condicionada a los RPBI generados o manejados"
                : item.id === "nom229"
                  ? "Condicionada al servicio y modalidad de rayos X"
                  : "Base de revisión para una operación clínica real",
      status: "No acreditado para un establecimiento real",
    })),
    realUseBlockers: BLOCKERS.map((item) => ({
      ...item,
      status: "Pendiente de evidencia",
      responsible: "Por designar",
      verifiedAt: null,
    })),
    evidenceFields: [
      "Identificador y versión del documento",
      "Fecha y vigencia",
      "Sede y servicio",
      "Responsable de revisión",
      "Resultado, fundamento y próxima revisión",
    ],
    notice:
      "Esta revisión no es una visita, acta, dictamen ni certificación de COFEPRIS o DGIS. Un resultado de prueba o una casilla no acredita una operación sanitaria real.",
  };
}
