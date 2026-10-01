# Recuperación de Stratos AI — 30 de septiembre de 2026

## Incidente confirmado

El dominio público apuntaba a `dpl_7vBVwVb8PDJ7VkP8ZtAdDiuyK9xK`: una publicación CLI del 27 de septiembre, basada en `bea83eab790708224a499c731f7e15ae05dbc6a4` (julio), rama main y `gitDirty=1`. Había sustituido el deployment Git `dpl_8c7CcHZwTH3rjiiDYCEPmWFBZSh3`, SHA `918ecd2ea890d468e74efbf6c7f6bd318dfa54be`, del 25 de septiembre. La integración Huli coincidió con la publicación antigua; la evidencia identifica la carpeta antigua usada para publicar como causa de la regresión. No demuestra que Huli haya cambiado el frontend.

## Fuente reconciliada

Se parte del main remoto de septiembre y se conserva el trabajo local: clínica Huli, Copilot hexagonal y guía, métricas por eventos, indicadores, agenda, menú móvil, puentes WhatsApp y controles de identidad. Se integran los PR 755 (auditoría y fiabilidad), 754 (Rails con confirmación), 762 (empresas y permisos), 764 (aislamiento durante redirección) y 753 (preparación Android 4.7). Se preserva la integración NSG 749 con el número nuevo y receptor existente.

Se conserva el tenant, identidad y asesores originales. Las migraciones locales 090–093 se archivan en `legacy-sql` para impedir que reemplazen dispatchers actuales. Los cambios nuevos tienen números posteriores al 246; nunca ejecutar todo el historial sobre producción para recuperar la interfaz.

## Rails

La configuración por organización inicia apagada. La producción ya tenía rails_resolver_accion, rails_agenda_del_dia y rails_guardar_config. Se probó el guardado con activo=true y luego false dentro de una transacción con ROLLBACK, verificando que las demás opciones permanecen iguales. Lectura final: 33 empresas, 0 con Rails activo. Los administradores pueden activar o desactivar el proceso desde su configuración. Las pruebas de permisos e idempotencia se ejecutan también en PostgreSQL aislado.

## Base de datos y clínica

Se completaron en stratos-prod los límites de empresas nuevas (247), permisos restrictivos de Caja (248) y registro de la consulta autenticada (261), sin cambiar fichas, asesores ni habilitar módulos históricos. La consulta autenticada de permisos devuelve HTTP 200. Se actualizaron whatsapp-admin y admin-create-user al código reconciliado y transcribir-voz para exigir una sesión real. Se prepararon organize-lead-notes y suggest-next-actions, ausentes en producción. Una prueba real detectó que Gemini 2.5 Flash ya no estaba disponible para este proyecto; se sustituyó por Gemini 3.8 Flash con opción GEMINI_MODEL, conforme a https://ai.google.dev/gemini-api/docs/deprecations y https://ai.google.dev/gemini-api/docs/generate-content/latest-model. Los códigos publicados se comparan con la fuente y las comprobaciones de IA usan datos ficticios. Rails ya estaba instalado; no se volvió a aplicar su migración. Huli pasó 44 comprobaciones reales antes de recuperar el frontend, sin escribir pacientes ni citas.

## Prevención y publicación

Vercel mantiene su proyecto original y ahora ejecuta npm run build con control de identidad. La publicación inicial se prepara sin asignar dominios. Después de recuperarla se habilita la actualización automática desde main con build:vercel: fuente exacta comparada con GitHub, pruebas previas y comprobación de main al finalizar. Las alternativas manuales siguen preparando y promoviendo una entrega identificada.

release:check exige la carpeta principal, Git limpio, repositorio correcto, HEAD igual a origin/main reciente y Validar Stratos aprobado. release:promote verifica proyecto, SHA, READY, gitDirty y release.json antes de cambiar dominios. release.json identifica proyecto, commit y versión de service worker. Se conserva el monitor horario que detectó correctamente el frontend antiguo.

Publicar desde /Users/ivanrodriguezruelas/stratos-ai-application: integrar el PR, actualizar la copia principal preservando su historial y cambios, ejecutar npm run check:project, npm run deploy:production y npm run release:promote -- URL. Verificar después identidad, release.json, dominios y clínica.

## Trabajo pendiente preservado

El PR 749 se cerró después de comprobar que sus cuatro archivos de integración están preservados byte por byte en main, con numeración SQL actualizada. Los PR históricos se marcaron stratos-historico para comprobar su vigencia antes de integrar. Los PR 711 (secuencia de webinar del 2 de septiembre) y 616 (expresamente marcado NO MERGEAR) se mantienen para revisión específica. Los PR antiguos 580, 571, 270, 221, 218, 189, 156, 64, 42 y 16 se conservan; no se reemplaza código actual con ramas antiguas sin confirmar su vigencia. No se eliminan proyectos Vercel, historial ni ramas como parte de esta recuperación.

## Verificación

64 pruebas de aplicación, 34 pruebas de Rails y 12 controles PostgreSQL; revisión de módulos para 14 empresas y dos roles; control de rutas por tenant; compilaciones web y app; guardas iOS, identidad, migraciones, referencias, RPC y catálogo operativo. La comprobación runtime no detecta referencias indefinidas ni hooks condicionales; subsisten avisos de estilo del código previo. Las publicaciones a las tiendas y las pruebas de cada proveedor de llamadas, mensajes y campañas tienen ciclos propios; no se consideran demostradas por una compilación.

## Organización permanente

A petición del usuario, se conserva PR obligatorio y CI para main, sin exigir una segunda cuenta aprobadora. Se documenta el flujo en AGENTS.md y DEPLOYMENT.md. La publicación automática de Vercel verifica que cada archivo de entrada coincide con main, evitando que un CLI con cambios locales reintroduzca una versión vieja. Las funciones de IA de notas y sugerencias ya responden HTTP 200 con datos ficticios; Gemini 3.5 Flash-Lite resuelve la saturación del modelo principal. La versión web pasa a v435 para renovar cachés.

## Compatibilidad de publicación comprobada

Vercel serializa vercel.json al construir y la CLI añade name y version. El control admite JSON semánticamente equivalente, pero sigue rechazando cambios reales; name=stratos-ai-application y version=2 quedan declarados en la fuente oficial para que Git y CLI produzcan la misma configuración. La compilación Git de producción pasó el control inicial de fuente, las pruebas y el build; una conexión cerrada al repetir la consulta final bloqueó la publicación. Se fuerzan conexiones nuevas y hasta tres intentos para errores transitorios, manteniendo el bloqueo si no se puede verificar main.
