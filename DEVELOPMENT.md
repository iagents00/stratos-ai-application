# 🛠️ GUÍA DE DESARROLLO — Stratos IA v10

**Para desarrolladores que trabajan en Claude Code o Antigravity**

---

## 📋 Índice
1. [Setup Inicial](#setup-inicial)
2. [Estructura de Carpetas](#estructura-de-carpetas)
3. [Cómo Ejecutar el Proyecto](#cómo-ejecutar-el-proyecto)
4. [Convenciones de Código](#convenciones-de-código)
5. [Componentes Principales](#componentes-principales)
6. [Cómo Agregar Features](#cómo-agregar-features)
7. [Debugging](#debugging)
8. [Git Workflow](#git-workflow)

---

## 🚀 Setup Inicial

### **Paso 1: Clonar Repositorio**

```bash
# Option 1: Via Git
git clone https://github.com/[USERNAME]/stratos-ai.git
cd stratos-ai

# Option 2: Via Antigravity
# En Antigravity → New Project → Import from GitHub
# URL: https://github.com/[USERNAME]/stratos-ai.git
# Branch: develop
```

### **Paso 2: Instalar Dependencias**

```bash
npm install
# O
yarn install
```

### **Paso 3: Verificar Setup**

```bash
# Debe estar disponible en http://localhost:5173
npm run dev
```

Si ves la interfaz de Stratos IA → **¡Listo!**

---

## 📁 Estructura de Carpetas

```
stratos-ai/
├── src/
│   ├── App.jsx                    ⭐ ARCHIVO PRINCIPAL (TODO está aquí)
│   ├── main.jsx                   (Entry point)
│   ├── index.css                  (Estilos globales - MINIMAL)
│   └── favicon.svg                (Logo en pestaña)
│
├── public/
│   └── vite.svg                   (Assets)
│
├── .claude/
│   ├── launch.json                (Config de Vite)
│   └── run-vite.sh                (Script para iniciar servidor)
│
├── package.json                   (Dependencias: React, Lucide, Recharts)
├── vite.config.js                 (Config de Vite)
├── .gitignore                     (Archivos a ignorar)
│
├── DESIGN_SYSTEM.md               (Este archivo: estilos, tipografías, componentes)
├── DEVELOPMENT.md                 (Este archivo: guía de desarrollo)
├── CHANGELOG.md                   (Registro de cambios)
└── README.md                      (Descripción del proyecto)
```

### **Estructura dentro de App.jsx**

```javascript
// Línea 1-50: Imports
import React, { useState, useMemo, useCallback, memo } from 'react';
import { BarChart, Bar, AreaChart, Area, ... } from 'recharts';
import { Users, TrendingUp, ... } from 'lucide-react';

// Línea 51-150: Paleta de Colores (P object)
const P = { ... };

// Línea 151-200: StratosAtom (Logo)
const StratosAtom = ({ size = 32, color = '#6EE7C2' }) => { ... };

// Línea 201-300: DynIsland (Notificaciones)
const DynIsland = ({ alerts }) => { ... };

// Línea 301-500: Data Mock
const teamData = [ ... ];
const crmData = [ ... ];
const crmAsesores = [ ... ];
// ... más data

// Línea 501-1400: Componentes de Vistas (Dash, CRM, IACRM, ERP, Asesores, Team, Chat)
const Dashboard = ({ oc }) => { ... };
const CRM = ({ oc }) => { ... };
const IACRM = ({ oc }) => { ... };
const ERP = ({ oc }) => { ... };
const AsesorCRM = ({ oc }) => { ... };
const TeamPanel = ({ oc }) => { ... };
const ChatAgent = ({ oc }) => { ... };

// Línea 1401-1581: Componente Principal (App)
function App() {
  const [view, setView] = useState('dash');
  // ... lógica principal
  
  return (
    <div style={{ ... }}>
      {/* Menú lateral, vistas, etc */}
    </div>
  );
}

export default App;
```

---

## 💻 Cómo Ejecutar el Proyecto

### **Desarrollo Local**

```bash
# Terminal
npm run dev

# Output esperado:
# ✓ built in 2.34s
# 
# ➜  Local:   http://localhost:5173/
```

Abre navegador en `http://localhost:5173/`

### **Build para Producción**

```bash
npm run build

# Genera carpeta 'dist/' lista para deploy
```

### **Preview de Build**

```bash
npm run preview

# Simula la versión de producción localmente
```

---

## 📝 Convenciones de Código

### **1. Nombres de Variables y Funciones**

```javascript
// ✅ CORRECTO (camelCase)
const userName = 'Juan';
const totalPrice = 1500;
function calculateTotal() { ... }
const isActive = true;

// ❌ INCORRECTO (snake_case, PascalCase en variables)
const user_name = 'Juan';
const TotalPrice = 1500;
const IsActive = true;
```

### **2. Componentes React**

```javascript
// ✅ CORRECTO (PascalCase para componentes)
const MiComponente = () => { ... };
const Dashboard = ({ oc }) => { ... };

// ✅ Con memo (para optimización)
const MiComponente = memo(({ titulo, datos }) => { ... });

// ❌ INCORRECTO
const miComponente = () => { ... };
function mi_componente() { ... }
```

### **3. Objetos de Estilo**

```javascript
// ✅ CORRECTO
const cardStyle = {
  background: 'rgba(15, 23, 42, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  gap: '12px',
};

// ✅ Inline (para estilos simples)
<div style={{
  fontSize: '14px',
  color: P.text,
  marginBottom: '8px',
}}>...</div>

// ❌ INCORRECTO (CSS externo de estilos - evitar)
// (No uses className sin Tailwind)
```

### **4. Comentarios**

```javascript
// ✅ CORRECTO - Comentarios claros
// Calcula el total de ventas del mes actual
const monthlyTotal = sales.reduce((sum, sale) => sum + sale.amount, 0);

// ✅ Comentarios en secciones importantes
// ===== DASHBOARD KPIS =====
const kpis = [ ... ];

// ❌ INCORRECTO - Comentarios obvios
// const x = 5; // asigna 5 a x
```

### **5. Imports y Exports**

```javascript
// ✅ CORRECTO
import { useState, useMemo } from 'react';
import { BarChart, Bar } from 'recharts';
import { Users, TrendingUp } from 'lucide-react';

// ✅ Agrupa imports por categoría
// React
import { useState } from 'react';
import { createPortal } from 'react-dom';

// Librerías externas
import { BarChart, Bar } from 'recharts';
import { Users } from 'lucide-react';

// ❌ INCORRECTO
import * from 'recharts'; // No hagas wildcard imports
import recharts from 'recharts'; // Recharts es export named
```

### **6. Condicionales y Lógica**

```javascript
// ✅ CORRECTO - Early return
function procesar(datos) {
  if (!datos) return null;
  if (datos.length === 0) return <div>Sin datos</div>;
  
  return <div>{renderizar(datos)}</div>;
}

// ✅ Ternarios para UI simple
<span style={{ color: isActive ? P.success : P.danger }}>
  {isActive ? 'Activo' : 'Inactivo'}
</span>

// ❌ INCORRECTO - Anidamiento profundo
function procesar(datos) {
  if (datos) {
    if (datos.length > 0) {
      return <div>...datos...</div>;
    }
  }
  return null;
}
```

### **7. Performance - useMemo y useCallback**

```javascript
// ✅ CORRECTO - Filtrado optimizado (como en AsesorCRM)
const filteredData = useMemo(() => {
  return allData.filter(item => {
    const matchesSearch = item.name.includes(searchTerm);
    const matchesFilter = !filterStatus || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });
}, [searchTerm, filterStatus]); // Solo recalcula si cambian

// ✅ Callbacks memoizados
const handleClick = useCallback(() => {
  onUpdate(itemId);
}, [itemId, onUpdate]);

// ❌ INCORRECTO - Recalcula en cada render
const filteredData = allData.filter(item => {
  return item.name.includes(searchTerm);
});
```

---

## 🧩 Componentes Principales

### **1. Dashboard**
- **Archivo:** src/App.jsx (líneas 301-400)
- **Función:** Mostrar KPIs, gráficos, notificaciones
- **Props:** `oc` (view controller)
- **Datos:** `dashboardKpis`, `revenueData`, `pipelineData`

### **2. CRM**
- **Archivo:** src/App.jsx (líneas 401-500)
- **Función:** Gestión de leads con pipeline
- **Props:** `oc` (view controller)
- **Datos:** `crmLeads` (5 leads principales)

### **3. IA CRM (Call Center)**
- **Archivo:** src/App.jsx (líneas 501-700)
- **Función:** 5 agentes automáticos + reactivación
- **Props:** `oc` (view controller)
- **Datos:** `agents`, `callMetrics`, `reactivationCandidates`
- **Especial:** Incluye gráfico de llamadas (BarChart)

### **4. ERP**
- **Archivo:** src/App.jsx (líneas 701-850)
- **Función:** Gestión de proyectos inmobiliarios (4 proyectos, 156 unidades)
- **Props:** `oc` (view controller)
- **Datos:** `erp_projects`

### **5. Asesores CRM** ⭐ Nueva Característica
- **Archivo:** src/App.jsx (líneas 851-1000)
- **Función:** Base de datos de 17 asesores + búsqueda/filtrado
- **Props:** `oc` (view controller)
- **Datos:** `crmAsesores` (17 registros completos)
- **Features:**
  - 🔍 Búsqueda en tiempo real (cliente, asesor, teléfono)
  - 🎯 Filtro por status (Zoom Agendado, Seguimiento, WhatsApp, No Contesta)
  - 📊 Pipeline analytics
  - 📥 Botón de exportar

### **6. Team Panel**
- **Archivo:** src/App.jsx (líneas 1001-1100)
- **Función:** Mostrar 8 asesores con métricas
- **Props:** `oc` (view controller)
- **Datos:** `teamData` (8 miembros con roles)

### **7. Chat Agent**
- **Archivo:** src/App.jsx (líneas 1101-1200)
- **Función:** Asistente IA interactivo
- **Props:** `oc` (view controller)
- **Features:** Entrada de voz/texto, acciones sugeridas

---

## ✨ Cómo Agregar Features

### **Escenario 1: Agregar una nueva KPI al Dashboard**

```javascript
// En App.jsx, dentro de const Dashboard = ({ oc }) => {

// 1. Agrega dato al inicio si es dinámico
const [myMetric] = useState(12345);

// 2. En el JSX, dentro de las KPI cards:
<div style={{
  background: 'rgba(15, 23, 42, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '12px',
  padding: '16px',
  maxWidth: '280px',
}}>
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  }}>
    <span style={{
      fontSize: '13px',
      color: 'rgba(229, 231, 235, 0.7)',
      fontFamily: 'Plus Jakarta Sans',
    }}>Mi Nueva Métrica</span>
    <TrendingUp size={20} color={P.accent} />
  </div>

  <h2 style={{
    fontSize: '28px',
    fontWeight: 700,
    fontFamily: 'Outfit',
    margin: '0 0 8px 0',
  }}>{myMetric}</h2>

  <span style={{
    fontSize: '12px',
    color: P.success,
    fontWeight: 500,
  }}>↑ +5.2%</span>
</div>
```

### **Escenario 2: Agregar nueva vista (Módulo Completo)**

```javascript
// 1. Crea el componente
const MiVista = ({ oc }) => {
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 700,
        fontFamily: 'Outfit',
        marginBottom: '24px',
      }}>Mi Nueva Vista</h1>

      {/* Tu contenido aquí */}
    </div>
  );
};

// 2. En el App() principal, agrega botón en menú:
<button
  onClick={() => setView('mi_vista')}
  style={{
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    background: view === 'mi_vista' ? P.accent : 'transparent',
    border: `1px solid ${P.border}`,
    color: view === 'mi_vista' ? P.bg : P.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}
  title="Mi Vista"
>
  <MyIcon size={20} />
</button>

// 3. En el JSX principal, agrega renderizado:
{view === 'mi_vista' && <MiVista oc={() => {}} />}
```

### **Escenario 3: Agregar búsqueda/filtro (como AsesorCRM)**

```javascript
const MiComponente = ({ oc }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODO");

  // Datos de ejemplo
  const data = [
    { id: 1, nombre: 'Item 1', status: 'ACTIVO' },
    { id: 2, nombre: 'Item 2', status: 'INACTIVO' },
  ];

  // Filtrado optimizado
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === "TODO" || item.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, filterStatus]);

  return (
    <div style={{ padding: '24px' }}>
      {/* Búsqueda */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(31, 41, 55, 0.6)',
            border: `1px solid ${P.border}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: P.text,
            outline: 'none',
          }}
        />

        {/* Filtro */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: 'rgba(31, 41, 55, 0.6)',
            border: `1px solid ${P.border}`,
            borderRadius: '8px',
            padding: '10px 12px',
            color: P.text,
            outline: 'none',
          }}
        >
          <option value="TODO">Todos</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
      </div>

      {/* Resultados */}
      {filteredData.length === 0 ? (
        <p style={{ color: 'rgba(229, 231, 235, 0.5)' }}>Sin resultados</p>
      ) : (
        <div>
          {filteredData.map(item => (
            <div key={item.id} style={{
              padding: '12px',
              borderBottom: `1px solid ${P.border}`,
            }}>
              {item.nombre}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 🐛 Debugging

### **Errores Comunes**

#### **Error: Cannot find module 'lucide-react'**
```bash
npm install lucide-react
```

#### **Error: 'P' is not defined**
Asegúrate de estar dentro del componente que tiene `const P = { ... }`

#### **Error: Component not rendering**
Checklist:
- ¿Hay `return` statement?
- ¿JSX está dentro de parenthesis?
- ¿Todos los `{` y `}` balanceados?

#### **Estilos no aplican**
- Verifica que P.color esté correctamente escrito
- Revisa valores en `style={{ ... }}`
- Abre DevTools (F12) y busca el elemento

### **Herramientas de Debug**

```javascript
// En componentes React
console.log('View actual:', view);
console.log('Data filtrada:', filteredData);
console.log('Props recibidas:', oc);

// En navegador
// Abre DevTools (F12 o Cmd+Option+I en Mac)
// React DevTools extension ayuda
```

### **Performance**

```bash
# Ver si hay warnings
npm run build

# Verifica bundle size
npm run build -- --report
```

---

## 📤 Git Workflow

### **Antes de empezar (sincroniza cambios)**

```bash
git fetch origin develop
git pull origin develop
```

### **Mientras trabajas**

```bash
# Crea rama para tu feature
git checkout -b feature/mi-feature

# Haz cambios, prueba localmente (npm run dev)

# Cuando termines, prepara commit
git status  # ver qué cambió
git add .
git commit -m "feat: Descripción de mi feature"
# O
git commit -m "fix: Corregir bug en tabla"
git commit -m "refactor: Optimizar búsqueda"
```

### **Cuando terminas (sube cambios)**

```bash
# Sube tu rama
git push origin feature/mi-feature

# En GitHub, abre Pull Request
# Espera a que el PM (jefe) apruebe y merge
```

### **Conflictos de merge**

```bash
# Si hay conflictos
git status  # ver qué conflictúa

# Abre archivos en conflict, busca:
# <<<<<<< HEAD
# tu código
# =======
# código de otro
# >>>>>>> rama-de-otro

# Resuelve manualmente, luego:
git add .
git commit -m "resolve: merge conflicts"
git push origin feature/mi-feature
```

---

## ✅ Checklist Antes de Subir Cambios

- [ ] El código corre sin errores (`npm run dev`)
- [ ] No hay warnings en consola
- [ ] Estilos son consistentes con DESIGN_SYSTEM.md
- [ ] Nombres de variables son claros (camelCase)
- [ ] Usé useMemo si hay filtrado/cálculos pesados
- [ ] Agregué comentarios en lógica compleja
- [ ] Los cambios están en rama develop o feature
- [ ] Commit message es descriptivo

---

## 📚 Recursos

- [React Docs](https://react.dev)
- [Lucide Icons](https://lucide.dev)
- [Recharts Docs](https://recharts.org)
- [Vite Docs](https://vitejs.dev)

---

**¿Preguntas?** Revisa DESIGN_SYSTEM.md para estilos, o abre el código en App.jsx para ver ejemplos.

**¡Feliz coding!** 🚀
