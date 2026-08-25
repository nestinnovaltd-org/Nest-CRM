import React from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Overview from "./pages/Overview"
import AllLeads from "./pages/AllLeads"
import MyLeads from "./pages/MyLeads"
import LeadDetails from "./pages/LeadDetails"
import CreateDeal from "./pages/CreateDeal"
import FollowUps from "./pages/FollowUps"
import Visits from "./pages/Visits"
import SalesPipeline from "./pages/SalesPipeline"
import JunkLeads from "./pages/JunkLeads"
import Payments from "./pages/Payments"
import CalendarPage from "./pages/Calendar"
import UsersPage from "./pages/Users"
import AddUserPage from "./pages/AddUser"
import AddLeadPage from "./pages/AddLead"
import RolesPage from "./pages/Roles"
import TeamsPage from "./pages/TeamManagement"
import AddTeamPage from "./pages/AddTeam"
import TeamDetailsPage from "./pages/TeamDetails"
import AlertsPage from "./pages/Alerts"
import ProfilePage from "./pages/Profile"
import UserProfile from "./pages/UserProfile"
import UserDetails from "./pages/UserDetails"
import ProjectsPage from "./pages/Projects"
import AddProjectPage from "./pages/AddProject"
import EditProjectPage from "./pages/EditProject"
import HROperations from "./pages/HROperations"
import LandingPage from "./pages/LandingPage"
import LoginPage from "./pages/LoginPage"
import ResetPasswordPage from "./pages/ResetPasswordPage"
import AppLoader from "./components/AppLoader"
import BookDemo from "./pages/BookDemo"
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard"
import OrganizationManagement from "./pages/superadmin/OrganizationManagement"
import BookDemoLeads from "./pages/superadmin/BookDemoLeads"
import UserApprovals from "./pages/superadmin/UserApprovals"
import MyOrganization from "./pages/MyOrganization"

const ProtectedRoute = ({ children, module, action = "read" }) => {
  const { user, loading, hasPermission } = useAuth()
  if (loading) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />
  if (module && !hasPermission(module, action)) return <Navigate to="/dashboard" replace />
  return children
}

const SuperAdminRoute = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth()
  if (loading) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin()) return <Navigate to="/dashboard" replace />
  return children
}

const LoginRoute = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth()
  if (loading) return <AppLoader />
  if (user) return <Navigate to={isSuperAdmin() ? "/super-admin/dashboard" : "/dashboard"} replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/book-demo" element={<BookDemo />} />
          <Route path="/login" element={<LoginRoute><LoginPage /></LoginRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/super-admin/dashboard" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/super-admin/organizations" element={<SuperAdminRoute><OrganizationManagement /></SuperAdminRoute>} />
          <Route path="/super-admin/book-demo-leads" element={<SuperAdminRoute><BookDemoLeads /></SuperAdminRoute>} />
          <Route path="/super-admin/approvals" element={<SuperAdminRoute><UserApprovals /></SuperAdminRoute>} />
          <Route path="/super-admin/users" element={<SuperAdminRoute><UsersPage /></SuperAdminRoute>} />
          <Route path="/super-admin/billing" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
          <Route path="/super-admin/settings" element={<SuperAdminRoute><ProfilePage /></SuperAdminRoute>} />
          <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

          <Route path="/dashboard" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
          <Route path="/dashboard/my-performance" element={<ProtectedRoute><Overview /></ProtectedRoute>} />

          <Route path="/leads/all" element={<ProtectedRoute module="Lead Management"><AllLeads /></ProtectedRoute>} />
          <Route path="/leads/add" element={<ProtectedRoute module="Lead Management" action="create"><AddLeadPage /></ProtectedRoute>} />
          <Route path="/leads/mine" element={<ProtectedRoute module="Lead Management"><MyLeads /></ProtectedRoute>} />
          <Route path="/leads/user/:userId" element={<ProtectedRoute module="Lead Management"><MyLeads /></ProtectedRoute>} />
          <Route path="/leads/:id" element={<ProtectedRoute module="Lead Management"><LeadDetails /></ProtectedRoute>} />
          <Route path="/leads/:leadId/create-deal" element={<ProtectedRoute module="Lead Management"><CreateDeal /></ProtectedRoute>} />
          <Route path="/leads/follow-ups" element={<ProtectedRoute module="Lead Management"><FollowUps /></ProtectedRoute>} />
          <Route path="/leads/visits" element={<ProtectedRoute module="Lead Management"><Visits /></ProtectedRoute>} />

          <Route path="/pipeline/sales" element={<ProtectedRoute module="Lead Management"><SalesPipeline /></ProtectedRoute>} />
          <Route path="/leads/junk" element={<ProtectedRoute module="Lead Management"><JunkLeads /></ProtectedRoute>} />

          <Route path="/payments/all" element={<ProtectedRoute module="Payments"><Payments /></ProtectedRoute>} />
          <Route path="/hr/operations" element={<ProtectedRoute module="HR Operations"><HROperations /></ProtectedRoute>} />

          <Route path="/projects" element={<ProtectedRoute module="Project Management"><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/add" element={<ProtectedRoute module="Project Management" action="create"><AddProjectPage /></ProtectedRoute>} />
          <Route path="/projects/edit/:id" element={<ProtectedRoute module="Project Management" action="update"><EditProjectPage /></ProtectedRoute>} />

          <Route path="/calendar/view" element={<ProtectedRoute module="Calendar & Schedule"><CalendarPage /></ProtectedRoute>} />

          <Route path="/users/all" element={<ProtectedRoute module="User Management"><UsersPage /></ProtectedRoute>} />
          <Route path="/users/teams" element={<ProtectedRoute module="Team Management"><TeamsPage /></ProtectedRoute>} />
          <Route path="/users/teams/add" element={<ProtectedRoute module="Team Management" action="create"><AddTeamPage /></ProtectedRoute>} />
          <Route path="/users/teams/edit/:id" element={<ProtectedRoute module="Team Management" action="update"><AddTeamPage /></ProtectedRoute>} />
          <Route path="/users/teams/:id" element={<ProtectedRoute module="Team Management"><TeamDetailsPage /></ProtectedRoute>} />
          <Route path="/users/add" element={<ProtectedRoute module="User Management" action="create"><AddUserPage /></ProtectedRoute>} />
          <Route path="/users/:userId" element={<ProtectedRoute module="User Management"><UserDetails /></ProtectedRoute>} />
          <Route path="/users/roles" element={<ProtectedRoute module="User Management"><RolesPage /></ProtectedRoute>} />

          <Route path="/reports/sales" element={<ProtectedRoute module="Reports & Analytics"><Overview /></ProtectedRoute>} />
          <Route path="/reports/conversion" element={<ProtectedRoute module="Reports & Analytics"><Overview /></ProtectedRoute>} />
          <Route path="/reports/revenue" element={<ProtectedRoute module="Reports & Analytics"><Overview /></ProtectedRoute>} />
          <Route path="/reports/team" element={<ProtectedRoute module="Reports & Analytics"><Overview /></ProtectedRoute>} />

          <Route path="/notifications/alerts" element={<ProtectedRoute module="Notifications"><AlertsPage /></ProtectedRoute>} />
          <Route path="/settings/profile" element={<ProtectedRoute module="Settings"><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings/organization" element={<ProtectedRoute><MyOrganization /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
