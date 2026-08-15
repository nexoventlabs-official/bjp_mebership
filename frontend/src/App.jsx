import { Routes, Route, Navigate } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import ChatbotPage from './pages/ChatbotPage'
import CandidateVerificationPage from './pages/CandidateVerificationPage'
import NotFoundPage from './pages/NotFoundPage'
import ReferralPage from './pages/ReferralPage'
import AdminLayout from './pages/admin/AdminLayout'
import LoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import ApplicationsPage from './pages/admin/ApplicationsPage'
import ApplicationDetailPage from './pages/admin/ApplicationDetailPage'
import ReportsPage from './pages/admin/ReportsPage'

export default function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<ChatbotPage />} />
        <Route path="/verify" element={<CandidateVerificationPage />} />
        <Route path="/verify/:id" element={<CandidateVerificationPage />} />
        <Route path="/r/:ntCode" element={<ReferralPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </LanguageProvider>
  )
}
