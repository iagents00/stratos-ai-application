# Auditoría CRM — Stratos IA
**Fecha:** 24 de Abril, 2026  
**Versión:** 1.0 · Entrega inicial  
**Estado:** ✅ Funcional para demo y uso operativo

---

## RESUMEN EJECUTIVO

El CRM está operativo en su totalidad. 8 módulos funcionales, 3 vistas de datos, sistema de score manual, 4 agentes IA, seguimiento Telegram-first, y flujo completo de registro y gestión de clientes. Sin errores en consola. Listo para entrega.

---

## 1. ENCABEZADO Y KPIs

| Elemento | Estado | Detalle |
|---|---|---|
| Título "CRM Asesores" + contador de clientes | ✅ | Se actualiza en tiempo real con cada lead agregado |
| KPI: Clientes en pipeline | ✅ | Suma total de leads visibles por rol |
| KPI: Score promedio | ✅ | Promedio dinámico de todos los sc |
| KPI: Tasa de conversión | ✅ | Leads en Negociación + Cierre / total |
| KPI: Valor total pipeline | ✅ | Suma de presupuestos formateada en M/K |
| Subtítulo: activos, promedio, pipeline | ✅ | Línea dinámica bajo el título |
| Botón "+ Nuevo cliente" | ✅ | Abre modal completo |

---

## 2. TARJETAS DE PRIORIDAD (Carousel)

| Elemento | Estado | Detalle |
|---|---|---|
| Carousel horizontal con scroll | ✅ | Scroll suave, sin barra visible |
| Filtros de visualización: Urgente / Zoom agendado / Zoom concretado | ✅ | Pills seleccionables, filtran las tarjetas |
| Selector de orden: Manual / Nuevos primero / Nuevos al fondo / Zoom Concretado | ✅ | Dropdown funcional |
| Drag & drop para reordenar | ✅ | Congela a modo Manual al primer arrastre; línea visual de inserción |
| Selector de posición (Prioridad 1, 2, 3…) | ✅ | Dropdown por tarjeta, mueve sin animación brusca |
| Botón X — quitar de prioridad | ✅ | Saca el lead del carousel sin borrarlo |
| Nombre + etapa pill + presupuesto | ✅ | Colores por etapa, budget formateado |
| Badge canal de origen (TG / WA / FB / Web) | ✅ | Visible para leads con `source` distinto de "manual" |
| Score bar + número + botones − + | ✅ | Ajuste manual ±1; barra animada |
| Próxima acción con fecha | ✅ | Editable inline con lápiz; guardar/cancelar |
| Contador de seguimientos − N + | ✅ | FullWidth stepper; +1 punto al score por cada seguimiento |
| Botón "Analizar y actuar" | ✅ | Abre AnalysisDrawer del lead |
| Badge agente IA asignado | ✅ | Color y nombre del agente; botón X para liberar |
| Pulse dot en leads hot/nuevos | ✅ | Animación viva en la esquina del nombre |
| Top bar de color por tipo de lead | ✅ | Shimmer en hot/nuevos; estático en resto |
| Scroll anterior/siguiente (flechas) | ✅ | Visible al haber overflow |

---

## 3. VISTA LISTA

