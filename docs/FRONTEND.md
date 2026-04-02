# DataMetricX - Especificación del Frontend

## Visión General

El frontend de DataMetricX es una Single Page Application (SPA) construida con React 18+ y TypeScript, deployada como archivos estáticos en Hostinger. La UI sigue el diseño DataMetricX (azules profundos, acento coral/verde, gráficos interactivos).

---

## Stack Tecnológico

- **Framework**: React 18+ con TypeScript
- **Build Tool**: Vite (rápido, moderno, HMR instantáneo)
- **Routing**: React Router v6
- **Styling**: Tailwind CSS 3.x + CSS Modules (opcional)
- **Charts**: Recharts (React-friendly, SVG-based)
- **State Management**: React Context + Custom Hooks
- **Forms**: React Hook Form + Zod (validación)
- **Firebase**: Firebase SDK (Auth + Firestore + Storage)
- **HTTP Client**: Axios (para llamadas a Cloud Functions)
- **Date Utilities**: date-fns
- **Icons**: Heroicons

---

## Estructura de Carpetas

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   ├── logo-datametricx.svg
│   └── images/
│       └── placeholder-chart.png
├── src/
│   ├── assets/
│   │   ├── fonts/
│   │   └── images/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── PageLayout.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── MetricsSummary.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── SalesForecast.tsx
│   │   │   ├── ProductPerformance.tsx
│   │   │   ├── ConnectedSources.tsx
│   │   │   └── TopProducts.tsx
│   │   ├── charts/
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── DonutChart.tsx
│   │   │   └── AreaChart.tsx
│   │   └── integrations/
│   │       ├── IntegrationCard.tsx
│   │       ├── ConnectModal.tsx
│   │       └── OAuthCallback.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Sales.tsx
│   │   ├── Marketing.tsx
│   │   ├── Operations.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── NotFound.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── TenantContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useFirestore.ts
│   │   ├── useMetrics.ts
│   │   ├── useIntegrations.ts
│   │   └── useProducts.ts
│   ├── services/
│   │   ├── firebase.ts
│   │   ├── api.ts
│   │   ├── metricsService.ts
│   │   ├── integrationsService.ts
│   │   └── productsService.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── metrics.ts
│   │   ├── user.ts
│   │   ├── integration.ts
│   │   └── product.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env.local
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.ts
```

---

## Configuración Inicial

### 1. Crear Proyecto

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 2. Instalar Dependencias

Ver `SETUP.md` para lista completa. Resumen:

```bash
npm install react-router-dom firebase axios recharts \
  react-hook-form zod @hookform/resolvers date-fns \
  @headlessui/react @heroicons/react clsx

npm install -D tailwindcss postcss autoprefixer @types/node
```

### 3. Configurar Tailwind

Ver `SETUP.md` para configuración completa de `tailwind.config.js` con colores DataMetricX.

---

## Componentes Principales

### Layout: Navbar

**Ubicación**: `src/components/layout/Navbar.tsx`

**Responsabilidad**:
- Logo DataMetricX a la izquierda
- Navegación principal (Overview, Sales, Marketing, Operations, Settings)
- Indicador de notificaciones
- Avatar de usuario + dropdown (Perfil, Logout)

**Diseño**:
```
┌────────────────────────────────────────────────────────────┐
│ [Logo] Overview  Sales  Marketing  Operations  Settings   │
│                                             [Bell] [Avatar]│
└────────────────────────────────────────────────────────────┘
```

**Código**:
```typescript
import { Link, useLocation } from 'react-router-dom';
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { name: 'Overview', path: '/dashboard' },
  { name: 'Sales', path: '/sales' },
  { name: 'Marketing', path: '/marketing' },
  { name: 'Operations', path: '/operations' },
  { name: 'Settings', path: '/settings' },
];

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo + Nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <img src="/logo-datametricx.svg" alt="DataMetricX" className="h-8 w-auto" />
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === item.path
                      ? 'border-primary-blue text-primary-blue'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <button className="p-1 rounded-full text-gray-400 hover:text-gray-500">
              <BellIcon className="h-6 w-6" />
            </button>
            <div className="relative">
              <button className="flex items-center space-x-2">
                <img
                  src={user?.photoURL || '/default-avatar.png'}
                  alt={user?.displayName || 'User'}
                  className="h-8 w-8 rounded-full"
                />
              </button>
              {/* Dropdown menu (usar Headless UI) */}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

### Dashboard: KPICard

**Ubicación**: `src/components/dashboard/KPICard.tsx`

**Responsabilidad**:
- Mostrar métrica única (Revenue, ROAS, Conversion Rate)
- Icono opcional
- Valor actual + cambio porcentual (vs período anterior)
- Mini gráfico de tendencia (sparkline)

**Diseño**:
```
┌─────────────────────────────┐
│ Total Revenue          [📈] │
│ $1.2M                       │
│ +12.5% vs last month        │
│     /\/\/\/\ (sparkline)    │
└─────────────────────────────┘
```

