
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

const MOCK_LEADS = [
  {
    id: 1,
    fechaIngreso: "2 Abr, 12:07pm",
    asesor: "Estefanía Valdes",
    n: "Rafael",
    tag: "Inversión + Disfrute",
    phone: "+1 817 682 3272",
    email: "",
    st: "Zoom Concretado",
    budget: "$200K USD",
    presupuesto: 200000,
    p: "Torre 25 · BAGA · Kaab On The Beach",
    campana: "Cancún",
    sc: 72,
    hot: false,
    isNew: true,
    bio: "Mexicano radicado en Texas. Busca inversión + disfrute en Playa del Carmen. Perfil decisor — toma consejos de su esposa pero él decide. Ya ha invertido en otros mercados. Conoce Cancún y zona hotelera, no Tulum.",
    risk: "Ya evaluó Amares sin cerrar. Requiere propiedad construida y céntrica. Viaje a Riviera Maya programado para el 4 de julio.",
    friction: "Medio",
    nextAction: "Enviar videos de las propiedades + comparativo Torre 25 vs BAGA vs Kaab",
    nextActionDate: "Esta semana",
    lastActivity: "Zoom concretado — 9 de Abril 6pm",
    daysInactive: 9,
    notas: `OBJETIVO
Inversión y disfrute personal. Playa del Carmen como destino principal.

PRESUPUESTO
$200K USD · Entrega inmediata.
Puede extender presupuesto con financiamiento de desarrollador o crédito hipotecario — planea hipotecar su casa en Texas.

PERFIL DEL CLIENTE
Mexicano viviendo en Texas. Ya evaluó Amares pero no le gustó. Busca algo ya construido y más céntrico. Viaja el 4 de julio a Riviera Maya. Conoce Cancún y la zona hotelera; no conoce Tulum. Toma consejos de su esposa pero él decide. Ya tiene inversiones en otros mercados. Actualmente en Guerrero por temas personales.

HISTORIAL DE CONTACTO
• Sáb 4 Abr — Cita presencial en Guerrero 10am / PDC 11am
• Reagendado → Jue 9 Abr 6pm
• Zoom concretado el 9 de Abril

PENDIENTE
Sacar y enviar videos de las propiedades de interés (Torre 25, BAGA, Kaab On The Beach).`,
  },
  {
    id: 2,
    fechaIngreso: "28 Mar, 9:15am",
    asesor: "Ken Lugo Ríos",
    n: "Fam. Rodríguez",
    tag: "Penthouse Élite",
    phone: "+52 984 123 0001",
    email: "familia@rodriguez.com",
    st: "Negociación",
    budget: "$4.2M USD",
    presupuesto: 4200000,
    p: "Gobernador 28",
    campana: "Referido",
    sc: 92,
    hot: true,
    isNew: false,
    bio: "Familia inversionista buscando propiedades premium para crecimiento patrimonial. Alto potencial de referidos.",
    risk: "Costos notariales pendientes de confirmar con banco.",
    friction: "Bajo",
    nextAction: "Enviar expediente a notaría y confirmar fecha de firma",
    nextActionDate: "Hoy",
    lastActivity: "Visita al penthouse — reacción muy positiva",
    daysInactive: 2,
    notas: `OBJETIVO
Crecimiento patrimonial. Penthouse de lujo como activo principal.

PRESUPUESTO
$4.2M USD · Financiamiento propio confirmado.

PERFIL DEL CLIENTE
Familia con historial de inversión inmobiliaria. Muy orientados a calidad y exclusividad. Alto potencial de referidos dentro de su red.

HISTORIAL DE CONTACTO
• Primera visita al penthouse — excelente reacción
• Propuesta enviada y revisada
• En etapa activa de negociación de condiciones

PENDIENTE
Conectar con notaría aliada. Confirmar costos notariales con el banco. Preparar expediente de cierre.`,
  },
  {
    id: 3,
    fechaIngreso: "30 Mar, 11:00am",
    asesor: "Emmanuel Ortiz",
    n: "James Mitchell",
    tag: "CEO · Tecnología",
    phone: "+1 310 555 0002",
    email: "james@mitchell.co",
    st: "Zoom Agendado",
    budget: "$2.8M USD",
    presupuesto: 2800000,
    p: "Monarca 28",
    campana: "LinkedIn",
    sc: 85,
    hot: true,
    isNew: true,
    bio: "Director de empresa de tecnología. Busca diversificar patrimonio. Muy analítico, basa decisiones en datos y proyecciones.",
    risk: "Solicita garantías de construcción y avances de obra documentados.",
    friction: "Bajo",
    nextAction: "Zoom mañana 10:00am — presentar avances de obra y proyección ROI a 3 años",
    nextActionDate: "Mañana 10:00am",
    lastActivity: "Llamada 25 min — muy interesado en ROI",
    daysInactive: 3,
    notas: `OBJETIVO
Diversificación patrimonial. Busca activos de alto ROI con respaldo constructivo sólido.

PRESUPUESTO
$2.8M USD · Capital propio disponible.

PERFIL DEL CLIENTE
CEO de empresa tecnológica. Perfil analítico — necesita datos, no emoción. Valora la transparencia en avances de obra y proyecciones financieras reales.

HISTORIAL DE CONTACTO
• Primer contacto vía LinkedIn
• Llamada de 25 min — alto interés en ROI y garantías
• Zoom agendado

PENDIENTE
Preparar reporte de avance de obra actualizado + proyección ROI a 3 años antes del zoom.`,
  },
  {
    id: 4,
    fechaIngreso: "1 Abr, 3:30pm",
    asesor: "Araceli Oneto",
    n: "Sarah Williams",
    tag: "Inversionista Internacional",
    phone: "+44 20 7946 0004",
    email: "sarah@williams-capital.com",
    st: "Seguimiento",
    budget: "$3.1M USD",
    presupuesto: 3100000,
    p: "Gobernador 28",
    campana: "Facebook Ads",
    sc: 65,
    hot: false,
    isNew: true,
    bio: "Analista de bienes raíces de Londres. Muy detallista con números y comparativas de rendimiento por zona.",
    risk: "Compara activamente con otras zonas de la Riviera Maya. Alta exigencia documental.",
    friction: "Alto",
    nextAction: "Enviar comparativo Riviera Maya vs Cancún + llamar hoy 5pm",
    nextActionDate: "Hoy 5:00pm",
    lastActivity: "Visitó proyecto — solicitó comparativas de zona",
    daysInactive: 8,
    notas: `OBJETIVO
Inversión de portafolio con criterio internacional. Busca rendimientos superiores al mercado londinense.

PRESUPUESTO
$3.1M USD · Capital de inversión institucional.

PERFIL DEL CLIENTE
Analista de bienes raíces con base en Londres. Muy detallista y comparativa. Exige documentación completa y comparativas por zona antes de tomar cualquier decisión.

HISTORIAL DE CONTACTO
• Contacto vía Facebook Ads
• Visita al proyecto — buena reacción inicial
• Solicitó comparativo de rendimientos por zona

PENDIENTE
Enviar comparativo detallado: Riviera Maya vs Cancún vs CDMX. Llamar hoy 5pm para resolver dudas.`,
  },
  {
    id: 5,
    fechaIngreso: "25 Mar, 2:00pm",
    asesor: "Emmanuel Ortiz",
    n: "Tony Norberto",
    tag: "Inversionista VIP",
    phone: "+52 998 555 0006",
    email: "tony.norberto@inv.com",
    st: "Zoom Concretado",
    budget: "$5.1M USD",
    presupuesto: 5100000,
    p: "Portofino",
    campana: "Referido VIP",
    sc: 88,
    hot: true,
    isNew: false,
    bio: "Empresario con portafolio diversificado. Busca activo de alta liquidez en zona costera premium.",
    risk: "Evalúa otra propiedad en paralelo. Plazo de decisión muy corto.",
    friction: "Medio",
    nextAction: "Enviar propuesta formal con condiciones de pago + carta de exclusividad",
    nextActionDate: "Hoy",
    lastActivity: "Zoom concretado — confirmó alto interés en Portofino",
    daysInactive: 1,
    notas: `OBJETIVO
Alta liquidez y plusvalía en zona costera premium. Portafolio de inversión diversificado.

PRESUPUESTO
$5.1M USD · Capital disponible inmediato.

PERFIL DEL CLIENTE
Empresario experimentado. Portafolio diversificado en distintos mercados. Evalúa decisiones rápido pero requiere condiciones claras y exclusividad.

HISTORIAL DE CONTACTO
• Referido VIP directo
• Zoom concretado — alto interés confirmado en Portofino

PENDIENTE
Enviar propuesta formal con condiciones de pago. Carta de exclusividad de unidad. Actúa rápido o pierde a otro comprador.`,
  },
  {
    id: 6,
    fechaIngreso: "3 Abr, 10:00am",
    asesor: "Araceli Oneto",
    n: "Daniela Vega",
    tag: "Nuevo Registro",
    phone: "+52 984 555 0007",
    email: "dra.vega@clinica.com",
    st: "Seguimiento",
    budget: "$2.2M USD",
    presupuesto: 2200000,
    p: "Gobernador 28",
    campana: "Referido",
    sc: 55,
    hot: false,
    isNew: true,
    bio: "Médica especialista. Primera inversión inmobiliaria. Alto poder adquisitivo, poco conocimiento del sector.",
    risk: "Necesita educación sobre el proceso de compra y retorno real antes de decidir.",
    friction: "Medio",
    nextAction: "Enviar guía de inversión + llamar mañana para explicar el proceso",
    nextActionDate: "Mañana",
    lastActivity: "Registro web — referida por Fam. Rodríguez",
    daysInactive: 1,
    notas: `OBJETIVO
Primera inversión inmobiliaria. Busca seguridad y crecimiento patrimonial.

PRESUPUESTO
$2.2M USD · Recursos propios disponibles.

PERFIL DEL CLIENTE
Médica especialista. Ingresos altos pero sin experiencia en bienes raíces. Requiere acompañamiento y educación en el proceso. Referida directamente por Fam. Rodríguez.

HISTORIAL DE CONTACTO
• Registro vía formulario web
• Referida por Fam. Rodríguez — contacto cálido

PENDIENTE
Enviar guía personalizada de inversión inmobiliaria. Llamar mañana para resolver dudas sobre el proceso de compra.`,
  },
  {
    id: 7,
    fechaIngreso: "3 Abr, 4:45pm",
    asesor: "Cecilia Mendoza",
    n: "Marco Aurelio",
    tag: "Nuevo Registro",
    phone: "+52 998 555 0008",
    email: "marco.aurelio@arqui.mx",
    st: "Primer Contacto",
    budget: "$1.5M USD",
    presupuesto: 1500000,
    p: "Monarca 28",
    campana: "Google Ads",
    sc: 62,
    hot: false,
    isNew: true,
    bio: "Arquitecto independiente. Perfil técnico, valora calidad constructiva. Busca primera inversión inmobiliaria.",
    risk: "Quiere inspección técnica detallada de la obra antes de comprometerse.",
    friction: "Bajo",
    nextAction: "Confirmar tour técnico de obra — jueves 9:00am con ingeniero residente",
    nextActionDate: "Jueves 9:00am",
    lastActivity: "Registro web — preguntó por especificaciones técnicas de construcción",
    daysInactive: 0,
    notas: `OBJETIVO
Inversión con alta calidad constructiva. Como arquitecto, evalúa técnicamente la obra.

PRESUPUESTO
$1.5M USD · Recursos propios.

PERFIL DEL CLIENTE
Arquitecto independiente. Muy técnico — evalúa especificaciones, materiales y procesos constructivos. Baja fricción porque entiende el sector, pero requiere validación técnica antes de comprometerse.

HISTORIAL DE CONTACTO
• Registro vía Google Ads
• Preguntó específicamente por especificaciones técnicas de construcción

PENDIENTE
Confirmar tour técnico de obra con el ingeniero residente para el jueves 9:00am. Preparar dossier técnico con especificaciones.`,
  },
  {
    id: 8,
    fechaIngreso: "20 Mar, 8:30am",
    asesor: "Oscar Gálvez",
    n: "Carlos Slim Jr.",
    tag: "Gran Inversionista",
    phone: "+52 55 555 0003",
    email: "csj@grupofinanciero.com",
    st: "Seguimiento",
    budget: "$6.5M USD",
    presupuesto: 6500000,
    p: "Portofino",
    campana: "Evento VIP",
    sc: 78,
    hot: false,
    isNew: false,
    bio: "Inversionista de alto perfil. Busca proteger capital con propiedades de lujo a largo plazo. Portafolio diversificado.",
    risk: "Necesita proyección financiera a 10 años antes de comprometerse.",
    friction: "Medio",
    nextAction: "Enviar proyección financiera a 10 años y proponer sesión ejecutiva",
    nextActionDate: "Esta semana",
    lastActivity: "Reunión inicial en evento VIP — intrigado por rendimientos",
    daysInactive: 5,
    notas: `OBJETIVO
Protección de capital a largo plazo. Activo de lujo en destino premium.

PRESUPUESTO
$6.5M USD · Capacidad de inversión amplia.

PERFIL DEL CLIENTE
Inversionista de alto perfil con portafolio diversificado. Tomador de decisiones lento pero con alto poder de cierre. Requiere proyecciones financieras sólidas.

HISTORIAL DE CONTACTO
• Contacto en evento VIP exclusivo
• Reunión inicial — interés en rendimientos a largo plazo

PENDIENTE
Preparar proyección financiera a 10 años. Proponer sesión ejecutiva con Director de Arquitectura y CEO.`,
  },
];

