# Google Play — Ficha de "Stratos AI"

Todo lo necesario para llenar la Play Console. Los gráficos viven en
`assets/play/`. El AAB lo produce el workflow `android-play.yml` (manual).

---

## Textos de la ficha (copiar y pegar)

**Título** (máx. 30):

```
Stratos AI: CRM con IA
```

**Descripción breve** (máx. 80):

```
CRM con IA para equipos de ventas: pipeline, leads, Zoom y seguimiento diario.
```

**Descripción completa**:

```
Stratos AI es el CRM con inteligencia artificial para equipos de ventas que
quieren operar con orden: cada lead, cada llamada y cada Zoom en su lugar,
y un plan claro de qué hacer hoy.

QUÉ PUEDES HACER CON LA APP

• Pipeline completo: tus leads organizados por etapa, del primer contacto al
  cierre, con historial de cada acción.
• Mi Día: la lista priorizada de a quién contactar hoy, preparada cada noche
  por la IA con base en tu pipeline.
• Zooms sin fricción: agenda, briefing previo con el contexto del cliente y
  protocolo de seguimiento después de cada reunión.
• Avisos que llegan: notificaciones de llamadas y recordatorios aunque la app
  esté cerrada.
• Copiloto integrado: pregunta por voz o texto sobre tus clientes y recibe
  respuestas con tus propios datos.
• Funciona sin señal: la app abre y muestra tu información aunque no tengas
  internet en ese momento.

PARA EQUIPOS

Stratos AI es la app de los equipos que ya usan la plataforma Stratos. Tu
acceso lo crea el administrador de tu organización — inicia sesión con la
cuenta que te asignaron y trabaja con los datos de tu equipo, protegidos y
separados por organización.

¿Tu empresa aún no usa Stratos? Conoce más en stratoscapitalgroup.com
```

---

## Gráficos

| Recurso | Requisito de Google | Archivo |
|---|---|---|
| Ícono de la app | 512×512 PNG, ≤1 MB | `assets/play/icono-512.png` |
| Gráfico destacado | 1024×500 PNG/JPG | `assets/play/destacado-1024x500.png` (fuente: `destacado-src.svg`) |
| Capturas de teléfono | mín. 2, lado corto ≥320 px | PENDIENTE — tomarlas con datos demo, NUNCA con leads reales (el repo y las capturas son públicos) |

---

## Formularios de la consola (respuestas sugeridas)

**Acceso a la app** (App access): "Toda la funcionalidad requiere cuenta" →
proporcionar credenciales de una cuenta DEMO con datos ficticios para el
equipo de revisión de Google. ⚠️ Crearla antes de enviar a revisión; sin esto
Google rechaza por no poder entrar.

**Seguridad de los datos** (Data safety):
- Recopila: dirección de correo, nombre, y registros de clientes que el
  usuario captura (funcionalidad del CRM).
- Datos cifrados en tránsito: SÍ (HTTPS/Supabase).
- El usuario puede solicitar borrado: SÍ →
  `https://stratoscapitalgroup.com/eliminar-mis-datos`
- No se venden datos, no hay publicidad, no se comparten con terceros.

**Política de privacidad**: `https://stratoscapitalgroup.com/politica-de-privacidad`

**Clasificación de contenido**: categoría "Utilidad, productividad,
comunicación u otros" → todas las preguntas de contenido sensible en NO →
clasificación general (3+).

**Público objetivo**: 18+. No dirigida a niños.

**Anuncios**: No contiene anuncios.

**Categoría de la ficha**: Empresa. Etiquetas: CRM, Ventas, Productividad.

---

## Flujo de publicación (cuenta personal)

1. Cuenta de desarrollador aprobada (identidad verificada, $25 pagados).
2. Crear app: "Stratos AI", español (Latinoamérica), App, Gratis.
3. Completar los formularios de arriba + ficha + gráficos.
4. **Prueba cerrada**: subir el AAB del workflow `android-play.yml`, crear
   lista de testers con los correos del equipo (mínimo 12) y compartirles el
   link de invitación. Los testers la instalan desde Google Play normal.
5. Mantener la prueba **14 días seguidos con 12+ testers activos** (regla de
   Google para cuentas personales nuevas).
6. Solicitar acceso a producción → revisión de Google (días) → pública.

Cada AAB nuevo necesita subir `versionCode` en
`mobile/android/app/build.gradle` (merge a main → correr el workflow).

El upload key es privado: secretos `ANDROID_UPLOAD_KEYSTORE_*` en GitHub,
respaldo en `~/StratosKeys/` (ver su `LEEME.md`). Al crear la app en la
consola, aceptar **Play App Signing** (Google guarda la llave final).
