# Clínica dental: pruebas, uso y ruta regulatoria

Fecha de revisión: 27 de septiembre de 2026. Producto: Stratos AI, tenant Clínica Dental, integración Huli. Este documento registra evidencia técnica y una revisión preliminar de fuentes oficiales mexicanas; no constituye certificación sanitaria ni dictamen de cumplimiento.

Actualización posterior de preparación de auditoría: se publicó trazabilidad operativa y validación reforzada de solicitudes. La batería ampliada terminó con 29 pruebas locales y 44 comprobaciones de servidor aprobadas. Véase `auditoria-clinica/README.md` para despliegue, regresión corregida, resultados conservados y brechas pendientes. Los resultados de la tabla siguiente corresponden a la revisión inicial y no certifican la clínica.

## Resultado de las pruebas

| Verificación | Resultado y límite |
| --- | --- |
| Identidad del proyecto | `npm run check:project` aprobado. |
| Pruebas automatizadas locales | 24 aprobadas: autenticación, validación del tenant, profesionales/sedes, fechas y errores de Huli, separación de la demo e identidad del proyecto. Los escenarios de otros usuarios e inactividad se verificaron con dobles de prueba, no cambiando cuentas de producción. |
| API en producción | 36 comprobaciones aprobadas en getstratosai.com y app.stratoscapitalgroup.com. Evidencia sin datos de pacientes ni credenciales en `dental-live-audit-2026-09-27.json`. |
| Sesión real | Sesión del administrador renovada y aceptada en ambos dominios. El inicio de sesión y la redirección automática a `/clinica-dental` se observaron en navegador en el turno anterior. |
| Consultas Huli | Pacientes, citas y disponibilidad respondieron HTTP 200. Un paciente; cero citas y cero horarios en la fecha probada. Una agenda vacía prueba la respuesta vacía, no el renderizado de citas reales. |
| Controles negativos | Sin sesión, token falso y cookie antigua: 401. Origen ajeno y profesional/sede ajenos: 403. Fecha/búsqueda/paginación inválidas: 400. Cuerpo grande: 413. Método no permitido: 405. |
| Privacidad de respuestas | `Cache-Control: private, no-store`. Pacientes limitados a identificador y nombre. No se guardaron nombres ni respuestas clínicas en la evidencia. |
| Compilación y revisión estática | Build aprobado; lint de la integración aprobado. Advertencia existente de tamaño de algunos bundles: requiere medición en dispositivos, no demuestra un fallo por sí sola. |
| Secretos en frontend | 157 archivos compilados examinados; cero coincidencias de clave API Huli, secreto de sesión o hash privado. Es una búsqueda concreta, no una auditoría completa de seguridad. |
| App instalada en iPhone | Pendiente. Un servidor operativo y el build local no prueban el binario de App Store. |
| Pruebas visuales nuevas | Pendientes: el control del navegador dejó de responder durante esta revisión. Pacientes, Agenda y Copilot se observaron en el turno anterior. No se repitieron logout, reconexión, accesibilidad ni tamaños de pantalla en esta revisión. |
| Citas con contenido, múltiples profesionales y paginación amplia | Pendientes con datos de prueba autorizados. La cuenta actual no dispone de esos escenarios. |
| Escritura, recordatorios y expediente | No implementados por esta integración; no se crearon, modificaron ni cancelaron citas o pacientes durante la auditoría. |

Repetir la auditoría con una sesión privada: `DENTAL_AUDIT_SESSION=/ruta/privada/sesion.local DENTAL_AUDIT_REPORT=/ruta/reporte.json node scripts/audit-dental-live.mjs`. El script renueva la sesión y consulta datos, sin escribir en Huli. Nunca almacenar el archivo de sesión en Git ni adjuntarlo al informe.

## Qué es el producto actual

Es un piloto de consulta administrativa conectado a Huli. Pacientes muestra nombres; Agenda consulta citas; Copilot consulta horarios disponibles. Este Copilot no diagnostica, interpreta radiografías, prescribe ni recomienda tratamientos. El botón Agendar en Huli abre el calendario del proveedor y requiere su sesión correspondiente.

El tenant de Stratos es independiente, pero no se creó una organización dental nueva en Huli: se utiliza la cuenta existente que el propietario autorizó. Huli informa Radiología y Consultorio Virtual. Ese dato se muestra expresamente. El nombre visual dental no acredita especialidad, cédula ni autorización de un consultorio odontológico. Para una clínica real deben validarse el profesional, sede, permisos y datos efectivos del proveedor.

La autorización de esta integración está restringida a un solo administrador activo. No es una implementación terminada de permisos para recepción, odontólogos y dirección. Tampoco se probó todo el esquema RLS de la plataforma ni todos sus módulos.

