# ⚡ QUICK REFERENCE — Copia y Pega

**Guía rápida para copiar/pegar componentes comunes. Mantenla abierta mientras programas.**

---

## 🎨 Paleta de Colores

```javascript
// ¡COPIA ESTO AL INICIO DEL COMPONENTE!
const P = {
  bg: '#060A11',
  accent: '#6EE7C2',
  text: '#E5E7EB',
  border: '#1F2937',
  hover: '#10B981',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};
```

---

## 🔤 Tipografías

```javascript
// Título Grande (H1)
fontSize: '32px',
fontWeight: 700,
fontFamily: 'Outfit'

// Título Mediano (H2)
fontSize: '24px',
fontWeight: 600,
fontFamily: 'Outfit'

// Título Pequeño (H3)
fontSize: '18px',
fontWeight: 600,
fontFamily: 'Outfit'

// Texto Normal
fontSize: '13px',
fontWeight: 400,
fontFamily: 'Plus Jakarta Sans'

// Texto Pequeño
fontSize: '11px',
fontWeight: 400,
fontFamily: 'Plus Jakarta Sans'

// Etiqueta
fontSize: '11px',
fontWeight: 700,
fontFamily: 'Outfit',
textTransform: 'uppercase'
```

---

## 🧩 Componentes

### **KPI Card**

```javascript
<div style={{
  background: 'rgba(15, 23, 42, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '12px',
  padding: '16px',
  width: '100%',
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
    }}>Métrica</span>
    <IconName size={20} color={P.accent} />
  </div>

  <h2 style={{
    fontSize: '28px',
    fontWeight: 700,
    fontFamily: 'Outfit',
    margin: '0 0 8px 0',
  }}>$35.9M</h2>

  <span style={{
    fontSize: '12px',
    color: P.success,
    fontWeight: 500,
  }}>↑ +28%</span>
</div>
```

### **Button Primary**

```javascript
<button style={{
  background: P.accent,
  color: P.bg,
  border: 'none',
  borderRadius: '8px',
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'Outfit',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
}}>
  Acción
</button>
```

### **Button Secondary**

```javascript
<button style={{
  background: 'transparent',
  border: `1px solid ${P.border}`,
  color: P.text,
  borderRadius: '8px',
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'Outfit',
  cursor: 'pointer',
}}>
  Cancelar
</button>
```

### **Input Field**

```javascript
<input
  type="text"
  placeholder="Buscar..."
  style={{
    width: '100%',
    background: 'rgba(31, 41, 55, 0.6)',
    border: `1px solid ${P.border}`,
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'Plus Jakarta Sans',
    color: P.text,
    outline: 'none',
  }}
/>
```

### **Select Dropdown**

```javascript
<select style={{
  background: 'rgba(31, 41, 55, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  fontFamily: 'Plus Jakarta Sans',
  color: P.text,
  cursor: 'pointer',
  outline: 'none',
}}>
  <option>Opción 1</option>
  <option>Opción 2</option>
</select>
```

### **Status Badge**

```javascript
// Activo
<span style={{
  display: 'inline-block',
  background: 'rgba(16, 185, 129, 0.1)',
  color: P.success,
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
}}>Activo</span>

// Inactivo
<span style={{
  display: 'inline-block',
  background: 'rgba(239, 68, 68, 0.1)',
  color: P.danger,
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
}}>Inactivo</span>

// En Progreso
<span style={{
  display: 'inline-block',
  background: 'rgba(245, 158, 11, 0.1)',
  color: P.warning,
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
}}>En Progreso</span>
```

### **Card Container**

```javascript
<div style={{
  background: 'rgba(15, 23, 42, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
}}>
  {/* Contenido aquí */}
</div>
```

### **Table Header**

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: '150px 100px 80px',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: `1px solid ${P.border}`,
  marginBottom: '8px',
}}>
  <span style={{
    fontSize: '11px',
    fontWeight: 700,
    color: 'rgba(229, 231, 235, 0.6)',
    textTransform: 'uppercase',
  }}>COLUMNA 1</span>
  <span style={{
    fontSize: '11px',
    fontWeight: 700,
    color: 'rgba(229, 231, 235, 0.6)',
    textTransform: 'uppercase',
  }}>COLUMNA 2</span>
  <span style={{
    fontSize: '11px',
    fontWeight: 700,
    color: 'rgba(229, 231, 235, 0.6)',
    textTransform: 'uppercase',
  }}>COLUMNA 3</span>
</div>
```

### **Table Row**

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: '150px 100px 80px',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: `1px solid ${P.border}`,
  alignItems: 'center',
  fontSize: '13px',
}}>
  <span style={{ color: P.text }}>Valor 1</span>
  <span style={{ color: P.text }}>Valor 2</span>
  <span style={{ color: P.text }}>Valor 3</span>
</div>
```

### **Grid de Dos Columnas**

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  marginBottom: '24px',
}}>
  <div style={{/* card 1 */}}>Left</div>
  <div style={{/* card 2 */}}>Right</div>
</div>
```

### **Grid de Tres Columnas**

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '16px',
  marginBottom: '24px',
}}>
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
</div>
```

---

## 🔄 Patrones React

### **Búsqueda + Filtrado (useMemo)**

