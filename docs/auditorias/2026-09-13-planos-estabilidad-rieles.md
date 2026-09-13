# Auditoría de planos, estabilidad y Ventas sobre Rieles

13 de septiembre de 2026. Revisión incremental sobre la entrega v426 y la rama aislada codex/system-audit-live-20260912. La carpeta original con trabajo sin confirmar se preservó. El alcance incluye web, rutas de servidor versionadas, modelo de operación y SQL de Rieles; no acredita todos los servicios remotos.

## Resultado

Se sustituyeron las guías obsoletas de prototipo por un punto de entrada operativo; se generó un inventario adicional y se añadieron diagnóstico, identificación de entregas, ensayo de reversión y verificación de integridad de respaldos. Se corrigió el guardado de configuración y resultados de Rieles y se preparó protección del servidor con historial de cambios.

**La salida al mercado con una promesa de recuperación integral en minutos sigue condicionada a restauración y permisos remotos verificados.** Una web compilada y un respaldo con hash correcto no acreditan recuperación del sistema completo.

## Hallazgos y resolución

| Prioridad | Problema | Acción de esta entrega | Estado |
|---|---|---|---|
| P1 | README/CLAUDE describían Auth y base como pendientes | Guías actualizadas al código vigente; manual operativo de entrada | Corregido en Git |
| P1 | Planos omitían consultas con comillas simples | Generador acepta ambas; nuevo inventario cubre API/Edge/workflows y variables | Corregido en Git y control CI |
| P1 | Confundir main con producción tras promociones | Manifiesto /release.json + diagnóstico de SHA, recurso y SW | Implementado para esta entrega |
| P1 | Configuración Rieles optimista se mostraba guardada al fallar | Publicación solo tras fila confirmada, error y borrador conservado | Corregido y probado |
| P1 | Dos admins podían sobrescribir datos de configuración | Lectura de versión esperada y compare-and-swap de meta_config | Corregido y probado con conflictos |
| P1 | Tienda global podía mezclar respuestas tardías de organizaciones | Tienda por persona/org/rol; invalidación de respuestas anteriores al guardado | Corregido y probado |
| P1 | Vendedor podía forzar activación/desactivación por URL | Override limitado a admin/super_admin; guardado rechaza otros roles | Corregido en cliente; servidor adicional preparado |
| P1 | Hecho ocultaba tarea sin confirmar persistencia | Error visible y tarjeta pendiente; doble clic bloqueado | Corregido y probado en navegador |
| P1 | RPC validaba organización pero no propiedad del cliente | Migración 243 valida alcance, opt-out y revoca escrituras directas | SQL probado en aislamiento; despliegue pendiente |
| P1 | Falta de historial de cambios de proceso | Historial por organización y actor; escritura/borrado directo prohibidos | SQL probado en aislamiento; despliegue pendiente |
| P1 | Tarjetas podían mantener clientes dados de baja o no contactables | Reconciliación filtra opt-out, bajas, cierre y seguimiento futuro | Corregido y probado |
| P1 | “Respaldo completo” truncaba datos y excluía sistemas enteros | Exportación paginada y alcance explícito; manual de restauración real | Exportación corregida; restauración real pendiente |
| P2 | Todos los cierres contaban como hechos y ocultaban cartera restante | Realizados, reprogramados y sin respuesta separados; siguiente lista | Corregido y probado |
| P2 | WhatsApp prellenaba instrucciones internas para el vendedor | Abre chat sin convertir la instrucción en mensaje al cliente | Corregido |
| P2 | Sin retorno claro al proceso después de consultar CRM | Volver a Mi Día sin alterar configuración del equipo | Corregido |
| P2 | Admin modificaba equipo al tocar cada control | Borrador, ejemplo y publicación explícita; controles con nombres accesibles | Corregido; QA escritorio y móvil |
| P2 | Diagnóstico decía “todo en pie” con solo HTML/Auth health | Comprueba recurso ejecutable, manifiesto y versión; declara exclusiones | Corregido y probado |

## Pruebas