const MOCK_PROPS = [
  { n: "Gobernador 28", u: 48, s: 31, roi: "24%", pr: "$280K–$1.2M", loc: "Playa del Carmen", st: "Pre-venta", c: "#7EB8F0" },
  { n: "Monarca 28", u: 72, s: 45, roi: "19%", pr: "$180K–$650K", loc: "Playa del Carmen", st: "Construcción", c: "#67B7D1" },
  { n: "Portofino", u: 36, s: 12, roi: "32%", pr: "$520K–$2.1M", loc: "Puerto Aventuras", st: "Lanzamiento", c: "#6DD4A8" },
];

const MOCK_TEAM = [
  { n: "Oscar Gálvez",      r: "CEO Ejecutivo",          d: 28, rv: "$24.8M", e: 98, sk: 12, role: "CEO",       c: "#A78BFA",  wa: "+52 998 000 0001", cal: "" },
  { n: "Emmanuel Ortiz",    r: "Director de Ventas",     d: 14, rv: "$12.4M", e: 94, sk: 9,  role: "Directivo", c: "#7EB8F0",    wa: "+52 998 000 0002", cal: "" },
  { n: "Alexia Santillán",  r: "Directora Administrativa",d:14, rv: "$11.2M", e: 91, sk: 8,  role: "Directivo", c: "#6DD4A8", wa: "+52 998 000 0003", cal: "" },
  { n: "Alex Velázquez",    r: "Director de Marketing",  d: 12, rv: "$9.8M",  e: 89, sk: 7,  role: "Directivo", c: "#67B7D1",   wa: "+52 998 000 0004", cal: "" },
  { n: "Ken Lugo Ríos",     r: "Asesor Senior",          d: 11, rv: "$8.7M",  e: 88, sk: 6,  role: "Directivo", c: "#5DC8D9",    wa: "+52 998 000 0005", cal: "" },
  { n: "Araceli Oneto",     r: "Asesora Especialista",   d: 10, rv: "$7.5M",  e: 85, sk: 5,  role: "Asesor",    c: "#6EE7C2",  wa: "+52 998 000 0006", cal: "" },
  { n: "Cecilia Mendoza",   r: "Asesora Premium",        d: 10, rv: "$7.2M",  e: 83, sk: 4,  role: "Asesor",    c: "#6EE7C2",  wa: "+52 998 000 0007", cal: "" },
  { n: "Estefanía Valdes",  r: "Asesora Premium",        d: 9,  rv: "$6.8M",  e: 82, sk: 4,  role: "Asesor",    c: "#6EE7C2",  wa: "+52 998 000 0008", cal: "" },
];

