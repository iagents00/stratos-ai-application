# 🛰️ STRATOS IA — Guía de Referencia del Proyecto

> **Propósito**: Este documento es la referencia técnica definitiva del proyecto.  
> Cualquier IA o desarrollador que trabaje en este repo **debe leerlo antes de hacer cambios**.  
> Evita agregar o modificar funcionalidades fuera del contexto aquí documentado.

---
### 🚨 DIRECTIVAS ESTRICTAS PARA IAs Y ASISTENTES DE CÓDIGO 🚨
**ALTO. SI ERES UNA IA DEBES ACATAR ESTO COMO TU INSTRUCCIÓN PRINCIPAL DE SISTEMA (SYSTEM PROMPT):**
1. **Camuflaje Total (Mimetismo):** Genera código que parezca EXACTAMENTE al que ya existe. ESTRICTAMENTE PROHIBIDO introducir TailwindCSS, Bootstrap, CSS Modules o utilidades como `className="flex mt-2"`. Todo el diseño es inline vía la propiedad `style={{...}}`.
2. **Usa el Objeto `P` SIEMPRE:** Nunca uses colores HEX o RGB hardcodeados. Usa `P.bg`, `P.accent`, `P.glass`, etc.
3. **Reutiliza Componentes Base:** Nunca crees tus propios div-cards ni botones custom si ya puedes usar `<G hover onClick={...}>`, `<Pill>`, `<Ico>` o `<KPI>`.
4. **Respeta el Monolito Estático:** Cero APIs reales, cero Routers, cero Zustand. Es un demo SPA local manejado con `useState`.
Si rompes alguna de estas directivas, destruirás la arquitectura del proyecto. ¡Adáptate al paradigma!
---

## Tabla de Contenido

