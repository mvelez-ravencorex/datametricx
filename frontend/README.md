# DataMetricX Frontend

Frontend de la plataforma DataMetricX construido con React + TypeScript + Vite + Tailwind CSS.

## 🚀 Quick Start

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar archivo de variables de entorno
cp .env.example .env.local

# Editar .env.local con tus credenciales de Firebase
```

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:5173
```

### Build para Producción

```bash
# Generar build optimizado
npm run build

# Los archivos se generarán en la carpeta dist/
```

### Preview del Build

```bash
# Preview del build de producción localmente
npm run preview
```

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/         # Navbar, Sidebar, MainLayout
│   │   ├── dashboard/      # KPICard y componentes del dashboard
│   │   ├── charts/         # Componentes de gráficos (Recharts)
│   │   └── common/         # Componentes reutilizables
│   ├── pages/              # Páginas principales (Dashboard, Sales, etc.)
│   ├── styles/             # Estilos globales
│   ├── App.tsx             # Componente raíz con routing
│   └── main.tsx            # Entry point
├── public/                 # Assets estáticos
└── package.json
```

## 🎨 Tecnologías Utilizadas

- **React 18** - Librería de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Estilos utility-first
- **React Router** - Routing
- **Recharts** - Librería de gráficos
- **Heroicons** - Íconos

## 🎯 Funcionalidades Implementadas

- ✅ Layout principal con Navbar responsive
- ✅ Sidebar lateral opcional (comentado por defecto)
- ✅ Dashboard con KPI Cards
- ✅ Gráficos de barras y líneas (Recharts)
- ✅ Tabla de Top Products
- ✅ Navegación entre páginas
- ✅ Diseño responsive (mobile, tablet, desktop)

## 🎨 Paleta de Colores DataMetricX

- Primary Blue: `#0A2E50`
- Secondary Blue: `#3B82F6`
- Accent Red: `#FF6B6B`
- Data Colors: teal, purple, yellow, green, light-blue

Ver más detalles en `tailwind.config.js`

## 📝 Próximos Pasos

1. Configurar Firebase Authentication
2. Conectar con Firebase Firestore para datos reales
3. Implementar páginas de Sales, Marketing, Operations
4. Agregar más gráficos y visualizaciones
5. Implementar integrations page (Settings > Integrations)

## 🔧 Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run preview` - Preview del build
- `npm run lint` - Ejecutar ESLint

## 📚 Documentación

Ver la documentación completa del proyecto en `/docs`:
- FRONTEND.md - Especificación detallada del frontend
- UI_DESIGN.md - Guía de diseño UI/UX
- SETUP.md - Configuración inicial completa
