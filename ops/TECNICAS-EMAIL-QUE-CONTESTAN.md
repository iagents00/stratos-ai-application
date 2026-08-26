# Las técnicas que hacen que contesten

Qué está aplicado en la secuencia del webinar, por qué, y qué NO hacer.
Complemento de [`RUNBOOK-EMAIL-WEBINAR.md`](RUNBOOK-EMAIL-WEBINAR.md).

---

## 1. El correo diseñado convierte menos que el que parece escrito a mano

Es lo más contraintuitivo y lo que más mueve la aguja aquí.

Una plantilla con tarjeta blanca, logo arriba y botón de color se lee como
publicidad: el ojo la clasifica en medio segundo y la archiva. Un correo de
texto plano, alineado a la izquierda, con la tipografía del sistema y un enlace
subrayado, se lee como el que te manda un conocido — y **se contesta**.

Para 279 personas que ya hablaron con Óscar, eso gana. No estamos peleando por
la atención de desconocidos: estamos retomando conversaciones.

**Aplicado:** hay dos armazones en `src/emails/`.

| Armazón | Cuándo | Correos que lo usan |
|---|---|---|
| `_base-plano` | cuando el objetivo es que contesten | 1, 1-bis, 3, 5a, 5b |
| `_base` | cuando hay que mostrar estructura (temario, acceso) | 2, 4 |

Se elige por campaña con el campo `base` en el JSON.

---

## 2. Pedir respuesta, no clic

El correo 1 no dice "regístrate aquí". Dice:

> **Contéstame este correo con un "va"** y yo te aparto el lugar y te mando el
> enlace. Es más rápido que llenar el formulario.

Dos cosas pasan:

1. **Convierte más.** Contestar cuesta menos que abrir una pestaña, llenar un
   formulario y confirmar. Y la persona queda hablando contigo, no con un sistema.
2. **Le enseña a Gmail que te quieren.** Una respuesta es la señal más fuerte que
   existe para el filtro de spam — más que abrir, más que hacer clic. Cada persona
   que contesta mejora la entrega de **toda** la campaña, también para los que no
   contestaron.

El enlace de registro sigue ahí, en segundo lugar, para quien lo prefiera.

**Esto solo funciona si alguien lee `admin@dukedelcaribe.com`.** Si las respuestas
caen en un buzón que nadie abre, la táctica se vuelve en contra.

---

## 3. La primera línea cambia según de qué hablaron contigo

Un correo que arranca igual para todos se hojea. Uno que arranca reconociendo el
contexto se lee.

`{{gancho}}` se sustituye por destinatario según su etapa en el pipeline:

| Segmento | Primera línea |
|---|---|
| A · calientes | "Ya habíamos platicado hace poco, así que varias cosas te van a sonar." |
| B · tibios | "Hace un tiempo pediste información y no alcanzamos a terminar la plática." |
| C · fríos | "Sé que ya pasó un buen rato desde la última vez que hablamos." |

Vive en `metadata.ganchos` de cada campaña. Es el nivel de personalización que sí
se puede sostener con los datos que hay: el campo `project` está vacío en el 92%
de los registros, así que segmentar por desarrollo no es opción.

---

## 4. Reenviar a quien no abrió

La táctica más barata que existe. Tres días después, el mismo correo con **otro
asunto**, solo a quien no lo abrió. Recupera entre 30% y 50% de aperturas
adicionales sobre gente que ya está en la lista y no costó nada conseguir.

Está montado como campaña propia:

```bash
node supabase/email_campana.mjs audiencia webinar-01-reenvio \
  --no-abrieron webinar-01-invitacion
```

Asunto original: *"{{nombre}}, te invito al miércoles"*
Asunto del reenvío: *"¿Lo viste, {{nombre}}?"*

Nunca el mismo asunto: si no lo abrió la primera vez, ese asunto ya falló.

---

## 5. Prueba A/B de asunto, en automático

Cada campaña puede traer `asunto_b`. El motor reparte mitad y mitad de forma
estable (por hash del correo, no al azar), así el mismo contacto cae siempre del
mismo lado y la comparación no se ensucia entre correos.

`reporte` compara:

```
  Prueba A/B de asunto
    A   47/140   33.6%   "Carmen, te invito al miércoles"
    B   61/139   43.9%   "¿Te aparto un lugar para el miércoles?"
```

Para el correo 2 ya sabes cuál voz funciona con esta base.

---

## 6. Asuntos: cortos, concretos, en minúscula

