# 🎨 DESIGN SYSTEM — Stratos IA v10

## 📋 Índice
1. [Sistema de Colores](#sistema-de-colores)
2. [Tipografías](#tipografías)
3. [Espaciado](#espaciado)
4. [Componentes Reutilizables](#componentes-reutilizables)
5. [Patrones de Código](#patrones-de-código)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 🎨 Sistema de Colores

### **Paleta Primaria**

```javascript
// En src/App.jsx - Objeto P (Primary)
const P = {
  bg: '#060A11',        // Background oscuro (casi negro)
  accent: '#6EE7C2',    // Mint/Turquesa (color de acento principal)
  text: '#E5E7EB',      // Texto gris claro
  border: '#1F2937',    // Bordes oscuros (gris)
  hover: '#10B981',     // Hover - verde más oscuro
  success: '#10B981',   // Verde (estados exitosos)
  warning: '#F59E0B',   // Naranja (advertencias)
  danger: '#EF4444',    // Rojo (peligro/error)
  info: '#3B82F6',      // Azul (información)
};
```

### **Uso de Colores**

| Elemento | Color | Código |
|----------|-------|--------|
| Background general | P.bg | #060A11 |
| Backgrounds de cards | P.bg + opacity 0.5 | rgba(6,10,17,0.5) |
| Bordes | P.border | #1F2937 |
| Texto principal | P.text | #E5E7EB |
| Acentos (botones, íconos) | P.accent | #6EE7C2 |
| Hover en botones | P.hover | #10B981 |
| Estados: éxito | P.success | #10B981 |
| Estados: warning | P.warning | #F59E0B |
| Estados: error | P.danger | #EF4444 |

### **Gradientes Usados**

```css
/* Fondo general */
background: linear-gradient(135deg, #060A11 0%, #0F172A 100%);

/* Gradiente para cards importantes */
background: linear-gradient(135deg, rgba(6,10,17,0.8) 0%, rgba(15,23,42,0.6) 100%);

/* Gradiente de acento (hover) */
background: linear-gradient(135deg, #6EE7C2 0%, #10B981 100%);
```

---

## 🔤 Tipografías

### **Fuentes Utilizadas**

```html
<!-- En index.html o CSS -->
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
```

### **Familia de Fuentes**

| Uso | Fuente | Pesos |
|-----|--------|-------|
| Títulos principales | `Outfit` | 700, 800 |
| Subtítulos | `Outfit` | 600, 700 |
| Etiquetas | `Outfit` | 500, 600 |
| Texto del cuerpo | `Plus Jakarta Sans` | 400, 500 |
| Texto pequeño | `Plus Jakarta Sans` | 400 |

### **Escala Tipográfica**

```javascript
// En estilos inline - tamaños de texto

// Títulos grandes (Dashboard, secciones)
fontSize: '32px',      // H1
fontWeight: 700,
fontFamily: 'Outfit'

// Títulos medianos (Cards principales)
fontSize: '24px',      // H2
fontWeight: 600,
fontFamily: 'Outfit'

// Títulos pequeños (Subsecciones)
fontSize: '18px',      // H3
fontWeight: 600,
fontFamily: 'Outfit'

// Subtítulos (Descriptivos)
fontSize: '14px',      // H4
fontWeight: 500,
fontFamily: 'Plus Jakarta Sans',
color: 'rgba(229, 231, 235, 0.7)'  // Gris claro

// Texto regular (Tablas, lists)
fontSize: '13px',      // Body
fontWeight: 400,
fontFamily: 'Plus Jakarta Sans'

// Texto pequeño (Metadatos, timestamps)
fontSize: '11px',      // Small
fontWeight: 400,
fontFamily: 'Plus Jakarta Sans',
color: 'rgba(229, 231, 235, 0.6)'
```

---

## 📏 Espaciado

### **Sistema de Espaciado Base (8px)**

```javascript
// Multíplos de 8px para consistencia

const spacing = {
  xs: '4px',      // 0.5x
  sm: '8px',      // 1x (base)
  md: '12px',     // 1.5x
  lg: '16px',     // 2x
  xl: '24px',     // 3x
  xxl: '32px',    // 4x
  huge: '48px',   // 6x
};
```

### **Aplicación de Espaciado**

| Elemento | Padding | Margin |
|----------|---------|--------|
| Card pequeña | `8px` | `16px` |
| Card mediana | `16px` | `24px` |
| Card grande | `24px` | `32px` |
| Grid gap | - | `16px` |
| Input height | `10px 12px` | `0` |
| Button height | `12px 16px` | `0 8px` |
| Fila de tabla | `12px 16px` | `0` |

---

## 🧩 Componentes Reutilizables

### **1. KPI Card (Métrica Principal)**

```javascript
// Uso
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
    }}>Ingresos Acumulados</span>
    <DollarSign size={20} color={P.accent} />
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

### **2. Button (Estándar)**

```javascript
// Variante 1: Primary (Mint)
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
  '&:hover': {
    background: P.hover,
    boxShadow: `0 4px 12px rgba(110, 231, 194, 0.3)`,
  },
}}>
  Acción
</button>

// Variante 2: Secondary (Border)
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
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: P.accent,
    color: P.accent,
  },
}}>
  Cancelar