| Elemento | Estado | Detalle |
|---|---|---|
| Tabs Lista / Kanban | ✅ | Cambio de vista sin pérdida de estado |
| Búsqueda por nombre, teléfono, asesor, proyecto, campaña, tag | ✅ | Filtro en tiempo real |
| Filtro etapa (dropdown todas / individual) | ✅ | 10 etapas disponibles |
| Filtro asesor (dropdown todos / individual) | ✅ | Solo visible para admin/director |
| Contador "N resultados" | ✅ | Dinámico según filtros activos |
| Columna CLIENTE: avatar inicial + nombre + tags HOT/NUEVO + presupuesto | ✅ | Avatar con gradiente; presupuesto alineado a la derecha |
| Columna CLIENTE fila 2: asesor · proyecto · fecha · campaña | ✅ | Info completa, ellipsis si es muy largo |
| Badge canal de origen (TG / WA…) | ✅ | Aparece inline entre tags y presupuesto |
| Columna ETAPA: pill con LED + select inline | ✅ | Cambio de etapa sin abrir drawer |
| Columna SEGUIM.: stepper − N + | ✅ | Compact; +1 score por cada seguimiento |
| Columna SCORE: barra + número + − + | ✅ | Ajuste manual ±1; solo visible en modo full |
| Columna ACCIONES: ★ prioridad / ⚛ agente IA / perfil | ✅ | Star agrega al carousel; ⚛ abre selector agente |
| Ordenar por cualquier columna asc/desc | ✅ | Click en header; flecha indica dirección |
| Hover highlight por fila | ✅ | Fondo sutil al pasar el mouse |
| Urgency badge "Nd inactivo" | ✅ | Aparece si daysInactive ≥ 5 |

---

## 4. VISTA KANBAN

| Elemento | Estado | Detalle |
|---|---|---|
| Columnas por etapa (10 etapas) | ✅ | Scroll horizontal entre columnas |
| Contador de leads por columna | ✅ | Badge numérico en cada header |
| Card mini: nombre, asesor/fuente, presupuesto, score, etapa, seguimientos | ✅ | Info compacta y legible |
| Drag & drop entre columnas para cambiar etapa | ✅ | Drop visual; actualiza `st` del lead |
| Badge "Nd sin actividad" en tarjeta | ✅ | Rojo si 3+ días, ámbar si 1-2 |
| Select de etapa inline por tarjeta | ✅ | Cambia etapa sin drag |
| Seguimientos − N + | ✅ | Compact stepper |
| "Registrar" → abre FollowUp inline | ✅ | Cuando seguimientos = 0 |
| Botón "Analizar" + acciones rápidas (★ / perfil / docs) | ✅ | Iconos compactos debajo de cada card |
| Flechas navegación izquierda/derecha | ✅ | Scroll de columnas ocultas |

---

## 5. MODAL NUEVO CLIENTE

| Elemento | Estado | Detalle |
|---|---|---|
| Campo Nombre (obligatorio) | ✅ | Valida que no esté vacío antes de registrar |
| Campo Teléfono | ✅ | Con placeholder +52 998... |
| Campo Email (opcional) | ✅ | Marcado como opcional |
| Selector Presupuesto | ✅ | 12 presets ($100K–$2M+) + input libre; muestra valor formateado |
| Selector Proyecto de interés (full-width) | ✅ | Búsqueda + crear nuevo proyecto; persiste para futuros registros |
| Selector Campaña / Fuente | ✅ | Base de campañas + crear nueva; persiste |
| Selector Asesor | ✅ | Visible solo para admin/director/CEO; asesores ven su nombre auto |
| Selector Etapa inicial | ✅ | Las 10 etapas con colores; default "Nuevo Registro" |
| Campo Próxima acción (opcional) | ✅ | Textarea 2 filas |
| Campo Notas (opcional) | ✅ | Textarea 2 filas |
| **Canal de origen** | ✅ | Chips: Manual · Telegram · WhatsApp · Facebook · Web |
| Score inicial al registrar | ✅ | 5 pts base; crece con seguimientos |
| Botón "Registrar cliente" deshabilitado si sin nombre | ✅ | Color y cursor cambian |
| Lead aparece inmediatamente en lista/kanban | ✅ | Primer lugar de la lista, `isNew: true` |
| Proyecto/campaña nuevos se guardan para el siguiente registro | ✅ | customProyectos, customCampanas state |

---

## 6. DRAWER PERFIL (Tab: Datos)

