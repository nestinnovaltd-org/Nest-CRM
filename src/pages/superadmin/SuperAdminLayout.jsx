import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, Building2, BookOpen, Users, CheckSquare,
  CreditCard, LogOut, Menu, X, Bell, Settings, Shield,
  Layers, GitMerge, FileSpreadsheet, Briefcase, CalendarDays
} from 'lucide-react';
import './SuperAdminLayout.css';

const navItems = [
  { label: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
  { label: 'Organizations', path: '/super-admin/organizations', icon: Building2, section: 'MANAGEMENT' },
  { label: 'User Approvals', path: '/super-admin/approvals', icon: CheckSquare, section: 'MANAGEMENT', badge: 'pending' },
  { label: 'Book Demo Leads', path: '/super-admin/book-demo-leads', icon: BookOpen, section: 'MANAGEMENT' },
  { label: 'All Users', path: '/super-admin/users', icon: Users, section: 'MANAGEMENT' },
  
  // CRM Workspace Modules
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, section: 'CRM WORKSPACE' },
  { label: 'Leads', path: '/leads/mine', icon: Layers, section: 'CRM WORKSPACE' },
  { label: 'Projects', path: '/projects', icon: GitMerge, section: 'CRM WORKSPACE' },
  { label: 'HR Operations', path: '/hr/operations', icon: Briefcase, section: 'CRM WORKSPACE' },
  { label: 'Payments', path: '/payments/all', icon: FileSpreadsheet, section: 'CRM WORKSPACE' },
  { label: 'Calendar', path: '/calendar/view', icon: CalendarDays, section: 'CRM WORKSPACE' },
  { label: 'My Organization', path: '/settings/organization', icon: Building2, section: 'CRM WORKSPACE' },
  { label: 'All Users', path: '/users/all', icon: Users, section: 'CRM WORKSPACE' },
  { label: 'Add New User', path: '/users/add', icon: Users, section: 'CRM WORKSPACE' },
  { label: 'User Role and Access', path: '/users/roles', icon: Shield, section: 'CRM WORKSPACE' },

  { label: 'Billing & Packages', path: '/super-admin/billing', icon: CreditCard, section: 'SYSTEM' },
  { label: 'Settings', path: '/super-admin/settings', icon: Settings, section: 'SYSTEM' },
];

const sections = ['OVERVIEW', 'MANAGEMENT', 'CRM WORKSPACE', 'SYSTEM'];

export default function SuperAdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, currentTenant, setCurrentTenant } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const fetchTenants = async () => {
    try {
      const orgsRes = await supabase
        .from('organizations')
        .select('id, name, theme_color')
        .eq('status', 'approved');

      const orgList = (orgsRes.data || []).map(org => ({
        id: org.id,
        name: org.name,
        theme_color: org.theme_color,
        type: 'org'
      }));

      setTenants(orgList);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleTenantChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const selected = tenants.find(t => t.id === val);
    if (selected) {
      setCurrentTenant({ type: selected.type, id: selected.id, name: selected.name, theme_color: selected.theme_color });
    }
  };

  return (
    <div className="sa-shell">
      {sidebarOpen && <div className="sa-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sa-sidebar-header">
          <div className="sa-brand">
            <div className="sa-brand-icon">
              <Shield size={20} />
            </div>
            <div>
              <span className="sa-brand-name">Nest CRM</span>
              <span className="sa-brand-tag">Super Admin</span>
            </div>
          </div>
          <button className="sa-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sa-nav custom-scrollbar">
          {sections.map(section => {
            const items = navItems.filter(i => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="sa-nav-section">
                <div className="sa-section-label">{section}</div>
                {items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sa-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon size={18} className="sa-nav-icon" />
                    <span className="sa-nav-label">{item.label}</span>
                    {item.badge === 'pending' && <PendingBadge />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-user-info">
            <div className="sa-user-avatar">
              {user?.name?.charAt(0) || 'S'}
            </div>
            <div className="sa-user-details">
              <span className="sa-user-name">{user?.name || 'Super Admin'}</span>
              <span className="sa-user-role">God Mode</span>
            </div>
          </div>
          <button className="sa-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <button className="sa-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="sa-tenant-selector-wrap">
            <span className="sa-tenant-label">Viewing Workspace:</span>
            <select
              className="sa-tenant-select"
              value={currentTenant?.id || ''}
              onChange={handleTenantChange}
              disabled={loadingTenants}
            >
              {loadingTenants ? (
                <option>Loading workspaces...</option>
              ) : (
                <>
                  <optgroup label="Organizations">
                    {tenants.filter(t => t.type === 'org').map(t => (
                      <option key={t.id} value={t.id}>🏢 {t.name}</option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          <div className="sa-topbar-right">
            <button className="sa-topbar-btn">
              <Bell size={20} />
            </button>
            <div className="sa-topbar-user">
              <div className="sa-topbar-avatar">{user?.name?.charAt(0) || 'S'}</div>
            </div>
          </div>
        </header>
        <main className="sa-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function PendingBadge() {
  return <span className="sa-pending-badge">!</span>;
}