</button>
```

### **3. Table Row (Estándar)**

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: '120px 100px 150px 80px 100px 80px',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: `1px solid ${P.border}`,
  alignItems: 'center',
  fontSize: '13px',
  fontFamily: 'Plus Jakarta Sans',
}}>
  <span style={{ color: 'rgba(229, 231, 235, 0.8)' }}>1 Abril 8:37pm</span>
  <span style={{ color: P.text, fontWeight: 500 }}>Emmanuel Ortiz</span>
  <span style={{ color: 'rgba(229, 231, 235, 0.7)' }}>Tony Norberto</span>
  <span style={{ color: 'rgba(229, 231, 235, 0.6)' }}>1 818 359 3113</span>
  <span style={{
    background: 'rgba(16, 185, 129, 0.1)',
    color: P.success,
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  }}>ZOOM AGENDADO</span>
  <span style={{ color: P.text }}>200k max</span>
</div>
```

### **4. Input Field (Búsqueda)**

```javascript
<input
  type="text"
  placeholder="Buscar cliente, asesor o teléfono..."
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
    transition: 'all 0.2s ease',
    '&:focus': {
      borderColor: P.accent,
      boxShadow: `0 0 0 2px rgba(110, 231, 194, 0.1)`,
    },
  }}
/>
```

### **5. Select Dropdown**

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
  transition: 'all 0.2s ease',
  '&:focus': {
    borderColor: P.accent,
  },
}}>
  <option>Todos los status</option>
  <option>Zoom Agendado</option>
  <option>Seguimiento</option>
  <option>WhatsApp</option>
  <option>No Contesta</option>
</select>
```

### **6. Status Badge**

```javascript
// Status: Activo
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

// Status: Inactivo
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

// Status: En Progreso
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

---

## 💻 Patrones de Código

### **1. Patrón useState + useMemo (Búsqueda/Filtrado)**

```javascript
const Component = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("TODO");

  // Filtrado optimizado sin re-renders
  const filteredData = useMemo(() => {
    return dataArray.filter(item => {
      const matchesSearch = 
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        filterStatus === "TODO" || item.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    });
  }, [searchTerm, filterStatus]); // Solo recalcula si estos cambian

  return (
    <>
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

      {/* Renderiza datos filtrados */}
      {filteredData.map(item => (
        <div key={item.id}>{item.nombre}</div>
      ))}
    </>
  );
};
```

### **2. Patrón useCallback (Eventos Optimizados)**

```javascript
const Component = ({ onUpdate }) => {
  // Función memoizada que no cambia en cada render
  const handleClick = useCallback(() => {
    onUpdate({ timestamp: new Date() });
  }, [onUpdate]); // Solo se recrea si onUpdate cambia

  return <button onClick={handleClick}>Click</button>;
};
```

### **3. Patrón memo (Componentes Puros)**

```javascript
// Envuelve componente que recibe props
const MiComponente = memo(({ titulo, datos }) => {
  return (
    <div>
      <h2>{titulo}</h2>
      {datos.map(item => <div key={item.id}>{item.nombre}</div>)}
    </div>
  );
});

export default MiComponente;
```

### **4. Portal para Modales**

```javascript
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, children, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: P.bg,
        border: `1px solid ${P.border}`,
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
      }}>
        {children}
        <button onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  );
};
```

---

## 📁 Estructura del Proyecto

```
src/
├── App.jsx                 # ARCHIVO PRINCIPAL (1,581 líneas)
│                           # Contiene:
│                           # - P (paleta de colores)
│                           # - StratosAtom (logo)
│                           # - DynIsland (notificaciones)
│                           # - 7 vistas principales (Dash, CRM, etc.)
│                           # - Todos los datos mock
│
├── main.jsx               # Entry point de React
├── index.css              # Estilos globales
├── components/            # (Opcional) Si fragmentas en componentes
│   ├── Dashboard.jsx
│   ├── CRM.jsx
│   └── ...
│
└── data/                  # (Opcional) Datos separados
    ├── teams.js
    ├── crm.js
    └── projects.js
```

---

## 🎨 Ejemplos Prácticos

### **Ejemplo 1: Agregar una nueva KPI Card**

