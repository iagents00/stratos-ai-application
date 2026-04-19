# 🎨 VISUAL GUIDE — Qué Verás en Pantalla

**Descripción visual de cómo se ve Stratos IA. Úsalo para entender la estructura.**

---

## 📱 Layout General

```
┌─────────────────────────────────────────────────────────────────────┐
│ Stratos IA | Centro de Inteligencia    🔍 Buscar...  ⌘K  🔔  ⚙️   │
├───────────┬─────────────────────────────────────────────────────────┤
│ MENÚ      │                                                         │
│ LATERAL   │         VISTA ACTIVA (Dashboard, CRM, etc.)            │
│           │                                                         │
│ 📊 • •    │  ┌──────────────────────────────────────────────────┐ │
│ 👥        │  │ KPI 1         KPI 2         KPI 3               │ │
│ 🤖        │  │ $35.9M        70            18.49%              │ │
│ 🏗️        │  │ +28%          +12 mes       +3.2pp              │ │
│ 👨‍💼        │  └──────────────────────────────────────────────────┘ │
│ 💬        │                                                         │
│ ⚙️        │  ┌──────────────────┬────────────────────────────────┐ │
│           │  │ Gráfico 1        │ Pipeline                       │ │
│           │  │ Revenue vs       │ Prospecto: 34                  │ │
│           │  │ Objetivo         │ Visita: 18                     │ │
│ Alerts    │  │ [████████░]      │ Negociación: 12                │ │
│ • 6 items │  │                  │ Cierre: 6                      │ │
│ • Hoy     │  │                  │ Total: 70                      │ │
│ • Nuevos  │  └──────────────────┴────────────────────────────────┘ │
│ • Riesgo  │                                                         │
└───────────┴─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Estructura del Menú Lateral

```
┌─────────────┐
│ LOGO (Atom) │  ← Stratos Atom (3 círculos concéntricos)
└─────────────┘

┌─────────────────────────────────────┐
│ 1. 📊 Comando (Dashboard)           │  ← Vista actual: Dashboard
│ 2. 👥 CRM (Gestión de Leads)        │  
│ 3. 🤖 IA CRM (5 Agentes)            │  
│ 4. 🏗️  ERP (Proyectos)              │
│ 5. 👨‍💼 Asesores (17 registros)        │  ← NUEVA: Búsqueda avanzada
│ 6. 💬 Agente Stratos (Chat)         │
│ 7. ⚙️  Config (Configuración)       │
└─────────────────────────────────────┘