## Cómo usarlo hoy

1. Entrar en el login oficial con la cuenta asignada y confirmar el tenant Clínica Dental.
2. En Mi clínica, verificar profesional, sede y zona horaria reales. La sede actual usa America/Mexico_City; no suponer que es la hora de Tijuana.
3. En Pacientes, buscar por nombre y usar Actualizar. La lista no sustituye el expediente ni permite abrir historia clínica.
4. En Agenda, elegir fecha, profesional y sede. Una pantalla vacía significa que la consulta no devolvió citas para esa selección.
5. En Copilot, consultar disponibilidad. No interpretar disponibilidad como reserva confirmada. Abrir Huli, completar allí el registro y volver a actualizar Stratos.
6. Conservar notas clínicas y consentimientos en el sistema de expediente que la clínica haya validado. No usar el CRM comercial como expediente improvisado.
7. Cerrar sesión al terminar y no compartir cuentas entre empleados. La contraseña usada durante la configuración es de demostración y fue compartida en esta conversación: sustituirla antes del uso con pacientes reales, con cuentas individuales y recuperación de acceso controlada.

Para demostraciones comerciales, emplear registros ficticios separados. No proyectar pacientes reales ante terceros. Recepción debe gestionar agenda; el odontólogo valida el expediente y la atención; dirección supervisa accesos, incidentes y cumplimiento. Esos roles son el objetivo operativo, no permisos ya habilitados en este piloto.

## Marco aplicable y evidencia faltante

### Expediente y atención odontológica