| Elemento | Estado | Detalle |
|---|---|---|
| Nombre editable inline | ✅ | Click → input; Enter guarda |
| Etiqueta/segmento editable inline | ✅ | Click → input |
| Presupuesto editable inline | ✅ | Parsea sufijos: 300k, 1.5M, etc. |
| Avatar con inicial + tema | ✅ | Tinte accent por tema |
| Badge HOT y días inactivo en header | ✅ | Pills coloreadas |
| Score bar + número + botones −5 / +5 | ✅ | Ajuste manual de score ±5 en este drawer |
| Botones Llamar / WhatsApp | ✅ | Links `tel:` y `wa.me/` con número del lead |
| Próxima acción — NextActionHero | ✅ | Hero visual editable; guarda onUpdate |
| FollowUpBadge stepper | ✅ | Full-width; estado vacío vs con registros |
| StageBadge editable | ✅ | Dropdown de las 10 etapas |
| Selector de Agente IA (4 opciones) | ✅ | Grid 2×2; activo con badge color; liberar con X |
| Tab Datos — formulario de edición completo | ✅ | Botón "Editar" → todos los campos editables |
| Tab Documentos — expediente de notas | ✅ | Upload audio/PDF/texto; lista de items con tipo y fecha |
| Botón Editar completo → guarda todo | ✅ | Valida nombre; normaliza presupuesto |
| Cerrar con X o click en overlay | ✅ | Animación slideOut |

---

## 7. DRAWER EXPEDIENTE (Tab: Análisis IA)

| Elemento | Estado | Detalle |
|---|---|---|
| Header con score manual −5 / número / +5 | ✅ | Label "Score · Manual" |
| Score bar visual bajo nombre | ✅ | Ancho dinámico con transición |
| Próxima acción hero | ✅ | Mismo componente que Perfil |
| FollowUpBadge + StageBadge | ✅ | Acciones rápidas sin salir del drawer |
| "Delegar al equipo IA" — 4 agentes | ✅ | Grid 2×2; activo/inactivo; liberar con X |
| Protocolo Duke del Caribe — recomendaciones | ✅ | Prioridades HOT / SLA / inactividad / etapa |
| NextStepSuggestions según etapa | ✅ | Acciones específicas por etapa del pipeline |
| BANT completitud visual (4 criterios) | ✅ | Cada criterio con check/X y porcentaje |
| Panel de chat / input de notas | ✅ | Agrega texto, audio, PDF al expediente |
| Tab switcher (Dynamic Island bottom) | ✅ | 3 tabs: Análisis · Perfil · Expediente; navega sin perder el lead |
| Badge canal de origen en etiquetas rápidas | ✅ | Aparece junto a HOT / días inactivo |

---

## 8. SISTEMA DE SCORE

| Regla | Estado |
|---|---|
| Score base al crear: **5 pts** | ✅ |
| Cada seguimiento registrado: **+1 pt automático** | ✅ |
| Cada seguimiento eliminado: **−1 pt automático** | ✅ |
| Ajuste manual en tarjetas de prioridad: **±1** | ✅ |
| Ajuste manual en tabla lista: **±1** | ✅ |
| Ajuste manual en Perfil drawer: **±5** | ✅ |
| Ajuste manual en AnalysisDrawer: **±5** | ✅ |
| Rango válido: **0 – 100** (clampeado) | ✅ |
| El score **no se recalcula automáticamente** al cambiar etapa/presupuesto | ✅ (intencional) |

---

## 9. AGENTES IA — CENTRO DE INTELIGENCIA

| Agente | Cola | Acción batch | Estado |
|---|---|---|---|
| Reactivador | Leads 5+ días inactivos | "Reactivar los N" | ✅ |
| Seguimiento | Leads en seguimiento activo | "Ejecutar los N" | ✅ |
| Callcenter IA | Leads HOT para llamada | "Llamar los N" | ✅ |
| Calificador | Leads nuevos sin calificar | "Calificar los N" | ✅ |
| Acción individual por lead (⚡) | ✅ en cada cola | — | ✅ |
| Ver cola completa (icono lista) | ✅ | — | ✅ |
| KPIs de agentes: % eficiencia, ahorros, asignados | ✅ | — | ✅ |
| Actividad reciente (últimas 4 acciones) | ✅ | — | ✅ |