┌──────────────────┐
│ DYNAMIC ISLAND   │  ← Notificaciones flotantes
│                  │    • Llamada completada
│ 6 Alertas Altas  │    • Nuevo lead capturado
│ Actualizadas     │    • Cliente en riesgo
│ cada 3-7 seg     │    • Proyecto avanzó
└──────────────────┘
```

---

## 📊 Vista: Comando (Dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | Comando                                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  KPI CARDS:                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 💰 Ingresos  │  │ 📈 Pronóstico│  │ 📊 Tasa Conv │       │
│  │ $35.9M      │  │ 70            │  │ 18.49%      │       │
│  │ ↑ +28%      │  │ ↑ +12 mes     │  │ ↑ +3.2pp    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  GRÁFICOS:                                                   │
│  ┌─────────────────────────────┬──────────────────────────┐ │
│  │ INGRESOS VS OBJETIVO        │ PROYECCIÓN POR ETAPAS   │ │
│  │                             │                         │ │
│  │  $10M ┌─────────────┐       │ Prospecto:        34   │ │
│  │        │   /         │       │ Visita:           18   │ │
│  │  $6M   │  /          │       │ Negociación:      12   │ │
│  │        │ /           │       │ Cierre:            6   │ │
│  │  $3M   │/            │       │ Total:            70   │ │
│  │       ├──────────────┤       │                         │ │
│  │   Ene Feb Mar Abr May Jun    │                         │ │
│  │   +28% target: $M: 4.8      │                         │ │
│  └─────────────────────────────┴──────────────────────────┘ │
│                                                               │
│  NOTA DE VOZ:  [🎤 Grabar nota rápida]                       │
│                                                               │
│  CLIENTES PRIORITARIOS:  (Top 10 por valor)                 │
│  [Lista de clientes con estado]                              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 👥 Vista: CRM

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | CRM                                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  KPI CARDS:                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 👥 Activos   │  │ ⭐ Calidad   │  │ % Conversion │       │
│  │ 70           │  │ 67/100       │  │ 18.4%       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  TODOS LOS LEADS:         [Filtrar]  [+ Nuevo]              │
│                                                               │
│  ┌─────────────┬──────────┬───────┬──────────┬──────┐       │
│  │ CLIENTE     │ PROYECTO │ SCORE │ ETAPA    │ VALOR│       │
│  ├─────────────┼──────────┼───────┼──────────┼──────┤       │
│  │ Farn. Rodr. │ Gobern.  │ 92    │Negociaci │$4.2M │ 2h    │
│  │ James M.    │ Monarca  │ 85    │Visita    │$2.8M │ 3h    │
│  │ Carlos S.   │ Portofi. │ 78    │Prospecto │$6.5M │ 5h    │
│  │ Sarah W.    │ Gobern.  │ 65    │Visita    │$3.1M │ 8h    │
│  │ Fam. Hdez.  │ Monarca  │ 45    │Prospecto │$1.9M │ 1d    │
│  └─────────────┴──────────┴───────┴──────────┴──────┘       │
│                                                               │
│  [Drag & drop entre columnas para cambiar etapa]            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🤖 Vista: IA CRM (Call Center)

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | IA CRM                                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CALL CENTER IA - Automatización · Reactivación · Agentes   │
│                                                               │
│  ✅ Sistema Activo    |   5 Agentes IA    |   🟢 4 en línea  │
│                                                               │
│  KPI CARDS:                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │📞 Llamadas  │  │ 🔄 Reactivac.│  │📈 Clientes  │       │
│  │ 619 (+22%)  │  │ 34.2% (+8.1) │  │ 28 esta sem.│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  AGENTES IA ACTIVOS:                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AGENTE              │ TIPO    │ LLAMADAS │ ÉXITO│COLA│   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Agente Reactivación │ Reacti. │ 89       │ 34   │ 12  │   │
│  │ Agente Seguimiento  │ Follow  │ 156      │ 68   │ 8   │   │
│  │ Agente Confirmación │ Conf.   │ 203      │ 187  │ 3   │   │
│  │ Agente Cierre       │ Cierre  │ 47       │ 19   │ 5   │   │
│  │ Agente Nurturing    │ Educar  │ 124      │ 52   │ 0   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  VOLUMEN DE LLAMADAS (Hoy):                                 │
│  [████████████░░] 45 minutos (pico)                         │
│  0      15      30      45      60                          │
│                                                               │
│  CLIENTES PARA REACTIVAR: 6 pendientes    [Reactivar Todos] │
│  ┌───────────────┬─────────┬──────────┬─────────┐           │
│  │ CLIENTE       │ EVENTO  │ INACTIVO │ TÉCNICA │           │
│  ├───────────────┼─────────┼──────────┼─────────┤           │
│  │ Ricardo F.    │ $1.8M   │ 5d       │ Take...│ 🔴 Alta    │
│  │ Ana María     │ $2.4M   │ 3d       │ Prueba │ 🔴 Alta    │
│  │ David Chen    │ $3.2M   │ 7d       │ Excl..│ 🟡 Media   │
│  │ Patricia R.   │ $1.5M   │ 10d      │ Take..│ 🔴 Crítica │
│  │ ...           │         │          │        │            │
│  └───────────────┴─────────┴──────────┴─────────┘           │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Vista: ERP

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | ERP                                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  KPI CARDS:                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │📦 Unidades  │  │✅ Vendidas   │  │💰 Inventario│       │
│  │ 156         │  │ 118 (75.6%)  │  │ $72.4M      │       │
│  │ Portafolio  │  │ ↑ Valuación  │  │ ↑ Valuación │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  PORTAFOLIO DE PROYECTOS:     4 Proyectos Activos           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │PROYECTO    │UBICACIÓN│ESTADO       │UNIDADES│MARGEN │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │Gobernador  │Playa    │Construcción │36/48   │31%   │   │
│  │28          │Carmen   │             │[75%]   │Q2 26 │   │
│  │            │         │             │        │      │   │
│  │Monarca 28  │Playa    │Preventa     │42/56   │29%   │   │
│  │            │Carmen   │             │[75%]   │Q3 26 │   │
│  │            │         │             │        │      │   │
│  │Portofino   │Cancún   │Disponible   │26/32   │32%   │   │
│  │            │         │             │[81%]   │Q1 26 │   │
│  │            │         │             │        │      │   │
│  │Casa Blanca │Tulum    │Pre-constr.  │14/20   │28%   │   │
│  │            │         │             │[70%]   │Q4 26 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  INVENTARIO DETALLADO:                                      │
│  [Tabla con detalles de cada unidad, clientes, pagos]       │
│                                                               │
│  TOTAL CARTERA: $160M+  |  MARGEN PROMEDIO: 30%             │
│                         |  UTILIDAD BRUTA: $48M             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 👨‍💼 Vista: Asesores (NUEVA - Búsqueda Avanzada)

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | Asesores                                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CRM DE ASESORES - Backup · Gestión · Búsqueda Integral    │
│                                                               │
│  KPI CARDS:                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │🔒 Registros │  │📅 Agendados  │  │✅ Seguimiento       │
│  │ 17          │  │ 4 próximos   │  │ 7 activos   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │ 🔍 Buscar cliente, asesor o teléfono...         │       │
│  │ [Dropdown: Todos los status ▼]  [📥 Exportar]  │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  REGISTROS (17 clientes):                                   │
│  ┌──────────────────────────────────────────────────┐       │
│  │FECHA │ASESOR │CLIENTE │TEL      │STATUS │PRESUP│       │
│  ├──────────────────────────────────────────────────┤       │
│  │1 Apr │Emm.   │Tony    │818-3113 │ZOOM   │200k  │       │
│  │      │Ortiz  │N...    │         │AGEND. │max   │       │
│  │      │       │        │         │       │      │       │
│  │1 Apr │Ara.   │Jesus   │254-1946 │ZOOM   │300-  │       │
│  │      │Oneto  │        │         │AGEND. │350K  │       │
│  │      │       │        │         │       │      │       │
│  │1 Apr │Ara.   │Manny   │949-...  │SEGUI. │—     │       │
│  │      │Oneto  │        │         │MIENT. │      │       │
│  │      │       │        │         │       │      │       │
│  │ ... (14 más)                                    │       │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
│  PIPELINE DE VENTAS:                                        │
│  Prospecto: 34   Visita: 18   Negociación: 12   Cierre: 6   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 👨‍💻 Vista: Team (Equipo)

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | Agente Stratos                                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────┐                     │
│  │ 🧠 AGENTE EJECUTIVO                │                     │
│  │ Inteligencia estratégica lista.     │                     │
│  │ ¿Qué decisión tomamos?             │                     │
│  │                                     │                     │
│  │ [🛡️ ANÁLISIS CRÍTICO]              │                     │
│  │ [🚀 CIERRE INMEDIATO]              │                     │
│  │                                     │                     │
│  │ 🎤 Escribe o usa voz...            │                     │
│  │ [Escribe o usa voz...]  ➤ [Enviar]│                     │
│  └─────────────────────────────────────┘                     │
│                                                               │
│  (Lado izquierdo: Vista anterior visible detrás)            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Vista: Config (Configuración)

```
┌──────────────────────────────────────────────────────────────┐
│ Stratos IA | Config                                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CONFIGURACIÓN GENERAL:                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Nombre empresa: [_______________]                    │   │
│  │ Logo & Branding: [Cambiar]                          │   │
│  │ Tema: [Oscuro ▼] | Zona horaria: [GMT-5 ▼]        │   │
│  │ Moneda: [USD ▼] | Idioma: [ES ▼]                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  USUARIOS Y PERMISOS:                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Usuario    │ Rol                │ Permisos          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ admin@...  │ Admin              │ ✅ Todos          │   │
│  │ director@..│ Director Ventas    │ ✅ Ver, editar    │   │
│  │ asesor@... │ Asesor             │ ✅ Solo sus datos │   │
│  │ ...        │ ...                │ ...               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  INTEGRACIONES:                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ✅ WhatsApp Business API           [Conectado]      │   │
│  │ ✅ Google Workspace                [Conectado]      │   │
│  │ ⭕ Salesforce CRM                  [Desconectado]   │   │
│  │ ✅ Zapier (IFTTT)                  [Conectado]      │   │
│  │ ✅ Twilio (Llamadas)               [Conectado]      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  AGENTES IA - PERSONALIZACIÓN:                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Agente Reactivación:                                │   │
│  │ • Scripts personalizados: [Ver/Editar]             │   │
│  │ • Horarios: [9am - 7pm ▼]                          │   │
│  │ • Presupuesto diario: [$500]                       │   │
│  │ • Target: [Todos o específico]                     │   │
│  │ • Idioma: [Español ▼]                              │   │
│  │ • Tone: [Formal / Amigable / Urgencia]            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  [Guardar cambios]  [Resetear a defecto]                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎨 Esquema de Colores

