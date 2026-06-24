/**
 * app/data/comercialDocs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual de operación comercial NSG — documentos internos (procesos / SOP).
 * Generado desde el Manual-NSG. Cada doc usa Markdown simple que renderiza
 * <Markdown/> en DocsTab.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const DOC_CATEGORIES = [
  "Empieza aquí",
  "Conseguir y cerrar clientes",
  "Entregar el sistema",
  "Cómo trabajamos por dentro",
];

export const COMERCIAL_DOCS = [
  {
    id: "00_Empieza-Aqui",
    title: "Empieza aquí",
    emoji: "🚀",
    category: "Empieza aquí",
    subtitle: "Qué es NSG, las reglas de oro y los precios",
    md: `# Manual de Operación NSG — Empieza aquí

**Versión 1 · 23 de junio de 2026 · Dueño del manual: Iván Rodríguez**

Este manual explica, paso a paso, **cómo trabajamos en NSG**. Está escrito sencillo, sin palabras técnicas ni siglas, para que cualquier persona del equipo lo entienda y lo aplique igual. Si todos seguimos estos procesos, el cliente recibe siempre la misma calidad, sin importar quién lo atienda.

---

## ¿Qué hace NSG? (esto lo dices igual siempre)

NSG **diseña y pone a funcionar sistemas de ventas operados por inteligencia artificial.**

No somos una agencia. No vendemos "robots de chat". Construimos un sistema que **responde, ordena, da seguimiento y mide cada interesado que el cliente ya consiguió**, para que su equipo solo se dedique a cerrar.

**La frase con la que abrimos toda conversación:**
> "El problema casi nunca es conseguir interesados. El problema es lo que pasa después: el dinero que se escapa por no atender bien a esos interesados."

A ese dinero que se escapa lo llamamos **la fuga de ventas**.

**Cómo entra un cliente, siempre igual:**
1. Le damos un **diagnóstico gratuito** (le mostramos dónde se le escapa el dinero).
2. Le recomendamos **una sola opción**, la correcta para él (no un menú).
3. Lo **ponemos en marcha** con avances que se pueden comprobar.
4. **Medimos y mejoramos** mes a mes.

---

## Las 6 reglas de oro de cómo hablamos (NO se rompen nunca)

Aplican a todo: la página web, las propuestas, los correos, WhatsApp y cualquier conversación.

1. **El caso de Duke del Caribe se dice SIEMPRE así:** *"más de 40 millones de dólares en 3 años"*. Nunca digas otra cantidad ni otro plazo.
2. **Separa siempre tres cosas distintas:**
   - **La experiencia** es de Duke del Caribe.
   - **La construcción del sistema** la hace NSG.
   - **El resultado en ventas** es del cliente, porque depende de su operación.
3. **Nunca prometas ventas, ni cuánto va a ganar, ni "recuperación de dinero" gracias a NSG o a la inteligencia artificial.** Las ventas las cierra el cliente.
4. **La garantía es solo técnica:** garantizamos que el sistema queda funcionando, nunca un resultado de ventas.
5. **No se mencionan metas internas** de NSG (cuánto queremos facturar o cuántos clientes queremos) en nada que vea el cliente.
6. **Nunca digas "agencia" ni "chatbot".** Di siempre: *"sistema de ventas operado por inteligencia artificial"*.

> Si un material rompe una de estas reglas, **se detiene y se corrige antes de enviarlo.** (Ver proceso 14.)

---

## Las opciones que ofrecemos (precios de referencia)

Se recomienda **una sola** según el tamaño de la fuga del cliente:

| Opción | Para qué es | Tiempo | Precio (dólares) |
|---|---|---|---|
| **Primera Victoria** | Arreglar UNA fuga concreta, medida con un solo número | 21 a 30 días | 3,000 a 5,000 |
| **Stratos AI completo** | El sistema de ventas completo funcionando | Por proyecto | 12,000 a 25,000 |
| **Departamento de Inteligencia Artificial** | Instalar esa capacidad dentro de la empresa del cliente | Por proyecto | 30,000 a 70,000 |

---

## Cómo está organizado este manual

**Parte 1 — Conseguir y cerrar clientes**
- [01 · Atraer interesados](01_Atraer-Interesados.md)
- [02 · Diagnóstico gratuito](02_Diagnostico-Gratuito.md)
- [03 · Ver si encaja](03_Ver-Si-Encaja.md)
- [04 · Propuesta y cierre](04_Propuesta-y-Cierre.md)
- [05 · Programa de Socios](05_Programa-de-Socios.md)

**Parte 2 — Entregar el sistema**
- [06 · Bienvenida y arranque](06_Bienvenida-y-Arranque.md)
- [07 · Diseño del sistema](07_Diseno-del-Sistema.md)
- [08 · Puesta en marcha](08_Puesta-en-Marcha.md)
- [09 · Capacitación y que lo usen](09_Capacitacion-y-Uso.md)
- [10 · Medición y mejora](10_Medicion-y-Mejora.md)
- [11 · Soporte y garantía](11_Soporte-y-Garantia.md)

**Parte 3 — Cómo trabajamos por dentro**
- [12 · Quién hace qué y con qué herramientas](12_Quien-Hace-Que.md)
- [13 · Cuidado de los datos y seguridad](13_Cuidado-de-Datos.md)
- [14 · Cómo hablamos (reglas de mensaje)](14_Como-Hablamos.md)

---

## Cómo usar cada proceso

Todos los procesos tienen la misma forma, para que sean fáciles de seguir:

- **Para qué sirve** · **Cuándo empieza** · **Quién lo hace** · **Qué necesitas a la mano** · **Paso a paso** · **Qué entregas al final** · **Cómo sabes que salió bien** · **Lo que NUNCA debes hacer** · **Plantilla lista para copiar**.

Antes de cualquier cosa que vea el cliente, repasa las **6 reglas de oro** de arriba.

**Dato de contacto del diagnóstico (WhatsApp):** 529842803001.`,
  },
  {
    id: "01_Atraer-Interesados",
    title: "Atraer interesados",
    emoji: "🧲",
    category: "Conseguir y cerrar clientes",
    subtitle: "Cómo llegan los prospectos",
    md: `# Proceso 01 — Atraer interesados

**Para qué sirve:** lograr que dueños de negocio (sobre todo inmobiliarias) pidan el **diagnóstico gratuito**. Esa es la única puerta de entrada a NSG.

**Cuándo empieza:** todos los días. Es una actividad constante, no una campaña de una sola vez.

**Quién lo hace:** Iván, con apoyo de quien lleve marketing y redes.

**Qué necesitas a la mano:**
- La página web con el diagnóstico funcionando.
- El WhatsApp de contacto: 529842803001.
- El lugar donde anotamos a cada interesado (la lista o sistema de clientes).

---

## Paso a paso

1. **Publica contenido con un solo mensaje:** "no te falta gente interesada, te falta atender bien a la que ya tienes". Muestra ejemplos de fuga de ventas (respuestas lentas, falta de seguimiento).
2. **Cierra siempre con la misma invitación:** *"Encuentra tu fuga de ventas"* y manda a la persona al diagnóstico gratuito (página web o WhatsApp).
3. **Responde rápido** a quien escriba: el mismo día, idealmente en menos de 1 hora.
4. **Anota a cada interesado** apenas aparece: nombre, empresa, por dónde llegó y qué necesita.
5. **Agenda el diagnóstico** o pásalo a hacer el diagnóstico desde la web (Proceso 02).

---

## Qué entregas al final
- Una cita de diagnóstico agendada, **o**
- Un interesado anotado con su dato de contacto listo para dar seguimiento.

## Cómo sabes que salió bien
- Hay nuevos interesados cada semana.
- Respondiste a todos el mismo día.
- Ninguno se quedó sin anotar.

## Lo que NUNCA debes hacer
- Prometer ventas o ganancias para atraer gente (rompe las reglas de oro).
- Decir "agencia" o "chatbot".
- Dejar a un interesado sin respuesta más de un día.

---

## Plantilla — mensaje para atraer
\`\`\`
La mayoría de los negocios no necesita más gente interesada.
Necesita dejar de perder a la que ya tiene: respuestas lentas,
sin seguimiento, sin orden.

A eso le llamamos la fuga de ventas. Te muestro dónde está la tuya,
gratis y sin compromiso.

Escríbeme "FUGA" y empezamos.
\`\`\``,
  },
  {
    id: "02_Diagnostico-Gratuito",
    title: "Diagnóstico gratuito",
    emoji: "🔍",
    category: "Conseguir y cerrar clientes",
    subtitle: "La puerta de entrada",
    md: `# Proceso 02 — Diagnóstico gratuito (la puerta de entrada)

**Para qué sirve:** mostrarle a cada interesado, de forma clara, **dónde se le escapa el dinero**, qué tan grande es esa fuga, qué arreglar primero, qué sistema le conviene y qué números vamos a vigilar. Es lo más importante que hace NSG para vender. La persona se va con un plan, decida o no avanzar.

**Cuándo empieza:** cuando alguien agenda el diagnóstico (Proceso 01) o lo llena en la página web.

**Quién lo hace:** Iván. Ángel apoya solo si hay dudas de si algo es posible técnicamente.

**Tiempo máximo de respuesta:** entregar el plan en **menos de 24 horas hábiles** después de la sesión.

---

## Qué necesitas a la mano (las 4 respuestas del cliente)
1. **Cuántos interesados nuevos recibe al mes.**
2. **Cuánto tarda en dar la primera respuesta** (minutos, horas, a veces no responde).
3. **Si da seguimiento ordenado** (sí / a medias / no).
4. **Cuánto vale en promedio una venta suya** (en dólares).

---

## Paso a paso

1. **Revisa las 4 respuestas.** Si llegó por la web, escríbele por WhatsApp (529842803001) para confirmar los datos.
2. **Calcula la fuga estimada** con la fórmula de abajo. Exprésala en dólares por mes y por año.
3. **Encuentra el primer punto a corregir** entre estos cuatro: respuesta lenta · no califica a los interesados · seguimiento desordenado · no tiene visibilidad de nada.
4. **Recomienda UNA sola opción** (Primera Victoria, Stratos AI completo o Departamento de Inteligencia Artificial), según el tamaño de la fuga. No des un menú.
5. **Define 2 o 3 números a vigilar** (por ejemplo: tiempo de respuesta, porcentaje de interesados atendidos, cuántos avanzan a cita).
6. **Entrega el plan de una página** por WhatsApp o correo, dentro de las 24 horas.
7. **Anota todo** en la lista de clientes: fuga estimada, opción sugerida, número principal a vigilar y el siguiente paso. Pasa al Proceso 04.

---

## Cómo calcular la fuga (siempre como estimación)

> **Fuga al mes ≈ interesados al mes × valor promedio de una venta × parte que hoy se pierde.**

La "parte que se pierde" se deduce de las respuestas: si responde en más de 2 horas (o a veces no responde) y no da seguimiento, la pérdida es alta.

**Preséntala siempre como una estimación, nunca como una promesa de recuperar ese dinero.**

---

## Qué entregas al final
- **Un plan de una sola página** con: fuga estimada · qué corregir primero · sistema recomendado · números a vigilar · siguiente paso.

## Cómo sabes que salió bien
- Lo entregaste en menos de 24 horas.
- La persona entendió su fuga y cuál es el siguiente paso.
- Quedó todo anotado en la lista de clientes.

## Lo que NUNCA debes hacer
- Prometer que va a recuperar ventas o ganar X dinero. Solo "fuga estimada" y "qué corrige el sistema".
- Recomendar más de una opción.
- Pasar de 24 horas sin entregar el plan.

---

## Plantilla — Plan de diagnóstico (una página)
\`\`\`
DIAGNÓSTICO DE VENTAS — [Nombre de la empresa]

Fuga estimada: alrededor de [X] dólares al mes (cerca de [Y] al año) *es una estimación

Qué corregir primero: [respuesta lenta / calificar interesados / seguimiento / visibilidad]

Sistema recomendado: [Primera Victoria / Stratos AI completo / Departamento de IA]

Números que vamos a vigilar: [3 números]

Siguiente paso: [reunión de propuesta — fecha]
\`\`\``,
  },
  {
    id: "03_Ver-Si-Encaja",
    title: "Ver si encaja",
    emoji: "✅",
    category: "Conseguir y cerrar clientes",
    subtitle: "A quién sí y a quién no",
    md: `# Proceso 03 — Ver si el cliente encaja

**Para qué sirve:** decidir, con criterios claros, **si vale la pena trabajar con ese cliente** o no. Trabajar con quien no encaja cuesta tiempo, dinero y reputación.

**Cuándo empieza:** justo después del diagnóstico (Proceso 02), antes de hacer la propuesta.

**Quién lo hace:** Iván.

---

## Qué necesitas a la mano
- El plan de diagnóstico ya hecho.
- Una idea clara de cómo es el cliente: actitud, urgencia y capacidad de pagar.

---

## Paso a paso

Revisa estas 5 señales. Cada una vale **sí** o **no**:

1. **Tiene fuga real y la reconoce.** Aceptó que está perdiendo interesados.
2. **Recibe suficientes interesados.** Si casi no le llega gente, primero necesita otra cosa, no a nosotros.
3. **Puede pagar la opción recomendada** sin que sea un problema grave.
4. **Hay alguien que va a usar el sistema** dentro de su empresa (no va a quedar abandonado).
5. **Es una persona con la que se puede trabajar** (responde, respeta acuerdos, no es conflictiva).

**Cómo decidir:**
- **4 o 5 "sí"** → encaja. Avanza a la propuesta (Proceso 04).
- **3 "sí"** → encaja con cuidado. Aclara primero lo que falte.
- **2 o menos "sí"** → no encaja por ahora. Agradece, deja la puerta abierta y anótalo para más adelante.

---

## Qué entregas al final
- Una decisión clara anotada en la lista de clientes: **avanza**, **avanza con cuidado** o **no por ahora**.

## Cómo sabes que salió bien
- No avanzaste con nadie que claramente no encaja.
- Cada decisión quedó anotada con su razón.

## Lo que NUNCA debes hacer
- Cerrar a alguien solo porque quiere pagar, aunque no encaje. Daña los resultados y la reputación.
- Avanzar sin que exista una persona que vaya a usar el sistema.

---

## Plantilla — Decisión de encaje
\`\`\`
ENCAJE — [Empresa]
1. Tiene fuga y la reconoce: [sí/no]
2. Recibe suficientes interesados: [sí/no]
3. Puede pagar la opción: [sí/no]
4. Hay quién use el sistema: [sí/no]
5. Es fácil trabajar con la persona: [sí/no]

Decisión: [avanza / avanza con cuidado / no por ahora]
Razón: [una línea]
\`\`\``,
  },
  {
    id: "04_Propuesta-y-Cierre",
    title: "Propuesta y cierre",
    emoji: "🤝",
    category: "Conseguir y cerrar clientes",
    subtitle: "Convertir el diagnóstico en un sí",
    md: `# Proceso 04 — Propuesta y cierre

**Para qué sirve:** convertir el diagnóstico en un **sí**. Presentar una sola opción clara, con precio y siguientes pasos, y cobrar el anticipo para arrancar.

**Cuándo empieza:** cuando el cliente encaja (Proceso 03).

**Quién lo hace:** Iván.

---

## Qué necesitas a la mano
- El plan de diagnóstico.
- La opción recomendada y su precio.
- La forma de cobro lista (anticipo).

---

## Paso a paso

1. **Recuerda la fuga.** Empieza repitiendo cuánto dinero se le está escapando (según el diagnóstico).
2. **Presenta UNA sola opción**, la recomendada. No des un menú de opciones.
3. **Explica qué incluye, en qué tiempo y qué números vamos a vigilar.** Sé concreto sobre lo que el sistema va a hacer.
4. **Di el precio con seguridad** y qué cubre.
5. **Explica la garantía correctamente:** garantizamos que el sistema **queda funcionando**. No garantizamos ventas.
6. **Cierra con el siguiente paso:** firmar el acuerdo simple y pagar el anticipo para apartar fecha de arranque.
7. **Apenas pague**, anótalo y pásalo a Bienvenida y arranque (Proceso 06).

---

## Cómo se separan las tres cosas (dilo así)
- **La experiencia** de cerrar más de 40 millones de dólares en 3 años es de **Duke del Caribe**.
- **El sistema** lo construye e instala **NSG**.
- **El resultado en ventas** será del **cliente**, porque depende de su operación.

---

## Qué entregas al final
- Propuesta enviada (una página) + acuerdo simple + anticipo cobrado.

## Cómo sabes que salió bien
- El cliente entendió qué recibe y qué no.
- Quedó claro que la garantía es técnica, no de ventas.
- Se cobró el anticipo y hay fecha de arranque.

## Lo que NUNCA debes hacer
- Prometer ventas, ganancias o "recuperar X dinero".
- Ofrecer varias opciones a la vez.
- Arrancar el trabajo sin anticipo ni acuerdo firmado.
- Mencionar metas internas de NSG.

---

## Plantilla — Propuesta (una página)
\`\`\`
PROPUESTA — [Empresa]

Tu fuga estimada hoy: ~[X] dólares al mes.

Lo que vamos a instalar: [Primera Victoria / Stratos AI completo / Departamento de IA]
Qué incluye: [3 a 5 puntos concretos]
Tiempo: [días o etapas]
Números que vigilaremos: [2 o 3 números]

Inversión: [precio en dólares]
Garantía: el sistema queda funcionando (garantía técnica). Las ventas las cierra tu equipo.

Para arrancar: firmar el acuerdo + anticipo. Fecha de inicio: [fecha]
\`\`\``,
  },
  {
    id: "05_Programa-de-Socios",
    title: "Programa de Socios",
    emoji: "🪙",
    category: "Conseguir y cerrar clientes",
    subtitle: "Compartir riesgo con clientes clave",
    md: `# Proceso 05 — Programa de Socios

**Para qué sirve:** elegir a unos pocos clientes especiales con los que NSG **comparte el riesgo**. En lugar de cobrar todo por adelantado, NSG pone parte de su trabajo y avanza junto con el cliente por etapas comprobables. Sirve para conseguir casos de éxito fuertes al inicio.

**Cuándo empieza:** cuando un cliente que encaja muy bien podría ser un caso de éxito importante, pero conviene compartir el riesgo.

**Quién lo hace:** Iván propone; el Consejo (equipo directivo) aprueba en conjunto.

---

## Qué necesitas a la mano
- Diagnóstico y encaje muy sólidos.
- Claridad de qué pone NSG y qué pone el cliente.
- Etapas con resultados que se puedan comprobar.

---

## Paso a paso

1. **Confirma que es un buen candidato a socio:** fuga grande, mercado atractivo y disposición a colaborar de cerca.
2. **Define qué aporta cada quién.** NSG aporta parte del trabajo; el cliente aporta acceso, información y compromiso de su equipo.
3. **Divide el proyecto en etapas**, cada una con un resultado que se pueda comprobar antes de seguir.
4. **Ata los pagos a las etapas.** Se avanza solo cuando la etapa anterior se cumplió.
5. **Pon todo por escrito:** aportes, etapas, pagos y qué pasa si alguien no cumple.
6. **El Consejo aprueba** antes de firmar.
7. **Arranca** con Bienvenida (Proceso 06), marcando que es un proyecto de socio.

---

## Qué entregas al final
- Acuerdo de socio firmado, con etapas y pagos claros.

## Cómo sabes que salió bien
- Quedó claro qué pone cada quién.
- Los pagos están atados a etapas comprobables.
- El Consejo lo aprobó por escrito.

## Lo que NUNCA debes hacer
- Comprometer trabajo de NSG sin etapas claras ni forma de comprobar avances.
- Prometer un resultado de ventas a cambio de la coinversión.
- Aceptar un socio sin aprobación del Consejo.

---

## Plantilla — Acuerdo de socio
\`\`\`
PROGRAMA DE SOCIOS — [Empresa]
Aporta NSG: [qué pone]
Aporta el cliente: [qué pone]

Etapa 1: [resultado comprobable] → pago: [monto]
Etapa 2: [resultado comprobable] → pago: [monto]
Etapa 3: [resultado comprobable] → pago: [monto]

Si una etapa no se cumple: [qué pasa]
Aprobado por el Consejo: [fecha]
\`\`\``,
  },
  {
    id: "06_Bienvenida-y-Arranque",
    title: "Bienvenida y arranque",
    emoji: "👋",
    category: "Entregar el sistema",
    subtitle: "De vendido a empezar a trabajar",
    md: `# Proceso 06 — Bienvenida y arranque

**Para qué sirve:** que el cliente, apenas paga, sienta orden y confianza. Aquí pasamos de "vendido" a "empezamos a trabajar" sin que nada se enfríe.

**Cuándo empieza:** apenas el cliente paga el anticipo (Proceso 04 o 05).

**Quién lo hace:** Ángel dirige el arranque. Iván aprueba. Jorge y Themis apoyan.

**Tiempo máximo:** la reunión de arranque se agenda dentro de los **3 días hábiles** después del pago.

---

## Qué necesitas a la mano
- El diagnóstico y la propuesta aceptada.
- Lista de lo que vamos a pedirle al cliente (accesos, información, contactos).
- Una sola persona de contacto del lado del cliente.

---

## Paso a paso

1. **Manda un mensaje de bienvenida** el mismo día del pago: gracias, qué sigue y fecha de la reunión de arranque.
2. **Agenda la reunión de arranque** dentro de 3 días hábiles.
3. **Pide lo necesario** en una lista simple: accesos a sus herramientas, información de su operación y quién será su persona de contacto.
4. **En la reunión, deja claro:** qué vamos a construir, en qué etapas, qué números vigilaremos y qué necesitamos de ellos.
5. **Acuerda cómo nos comunicaremos:** un solo canal para todo el proyecto y reuniones por cada avance.
6. **Anota todo** y pasa al diseño del sistema (Proceso 07).

---

## Qué entregas al final
- Reunión de arranque hecha.
- Lista de accesos e información solicitada al cliente.
- Persona de contacto y canal de comunicación definidos.

## Cómo sabes que salió bien
- El cliente sabe exactamente qué sigue y para cuándo.
- Tenemos los accesos o ya están en proceso.
- Hay una sola persona de contacto y un solo canal.

## Lo que NUNCA debes hacer
- Dejar pasar más de 3 días sin agendar el arranque.
- Empezar a construir sin accesos ni información.
- Tener varios contactos y varios canales (genera desorden).

---

## Plantilla — Mensaje de bienvenida
\`\`\`
¡Bienvenido a NSG, [nombre]! Ya estamos en marcha.

Lo que sigue:
1. Reunión de arranque: [fecha] (máx. 3 días).
2. Te voy a pedir estos accesos e información: [lista].
3. Tu persona de contacto con nosotros será: [nombre].

Cualquier cosa, por este mismo canal. ¡Manos a la obra!
\`\`\``,
  },
  {
    id: "07_Diseno-del-Sistema",
    title: "Diseño del sistema",
    emoji: "🧩",
    category: "Entregar el sistema",
    subtitle: "Cómo va a funcionar antes de construir",
    md: `# Proceso 07 — Diseño del sistema

**Para qué sirve:** decidir, antes de construir, **cómo va a funcionar el sistema** del cliente: qué hace cuando llega un interesado, qué responde, cómo lo ordena, cómo da seguimiento y qué se mide. Construir sin diseñar es perder tiempo y dinero.

**Cuándo empieza:** después de la reunión de arranque (Proceso 06).

**Quién lo hace:** Ángel dirige. Duke aporta el criterio comercial (cómo se vende bien). Jorge revisa que sea posible técnicamente. Iván valida.

---

## Qué necesitas a la mano
- Cómo trabaja hoy el cliente (de dónde llegan los interesados, cómo los atiende, qué herramientas usa).
- El diagnóstico (cuál es la fuga principal).
- Accesos a sus herramientas.

---

## Paso a paso

1. **Mapea el camino actual del interesado:** desde que llega hasta que se pierde o se cierra. Marca dónde está la fuga.
2. **Dibuja el camino nuevo:** qué hará el sistema en cada momento (responder rápido, hacer preguntas para calificar, ordenar, recordar el seguimiento, avisar al vendedor).
3. **Define qué responde el sistema** y con qué tono, usando el criterio comercial de Duke.
4. **Decide qué se conecta** con qué herramientas del cliente (donde guarda a sus clientes, su WhatsApp, etc.).
5. **Define los números a vigilar** y de dónde saldrá cada número.
6. **Escribe el diseño en lenguaje simple** y muéstraselo al cliente para que lo apruebe.
7. **Con el visto bueno**, pasa a la puesta en marcha (Proceso 08).

---

## Qué entregas al final
- Un documento de diseño sencillo: camino nuevo del interesado, qué responde el sistema, qué se conecta y qué se mide.
- Aprobación del cliente.

## Cómo sabes que salió bien
- El cliente entendió y aprobó el diseño sin tecnicismos.
- Está claro qué hace el sistema en cada paso.
- Sabemos exactamente qué construir.

## Lo que NUNCA debes hacer
- Empezar a construir sin un diseño aprobado.
- Diseñar algo que el cliente no entiende.
- Prometer en el diseño resultados de ventas.

---

## Plantilla — Diseño del sistema (resumen)
\`\`\`
DISEÑO — [Empresa]
Fuga principal a resolver: [cuál]

Camino nuevo del interesado:
1. Llega por: [canal]
2. El sistema responde: [qué y en cuánto tiempo]
3. Califica preguntando: [preguntas clave]
4. Ordena y avisa a: [persona]
5. Da seguimiento: [cómo y cada cuánto]

Se conecta con: [herramientas del cliente]
Números a vigilar: [2 o 3]
Aprobado por el cliente: [fecha]
\`\`\``,
  },
  {
    id: "08_Puesta-en-Marcha",
    title: "Puesta en marcha",
    emoji: "⚙️",
    category: "Entregar el sistema",
    subtitle: "Construir y encender el sistema",
    md: `# Proceso 08 — Puesta en marcha

**Para qué sirve:** **construir y encender** el sistema que se diseñó, probarlo y dejarlo funcionando de verdad con el cliente.

**Cuándo empieza:** cuando el cliente aprueba el diseño (Proceso 07).

**Quién lo hace:** Ángel y Jorge construyen. Themis prepara la parte de uso para el equipo del cliente. Iván y el cliente reciben avisos de avance.

---

## Qué necesitas a la mano
- El diseño aprobado.
- Los accesos a las herramientas del cliente.
- Las etapas con sus resultados comprobables.

---

## Paso a paso

1. **Construye por etapas**, no todo de golpe. Cada etapa entrega algo que ya funciona.
2. **Conecta el sistema** con las herramientas del cliente (donde guarda a sus clientes, su WhatsApp, etc.).
3. **Prueba con casos reales o de ejemplo:** que responda bien, que califique, que ordene y que avise a la persona correcta.
4. **Corrige lo que falle** antes de mostrarlo al cliente.
5. **Enciéndelo en pequeño primero** (una parte o un equipo), revisa que todo salga bien y luego amplía.
6. **Avisa al cliente cada avance comprobable** y muéstraselo funcionando.
7. **Cuando esté estable**, pasa a capacitación (Proceso 09) y medición (Proceso 10).

---

## Qué entregas al final
- El sistema funcionando y conectado.
- Pruebas hechas y problemas corregidos.
- Cada etapa mostrada y aceptada por el cliente.

## Cómo sabes que salió bien
- El sistema responde, califica, ordena y avisa como se diseñó.
- Se probó antes de encenderlo del todo.
- El cliente vio cada avance funcionando.

## Lo que NUNCA debes hacer
- Encender todo de golpe sin probar.
- Mostrarle al cliente algo que falla.
- Dar por terminado sin que el sistema funcione de verdad (la garantía es que quede funcionando).

---

## Plantilla — Avance de puesta en marcha
\`\`\`
AVANCE — [Empresa]
Etapa terminada: [cuál]
Qué ya funciona: [descripción simple]
Probado con: [casos reales / de ejemplo]
Pendientes: [lista corta]
Siguiente etapa: [cuál] — fecha: [fecha]
\`\`\``,
  },
  {
    id: "09_Capacitacion-y-Uso",
    title: "Capacitación y uso",
    emoji: "🎓",
    category: "Entregar el sistema",
    subtitle: "Que el equipo de verdad lo use",
    md: `# Proceso 09 — Capacitación y que lo usen

**Para qué sirve:** que el equipo del cliente **sepa usar el sistema y de verdad lo use**. Un sistema que nadie usa no sirve de nada. Esta es la diferencia entre "entregado" y "funcionando en su día a día".

**Cuándo empieza:** cuando el sistema ya está estable (Proceso 08).

**Quién lo hace:** Themis dirige (se especializa en que la gente adopte herramientas). Ángel apoya. Iván valida.

---

## Qué necesitas a la mano
- El sistema funcionando.
- La lista de personas del cliente que lo van a usar.
- Una guía corta y simple de uso.

---

## Paso a paso

1. **Haz una guía corta y clara**, con imágenes o pasos sencillos. Nada técnico.
2. **Da una capacitación en vivo** al equipo del cliente: enséñales qué hace el sistema y cómo lo usan en su trabajo diario.
3. **Resuelve dudas en el momento** y deja la grabación o la guía a la mano.
4. **Acompaña los primeros días:** revisa que de verdad lo estén usando y ayuda con lo que se traben.
5. **Nombra a un responsable interno** del cliente que sea el punto de apoyo de su equipo.
6. **Confirma que el equipo lo usa solo** antes de cerrar esta etapa.

---

## Qué entregas al final
- Guía de uso simple.
- Capacitación hecha (en vivo + grabación o material).
- Equipo del cliente usando el sistema sin depender de nosotros para todo.

## Cómo sabes que salió bien
- El equipo del cliente usa el sistema en su día a día.
- Saben a quién preguntar cuando tienen dudas.
- Bajaron las preguntas básicas después de los primeros días.

## Lo que NUNCA debes hacer
- Entregar el sistema sin enseñar a usarlo.
- Dejar una guía llena de palabras técnicas.
- Cerrar esta etapa cuando todavía nadie lo usa.

---

## Plantilla — Cierre de capacitación
\`\`\`
CAPACITACIÓN — [Empresa]
Personas capacitadas: [cuántas y quiénes]
Guía entregada: [sí/no]  ·  Grabación: [sí/no]
Responsable interno del cliente: [nombre]
¿El equipo ya lo usa solo?: [sí / casi / no]
Pendientes de acompañamiento: [lista]
\`\`\``,
  },
  {
    id: "10_Medicion-y-Mejora",
    title: "Medición y mejora",
    emoji: "📈",
    category: "Entregar el sistema",
    subtitle: "Mostrar resultados con números",
    md: `# Proceso 10 — Medición y mejora

**Para qué sirve:** mostrarle al cliente, con números, **qué está cambiando** desde que el sistema funciona, y mejorar el sistema mes a mes. Esto sostiene la relación y justifica que siga con nosotros.

**Cuándo empieza:** apenas el sistema está encendido (Proceso 08) y nunca para mientras seamos su proveedor.

**Quién lo hace:** Ángel dirige la medición. Themis y Jorge apoyan. Iván presenta al cliente.

---

## Qué necesitas a la mano
- Los 2 o 3 números que se acordaron al inicio (en el diagnóstico y el diseño).
- El punto de partida (cómo estaba el cliente antes).

---

## Paso a paso

1. **Anota el punto de partida** antes de encender: cómo estaban esos números al inicio.
2. **Mide esos mismos números cada mes.** Siempre los mismos, para poder comparar.
3. **Compara contra el inicio** y contra el mes anterior.
4. **Explica los números en palabras simples:** qué mejoró, qué falta y por qué.
5. **Propón una mejora al sistema** cada mes (un ajuste que lo haga funcionar mejor).
6. **Presenta un reporte mensual corto** al cliente, en una sola página.
7. **Aplica la mejora** y vuelve a medir el mes siguiente.

---

## Cómo presentar los números (con cuidado)
- Muestra **qué está midiendo el sistema** (tiempos, interesados atendidos, seguimientos hechos).
- **No atribuyas las ventas al sistema ni a NSG.** Las ventas son del cliente. Nosotros mostramos cómo cambió la atención y el orden, no prometemos ni nos colgamos sus ventas.

---

## Qué entregas al final
- Reporte mensual de una página con los números, comparados con el inicio.
- Una mejora aplicada cada mes.

## Cómo sabes que salió bien
- El cliente recibe su reporte cada mes, a tiempo.
- Los números se comparan siempre igual.
- El sistema mejora mes a mes.

## Lo que NUNCA debes hacer
- Decir "gracias a nosotros vendiste X" o prometer ventas.
- Cambiar los números que se miden cada mes (no se podría comparar).
- Dejar de enviar el reporte mensual.

---

## Plantilla — Reporte mensual (una página)
\`\`\`
REPORTE — [Empresa] — [Mes]
Número 1: [nombre]  — Inicio: [x]  → Hoy: [y]
Número 2: [nombre]  — Inicio: [x]  → Hoy: [y]
Número 3: [nombre]  — Inicio: [x]  → Hoy: [y]

Qué mejoró: [en palabras simples]
Qué falta: [en palabras simples]
Mejora aplicada este mes: [cuál]
Próxima mejora: [cuál]
\`\`\``,
  },
  {
    id: "11_Soporte-y-Garantia",
    title: "Soporte y garantía",
    emoji: "🛟",
    category: "Entregar el sistema",
    subtitle: "Cuidar la confianza después de entregar",
    md: `# Proceso 11 — Soporte y garantía

**Para qué sirve:** atender al cliente cuando algo del sistema falla y cumplir nuestra garantía: **que el sistema quede y siga funcionando**. Aquí se cuida la confianza después de la entrega.

**Cuándo empieza:** desde que el sistema está encendido (Proceso 08) y dura mientras seamos su proveedor.

**Quién lo hace:** Jorge dirige el soporte. Ángel apoya en lo difícil. Themis ayuda si el problema es de uso. Iván se entera si es algo grave.

---

## Qué cubre la garantía (dilo claro al cliente)
- **Sí cubre:** que el sistema funcione como se diseñó. Si algo se rompe o deja de funcionar por nuestra parte, lo arreglamos.
- **No cubre:** un resultado de ventas. Las ventas las cierra el equipo del cliente. La garantía es técnica, no de resultados.

---

## Qué necesitas a la mano
- Un solo canal donde el cliente reporta problemas.
- Una lista donde anotamos cada problema y cómo se resolvió.

---

## Paso a paso

1. **Recibe el reporte** por el canal acordado y **confírmale al cliente** que ya lo estás viendo (el mismo día).
2. **Clasifica qué tan urgente es:**
   - **Urgente** (el sistema no funciona): se atiende de inmediato.
   - **Importante** (algo falla pero el sistema sigue): se atiende en pocos días.
   - **Mejora o duda**: se agenda.
3. **Resuelve** y comprueba que quedó bien.
4. **Avísale al cliente** qué pasó y cómo se arregló, en palabras simples.
5. **Anota el problema y la solución** para que no se repita y para mejorar el sistema.

---

## Qué entregas al final
- Problema resuelto y cliente avisado.
- Registro de qué pasó y cómo se solucionó.

## Cómo sabes que salió bien
- Confirmaste el reporte el mismo día.
- Lo urgente se resolvió rápido.
- Quedó anotado para no repetirlo.

## Lo que NUNCA debes hacer
- Prometer que la garantía cubre ventas.
- Dejar un reporte sin confirmar que lo estás atendiendo.
- Resolver y no avisarle al cliente.

---

## Plantilla — Registro de soporte
\`\`\`
SOPORTE — [Empresa]
Problema reportado: [qué]  ·  Fecha: [fecha]
Urgencia: [urgente / importante / mejora]
Qué se hizo: [solución en simple]
Resuelto: [sí/no]  ·  Cliente avisado: [sí/no]
Para que no se repita: [acción]
\`\`\``,
  },
  {
    id: "12_Quien-Hace-Que",
    title: "Quién hace qué",
    emoji: "👥",
    category: "Cómo trabajamos por dentro",
    subtitle: "Roles y herramientas",
    md: `# Proceso 12 — Quién hace qué y con qué herramientas

**Para qué sirve:** que en cada proyecto haya **responsables claros**, un **ritmo de seguimiento** y **herramientas estándar**, para que nada dependa de la memoria de alguien.

**Cuándo empieza:** en todo proyecto, desde el primer día.

**Quién manda:** Iván es el responsable final de que esto se cumpla.

---

## El equipo y de qué se encarga cada uno

| Persona | Se encarga de |
|---|---|
| **Iván Rodríguez** | Dirige NSG. Lleva la visión, las alianzas y **el cierre de ventas**. Traduce el problema del cliente en un sistema. |
| **Ángel Garzón** | **Diseña y construye** el sistema de inteligencia artificial y lo deja funcionando. |
| **Jorge Calderón** | Construye la parte técnica, las conexiones y da **soporte**. |
| **Themis Nickthel** | Se asegura de que el equipo del cliente **use** el sistema (capacitación y adopción). |
| **Duke del Caribe** | Aporta el **criterio comercial** (cómo se vende bien), que se traduce en cómo responde el sistema. |

---

## Quién es responsable en cada proceso

| Proceso | Lo dirige | Lo aprueba |
|---|---|---|
| 01 Atraer interesados | Iván / Marketing | Iván |
| 02 Diagnóstico | Iván | Iván |
| 03 Ver si encaja | Iván | Iván |
| 04 Propuesta y cierre | Iván | Iván |
| 05 Programa de Socios | Iván | Consejo |
| 06 Bienvenida | Ángel | Iván |
| 07 Diseño | Ángel | Ángel |
| 08 Puesta en marcha | Ángel / Jorge | Ángel |
| 09 Capacitación | Themis | Ángel |
| 10 Medición | Ángel | Iván |
| 11 Soporte y garantía | Jorge | Ángel |

---

## El ritmo de trabajo

- **Cada semana, una reunión interna de 30 minutos:** estado de cada proyecto, qué está trabado, qué viene.
- **Por cada proyecto:** un tablero con las etapas, los números y un cuaderno de cambios y problemas.
- **Con el cliente:** una reunión por cada avance comprobable + un reporte mensual (Proceso 10).

---

## Herramientas estándar (una sola de cada, no mezclar)

- **Un lugar único para guardar a todos los clientes e interesados** (la fuente de verdad).
- **Un tablero de proyectos** con etapas.
- **Esta carpeta de procesos** y sus plantillas.
- **Un solo canal de comunicación por cliente.**

---

## Cómo sabes que salió bien
- Cada proyecto tiene responsable y etapas claras.
- La reunión semanal se hace siempre.
- La información está en el lugar único, no en chats sueltos.

## Lo que NUNCA debes hacer
- Dejar roles difusos ("todos hacen todo").
- Guardar información importante en chats sueltos en vez del lugar único.
- No anotar lo que está trabado (afecta tiempos y garantía).`,
  },
  {
    id: "13_Cuidado-de-Datos",
    title: "Cuidado de datos",
    emoji: "🔒",
    category: "Cómo trabajamos por dentro",
    subtitle: "Seguridad y privacidad",
    md: `# Proceso 13 — Cuidado de los datos y seguridad

**Para qué sirve:** proteger la información del cliente y de la gente interesada que pasa por el sistema. Si manejamos mal los datos, perdemos la confianza y nos exponemos legalmente.

**Cuándo empieza:** desde que pedimos el primer acceso al cliente (Proceso 06) y para siempre.

**Quién manda:** Jorge es el responsable de que esto se cumpla.

---

## Las reglas básicas (fáciles de seguir)

1. **Pide solo lo que necesitas.** No pidas accesos ni información de más.
2. **Guarda los accesos en un lugar seguro**, no en chats ni en notas sueltas.
3. **Solo el equipo que trabaja el proyecto** tiene acceso. Nadie más.
4. **Cada persona con su propia cuenta.** No compartir contraseñas entre varios.
5. **Cuando termina un proyecto o sale alguien del equipo, se quitan los accesos** ese mismo día.
6. **La información del cliente es del cliente.** No se usa para otra cosa ni se comparte con nadie.
7. **Sé claro con el cliente** sobre qué datos maneja el sistema y para qué.

---

## Paso a paso al iniciar un proyecto

1. **Haz una lista de qué accesos pediste** y para qué sirve cada uno.
2. **Guárdalos en el lugar seguro** acordado.
3. **Da acceso solo a quien trabaja el proyecto.**
4. **Anota quién tiene acceso a qué.**
5. **Al cerrar el proyecto**, revisa la lista y quita lo que ya no se usa.

---

## Qué entregas al final
- Lista de accesos y de quién tiene cada uno.
- Accesos guardados de forma segura.

## Cómo sabes que salió bien
- Nadie fuera del equipo tiene acceso.
- No hay contraseñas en chats.
- Al cerrar proyectos, se quitan los accesos.

## Lo que NUNCA debes hacer
- Compartir contraseñas por chat o correo.
- Dejar accesos abiertos después de cerrar un proyecto.
- Usar la información de un cliente para algo distinto a su proyecto.

---

## Plantilla — Lista de accesos
\`\`\`
ACCESOS — [Empresa]
Acceso 1: [cuál] — para: [para qué] — lo tiene: [quién]
Acceso 2: [cuál] — para: [para qué] — lo tiene: [quién]

Guardado en: [lugar seguro]
Al cerrar el proyecto, quitar accesos: [fecha]
\`\`\``,
  },
  {
    id: "14_Como-Hablamos",
    title: "Cómo hablamos",
    emoji: "💬",
    category: "Cómo trabajamos por dentro",
    subtitle: "Reglas de mensaje no negociables",
    md: `# Proceso 14 — Cómo hablamos (reglas de mensaje)

**Para qué sirve:** que **todo lo que sale de NSG diga lo mismo y de la forma correcta**: la página web, las propuestas, los correos, WhatsApp, redes y cualquier conversación. Un mensaje equivocado nos mete en problemas y nos quita seriedad.

**Cuándo se aplica:** siempre, en todo material y conversación.

**Quién manda:** Iván es el responsable final del mensaje.

---

## Las 6 reglas de oro (no se rompen nunca)

1. **El caso de Duke del Caribe se dice SIEMPRE así:** *"más de 40 millones de dólares en 3 años"*. Nunca otra cantidad ni otro plazo.
2. **Separa siempre tres cosas:**
   - **La experiencia** es de Duke del Caribe.
   - **La construcción del sistema** la hace NSG.
   - **El resultado en ventas** es del cliente.
3. **Nunca prometas ventas, ganancias ni "recuperar dinero"** gracias a NSG o a la inteligencia artificial.
4. **La garantía es solo técnica:** el sistema queda funcionando. Nunca garantices ventas.
5. **No menciones metas internas** de NSG (cuánto queremos facturar o cuántos clientes) en nada que vea el cliente.
6. **Nunca digas "agencia" ni "chatbot".** Di siempre *"sistema de ventas operado por inteligencia artificial"*.

---

## Cómo revisar cualquier material antes de enviarlo

Antes de publicar o mandar algo, hazte estas 6 preguntas. Si una falla, **se detiene y se corrige**:

1. ¿La cifra de Duke dice exactamente "más de 40 millones de dólares en 3 años"?
2. ¿Quedan separadas experiencia (Duke), sistema (NSG) y resultado (cliente)?
3. ¿Evita prometer ventas, ganancias o recuperación de dinero?
4. ¿La garantía se presenta solo como técnica?
5. ¿Evita mencionar metas internas de NSG?
6. ¿Evita las palabras "agencia" y "chatbot"?

---

## Palabras que sí usamos y palabras que no

| Di esto | No digas esto |
|---|---|
| Sistema de ventas operado por inteligencia artificial | Agencia / chatbot / robot |
| Fuga de ventas | (inventar otros nombres) |
| Fuga estimada | "Vas a recuperar X dinero" |
| Garantía técnica (queda funcionando) | "Garantizamos más ventas" |
| Encuentra tu fuga de ventas | (otras invitaciones distintas) |

---

## Cómo sabes que salió bien
- Todo lo que sale de NSG pasa las 6 preguntas.
- El mensaje es el mismo en todos lados.

## Lo que NUNCA debes hacer
- Publicar o enviar algo sin revisar las 6 preguntas.
- Cambiar la cifra de Duke "para que suene mejor".
- Prometer resultados de ventas para cerrar más rápido.`,
  },
];