async function seed() {
  console.log('Starting seed...');

  // Seed Projects
  console.log('Seeding projects...');
  const { error: errP } = await supabase.from('projects').upsert(
    MOCK_PROPS.map(p => ({
      name: p.n,
      units: p.u,
      sold: p.s,
      roi: p.roi,
      price_range: p.pr,
      location: p.loc,
      status: p.st,
      color: p.c
    }))
  );
  if (errP) console.error('Error seeding projects:', errP.message);
  else console.log('Projects seeded successfully.');

  // Seed Leads
  console.log('Seeding leads...');
  const { error: errL } = await supabase.from('LEADS').upsert(
    MOCK_LEADS.map(l => ({
      "NOMBRE DEL CLIENTE": l.n,
      "ASESOR": l.asesor,
      "FECHA INGRESO": l.fechaIngreso,
      "TELEFONO": l.phone,
      "ESTATUS": l.st,
      "PRESUPUESTO": l.presupuesto,
      "PROYECTO DE INTERES": l.p,
      "CAMPAÑA": l.campana,
      "NOTAS": [{ nota: l.bio, fecha: new Date().toISOString() }]
    }))
  );
  if (errL) console.error('Error seeding leads:', errL.message);
  else console.log('Leads seeded successfully.');

  // Seed Team
  console.log('Seeding team...');
  const { error: errT } = await supabase.from('profiles').upsert(
    MOCK_TEAM.map(t => ({
      name: t.n,
      role_display: t.r,
      deals: t.d,
      revenue: t.rv,
      efficiency: t.e,
      skills_count: t.sk,
      role: t.role,
      color: t.c,
      whatsapp: t.wa,
      calendly: t.cal
    }))
  );
  if (errT) console.error('Error seeding team:', errT.message);
  else console.log('Team seeded successfully.');

  console.log('Seed completed.');
}

seed();