La [NOM-004-SSA3-2012](https://sidof.segob.gob.mx/notas/docFuente/5272787), numerales 5.1, 5.4, 5.10 y 10.1, establece obligaciones sobre integración del expediente, conservación mínima de cinco años desde el último acto médico, identificación y firma de notas y cartas de consentimiento en los supuestos aplicables. Falta demostrar que el sistema elegido conserva documentos, autores, fechas, firmas, versiones y recuperación. Una agenda no satisface esas obligaciones.

La [NOM-013-SSA2-2015](https://sidof.segob.gob.mx/notas/docFuente/5462039), capítulo 9, desarrolla el expediente odontológico: historia, odontograma y periodontograma iniciales y de seguimiento, estudios e interpretación, diagnóstico, plan de tratamiento y notas de evolución. Esas funciones no existen en esta interfaz. Deben verificarse en Huli o implementarse con revisión profesional; no se presume que Huli las cumpla por tener API. El [catálogo oficial](https://platiica.economia.gob.mx/normalizacion/nom-013-ssa2-2015/) la identifica vigente. Una propuesta de modificación no debe tratarse como norma ya sustituida.

La [NOM-024-SSA3-2012](https://platiica.economia.gob.mx/normalizacion/nom-024-ssa3-2012/) trata sistemas de registro electrónico e intercambio de información en salud. Para incorporar expediente e interoperabilidad se debe determinar su alcance y evaluación de conformidad aplicable con la autoridad competente, incluidos requisitos técnicos y evidencia del proveedor. No existe evidencia de esa evaluación para Stratos en esta revisión.

### Datos personales: obligación adicional a la sanitaria

La [LFPDPPP vigente, reforma publicada el 14-11-2025](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), regula finalidades, información, consentimiento, seguridad y derechos de las personas. El artículo 8 exige consentimiento expreso por escrito para datos sensibles, sujeto a las excepciones legales; los artículos 14–15 regulan el aviso y el 18 las medidas de seguridad. El consentimiento para tratamiento de datos y el consentimiento para un procedimiento clínico tienen objetos distintos.

Falta identificar formalmente responsable y encargados, aviso específico de la clínica, finalidades, mecanismos ARCO, conservación y supresión, proveedores y subencargados, transferencias y alojamiento. Revisar contratos Huli–clínica–Stratos y servicios de hosting/autenticación. La revisión no confirma ubicación de datos, cláusulas contractuales ni respaldos de los proveedores. No enviar datos a herramientas de IA o campañas hasta establecer finalidad, base jurídica y controles correspondientes.

### Establecimiento físico y publicidad

Verificar los [avisos de funcionamiento y responsable sanitario aplicables](https://www.gob.mx/cofepris/acciones-y-programas/aviso-de-funcionamiento-responsable-sanitario-y-otros-para-establecimientos-que-ofrecen-servicios-de-salud), identidad y cédulas de los profesionales. El trámite y las autorizaciones dependen de los servicios efectivamente prestados; no se presentaron documentos de la clínica en esta auditoría.

La [NOM-005-SSA3-2018](https://www.diariooficial.gob.mx/normasOficiales/8305/salud11_C/salud11_C.html) contiene requisitos mínimos de infraestructura y equipamiento ambulatorio. La [NOM-087-SEMARNAT-SSA1-2002](https://platiica.economia.gob.mx/normalizacion/NOM-087-SEMARNAT-SSA1-2002/) regula residuos biológico-infecciosos. Si se realizan estudios con rayos X, revisar además alcance, modificaciones y autorizaciones de la [NOM-229-SSA1-2002](https://platiica.economia.gob.mx/normalizacion/nom-229-ssa1-2002/). Nada de esto se acredita con pruebas de software: requiere inspección, documentación y personal responsable.

Consultar la [guía de autoverificación de COFEPRIS](https://www.gob.mx/cofepris/documentos/guia-autoverificacion-establecimientos-de-atencion-medica-ambulatoria-o-consultorios-medicos-generales-y-de-especialidad) para levantar evidencia del consultorio. Evaluar el [trámite de aviso publicitario](https://www.gob.mx/public/tramites/detalleTramite.xhtml?homoclave=COFEPRIS-02-002-A) u otro que corresponda al anunciante y servicio. Evitar prometer certificación COFEPRIS o resultados clínicos que no estén sustentados.

### IA con finalidad médica

La [guía de registro sanitario de dispositivos médicos de COFEPRIS](https://www.gob.mx/cofepris/documentos/guia-para-la-obtencion-del-registro-sanitario-de-dispositivos-medicos) contempla software como dispositivo médico. Inferencia para este producto: si se pretende interpretar imágenes, apoyar diagnóstico o decidir tratamientos, hay que evaluar la finalidad prevista y clasificación regulatoria antes de habilitarlo o comercializarlo con esas afirmaciones. La etiqueta Copilot por sí sola no determina la clasificación. La consulta actual de horarios no demuestra validación clínica de IA.

## Acciones para pasar del piloto a una clínica operativa

| Prioridad | Acción | Responsable y evidencia de cierre |
| --- | --- | --- |
| Antes de pacientes reales | Identificar clínica, servicios, profesionales y sede real en Huli. | Clínica: documentos, cédulas, autorizaciones aplicables y configuración verificada. |
| Antes de pacientes reales | Aviso de privacidad y contratos del tratamiento de datos; separar demostración y producción. | Clínica y asesoría de privacidad: textos y contratos revisados, finalidad y consentimiento documentados. |
| Antes de múltiples empleados | Cuentas individuales y roles, baja/revocación de acceso, recuperación y evaluación de MFA. | Stratos: matriz recepción/odontólogo/dirección y pruebas de autorización por tenant. No ampliar el acceso usando la misma cuenta. |
| Antes de expediente | Seleccionar sistema fuente y validar contenido odontológico, firmas y correcciones con historial. | Dirección clínica y proveedor: muestras completas, trazabilidad y evaluación normativa aplicable. |
| Antes de expediente | Respaldos, restauración comprobada, exportación, retención y continuidad. | Proveedor: ensayo de recuperación y objetivos de recuperación acordados. Un documento comercial de respaldo no basta. |
| Antes de uso habitual | Bitácora de accesos/consultas sin copiar datos clínicos, alertas e incidentes; revisar limitación de solicitudes. | Stratos/proveedores: diseño, pruebas y procedimiento de respuesta. No hay bitácora clínica propia visible en el gateway revisado. |
| Antes de móvil validado | Probar el binario instalado con login, tenant, consultas, cierre, bloqueo, reanudación, pérdida de red y enlaces Huli. | QA: dispositivo/version/build identificados y evidencia. Revisar declaraciones de privacidad y manejo de datos de salud en App Store. |
| Antes de recordatorios | Plantillas y preferencias de contacto, separación de comunicación asistencial y marketing. | Clínica: finalidades, bajas y controles; mensajes mínimos que no revelen diagnósticos. No están habilitados actualmente. |
| Antes de escalar venta | Pruebas con agenda poblada, varias sedes, usuarios de otra organización y fallos del proveedor. | QA: fixtures autorizados, prueba E2E y matriz de regresión sin pacientes reales en reportes. |
| Antes de IA médica | Delimitar función, evaluar clasificación y ruta de registro cuando corresponda; validación y supervisión clínica. | Responsable regulatorio y clínico: dictamen de alcance y evidencia requerida. |

## Decisión actual

Las consultas administrativas probadas funcionan. No se puede declarar cumplimiento integral, expediente validado, IA médica autorizada ni app móvil completamente probada. El uso con una clínica real exige cerrar las brechas documentales y técnicas relevantes a su alcance. La referencia inicial para avanzar es administración y consulta; el usuario aún no ha confirmado si desea también expediente o apoyo diagnóstico.
