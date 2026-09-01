import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  LayoutDashboard,
  Smartphone,
  Users,
  MessageSquare,
  Send,
  MessageCircle,
  Bot,
  Activity
} from 'lucide-react'
import DashboardLayout from '../../layouts/DashboardLayout'
import './whatsapp.css'

const WA_TABS = [
  { path: '/whatsapp/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/whatsapp/sessions',      label: 'Sessions',      icon: Smartphone },
  { path: '/whatsapp/leads',         label: 'Leads',         icon: Users },
  { path: '/whatsapp/templates',     label: 'Templates',     icon: MessageSquare },
  { path: '/whatsapp/campaigns',     label: 'Campaigns',     icon: Send },
  { path: '/whatsapp/conversations', label: 'Conversations', icon: MessageCircle },
  { path: '/whatsapp/ai-settings',   label: 'AI Settings',   icon: Bot },
  { path: '/whatsapp/logs',          label: 'Logs',          icon: Activity },
]

export default function WaLayout({ children, title, headerActions }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <DashboardLayout>
      <div className="wa-layout-container">
        {/* Top Header Bar with Back Button */}
        <div className="wa-module-header">
          <div className="wa-module-header-left">
            <button 
              className="wa-back-btn" 
              onClick={handleBack}
              title="Go Back"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="wa-header-divider" />
            <div className="wa-module-title-box">
              <h1 className="wa-module-title">WhatsApp</h1>
              {title && <span className="wa-module-subtitle">/ {title}</span>}
            </div>
          </div>
          {headerActions && (
            <div className="wa-module-header-right">
              {headerActions}
            </div>
          )}
        </div>

        {/* Main Body with Vertical Navigation Bar + Page Content */}
        <div className="wa-module-body">
          {/* Vertical Side Tabs */}
          <aside className="wa-vertical-nav custom-scrollbar">
            <div className="wa-nav-header">
              <span className="wa-nav-title">WhatsApp Menu</span>
            </div>
            <nav className="wa-nav-list">
              {WA_TABS.map(tab => {
                const Icon = tab.icon
                const isActive = location.pathname === tab.path
                return (
                  <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={`wa-nav-tab ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} className="wa-nav-tab-icon" />
                    <span className="wa-nav-tab-label">{tab.label}</span>
                    {isActive && <div className="wa-nav-active-pill" />}
                  </NavLink>
                )
              })}
            </nav>
          </aside>

          {/* Tab Content Area */}
          <main className="wa-content-area custom-scrollbar">
            {children}
          </main>
        </div>
      </div>
    </DashboardLayout>
  )
}
