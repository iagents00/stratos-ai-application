# Publicación de Stratos AI

## Fuente y destino oficiales

- Repositorio: https://github.com/iagents00/stratos-ai-application
- Rama de producción: `main`.
- Proyecto Vercel: `stratos-ai-application`, `prj_Epv30SFnQmJGnxy3LdYLKV8NwDLi`.
- Equipo: `iagents-projects`, `team_81sa1P6XuaBzPoKajzdGCM2Q`.
- Identidad: `project-identity.json`. Mantener los dominios y variables existentes.
- Carpeta principal: `/Users/ivanrodriguezruelas/stratos-ai-application`.

## Trabajo desde Codex o cualquier herramienta

1. Ejecutar `npm run check:project` y `git fetch origin main`; revisar y preservar cambios pendientes antes de actualizar.
2. Iniciar una rama desde main reciente. Guardar todos los cambios e impulsar un PR.
3. GitHub exige PR y las pruebas `Validar Stratos` y `verificar`; no exige una segunda persona. Main no permite force push ni borrado, y las reglas incluyen administradores.
4. Integrar el PR aprobado. Vercel construye automáticamente el commit de main, con sus variables de producción.
5. `npm run build:vercel` comprueba el SHA contra main de GitHub y compara los archivos de fuente con el árbol oficial. Ejecuta controles runtime, aplicación, Rails y aislamiento antes de construir; vuelve a comprobar main al terminar. Un error mantiene la publicación anterior.
6. Los dominios se actualizan automáticamente al terminar la construcción aprobada. Comprobar `/release.json` en `app.stratoscapitalgroup.com` y `getstratosai.com`: proyecto correcto, SHA esperado y `dirty: false`. Renovar la página para cargar el cliente reciente.

Los cambios sin registrar o pendientes en una rama siguen siendo trabajo en curso. Para quedar live deben integrarse a main. El flujo de Git de Vercel está documentado en https://vercel.com/docs/git/vercel-for-github.

## Alternativa manual y recuperación

Publicar únicamente desde la carpeta principal, limpia y actualizada a main:

```sh
npm run check:project
npm run deploy:production
npm run release:promote -- https://URL-DEL-DEPLOYMENT.vercel.app
```

La publicación manual se prepara sin dominios y verifica identidad, SHA y resultado antes de promover. No publicar desde una carpeta vieja ni cambiar el enlace de proyecto. Para revertir cambios de código, crear un PR de reversión sobre main; no promover código viejo como si fuera la versión reciente.

## Servicios y datos

Las variables privadas permanecen en Vercel y Supabase. No copiarlas al repositorio. Funciones Edge y migraciones requieren publicación controlada en `stratos-prod`; nunca aplicar todo el historial SQL. Rails queda apagado hasta una solicitud explícita por organización.

El monitor horario `Vigilar versión de producción` verifica que el dominio coincide con la última publicación Production exitosa. La recuperación y sus respaldos están documentados en `docs/recovery/2026-09-30-production-recovery.md`.