- **15 tests Node**: regresiones de la entrega anterior, permisos de configuración, conflicto entre admins, aislamiento de tiendas, errores de agenda, opt-out/fechas, recursos web rotos, revisión incorrecta, respaldos corruptos, proyecto equivocado y antigüedad.
- **12 comprobaciones PostgreSQL** usando PGlite 0.5.8 y datos sintéticos: SQL válido, rechazo de vendedor y admin ajeno, auditoría admin, historial protegido, escrituras directas denegadas, idempotencia, alcance por asesor, opt-out y anon.
- Navegador con fixture reproducible tests/fixtures/rails-qa.html: error de escritura conserva tarjeta; dos realizados y un sin respuesta se cuentan por separado; siguiente lista disponible; reprogramación confirma fecha; borrador cambia la vista previa y no publica en modo demo.
- Vistas de vendedor y administrador inspeccionadas en escritorio oscuro y móvil claro 390×844, sin desbordamiento horizontal. La prueba es de interfaz y datos ficticios, no una evaluación con vendedores reales de Duke.
- Detector de interfaz sin hallazgos emitidos en las tres superficies nuevas. No certifica WCAG completo.
- Build web y build móvil con verificaciones del repositorio; gate de sintaxis/referencias/hooks. El lint completo conserva deuda histórica.
- Ensayo de rollback: verificación del ID histórico v426, proyecto y estado READY; comando de promoción generado sin alterar producción.
- Diagnóstico anterior: 715 ms para tres dominios y servicios; web/JS/SW/Auth/PostgREST disponibles. Detectó correctamente que v426 no tenía manifiesto. Es una medición puntual, no un SLA.

## Evaluación de interfaz acotada

| Dimensión | /4 | Evidencia y límite |
|---|---:|---|
| Accesibilidad | 3 | Etiquetas, foco visible, controles grandes y estados; falta auditoría asistiva completa |
| Rendimiento | 3 | Lista limitada y config compartida; bundle general conserva deuda |
| Responsive | 3 | Escritorio y 390 px inspeccionados; falta matriz completa de dispositivos |
| Temas | 3 | Tokens y temas claro/oscuro verificados en las superficies intervenidas |
| Integridad | 3 | Éxito confirmado, conteos correctos y borrador; servidor y restauración remotos pendientes |
| Total | 15/20 | Solo Rieles intervenido; no extrapolar a toda la aplicación |

## Limitaciones que deben cerrarse

1. Supabase Stratos y n8n siguen sin sesión administrativa. No se aplicó migración 243 ni las protecciones Edge de la entrega previa. Probar políticas remotas y compatibilidad de n8n antes de revocar escrituras directas de agenda.
2. No hubo ensayo real de restauración de base/Storage/n8n ni validación de backups/PITR contratados. Asignar responsables y suplentes con acceso probado.
3. Reprogramación conserva dos escrituras (fecha del lead y resultado de agenda). Se muestra éxito parcial si la segunda falla. La RPC conjunta requiere diseño y despliegue coordinado para hacerlo atómico.
4. Jornada de agenda usa CURRENT_DATE del servidor (UTC); se alineó el reinicio de interfaz. Falta zona comercial por organización para jornadas locales exactas.
5. El motor conserva reglas inmobiliarias. Cada admin debe revisar instrucciones antes de activar para otros sectores; no implica ERP completo ni validación de todas las reglas de etapas en servidor.
6. Falta ensayo real de vendedores de Duke y canales externos controlados, monitoreo continuo con recepción de avisos acreditada y cobertura de app cerrada.
7. El PR requiere una revisión según la protección de main. Una promoción web no integra el código a main.

## Entrega y reversión

La publicación web compatible utiliza las RPC existentes. La nueva migración está separada; no se afirma que Vercel la publique. Consultar /release.json y Vercel para el SHA efectivo y el [manual de operación](../operacion/README.md) para volver a una entrega conocida. No se cambiaron reglas de ninguna organización durante la QA ni se enviaron mensajes a prospectos.

Referencias de diseño: [Salesforce Path](https://trailhead.salesforce.com/content/learn/modules/sales_admin_optimize_salesforce_for_selling/sales_admin_optimize_for_selling_unit_1) y [HubSpot Pipeline Rules](https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules). Se aplican orientación contextual y configuración administrada; no se presume equivalencia funcional con esas plataformas.
