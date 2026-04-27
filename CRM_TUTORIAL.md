# 📘 Stratos AI — Guía Rápida del CRM

**Para:** Equipo comercial (asesores, directores, CEO)
**Versión:** 1.0 — Lanzamiento inicial
**Tiempo de lectura:** 8 minutos

---

## 1. Entrar al sistema

1. Abre `https://app.stratoscapitalgroup.com` en tu navegador (preferible Chrome o Safari).
2. Ingresa tu correo y contraseña temporal.
3. La primera vez que entres, **cambia tu contraseña** desde el menú de tu perfil.

> 💡 **Consejo:** Marca la página como favorito (`Cmd+D` en Mac, `Ctrl+D` en Windows) para acceso rápido.

---

## 2. ¿Qué ves al entrar? — El Centro de Inteligencia

La pantalla principal es tu **dashboard de comando**. Te muestra:

- **KPIs en vivo** — clientes en pipeline, score promedio, conversión, valor total.
- **Clientes en prioridad** — los 3-5 leads que MÁS atención requieren hoy, ordenados por urgencia.
- **Pipeline visual** — distribución de tus clientes por etapa (Nuevo Registro → Cierre).

Cada tarjeta de cliente prioritario tiene un botón grande **"Tomar acción"** — es tu primer movimiento del día.

---

## 3. El módulo CRM — Tu pipeline completo

En el menú izquierdo, click en **CRM**.

### 3.1 Vistas

| Vista | Cuándo usar |
|---|---|
| **Lista** (`☰`) | Cuando quieres ver todos los datos en tabla, ordenar/filtrar |
| **Kanban** (`▥`) | Cuando quieres mover leads entre etapas con drag-and-drop |

### 3.2 Filtros disponibles

- 🔍 Búsqueda por nombre, teléfono, asesor, campaña.
- Filtro por **etapa** (10 etapas: Nuevo Registro, Primer Contacto, Seguimiento, Zoom Agendado, Zoom Concretado, Visita Agendada, Visita Concretada, Negociación, Cierre, Perdido).
- Filtro por **asesor** (solo CEO/director/admin).

---

## 4. Trabajar con un lead — Los 3 drawers

Al hacer click en un lead, abre un panel lateral con **3 vistas** que cambias con un switcher abajo:

| Vista | Para qué sirve |
|---|---|
| 🟢 **Análisis IA** | Recomendaciones automáticas: qué decir, próxima acción óptima, riesgos detectados |
| 🟣 **Perfil** | Datos del cliente: presupuesto, proyecto, campaña, score, asesor asignado |
| 🔵 **Expediente** | Notas largas, transcripciones de llamadas, documentos, historial de actividad |

### 4.1 Próxima acción (lo más importante)

En cualquiera de los 3 drawers, **siempre** se ve arriba:
- Qué hacer próximamente con este cliente.
- Cuándo (fecha y hora).
- Si está atrasada, en amarillo o rojo.

**Botón "Registrar"** (→) marca la acción como hecha y mueve la próxima al historial automáticamente.

### 4.2 Botón "Historial" (esquina superior derecha)

🆕 Cuando abres cualquier lead, ahora aparece un botón **"Historial"** flotante en la esquina superior derecha.

Click para ver:
- Todos los cambios hechos a este lead.
- Quién los hizo (nombre + rol).
- Cuándo (fecha y hora).
- Qué cambió exactamente (campo por campo, valor anterior → nuevo).

**Útil para:**
- Auditoría: "¿quién cambió la etapa el martes?"
- Onboarding de un asesor que toma un lead que venía trabajando otro.
- Resolver discrepancias entre lo que dice el cliente y lo que hicimos.

---

## 5. Crear un lead nuevo

### 5.1 Forma rápida

1. Botón verde **"+ Nuevo cliente"** arriba a la derecha del CRM.
2. Llena nombre, teléfono, presupuesto (mínimo).
3. Asigna asesor, proyecto y campaña.
4. Etapa inicial: por default queda en **"Nuevo Registro"**.
5. Click **"Crear lead"**.

### 5.2 Campos importantes

