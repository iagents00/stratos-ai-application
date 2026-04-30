# Backups Stratos AI

Backups automáticos generados por GitHub Actions cada noche.

## Último backup: `2026-04-30`

| Tabla | Filas |
|------|------|
| profiles | 10 |
| leads | 118 |
| audit_log | 695 |
| organizations | 3 |

## Restauración

Si Supabase tuviera un fallo catastrófico, el JSON de `latest.json` se puede importar a:
- Otra instancia de Supabase con un script de seed
- Cualquier base de datos PostgreSQL con `COPY FROM JSON`
- La app en modo offline (poniendo el JSON en `src/data/offline-seed/`)

## Retención

Los backups se mantienen 30 días. Los más viejos se borran automáticamente.
