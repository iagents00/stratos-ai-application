-- ═══════════════════════════════════════════════════════════
-- Stratos AI — Migración 011
-- Mejoras al sistema de confirmaciones del bot Telegram
--
-- Cambios:
--   1. bot_confirm_latest_pending ahora es FIFO (procesa la mas vieja
--      primero) e incluye en el reply.text un aviso "Quedan N pendientes,
--      responde 'si' para continuar" cuando hay mas de una en cola.
--   2. NUEVA bot_confirm_all_pending — ejecuta todas las pendings del
--      chat de una sola vez (cuando el asesor dice "si a todo").
--   3. NUEVA bot_cancel_all_pending — cancela todas las pendings.
--   4. bot_nlu_dispatch extendido con tool_name='confirm_all' y
--      'cancel_all' (ademas de confirm_last/cancel_last que ya existian).
--
-- El system prompt del AI Agent debe actualizarse al v6
-- (n8n/system-prompt-asesor-v6.md) para que reconozca las palabras
-- de confirmacion/cancelacion total ("si a todo", "cancela todo").
-- ═══════════════════════════════════════════════════════════

-- Cuerpos completos en supabase migration 011 aplicada via MCP.
-- Las funciones actualizadas/creadas:
--   * bot_confirm_latest_pending(bigint) RETURNS jsonb        (modificada: FIFO + remaining count)
--   * bot_confirm_all_pending(bigint)    RETURNS jsonb        (nueva)
--   * bot_cancel_all_pending(bigint)     RETURNS jsonb        (nueva)
--   * bot_nlu_dispatch(bigint,text,jsonb) RETURNS jsonb       (extendida con confirm_all/cancel_all)
--
-- Ver script completo en historial de migrations de Supabase o en
-- el cuerpo aplicado via apply_migration el 2026-05-13.

-- Esta migration es un placeholder en el repo para tracking. El cuerpo
-- ya esta en produccion. Si necesitas re-ejecutar, copia el cuerpo
-- desde el dashboard de Supabase (SQL Editor → Functions).

NOTIFY pgrst, 'reload schema';
