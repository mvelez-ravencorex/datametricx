import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Sales from '@/pages/Sales'
import Marketing from '@/pages/Marketing'
import Operations from '@/pages/Operations'
import Connections from '@/pages/Connections'
import Settings from '@/pages/Settings'
import DatasetView from '@/pages/DatasetView'
import Development from '@/pages/Development'
import DatasetsNew from '@/pages/DatasetsNew'
import Visualizations from '@/pages/Visualizations'
import DashboardEditor from '@/pages/DashboardEditor'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Onboarding from '@/pages/Onboarding'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import OAuthCallback from '@/pages/OAuthCallback'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* OAuth Callback Routes */}
          <Route path="/oauth/meta/callback" element={<OAuthCallback />} />
          <Route path="/oauth/google/callback" element={<OAuthCallback />} />
          <Route path="/oauth/shopify/callback" element={<OAuthCallback />} />

          {/* Onboarding (Protected - for users without tenant) */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="visualizations" element={<Visualizations />} />
            <Route path="dashboard-editor" element={<DashboardEditor />} />
            <Route path="sales" element={<Sales />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="operations" element={<Operations />} />
            <Route path="connections" element={<Connections />} />
            <Route path="datasets/:datasetName" element={<DatasetView />} />
            <Route path="development" element={<Development />} />
            <Route path="explore" element={<DatasetsNew />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
