# Cambio y recuperación de contraseña — 10 de octubre de 2026

## Alcance y correcciones

Se verificó la cuenta de Adoquín: activa, correo de acceso confirmado y correo de recuperación configurado. No se cambió su contraseña ni su organización.

- Login y administración usan el mismo código de recuperación; se eliminaron los enlaces de Supabase que dirigían a una pantalla sin procesar la recuperación. «Ya tengo un código» permite usar el enviado por administración sin invalidarlo.
- El cambio desde Perfil refresca sesiones vencidas, limita esperas, trata errores de red y solo confirma el usuario devuelto por Auth.
- La función de recuperación comprueba la respuesta de Gmail/n8n y presenta errores de servicio. El secreto compartido de n8n se trasladó del código desplegado a Supabase Secrets.
- `RECOVERY_CODE_PEPPER` mantiene el hash estable entre despliegues y rotaciones de credenciales de servicio. Rotarlo invalida códigos pendientes; conservarlo como secreto de servidor.
- Migración incremental 269: solicitudes serializadas por usuario, máximo cinco por hora, vigencia máxima de quince minutos, rechazo de cuentas inactivas y de alias compartidos ambiguos. Se conservan RPC exclusivas de service_role y la protección de uso único/intentos.

## Evidencia y límites

La suite automatizada ejecuta el SQL real en PostgreSQL aislado (PGlite), el handler Edge y los clientes: expiración, reutilización, intentos, rate limit, correos ambiguos, permisos, respuestas fallidas del correo y errores de cambio de contraseña. Se ejecutaron las validaciones del proyecto, runtime, documentación, inventario, Rails, rutas tenant y compilación.

Se ensayó en navegador con una cuenta temporal en una organización aislada contra Supabase Stratos: código controlado de prueba, restablecimiento real, rechazo de la contraseña anterior, aceptación de la nueva y rechazo del código reutilizado. También se cambió la contraseña desde Perfil y se comprobó el rechazo de la clave previa y la aceptación de la nueva. El código de ese ensayo se preparó administrativamente; no simula recepción en un buzón.

El envío separado a Adoquín quedó confirmado por el nodo Gmail del workflow `hV7mADwc0RnhLkGo`, ejecuciones `3511357` (antes) y `3512080` (después de desplegar la corrección), con etiqueta `SENT`. Esto acredita la aceptación por Gmail, no la entrega a bandeja o spam. El usuario confirmó que no tiene acceso al buzón; esa comprobación queda pendiente del destinatario.

La migración 269 se aplicó por separado, sin ejecutar el historial SQL. La función Edge se desplegó explícitamente al proyecto `glulgyhkrqpykxmujodb`; la web sigue el PR, los checks y el despliegue automático protegido. Los respaldos y credenciales del ensayo están fuera del repositorio.

## Operación

Para cambiar la contraseña: Perfil → Contraseña. Para recuperar acceso: /tenant → ¿Olvidaste tu contraseña? → correo de la cuenta → código recibido → nueva contraseña. Si se comparte un buzón de recuperación entre varias cuentas, ingresar el correo de acceso exacto de la cuenta.

Ante un fallo del proveedor, no afirmar que el correo llegó: revisar la ejecución n8n y la aceptación de Gmail. Nunca registrar códigos ni contraseñas en informes, repositorio o logs de aplicación. Después de un fallo al actualizar Auth con un código consumido, solicitar uno nuevo.