```
BACKGROUND PRINCIPAL:       #060A11 (Oscuro casi negro)
ACCENT (Principal):         #6EE7C2 (Verde mint)
TEXTO NORMAL:               #E5E7EB (Gris claro)
BORDES:                     #1F2937 (Gris oscuro)

SUCCESS:                    #10B981 (Verde)
WARNING:                    #F59E0B (Naranja)
DANGER:                     #EF4444 (Rojo)
INFO:                       #3B82F6 (Azul)

CARD BACKGROUND:            rgba(15, 23, 42, 0.6)
OVERLAY TEXT:               rgba(229, 231, 235, 0.7)
```

**Visualización:**
```
████ #060A11 - Fondo (muy oscuro)
████ #6EE7C2 - Accent (mint brillante) ✨
████ #E5E7EB - Texto (claro)
████ #1F2937 - Bordes (gris)
████ #10B981 - Éxito (verde)
████ #F59E0B - Alerta (naranja)
████ #EF4444 - Error (rojo)
████ #3B82F6 - Info (azul)
```

---

## 📐 Espaciado Visual

```
Título grande:      32px (Outfit 700)
Título mediano:     24px (Outfit 600)
Título pequeño:     18px (Outfit 600)
Texto normal:       13px (Plus Jakarta 400)
Texto pequeño:      11px (Plus Jakarta 400)

Padding Card:       16px
Padding Input:      10px 12px
Padding Button:     10px 16px
Gap Grid:           16px
Margin Bottom:      8px-32px (múltiplos de 8)

Border Radius:      8px (inputs, buttons)
Border Radius:      12px (cards)
Border Radius:      4px (badges)
```

---

## 🔄 Transiciones

```
Button Hover:       0.3s ease
Border Focus:       0.2s ease
Color Change:       0.3s ease
Opacity Change:     0.2s ease
```

---

Ahora cualquier desarrollador que vea esto **sabrá exactamente qué esperar** cuando abra Stratos IA. 🚀

