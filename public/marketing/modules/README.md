# Capturas reales de Stratos AI

Capturadas el 16 de octubre de 2026 con Playwright/Chromium en escritorio, tema claro y datos de demostración. Son renders de los componentes reales de Stratos; no contienen imágenes generadas, maquetas ni interfaz añadida.

Los originales PNG se conservan localmente en `output/playwright/marketing-source/`. Cada WebP conserva el tamaño original y únicamente cambia la codificación (Pillow, calidad 93, método 6; sin retoque ni reescalado).

| Archivo | Dimensiones | Procedencia y estado capturado |
| --- | --- | --- |
| `copilot.webp` | 1368 × 948 | `/login` → Entrar como Demo → Copilot; pregunta «Resume mi pipeline» y respuesta local que identifica ocho clientes ficticios. |
| `crm.webp` | 1368 × 948 | `/login` → Entrar como Demo → CRM; cartera, prioridades y lista de clientes ficticios. |
| `mi-espacio.webp` | 1368 × 948 | Misma demo → Mi Espacio → Equipo completo; panel real de agenda personal y profesional. |
| `metricas.webp` | 1324 × 836 | Misma demo → Comando → Histórico; gráfico de evolución y tabla real de Indicadores de Asesores, recortados juntos sin alterar contenido. |
| `comando.webp` | 1368 × 948 | Misma demo → Comando → Histórico; controles y actividad comercial del periodo. |
| `iagents.webp` | 1368 × 948 | Componente real `src/app/views/IACRM.jsx`, renderizado localmente sin cambios con sus datos de ejemplo originales; pestaña Mis Agentes con fichas plegadas. |

## Entorno y límites

Las primeras cinco capturas proceden del build web local con service worker `stratos-v442`, servido mediante Vite Preview en `127.0.0.1:5203`. El manifiesto de ese build registra `builtAt: 2026-10-16T16:09:07.906Z` y base Git `6f64094f0b3e0930efdad6107beb5b48d85fd7b0`, con cambios de la versión 442 aún no confirmados al compilar. Viewport: 1440 × 1000; el recorte omite la navegación global y conserva la interfaz del módulo a tamaño original.

La demo normal no expone iAgents porque aplica las restricciones de organización. Para esa captura se compiló un harness local que importa directamente el componente real IACRM, React y los tokens LP de Stratos. El harness solo aporta el contenedor equivalente al área de contenido; no sustituye componentes, textos ni datos. Se sirvió en `127.0.0.1:5204`, con solicitudes a hosts remotos bloqueadas. Código fuente de IACRM al capturar: SHA-256 `cabba83933246a091349da88cf5133321a874332dd4ef18d74ea862d4e1ad582` (HEAD `21d509135f28579e6fca909302ceaff798bf6bc3`). El harness, su bundle y la captura original permanecen en la carpeta local de evidencias, fuera de las fuentes publicadas.

Las cifras de iAgents, sus indicadores LIVE/Activo y sus canales son ejemplos locales que ya contiene ese componente. No acreditan conexiones, actividad, tiempos de respuesta ni resultados reales de una empresa. La captura muestra el catálogo implementado, sin verificar operación autónoma remota.

Los indicadores comerciales distinguen leads por fecha de creación de hitos por fecha de registro. Las barras de actividad no son tasas de conversión de una misma cohorte. El contador de seguimientos es acumulado; el acceso a métricas, PDF, agenda del equipo y conexiones depende del rol y de la configuración de cada organización.

No se inició sesión con una cuenta productiva ni se consultaron o modificaron datos reales para obtener estas capturas. Copilot resolvió la conversación mediante `copilot-demo.js`; el CRM y la agenda usaron la demo local.
