# 👨‍💻 SETUP PARA DESARROLLADOR — Antigravity o Claude Code

**Si eres desarrollador externo, sigue esta guía paso a paso.**

---

## 🎯 ¿Qué es Stratos IA?

**Plataforma SaaS completa con:**
- ✅ Dashboard ejecutivo con KPIs en tiempo real
- ✅ CRM para gestión de 70+ leads
- ✅ 5 Agentes IA automáticos (Reactivación, Seguimiento, Confirmación, Cierre, Nurturing)
- ✅ ERP para gestionar 4 proyectos inmobiliarios (156 unidades)
- ✅ Base de datos de 17 asesores con búsqueda avanzada
- ✅ Panel de equipo con métricas
- ✅ Chat con asistente IA

**Tech Stack:**
- React 18 (hooks: useState, useMemo, useCallback, memo)
- Vite (bundler/dev server)
- Lucide React (iconos profesionales)
- Recharts (gráficos)
- CSS inline (sin Tailwind, sin frameworks externos)

---

## 🚀 OPCIÓN A: Trabajar en Antigravity (Google)

### **Paso 1: Obtener acceso al repositorio**

El PM te debe dar:
```
GitHub URL: https://github.com/[USERNAME]/stratos-ai.git
Branch: develop
Credenciales: Tu cuenta GitHub
```

### **Paso 2: En Antigravity**