**Código**:
```typescript
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  change: number;
  trend: number[];
  icon?: React.ReactNode;
  format?: 'currency' | 'percentage' | 'number';
}

export default function KPICard({
  title,
  value,
  change,
  trend,
  icon,
  format = 'number'
}: KPICardProps) {
  const isPositive = change >= 0;
  const trendData = trend.map((val, idx) => ({ value: val, index: idx }));

  return (
    <div className="bg-gradient-to-br from-primary-blue to-secondary-blue rounded-lg p-6 text-white">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold mt-2">{formatValue(value, format)}</p>
          <div className="flex items-center mt-2">
            {isPositive ? (
              <ArrowUpIcon className="h-4 w-4 text-green-300" />
            ) : (
              <ArrowDownIcon className="h-4 w-4 text-red-300" />
            )}
            <span className={`text-sm ml-1 ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
              {Math.abs(change)}%
            </span>
          </div>
        </div>
        {icon && <div className="text-white/50">{icon}</div>}
      </div>

      {/* Sparkline */}
      <div className="mt-4 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return `$${(value / 1000000).toFixed(1)}M`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
}
```

---

### Charts: LineChart (Recharts)

**Ubicación**: `src/components/charts/LineChart.tsx`

**Responsabilidad**:
- Gráfico de líneas para métricas temporales (Revenue, Orders, etc.)
- Múltiples líneas si es necesario
- Tooltip interactivo
- Responsive

**Código**:
```typescript
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface LineChartProps {
  data: any[];
  lines: {
    dataKey: string;
    stroke: string;
    name: string;
  }[];
  xAxisKey: string;
}

export default function LineChart({ data, lines, xAxisKey }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey={xAxisKey}
          stroke="#6B7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#6B7280"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px'
          }}
        />
        <Legend />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.stroke}
            strokeWidth={2}
            name={line.name}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
```

---

## Páginas Principales

### Dashboard Page

**Ubicación**: `src/pages/Dashboard.tsx`

**Responsabilidad**:
- Replicar el diseño del E-commerce Performance Dashboard (ver UX)
- 3 KPI cards arriba (Total Revenue, ROAS, Conversion Rate)
- Gráfico de Quarterly Sales
- Connected Data Sources (círculo con íconos)
- Sales Forecast (línea ascendente)
- Product Category Performance (barras)
- Top 5 Products (tabla)

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  [KPI Card]     [KPI Card]     [KPI Card]               │
├──────────────────────┬──────────────────────────────────┤
│  Quarterly Sales     │  Connected Data Sources          │
│  [Bar Chart]         │  [Donut with Icons]              │
├──────────────────────┼──────────────────────────────────┤
│  Sales Breakdown     │  Sales Forecast (Next 6 Months)  │
│  [Bar Chart]         │  [Line Chart]                    │
├──────────────────────┴──────────────────────────────────┤
│  Product Category Performance   │  Top 5 Products       │
│  [Horizontal Bars]              │  [Table]              │
└─────────────────────────────────┴───────────────────────┘
```

**Código esqueleto**:
```typescript
import { useEffect, useState } from 'react';
import { useMetrics } from '@/hooks/useMetrics';
import KPICard from '@/components/dashboard/KPICard';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import ConnectedSources from '@/components/dashboard/ConnectedSources';

export default function Dashboard() {
  const { metrics, loading, error } = useMetrics({ days: 30 });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        E-commerce Performance Dashboard
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total Revenue"
          value={metrics.totalRevenue}
          change={12.5}
          trend={metrics.revenueTrend}
          format="currency"
        />
        <KPICard
          title="ROAS"
          value={4.5}
          change={8.2}
          trend={metrics.roasTrend}
          format="number"
        />
        <KPICard
          title="Conversion Rate"
          value={3.2}
          change={-2.1}
          trend={metrics.conversionTrend}
          format="percentage"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarterly Sales */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quarterly Sales</h2>
          <BarChart data={metrics.quarterlySales} />
        </div>

        {/* Connected Sources */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Connected Data Sources</h2>
          <ConnectedSources />
        </div>

        {/* Sales Forecast */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Sales Forecast (Next 6 Months)</h2>
          <LineChart
            data={metrics.forecast}
            lines={[{ dataKey: 'revenue', stroke: '#3B82F6', name: 'Revenue' }]}
            xAxisKey="month"
          />
        </div>

        {/* Product Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Product Category Performance</h2>
          {/* Horizontal bar chart */}
        </div>
      </div>
    </div>
  );
}
```

---

## Context y Hooks

### AuthContext

**Ubicación**: `src/context/AuthContext.tsx`

**Responsabilidad**:
- Gestionar estado de autenticación
- Login, signup, logout
- Escuchar cambios de auth state
- Proveer usuario actual a toda la app

