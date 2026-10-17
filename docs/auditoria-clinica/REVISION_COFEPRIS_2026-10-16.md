# Stratos AI + Huli: revisión regulatoria y preparación de evidencia

Fecha de consulta de fuentes: 16 de octubre de 2026. **Alcance actualizado por el usuario: exclusivamente una demo con datos ficticios**, sin expediente Huli real, cambios en datos reales ni habilitación de atención clínica. La revisión normativa siguiente conserva la referencia para una eventual puesta en producción. No es un dictamen de conformidad ni acredita la operación de una clínica.

## Estrategia de la demo

El prototipo muestra cómo trabajar desde Stratos mediante Copilot, enlaces internos y borradores. Debe permitir explorar tres complejidades sin atribuirles validación sanitaria:

| Escenario ficticio | Flujo que se demuestra |
| --- | --- |
| Clínica simple | Un profesional consulta sus expedientes asignados y prepara un borrador. |
| Clínica intermedia | Odontología con un médico y recepción; expedientes separados de la agenda administrativa. |
| Clínica compleja | Dos médicos con expedientes propios y uno compartido por asignación expresa, más recepción y dirección operativa. |

Los escenarios no sustituyen flujos especializados como hospitalización, urgencias, cirugía, farmacia o imagenología. El tipo de atención determinaría documentos, controles y normas adicionales al pasar a un uso real; NOM-013 se refiere al escenario odontológico.

Reglas del prototipo:

1. **Datos ficticios:** no consultar, importar, editar ni almacenar expedientes o pacientes reales. No conectar el simulador a Huli ni a repositorios clínicos. Los borradores y respuestas pertenecen únicamente a la demostración.
2. **Enlaces:** Copilot puede mostrar una ruta a un expediente ficticio, pero conocerla no concede permiso. No poner credenciales, tokens, datos personales ni secretos de acceso en ruta, parámetros o fragmentos. Un identificador de ruta no funciona como autorización.
3. **Roles simulados:** el médico ve sólo expedientes asignados. Recepción y administración operativa ven la información administrativa ficticia pertinente y no el contenido del expediente. La demo debe explicar los accesos denegados.
4. **Seguridad simulada:** la cuenta, contraseña y lista de permisos en el cliente ilustran un flujo. No son controles de seguridad de producción: pueden inspeccionarse y alterarse desde el navegador. Una futura versión real necesita autenticación y autorización en servidor para cada lectura, enlace y cambio.
5. **Borradores:** permitir que el médico aporte información y revise lo preparado. Mostrar el estado de borrador y autor humano revisor; no emitir firma clínica, receta, diagnóstico automático ni constancia de acto médico. Una aceptación visual no equivale a firma legal.
6. **Copilot demostrativo:** usar lógica determinista y contenido ficticio; no enviar texto ni datos a modelos o servicios externos. Explicar esta condición en la interfaz para que no se confunda con una IA clínica validada.
7. **Salida:** identificar claramente la demo y sus límites. No mostrar sellos de cumplimiento, certificación de Stratos ni garantías sobre resultados de una visita COFEPRIS.

La demo puede entregarse y probarse sin resolver los pendientes documentales de una clínica real. Antes de tratar datos reales, deben revisarse por separado los controles y documentos de las secciones siguientes; el usuario no solicitó habilitarlos en esta tarea.

## Resultado

La conexión funcional, el alojamiento en AWS y una referencia a HIPAA no acreditan por sí mismos los requisitos mexicanos ni extienden una certificación a Stratos. Se debe cotejar el sistema y la versión usados, su configuración, el alcance del intercambio, la operación de la clínica y los documentos de soporte.

El catálogo oficial de la Secretaría de Economía identifica como **vigentes** las tres normas revisadas:

