# Propuesta de precios de Stratos AI

Fecha: 10 de septiembre de 2026. Moneda: USD. Precios recomendados, antes de impuestos. Suscripciones mensuales; la implementación se cobra una sola vez. No son tarifas vigentes ni una modificación del checkout.

**Recomendación central: CRM a US$29 por usuario/mes; CRM con Copilot a US$49 por usuario/mes; paquete de equipo a US$399/mes con cinco usuarios; paquete de operación a US$799/mes con diez usuarios.** Comunicaciones y consumos adicionales se cotizan por separado.

Se asume un cliente pyme, una organización, procesos de venta u obra configurables sobre el producto existente y soporte en horario laboral. Desarrollo a medida, atención 24/7 y obligaciones contractuales especiales quedan fuera. No se dispone de costos reales de soporte, infraestructura y proveedores: estas tarifas son una hipótesis comercial para validar, no una garantía de rentabilidad ni una medición de disposición a pagar.

## Referencias oficiales

| Proveedor | Referencia consultada | Condición publicada |
|---|---|---|
| Salesforce | Starter US$25/usuario/mes; Pro US$100; Core US$195 | Starter admite mensual/anual; Pro y Core, facturación anual. |
| Salesforce Agentforce | Add-on US$125/usuario/mes; US$500 por 100,000 Flex Credits; US$2/conversación en otra modalidad | Son modelos distintos; no deben sumarse indiscriminadamente. |
| HubSpot Sales Hub | Professional desde US$90/asiento/mes con pago anual; la página también muestra US$100 con pago mensual y compromiso anual. Enterprise desde US$150 | Onboarding publicado: Professional US$1,500; Enterprise US$3,500. |
| HubSpot Marketing Hub | Professional desde US$800/mes con pago anual; US$890 con pago mensual y compromiso anual | Incluye tres Core Seats y 2,000 contactos de marketing; onboarding US$3,000. |