1. Abre Antigravity (https://idx.google.com)
2. Click en **"New Workspace"**
3. Selecciona **"Import from GitHub"**
4. Pega URL: `https://github.com/[USERNAME]/stratos-ai.git`
5. Selecciona branch: `develop`
6. Click **"Create Workspace"**

**Antigravity automáticamente:**
- ✅ Clonagrá el repo
- ✅ Instalará dependencias (npm install)
- ✅ Te dejará listo para editar

### **Paso 3: Ejecutar el proyecto**

En la terminal de Antigravity:
```bash
npm run dev
```

Verás:
```
✓ built in 1.23s

➜  Local:   http://localhost:5173/
```

Click en el enlace → Se abre Stratos IA en una pestaña.

### **Paso 4: Editar código**

En Antigravity:
- **Archivo principal:** `src/App.jsx` (donde está TODO)
- **Estilos:** Inline en los componentes (no hay CSS separado)
- **Datos:** Arrays de objetos en el mismo archivo

**Haz cambios directamente y verás los cambios en tiempo real.**

### **Paso 5: Cuando termines tu trabajo**

```bash
# En terminal de Antigravity:
git add .
git commit -m "feat: Descripción de tu cambio"
git push origin develop
```

Luego el PM (jefe) revisará en GitHub y hará merge.

---

## 💻 OPCIÓN B: Trabajar en Claude Code (Anthropic)

### **Paso 1: Clonar repositorio**

En tu Terminal/Bash local:
```bash
# Navega a donde guardas proyectos
cd ~/projects

# Clona el repo
git clone https://github.com/[USERNAME]/stratos-ai.git
cd stratos-ai

# Cambia a rama develop
git checkout develop
```

### **Paso 2: Abrir en Claude Code**

**Opción 1: Desde línea de comandos**
```bash
# Abre carpeta en Claude Code
code .
```

**Opción 2: Manualmente**
1. Abre Claude Code
2. File → Open Folder
3. Selecciona carpeta `stratos-ai`

### **Paso 3: Setup en Claude Code**

En terminal de Claude Code:
```bash
npm install
npm run dev
```

Verás el servidor corriendo en `http://localhost:5173/`

### **Paso 4: Editar código**

- **Archivo principal:** `src/App.jsx`
- **Icons:** De `lucide-react`
- **Gráficos:** De `recharts`
- **Estilos:** Todos inline en `style={{ ... }}`

Los cambios se reflejan instantáneamente en el navegador.

### **Paso 5: Cuando termines**

```bash
# Verifica cambios
git status

# Agrega todo
git add .

# Haz commit con descripción clara
git commit -m "feat: Nombre del cambio"

# Sube a GitHub
git push origin develop
```

---

## 📖 Documentación Que Necesitas Leer

**Antes de empezar a programar, LEE ESTO:**

### **1. DESIGN_SYSTEM.md** ⭐ IMPORTANTE
```
Contiene:
- Paleta de colores (P object)
- Tipografías (Outfit, Plus Jakarta Sans)
- Componentes reutilizables (Cards, Buttons, Tables)
- Espaciado y estilos
- Ejemplos de código
```

**Leer en 20 minutos → Entenderás cómo estilizar todo**

### **2. DEVELOPMENT.md** ⭐ IMPORTANTE
```
Contiene:
- Estructura del proyecto
- Convenciones de código
- Patrones de React (useState, useMemo, etc.)
- Cómo agregar features
- Debugging
```

**Leer en 30 minutos → Sabréis cómo arquitectar cambios**

### **3. Este archivo (SETUP_PARA_DESARROLLADOR.md)**
Estás leyéndolo ahora 📖

---

## 🎨 Lo Primero: Entender la Paleta de Colores

En `src/App.jsx`, hay un objeto llamado `P`:

```javascript
const P = {
  bg: '#060A11',        // Fondo oscuro (color base)
  accent: '#6EE7C2',    // Verde mint (color principal)
  text: '#E5E7EB',      // Texto gris claro
  border: '#1F2937',    // Bordes
  hover: '#10B981',     // Hover verde
  success: '#10B981',   // Verde (exitoso)
  warning: '#F59E0B',   // Naranja (alerta)
  danger: '#EF4444',    // Rojo (error)
  info: '#3B82F6',      // Azul (info)
};
```

**TODOS los estilos usan esto.** Nunca hardcodes colores como `#FF0000`.

---

## 🏗️ La Estructura de App.jsx

```javascript
// 1. Imports (línea 1-30)
import React, { useState, useMemo, useCallback, memo } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, BarChart3, Building2, Users2, MessageSquare, Settings } from 'lucide-react';

// 2. Paleta de Colores (línea 31-50)
const P = { ... };

// 3. Componentes pequeños (línea 51-150)
const StratosAtom = ({ ... }) => { ... };  // Logo
const DynIsland = ({ ... }) => { ... };    // Notificaciones

// 4. Data Mock (línea 151-300)
const teamData = [ ... ];      // 8 asesores
const crmLeads = [ ... ];      // 5 leads
const crmAsesores = [ ... ];   // 17 registros
const erp_projects = [ ... ];  // 4 proyectos
// ... más data

// 5. Vistas principales (línea 301-1200)
const Dashboard = ({ oc }) => { ... };
const CRM = ({ oc }) => { ... };
const IACRM = ({ oc }) => { ... };
const ERP = ({ oc }) => { ... };
const AsesorCRM = ({ oc }) => { ... };
const TeamPanel = ({ oc }) => { ... };
const ChatAgent = ({ oc }) => { ... };

// 6. App Principal (línea 1201-1581)
function App() {
  const [view, setView] = useState('dash');  // Vista activa
  
  return (
    <div>
      {/* Menú lateral izquierdo */}
      {/* Área de contenido principal */}
      {/* Notificaciones DynIsland */}
    </div>
  );
}

export default App;
```

**¿Quieres agregar una feature?** Busca la sección correcta, copia el patrón, y modifica.

---

## 🎯 Tareas Típicas

### **Tarea 1: Cambiar color de un botón**

```javascript
// ANTES:
<button style={{ background: P.accent, ... }}>Click</button>

// DESPUÉS (cambiar a rojo):
<button style={{ background: P.danger, ... }}>Click</button>
```

### **Tarea 2: Agregar una nueva métrica (KPI)**

Busca en Dashboard donde están los otros KPIs, copia una card completa, modifica:
- Título
- Número
- Icono
- Color

### **Tarea 3: Agregar columna a una tabla**

En la tabla, hay un `gridTemplateColumns: '220px 60px 80px ...'`

Agrega un nuevo valor:
```javascript
gridTemplateColumns: '220px 60px 80px 100px 90px 50px 80px'  // Agrega 80px
```

Luego agrega la celda correspondiente en cada fila.

### **Tarea 4: Mejorar búsqueda o filtro**

Usa el ejemplo de AsesorCRM (línea ~850):
- `useMemo` para filtrar
- `onChange` en input/select
- Renderiza datos filtrados

### **Tarea 5: Agregar icono**

Todos los iconos vienen de `lucide-react`:

```javascript
import { Users, TrendingUp, Settings, ... } from 'lucide-react';

// Usar:
<Users size={20} color={P.accent} />
<TrendingUp size={24} color={P.success} />
```

Ve a https://lucide.dev para ver todos los iconos disponibles.

---

## 🚨 Errores Comunes y Soluciones

### **Error 1: "Cannot find module 'lucide-react'"**

```bash
npm install lucide-react
# O si usas yarn:
yarn add lucide-react
```

### **Error 2: "P is not defined"**

Significa que estás fuera del scope. Asegúrate que:
- Estás dentro de `const App = () => { ... }`
- O dentro de una vista como `const Dashboard = ({ oc }) => { ... }`

### **Error 3: "React.useState is not a function"**

Asegúrate de que importaste:
```javascript
import { useState, useMemo, useCallback } from 'react';
```

### **Error 4: Estilos no se aplican**

```javascript
// ❌ INCORRECTO
style={someObject}  // someObject no está definido

// ✅ CORRECTO
style={{
  color: P.text,
  fontSize: '14px',
}}
```

### **Error 5: Tabla se ve mal**

Revisa:
- `gridTemplateColumns` tiene los mismos valores que columnas
- `gap` es consistente
- No hay `colspan` o `rowspan` (CSS Grid no soporta bien)

---

## 🔧 Tips Pro

### **1. Usa DevTools**

Presiona F12 (o Cmd+Option+I en Mac) y:
- **Elements:** Inspecciona estilos
- **Console:** Ve errores JavaScript
- **Network:** Revisa requests (si hay API después)

### **2. Optimiza Performance**

```javascript
// Usa useMemo para filtros/búsquedas
const filteredData = useMemo(() => {
  return data.filter(item => item.name.includes(search));
}, [search, data]);

// Usa useCallback para funciones en props
const handleClick = useCallback(() => {
  doSomething();
}, []);

// Usa memo para componentes que reciben props
const Card = memo(({ title, data }) => { ... });
```

### **3. Lee el código existente**

Si no sabes cómo hacer algo, busca si ya existe:
- ¿Cómo se hace una tabla? → Ve AsesorCRM
- ¿Cómo se filtra? → Ve AsesorCRM
- ¿Cómo se hace un gráfico? → Ve Dashboard

**Copiar y adaptar es válido.**

### **4. Usa console.log**

```javascript
console.log('View actual:', view);
console.log('Datos filtrados:', filteredData);
console.log('Props:', props);
```

Abre DevTools (F12) → Console → Ve qué imprimes.

### **5. Hot Reload está habilitado**

Cuando guardas cambios en el editor, **la página se actualiza automáticamente** sin perder estado. Es mágico. 🪄

---

## 📋 Checklist Antes de Cada Sesión

- [ ] Sincronizaste cambios de otros devs: `git pull origin develop`
- [ ] Ejecutaste: `npm run dev`
- [ ] Abriste http://localhost:5173 en navegador
- [ ] Abriste DevTools (F12) y viste "No errors"
- [ ] Leíste qué debes hacer (el PM debe decirte)
- [ ] Tienes DESIGN_SYSTEM.md abierto para referencia

---

## 📞 Flujo de Comunicación

### **Cuando tienes pregunta:**
1. Busca en DESIGN_SYSTEM.md
2. Busca en DEVELOPMENT.md
3. Busca en el código de App.jsx (el ejemplo ya existe)
4. Si aún no sabes → Pregunta al PM

### **Cuando terminas:**
1. Commit: `git commit -m "feat: Lo que hiciste"`
2. Push: `git push origin develop`
3. Notifica al PM que está en GitHub esperando review

### **Si rompiste algo:**
```bash
# Revert al estado anterior
git revert HEAD

# O si quieres descartar cambios sin commitear
git checkout .
```

No hay problema. Git siempre puede revertir cambios.

---

## 🎓 Recursos de Referencia

| Recurso | Dónde | Por Qué |
|---------|-------|--------|
| DESIGN_SYSTEM.md | En proyecto | Colores, tipografías, componentes |
| DEVELOPMENT.md | En proyecto | Convenciones, patrones, estructura |
| React Docs | https://react.dev | Entender hooks |
| Lucide Icons | https://lucide.dev | Ver iconos disponibles |
| Recharts | https://recharts.org | Hacer gráficos |
| Vite Docs | https://vitejs.dev | Setup/build |

---

## ✅ Listo Para Empezar

Cuando hayas leído esto + DESIGN_SYSTEM.md + DEVELOPMENT.md:

1. ✅ Entiendes la estructura
2. ✅ Sabes qué colores y tipografías usar
3. ✅ Sabes cómo hacer componentes
4. ✅ Sabes cómo agregar features
5. ✅ Sabes cómo hacer commits y push

**Ahora espera instrucciones del PM de qué implementar.**

---

## 🚀 Bienvenido al equipo Stratos IA

**Happy coding!** Si tienes dudas, el PM está para ayudarte. 

Y recuerda: **El código de todos en Stratos IA sigue las mismas convenciones** — así nos es fácil entender el trabajo de otros.

---

**Versión:** 1.0  
**Última actualización:** Abril 2026  
**Mantenido por:** El Team Stratos IA
