# QA de portada Stratos AI — 16 de octubre de 2026

Resultado de la primera ronda: **25/25 comprobaciones funcionales aprobadas**. Hay un ajuste visual localizado en el control del titular a 320 px, pendiente de consolidar con la revisión independiente. No se editaron archivos de implementación durante QA.

Build web local: `stratos-v443`, base `21d509135f28579e6fca909302ceaff798bf6bc3`, compilado `2026-10-16T17:08:01.698Z` con el árbol de trabajo de la nueva portada. Preview aislado: `http://127.0.0.1:5203/`. Navegador Chromium mediante Playwright CLI, sesión aislada `marketing-qa`.

## Evidencia validada

Las capturas completas comienzan en el inicio de la página, con el titular y la galería pausados deliberadamente para evitar capturar transiciones. Cada PNG se abrió y decodificó; las fuentes locales y las imágenes visibles estaban cargadas.

| Vista | Viewport | Captura completa | Dimensiones |
| --- | --- | --- | --- |
| Escritorio | 1440 × 1000 | `desktop.png` | 1440 × 9064 |
| Móvil | 390 × 844 | `mobile.png` | 390 × 12701 |
| Móvil estrecho | 320 × 812 | `user-320.png` | 320 × 13192 |

Primer viewport y galería: `../../../output/playwright/marketing-qa/{desktop,mobile,user-320}-{viewport,gallery}.png`. Las capturas históricas versionadas de Rails en `.impeccable/review/desktop.png` y `mobile.png` quedaron idénticas a HEAD; la evidencia nueva está separada en la carpeta fechada.

La galería cargó las seis capturas reales desde `/marketing/modules/{copilot,crm,mi-espacio,metricas,comando,iagents}.webp`, con dimensiones originales correctas. Switzer e Inter locales estaban disponibles en las tres vistas. El documento mide exactamente 1440, 390 y 320 px respectivamente: no hubo desbordamiento horizontal de página. La banda de servicios es estática y tiene desplazamiento horizontal interno en móvil; la comparación también conserva su desplazamiento interno.

## Comprobaciones

1. El titular cambia automáticamente.
2. El control del titular detiene los cambios durante más de un ciclo.
3. La galería avanza cada 2800 ms cuando está en el viewport sin hover ni foco.
4–9. Cada una de las seis opciones manuales selecciona su panel y carga la imagen correspondiente.
10. Flechas, Home y End seleccionan el panel correcto, incluido el salto circular.
11. La pausa explícita de la galería mantiene el panel durante más de un ciclo.
12. Movimiento reducido detiene la rotación, desactiva la reproducción automática y permite elegir manualmente.
13. Habla, Procesa y Claridad cargan las capturas reales de Copilot, CRM y Comando.
14. Las ocho preguntas frecuentes abren, muestran respuesta y vuelven a cerrar.
15. Los tres planes y sus contactos tienen URL de WhatsApp correcta, mensaje contextual y apertura segura en otra pestaña. No se enviaron mensajes.
16. Las anclas de Solución, Características, Precios y Enterprise llegan a su sección por debajo del header.
17. Escritorio: fuentes cargadas y documento sin overflow.
18–19. Móvil390: Escape cierra menú y devuelve foco; elegir Precios cierra menú y llega a la sección.
20. Móvil390: fuentes cargadas y documento sin overflow.
21–22. Móvil320: Escape cierra menú y devuelve foco; elegir Precios cierra menú y llega a la sección.
23. Móvil320: fuentes cargadas y documento sin overflow.
24. Iniciar sesión llega a `/login`, conserva URL tras recarga y elimina el scope CSS de la portada.
25. `/diagnostico` carga correctamente en una pestaña local separada; no se completa ni envía el formulario.

El total exacto y los resultados de las comprobaciones están en `../../../output/playwright/marketing-qa/QA.json`.

## Hallazgo para el único lote de correcciones

A320 px, el área de44 ×44 del control del titular ocupa x264–308, y221.56–265.56. La primera línea del subtítulo ocupa x31.38–288.63, y249.56–269.56. Se intersectan; el icono queda flotado cerca del texto. Evidencia: `user-320-viewport.png`. Reservar espacio vertical para el control o separar el subtítulo evita la colisión sin cambiar la dirección visual. A390 no se detectó colisión con la línea del subtítulo.

No hubo errores de ejecución de página ni respuestas HTTP fallidas. Se observó una solicitud de conectividad a Supabase con `select=id&limit=0` cancelada al navegar (`ERR_ABORTED`); no devolvió datos de clientes y no fue un fallo de recurso de la portada. La advertencia de configuración fallback de Supabase ya existente no impidió cargar la portada.

No se inició sesión en una cuenta productiva ni se consultaron expedientes reales. Las imágenes de la portada son los artefactos de demo ya documentados en `../../../public/marketing/modules/README.md`.

## Confirmación del único lote — build final

El ajuste móvil quedó aprobado en 1440/390/320. El botón mide 44 × 44 y ahora participa del flujo en 390/320; hay 24 px entre su borde inferior y el subtítulo, sin intersección. Titular y galería responden a sus clics de pausa/reanudación en las tres vistas. Fuentes e imágenes cargadas, documento sin overflow y cero errores de página/HTTP. Se actualizaron las mismas tres capturas completas y seis recortes. Detalles, hashes y manifiesto del build final en `confirmation.json`. El hallazgo anterior está resuelto.