Fuentes: [Salesforce Sales](https://www.salesforce.com/sales/pricing/), [Agentforce](https://www.salesforce.com/agentforce/pricing/), [HubSpot Sales](https://www.hubspot.com/pricing/sales), [HubSpot Marketing](https://www.hubspot.com/pricing/marketing).

HubSpot también muestra opciones gratuitas y promociones de Starter de bajo precio. Por eso Stratos no debe afirmar que es más barato en todos los segmentos. La comparación anterior orienta la estructura comercial: no acredita equivalencia de capacidades, seguridad, ecosistema o soporte. Los precios pueden variar por región, promoción, contrato y fecha.

## Regla para evitar cobros duplicados

Las tablas de funciones asignan una **porción del valor mensual de cada módulo**. Son una distribución comercial propuesta, no precios observados de funciones independientes en Salesforce o HubSpot. Se cobra el total del módulo una sola vez. Una función incluida tiene costo adicional cero para el cliente que ya contrató ese módulo.

No se suman unidades incompatibles: los módulos por usuario se multiplican por usuarios; los de organización se cobran una vez; WhatsApp se multiplica por números conectados. Los paquetes sustituyen a las líneas incluidas. ERP Operativo incluye Agenda de Equipo y Caja: no se vuelven a cobrar.

## 1. CRM — US$29 por usuario/mes

| Función | Valor asignado, USD/usuario/mes |
|---|---:|
| Alta, edición y ficha de clientes/prospectos | 6 |
| Pipeline y etapas configurables | 4 |
| Lista y Kanban con movimiento de registros | 3 |
| Búsqueda, filtros y orden | 2 |
| Expediente de notas y contexto | 3 |
| Registro de interacciones e historial | 2 |
| Tareas y próxima acción manual del usuario | 2 |
| Prioridades, score por reglas/editable y marca caliente | 2 |
| Asignación individual y masiva, según permisos | 2 |
| Detección de duplicados | 1 |
| Papelera y restauración | 1 |
| Exportación/respaldo manual y trazabilidad disponible | 1 |
| Autenticación, permisos básicos, perfil, PWA y diseño móvil | 0 adicionales |
| Borradores, recuperación y mecanismos locales de guardado existentes | 0 adicionales |
| **Total CRM** | **29** |

Incluye la interfaz comercial actual; no incluye archivo documental completo, almacenamiento ilimitado ni desarrollo de campos/procesos nuevos. La configuración inicial de un pipeline está en implementación. No se cobra otra licencia por usar móvil y escritorio con la misma cuenta.

## 2. Copilot — US$20 adicionales por usuario/mes

| Función | Valor asignado, USD/usuario/mes |
|---|---:|
| Chat conectado y acceso por Telegram | 2 |
| Consultar cartera, ficha, historial y expediente | 2 |
| Consultar KPIs y pipeline | 1 |
| Crear y editar clientes por conversación | 3 |
| Cambiar etapa, prioridad y responsable por conversación | 2 |
| Registrar interacciones y notas por conversación | 2 |
| Crear, consultar y actualizar recordatorios en lenguaje natural | 2 |
| Organizar notas libres en campos estructurados | 2 |
| Sugerir próximas acciones comerciales | 2 |
| Buscar desarrollos y recuperar material disponible | 1 |
| Confirmaciones, contexto e historial conversacional | 1 |
| Registrar cierre, papelera y asignación de clave de agente | 0 adicionales |
| Dictado del navegador | 0 adicionales |
| **Total Copilot, adicional al CRM** | **20** |
| **CRM + Copilot por usuario** | **49** |

Propuesta de cupo: **300 solicitudes de IA textual procesadas correctamente por usuario/mes**, agrupadas entre los usuarios Copilot de la misma organización. Una solicitud del usuario cuenta una vez aunque internamente requiera varias herramientas; reintentos técnicos y fallos no se facturan. Las consultas deterministas sin modelo y el guardado manual no consumen este cupo. Cupo mensual no acumulable.

Alcance inicial sugerido por solicitud: texto y contexto gestionado de hasta 8,000 tokens de entrada y 1,500 de salida. Documentos extensos, audio, imágenes y agentes externos consumen presupuestos separados. Estos cupos y su medición son reglas comerciales propuestas: hace falta instrumentarlos antes de facturarlos automáticamente.

Excedente propuesto: **US$10 por 100 solicitudes adicionales**, con presupuesto aprobado y visible. No activar sobreconsumos sin acuerdo. Antes de cerrar el precio, medir el costo por solicitud con los modelos realmente usados.

Para habilitarlo comercialmente se necesita probar las acciones contratadas en el tenant, unificar etapas entre bot y CRM y resolver los límites de audio/respuestas señalados en el análisis funcional. Asignar una clave de agente no incluye ni acredita el trabajo autónomo del agente.

## 3. Agenda de Equipo — US$49 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Asignación de tareas a personas/equipo | 10 |
| Agenda personal/profesional y vencimientos | 8 |
| Recordatorios previos mediante flujos conectados | 10 |
| Seguimiento posterior y estados de cumplimiento | 8 |
| Indicadores de productividad por persona | 6 |
| Metas, plan semanal y protocolo configurable | 5 |
| Biblioteca de enlaces/documentos del equipo | 2 |
| **Total Agenda de Equipo** | **49** |

Incluye hasta 20 usuarios CRM contratados y 2,000 entregas de recordatorios al mes sobre flujos estándar. Usuarios adicionales conservan su licencia CRM; ampliaciones de volumen requieren cotización. No incluye sincronización de calendarios externos ni almacenamiento documental nuevo.

## 4. Comando Directivo — US$79 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| KPIs y tablero ejecutivo | 20 |
| Embudo y evolución por periodos | 15 |
| Comparación y métricas de asesores | 15 |
| Control operativo de Zooms, estados y responsables | 20 |
| Exportación de reportes PDF/CSV | 9 |
| **Total Comando** | **79** |

Incluye reportes existentes para hasta 20 usuarios CRM contratados. Quien accede conserva su licencia CRM; no se agrega un cargo por cada reporte ni por cada exportación. No incluye indicadores hechos a medida, analítica predictiva acreditada ni conexión a la API de Zoom. Deben validarse las fórmulas y los datos usados antes de entregar reportes como información de dirección.

## 5. Proyectos + Create — US$69 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Catálogo de desarrollos y fichas | 15 |
| Filtros por zona, presupuesto y características | 9 |
| Acceso a contactos y material comercial existente | 5 |
| Selección personalizada de propiedades | 10 |
| Generación y previsualización de presentaciones | 20 |
| Enlace público para compartir | 10 |
| Enlace para compartir por WhatsApp | 0 adicionales |
| **Total Proyectos + Create** | **69** |

Incluye hasta cinco usuarios editores autorizados, catálogo suministrado por el cliente y presentaciones del flujo actual. Sin cargo Stratos por visita a la presentación. Debe respetarse el acceso por rol: la tarifa no implica que cualquier asesor ya tenga editor habilitado. No incluye inventario de unidades en tiempo real, actualización permanente de precios, CMS compartido ni medición de conversiones. Puede incluirse durante un piloto sin cargo si las limitaciones de persistencia local afectan el uso del cliente.

## 6. Captación y reparto — US$99 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Conexión y recepción de Meta Lead Ads | 25 |
| Alta/actualización y deduplicación de prospectos | 15 |
| Reparto rotativo entre asesores | 25 |
| Reglas estándar de ruta por campaña/asesor | 15 |
| Notificación al asesor por canal conectado | 10 |
| Formulario/router público estándar | 9 |
| **Total Captación** | **99** |

Alcance sugerido: una cuenta de Meta, hasta tres formularios/campañas configurados, un router estándar, hasta 20 asesores con licencia y 2,000 leads nuevos mensuales. Excedente: US$25 por bloque de 1,000 leads nuevos procesados. Eventos duplicados/reintentos no cuentan. Pauta, gestión publicitaria, diseño de campañas y costos de WhatsApp son aparte. Incluye mantenimiento del conector, no automatizaciones nuevas cada mes. Las rutas específicas existentes deben adaptarse y probarse para cada nueva empresa.

## 7. WhatsApp — US$49 por número conectado/mes

| Función | Valor asignado, USD/número/mes |
|---|---:|
| Bandeja e historial vinculado al CRM | 15 |
| Envío manual de mensajes desde el CRM | 12 |
| Fotos, audio y documentos por la ruta disponible | 8 |
| No leídos, búsqueda, fijación y avisos | 6 |
| Estados, cola y reintentos | 8 |
| **Total WhatsApp** | **49** |

Incluye hasta cinco usuarios CRM autorizados por número y 5 GB de archivos activos por número; ampliación por cotización. El acceso general para asesores debe habilitarse y validarse, porque la bandeja tiene restricciones actuales. No se factura la misma bandeja por usuario y por número a la vez.

Consumo de Meta/Chatwoot/BSP al costo documentado cuando corresponda, preferiblemente contratado directamente por el cliente. Los US$49 cubren el conector y su mantenimiento estándar. No prometen mensajes ilimitados, campañas automáticas ni compatibilidad universal de números/canales.

## 8. Telefonía IA — US$79 por organización/mes + consumo

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Acceso al flujo de llamada conectado | 25 |
| Guion/agente estándar validado | 20 |
| Historial y grabación disponible | 12 |
| Resumen y transcripción recibidos del proveedor | 12 |
| Derivación o marca de intervención humana | 10 |
| **Total Telefonía** | **79** |

Incluye un agente de voz, un número y hasta tres llamadas concurrentes, siempre que proveedor/configuración lo permitan. El alquiler del número y minutos no están incluidos. La tarifa por consumo recomendada es **costo variable documentado × 1.30** si Stratos administra y paga el proveedor. Es un recargo del 30%, que equivale a 23.1% de margen sobre ese ingreso, antes de otros costos. Si el cliente paga el proveedor directamente, no se vuelve a cobrar ese consumo.

No fijar todavía un precio universal por minuto: cambia con modelo, voz, telefonía y destino. Tampoco cobrar una llamada fallida como venta o lead calificado; distinguir costo técnico del resultado comercial. El acceso actual de la aplicación debe revisarse para el usuario contratado.

## 9. Caja — US$49 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Ingresos y egresos | 14 |
| Cuenta, categoría, fecha y responsable | 8 |
| Vinculación de movimientos a proyecto/obra | 8 |
| Consulta de comprobantes existentes | 5 |
| Resumen y flujo de caja sobre datos cargados | 9 |
| Búsqueda y exportación | 5 |
| **Total Caja** | **49** |

Incluye hasta tres operadores administrativos con licencia CRM y movimientos de una moneda acordada. Antes de cobrarla como módulo financiero se deben corregir la moneda fija del alta web y los totales truncados por límites de consulta, o delimitar expresamente un piloto. No incluye contabilidad, utilidad contable, conciliación, facturación ni cuentas por cobrar/pagar.

## 10. ERP Operativo — US$149 por organización/mes

| Función | Valor asignado, USD/organización/mes |
|---|---:|
| Agenda de Equipo completa | 49 |
| Caja completa | 49 |
| Modo obra/licitación y expediente adaptado | 25 |
| Proceso sectorial con estados propios | 16 |
| Vinculación operativa de responsables, bitácora y gastos | 10 |
| **Total ERP Operativo** | **149** |

Requiere licencias CRM. **Reemplaza los US$49 de Agenda y los US$49 de Caja; no se suman nuevamente.** Incluye una organización, un proceso sectorial basado en la adaptación existente y hasta 100 proyectos activos, con hasta 20 usuarios contratados. Configuración e integración inicial van en implementación.

No incluye compras, proveedores, inventarios, órdenes, nómina, contabilidad ni facturación. Los flujos de campo/Telegram se entregan solo si están incluidos, probados y aceptados en la implementación. No representa un ERP universal terminado.

## 11. Funciones sin cargo propio hoy

| Función o superficie | Precio de licencia actual recomendado | Motivo |
|---|---:|---|
| Tablero de cuatro iAgents con actividad de ejemplo | US$0 adicionales | La pantalla no prueba ejecución autónoma. |
| Reactivador/calificador/seguimiento autónomo nuevo | No cotizar como licencia lista | Requiere alcance, implementación, validación y presupuesto de consumo. |
| Evaluación IA de candidatos/CV | US$0; no vender como operativa | Es simulada. |
| Vacantes y portal de candidatos actual | US$0; no vender como ATS | Falta persistencia del flujo de postulación revisado. |
| Rendimiento de equipo basado en datos fijos | US$0; no vender como medición real | No confundir con Comando/Productividad conectados. |
| Chat lateral de respuestas predefinidas | US$0 | No equivale al Copilot conectado. |
| Checkout de suscripciones | US$0; no ofrecer procesamiento real | El pago exitoso está simulado. |
| Supuesta subida documental que solo guarda metadatos | US$0 | No equivale a almacenar y recuperar archivos. |
| Calendario externo, contabilidad, compras, nómina e inventario transaccional | Fuera del precio actual | No hay una implementación integral acreditada. |
| Manuales, perfil, recuperación y temas visuales | Incluido en CRM | Funciones básicas de uso y soporte. |
| Separación básica de organizaciones y roles existentes | Incluido en CRM | No cobrar seguridad básica como un lujo opcional. |
| Diagnóstico de ventas de la propia Stratos y landing corporativa | US$0 como módulo del cliente | Son herramientas comerciales del proveedor. Adaptarlas para otro negocio es un proyecto aparte. |

Precio cero no significa producto gratuito terminado: significa que no se agrega un cargo por una capacidad que todavía no se entrega. Los desarrollos futuros requieren presupuesto separado; no pueden valorarse justamente sin alcance.

## 12. Paquetes comerciales recomendados

| Plan | Suscripción mensual | Incluye | Implementación única |
|---|---:|---|---:|
| CRM | US$29 por usuario | Núcleo CRM | US$500 por organización |
| Copilot | US$49 por usuario | CRM + Copilot; 300 solicitudes IA por usuario | US$750 por organización |
| Team | US$399 | Cinco usuarios CRM + Copilot, Agenda de Equipo, Comando, Proyectos + Create | US$1,500 |
| Business / ERP | US$799 | Diez usuarios CRM + Copilot, Comando, Proyectos + Create, Captación, un número WhatsApp y ERP Operativo | US$3,000 |

Usuarios adicionales CRM: US$29/mes; CRM + Copilot: US$49/mes. En paquetes, añadir un usuario no añade nuevamente módulos por organización. Ampliaciones de editores de Create, operadores de Caja, agentes de WhatsApp u otros límites específicos se cotizan antes de habilitarse; no confundir una licencia adicional con ampliación automática de todas las capacidades.

Solo se incluye un despliegue estándar por organización. Team tiene 1,500 solicitudes IA/mes agrupadas; Business, 3,000. No incluye minutos de telefonía, costos de mensajería, transcripción, análisis de imágenes ni pauta. Telefonía IA es add-on de US$79/mes incluso en Business.

Descuento anual sugerido: 10% sobre la suscripción prepagada, no sobre implementación, proveedores ni desarrollo. Ofrecer mensual durante el piloto y anual después de demostrar funcionamiento. No exigir anual para ocultar problemas pendientes.

### Comprobación de que los paquetes no duplican cargos

- Team separado: 5 × 49 + 49 + 79 + 69 = **US$442/mes**. Paquete: **US$399**, ahorro US$43/mes (9.7%).
- Business separado: 10 × 49 + 79 + 69 + 99 + 49 + 149 = **US$935/mes**. Paquete: **US$799**, ahorro US$136/mes (14.5%). Agenda y Caja ya están dentro de ERP.
- Team, primer año mensual: 399 × 12 + 1,500 = **US$6,288**, antes de impuestos y consumos.
- Business, primer año mensual: 799 × 12 + 3,000 = **US$12,588**, antes de impuestos y consumos.

Los descuentos comparan Stratos por módulos contra Stratos en paquete, no contra una supuesta réplica exacta de Salesforce/HubSpot. No se suman licencias de competidores para construir un ahorro artificial.

## 13. Implementación y servicios

Las implementaciones de paquetes sustituyen a la implementación básica; no se cobran ambas. Alcance estándar propuesto:

| Servicio | Precio único | Entregable/límite |
|---|---:|---|
| Alta CRM | US$500 | Una organización, un pipeline estándar, importación de hasta 5,000 registros desde un archivo limpio y una sesión de capacitación. |
| Alta CRM + Copilot | US$750 | Lo anterior más vinculación/configuración y pruebas de operaciones contratadas. |
| Team | US$1,500 | Lo anterior, configuración de módulos incluidos, hasta 10,000 registros limpios y dos sesiones. |
| Business / ERP | US$3,000 | Team, proceso de obra/licitación estándar, Caja, hasta tres formularios Meta y un número WhatsApp, sujeto a cuentas habilitadas. |
| WhatsApp adicional | US$250 por número | Configuración y prueba de recepción/envío del canal compatible. No incluye trámites o costos del proveedor. |
| Conector Meta independiente | US$500 | Una cuenta y hasta tres formularios; no cobrar si ya está incluido en Business. |
| Telefonía estándar | US$750 | Un agente, un guion, un número y pruebas acordadas; sin minutos ni desarrollos nuevos. |
| Adaptación ERP fuera de Business | US$1,500 | Un flujo sectorial sobre componentes existentes; no creación de ERP contable. |
| Marca y dominio del cliente | US$500 | Configuración sobre capacidades existentes; dominio y certificados/servicios de terceros si aplican, aparte. |
| Automatización nueva a medida | US$75/hora con presupuesto previo | Diseño, implementación y prueba. Mantenimiento mensual definido por alcance. |
| Acompañamiento adicional | US$199/mes | Hasta dos horas mensuales de capacitación/configuración; no atención 24/7 ni desarrollos ilimitados. |

Soporte básico incluido: incidencias del producto en horario laboral y primera respuesta objetivo en un día hábil; es una propuesta de servicio que Stratos debe poder sostener, no un SLA ya existente. Los defectos de funciones vendidas deben corregirse como soporte de producto, no cobrarse otra vez como personalización.

## 14. Consumo y margen

| Uso | Regla recomendada |
|---|---|
| IA textual Copilot | Cupo incluido y excedente US$10/100 solicitudes, con medición y tope acordado. |
| Transcripción de audio / análisis de imágenes | Proveedor directo al cliente o costo documentado × 1.30 si lo administra Stratos. |
| Telefonía IA | US$79/mes de conector + proveedor directo o costo variable × 1.30; nunca ambos por el mismo consumo. |
| WhatsApp | US$49/número/mes + tarifa del proveedor al costo documentado cuando aplique. |
| Captación por encima del cupo | US$25/1,000 leads nuevos; no cobrar duplicados técnicos. |
| Infraestructura y almacenamiento fuera del alcance estándar | Cotización explícita; no prometer uso ilimitado. |

Objetivo orientativo de margen bruto para la suscripción de software: 70%, antes de ventas, administración e impuestos. Se define aquí como `(suscripción − costos directos de prestación) / suscripción`, incluyendo infraestructura, IA incluida y soporte atribuible.

| Suscripción | Máximo costo directo mensual compatible con ese objetivo |
|---|---:|
| US$49 por usuario | US$14.70 |
| Team US$399 | US$119.70 por organización |
| Business US$799 | US$239.70 por organización |

Estos son límites calculados, no costos observados. Si el consumo real o soporte exceden el presupuesto, ajustar cupos o precios antes de vender a escala. Los costos trasladados de proveedores y el onboarding se analizan por separado para no inflar el margen aparente.

Conservar estas tarifas como lista inicial, hacer pilotos pagados con alcance claro y medir uso, horas de soporte, conversión y retención. No asignar ingresos recurrentes a módulos de demostración para justificar una tarifa mayor.

Inventario de capacidades y límites: [análisis funcional de Stratos](/Users/ivanrodriguezruelas/stratos-ai-application/docs/analisis-funcional-stratos-ai-2026-09-10.md).