**Código**:
```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '@/services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

### useMetrics Hook

**Ubicación**: `src/hooks/useMetrics.ts`

**Responsabilidad**:
- Fetch de métricas desde Firestore
- Agregación de datos (totales, promedios)
- Real-time updates con Firestore listeners
- Cacheo local para performance

**Código**:
```typescript
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useTenant } from '@/hooks/useTenant';
import { MetricsDaily } from '@/types/metrics';

interface UseMetricsOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export function useMetrics(options: UseMetricsOptions = {}) {
  const { tenantId } = useTenant();
  const [metrics, setMetrics] = useState<MetricsDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const { days = 30 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const metricsRef = collection(db, `tenants/${tenantId}/metrics_daily`);
    const q = query(
      metricsRef,
      where('date', '>=', startDateStr),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MetricsDaily[];
        setMetrics(data);
        setLoading(false);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [tenantId, options.days]);

  // Agregaciones
  const totalRevenue = metrics.reduce((sum, m) => sum + m.totals.revenue, 0);
  const totalSpend = metrics.reduce((sum, m) => sum + m.totals.spend, 0);
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    metrics,
    loading,
    error,
    totals: {
      revenue: totalRevenue,
      spend: totalSpend,
      roas: avgROAS
    }
  };
}
```

---

## Routing

**Ubicación**: `src/App.tsx`

**Código**:
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { TenantProvider } from '@/context/TenantContext';
import PrivateRoute from '@/components/PrivateRoute';
import Navbar from '@/components/layout/Navbar';
import Dashboard from '@/pages/Dashboard';
import Sales from '@/pages/Sales';
import Marketing from '@/pages/Marketing';
import Operations from '@/pages/Operations';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Private routes */}
            <Route element={<PrivateRoute><Navbar /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## Estilos y Branding DataMetricX

### Paleta de Colores

```css
/* globals.css */
:root {
  /* Primary */
  --color-primary-blue: #0A2E50;
  --color-secondary-blue: #3B82F6;
  --color-accent-red: #FF6B6B;
  --color-neutral-dark: #333333;

  /* Secondary/Data */
  --color-data-teal: #5EEAD2;
  --color-data-purple-teal: #B9A9E9;
  --color-data-purple: #A78BFA;
  --color-data-yellow: #FDE047;
  --color-data-green: #4ADE80;
  --color-data-light-blue: #93C5FD;
}
```

### Tipografía

```css
/* Importar fonts (en index.html o via CDN) */
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Sora', system-ui, sans-serif;
}
```

---

## Performance Optimizations

### 1. Code Splitting

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Sales = lazy(() => import('@/pages/Sales'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<Sales />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. Memoization

```typescript
import { memo, useMemo, useCallback } from 'react';

const KPICard = memo(function KPICard({ title, value, change }: KPICardProps) {
  // Component logic
});

function Dashboard() {
  const metrics = useMetrics();

  const totalRevenue = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.revenue, 0);
  }, [metrics]);

  const handleRefresh = useCallback(() => {
    // Refresh logic
  }, []);

  return <KPICard value={totalRevenue} />;
}
```

### 3. Virtual Scrolling (para tablas grandes)

```bash
npm install react-window
```

```typescript
import { FixedSizeList } from 'react-window';

function ProductTable({ products }: { products: Product[] }) {
  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>{products[index].name}</div>
  );

  return (
    <FixedSizeList
      height={400}
      itemCount={products.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

---

## Testing

### Setup Jest + React Testing Library

```bash
npm install -D @testing-library/react @testing-library/jest-dom vitest
```

**Ejemplo de test**:
```typescript
import { render, screen } from '@testing-library/react';
import KPICard from '@/components/dashboard/KPICard';

describe('KPICard', () => {
  it('renders title and value', () => {
    render(
      <KPICard
        title="Total Revenue"
        value={1200000}
        change={12.5}
        trend={[100, 110, 120]}
        format="currency"
      />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1.2M')).toBeInTheDocument();
  });
});
```

---

## Build y Deploy

### Build para Producción

```bash
npm run build
```

Genera `dist/` con archivos estáticos optimizados:
- HTML minificado
- CSS con Tailwind purged (solo clases usadas)
- JS bundled y minified
- Assets hasheados para cache busting

### Deploy a Hostinger

Ver `DEPLOYMENT.md` para pasos detallados. Resumen:

1. Build local: `npm run build`
2. Subir contenido de `dist/` a Hostinger via FTP/SFTP o File Manager
3. Configurar dominio para apuntar a index.html

---

## Próximos Pasos

1. Implementar componentes base (Button, Input, Modal)
2. Crear AuthContext y páginas de Login/Signup
3. Implementar Dashboard con KPICards y gráficos
4. Conectar con Firestore para métricas reales
5. Agregar páginas de Sales, Marketing, Operations
6. Implementar Settings (Integrations, Users)

---

**Documento creado**: 2025-11-18
**Última actualización**: 2025-11-18
**Versión**: 1.0
