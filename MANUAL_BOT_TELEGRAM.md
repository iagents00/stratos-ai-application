# Manual del Asistente Stratos por Telegram

Manual completo para asesores. Aprenderás a conectar tu Telegram al CRM, registrar y actualizar clientes desde el chat, consultar tu pipeline y resolver problemas comunes.

Tiempo de lectura: 12 minutos. Tiempo de práctica: 5 minutos.

---

## Tabla de contenido

1. [Qué es el asistente y para qué sirve](#1-qué-es-el-asistente)
2. [Conectar tu Telegram al CRM (una sola vez)](#2-conectar-tu-telegram)
3. [Tu primer mensaje al bot](#3-tu-primer-mensaje)
4. [Cómo le hablas al asistente](#4-cómo-le-hablas)
5. [Consultar información (sin confirmación)](#5-consultar-información)
6. [Registrar acciones (con confirmación)](#6-registrar-acciones)
7. [Modificar un cliente existente](#7-modificar-un-cliente)
8. [Confirmar y cancelar](#8-confirmar-y-cancelar)
9. [Hacer varias cosas en un solo mensaje](#9-multiples-acciones)
10. [Comandos rápidos con la barra `/`](#10-comandos-rápidos)
11. [Errores comunes y cómo resolverlos](#11-errores-comunes)
12. [Privacidad y permisos](#12-privacidad-y-permisos)
13. [Atajos visuales](#13-atajos-visuales)
14. [Soporte](#14-soporte)

---

## 1. Qué es el asistente

El **Asistente Stratos** es un bot de Telegram conectado al CRM de la empresa. Te permite manejar tu cartera de clientes desde el chat de Telegram, sin abrir el navegador.

Puedes hacer exactamente lo mismo que en el CRM web, pero por mensaje:

- Consultar tu agenda del día, tus KPIs y tu pipeline.
- Registrar un cliente nuevo en segundos.
- Anotar llamadas, WhatsApp, Zoom, visitas.
- Cambiar la etapa de un cliente, agendar próxima acción.
- Crear tareas con fecha.
- Cerrar ventas.
- Consultar la ficha completa de cualquiera de tus clientes.

Todo lo que haces en Telegram queda **sincronizado con el CRM** en tiempo real. Si tu director abre tu pipeline en la web, ve los cambios al instante.

---

## 2. Conectar tu Telegram

### Pasos (una sola vez)

1. **Abre el CRM** en tu navegador: https://app.stratoscapitalgroup.com
2. Inicia sesión con tu cuenta de asesor.
3. Click en **tu nombre** arriba a la derecha (donde dice tu nombre y "Asesor").
4. Vas a la pantalla **Perfil**.
5. Click en el botón **Conectar mi Telegram**.
6. El sistema genera un código de 8 dígitos (ejemplo: `47829163`).
7. Abre Telegram. Busca el bot: **@Strato_sasistente_crm_bot**
8. Mándale el código así (reemplazando con tu número):

   ```
   /conectar 47829163
   ```

9. El bot te responde: `Conectado, [Tu Nombre]. Manda 'hola' para ver el menú.`
10. Listo. Vuelve a la pantalla del CRM y verás "Conectado".

### Notas importantes

- El código **expira en 10 minutos**. Si tardas, genera uno nuevo desde la misma pantalla.
- Solo puedes tener **un Telegram conectado por cuenta**. Si cambias de teléfono, primero desconecta el viejo desde el botón **Desconectar** en Perfil.
- Una vez conectado, **el bot ya sabe quién eres** en cada mensaje. No tienes que decirle tu nombre.

---

## 3. Tu primer mensaje

Manda al bot:

```
hola
```

El bot te responde con el menú principal:

```
Hola. Que necesitas?
. Toca un boton o escribeme libremente.
```

Y te muestra botones rápidos: `Mis clientes`, `Agenda`, `KPIs`, `Buscar`, `Pipeline`.

Puedes tocar un botón o escribir tu petición en lenguaje natural. El bot entiende ambas formas.

---

## 4. Cómo le hablas

Hay tres formas válidas de hablarle al asistente:

### Forma A — Lenguaje natural

```
nuevo lead Marco González 555-1234, Tulum, 500K USD
```

El asistente entiende qué quieres y prepara la acción.

### Forma B — Comandos cortos con barra

```
/agenda
/kpis
/pipeline
```

Acceso directo a las consultas más usadas.

### Forma C — Botones

Cuando el bot te muestra botones (después de cada acción), tócalos para navegar rápido.

### Reglas generales

- Los **teléfonos** los puedes escribir con o sin guiones: `555-1234`, `5551234`, `+52 81 1234-5678` son todos válidos.
- Las **fechas relativas** las entiende: `mañana 11am`, `el viernes a las 10`, `en 3 horas`.
- **Casi todo lo importante pasa por una confirmación** antes de guardarse. Tendrás que decir `si` o tocar el botón [Sí, registrar] para que el cambio quede.
- Si te equivocas, di `no` o `cancela` para descartar.

---

## 5. Consultar información

Estas operaciones **se ejecutan al instante**, sin pedir confirmación.

### 5.1 Tu agenda del día

```
que tengo hoy
```

Equivalentes: `pendientes`, `mis pendientes`, `agenda`, `/agenda`.

El bot lista tus clientes con próxima acción en las próximas 24 horas, ordenados por hora.

### 5.2 Tus KPIs

```
como voy
```

Equivalentes: `mis kpis`, `estadísticas`, `/kpis`, `dashboard`, `mis números`.

Te devuelve:
- Clientes activos en pipeline
- Clientes calientes (score alto)
- Score promedio
- Valor total del pipeline en dinero
- Pendientes hoy, vencidos, cerrados

### 5.3 Tu embudo por etapa

```
pipeline
```

Equivalentes: `embudo`, `cuántos por etapa`, `/pipeline`.

Te muestra cuántos clientes tienes en cada etapa.

### 5.4 Buscar un cliente por nombre

```
busca a Maria
```

Equivalentes: `cómo va Maria`, `encuéntrame a Carlos`.

El bot busca por nombre y te lista los matches con botones para abrir cada uno.

### 5.5 Ver la ficha de un cliente

Si **conoces el teléfono**:

```
ficha de 555-1234
```

Equivalentes: `cómo va Marco 555-1234`, `muéstrame Juan 555-1234`, `view 555-1234`.

Te devuelve toda la información del cliente: etapa, score, presupuesto, proyecto, próxima acción, seguimientos, última actividad.

### 5.6 Historial completo de un cliente

```
historial de 555-1234
```

Equivalentes: `qué pasó con 555-1234`.

Lista cronológicamente todas las interacciones registradas con ese cliente.

### 5.7 Notas y documentos del expediente

```
expediente de 555-1234
```

Equivalentes: `notas de 555-1234`, `docs de 555-1234`.

Te muestra todas las notas, transcripciones y documentos asociados al cliente.

### 5.8 Tareas de un cliente

```
tareas de 555-1234
```

Lista las tareas pendientes y completadas del cliente.

---

## 6. Registrar acciones

Todas las acciones de escritura **piden confirmación** antes de guardarse. Después de tu mensaje, el bot te muestra un resumen con botones `[Sí, registrar][Cancelar]`, o también puedes responder con texto: `si` confirma, `no` cancela.

### 6.1 Registrar un cliente nuevo

```
nuevo lead Marco González 555-1234, Tulum, 500K USD, vino por Facebook
```

Mínimo necesario: **nombre** y **teléfono**.

Opcionales:
- Proyecto (ej: `Tulum`, `Torre 25`, `Cancún`)
- Presupuesto (ej: `500K USD`, `1.5M USD`, `2 mdd`)
- Fuente (ej: `Facebook`, `Instagram`, `Referido`, `WhatsApp`)
- Etapa inicial (ej: `Primer Contacto`)

Otros disparadores que el bot entiende: `registra a`, `agrega cliente`, `crea lead`.

**Ejemplo mínimo**:

```
nuevo lead Carmen Ruiz 555-9999
```

**Ejemplo completo**:

```
registra a Pedro Hernández 555-7777, Cancún, 1.2M USD, llegó por referido de Marco, etapa Primer Contacto
```

### 6.2 Registrar una llamada o WhatsApp

Si llamaste a un cliente y **no contestó**:

```
llamé a 555-1234, no contestó
```

Si **contestó**:

```
llamé a 555-1234, le gustó la propuesta, agendamos seguimiento
```

WhatsApp:

```
whatsapp a 555-1234, le mandé las fotos de la propiedad
```

Email:

```
email a 555-1234, le respondí su duda sobre financiamiento
```

Visita al sitio:

```
fui a ver al cliente 555-1234, le encantó la torre
```

### 6.3 Registrar una llamada o reunión CON DURACIÓN

Cuando hay duración explícita (Zoom de 30 min, llamada larga, etc):

```
Zoom con 555-3210, 45 min, le encantó Tulum, va a hablar con su esposa
```

```
llamada de 12 min con 555-1234, va a mandar comprobante de ingresos
```

### 6.4 Agregar una nota al expediente

Es **diferente a un seguimiento**: una nota es algo que quieres dejar escrito en el expediente del cliente, no es una interacción que ocurrió.

```
anota en 555-1234: la esposa decide la compra
```

Equivalentes: `agrega al expediente de 555-1234: cliente serio`, `pon nota a 555-1234: hay que llamar antes de las 6pm`.

### 6.5 Crear una tarea con fecha

```
tarea para 555-1234: enviar comparativo de propiedades, viernes 10am
```

```
recordame llamar a 555-7777 mañana a las 11
```

Si no incluyes fecha, la tarea queda sin vencer.

### 6.6 Cerrar una venta

```
cerré con 555-7777, 1.2M USD
```

Con fecha de firma:

```
cerré con 555-7777, 350K USD, firmó hoy
```

```
cerré con 555-7777, 1.5M USD, firmó el viernes pasado
```

---

## 7. Modificar un cliente

### 7.1 Cambiar la etapa del cliente

```
pasa a 555-1234 a Zoom Agendado
```

Etapas válidas (debes escribirlas exactamente igual):

- Nuevo Registro
- Primer Contacto
- Seguimiento
- Zoom Agendado
- Zoom Concretado
- Visita Agendada
- Visita Concretada
- Negociación
- Cierre
- Perdido

### 7.2 Agendar próxima acción

```
agenda llamar a 555-1234 mañana a las 11
```

```
reagenda 555-1234 para el viernes
```

```
próxima acción de 555-1234: enviar propuesta, el lunes 9am
```

### 7.3 Marcar caliente o quitar caliente

```
marca caliente a 555-1234
```

```
quítale el caliente a 555-1234
```

### 7.4 Cambiar el presupuesto

```
cambia el presupuesto de 555-1234 a 750K USD
```

### 7.5 Cambiar el proyecto de interés

```
cambia el proyecto de 555-1234 a Torre 25
```

### 7.6 Cambiar el email

```
ponle email a 555-1234: marco@email.com
```

### 7.7 Agregar bio o descripción

```
ponle bio a 555-1234: cliente busca segunda residencia, decide con su esposa
```

### 7.8 Pinear (marcar como prioritario)

```
pinea a 555-1234
```

Para quitar el pin:

```
quita el pin a 555-1234
```

### 7.9 Asignar un agente de IA

Los agentes de IA pueden trabajar el cliente por ti en distintos contextos:

- `reactivar`: para leads fríos
- `seguimiento`: mantiene la relación activa
- `callcenter`: prepara y asiste llamadas
- `calificar`: evalúa y prioriza
- `none`: quitar el agente

```
asigna el reactivador a 555-1234
```

```
pon a 555-7777 con el agente de seguimiento
```

```
quítale el agente a 555-1234
```

### 7.10 Reasignar a otro asesor

**Importante**: solo super admins y Gael G pueden reasignar.

```
asigna 555-1234 a Araceli Oneto
```

```
reasigna 555-1234 al asesor Cecilia Mendoza
```

### 7.11 Eliminar un cliente (mandarlo a papelera)

```
elimina a 555-1234, ya no está interesado
```

```
borra a 555-1234, número equivocado
```

Siempre se va a la **papelera**, no se borra definitivamente. Un admin puede recuperarlo desde el CRM web.

---

## 8. Confirmar y cancelar

Cada vez que el bot te pide `¿Confirmas?`, tienes dos formas de responder:

### Forma A — Tocar el botón

Aparecen botones `[Sí, registrar]` y `[Cancelar]` debajo del mensaje. Tócalos.

### Forma B — Responder con texto

**Para confirmar** una sola acción:

- `si`
- `sí`
- `ok`
- `dale`
- `va`
- `sale`
- `confirmar`
- `confirmo`
- `si dale`
- `si confirmo`
- `correcto`
- `perfecto`
- `registralo`

**Para confirmar TODAS las pendientes** (si tienes varias en cola):

- `si a todo`
- `confirma todo`
- `todas si`

**Para cancelar** la última:

- `no`
- `cancela`
- `espera`
- `para`

**Para cancelar TODAS las pendientes**:

- `cancela todo`
- `cancela todas`

### Importante

- Una pendiente expira si no la confirmas en pocos minutos.
- Si tienes varias en cola y dices `si`, se confirma la **más vieja primero** (orden cronológico). El bot te dice "Quedan N pendientes" después de cada `si`.
- Para acelerar, di `si a todo` para que ejecute todo de una vez.

---

## 9. Múltiples acciones

Puedes pedir varias cosas en un solo mensaje:

```
pasa a 555-1234 a Seguimiento y anota: hay que llamar el lunes
```

El bot encolará las dos acciones y te pedirá confirmar:

```
Voy a actualizar 555-1234:
. etapa -> Seguimiento
¿Confirmas?

Voy a agregar al expediente de 5551234:
. hay que llamar el lunes
¿Confirmas?
```

Tus opciones:

- `si` confirma la primera y luego pide la segunda.
- `si a todo` ejecuta ambas de una vez.
- `cancela todo` descarta ambas.

Otro ejemplo de combinación:

```
nuevo lead Sandra Pérez 555-8888, Riviera Maya, 400K USD, vino por Instagram, y agéndale llamar mañana a las 10
```

---

## 10. Comandos rápidos

Telegram tiene un menú nativo con comandos cortos. Cuando escribes `/` aparece la lista. Puedes tocar uno o escribirlo:

| Comando | Qué hace |
|---|---|
| `/start` | Conectar tu cuenta o ver menú (si ya estás conectado) |
| `/menu` | Mostrar el menú principal |
| `/agenda` | Ver tus pendientes del día |
| `/kpis` | Ver tus KPIs (clientes activos, calientes, pipeline) |
| `/pipeline` | Ver tu embudo por etapa |
| `/clientes` | Buscar clientes |
| `/ayuda` | Ver guía completa de uso |

---

## 11. Errores comunes

### El bot dice "Procesando pareo, intenta de nuevo"

Tu código de pareo expiró o ya fue usado. Genera uno nuevo desde el CRM web → Perfil → Conectar mi Telegram.

### El bot dice "No tienes nada pendiente"

Respondiste `si` o `no` pero no había ninguna acción esperando confirmación. Probablemente expiró o ya la confirmaste. Si querías hacer algo, vuelve a escribirlo.

### El bot pide confirmación en bucle

Si después de decir `si` el bot vuelve a pedir `¿Confirmas?`, probablemente hay **más de una pendiente** en cola. Mira el mensaje del bot, dice "Quedan N pendientes". Sigue respondiendo `si` hasta que las consuma todas, o di `si a todo`.

### El bot dice "Codigo invalido o vencido"

El código `/conectar XXXXXXXX` que mandaste ya expiró (duran 10 min) o tiene un dígito mal. Genera uno nuevo desde el CRM web.

### El bot no encuentra al cliente

```
busca a Maria
```
Respuesta: "Sin coincidencias para 'Maria'"

Significa que no tienes ningún cliente con ese nombre en TU pipeline. Recuerda que cada asesor solo ve sus propios leads.

### El bot dice "Servicio temporalmente lento"

Algo falló en el servidor. Espera 1-2 minutos y vuelve a intentar. Si persiste, contacta soporte.

### El bot interpretó mal el mensaje

Si registró una llamada cuando solo querías anotar algo, o cambió la etapa cuando solo querías agendar próxima acción:

1. Si todavía está en confirmación (te muestra `¿Confirmas?`), responde `no` o `cancela`.
2. Si ya se ejecutó, anótalo manual o pídele al admin que lo corrija desde el CRM web.

Truco: para evitar interpretación errónea, **usa verbos claros**:
- `anota...` para notas
- `llamé...` para seguimientos
- `pasa a...` para cambiar etapa
- `tarea para...` para tareas

### El bot no responde nada

Verifica que el bot esté activo y que estés escribiendo al usuario correcto: **@Strato_sasistente_crm_bot**.

---

## 12. Privacidad y permisos

### Lo que el bot SÍ puede hacer

- Ver y modificar **solo tus clientes** (los que están asignados a ti).
- Crear notas, tareas, seguimientos en tus clientes.
- Cambiar etapas y datos de tus clientes.

### Lo que el bot NO puede hacer

- Ver clientes de otros asesores (a menos que seas super admin o tengas permiso especial).
- Reasignar un cliente a otro asesor (solo super admins y Gael).
- Mandar mensajes al cliente final (WhatsApp/email del lead).
- Agendar en tu Google Calendar o Outlook.
- Borrar definitivamente un lead (solo lo manda a papelera).

### Tu historial con el bot

Todo lo que escribes y todas las respuestas del bot quedan guardados. Puedes verlas en el CRM web → Perfil → "Últimas acciones desde Telegram". Cada asesor solo ve **su propio** historial.

---

## 13. Atajos visuales

### Cheat sheet de un vistazo

| Quiero... | Escribe... |
|---|---|
| Ver mis pendientes hoy | `que tengo hoy` |
| Ver mis números | `como voy` |
| Ver el embudo | `pipeline` |
| Buscar cliente por nombre | `busca a Maria` |
| Ver ficha por teléfono | `ficha de 555-1234` |
| Ver historial | `historial de 555-1234` |
| Registrar cliente nuevo | `nuevo lead Marco 555-1234, Tulum, 500K USD` |
| Registrar llamada que no contestó | `llamé a 555-1234, no contestó` |
| Registrar WhatsApp | `whatsapp a 555-1234, le mandé propuesta` |
| Registrar Zoom con duración | `Zoom con 555-1234, 45 min, le gustó` |
| Anotar nota libre | `anota en 555-1234: la esposa decide` |
| Crear tarea con fecha | `tarea para 555-1234: enviar comparativo viernes 10am` |
| Cambiar etapa | `pasa a 555-1234 a Zoom Agendado` |
| Agendar próxima acción | `agenda llamar a 555-1234 mañana 11am` |
| Marcar caliente | `marca caliente a 555-1234` |
| Cerrar venta | `cerré con 555-1234, 1.2M USD` |
| Eliminar (papelera) | `elimina a 555-1234, ya no interesado` |
| Pedir guía | `ayuda` |
| Confirmar | `si` |
| Cancelar | `no` |

---

## 14. Soporte

### Si algo no funciona

1. Revisa la sección [Errores comunes](#11-errores-comunes).
2. Manda `ayuda` al bot — te devuelve la guía rápida.
3. Manda `menu` y toca los botones.

### Si necesitas escalar

Contacta al administrador del CRM (Iván, Alex, Oscar, Ken, Emmanuel) con:

- Captura de pantalla del problema.
- Hora aproximada del incidente.
- Qué intentaste hacer.

### Sugerencias y nuevas funciones

Si se te ocurre una funcionalidad nueva que mejoraría tu día a día (un comando que no existe, una integración con otra herramienta, etc.), avísale al admin. El bot evoluciona con el equipo.

---

## Resumen ejecutivo

Si solo recuerdas 3 cosas de este manual:

1. **Conecta una sola vez** desde el CRM web → Perfil → Conectar Telegram → manda el código al bot.
2. **Habla en lenguaje natural** — el bot entiende verbos como "llamé", "anota", "pasa a", "nuevo lead", "tarea para".
3. **Las escrituras necesitan confirmación** — responde `si` o `no` después de cada `¿Confirmas?`.

Todo lo demás lo aprenderás usándolo. El bot es paciente y siempre puedes decir `cancela` si te equivocas.

Bienvenido al equipo digital de Stratos. Cualquier cosa, manda `ayuda` al bot.

---

*Manual actualizado: 13 de mayo de 2026*
*Versión del asistente: v6 (con confirmaciones FIFO y plantillas de ayuda)*
