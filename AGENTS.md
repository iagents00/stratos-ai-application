# Alcance del proyecto

Esta carpeta contiene exclusivamente la plataforma Stratos AI y sus clientes registrados.

- Conservar la identidad de Stratos, el registro de clientes y el aislamiento por organización.
- No convertir esta plataforma en el sitio de otra empresa ni reemplazar contactos de asesores por contactos externos.
- Antes de trabajar o publicar, ejecutar `npm run check:project`.
- La identidad y el destino de publicación están en `project-identity.json`. No cambiar ese destino para publicar otra aplicación.
- Vercel publica automáticamente la fuente oficial de `main` después de verificar fuente y pruebas. Las publicaciones manuales se ejecutan siempre desde esta carpeta; verificar la identidad del sitio resultante.
- Mantener respaldos y material ajeno fuera de `src`, `public` y `dist`.

## Flujo obligatorio para Codex y otras herramientas

- Antes de iniciar una tarea, ejecutar `git fetch origin main` y revisar estado y diferencias con `origin/main`. Conservar los cambios existentes antes de actualizar; nunca restablecerlos ni sustituir main por una carpeta antigua.
- Partir de main reciente, trabajar en una rama `codex/` y entregar los cambios mediante PR al repositorio `iagents00/stratos-ai-application`.
- Al completar cambios solicitados en la plataforma, el flujo predeterminado es integrar el PR cuando `Validar Stratos` y `verificar` estén aprobados y comprobar producción. Respetar una petición explícita de revisión, borrador, solo preview o no publicar. No tratar cambios pendientes o trabajo en curso como una entrega terminada.
- Después de integrar, actualizar la carpeta principal a `origin/main` y comprobar que `release.json` de los dominios tiene el SHA integrado. Vercel se encarga de actualizar los dominios tras superar la compilación protegida.
- El proyecto y sus dominios permanecen en `project-identity.json`. No usar `vercel --prod` desde worktrees, respaldos ni checkouts antiguos. La alternativa manual es `npm run deploy:production`, seguida de `npm run release:promote -- URL`.
- Un commit, preview o build no despliega por sí solo migraciones ni funciones de Supabase. Si una tarea las cambia, comprobar la versión activa y aplicar solo los cambios nuevos al proyecto Stratos; nunca ejecutar el historial SQL completo a ciegas.
- Mantener Rails desactivado por defecto. Activarlo únicamente para una organización cuando el usuario lo solicite.
