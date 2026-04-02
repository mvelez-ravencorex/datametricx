# DataMetricX - Especificaciones de UI/UX

## Visión General

DataMetricX presenta una interfaz moderna, profesional y data-driven diseñada específicamente para analítica de e-commerce y performance marketing. El diseño prioriza:

- **Claridad**: métricas visibles de un vistazo
- **Profesionalismo**: paleta corporativa tech con azules profundos
- **Interactividad**: gráficos y tablas interactivos
- **Responsividad**: funciona en desktop, tablet y mobile

---

## Paleta de Colores

### Colores Primarios

| Color | Hex | RGB | Uso |
|-------|-----|-----|-----|
| **Primary Blue** | `#0A2E50` | rgb(10, 46, 80) | Navbar, títulos principales, KPI cards background |
| **Secondary Blue** | `#3B82F6` | rgb(59, 130, 246) | Links, botones primarios, highlights |
| **Accent Red** | `#FF6B6B` | rgb(255, 107, 107) | Alertas, métricas negativas, calls-to-action |
| **Neutral Dark** | `#333333` | rgb(51, 45, 151) | Texto principal, íconos |

### Colores Secundarios (Datos/Gráficos)

| Color | Hex | RGB | Uso |
|-------|-----|-----|-----|
| **Complementary Teal** | `#5EEAD2` | rgb(94, 234, 212) | Gráficos, datos positivos |
| **Data Purple (Teal)** | `#B9A9E9` | rgb(185, 169, 233) | Categorías en gráficos |
| **Data Purple** | `#A78BFA` | rgb(167, 134, 71) | Categorías en gráficos |
| **Data Yellow** | `#FDE047` | rgb(253, 224, 71) | Highlights, warnings |
| **Data Green** | `#4ADE80` | rgb(74, 222, 128) | Métricas positivas, success |
| **Data Light Blue** | `#93C5FD` | rgb(147, 197, 253) | Gráficos, líneas de tendencia |

### Grises y Neutros

| Color | Hex | Uso |
|-------|-----|-----|
| **Gray 50** | `#F9FAFB` | Backgrounds |
| **Gray 100** | `#F3F4F6` | Cards, containers |
| **Gray 200** | `#E5E7EB` | Borders, dividers |
| **Gray 400** | `#9CA3AF` | Texto secundario |
| **Gray 600** | `#4B5563` | Texto terciario |
| **Gray 900** | `#111827` | Texto muy oscuro |

### Configuración en Tailwind

`tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2E50',
          blue: '#0A2E50',
        },
        secondary: {
          DEFAULT: '#3B82F6',
          blue: '#3B82F6',
        },
        accent: {
          red: '#FF6B6B',
        },
        neutral: {
          dark: '#333333',
        },
        data: {
          teal: '#5EEAD2',
          'purple-teal': '#B9A9E9',
          purple: '#A78BFA',
          yellow: '#FDE047',
          green: '#4ADE80',
          'light-blue': '#93C5FD',
        },
      },
    },
  },
};
```

---

## Tipografía

### Fuentes

**Headings (H1-H6)**: **Sora**
- Pesos: 400 (Regular), 600 (SemiBold), 700 (Bold)
- Uso: Títulos de páginas, secciones, KPI cards

**Body Text**: **Inter**
- Pesos: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- Uso: Párrafos, labels, botones, navegación

**Alternativa** (si Sora no está disponible):
- Headings: Montserrat
- Body: Roboto

### Importar en HTML

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Escala Tipográfica

| Elemento | Font | Size | Weight | Line Height |
|----------|------|------|--------|-------------|
| H1 (Page Title) | Sora | 30px / 1.875rem | 700 | 1.2 |
| H2 (Section) | Sora | 24px / 1.5rem | 600 | 1.3 |
| H3 (Subsection) | Sora | 20px / 1.25rem | 600 | 1.4 |
| H4 (Card Title) | Sora | 18px / 1.125rem | 600 | 1.4 |
| Body Large | Inter | 16px / 1rem | 400 | 1.5 |
| Body (default) | Inter | 14px / 0.875rem | 400 | 1.5 |
| Body Small | Inter | 12px / 0.75rem | 400 | 1.5 |
| Button | Inter | 14px / 0.875rem | 600 | 1 |
| Label | Inter | 12px / 0.75rem | 500 | 1 |

### Configuración en Tailwind

```javascript
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['1rem', { lineHeight: '1.5' }],
        'lg': ['1.125rem', { lineHeight: '1.4' }],
        'xl': ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
      },
    },
  },
};
```

---

## Componentes UI

### 1. Navbar

**Diseño**:
```
┌────────────────────────────────────────────────────────────┐
│ [Logo] Overview  Sales  Marketing  Operations  Settings   │
│                                             [Bell] [Avatar]│
└────────────────────────────────────────────────────────────┘
```

