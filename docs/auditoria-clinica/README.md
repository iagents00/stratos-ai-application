# Expediente de preparación de auditoría — Stratos / Clínica Dental

Estado: preparación técnica de un piloto administrativo. No autorizado en este expediente para afirmar conformidad integral, expediente electrónico validado, IA diagnóstica ni certificación COFEPRIS.

## Cierre de esta revisión técnica

29 pruebas locales aprobadas; 44 comprobaciones de servidor aprobadas en producción, sin fallos en la repetición final. Lint de los archivos modificados aprobado y build de producción completado. El despliegue final se identifica en `verificacion-despliegue.json`. Ambos dominios conservan identidad Stratos y rechazan acceso sin sesión.

La primera prueba de producción encontró dos fallos de JSON mal formado: `primera-prueba-produccion.json` conserva esa evidencia. Se corrigió la lectura del parser de Vercel, se añadió una prueba de regresión y se repitió la batería. No se sustituyó el resultado fallido por una afirmación de éxito sin comprobar.

Se observaron y analizaron 38 eventos operativos del primer despliegue mediante el acceso del proyecto al hosting. `verificacion-logs.json` sólo conserva un resumen sin usuarios ni información clínica. La retención y custodia inalterable siguen pendientes. El navegador no respondió en esta revisión, por lo que no se cerraron las pruebas visuales ni la del iPhone.

## Evidencia y control documental

- `../CLINICA_DENTAL_AUDITORIA_Y_USO_2026-09-27.md`: alcance, fuentes oficiales, operación y brechas identificadas.
- `../dental-live-audit-2026-09-27.json`: verificaciones del servidor de ambos dominios; no incluye información clínica o credenciales.
- `pruebas-locales.txt`: resultados de la batería automatizada de esta revisión.
- `manifest.json`: huellas SHA-256 de evidencia y código relevante, fecha y revisión Git. Permite detectar cambios frente a esta copia, pero no equivale a firma digital ni custodia inalterable.
- `registro-de-brechas.csv`: estado, responsables por asignar y evidencia necesaria. Un procedimiento escrito no implica que se ejecutó.
- `procedimientos.md`: procedimientos propuestos de acceso, incidentes y continuidad, pendientes de adopción y ejercicio con la clínica.
- `datos-y-documentos-pendientes.md`: datos y soportes necesarios para completar la revisión.

## Criterio de liberación

La dirección de la clínica y el responsable sanitario deben aprobar alcance y operación. El responsable de privacidad debe validar aviso, contratos y finalidad del tratamiento. El equipo técnico debe cerrar los controles de acceso, protección, recuperación y pruebas de dispositivo que correspondan al uso acordado. No hay aprobación o firma registrada en este expediente.

Cada brecha se cierra con evidencia fechada, responsable identificado y verificación. Nunca marcarla resuelta porque existe una plantilla, un proveedor anuncia cumplimiento o una prueba de servidor pasó.

## Registro operativo añadido

El gateway emite un evento JSON por respuesta: fecha, identificador generado por el servidor, método, acción permitida, estado, duración y, sólo tras autorización completa, usuario y organización. No incluye tokens, búsquedas, cuerpos de solicitudes, nombres ni identificadores de pacientes, IP ni respuestas Huli.

El hosting recibe esos eventos como logs operativos. Falta verificar y documentar retención, exportación, permisos administrativos, monitoreo y recuperación. No se implementó una bitácora clínica persistente de firmas o cambios del expediente. La traza de consultas no sustituye esa bitácora.

## Marco de referencia

Consultar las fuentes en la guía principal y su alcance: NOM-004-SSA3-2012, NOM-013-SSA2-2015, NOM-024-SSA3-2012, LFPDPPP vigente y trámites sanitarios pertinentes. La aplicabilidad a cada servicio debe confirmarse con profesionales responsables. La clínica física, sus autorizaciones y sus prácticas no han sido inspeccionadas.