| Campo | Por qué importa |
|---|---|
| **Asesor asignado** | Define quién ve este lead (RLS — solo el asesor + sus superiores). Tiene que coincidir EXACTO con el nombre del perfil del asesor. |
| **Score** | 0-100, calculado a partir de presupuesto + estado actual + interacciones. Sube con cada seguimiento. |
| **Próxima acción + fecha** | Te recordará en el dashboard hasta que la marques como hecha. |
| **Bio / Notas** | Texto libre. Lo que el asesor sabe del cliente. |
| **Risk** | "frío", "templado", "caliente" — alimenta el dashboard. |
| **Campaña** | De qué campaña vino. Sirve para reportes de ROI. |

---

## 6. Mover un lead entre etapas

### En vista Kanban
- **Drag & drop** la tarjeta a la columna destino.
- El sistema registra el cambio en el historial automáticamente.

### En vista Lista
- Click en el lead → drawer Perfil → cambia "Etapa" del menú.

### Etapas y qué significan

```
Nuevo Registro      → llegó hoy, nadie lo ha contactado
Primer Contacto     → ya hablamos, quedó interesado
Seguimiento         → conversaciones repetidas, calificando interés
Zoom Agendado       → tiene cita virtual programada
Zoom Concretado     → asistió a la reunión virtual
Visita Agendada     → viene al sitio
Visita Concretada   → ya estuvo en sitio
Negociación         → discutiendo términos
Cierre              → firmó / pagó
Perdido             → no procedió
```

---

## 7. Notas y expediente

En el drawer **Expediente** puedes:

1. **Escribir nota libre** — campo de texto al estilo Telegram, mandas con `Enter`.
2. **Pegar transcripción** — si pegas más de 200 caracteres, se marca como "Transcripción manual".
3. **Subir archivo** _(disponible en Fase 2)_.
4. **Voz a texto** _(disponible en Fase 2)_.

Cada nota queda con fecha y autor. Aparece automáticamente en el **historial unificado** del lead.

---

## 8. Roles y qué puede ver cada uno

| Rol | Permisos |
|---|---|
| `super_admin` | Todo: usuarios, leads, finanzas, RRHH, ajustes |
| `admin` | Casi todo, sin tocar usuarios |
| `ceo` | Dashboard global, todo el pipeline, finanzas, equipo |
| `director` | Su equipo + el pipeline completo de su equipo |
| `asesor` | **Solo sus propios leads** |

**Importante:** El rol se asigna desde Supabase Dashboard. Si necesitas cambio de rol, contacta al super_admin.

---

## 9. Atajos de teclado útiles

| Tecla | Acción |
|---|---|
| `Cmd/Ctrl + K` | Búsqueda global (próximamente) |
| `Esc` | Cerrar drawer abierto |
| `/` | Enfocar barra de búsqueda |

---

## 10. Buenas prácticas

✅ **Sí hacer:**
- Registrar la próxima acción **inmediatamente** después de cada llamada.
- Mover el lead a la siguiente etapa apenas sucede el evento (no esperar al final del día).
- Escribir notas concretas, no abstractas. "Cliente prefiere visita el sábado 3 de mayo" > "Le interesa visitar".
- Usar el botón "Historial" antes de tomar acción si el lead venía trabajándose con otra persona.

❌ **No hacer:**
- Crear leads duplicados — usa la búsqueda primero.
- Escribir información sensible (contraseñas, datos financieros completos) en notas — usa solo lo necesario.
- Cambiar el asesor asignado sin avisar al equipo afectado.

---

## 11. Reportar un problema

Si encuentras un error o algo que no funciona como esperas:

1. **Copia** el mensaje exacto del error (si lo hay).
2. **Captura** una pantalla.
3. **Anota** qué estabas haciendo justo antes.
4. Repórtalo en el canal de Stratos directamente al super_admin.

> En Fase 2 tendremos un **agente de soporte conversacional** integrado — escribirás tu duda y te resolverá en el momento.

---

## 12. ¿Y ahora qué? — Tu primera hora con Stratos

1. Entra al sistema.
2. Cambia tu contraseña.
3. Recorre el dashboard 5 minutos para ubicarte.
4. Abre tu primer lead — explora los 3 drawers.
5. Crea un lead de prueba con tu propio nombre, muévelo entre 2 etapas, agrega una nota.
6. Borra ese lead de prueba (o pásalo a "Perdido").
7. Empieza a trabajar tus leads reales.

---

**Bienvenido al sistema operativo comercial de Stratos.**
*Si algo no está claro en esta guía, dilo — la actualizamos.*