1. [Resumen del Proyecto](#1-resumen-del-proyecto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Arquitectura y Navegación](#4-arquitectura-y-navegación)
5. [Design System (Objeto P)](#5-design-system-objeto-p)
6. [Componentes Compartidos](#6-componentes-compartidos)
7. [Módulo 1: Comando (Dashboard)](#7-módulo-1-comando-dashboard)
8. [Módulo 2: CRM](#8-módulo-2-crm)
9. [Módulo 3: IA CRM (Call Center)](#9-módulo-3-ia-crm-call-center)
10. [Módulo 4: ERP (Inventario)](#10-módulo-4-erp-inventario)
11. [Módulo 5: Asesores (CRM Datos Reales)](#11-módulo-5-asesores-crm-datos-reales)
12. [Módulo 6: Landing Pages](#12-módulo-6-landing-pages)
13. [Módulo 7: Finanzas & Administración](#13-módulo-7-finanzas--administración)
14. [Módulo 8: Personas (RRHH)](#14-módulo-8-personas-rrhh)
15. [Módulo 9: Portal de Candidatos](#15-módulo-9-portal-de-candidatos)
16. [Sistema de Chat / Agente IA](#16-sistema-de-chat--agente-ia)
17. [Dynamic Island (Notificaciones)](#17-dynamic-island-notificaciones)
18. [Datasets Hardcodeados](#18-datasets-hardcodeados)
19. [Convenciones de Código](#19-convenciones-de-código)
20. [Problemas Conocidos y Deuda Técnica](#20-problemas-conocidos-y-deuda-técnica)
21. [Reglas para Contribuir](#21-reglas-para-contribuir)

---

## 1. Resumen del Proyecto

**Stratos IA** es un **Sistema Operativo de Inteligencia Artificial** diseñado como demo/prototipo de una
plataforma de gestión integral para una empresa inmobiliaria de lujo en la Riviera Maya, México.

- **Tipo**: SPA (Single Page Application) — prototipo interactivo con datos estáticos
- **Industria**: Real Estate de lujo — Riviera Maya (Cancún, Playa del Carmen, Tulum)
- **Estado**: Demo funcional avanzado con integración real a Supabase en el módulo CRM
- **Commits**: 3 (integración con Supabase y mapeo de datos)

---

## 2. Stack Tecnológico

| Componente | Tecnología | Versión | Notas |
|---|---|---|---|
| Backend | Supabase | ^2.103.0 | DB, Auth y Real-time activados |
| Framework | React | 19.2.4 | Hooks (useState, useEffect, useLeads) |
| Build Tool | Vite | 8.0.1 | Config mínima |
| Iconografía | Lucide React | 1.7.0 | ~70+ íconos importados |
| Gráficos | Recharts | 3.8.1 | AreaChart, BarChart, PieChart |
| Estilos | CSS-in-JS inline | — | Objeto `P` como design tokens |
| Portales | React createPortal | — | Para modales (FinanzasAdmin, LandingPages) |
| Fuentes | Google Fonts | — | Outfit, Plus Jakarta Sans (cargadas via CSS @import) |

### No utiliza:
- ❌ TypeScript
- ❌ React Router (ni ningún router)
- ❌ Redux / Zustand / Context API
- ❌ TailwindCSS / CSS Modules / Styled Components
- ❌ Backend / API / Base de datos
- ❌ Tests (Vitest, Jest, etc.)
- ❌ ESLint / Prettier configurados

---

## 3. Estructura de Archivos

```
stratos-ia/
├── index.html              # Entry HTML — carga /src/main.jsx
├── package.json            # 4 dependencias (react, react-dom, lucide-react, recharts)
├── vite.config.js          # Config mínima: plugins: [react()]
├── public/
│   ├── favicon.svg         # Ícono del tab
│   └── icons.svg           # Sprite de íconos (no usado actualmente)
└── src/
    ├── main.jsx            # (14 líneas) Punto de entrada — detecta portal vs app
    ├── App.jsx             # (5,330 líneas / 373 KB) ⚠️ TODO el código aquí
    ├── App.css             # (39 líneas) Solo keyframes (shimmer, pulseGlow, slideInRight)
    ├── index.css            # (4 líneas) Reset y scroll smooth
    └── assets/
        ├── hero.png        # Imagen hero (landing pages)
        ├── react.svg       # Logo React (no usado)
        └── vite.svg        # Logo Vite (no usado)
```

### Punto de entrada: `main.jsx`

```javascript
// Lógica de routing básica por query params:
// - URL contiene "?apply" o "#apply" → renderiza <PortalApp /> (Portal de Candidatos)
// - Cualquier otra URL → renderiza <App /> (Aplicación principal)
```

---

## 4. Arquitectura y Navegación

### Sistema de Navegación

La navegación se maneja con un `useState` en el componente `App` (línea 4725):

```javascript
const [v, setV] = useState("d"); // "d" = Dashboard por defecto
```

Array de navegación (línea 1463):

| `id` | Label UI | Ícono Lucide | Componente Renderizado | Líneas |
|---|---|---|---|---|
| `"d"` | Comando | `Activity` | `<Dash />` | 424–547 |
| `"c"` | CRM | `Users` | `<CRM />` | 549–620 |
| `"ia"` | IA CRM | `Atom` | `<IACRM />` | 826–1277 |
| `"e"` | ERP | `Building2` | `<ERP />` | 622–736 |
| `"a"` | Asesores | `Trophy` | `<AsesorCRM />` | 884–1100 |
| `"lp"` | Landing Pages | `Globe` | `<LandingPages />` | 1474–3276 |
| `"fa"` | Finanzas | `Landmark` | `<FinanzasAdmin />` | 3278–3993 |
| `"rrhh"` | Personas | `UserCheck` | `<RRHHModule />` | 4019–4722 |

### Componente raíz `App` (línea 4724–4897)

Estado global:

| Variable | Tipo | Propósito |
|---|---|---|
| `v` | string | ID de la vista activa |
| `co` | boolean | Chat panel abierto/cerrado |
| `msgs` | array | Historial de mensajes del chat |
| `inp` | string | Input actual del chat |
| `notifs` | array | Notificaciones del Dynamic Island |

**Layout**: Sidebar (60px) + Main Content (flex) + Chat Panel (400px, condicional)

---

## 5. Design System (Objeto P)

Definido en línea 32. **Todos los componentes usan estas constantes. No usar colores hardcodeados.**

### Colores

| Token | Valor Hex | RGB/RGBA | Uso |
|---|---|---|---|
| `P.bg` | `#060A11` | — | Fondo principal de la app |
| `P.surface` | `#0C1219` | — | Superficies elevadas (modales, dropdowns) |
| `P.glass` | — | `rgba(255,255,255,0.035)` | Fondo glassmorphism de cards |
| `P.glassH` | — | `rgba(255,255,255,0.055)` | Fondo glassmorphism hover |
| `P.border` | — | `rgba(255,255,255,0.07)` | Bordes por defecto |
| `P.borderH` | — | `rgba(255,255,255,0.12)` | Bordes en hover |
| `P.accent` | `#6EE7C2` | — | **Color primario** (verde menta) — CTAs, éxito, activo |
| `P.accentS` | — | `rgba(110,231,194,0.08)` | Fondo sutil del accent |
| `P.accentB` | — | `rgba(110,231,194,0.14)` | Borde sutil del accent |
| `P.blue` | `#7EB8F0` | — | Secundario — información, datos |
| `P.violet` | `#A78BFA` | — | Terciario — IA, RRHH, premium |
| `P.amber` | `#67B7D1` | — | Precaución, alerts moderados |
| `P.rose` | `#E8818C` | — | Error, riesgo, eliminación |
| `P.emerald` | `#6DD4A8` | — | Éxito, positivo, ingresos |
| `P.cyan` | `#5DC8D9` | — | Informativo auxiliar |
| `P.txt` | `#E2E8F0` | — | Texto primario |
| `P.txt2` | `#8B99AE` | — | Texto secundario / labels |
| `P.txt3` | `#4A5568` | — | Texto terciario / desactivado |

### Border Radius

| Token | Valor | Uso |
|---|---|---|
| `P.r` | `16` | Cards principales |
| `P.rs` | `10` | Botones, inputs |
| `P.rx` | `6` | Tags, badges pequeños |

### Tipografía

```javascript
const font = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const fontDisp = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
```

- `font` → texto body, labels, párrafos
- `fontDisp` → títulos, números grandes, KPIs, encabezados

Google Fonts importadas: `Outfit` (400, 600, 700, 800) y `Plus Jakarta Sans` (400–800).

### Estilo visual

- **Tema**: Dark mode exclusivo (sin light mode)
- **Efecto glass**: `backdropFilter: "blur(32px)"` + backgrounds semi-transparentes
- **Animaciones**: fadeIn, pulse, blink, spin, wave (definidas en `<style>` dentro de `App`)
- **Hover**: Transiciones de 0.2s–0.3s con `cubic-bezier(.4,0,.2,1)`

---

## 6. Componentes Compartidos

### `G` — Glass Card (línea 65)

```javascript
<G hover onClick={fn} np style={{...}}>
  {children}
</G>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `hover` | boolean | false | Activa efecto hover (glass → glassH, border → borderH) |
| `onClick` | function | — | Handler de click (cambia cursor a pointer) |
| `np` | boolean | false | "No padding" — desactiva padding:18 |
| `style` | object | — | Estilos adicionales |

### `Pill` — Badge / Tag (línea 80)

```javascript
<Pill color={P.emerald} s>+18% vs 2025</Pill>
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `color` | string | `P.accent` | Color del texto y fondo sutil |
| `s` | boolean | false | "Small" — reduce padding y font-size |

### `Ico` — Icon Container (línea 90)

```javascript
<Ico icon={TrendingUp} sz={34} is={16} c={P.accent} />
```

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `icon` | Component | — | Componente Lucide (ej: `TrendingUp`) |
| `sz` | number | 34 | Tamaño del contenedor |
| `is` | number | 16 | Tamaño del ícono |
| `c` | string | `P.accent` | Color del ícono y fondo sutil |

### `KPI` — KPI Card (línea 98)

```javascript
<KPI label="Ingresos" value="$35.9M" sub="+12% vs Q3" icon={TrendingUp} color={P.emerald} />
```

| Prop | Tipo | Descripción |
|---|---|---|
| `label` | string | Nombre del KPI |
| `value` | string | Valor principal (formateado) |
| `sub` | string | Subtítulo con tendencia |
| `icon` | Component | Ícono Lucide |
| `color` | string | Color del ícono y subtítulo |

### `StratosAtom` — Logo SVG (línea 47)

```javascript
<StratosAtom size={20} color="#6EE7C2" />
```

3 círculos concéntricos minimalistas. Se usa en sidebar, topbar, portal y chat.

### `AIAtom` — Ícono IA con aros (línea 3995)

```javascript
<AIAtom size={28} color={P.violet} spin={true} />
```

Logo SVG profesional con 3 aros orbitales. `spin` activa rotación CSS.

---

## 7. Módulo 1: Comando (Dashboard)

**Componente**: `Dash` (líneas 424–547)  
**Prop**: `oc` (function) — abre chat con mensaje prepopulado  
**Nav ID**: `"d"`

### Contenido:
- **4 KPIs principales**: Ingresos ($35.9M), Proyección (70), Conversión (18.4%), Agentes IA (47)
- **Gráfico AreaChart**: Ingresos vs Objetivo (6 meses) — usa `ingD` dataset
- **Pipeline de ventas**: 4 etapas visuales (Prospecto→Visita→Negociación→Cierre) con conteos
- **4 acciones rápidas**: Dictado por voz, Prioridades 80/20, Agenda de hoy, Reporte semanal
- **Tabla clientes prioritarios**: Top 5 clientes con valor, probabilidad, riesgo
- **Estado agentes IA**: 3 agentes (Estrategia, Coordinación, Análisis) con status
- **Tabla equipo**: 8 miembros con metas, avance, estado

### Datasets usados:
- `ingD` — array de 6 objetos `{m, ing, obj}` (meses, ingresos, objetivo)
- `pipeD` — array de 4 objetos `{s, n, v, c}` (etapas pipeline)
- `team` — array de 8 objetos con datos de cada asesor
- `priorityClients` — array de 5 objetos (clientes 80/20)
- `agents` — array de 3 objetos (agentes IA)

---

## 8. Módulo 2: CRM

**Componente**: `CRM` (líneas 549–620)  
**Prop**: `oc` (function)  
**Nav ID**: `"c"`

### Contenido:
- **5 leads demo** con datos enriquecidos: nombre, score (0-100), etapa, valor, biografía, riesgo, acciones IA
- **Vista de lista filtrable** por etapa
- **Histograma de distribución de scores** (BarChart)
- **Análisis 80/20**: 14 leads top = $28.6M = 59% del pipeline

### Dataset: `leads` — 5 objetos con campos:
```
{ id, name, score, stage, value, bio, risk, action, avatar, color }
```

---

## 9. Módulo 3: IA CRM (Call Center)

**Componente**: `IACRM` (líneas 826–1277)  
**Prop**: `oc` (function)  
**Nav ID**: `"ia"`

### Contenido:
- **Logo átomo custom** (SVG inline de 3 aros orbitales)
- **5 agentes IA** con métricas: llamadas activas, tasa de éxito, cola
- **6 clientes para reactivar** con score de prioridad y técnica sugerida
- **4 campañas automatizadas**: Post-Zoom 48h, Reactivación 7 días, Follow-up visita, Nurture mensual
- **Gráfico BarChart**: Volumen de llamadas por hora del día (8am-8pm)
- **4 técnicas de reactivación**: Take Away (42%), Urgencia (38%), Prueba Social (34%), Exclusividad (31%)
- **Recordatorios activos**: Tareas programadas para agentes

### Datasets:
- `agents` — 5 agentes IA
- `reactivarClients` — 6 clientes con técnica de venta
- `campaigns` — 4 campañas automatizadas
- `callVolume` — 13 objetos por hora
- `techniques` — 4 técnicas de venta

---

## 10. Módulo 4: ERP (Inventario)

**Componente**: `ERP` (líneas 622–736)  
**Prop**: `oc` (function)  
**Nav ID**: `"e"`

### Contenido:
- **4 proyectos inmobiliarios**: El Gobernador 28, Portofino, Monarca 28, Villas Tulum
- **Distribución de inventario**: vendidas/disponibles/reservadas (PieChart)
- **Métricas**: $70.8M valor generado, $18.7M pipeline, 6.8 meses absorción
- **Cards de proyecto** con ROI, unidades, márgenes, fechas de entrega

### Dataset: `projects` — 4 objetos con campos:
```
{ id, name, units, sold, avail, reserved, avgPrice, totalValue, roi, margin, delivery, zone, status }
```

---

## 11. Módulo 5: Asesores (CRM Datos Reales)

**Componente**: `AsesorCRM` (líneas 884–1100)  
**Prop**: `oc` (function)  
**Nav ID**: `"a"`

### ⚠️ ALERTA: Este módulo contiene datos aparentemente reales

### Contenido:
- **17 registros CRM** con datos que parecen ser de clientes reales (nombres, teléfonos, contexto)
- **Búsqueda y filtrado** por status
- **4 columnas Kanban**: Zoom, Seguimiento, WhatsApp, No Contesta
- **Cards de registro** con notas, contexto, teléfono, fecha, valor
- **Pipeline visual** con conteo por etapa

### Dataset: `crmAsesores` (línea 1443) — 17 objetos con campos:
```
{ id, nombre, telefono, status, valor, contexto, notas, fecha, asesor }
```

> **IMPORTANTE**: Los teléfonos y nombres en este dataset deben ser sanitizados antes de cualquier deploy público.

---

## 12. Módulo 6: Landing Pages

**Componente**: `LandingPages` (líneas 1474–3276)  
**Sin props** (autosuficiente)  
**Nav ID**: `"lp"`

### Contenido:
- **Generador de landing pages personalizadas** para enviar a clientes potenciales
- **6+ propiedades** con arte SVG generativo: Portofino, El Gobernador 28, Monarca 28, Villas Tulum, Aldea Zamá, Arrecife
- **Composer de mensajes** con 4 plantillas: Formal, Cálido, Exclusivo, Inversión
- **Preview en tiempo real** de la landing page generada
- **Calculadora de ROI** integrada (apreciación anual, Airbnb mensual, gastos)
- **Modal para agregar nuevas propiedades**
- **Mapa visual SVG** de la Riviera Maya
- **Ilustración SVG inline** para cada propiedad (`PropArt`): arte geométrico único

### State interno:
```
selProp, showComposer, showPreview, showCalc, showNewProp, filterZone, msgStyle, customMsg
```

### Estilos de mensaje:
| ID | Nombre | Tono |
|---|---|---|
| `formal` | Formal | Profesional corporativo |
| `warm` | Cálido | Personal y cercano |
| `exclusive` | Exclusivo | Ultra-premium, luxury |
| `invest` | Inversión | ROI y datos financieros |

---

## 13. Módulo 7: Finanzas & Administración

**Componente**: `FinanzasAdmin` (líneas 3278–3993)  
**Sin props**  
**Nav ID**: `"fa"`

### Sub-tabs:
| Tab ID | Label | Ícono | Contenido |
|---|---|---|---|
| `"panel"` | Panel General | BarChart3 | KPIs + gráfico flujo + últimas facturas + obligaciones |
| `"cfdi"` | Facturación CFDI 4.0 | Receipt | Tabla de facturas + filtros + modal nueva factura |
| `"fiscal"` | Obligaciones Fiscales | ListChecks | Calendario fiscal + status + artículos de ley |
| `"cuentas"` | Cuentas CxC / CxP | Wallet | Sub-tabs Cobrar/Pagar + tablas |
| `"flujo"` | Flujo de Caja | TrendingUp | BarChart mensual + tabla detalle + márgenes |

### Datasets:
- `cfdiData` — 8 facturas CFDI 4.0 con UUID, RFC, montos, status
- `obligaciones` — 12 obligaciones fiscales (ISR, IVA, IMSS, CFDI, DIOT, CONT)
- `cxcData` — 6 cuentas por cobrar
- `cxpData` — 5 cuentas por pagar
- `flujoData` — 12 meses (Ene-Dic) con ingresos, egresos, saldo

### Modal: `NewCFDIModal`
Formulario de nueva factura CFDI 4.0 con:
- Tipo de comprobante (I/E/P/T)
- Receptor, RFC, concepto
- Subtotal, IVA (16%/8%/0%), total calculado
- Método de pago (PUE/PPD), forma de pago, uso CFDI
- Renderizado vía `createPortal` sobre `document.body`

### Helpers financieros:
- `fmt(n)` → formatea montos ($35.9M o $52,200)
- `fmtPct(n)` → formatea porcentajes (18.4%)
- Mapas de colores: `tipoColor`, `tipoLabel`, `tipoObl`, `statusCFDI`, `statusObl`, `statusCX`

---

## 14. Módulo 8: Personas (RRHH)

**Componente**: `RRHHModule` (líneas 4019–4722)  
**Sin props**  
**Nav ID**: `"rrhh"`

### Sub-tabs:
| Tab ID | Label | Ícono | Contenido |
|---|---|---|---|
| `"panel"` | Panel | BarChart3 | KPIs + pipeline visual + top candidatos + vacantes |
| `"pipeline"` | Pipeline IA | Workflow | Lista de candidatos con filtros, búsqueda, detalle expandible |
| `"vacantes"` | Vacantes | Briefcase | Cards de vacantes con métricas y acciones |
| `"empleados"` | Directorio | Users | Tabla de empleados activos |
| `"ia_scan"` | Escáner IA | AIAtom | Upload zone + simulación de análisis de CV |

### Datasets:
- `candidates` — 8 candidatos con score IA, culture fit, técnico, actitud, habilidades, fuente, etapa
- `vacantes` — 4 vacantes abiertas con departamento, ubicación, salario, status
- `empleados` — 6 empleados activos con cargo, salario, score, estado
- `etapas` — 7 etapas del pipeline: Postulado → Screening → Entrevista → Assessment → Oferta → Contratado → Rechazado

### Escáner IA (simulado):
1. Click en zona de upload → `simulateAIScan()`
2. 3 pasos animados (600ms, 1300ms, 1900ms, 2200ms):
   - Extrayendo texto del documento
   - Identificando experiencia, habilidades y educación
   - Calculando score IA y compatibilidad
3. Resultado hardcodeado: "Ana Patricia Solís Medina" con score 93

### Helpers RRHH:
- `scoreColor(s)` → color según score (≥85 emerald, ≥70 accent, ≥55 amber, <55 rose)
- `scoreLabel(s)` → etiqueta (Excelente, Bueno, Regular, No apto)
- `etapaColor` — mapa etapa→color
- `prioColor` — mapa prioridad→color

---

## 15. Módulo 9: Portal de Candidatos

**Componente**: `CandidatePortal` (líneas 4936–5324)  
**Exportado como**: `PortalApp` (línea 5327)  
**Acceso**: URL con `?apply` o `#apply`

### Flujo multi-step:
| Step | Nombre | Contenido |
|---|---|---|
| 1 | Tus datos | Formulario: nombre, apellido, email, teléfono, LinkedIn |
| 2 | Posición | Selección de vacante (4 opciones) |
| 3 | Tu CV | Upload de archivo (drag & drop + click) |
| 4 | Preguntas IA | 4-5 preguntas contextuales por puesto |
| 5 | Confirmación | Folio generado, mensaje de éxito |

### Dataset: `PORTAL_VACANTES` (línea 4901) — 4 vacantes:
1. Asesor de Ventas Senior — Riviera Maya
2. Coordinadora de Marketing Digital
3. Contador Fiscal Sr. — CFDI 4.0
4. Asistente de Dirección Ejecutiva

### Dataset: `PREGUNTAS_BASE` (línea 4912) — Preguntas por puesto:
- Cada puesto tiene 5 preguntas específicas
- Tipos de pregunta: `opciones`, `multiselect`, `texto`
- Fallback a `PREGUNTAS_BASE.default` si no hay preguntas específicas

### Validación:
- Step 1: nombre, apellido, email (contiene @), teléfono (≥10 dígitos)
- Step 4: Cada pregunta requiere respuesta antes de avanzar

### IA simulada:
- Al terminar preguntas → spinner 2.8 segundos → genera folio `STRP-XXXXXX`
- No hay procesamiento real

---

## 16. Sistema de Chat / Agente IA

**Componente**: `Chat` (definido inline, ~líneas 200–420)  
**Props**:

| Prop | Tipo | Descripción |
|---|---|---|
| `open` | boolean | Panel visible/oculto |
| `onClose` | function | Cierra el panel |
| `msgs` | array | Historial de mensajes |
| `setMsgs` | function | Setter del historial |
| `inp` | string | Input actual |
| `setInp` | function | Setter del input |

### `getResp(text)` — Motor de respuestas (líneas ~130–200)

Es un **keyword matcher local**, no una API de IA real.

| Keyword | Tipo de respuesta |
|---|---|
| Nombre de lead (ej: "James", "Rodríguez") | Expediente detallado del lead |
| "propuesta", "genera" | Propuesta comercial con blueprint |
| "portofino", "gobernador" | Análisis de mercado del proyecto |
| "priorit", "80-20", "hoy" | Lista de prioridades del día |
| "agenda", "llamada" | Cita agendada (confirmación) |
| "equipo", "reporte" | Reporte de rendimiento del equipo |
| default | Solicitar más contexto al usuario |

### Funcionalidad de voz:
- Botón de micrófono simula grabación
- Después de 2.8 segundos, inserta respuesta fija
- No usa Web Speech API real

### UI del chat:
- Panel lateral derecho de 400px
- Animación de entrada `slideInRight 0.35s`
- Typing indicator con 3 dots animados (blink)
- Botones de acción contextual en las respuestas del agente
- Scroll automático al bottom con `useRef`

---

## 17. Dynamic Island (Notificaciones)

**Componente**: `DynIsland` (línea 112)  
**Props**: `onExpand` (function), `notifications` (array)

### Comportamiento:
- **Collapsed**: Pill minimalista en el topbar central
- **Expanded**: Lista de notificaciones con detalle expandible
- Las notificaciones se agregan progresivamente con `setTimeout` (cada 2-7s)
- Máximo 4 notificaciones visibles (FIFO)

### Notificaciones por defecto (hardcodeadas en línea 4732):
6 notificaciones operativas con datos de la empresa.

### Acciones:
- Click en notificación → expande detalle con botón de acción
- Botón de acción → llama a `onExpand(action)` → abre chat con el mensaje

---

## 18. Datasets Hardcodeados

> **TODOS los datos del proyecto son estáticos y están embebidos en `App.jsx`.**

| Dataset | Línea aprox. | Registros | Módulo |
|---|---|---|---|
| `ingD` (ingresos) | ~430 | 6 | Dashboard |
| `pipeD` (pipeline) | ~440 | 4 | Dashboard |
| `team` (equipo) | ~450 | 8 | Dashboard |
| `priorityClients` | ~460 | 5 | Dashboard |
| `agents` (agentes IA) | ~470 | 3 | Dashboard |
| `leads` | ~550 | 5 | CRM |
| `projects` | ~625 | 4 | ERP |
| `agents` (call center) | ~830 | 5 | IA CRM |
| `reactivarClients` | ~860 | 6 | IA CRM |
| `campaigns` | ~880 | 4 | IA CRM |
| `callVolume` | ~900 | 13 | IA CRM |
| `techniques` | ~920 | 4 | IA CRM |
| `crmAsesores` | ~1443 | 17 | Asesores ⚠️ |
| `properties` (landing) | ~1480 | 6+ | Landing Pages |
| `cfdiData` | ~3289 | 8 | Finanzas |
| `obligaciones` | ~3301 | 12 | Finanzas |
| `cxcData` | ~3317 | 6 | Finanzas |
| `cxpData` | ~3327 | 5 | Finanzas |
| `flujoData` | ~3336 | 12 | Finanzas |
| `candidates` | ~4030 | 8 | RRHH |
| `vacantes` | ~4042 | 4 | RRHH |
| `empleados` | ~4050 | 6 | RRHH |
| `PORTAL_VACANTES` | ~4901 | 4 | Portal |
| `PREGUNTAS_BASE` | ~4912 | 5 sets | Portal |

---

## 19. Convenciones de Código

### Nomenclatura de variables (abreviada por diseño)

| Variable | Significado | Dónde |
|---|---|---|
| `P` | Palette/design tokens | Global |
| `G` | Glass card component | Global |
| `v` | View activa (id de módulo) | App |
| `co` | Chat open | App |
| `oc` | Open chat (callback) | App → módulos |
| `np` | No padding | G component |
| `s` | Small variant | Pill |
| `sz` | Size (contenedor) | Ico |
| `is` | Icon size | Ico |
| `c` | Color | Ico, Pill |
| `h` | Hover state | G |
| `msgs` | Messages (chat) | App, Chat |
| `inp` | Input value (chat) | App, Chat |

### Patrones recurrentes:

1. **KPI grids**: `display: grid, gridTemplateColumns: "repeat(N, 1fr)"` con `<G hover>`
2. **Tablas**: Header con uppercase labels → rows con `onMouseEnter/Leave` para hover
3. **Filtros**: Botones con `border/background` que cambian según estado activo
4. **Modales**: `createPortal` a `document.body` con overlay blur
5. **Colores de status**: Mapas `{ status: P.color }` para consistencia

---

## 20. Problemas Conocidos y Deuda Técnica

### 🔴 Críticos (resolver antes de producción)

| # | Problema | Impacto | Ubicación |
|---|---|---|---|
| 1 | **Monolito de 5,330 líneas** | Imposible mantener, testear o colaborar | `App.jsx` completo |
| 2 | **Datos 100% hardcodeados** | No hay backend, todo se pierde al recargar | Todos los datasets |
| 3 | **Sin routing** | No se puede bookmarkear/compartir vistas | `App` usa `useState("d")` |
| 4 | **Datos reales expuestos** | Teléfonos y nombres de clientes reales en el código | `crmAsesores` L1443 |

### 🟡 Importantes

| # | Problema | Impacto |
|---|---|---|
| 5 | CSS 100% inline | Sin responsive, duplicación, sin pseudo-selectores |
| 6 | Sin TypeScript | Sin type safety en 5K+ líneas |
| 7 | Sin code splitting / lazy loading | Bundle único de 373 KB JSX |
| 8 | Sin tests | 0% cobertura |
| 9 | Variables crípticas (`P`, `G`, `co`, `oc`, `v`) | Dificulta lectura para nuevos devs |
| 10 | Chat sin IA real | Solo keyword matching local |

### 🟢 A futuro

| # | Problema | Impacto |
|---|---|---|
| 11 | Sin SEO/meta tags | Solo `<title>` básico |
| 12 | Sin Error Boundaries | Crash silencioso en errores |
| 13 | Sin persistencia de estado | Todo se pierde al recargar |
| 14 | SVG inline masivos | +200 líneas de SVG por propiedad |
| 15 | Sin accesibilidad (a11y) | Falta ARIA, keyboard nav, focus |

---

## 21. Reglas para Contribuir

<AI_SYSTEM_PROMPT>
**ATENCIÓN LLMs e IAs:** Tu éxito en este desarrollo depende de **NO INVENTAR** tecnologías o patrones que no se están usando.
- NO trates de "modernizar" o "arreglar" la estructura separando archivos a menos que el usuario te pida EXPRESAMENTE refactorizar.
- Trabaja sobre el archivo masivo `App.jsx` de 5,330 líneas y respétalo.
- Sigue al pie de la letra la sintaxis abreviada observada (`v`, `co`, `msgs`, componentes `<G>`, variables CSS inline).
</AI_SYSTEM_PROMPT>

### ✅ SÍ hacer:
1. **Ser un clon del desarrollador original:** Tu código generado debe ser indistinguible del actual.
2. **Leer este documento completo** antes de cualquier cambio
2. **Usar los tokens de `P`** para colores, no valores hardcodeados
3. **Seguir la estética glassmorphism oscura** (dark mode, blur, bordes sutiles)
4. **Reutilizar `G`, `Pill`, `Ico`, `KPI`** en lugar de crear nuevos componentes base
5. **Mantener la consistencia visual** con los módulos existentes
6. **Usar `font` para body y `fontDisp` para títulos/números**
7. **Documentar datasets nuevos** en este archivo

### ❌ NO hacer:
1. **No agregar módulos nuevos** sin actualizar la tabla de navegación (`nav`) y este documento
2. **No importar CSS frameworks** (Tailwind, Bootstrap) sin decisión explícita de refactorización
3. **No cambiar la paleta de colores** sin justificación de diseño
4. **No agregar dependencias innecesarias** — el proyecto intencionalmente tiene solo 4
5. **No exponer datos sensibles** (teléfonos, RFC reales) en el código
6. **No crear archivos de componentes separados** sin un plan de refactorización completo
7. **No cambiar los nombres de las variables de estado globales** (`v`, `co`, `msgs`) sin actualizar todas las referencias

### Al agregar una nueva vista/módulo:
1. Crear el componente en `App.jsx` (por ahora, hasta refactorización)
2. Agregar entrada al array `nav` (línea 1463) con `{ id, l, i }`
3. Agregar el renderizado condicional en `App` (línea ~4883)
4. Actualizar este documento con la nueva sección

---

> **Última actualización**: Abril 2026  
> **Generado por**: Análisis automatizado del código fuente  
> **Archivo principal**: `src/App.jsx` (5,330 líneas / 373 KB)