**Especificaciones**:
- **Altura**: 64px (h-16)
- **Background**: `#FFFFFF` (white)
- **Border Bottom**: 1px solid `#E5E7EB` (gray-200)
- **Logo**: SVG, altura 32px
- **Nav Items**:
  - Font: Inter 14px Medium
  - Color inactivo: `#6B7280` (gray-500)
  - Color activo: `#0A2E50` (primary-blue)
  - Hover: `#374151` (gray-700)
  - Border bottom activo: 2px solid `#0A2E50`
  - Spacing: 32px entre items
- **Icons** (Bell, Avatar): 24px × 24px
- **Responsive**: En mobile (<768px), mostrar hamburger menu

### 2. KPI Card

**Diseño**:
```
┌─────────────────────────────┐
│ Total Revenue          [📈] │
│ $1.2M                       │
│ +12.5% ↗ vs last month      │
│     ┌─┬─┬─┬─┐ (sparkline)  │
└─────────────────────────────┘
```

**Especificaciones**:
- **Tamaño**: min-width 240px, height 160px
- **Background**: Gradient `linear-gradient(135deg, #0A2E50 0%, #3B82F6 100%)`
- **Border Radius**: 12px (rounded-lg)
- **Padding**: 24px
- **Box Shadow**: `0 4px 6px rgba(0, 0, 0, 0.1)`
- **Título**:
  - Font: Inter 12px Medium
  - Color: `rgba(255, 255, 255, 0.9)`
- **Valor**:
  - Font: Sora 36px Bold
  - Color: `#FFFFFF`
  - Margin top: 8px
- **Cambio %**:
  - Font: Inter 14px Medium
  - Color positivo: `#4ADE80` (data-green)
  - Color negativo: `#FF6B6B` (accent-red)
  - Icono: Arrow up/down 16px
- **Sparkline**: altura 48px, color `rgba(255, 255, 255, 0.5)`

### 3. Chart Card (Gráfico)

**Diseño**:
```
┌────────────────────────────────┐
│ Sales Forecast        [Filter]│
│ (Next 6 Months)                │
│                                │
│  [Line Chart - 300px height]  │
│                                │
└────────────────────────────────┘
```

**Especificaciones**:
- **Background**: `#FFFFFF`
- **Border**: 1px solid `#E5E7EB`
- **Border Radius**: 8px (rounded-lg)
- **Padding**: 24px
- **Box Shadow**: `0 1px 3px rgba(0, 0, 0, 0.1)`
- **Título**:
  - Font: Sora 18px SemiBold
  - Color: `#111827` (gray-900)
- **Chart**:
  - Altura: 300px
  - Grid lines: `#E5E7EB` (gray-200)
  - Axis labels: Inter 12px, `#6B7280` (gray-500)
  - Line stroke width: 2px
  - Dot radius: 4px, active 6px

### 4. Connected Data Sources (Donut con íconos)

**Diseño**:
```
       ┌─────────┐
   [FB]│         │[TikTok]
       │ DataMX  │
[Shopify]       [Google]
       │         │
   [ML]└─────────┘[Amazon]
```

**Especificaciones**:
- **Container**: width 300px, height 300px
- **Donut Chart**:
  - Radio exterior: 120px
  - Radio interior: 80px (thickness 40px)
  - Colores: diferentes para cada plataforma
- **Logos de plataforma**: 32px × 32px, posicionados alrededor del donut
- **Centro**: Logo DataMetricX 48px × 48px
- **Líneas conectoras**: 1px solid `#E5E7EB`, desde donut hasta logo

### 5. Tabla (Top Products)

**Diseño**:
```
┌─────────────────────────────────────────────────────┐
│ Product              │ Sales  │ Trend │ Units Sold │
├──────────────────────┼────────┼───────┼────────────┤
│ Remera Negra M       │ $2,500 │  ↗️   │ 150        │
│ Pantalón Azul L      │ $1,800 │  ↗️   │ 90         │
│ ...                  │        │       │            │
└─────────────────────────────────────────────────────┘
```

**Especificaciones**:
- **Header**:
  - Background: `#F9FAFB` (gray-50)
  - Font: Inter 12px SemiBold
  - Color: `#6B7280` (gray-500)
  - Padding: 12px 16px
  - Border bottom: 1px solid `#E5E7EB`
- **Rows**:
  - Background: `#FFFFFF`
  - Hover: `#F9FAFB`
  - Font: Inter 14px Regular
  - Color: `#111827` (gray-900)
  - Padding: 16px
  - Border bottom: 1px solid `#F3F4F6`
- **Alternating rows**: background `#F9FAFB` (opcional)

### 6. Botones

**Primary Button**:
```css
background: #3B82F6 (secondary-blue)
color: #FFFFFF
padding: 12px 24px
border-radius: 8px
font: Inter 14px SemiBold
hover: #2563EB (darker blue)
active: #1D4ED8
```

