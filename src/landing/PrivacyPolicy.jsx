import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Globe, Mail, ShieldCheck, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════
   DESIGN TOKENS — alineados con LandingMarketing
   ═══════════════════════════════════ */
const P = {
  bg: "#04080F",
  surface: "#080D17",
  glass: "rgba(255,255,255,0.028)",
  glassH: "rgba(255,255,255,0.048)",
  border: "rgba(255,255,255,0.06)",
  borderH: "rgba(255,255,255,0.12)",
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
  .pp-wrap { background: ${P.bg}; color: ${P.txt}; font-family: ${font}; min-height: 100vh; }
  .pp-wrap *, .pp-wrap *::before, .pp-wrap *::after { box-sizing: border-box; }
  .pp-wrap a { color: ${P.accent}; text-decoration: none; }
  .pp-wrap a:hover { text-decoration: underline; }
  .pp-wrap h1, .pp-wrap h2, .pp-wrap h3 { font-family: ${fontD}; color: ${P.w}; letter-spacing: -0.02em; }
  .pp-wrap p, .pp-wrap li { line-height: 1.7; color: ${P.txt}; font-size: 15px; }
  .pp-wrap li { margin-bottom: 6px; }
  .pp-wrap ul { padding-left: 22px; margin: 8px 0 16px; }
  .pp-wrap section { scroll-margin-top: 96px; }
  .pp-wrap section + section { margin-top: 36px; }
  .pp-wrap .toc-link { display: block; padding: 7px 12px; border-radius: 8px; color: ${P.txt2}; font-size: 13px; transition: all 0.15s; border-left: 2px solid transparent; }
  .pp-wrap .toc-link:hover { background: ${P.glass}; color: ${P.w}; text-decoration: none; border-left-color: ${P.accent}; }
  .pp-wrap .toc-link.active { background: ${P.accentS}; color: ${P.accent}; border-left-color: ${P.accent}; }
  .pp-grid { display: grid; grid-template-columns: 260px 1fr; gap: 48px; max-width: 1200px; margin: 0 auto; padding: 32px 24px 96px; }
  .pp-toc { position: sticky; top: 96px; align-self: start; max-height: calc(100vh - 120px); overflow-y: auto; padding-right: 8px; }
  @media (max-width: 900px) {
    .pp-grid { grid-template-columns: 1fr; gap: 24px; padding: 24px 16px 64px; }
    .pp-toc { position: static; max-height: none; }
    .pp-wrap p, .pp-wrap li { font-size: 14.5px; }
  }
  .pp-card { background: ${P.glass}; border: 1px solid ${P.border}; border-radius: ${P.r}px; padding: 20px 24px; }
  .pp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: ${P.accentS}; border: 1px solid ${P.accentB}; color: ${P.accent}; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
`;

/* ═══════════════════════════════════
   CONTENIDO — ES
   ═══════════════════════════════════ */
const ES = {
  meta: {
    title: "Política de Privacidad — Stratos Capital Group",
    description:
      "Política de Privacidad de Stratos Capital Group para WhatsApp Business Cloud API, Meta Lead Ads y servicios de atención al cliente. Cumple con GDPR, CCPA/CPRA y LFPDPPP.",
  },
  ui: {
    back: "Volver al inicio",
    title: "Política de Privacidad",
    subtitle:
      "Cómo Stratos Capital Group recopila, utiliza, protege y comparte la información personal de las personas que interactúan con nosotros a través de WhatsApp, Meta Ads y nuestros canales digitales.",
    version: "Versión 1.0",
    updated: "Última actualización: 30 de abril de 2026",
    tocLabel: "Índice",
    toc: [
      ["1", "Identificación del responsable"],
      ["2", "Aceptación de la política"],
      ["3", "Datos personales que recopilamos"],
      ["4", "Cómo recopilamos los datos"],
      ["5", "Finalidad del tratamiento"],
      ["6", "Base legal para el tratamiento"],
      ["7", "Uso de inteligencia artificial"],
      ["8", "Compartición de datos con terceros"],
      ["9", "Transferencias internacionales"],
      ["10", "Conservación de datos"],
      ["11", "Seguridad de la información"],
      ["12", "Derechos del titular"],
      ["13", "Cómo ejercer tus derechos"],
      ["14", "Cookies y tecnologías similares"],
      ["15", "Menores de edad"],
      ["16", "Cambios a esta política"],
      ["17", "Contacto"],
    ],
  },
  body: () => (
    <>
      <section id="s1">
        <h2>1. Identificación del responsable</h2>
        <p>
          La presente Política de Privacidad regula el tratamiento de los datos personales recopilados por
          <strong> Stratos Capital Group</strong> (en adelante, <em>"Stratos"</em>, <em>"nosotros"</em> o <em>"la empresa"</em>),
          a través de su sitio web <a href="https://stratoscapitalgroup.com">stratoscapitalgroup.com</a>, sus números de
          WhatsApp Business y los formularios de generación de prospectos publicados en plataformas de Meta
          (Facebook e Instagram).
        </p>
        <ul>
          <li><strong>Nombre comercial:</strong> Stratos Capital Group</li>
          <li><strong>Sitio web:</strong> <a href="https://stratoscapitalgroup.com">https://stratoscapitalgroup.com</a></li>
          <li><strong>Correo de privacidad:</strong> <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a> (principal) · <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a></li>
          <li><strong>Sector:</strong> Servicios inmobiliarios e inversión patrimonial</li>
        </ul>
        <p>
          Stratos actúa como <strong>responsable del tratamiento</strong> respecto de los datos personales recabados
          a través de los canales descritos en este documento. En la prestación de sus servicios, Stratos también
          colabora con <strong>encargados del tratamiento</strong> (procesadores de datos) debidamente identificados
          en la sección 8 de esta política.
        </p>
      </section>

      <section id="s2">
        <h2>2. Aceptación de la política</h2>
        <p>
          Al iniciar una conversación con Stratos a través de WhatsApp, completar un formulario de Meta Lead Ads,
          contactarnos por correo electrónico, o navegar nuestro sitio web, usted manifiesta haber leído, entendido
          y aceptado los términos de la presente Política de Privacidad. Si usted no está de acuerdo con cualquiera
          de estos términos, le solicitamos abstenerse de proporcionar información personal y de continuar utilizando
          nuestros canales de comunicación.
        </p>
        <p>
          Esta política aplica de manera específica al ecosistema operado por Stratos, que incluye —entre otros— el
          uso de la <strong>API de WhatsApp Business Cloud</strong>, la <strong>API de Marketing de Meta</strong>{" "}
          (incluyendo Lead Ads) y la plataforma de gestión de conversaciones <strong>Chatwoot</strong> alojada en
          servidores propios.
        </p>
      </section>

      <section id="s3">
        <h2>3. Datos personales que recopilamos</h2>
        <p>
          Recopilamos únicamente los datos personales estrictamente necesarios para prestarle un servicio adecuado.
          A continuación describimos las categorías concretas de información que tratamos.
        </p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.1 A través de WhatsApp Business Cloud API</h3>
        <ul>
          <li>Número de teléfono asociado a la cuenta de WhatsApp.</li>
          <li>Nombre de perfil que usted ha configurado públicamente en WhatsApp.</li>
          <li>Contenido de los mensajes que usted envía: texto, imágenes, archivos de audio, documentos y, si decide compartirla, su ubicación geográfica.</li>
          <li>Metadatos asociados a los mensajes: fecha y hora de envío, estado de entrega y de lectura, y zona horaria del dispositivo cuando es expuesta por la plataforma.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.2 A través de Meta Lead Ads</h3>
        <ul>
          <li>Nombre completo proporcionado en el formulario.</li>
          <li>Correo electrónico.</li>
          <li>Número de teléfono.</li>
          <li>Respuestas a las preguntas personalizadas del formulario del anuncio (por ejemplo: tipo de propiedad de interés, ciudad, presupuesto estimado, plazo de compra).</li>
          <li>Identificadores técnicos provistos por Meta que permiten asociar el lead al anuncio de origen.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.3 A través de la interacción comercial</h3>
        <ul>
          <li>Historial completo de conversaciones mantenidas con asesores de Stratos.</li>
          <li>Notas internas que los asesores y los sistemas de inteligencia artificial generan sobre el avance de su solicitud.</li>
          <li>Datos de comportamiento e interés (etapas en el embudo, propiedades que ha consultado, citas agendadas, visitas realizadas).</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.4 Datos que NO recopilamos</h3>
        <p>
          De manera expresa, Stratos <strong>no</strong> solicita ni almacena las siguientes categorías de datos a
          través de WhatsApp ni de los formularios de Meta Lead Ads:
        </p>
        <ul>
          <li>Contraseñas de cuentas de terceros.</li>
          <li>Datos bancarios completos (número de tarjeta, CVV, credenciales de banca electrónica).</li>
          <li>Datos biométricos.</li>
          <li>Datos sensibles de salud.</li>
          <li>Datos de personas menores de edad (ver sección 15).</li>
        </ul>
      </section>

      <section id="s4">
        <h2>4. Cómo recopilamos los datos</h2>
        <p>Recopilamos sus datos personales por las siguientes vías:</p>
        <ul>
          <li><strong>Conversaciones iniciadas por usted</strong> en uno de nuestros números registrados en WhatsApp Business Cloud API.</li>
          <li><strong>Clic en anuncios de Meta</strong> con botón "Enviar mensaje", lo cual abre una conversación pre-rellenada en WhatsApp.</li>
          <li><strong>Formularios de Meta Lead Ads</strong> que usted completa voluntariamente dentro de Facebook o Instagram.</li>
          <li><strong>Comunicaciones por correo electrónico</strong> dirigidas a buzones de Stratos.</li>
          <li><strong>Navegación en nuestro sitio web</strong> a través de cookies y tecnologías similares (ver sección 14).</li>
        </ul>
        <p>
          En todos los casos, la primera comunicación es iniciada por usted o autorizada explícitamente por usted al
          completar un formulario de Meta. Stratos no envía mensajes proactivos de WhatsApp a personas que no hayan
          establecido contacto previo o que no hayan otorgado consentimiento por escrito.
        </p>
      </section>

      <section id="s5">
        <h2>5. Finalidad del tratamiento</h2>
        <h3 style={{ marginTop: 8, fontSize: 17 }}>5.1 Finalidades primarias</h3>
        <p>Estas finalidades son indispensables para prestarle el servicio que usted ha solicitado:</p>
        <ul>
          <li>Atender sus consultas a través de WhatsApp en tiempo razonable.</li>
          <li>Dar seguimiento personalizado a su interés en propiedades inmobiliarias.</li>
          <li>Coordinar visitas, recorridos virtuales y reuniones de asesoría.</li>
          <li>Compartir información sobre propiedades, precios, disponibilidad y condiciones comerciales.</li>
          <li>Procesar y priorizar leads generados por anuncios de Meta para responder con la mayor prontitud posible.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>5.2 Finalidades secundarias</h3>
        <p>
          Las siguientes finalidades se basan en el interés legítimo de Stratos y, donde la legislación lo exija,
          en el consentimiento del titular. Usted puede oponerse a estas finalidades en cualquier momento:
        </p>
        <ul>
          <li>Mejorar la calidad del servicio al cliente y la capacitación interna del equipo de ventas.</li>
          <li>Realizar análisis estadísticos y agregados sobre conversiones y desempeño comercial.</li>
          <li>Cumplir obligaciones legales, fiscales y contables aplicables.</li>
          <li>Prevenir fraude, abuso de la plataforma y actividades contrarias a las políticas de Meta.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>5.3 Finalidades expresamente excluidas</h3>
        <p>Stratos <strong>no</strong> utilizará sus datos personales para:</p>
        <ul>
          <li>Venderlos, alquilarlos o cederlos a terceros con fines de mercadotecnia ajena al servicio.</li>
          <li>Realizar publicidad de productos o servicios de terceros sin relación con Stratos.</li>
          <li>Tomar decisiones automatizadas que produzcan efectos legales significativos sobre usted sin posibilidad de revisión humana.</li>
        </ul>
      </section>

      <section id="s6">
        <h2>6. Base legal para el tratamiento</h2>
        <p>
          Dependiendo del país de residencia del titular, las bases legales que legitiman el tratamiento de sus
          datos personales por parte de Stratos son las siguientes:
        </p>
        <ul>
          <li><strong>Consentimiento:</strong> al iniciar la conversación o completar un formulario, usted otorga consentimiento explícito para que Stratos trate sus datos para las finalidades primarias descritas.</li>
          <li><strong>Ejecución de un servicio:</strong> el tratamiento es necesario para responderle, agendar visitas y prestar la asesoría inmobiliaria solicitada.</li>
          <li><strong>Interés legítimo:</strong> para fines analíticos agregados, mejora del servicio y prevención de fraude, en estricta proporcionalidad con sus derechos.</li>
          <li><strong>Obligación legal:</strong> conservación de comprobantes y registros con relevancia fiscal, conforme a la legislación aplicable.</li>
        </ul>
      </section>

      <section id="s7">
        <h2>7. Uso de inteligencia artificial</h2>
        <p>
          De conformidad con las <strong>AI-Assisted Business Messaging Guidelines</strong> publicadas por Meta y
          vigentes desde el 15 de enero de 2026, declaramos de manera transparente el uso que hacemos de sistemas
          de inteligencia artificial en nuestras conversaciones de WhatsApp.
        </p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.1 Sistemas de IA específicos para tareas de negocio</h3>
        <p>Stratos utiliza inteligencia artificial únicamente para tareas estructuradas y delimitadas:</p>
        <ul>
          <li>Clasificación automática de mensajes entrantes según intención (consulta general, agendar visita, postventa, etc.).</li>
          <li>Enrutamiento de la conversación al asesor humano más adecuado en función de geografía, idioma y disponibilidad.</li>
          <li>Sugerencias internas de respuesta para asistir a los agentes humanos, las cuales son revisadas por una persona antes de ser enviadas en cualquier interacción crítica.</li>
          <li>Seguimiento operativo dentro del CRM (recordatorios, etiquetado de etapas, priorización de pendientes).</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.2 Lo que NUESTRA IA no es</h3>
        <ul>
          <li>No es un chatbot conversacional de propósito general.</li>
          <li>No sustituye al asesor humano en decisiones comerciales relevantes.</li>
          <li>No genera recomendaciones financieras o de inversión sin supervisión humana.</li>
          <li>No utiliza sus mensajes para entrenar modelos de inteligencia artificial de terceros.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.3 Acceso a un agente humano</h3>
        <p>
          En todo momento usted tiene derecho a hablar con una persona. Para hacerlo, basta con escribir
          <strong> "humano"</strong>, <strong>"agente"</strong> o <strong>"persona"</strong> en cualquier
          conversación, y la solicitud será derivada de inmediato a un asesor humano. Esta opción se encuentra
          disponible 24 horas al día, sujeta a tiempos razonables de respuesta dentro del horario de atención.
        </p>
      </section>

      <section id="s8">
        <h2>8. Compartición de datos con terceros</h2>
        <p>
          Para prestarle el servicio, Stratos comparte datos personales con un número limitado de proveedores
          tecnológicos que actúan como <strong>encargados del tratamiento</strong> bajo contratos que les obligan
          a mantener niveles de protección equivalentes a los de esta política.
        </p>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Meta Platforms, Inc.</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Rol:</strong> proveedor de la API de WhatsApp Business Cloud y de la API de Marketing de Meta.<br />
            <strong>Datos compartidos:</strong> contenido de los mensajes, número de teléfono, nombre de perfil, metadatos
            de entrega y respuestas a formularios de Lead Ads.<br />
            <strong>Retención por parte de Meta:</strong> hasta 30 días en sus servidores, conforme a la documentación
            oficial de WhatsApp Business Cloud API.<br />
            <strong>Marco contractual:</strong> Términos de WhatsApp Business y políticas de Meta para Desarrolladores.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Chatwoot (autohospedado)</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Rol:</strong> plataforma de gestión de conversaciones omnicanal donde los asesores responden los mensajes.<br />
            <strong>Datos almacenados:</strong> copia de las conversaciones, datos de contacto, etapas del CRM y notas internas.<br />
            <strong>Ubicación:</strong> servidores controlados directamente por Stratos.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>n8n (orquestación de flujos)</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Rol:</strong> automatización interna de tareas (notificaciones, integraciones entre sistemas, lógicas de IA específicas).<br />
            <strong>Datos procesados:</strong> únicamente los necesarios para ejecutar cada flujo (por ejemplo, número de teléfono, etapa del lead).<br />
            <strong>Ubicación:</strong> infraestructura propia bajo control de Stratos.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Proveedores de infraestructura</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Rol:</strong> alojamiento, copias de seguridad, monitoreo y operación técnica del CRM.<br />
            <strong>Marco contractual:</strong> acuerdos de procesamiento de datos (DPA) con cláusulas de confidencialidad y obligaciones de seguridad.
          </p>
        </div>

        <p style={{ marginTop: 12 }}>
          <strong>Stratos no vende ni alquila sus datos personales bajo ninguna circunstancia.</strong> Cualquier
          compartición fuera de lo descrito en esta sección ocurrirá únicamente cuando exista una obligación legal
          o resolución de autoridad competente que lo requiera.
        </p>
      </section>

      <section id="s9">
        <h2>9. Transferencias internacionales de datos</h2>
        <p>
          Algunos de los proveedores con los que trabajamos —de manera particular Meta Platforms, Inc.— pueden
          procesar datos personales en infraestructura ubicada fuera del país de residencia del titular,
          incluyendo servidores en los Estados Unidos y otras jurisdicciones. Estas transferencias se realizan
          al amparo de mecanismos jurídicos válidos: Cláusulas Contractuales Tipo, decisiones de adecuación o
          consentimiento explícito del titular, según corresponda.
        </p>
        <p>
          Stratos exige a sus proveedores que apliquen medidas técnicas y organizativas equivalentes a las
          establecidas en su jurisdicción de origen, de modo que el nivel de protección de sus datos no se
          vea disminuido por la transferencia.
        </p>
      </section>

      <section id="s10">
        <h2>10. Conservación de datos</h2>
        <p>Conservamos sus datos personales únicamente durante el tiempo necesario para cumplir las finalidades descritas:</p>
        <ul>
          <li><strong>Mensajes de WhatsApp en servidores de Meta:</strong> hasta 30 días, conforme a la política de WhatsApp Business Cloud API.</li>
          <li><strong>Datos en el CRM Chatwoot:</strong> durante toda la relación comercial activa y hasta 24 meses adicionales tras la última interacción, salvo que usted solicite su eliminación anticipada.</li>
          <li><strong>Datos con relevancia fiscal o contable:</strong> 5 años desde la operación, por imperativo legal en México y plazos análogos en otras jurisdicciones aplicables.</li>
          <li><strong>Notas internas y registros operativos:</strong> mismos plazos que el CRM, salvo solicitud expresa de supresión.</li>
        </ul>
        <p>
          Vencidos estos plazos, los datos se eliminan o se anonimizan de forma irreversible, salvo que exista una
          obligación legal que requiera su conservación adicional.
        </p>
      </section>

      <section id="s11">
        <h2>11. Seguridad de la información</h2>
        <p>
          Stratos aplica medidas técnicas y organizativas razonables para proteger sus datos contra accesos no
          autorizados, alteración, divulgación o destrucción. Entre otras:
        </p>
        <ul>
          <li>Cifrado de extremo a extremo de WhatsApp (protocolo Signal) durante el transporte de los mensajes.</li>
          <li>Acceso restringido al CRM mediante credenciales personales y autenticación de dos factores para usuarios privilegiados.</li>
          <li>Roles y permisos granulares: cada asesor accede únicamente a la información que necesita para su función.</li>
          <li>Servidores con actualizaciones de seguridad regulares y monitoreo continuo.</li>
          <li>Acuerdos de confidencialidad firmados por todo el personal con acceso a datos personales.</li>
          <li>Copias de seguridad cifradas y procedimientos documentados de respuesta a incidentes.</li>
        </ul>
        <p>
          Pese a estas medidas, ningún sistema es absolutamente invulnerable. En caso de detectar un incidente
          de seguridad que afecte sus datos personales, Stratos se compromete a notificarle a usted y a las
          autoridades competentes en los plazos que la legislación aplicable exija.
        </p>
      </section>

      <section id="s12">
        <h2>12. Derechos del titular</h2>
        <p>Dependiendo de su país de residencia, usted dispone de los siguientes derechos:</p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.1 Bajo el Reglamento General de Protección de Datos (GDPR — Unión Europea)</h3>
        <ul>
          <li>Derecho de acceso a sus datos personales.</li>
          <li>Derecho de rectificación de datos inexactos.</li>
          <li>Derecho de supresión ("derecho al olvido").</li>
          <li>Derecho a la limitación del tratamiento.</li>
          <li>Derecho a la portabilidad de los datos.</li>
          <li>Derecho de oposición al tratamiento basado en interés legítimo.</li>
          <li>Derecho a no ser sometido a decisiones individuales automatizadas con efectos jurídicos significativos.</li>
          <li>Derecho a presentar una reclamación ante la autoridad de control competente.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.2 Bajo la CCPA / CPRA (California, Estados Unidos)</h3>
        <ul>
          <li>Derecho a saber qué datos personales se recopilan y cómo se usan.</li>
          <li>Derecho a solicitar la eliminación de sus datos personales.</li>
          <li>Derecho a optar por no participar en la "venta" o "compartición" de datos personales (Stratos no vende datos personales).</li>
          <li>Derecho a la no discriminación por ejercer cualquiera de los derechos anteriores.</li>
          <li>Derecho a corregir información personal inexacta.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.3 Bajo la LFPDPPP (México) — Derechos ARCO</h3>
        <ul>
          <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre usted y los detalles de su tratamiento.</li>
          <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
          <li><strong>Cancelación:</strong> pedir la eliminación de sus datos cuando ya no sean necesarios.</li>
          <li><strong>Oposición:</strong> oponerse al uso de sus datos para fines específicos.</li>
        </ul>
      </section>

      <section id="s13">
        <h2>13. Cómo ejercer tus derechos</h2>
        <p>Para ejercer cualquiera de los derechos descritos en la sección anterior, contáctenos por correo electrónico:</p>
        <div className="pp-card" style={{ marginTop: 12 }}>
          <p>
            <strong>Correo principal:</strong> <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a><br />
            <strong>Correo alterno:</strong> <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a><br />
            <strong>Asunto sugerido:</strong> "Solicitud de derechos de datos personales"
          </p>
          <p style={{ marginTop: 8 }}>Para procesar su solicitud, le pediremos los siguientes elementos:</p>
          <ul>
            <li>Nombre completo del titular.</li>
            <li>Medio de contacto utilizado con Stratos (número de WhatsApp, correo electrónico o formulario).</li>
            <li>Descripción clara del derecho que desea ejercer.</li>
            <li>Documentación que acredite su identidad (copia de identificación oficial vigente).</li>
          </ul>
        </div>
        <p style={{ marginTop: 12 }}>
          Plazo de respuesta: 20 días hábiles bajo la LFPDPPP (México) y hasta 30 días bajo el GDPR. El ejercicio
          de cualquiera de estos derechos es <strong>gratuito</strong> para el titular, salvo gastos razonables
          de envío justificados y documentados.
        </p>
        <p>
          Adicionalmente, usted puede darse de baja de las comunicaciones comerciales en cualquier momento
          enviándonos las palabras <strong>BAJA</strong>, <strong>STOP</strong> o <strong>CANCELAR</strong>
          por WhatsApp, o bloqueando nuestro número directamente desde la aplicación.
        </p>
      </section>

      <section id="s14">
        <h2>14. Cookies y tecnologías similares</h2>
        <p>
          Nuestro sitio web puede utilizar cookies y tecnologías similares (almacenamiento local, píxeles) para
          ofrecer una experiencia funcional, medir el desempeño y, sujeto a su consentimiento, optimizar campañas
          publicitarias.
        </p>
        <ul>
          <li><strong>Cookies estrictamente necesarias:</strong> permiten el funcionamiento básico del sitio. No requieren consentimiento.</li>
          <li><strong>Cookies de análisis:</strong> nos ayudan a entender de forma agregada cómo se usa el sitio. Requieren su consentimiento.</li>
          <li><strong>Cookies de marketing (Meta Pixel):</strong> permiten medir conversiones y mostrar publicidad personalizada en plataformas de Meta. Requieren su consentimiento.</li>
        </ul>
        <p>
          Cuando visite nuestro sitio web, podrá aceptar, rechazar o personalizar el uso de cookies a través del
          banner de consentimiento. Su decisión se podrá modificar en cualquier momento desde la sección de
          preferencias del propio sitio.
        </p>
      </section>

      <section id="s15">
        <h2>15. Menores de edad</h2>
        <p>
          Los servicios de Stratos están dirigidos a personas mayores de edad con capacidad legal para contratar
          servicios inmobiliarios o de inversión. No solicitamos ni tratamos de manera consciente datos personales
          de menores de 18 años.
        </p>
        <p>
          Si usted es padre, madre o tutor y considera que un menor bajo su responsabilidad nos ha proporcionado
          datos personales, le rogamos contactarnos al correo indicado en la sección 17 para proceder a su
          eliminación inmediata.
        </p>
      </section>

      <section id="s16">
        <h2>16. Cambios a esta política</h2>
        <p>
          Stratos podrá actualizar esta Política de Privacidad para reflejar cambios en nuestras prácticas, en
          la legislación aplicable o en las plataformas que utilizamos (en particular, las de Meta). Cuando
          realicemos modificaciones sustanciales, publicaremos la versión actualizada en esta misma URL y
          ajustaremos la fecha indicada en el encabezado.
        </p>
        <p>
          Le recomendamos revisar esta página periódicamente. El uso continuado de nuestros servicios después
          de la publicación de cambios implica la aceptación de la versión vigente.
        </p>
      </section>

      <section id="s17">
        <h2>17. Contacto</h2>
        <p>
          Para cualquier consulta relacionada con esta Política de Privacidad o con el tratamiento de sus datos
          personales, puede contactar al responsable de privacidad de Stratos en cualquiera de los siguientes correos:
        </p>
        <div className="pp-card" style={{ marginTop: 12 }}>
          <p>
            <Mail size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: P.accent }} />
            <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a>{" "}
            <span style={{ color: P.txt2, fontSize: 13 }}>(principal)</span>
          </p>
          <p style={{ marginTop: 6 }}>
            <Mail size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: P.accent }} />
            <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a>
          </p>
          <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
            Stratos Capital Group · <a href="https://stratoscapitalgroup.com">stratoscapitalgroup.com</a>
          </p>
        </div>
      </section>
    </>
  ),
};

/* ═══════════════════════════════════
   CONTENIDO — EN
   ═══════════════════════════════════ */
const EN = {
  meta: {
    title: "Privacy Policy — Stratos Capital Group",
    description:
      "Privacy Policy of Stratos Capital Group covering WhatsApp Business Cloud API, Meta Lead Ads and customer service. Compliant with GDPR, CCPA/CPRA and Mexico's LFPDPPP.",
  },
  ui: {
    back: "Back to home",
    title: "Privacy Policy",
    subtitle:
      "How Stratos Capital Group collects, uses, protects and shares the personal information of people who interact with us through WhatsApp, Meta Ads and our digital channels.",
    version: "Version 1.0",
    updated: "Last updated: April 30, 2026",
    tocLabel: "Contents",
    toc: [
      ["1", "Identification of the controller"],
      ["2", "Acceptance of this policy"],
      ["3", "Personal data we collect"],
      ["4", "How we collect data"],
      ["5", "Purposes of processing"],
      ["6", "Legal basis for processing"],
      ["7", "Use of artificial intelligence"],
      ["8", "Sharing data with third parties"],
      ["9", "International data transfers"],
      ["10", "Data retention"],
      ["11", "Information security"],
      ["12", "Rights of the data subject"],
      ["13", "How to exercise your rights"],
      ["14", "Cookies and similar technologies"],
      ["15", "Minors"],
      ["16", "Changes to this policy"],
      ["17", "Contact"],
    ],
  },
  body: () => (
    <>
      <section id="s1">
        <h2>1. Identification of the controller</h2>
        <p>
          This Privacy Policy governs the processing of personal data collected by
          <strong> Stratos Capital Group</strong> (hereinafter, <em>"Stratos"</em>, <em>"we"</em> or <em>"the company"</em>),
          through its website <a href="https://stratoscapitalgroup.com">stratoscapitalgroup.com</a>, its WhatsApp
          Business numbers, and the lead-generation forms published on Meta platforms (Facebook and Instagram).
        </p>
        <ul>
          <li><strong>Trade name:</strong> Stratos Capital Group</li>
          <li><strong>Website:</strong> <a href="https://stratoscapitalgroup.com">https://stratoscapitalgroup.com</a></li>
          <li><strong>Privacy email:</strong> <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a> (primary) · <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a></li>
          <li><strong>Sector:</strong> Real estate services and asset investment</li>
        </ul>
        <p>
          Stratos acts as <strong>data controller</strong> for the personal data collected through the channels
          described in this document. In delivering its services, Stratos also relies on
          <strong> data processors</strong> identified in Section 8 of this policy.
        </p>
      </section>

      <section id="s2">
        <h2>2. Acceptance of this policy</h2>
        <p>
          By initiating a conversation with Stratos through WhatsApp, completing a Meta Lead Ads form, contacting
          us by email, or browsing our website, you confirm that you have read, understood and accepted this
          Privacy Policy. If you do not agree with any of these terms, please refrain from providing personal
          information and from continuing to use our communication channels.
        </p>
        <p>
          This policy applies specifically to the ecosystem operated by Stratos, which includes — among others — the
          use of the <strong>WhatsApp Business Cloud API</strong>, the <strong>Meta Marketing API</strong>{" "}
          (including Lead Ads) and the <strong>Chatwoot</strong> conversation management platform hosted on
          our own servers.
        </p>
      </section>

      <section id="s3">
        <h2>3. Personal data we collect</h2>
        <p>
          We collect only the personal data strictly necessary to provide an adequate service. Below we describe
          the specific categories of information we process.
        </p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.1 Through the WhatsApp Business Cloud API</h3>
        <ul>
          <li>Phone number associated with your WhatsApp account.</li>
          <li>Profile name you have publicly configured in WhatsApp.</li>
          <li>Content of the messages you send: text, images, audio files, documents and, if you choose to share it, your geographic location.</li>
          <li>Metadata associated with messages: date and time of sending, delivery and read status, and device time zone where exposed by the platform.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.2 Through Meta Lead Ads</h3>
        <ul>
          <li>Full name provided in the form.</li>
          <li>Email address.</li>
          <li>Phone number.</li>
          <li>Answers to custom questions in the ad form (e.g.: type of property of interest, city, estimated budget, purchase timeframe).</li>
          <li>Technical identifiers provided by Meta that allow the lead to be linked to its source ad.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.3 Through commercial interaction</h3>
        <ul>
          <li>Complete history of conversations held with Stratos advisors.</li>
          <li>Internal notes that advisors and AI systems generate about the progress of your inquiry.</li>
          <li>Behavioral and interest data (funnel stages, properties consulted, scheduled appointments, completed visits).</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>3.4 Data we do NOT collect</h3>
        <p>
          Stratos expressly does <strong>not</strong> request or store the following categories of data through
          WhatsApp or Meta Lead Ads forms:
        </p>
        <ul>
          <li>Passwords for third-party accounts.</li>
          <li>Full banking data (card number, CVV, online-banking credentials).</li>
          <li>Biometric data.</li>
          <li>Sensitive health data.</li>
          <li>Personal data of minors (see Section 15).</li>
        </ul>
      </section>

      <section id="s4">
        <h2>4. How we collect data</h2>
        <p>We collect your personal data through the following channels:</p>
        <ul>
          <li><strong>Conversations initiated by you</strong> on one of our numbers registered in the WhatsApp Business Cloud API.</li>
          <li><strong>Click on Meta ads</strong> with a "Send Message" button, which opens a pre-filled WhatsApp conversation.</li>
          <li><strong>Meta Lead Ads forms</strong> that you voluntarily complete within Facebook or Instagram.</li>
          <li><strong>Email communications</strong> directed to Stratos mailboxes.</li>
          <li><strong>Browsing on our website</strong> through cookies and similar technologies (see Section 14).</li>
        </ul>
        <p>
          In every case, the first communication is initiated by you or explicitly authorized by you when filling
          out a Meta form. Stratos does not send proactive WhatsApp messages to people who have not previously
          contacted us or who have not provided written consent.
        </p>
      </section>

      <section id="s5">
        <h2>5. Purposes of processing</h2>
        <h3 style={{ marginTop: 8, fontSize: 17 }}>5.1 Primary purposes</h3>
        <p>These purposes are essential to provide the service you have requested:</p>
        <ul>
          <li>Answer your inquiries through WhatsApp in a reasonable timeframe.</li>
          <li>Provide personalized follow-up on your interest in real estate properties.</li>
          <li>Coordinate visits, virtual tours and advisory meetings.</li>
          <li>Share information about properties, prices, availability and commercial conditions.</li>
          <li>Process and prioritize leads generated by Meta ads to respond as promptly as possible.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>5.2 Secondary purposes</h3>
        <p>
          The following purposes are based on Stratos's legitimate interest and, where required by law, on the
          consent of the data subject. You may object to these purposes at any time:
        </p>
        <ul>
          <li>Improve customer service quality and internal sales-team training.</li>
          <li>Perform aggregated statistical analysis on conversions and commercial performance.</li>
          <li>Comply with applicable legal, tax and accounting obligations.</li>
          <li>Prevent fraud, platform abuse and activities contrary to Meta's policies.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>5.3 Expressly excluded purposes</h3>
        <p>Stratos will <strong>not</strong> use your personal data to:</p>
        <ul>
          <li>Sell, rent or transfer them to third parties for marketing unrelated to the service.</li>
          <li>Advertise products or services from third parties unrelated to Stratos.</li>
          <li>Make automated decisions producing significant legal effects on you without the possibility of human review.</li>
        </ul>
      </section>

      <section id="s6">
        <h2>6. Legal basis for processing</h2>
        <p>
          Depending on the country of residence of the data subject, the legal bases that legitimize the
          processing of your personal data by Stratos are the following:
        </p>
        <ul>
          <li><strong>Consent:</strong> by initiating the conversation or completing a form, you grant explicit consent for Stratos to process your data for the primary purposes described.</li>
          <li><strong>Performance of a service:</strong> processing is necessary to respond to you, schedule visits and provide the requested real estate advisory.</li>
          <li><strong>Legitimate interest:</strong> for aggregated analytics, service improvement and fraud prevention, in strict proportionality to your rights.</li>
          <li><strong>Legal obligation:</strong> retention of records and receipts of fiscal relevance, in accordance with applicable legislation.</li>
        </ul>
      </section>

      <section id="s7">
        <h2>7. Use of artificial intelligence</h2>
        <p>
          In compliance with the <strong>AI-Assisted Business Messaging Guidelines</strong> published by Meta and
          effective from January 15, 2026, we transparently disclose our use of artificial intelligence systems
          in our WhatsApp conversations.
        </p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.1 AI systems specific to business tasks</h3>
        <p>Stratos uses artificial intelligence only for structured and bounded tasks:</p>
        <ul>
          <li>Automatic classification of incoming messages by intent (general inquiry, schedule visit, after-sales, etc.).</li>
          <li>Routing of conversations to the most suitable human advisor based on geography, language and availability.</li>
          <li>Internal response suggestions to assist human agents, which are reviewed by a person before being sent in any critical interaction.</li>
          <li>Operational follow-up within the CRM (reminders, stage tagging, prioritization of pending tasks).</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.2 What our AI is NOT</h3>
        <ul>
          <li>It is not a general-purpose conversational chatbot.</li>
          <li>It does not replace the human advisor in relevant commercial decisions.</li>
          <li>It does not generate financial or investment recommendations without human supervision.</li>
          <li>It does not use your messages to train third-party artificial intelligence models.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>7.3 Access to a human agent</h3>
        <p>
          You always have the right to speak to a person. To do so, simply type
          <strong> "human"</strong>, <strong>"agent"</strong> or <strong>"person"</strong> in any conversation,
          and the request will be immediately routed to a human advisor. This option is available 24 hours a day,
          subject to reasonable response times within service hours.
        </p>
      </section>

      <section id="s8">
        <h2>8. Sharing data with third parties</h2>
        <p>
          To deliver our service, Stratos shares personal data with a limited number of technology providers
          acting as <strong>data processors</strong> under contracts that require them to maintain protection
          levels equivalent to those of this policy.
        </p>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Meta Platforms, Inc.</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Role:</strong> provider of the WhatsApp Business Cloud API and the Meta Marketing API.<br />
            <strong>Data shared:</strong> message content, phone number, profile name, delivery metadata and
            answers to Lead Ads forms.<br />
            <strong>Retention by Meta:</strong> up to 30 days on its servers, in accordance with the official
            documentation of the WhatsApp Business Cloud API.<br />
            <strong>Contractual framework:</strong> WhatsApp Business Terms and Meta for Developers policies.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Chatwoot (self-hosted)</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Role:</strong> omnichannel conversation management platform where advisors reply to messages.<br />
            <strong>Data stored:</strong> copy of conversations, contact data, CRM stages and internal notes.<br />
            <strong>Location:</strong> servers controlled directly by Stratos.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>n8n (workflow orchestration)</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Role:</strong> internal automation of tasks (notifications, integrations between systems, specific AI logic).<br />
            <strong>Data processed:</strong> only what is needed to execute each flow (e.g., phone number, lead stage).<br />
            <strong>Location:</strong> own infrastructure under Stratos's control.
          </p>
        </div>

        <div className="pp-card" style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 17 }}>Infrastructure providers</h3>
          <p style={{ marginTop: 6 }}>
            <strong>Role:</strong> hosting, backups, monitoring and technical operation of the CRM.<br />
            <strong>Contractual framework:</strong> data processing agreements (DPA) with confidentiality clauses
            and security obligations.
          </p>
        </div>

        <p style={{ marginTop: 12 }}>
          <strong>Stratos does not sell or rent your personal data under any circumstances.</strong> Any sharing
          beyond what is described in this section will only occur when there is a legal obligation or order
          from a competent authority requiring it.
        </p>
      </section>

      <section id="s9">
        <h2>9. International data transfers</h2>
        <p>
          Some of the providers we work with — particularly Meta Platforms, Inc. — may process personal data on
          infrastructure located outside the data subject's country of residence, including servers in the United
          States and other jurisdictions. These transfers take place under valid legal mechanisms: Standard
          Contractual Clauses, adequacy decisions or explicit consent from the data subject, as applicable.
        </p>
        <p>
          Stratos requires its providers to apply technical and organizational measures equivalent to those of
          their jurisdiction of origin, so that the level of protection of your data is not diminished by the
          transfer.
        </p>
      </section>

      <section id="s10">
        <h2>10. Data retention</h2>
        <p>We retain your personal data only for the time necessary to fulfill the purposes described:</p>
        <ul>
          <li><strong>WhatsApp messages on Meta servers:</strong> up to 30 days, in accordance with the WhatsApp Business Cloud API policy.</li>
          <li><strong>Data in the Chatwoot CRM:</strong> for the entire active commercial relationship and up to 24 additional months after the last interaction, unless you request earlier deletion.</li>
          <li><strong>Data of fiscal or accounting relevance:</strong> 5 years from the operation, by legal mandate in Mexico and analogous timeframes in other applicable jurisdictions.</li>
          <li><strong>Internal notes and operational records:</strong> same timeframes as the CRM, unless an explicit deletion request is made.</li>
        </ul>
        <p>
          Once these timeframes have expired, the data is irreversibly deleted or anonymized, unless there is a
          legal obligation requiring its additional retention.
        </p>
      </section>

      <section id="s11">
        <h2>11. Information security</h2>
        <p>
          Stratos applies reasonable technical and organizational measures to protect your data against
          unauthorized access, alteration, disclosure or destruction. Among others:
        </p>
        <ul>
          <li>WhatsApp end-to-end encryption (Signal protocol) during message transport.</li>
          <li>Restricted access to the CRM via personal credentials and two-factor authentication for privileged users.</li>
          <li>Granular roles and permissions: each advisor accesses only the information needed for their role.</li>
          <li>Servers with regular security updates and continuous monitoring.</li>
          <li>Confidentiality agreements signed by all personnel with access to personal data.</li>
          <li>Encrypted backups and documented incident-response procedures.</li>
        </ul>
        <p>
          Despite these measures, no system is absolutely invulnerable. If we detect a security incident
          affecting your personal data, Stratos commits to notifying you and the competent authorities within
          the timeframes required by applicable law.
        </p>
      </section>

      <section id="s12">
        <h2>12. Rights of the data subject</h2>
        <p>Depending on your country of residence, you have the following rights:</p>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.1 Under the General Data Protection Regulation (GDPR — European Union)</h3>
        <ul>
          <li>Right of access to your personal data.</li>
          <li>Right of rectification of inaccurate data.</li>
          <li>Right of erasure ("right to be forgotten").</li>
          <li>Right to restriction of processing.</li>
          <li>Right to data portability.</li>
          <li>Right to object to processing based on legitimate interest.</li>
          <li>Right not to be subject to automated individual decisions with significant legal effects.</li>
          <li>Right to file a complaint with the competent supervisory authority.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.2 Under CCPA / CPRA (California, United States)</h3>
        <ul>
          <li>Right to know what personal data is collected and how it is used.</li>
          <li>Right to request the deletion of your personal data.</li>
          <li>Right to opt out of the "sale" or "sharing" of personal data (Stratos does not sell personal data).</li>
          <li>Right to non-discrimination for exercising any of the above rights.</li>
          <li>Right to correct inaccurate personal information.</li>
        </ul>

        <h3 style={{ marginTop: 16, fontSize: 17 }}>12.3 Under LFPDPPP (Mexico) — ARCO Rights</h3>
        <ul>
          <li><strong>Access:</strong> know what personal data we hold about you and the details of its processing.</li>
          <li><strong>Rectification:</strong> request the correction of inaccurate or incomplete data.</li>
          <li><strong>Cancellation:</strong> request the deletion of your data when it is no longer necessary.</li>
          <li><strong>Opposition:</strong> object to the use of your data for specific purposes.</li>
        </ul>
      </section>

      <section id="s13">
        <h2>13. How to exercise your rights</h2>
        <p>To exercise any of the rights described in the previous section, contact us by email:</p>
        <div className="pp-card" style={{ marginTop: 12 }}>
          <p>
            <strong>Primary email:</strong> <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a><br />
            <strong>Alternate email:</strong> <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a><br />
            <strong>Suggested subject:</strong> "Personal data rights request"
          </p>
          <p style={{ marginTop: 8 }}>To process your request, we will need the following:</p>
          <ul>
            <li>Full name of the data subject.</li>
            <li>Means of contact used with Stratos (WhatsApp number, email or form).</li>
            <li>Clear description of the right you wish to exercise.</li>
            <li>Documentation proving your identity (copy of valid official ID).</li>
          </ul>
        </div>
        <p style={{ marginTop: 12 }}>
          Response time: 20 business days under LFPDPPP (Mexico) and up to 30 days under GDPR. Exercising any
          of these rights is <strong>free of charge</strong> for the data subject, except for reasonable shipping
          costs that are duly justified and documented.
        </p>
        <p>
          Additionally, you may unsubscribe from commercial communications at any time by sending us the words
          <strong> UNSUBSCRIBE</strong>, <strong>STOP</strong> or <strong>CANCEL</strong> by WhatsApp, or by
          blocking our number directly from the application.
        </p>
      </section>

      <section id="s14">
        <h2>14. Cookies and similar technologies</h2>
        <p>
          Our website may use cookies and similar technologies (local storage, pixels) to provide a functional
          experience, measure performance and, subject to your consent, optimize advertising campaigns.
        </p>
        <ul>
          <li><strong>Strictly necessary cookies:</strong> enable basic site functionality. Do not require consent.</li>
          <li><strong>Analytics cookies:</strong> help us understand in aggregate how the site is used. Require your consent.</li>
          <li><strong>Marketing cookies (Meta Pixel):</strong> allow us to measure conversions and display personalized advertising on Meta platforms. Require your consent.</li>
        </ul>
        <p>
          When you visit our website, you can accept, reject or customize cookie use through the consent banner.
          Your decision can be modified at any time from the preferences section of the site itself.
        </p>
      </section>

      <section id="s15">
        <h2>15. Minors</h2>
        <p>
          Stratos services are aimed at adults with legal capacity to contract real estate or investment services.
          We do not knowingly request or process personal data from people under 18 years of age.
        </p>
        <p>
          If you are a parent or guardian and believe that a minor under your responsibility has provided us with
          personal data, please contact us at the email indicated in Section 17 to proceed with its immediate
          deletion.
        </p>
      </section>

      <section id="s16">
        <h2>16. Changes to this policy</h2>
        <p>
          Stratos may update this Privacy Policy to reflect changes in our practices, in applicable legislation
          or in the platforms we use (in particular, those of Meta). When we make substantial modifications, we
          will publish the updated version at this same URL and adjust the date indicated in the header.
        </p>
        <p>
          We recommend reviewing this page periodically. Continued use of our services after changes are
          published implies acceptance of the current version.
        </p>
      </section>

      <section id="s17">
        <h2>17. Contact</h2>
        <p>
          For any inquiry related to this Privacy Policy or to the processing of your personal data, you can
          contact Stratos's privacy officer at any of the following emails:
        </p>
        <div className="pp-card" style={{ marginTop: 12 }}>
          <p>
            <Mail size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: P.accent }} />
            <a href="mailto:info@stratoscapitalgroup.com">info@stratoscapitalgroup.com</a>{" "}
            <span style={{ color: P.txt2, fontSize: 13 }}>(primary)</span>
          </p>
          <p style={{ marginTop: 6 }}>
            <Mail size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: P.accent }} />
            <a href="mailto:duke_realtor@icloud.com">duke_realtor@icloud.com</a>
          </p>
          <p style={{ marginTop: 8, color: P.txt2, fontSize: 14 }}>
            Stratos Capital Group · <a href="https://stratoscapitalgroup.com">stratoscapitalgroup.com</a>
          </p>
        </div>
      </section>
    </>
  ),
};

/* ═══════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════ */
export default function PrivacyPolicy() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/politica-de-privacidad";
  const initialLang = path.startsWith("/privacy-policy") ? "en" : "es";
  const [lang, setLang] = useState(initialLang);
  const [activeId, setActiveId] = useState("s1");

  const content = lang === "en" ? EN : ES;

  // Set document title and meta tags
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

  // Scroll spy
  useEffect(() => {
    const ids = content.ui.toc.map(([n]) => `s${n}`);
    const handler = () => {
      const scrollY = window.scrollY + 120;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) current = id;
      }
      setActiveId(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [content.ui.toc]);

  const handleLangSwitch = (newLang) => {
    setLang(newLang);
    const newPath = newLang === "en" ? "/privacy-policy" : "/politica-de-privacidad";
    if (window.history && window.location.pathname !== newPath) {
      window.history.replaceState(null, "", newPath);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const Body = content.body;

  return (
    <div className="pp-wrap">
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
            maxWidth: 1200,
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
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 48px" }}>
          <span className="pp-pill">
            <ShieldCheck size={12} />
            {content.ui.version}
          </span>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
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
              maxWidth: 760,
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
      <div className="pp-grid">
        <aside className="pp-toc">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: P.txt3,
              padding: "0 12px 10px",
            }}
          >
            {content.ui.tocLabel}
          </div>
          <nav>
            {content.ui.toc.map(([n, label]) => (
              <a
                key={n}
                href={`#s${n}`}
                className={`toc-link ${activeId === `s${n}` ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(`s${n}`);
                  if (el) {
                    window.scrollTo({ top: el.offsetTop - 88, behavior: "smooth" });
                  }
                }}
              >
                <span style={{ display: "inline-block", width: 22, color: P.txt3 }}>{n}.</span>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main>
          <Body />
        </main>
      </div>

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
            maxWidth: 1200,
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
            © {new Date().getFullYear()} Stratos Capital Group. {content.ui.version} · {content.ui.updated}
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
              href="mailto:duke_realtor@icloud.com"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Mail size={14} />
              duke_realtor@icloud.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
