# Las técnicas de la campaña de correo de Duke

Qué está aplicado en la secuencia de Mondrian Cancún, por qué, y qué NO hacer.
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
| `_base` | cuando la acción es un clic a un botón | 1, 2, 3 |
| `_base-plano` | cuando el correo es una conversación de seguimiento | 4a, 4b |

**Decisión del cliente (25-ago):** las invitaciones van con armazón diseñado y
botón, no con nota personal. El objetivo declarado es registro, y el botón lo
hace inequívoco.

Se elige por campaña con el campo `base` en el JSON.

---

## 2. Una sola acción, imposible de confundir

Cada correo tiene **un botón y un solo destino**. Nada de "contéstame", nada de
tres caminos distintos. El lector no debe tener que decidir qué hacer.

| Correo | Botón | A dónde |
|---|---|---|
| 1 Invitación | Registrarme al webinar | formulario de registro |
| 2 Reenvío | Apartar mi lugar | formulario de registro |
| 3 Es hoy | Entrar al webinar | enlace de Zoom |
| 4a Asistió | Agenda tu media hora | calendario |
| 4b No asistió | Ver la grabación | grabación |

El botón va después de los horarios y antes de la firma — donde el lector ya
sabe qué es y cuándo, que es el momento en que decide.

**Se consideró y se descartó** pedir respuesta directa ("contéstame con un va").
Convierte bien en listas tibias y le enseña a Gmail que el remitente se quiere,
pero exige que alguien conteste el mismo día y desdibuja la métrica de registro.
Con dos días encima, el registro medible gana.

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
node supabase/email_campana.mjs audiencia mondrian-02-reenvio \
  --no-abrieron mondrian-01-invitacion
```

Asunto original: *"{{nombre}}, el único en preventa en la Zona Hotelera"*
Asunto del reenvío: *"Es hoy: Mondrian Cancún en vivo"*

Nunca el mismo asunto: si no lo abrió la primera vez, ese asunto ya falló.

---

## 5. Prueba A/B de asunto, en automático

Cada campaña puede traer `asunto_b`. El motor reparte mitad y mitad de forma
estable (por hash del correo, no al azar), así el mismo contacto cae siempre del
mismo lado y la comparación no se ensucia entre correos.

`reporte` compara:

```
  Prueba A/B de asunto
    A   47/140   33.6%   "Carmen, el único en preventa en la Zona Hotelera"
    B   61/139   43.9%   "Mondrian Cancún: preventa para inversionistas"
```

Para el reenvío del jueves ya sabes cuál voz funciona con esta base.

---

## 6. Asuntos: cortos, concretos, en minúscula

Los siete asuntos de la secuencia caben en la vista previa del celular
(menos de 40 caracteres) y ninguno grita.

| Sí | No |
|---|---|
| "Es hoy: Mondrian Cancún en vivo" | "¡ÚLTIMA OPORTUNIDAD!" |
| "{{nombre}}, ¿alcanzas hoy en la noche?" | "WEBINAR EXCLUSIVO — CUPO LIMITADO" |
| "Te dejo la grabación" | "Invitación especial para ti 🎉" |

El flyer y el texto original traían `👉` y la línea *"Esta puede ser la
oportunidad que estabas esperando"*. En redes funcionan; en el asunto y el cuerpo
de un correo masivo pesan en contra de la entrega. La sustancia se conservó, el
adorno no.

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

Después del asunto, es la línea más leída de un correo: mucha gente baja al final
antes de decidir si lee el resto. Las que llevan los correos no son relleno,
son la razón para actuar hoy:

- Correo 4a: *"Las unidades se apartan por orden de llegada. Si ya sabes cuál quieres, agenda hoy."*
- Correo 4b: *"Las condiciones de preventa siguen vigentes unos días más. Después se van con el precio de lista."*

En los correos 1 y 2 la urgencia va bajo el botón en vez de en posdata, porque
ahí es donde se decide el clic.

**Toda la escasez es real y sale de lo que el cliente escribió**: grupo limitado
de inversionistas, condiciones especiales para participantes, preventa. Nada
inventado — una escasez falsa se nota y cuesta la relación.

## 9. Nombre de persona en el remitente

`<presentador> · Duke del Caribe <admin@dukedelcaribe.com>`

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

- **Martes a jueves**, 10:00 o 18:00 hora local. La campaña cae justo ahí.
- **Nunca lunes en la mañana** ni **viernes en la tarde**.
- El "es hoy" sale **3 horas antes**, no en la mañana: a las 9 a.m. se olvida.
- **La lista abarca tres husos** (Cancún, CDMX, California). Las tandas del
  miércoles se reparten a lo largo del día para caer en horario decente en los
  tres; y los tres horarios aparecen en el cuerpo del correo, como en el flyer.

---

## 13. Lo que se mide para decidir

`reporte` da la foto. Lo que importa por correo:

| Métrica | Qué te dice |
|---|---|
| Apertura | si el asunto y el remitente funcionan |
| Clic | si el cuerpo convence |
| **Registros** | el número que importa — se cuenta en el formulario, no aquí |
| Rebote | si la lista está sucia |
| Quejas | si te estás pasando de frecuencia o de tono |

El registro vive en un formulario de Google, así que el sistema no lo ve: para
cruzar quién se registró hay que exportar las respuestas. Vale la pena hacerlo el
jueves temprano, tanto para el correo de "es hoy" como para saber qué asunto ganó.

---

## Lo que NO se hizo, a propósito

| Práctica común | Por qué no |
|---|---|
| Correo de pura imagen | La mitad de los clientes bloquea imágenes: abre en blanco y se borra |
| Cuenta regresiva animada | Se rompe en Outlook y en Gmail móvil |
| "No responder a este correo" | Mata la señal más valiosa que existe: aunque la acción sea el botón, el Reply-To es real |
| Comprar o enriquecer listas | Rebotes y quejas garantizados; ilegal en varios lados |
| Emojis en el asunto | Con esta base y esta marca, abaratan |
| Mandar los 279 de un jalón | La firma DKIM es nueva; van en tres tandas el mismo día |
| Acortar el link del formulario | Los acortadores son de las peores señales de entregabilidad |