**Secondary Button**:
```css
background: transparent
color: #3B82F6
border: 1px solid #3B82F6
padding: 12px 24px
border-radius: 8px
font: Inter 14px SemiBold
hover: background #EFF6FF (light blue)
```

**Danger Button**:
```css
background: #FF6B6B (accent-red)
color: #FFFFFF
padding: 12px 24px
border-radius: 8px
font: Inter 14px SemiBold
hover: #EF4444
```

---

## Layouts

### Dashboard Layout (E-commerce Performance)

**Grid Structure**:

```
┌─────────────────────────────────────────────────┐
│               NAVBAR (full width)                │
├──────────────┬──────────────┬───────────────────┤
│  KPI Card 1  │  KPI Card 2  │   KPI Card 3      │
│  (Revenue)   │  (ROAS)      │ (Conversion Rate) │
├──────────────┴──────────────┴───────────────────┤
│  Quarterly Sales Chart     │ Connected Sources  │
│  (Bar Chart)               │ (Donut + Icons)    │
├────────────────────────────┼────────────────────┤
│  Sales Breakdown           │ Sales Forecast     │
│  (Bar Chart)               │ (Line Chart)       │
├────────────────────────────┼────────────────────┤
│  Product Category          │ Top 5 Products     │
│  Performance (Horiz. Bars) │ (Table)            │
└────────────────────────────┴────────────────────┘
```

**CSS Grid**:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
  padding: 32px;
}

.kpi-cards {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.chart-card-large {
  grid-column: span 8;
}

.chart-card-small {
  grid-column: span 4;
}

@media (max-width: 1024px) {
  .chart-card-large,
  .chart-card-small {
    grid-column: 1 / -1;
  }
}
```

---

## Responsividad

### Breakpoints

| Breakpoint | Ancho | Uso |
|------------|-------|-----|
| `sm` | 640px | Mobile grande / Tablet pequeña |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop pequeña |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Desktop grande |

### Adaptaciones por Pantalla

**Mobile (<768px)**:
- Navbar: hamburger menu
- KPI Cards: stack vertical (1 columna)
- Charts: full width, altura reducida a 250px
- Tablas: scroll horizontal o cards

**Tablet (768px - 1024px)**:
- KPI Cards: 2 columnas
- Charts: 1 columna full width
- Navbar: iconos sin texto

**Desktop (>1024px)**:
- Layout completo como diseño
- KPI Cards: 3 columnas
- Charts: grid 2 columnas

---

## Animaciones y Microinteracciones

### Transiciones

```css
/* Buttons */
button {
  transition: all 0.2s ease-in-out;
}

/* Cards hover */
.card {
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.card:hover {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* Chart hover */
.recharts-line {
  transition: stroke-width 0.2s ease;
}
```

### Loading States

**Skeleton Loading** (para cards mientras cargan datos):

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
</div>
```

---

## Accesibilidad

### Contraste de Colores

- Todos los textos cumplen WCAG AA (ratio 4.5:1 mínimo)
- Primary Blue (#0A2E50) sobre blanco: ratio 10.8:1 ✅
- Gray 600 (#4B5563) sobre blanco: ratio 7.6:1 ✅

### Keyboard Navigation

- Todos los botones e inputs focusables
- Focus ring visible: `ring-2 ring-secondary-blue ring-offset-2`
- Tab order lógico

### ARIA Labels

```tsx
<button aria-label="Refresh metrics">
  <RefreshIcon className="h-5 w-5" />
</button>

<nav aria-label="Main navigation">
  <a href="/dashboard">Dashboard</a>
  ...
</nav>
```

---

## Assets y Recursos

### Íconos

**Librería**: Heroicons (React)

```tsx
import { ChartBarIcon, UserIcon, BellIcon } from '@heroicons/react/24/outline';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
```

**Tamaños estándar**:
- Small: 16px (h-4 w-4)
- Medium: 20px (h-5 w-5)
- Large: 24px (h-6 w-6)

### Logos de Plataformas

Ubicación: `frontend/src/assets/images/platforms/`

- `meta-ads.svg`
- `tiktok-ads.svg`
- `google-ads.svg`
- `shopify.svg`
- `tiendanube.svg`
- `mercadolibre.svg`
- `amazon.svg`

Dimensiones: 32px × 32px (SVG escalable)

---

## Documentación de Referencia

- **Figma** (si aplica): [Link al diseño]
- **Storybook** (futuro): componentes interactivos documentados
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Recharts**: https://recharts.org/

---

## Próximos Pasos

1. Implementar componentes base (Button, Input, Card)
2. Crear Storybook para documentar componentes
3. Implementar página de Dashboard siguiendo este diseño
4. Validar accesibilidad con herramientas (axe DevTools)
5. Testing visual con Chromatic (futuro)

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0