Los siete asuntos de la secuencia caben en la vista previa del celular
(menos de 40 caracteres) y ninguno grita.

| Sí | No |
|---|---|
| "¿Te apunto?" | "¡ÚLTIMA OPORTUNIDAD!" |
| "Se me pasó preguntarte" | "Webinar exclusivo — cupo limitado" |
| "Ayer no te vi" | "Invitación especial para ti 🎉" |

Mayúsculas sostenidas, signos repetidos y palabras como *gratis*, *promoción* o
*exclusivo* son señales que los filtros pesan — y que a la marca la abaratan.

El nombre se puede meter con `{{nombre}}` y el motor limpia la coma huérfana si
el lead no tiene nombre.

---

## 7. El preencabezado no se deja al azar

Es el renglón gris que se ve junto al asunto en la bandeja. Si no se define, el
cliente de correo jala la primera línea del HTML — que a veces es "Ver este
correo en el navegador".

Aquí se usa como segunda línea del asunto:

> **Asunto:** Carmen, te invito al miércoles
> **Preencabezado:** Contéstame con un "va" y yo te aparto el lugar.

---

## 8. La posdata

Después del asunto, es la línea más leída de un correo. Mucha gente baja al final
antes de decidir si lee el resto. Los cinco correos plano llevan una, y ninguna es
relleno:

- Correo 1: *"Si ya no te interesa el tema, contéstame igual y te saco de la lista. No me ofendo."* — invita a responder incluso al que dice que no, y baja las quejas de spam.
- Correo 3: *"Si no puedes a esa hora, dímelo y te mando la grabación el jueves."* — rescata al que no puede asistir.
- Correo 5b: *"La pregunta que más salió ayer fue sobre el enganche."* — específica, da razón para contestar.

---

## 9. Nombre de persona en el remitente

`Óscar Gálvez · Duke del Caribe <admin@dukedelcaribe.com>`

La dirección es institucional porque así se acordó, pero el nombre visible es de
una persona. Un correo de "Equipo Duke" o "Notificaciones" arranca perdiendo.

---

## 10. Un solo enlace

Cada correo tiene una acción. Los correos plano llevan un enlace en el cuerpo
(dos contando la baja). Muchos enlaces reparten la atención y además son señal de
spam.

Y **nunca acortadores** (bit.ly y compañía): son de las señales más caras que hay
en entregabilidad.

---

## 11. Facilitar la baja

Suena contraintuitivo ponerla fácil. Es al revés: **si no encuentran el botón,
marcan spam.** Una baja no cuesta nada. Una queja de spam pesa cien veces más y
mancha el dominio para todos los envíos siguientes.

Por eso:
- Cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post` en cada envío, que pintan
  el botón nativo de Gmail arriba del correo.
- Enlace visible en el pie.
- La baja se ejecuta al instante y se respeta para siempre (`email_suppressions`).
- Y la posdata del correo 1 la ofrece de viva voz.

---

## 12. Cuándo mandar

- **Martes a jueves**, 10:00 o 18:00 hora local.
- **Nunca lunes en la mañana** (la bandeja del fin de semana se está vaciando) ni
  **viernes en la tarde**.
- El "es hoy" sale **3 horas antes**, no en la mañana: a las 9 a.m. se olvida.

---

## 13. Lo que se mide para decidir

`reporte` da la foto. Lo que importa por correo:

| Métrica | Qué te dice |
|---|---|
| Apertura | si el asunto y el remitente funcionan |
| Clic | si el cuerpo convence |
| **Respuestas** | si el correo se sintió humano — **el número que importa aquí** |
| Rebote | si la lista está sucia |
| Quejas | si te estás pasando de frecuencia o de tono |

Las respuestas no las cuenta el sistema: llegan al buzón. Vale la pena llevar la
cuenta a mano esta semana — es la métrica que dice si la voz está bien calibrada.

---

## Lo que NO se hizo, a propósito

| Práctica común | Por qué no |
|---|---|
| Correo de pura imagen | La mitad de los clientes bloquea imágenes: abre en blanco y se borra |
| Cuenta regresiva animada | Se rompe en Outlook y en Gmail móvil |
| "No responder a este correo" | Mata la señal más valiosa que existe |
| Comprar o enriquecer listas | Rebotes y quejas garantizados; ilegal en varios lados |
| Emojis en el asunto | Con esta base y esta marca, abaratan |
| Mandar los 279 de un jalón el primer día | La firma DKIM es nueva; se sube por escalones |