| Norma | Publicación / entrada en vigor | Fuente oficial de vigencia |
| --- | --- | --- |
| NOM-004-SSA3-2012, expediente clínico | 15/10/2012 / 13/12/2012 | [Catálogo Economía](https://platiica.economia.gob.mx/normalizacion/nom-004-ssa3-2012/) |
| NOM-013-SSA2-2015, enfermedades bucales | 23/11/2016 / 24/11/2016 | [Catálogo Economía](https://platiica.economia.gob.mx/normalizacion/nom-013-ssa2-2015/) |
| NOM-024-SSA3-2012, SIRES e intercambio | 30/11/2012 / 29/01/2013 | [Catálogo Economía](https://platiica.economia.gob.mx/normalizacion/nom-024-ssa3-2012/) |

La inclusión de una modificación en un programa de normalización no sustituye por sí sola una norma vigente.

## Qué hay que conservar y demostrar

- **Expediente:** el establecimiento y los profesionales deben integrarlo y conservarlo; la NOM-004 exige al menos cinco años desde el último acto médico. Las notas identifican al autor y contienen fecha, hora y firma conforme al medio aplicable. La información requiere confidencialidad y entrega controlada. Una ficha de CRM o el historial de conversación del Copilot no sustituye el expediente. [NOM-004, numerales 5.1, 5.4–5.10 y 5.12](https://dof.gob.mx/normasOficiales/4909/SALUD/SALUD.html).
- **Atención dental:** si ese es el servicio efectivo, verificar historia clínica, odontograma y periodontograma iniciales y de seguimiento, diagnósticos, plan, evolución por atención, estudios e interpretaciones, firmas y consentimiento clínico pertinente. No se ha validado una muestra completa ni que la cuenta configurada corresponda al establecimiento dental. [NOM-013, capítulo 9](https://sidof.segob.gob.mx/notas/docFuente/5462039).
- **SIRES:** la NOM-024 contempla gestión de seguridad, autenticación, autorización por roles, integridad, trazabilidad, controles de consentimiento y exportación conforme a las guías aplicables. La vigencia del certificado es de dos años y está sujeta a verificaciones y cambios. La definición de SIRES es amplia: limitar el CRM a lectura administrativa no basta para concluir que está exento. Debe documentarse su aplicabilidad al escenario y a las Guías de Intercambio de Información en Salud (GIIS). [NOM-024, 1, 3.49, 5.8–5.9, 6.3, 6.6 y 7.5.3](https://sidof.segob.gob.mx/notas/docFuente/5280847); [DGIS, preguntas sobre alcance y GIIS](http://www.dgis.salud.gob.mx/contenidos/intercambio/iis_preguntas_gobmx.html).
- **Datos personales:** rige la LFPDPPP expedida el 20/03/2025, con última reforma publicada el 14/11/2025. Los datos de salud son sensibles. Deben documentarse finalidad, proporcionalidad, aviso, consentimiento o excepción aplicable, seguridad, confidencialidad, ARCO y relación con encargados/terceros. El consentimiento sensible normalmente es expreso y escrito; la excepción médica del artículo 9, VI, incluye la condición de que el titular no pueda consentir y obligación de secreto. No es autorización general para enviar expedientes a IA. Diferenciar tratamiento por encargo de transferencia a tercero; revisar también conservación, incidentes y contratos. [LFPDPPP, artículos 2, 5, 8–20, 27–36](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf).

El consentimiento clínico del procedimiento y el consentimiento o fundamento para tratar datos tienen finalidades distintas: conservar la evidencia correspondiente a cada uno.

## Hallazgo específico sobre Huli

La ficha pública DGIS del folio **DGIS-CER-P-019-2026-09** y su PDF identifican **HuliPractice versión 29**, de HuliLabs MX, para sector privado; vigencia publicada **18/09/2026 a 17/09/2028**. El PDF limita la cobertura a 29.x, manteniendo las condiciones evaluadas; excluye 30.x y versiones mayores. Incluye SGSI y guías de consulta externa, salud bucal, salud mental y planificación familiar, dentro del alcance evaluado.

El listado general muestra **versión 30** para ese mismo folio. Esa discrepancia debe aclararse con Huli y, si corresponde, DGIS. No se ha cotejado la versión ni activación de esta cuenta, ni cobertura de su API o de la configuración usada por Stratos. No marcar la integración o la clínica como certificadas.

Fuentes primarias: [ficha DGIS](http://www.dgis.salud.gob.mx/intercambio/certificados/DGIS-CER-P-019-2026-09_gobmx.html), [PDF oficial, ambas caras](http://www.dgis.salud.gob.mx/intercambio/certificados/02_HULILABS_Certificado_20260918_v29.pdf?v=2026.09.21), [listado SIRES DGIS](http://www.dgis.salud.gob.mx/contenidos/intercambio/sires_certificacion_gobmx.html). Las páginas públicas DGIS y el PDF se pudieron consultar por HTTP; la herramienta no pudo consultar su HTTPS. No se enviaron credenciales ni datos privados.

Texto para solicitar a Huli, sin envío automático:

> Necesitamos el certificado DGIS vigente y ambas caras, la versión exacta habilitada en nuestra cuenta, las GIIS y configuración cubiertas, y confirmación documental del alcance de la API usada por nuestro CRM Stratos. Favor de aclarar la diferencia entre versión 30 del listado DGIS y versión 29 de la ficha/PDF del folio DGIS-CER-P-019-2026-09. Necesitamos también condiciones de exportación, auditoría, retención, respaldo y restauración, controles de usuarios y responsabilidades de tratamiento de datos.

## Preparación de la visita sanitaria

La [guía de autoverificación COFEPRIS para consultorios, publicada el 17/04/2025](https://www.gob.mx/cofepris/documentos/guia-autoverificacion-establecimientos-de-atencion-medica-ambulatoria-o-consultorios-medicos-generales-y-de-especialidad) sirve como referencia de preparación. El alcance real depende de servicios y establecimiento. Revisar los avisos/licencias y personal, expedientes, instalaciones, esterilización, insumos, RPBI y radiología cuando corresponda. La carpeta técnica de Stratos cubre una parte de esa evidencia; no inspecciona la clínica física.

Ante una visita, la persona responsable debe identificar al verificador, cotejar orden y alcance, acompañar la revisión y conservar orden, acta y soportes entregados. La entrega de expedientes se controla según solicitud y autoridad competente. [COFEPRIS: visita de verificación](https://www.gob.mx/cms/uploads/attachment/file/752837/Estudio_de_caso_12.pdf).

## Criterios técnicos para una eventual versión real de Stratos y Copilot

Estos criterios quedan pendientes para una eventual liberación con datos reales. No son funciones ni garantías del prototipo:

1. Mantener Huli como fuente clínica y mostrar el alcance administrativo real. Acciones clínicas, firma y escritura requieren un flujo distinto, aprobado y documentado.
2. Comprobar identidad individual, organización, profesional y sede autorizados en servidor en cada acción; no aceptar identificadores del cliente como autorización. Probar acceso cruzado, revocación, expiración y tokens inválidos.
3. Reducir campos, resultados y retención. No enviar automáticamente datos identificables de pacientes ni respuestas Huli a un modelo de IA. Las consultas administrativas pueden resolverse mediante herramientas acotadas y respuestas locales.
4. Mostrar errores, ausencia de datos, paginación, zona horaria y origen de información con precisión. No presentar disponibilidad vacía como confirmación de cita; crear/modificar/cancelar sólo por un flujo realmente implementado y verificado.
5. Registrar trazas de actor, organización, acción, fecha, resultado e identificador de solicitud sin nombres de pacientes, búsquedas, tokens ni cuerpos clínicos. Los logs operativos requieren custodia, permisos, retención y recuperación verificadas; no equivalen a bitácora clínica inalterable.
6. Exportar una ficha de preparación con alcance, versión de Stratos, pruebas fechadas, metadatos mínimos y pendientes. Identificar por separado evidencia técnica de esta sesión y documentos aún no cotejados. No incluir pacientes ni secretos.
7. Antes de ampliar a expediente o IA clínica, evaluar GIIS, certificado/configuración, controles documentales y profesionales, consentimiento/base de tratamiento, contratos de proveedores, respaldo/restauración y adopción por la clínica.

En la demo, la sección “Controles y evidencia” indica **Demostración con datos ficticios**. El panel **Preparación para revisión sanitaria** mantiene sus documentos como **Evidencia documental pendiente**; no debe sugerir conexión Huli real. Un interruptor, una conexión exitosa o un enlace a un certificado no cierran una brecha. En una versión real, cada cierre necesitaría documento identificable, fecha, responsable y verificación.

Los documentos para una eventual versión real se detallan en [datos-y-documentos-pendientes.md](datos-y-documentos-pendientes.md). Mantenerlos en almacenamiento privado; este repositorio sólo conserva referencias y estado. La demo no impide ni elimina las facultades de verificación de COFEPRIS: las obligaciones de la clínica dependen de sus actividades y uso efectivos.