```javascript
// En src/App.jsx, dentro del componente Dashboard

<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '16px',
  marginBottom: '24px',
}}>
  {/* Cards existentes */}

  {/* Nueva KPI */}
  <div style={{
    background: 'rgba(15, 23, 42, 0.6)',
    border: `1px solid ${P.border}`,
    borderRadius: '12px',
    padding: '16px',
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
    }}>123.4K</h2>

    <span style={{
      fontSize: '12px',
      color: P.success,
      fontWeight: 500,
    }}>↑ +15.3%</span>
  </div>
</div>
```

### **Ejemplo 2: Agregar una nueva vista al menú**

```javascript
// 1. En la sección de estados, agrega:
const [view, setView] = useState('dash'); // Agrega 'mi_vista'

// 2. Agrega botón en menú lateral:
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
    transition: 'all 0.2s ease',
  }}
  title="Mi Vista"
>
  <Settings size={20} />
</button>

// 3. Agrega renderizado condicional:
{view === 'mi_vista' && (
  <div style={{ padding: '24px' }}>
    {/* Tu contenido aquí */}
  </div>
)}
```

### **Ejemplo 3: Crear una tabla nueva**

```javascript
const [data] = useState([
  { id: 1, nombre: 'Cliente 1', estado: 'Activo', valor: '$50K' },
  { id: 2, nombre: 'Cliente 2', estado: 'Inactivo', valor: '$30K' },
]);

<div style={{
  background: 'rgba(15, 23, 42, 0.6)',
  border: `1px solid ${P.border}`,
  borderRadius: '12px',
  padding: '16px',
  marginTop: '24px',
}}>
  <h3 style={{
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'Outfit',
    marginBottom: '16px',
  }}>Mi Tabla</h3>

  <div style={{
    display: 'grid',
    gridTemplateColumns: '150px 100px 80px',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${P.border}`,
  }}>
    <span style={{
      fontSize: '11px',
      fontWeight: 700,
      color: 'rgba(229, 231, 235, 0.6)',
      textTransform: 'uppercase',
    }}>NOMBRE</span>
    <span style={{
      fontSize: '11px',
      fontWeight: 700,
      color: 'rgba(229, 231, 235, 0.6)',
      textTransform: 'uppercase',
    }}>ESTADO</span>
    <span style={{
      fontSize: '11px',
      fontWeight: 700,
      color: 'rgba(229, 231, 235, 0.6)',
      textTransform: 'uppercase',
    }}>VALOR</span>
  </div>

  {data.map(row => (
    <div
      key={row.id}
      style={{
        display: 'grid',
        gridTemplateColumns: '150px 100px 80px',
        gap: '12px',
        padding: '12px 0',
        borderBottom: `1px solid ${P.border}`,
      }}
    >
      <span style={{ color: P.text }}>{row.nombre}</span>
      <span style={{
        background: row.estado === 'Activo' 
          ? 'rgba(16, 185, 129, 0.1)' 
          : 'rgba(239, 68, 68, 0.1)',
        color: row.estado === 'Activo' ? P.success : P.danger,
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        textAlign: 'center',
      }}>
        {row.estado}
      </span>
      <span style={{ color: P.text }}>{row.valor}</span>
    </div>
  ))}
</div>
```

---

## 📐 Responsive Design

```javascript
// Usar media queries si necesitas (aunque Stratos IA es principalmente desktop)

// Ejemplo:
const cardStyle = {
  // Desktop
  gridTemplateColumns: 'repeat(3, 1fr)',
  
  // En media query (CSS):
  '@media (max-width: 1024px)': {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  '@media (max-width: 768px)': {
    gridTemplateColumns: '1fr',
  },
};
```

**O usar conditional CSS:**

```javascript
const isMobile = window.innerWidth < 768;

<div style={{
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
  gap: '16px',
}}>
  {/* contenido */}
</div>
```

---

## 🔧 Commits y Versionado

Usa este formato para commits:

```
Formato:
<tipo>: <descripción breve>

Ejemplos:
feat: Agregar búsqueda en Asesores CRM
fix: Corregir renderizado de tablas
refactor: Optimizar performance de filtros
style: Ajustar espaciado en cards
docs: Actualizar documentación
```

---

## ✅ Checklist para Nuevo Developer

- [ ] Entiendo la paleta de colores (P object)
- [ ] Conozco las 2 tipografías: Outfit y Plus Jakarta Sans
- [ ] Sé cómo crear KPI cards
- [ ] Sé cómo crear botones (primary y secondary)
- [ ] Entiendo useMemo y useCallback
- [ ] Conozco la estructura de archivos
- [ ] Puedo agregar nuevas vistas
- [ ] Sé cómo hacer tablas consistentes
- [ ] Sigo los patrones de commit

Si tienes dudas, revisa los ejemplos en **src/App.jsx** (todas las vistas usan estos patrones).

**¡A programar!** 🚀
