# Auditoria del bot de Telegram Stratos CRM

Fecha: 2026-07-13

## Estado despues del hardening

El workflow activo versionado en `n8n/workflows/stratos-telegram-bot-v4.json` ahora expone:

- `consume_telegram_pairing_code`: vincular Telegram con codigo.
- `bot_pair_by_name`: vincular Telegram por nombre del asesor.
- `bot_get_lead_by_phone`: consultar ficha basica por telefono.
- `bot_upsert_lead`: respaldo legacy para crear/actualizar lead.
- `bot_add_seguimiento`: respaldo legacy para registrar seguimiento.
- `bot_list_pending`: respaldo legacy para consultar pendientes.
- `bot_nlu_dispatch`: dispatcher principal para CRM avanzado y catalogo.

El dispatcher principal llama a `public.bot_nlu_dispatch_gvintell`, que enruta:

- Agenda y pendientes.
- KPIs personales.
- Pipeline por etapa.
- Busqueda de clientes.
- Ficha, historial, expediente y tareas de clientes.
- Alta y actualizacion de leads.
- Seguimientos, comunicaciones con duracion, notas y tareas.
- Cierres, papelera, prioridades y agente IA.
- Confirmaciones/cancelaciones simples y masivas.
- Catalogo de desarrollos/proyectos.

## Catalogo de proyectos

El catalogo queda versionado como migracion en `supabase/migrations/091_catalogo_proyectos_telegram.sql`.

Permite consultar por:

- Zona: Tulum, Playa del Carmen, Cancun, Merida, Cabo.
- Top N: top 3, top 5, etc.
- Presupuesto aproximado.
- Recamaras/tipologia.
- Cercania o vista al mar.
- Texto libre o nombre del desarrollo.
- Links de Drive y Maps cuando existen.

Nota: si el entorno no tiene datos cargados en `public.catalogo_proyectos`, la funcion responde que aun no hay propiedades publicadas. La tabla y la funcion quedan listas; la carga de datos depende del seed/import del catalogo.

## Pruebas minimas antes de anunciar al equipo

Enviar estos mensajes al bot en Telegram con un asesor vinculado:

1. `hola`
2. `que tengo hoy`
3. `kpis`
4. `pipeline`
5. `busca a Maria`
6. `ficha de 5551234567`
7. `nuevo lead Prueba Bot 5550001111, Tulum, 250K USD`
8. `no`
9. `llame a 5550001111, no contesto`
10. `no`
11. `que propiedades hay en Playa del Carmen`
12. `top 3 en Tulum cerca del mar`
13. `mandame el de tulum country club`
14. `mandame el de tulun cuntry clu`

## Mensaje seguro para asesores

Desde Telegram pueden conectar su cuenta, consultar agenda, KPIs, pipeline y clientes; crear o actualizar leads; registrar llamadas, WhatsApps, Zooms, visitas, notas y tareas; confirmar o cancelar acciones; y pedir opciones de desarrollos por zona, presupuesto, recamaras o cercania al mar cuando el catalogo este cargado.