---

## 10. CONTROL DE ROLES Y VISIBILIDAD

| Rol | Ve | Estado |
|---|---|---|
| `super_admin`, `ceo`, `director`, `admin` | Todos los leads de todos los asesores | ✅ |
| `asesor` | Solo sus propios leads (`asesor === user.name`) | ✅ |
| Selector "Asesor asignado" en modal | Solo visible para admins | ✅ |
| Filtro por asesor en lista | Solo visible para admins | ✅ |

---

## 11. CANAL DE ORIGEN — TELEGRAM FIRST

| Elemento | Estado |
|---|---|
| Campo `source` en schema de leads | ✅ |
| Valores: `manual` · `telegram` · `whatsapp` · `facebook` · `web` | ✅ |
| Selector de chips en modal Nuevo Cliente | ✅ |
| Badge TG/WA/FB/Web en tarjetas de prioridad | ✅ |
| Badge en filas de tabla lista | ✅ |
| Badge en drawer (etiquetas rápidas) | ✅ |
| Leads `source: "manual"` → sin badge (UI limpia) | ✅ |
| Leads de Telegram bot llegarán con `source: "telegram"` | 🔧 Requiere backend |

---

## 12. PENDIENTE PARA PRODUCCIÓN

| Ítem | Prioridad | Descripción |
|---|---|---|
| **Supabase — base de datos real** | Alta | Reemplazar localStorage; plan completo en `.claude/plans/` |
| **Telegram Bot** | Alta | BotFather → webhook → Whisper → GPT-4 → INSERT a Supabase |
| **Realtime subscription** | Alta | Leads de Telegram aparecen en CRM sin recargar |
| **Auth real** | Media | Supabase Auth reemplaza el localStorage demo |
| **Persistencia de seguimientos timestamp** | Media | Guardar fecha/hora de cada seguimiento |
| **Notificaciones push** | Baja | Alertas cuando un lead entra por Telegram |
| **Export a Excel/PDF** | Baja | Reporte de pipeline |

---

## 13. ESTADO TÉCNICO

| Check | Estado |
|---|---|
| Build de producción sin errores | ✅ `vite build` limpio |
| Consola del browser sin errores | ✅ 0 errores en runtime |
| Tema claro / oscuro en todo el CRM | ✅ Tokens `P` (dark) / `LP` (light) en todos los componentes |
| Responsive básico (col compact en pantallas pequeñas) | ✅ Modo `co` reduce columnas |
| Datos de prueba (8 leads pre-cargados) | ✅ `src/data/leads.js` |
| Auth demo funcional (`demo@stratos.ai` / `Demo2024`) | ✅ |
| Todos los cambios en git (rama `main`) | ✅ Commit `14a7b00` |

---

## 14. FLUJO COMPLETO VERIFICADO

```
✅ Login demo → entra al CRM
✅ Ver KPIs actualizados en header
✅ Ver tarjetas de prioridad con orden manual
✅ Ajustar score manualmente (±1 en tarjeta)
✅ Registrar seguimiento → score sube +1
✅ Cambiar etapa desde lista/kanban/drawer
✅ Registrar nuevo cliente con canal de origen
✅ Nuevo lead aparece en lista y kanban inmediatamente
✅ Abrir Perfil → editar datos → guardar
✅ Abrir Análisis IA → ver Protocolo Duke → BANT → delegar agente
✅ Ver cola de agentes IA → ejecutar batch
✅ Filtrar por etapa y asesor en lista
✅ Búsqueda por nombre/teléfono/asesor/proyecto
✅ Kanban: drag & drop entre etapas
✅ Modo claro/oscuro: todos los módulos responden
```

---

*Auditoría generada el 24 de Abril, 2026 — Stratos IA v1.0*
