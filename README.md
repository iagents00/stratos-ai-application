# Stratos AI

Plataforma comercial multiempresa: CRM, Copilot, Ventas sobre Rieles, agenda, módulos operativos e integraciones. React 19 + Vite 8, Supabase, Vercel, n8n y Capacitor. Consultar package-lock.json para versiones exactas.

**Mantenimiento y recuperación:** [Manual de operación](docs/operacion/README.md).

| Buscar | Abrir |
|---|---|
| Pantallas y textos | [MAPA.md](MAPA.md) |
| Datos, servicios e impacto de cambios | [PLANO.md](PLANO.md) |
| Incidente o restauración | [Recuperación](docs/operacion/RECUPERACION.md) |
| Proceso admin / vendedor | [Ventas sobre Rieles](docs/operacion/RIELES.md) |
| Pruebas y publicación | [Entrega](docs/operacion/ENTREGA.md) |
| Guardas históricas | [CLAUDE.md](CLAUDE.md) |

## Desarrollo

Node 24, Git y acceso al repositorio. Desde una copia limpia:

```sh
npm ci --no-audit --no-fund
npm run dev
```

`http://localhost:5173` abre la web; `http://localhost:5173/?app` abre la plataforma. Una sesión demo es solo demostración. No usar datos o credenciales reales para fixtures.

## Verificación

```sh
npm test
npm run check:runtime
npm run ops:check
npm run verificar-rails
npm run planos
npm run build
npm run ops:doctor -- --output /tmp/stratos-incidente.json
```

El diagnóstico necesita red; las pruebas usan fixtures. /release.json identifica cada nueva compilación web. Confirmar el SHA efectivo de producción: main y Vercel pueden diferir tras una promoción.

## Configuración y seguridad

Las variables VITE_ son públicas y se incluyen en el navegador; nunca usarlas para secretos. Supabase ya maneja Auth y datos de producción. El cliente mantiene un fallback público del proyecto Stratos; los secretos de servidor se administran en su proveedor. El menú por roles no reemplaza RLS ni la autorización en RPC/Edge/n8n.

No ejecutar todas las migraciones históricas a ciegas ni desplegar funciones Supabase suponiendo que se publicaron con Vercel. Revisar el estado remoto y seguir el manual operativo.