```javascript
const [searchTerm, setSearchTerm] = useState("");
const [filterStatus, setFilterStatus] = useState("TODO");

const filteredData = useMemo(() => {
  return data.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "TODO" || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });
}, [searchTerm, filterStatus]);

// En JSX:
<input
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Buscar..."
/>

<select
  value={filterStatus}
  onChange={(e) => setFilterStatus(e.target.value)}
>
  <option value="TODO">Todos</option>
  <option value="ACTIVO">Activo</option>
</select>

{filteredData.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### **Componente Memoizado**

```javascript
const MiComponente = memo(({ titulo, datos }) => {
  return (
    <div>
      <h2>{titulo}</h2>
      {datos.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
});
```

### **useCallback**

```javascript
const handleClick = useCallback(() => {
  onUpdate(itemId);
}, [itemId, onUpdate]);

<button onClick={handleClick}>Click</button>
```

---

## 📦 Imports Necesarios

```javascript
// React
import { useState, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';

// Charts
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Icons
import { Users, TrendingUp, BarChart3, Building2, MessageSquare, Settings, ... } from 'lucide-react';
```

---

## 🎯 Espaciado Rápido

```javascript
// Margenes
marginBottom: '8px'    // sm
marginBottom: '12px'   // md
marginBottom: '16px'   // lg
marginBottom: '24px'   // xl
marginBottom: '32px'   // xxl

// Padding
padding: '8px'
padding: '12px'
padding: '16px'
padding: '16px 24px'   // vertical horizontal
padding: '10px 12px'   // para inputs

// Gap (entre items)
gap: '8px'
gap: '12px'
gap: '16px'
gap: '24px'
```

---

## 🎨 Colores Rápidos

```javascript
// Background
background: 'rgba(15, 23, 42, 0.6)'      // Card
background: P.bg                          // Muy oscuro

// Borders
border: `1px solid ${P.border}`
borderRadius: '8px'                       // Inputs, buttons
borderRadius: '12px'                      // Cards

// Text
color: P.text                             // Normal
color: 'rgba(229, 231, 235, 0.7)'        // Gris claro
color: 'rgba(229, 231, 235, 0.5)'        // Más gris
```

---

## 🚀 Icons Comunes

```javascript
import { 
  Users,           // Personas
  TrendingUp,      // Tendencia
  BarChart3,       // Gráfico
  Building2,       // Edificio
  MessageSquare,   // Chat
  Settings,        // Config
  Search,          // Buscar
  DollarSign,      // Dinero
  Phone,           // Llamada
  Mail,            // Email
  Calendar,        // Calendario
  CheckCircle,     // Éxito
  AlertCircle,     // Alerta
  XCircle,         // Error
  Info,            // Información
} from 'lucide-react';

// Uso:
<Users size={20} color={P.accent} />
<TrendingUp size={24} color={P.success} />
```

---

## 📋 Checklist Rápido

- [ ] ¿Usé P.color en lugar de hardcodeado?
- [ ] ¿Uso Outfit para títulos, Plus Jakarta Sans para cuerpo?
- [ ] ¿Espaciado en múltiplos de 8px (4, 8, 12, 16, 24)?
- [ ] ¿Los bordes son `1px solid ${P.border}`?
- [ ] ¿El fondo es `rgba(15, 23, 42, 0.6)` para cards?
- [ ] ¿Rounded corners son 8px (inputs) o 12px (cards)?
- [ ] ¿Usé useMemo para búsquedas/filtros?
- [ ] ¿Iconos de Lucide React, no emojis?
- [ ] ¿Botones tienen `transition: 'all 0.3s ease'`?
- [ ] ¿Los inputs tienen outline: 'none'?

---

## 🐛 Errores Comunes

```javascript
// ❌ INCORRECTO
<div style={{ color: '#FF0000' }}>        // Color hardcodeado
<div style={{ fontSize: '15px' }}>        // No en escala tipográfica
<div style={{ marginBottom: '10px' }}>    // No múltiplo de 8
<button>Click</button>                    // Sin estilos
<div><Users /></div>                      // Icon sin size/color

// ✅ CORRECTO
<div style={{ color: P.danger }}>         // Usa paleta
<div style={{ fontSize: '13px' }}>        // Escala tipográfica
<div style={{ marginBottom: '12px' }}>    // Múltiplo de 8
<button style={{ /* estilos */ }}>Click</button>
<Users size={20} color={P.accent} />     // Icon con props
```

---

## 💡 Pro Tips

1. **Copia esta sección** y mantenla en otra pestaña
2. **Usa console.log** para debuggear: `console.log('data:', data)`
3. **DevTools (F12)** → Elements → inspecciona estilos
4. **Hot reload:** Guarda archivo → página se actualiza automáticamente
5. **Recharts:** Todos los datos deben ser arrays de objetos
6. **Lucide:** Ve lucide.dev para ver iconos disponibles
7. **Grid:** `gridTemplateColumns` debe tener mismo número de columnas que datos

---

## 🔗 Links Útiles

- Colores: Mira `const P = { ... }` en App.jsx
- Icons: https://lucide.dev
- Recharts: https://recharts.org
- React: https://react.dev

---

**Mantén esta página abierta mientras desarrollas. ⚡**

*Última actualización: Abril 2026*
