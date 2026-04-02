import { useState, useEffect } from 'react'
import KPICard from '@/components/dashboard/KPICard'
import SimpleLineChart from '@/components/charts/SimpleLineChart'
import SimpleBarChart from '@/components/charts/SimpleBarChart'
import EditableGrid from '@/components/dashboard/EditableGrid'
import { Layout } from 'react-grid-layout'
import { ChartBarIcon, CurrencyDollarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

// Datos de ejemplo
const kpiData = {
  revenue: {
    value: 1200000,
    change: 12.5,
    trend: [900000, 950000, 980000, 1050000, 1100000, 1200000]
  },
  roas: {
    value: 4.5,
    change: 8.2,
    trend: [3.8, 4.0, 4.2, 4.3, 4.4, 4.5]
  },
  conversionRate: {
    value: 3.2,
    change: -2.1,
    trend: [3.5, 3.4, 3.3, 3.3, 3.2, 3.2]
  }
}

const quarterlySalesData = [
  { quarter: 'Q1', sales: 250000, label: '$250K', growth: 6.69 },
  { quarter: 'Q2', sales: 390000, label: '$390K', growth: null },
  { quarter: 'Q3', sales: 180000, label: '$180K', growth: 3.39 },
  { quarter: 'Q4', sales: 220000, label: '$220K', growth: 3.39 },
  { quarter: 'Q5', sales: 490000, label: '$490K', growth: 4.40 },
  { quarter: 'Q6', sales: 230000, label: '$230K', growth: 3.30 },
]

const salesForecastData = [
  { month: 'B1', value: 0 },
  { month: '160K', value: 160000 },
  { month: '330K', value: 330000 },
  { month: '360K', value: 360000 },
  { month: '480K', value: 480000 },
  { month: '200K', value: 200000 },
]

const categoryPerformanceData = [
  { category: 'Q3', value: 390000, label: '$390K' },
  { category: 'Q1', value: 270000, label: '$270K' },
  { category: 'Q4', value: 160000, label: '$160K' },
]

const topProducts = [
  { id: 1, name: 'Wireless Headphones', sales: '$45,230', trend: '+12%', units: 1234 },
  { id: 2, name: 'Smart Watch Pro', sales: '$38,920', trend: '+8%', units: 892 },
  { id: 3, name: 'USB-C Cable Pack', sales: '$32,100', trend: '+15%', units: 3210 },
  { id: 4, name: 'Phone Case Premium', sales: '$28,450', trend: '-3%', units: 945 },
  { id: 5, name: 'Portable Charger', sales: '$24,890', trend: '+5%', units: 1567 },
]

export default function Dashboard() {
  const [layouts, setLayouts] = useState<Layout[]>([])

  // Cargar layouts guardados del localStorage
  useEffect(() => {
    const savedLayouts = localStorage.getItem('dashboard-layouts')
    if (savedLayouts) {
      try {
        setLayouts(JSON.parse(savedLayouts))
      } catch (e) {
        console.error('Error loading saved layouts:', e)
      }
    }
  }, [])

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayouts(newLayout)
  }

  // Componentes del dashboard
  const dashboardWidgets = [
    // KPI Cards
    <KPICard
      key="kpi-revenue"
      title="Total Revenue"
      value={kpiData.revenue.value}
      change={kpiData.revenue.change}
      trend={kpiData.revenue.trend}
      format="currency"
      icon={<CurrencyDollarIcon className="h-8 w-8" />}
    />,
    <KPICard
      key="kpi-roas"
      title="ROAS"
      value={kpiData.roas.value}
      change={kpiData.roas.change}
      trend={kpiData.roas.trend}
      format="multiplier"
      icon={<ArrowTrendingUpIcon className="h-8 w-8" />}
    />,
    <KPICard
      key="kpi-conversion"
      title="Conversion Rate"
      value={kpiData.conversionRate.value}
      change={kpiData.conversionRate.change}
      trend={kpiData.conversionRate.trend}
      format="percentage"
      icon={<ChartBarIcon className="h-8 w-8" />}
    />,

    // Quarterly Sales
    <div key="quarterly-sales" className="bg-white rounded-lg shadow p-6 h-full">
      <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
        Quarterly Sales
      </h2>
      <SimpleBarChart
        data={quarterlySalesData}
        bars={[{ dataKey: 'sales', fill: '#3B82F6', name: 'Sales' }]}
        xAxisKey="quarter"
        height={250}
      />
    </div>,

    // Connected Data Sources
    <div key="connected-sources" className="bg-white rounded-lg shadow p-6 h-full">
      <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
        Connected Data Sources
      </h2>
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="relative w-48 h-48">
          {/* Circle central */}
          <div className="absolute inset-0 border-8 border-secondary-blue rounded-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Data</div>
              <div className="text-xs text-gray-500">Central</div>
            </div>
          </div>

          {/* Iconos alrededor */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
              FB
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
              SH
            </div>
          </div>
          <div className="absolute top-1/2 -left-8 transform -translate-y-1/2">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
              TN
            </div>
          </div>
          <div className="absolute top-1/2 -right-8 transform -translate-y-1/2">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
              GO
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Sales Forecast
    <div key="sales-forecast" className="bg-white rounded-lg shadow p-6 h-full">
      <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
        Sales Forecast (Next 6 Months)
      </h2>
      <SimpleLineChart
        data={salesForecastData}
        lines={[{ dataKey: 'value', stroke: '#3B82F6', name: 'Revenue' }]}
        xAxisKey="month"
        height={250}
      />
    </div>,

    // Product Category Performance
    <div key="category-performance" className="bg-white rounded-lg shadow p-6 h-full">
      <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
        Product Category Performance
      </h2>
      <div className="space-y-4">
        {categoryPerformanceData.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{item.category}</span>
              <span className="text-sm font-semibold text-gray-900">{item.label}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-secondary-blue h-3 rounded-full transition-all duration-300"
                style={{ width: `${(item.value / 490000) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>,

    // Top 5 Products
    <div key="top-products" className="bg-white rounded-lg shadow overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-heading font-semibold text-gray-900">
          Top 5 Products
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sales
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trend
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Units Sold
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {topProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{product.sales}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex text-sm font-semibold ${
                    product.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {product.trend}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.units.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ]

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900">
          E-commerce Performance Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Track your sales, marketing, and operational metrics in real-time
        </p>
      </div>

      {/* Editable Grid */}
      <EditableGrid
        initialLayouts={layouts.length > 0 ? layouts : undefined}
        onLayoutChange={handleLayoutChange}
      >
        {dashboardWidgets}
      </EditableGrid>
    </div>
  )
}
