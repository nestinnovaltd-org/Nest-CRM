import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  BarChart3, 
  Settings, 
  LogOut,
  X,
  CreditCard,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GitMerge,
  Bell,
  Activity,
  Briefcase
} from 'lucide-react';
import './Sidebar.css';

const logo = '/Nest%20CRM%20Logo%20without%20background.png';

const NavGroup = ({ item, isOpen, toggleGroup, onClose }) => {
  const location = useLocation();
  const isExpanded = isOpen === item.id;
  const hasActiveChild = item.subItems?.some(sub => {
    const currentFull = location.pathname + location.search;
    return sub.path.includes('?') ? (currentFull === sub.path) : (location.pathname === sub.path);
  }) || location.pathname === item.path;

  if (item.path) {
    return (
      <NavLink 
        to={item.path} 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={onClose}
      >
        <item.icon size={20} className="nav-icon" />
        <span className="nav-label">{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className={`nav-group ${isExpanded ? 'expanded' : ''} ${hasActiveChild ? 'has-active' : ''}`}>
      <div className="nav-item group-trigger" onClick={() => toggleGroup(item.id)}>
        <item.icon size={20} className="nav-icon" />
        <span className="nav-label">{item.label}</span>
        {item.subItems && (
          <span className="chevron">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
      </div>
      
      {item.subItems && isExpanded && (
        <div className="sub-menu">
          {item.subItems.map((sub) => (
            <Link 
              key={sub.path} 
              to={sub.path} 
              className={(() => {
                const currentFull = location.pathname + location.search;
                const isSubActive = sub.path.includes('?') ? (currentFull === sub.path) : (location.pathname === sub.path);
                return `sub-nav-item ${isSubActive ? 'active' : ''}`;
              })()}
              onClick={onClose}
            >
              <span className="dot"></span>
              <span className="sub-label">{sub.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ isOpen, onClose }) => {
  const [expandedGroup, setExpandedGroup] = useState('dashboard');
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleGroup = (id) => {
    setExpandedGroup(expandedGroup === id ? null : id);
  };

  const rawMenuItems = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/dashboard'
    },
    {
      id: 'projects',
      icon: GitMerge,
      label: 'Project Management',
      moduleName: 'Project Management',
      subItems: [
        { label: 'All Projects', path: '/projects' },
        { label: 'Add New Project', path: '/projects/add', action: 'add' },
      ]
    },
    {
      id: 'leads',
      icon: Users,
      label: 'Lead Management',
      moduleName: 'Lead Management',
      path: '/leads/mine'
    },
    {
      id: 'users',
      icon: UserSquare2,
      label: 'User Management',
      moduleName: 'User Management',
      subItems: [
        { label: 'All Users', path: '/users/all' },
        { label: 'Add New User', path: '/users/add', action: 'add' },
        { label: 'User Role and Access', path: '/users/roles' },
      ]
    },
    {
      id: 'teams',
      icon: UserSquare2,
      label: 'Team Management',
      moduleName: 'Team Management',
      subItems: [
        { label: 'Overview', path: '/users/teams' },
        { label: 'Create New Team', path: '/users/teams/add', action: 'add' },
      ]
    },
    {
      id: 'calendar',
      icon: CalendarDays,
      label: 'Calendar & Schedule',
      moduleName: 'Calendar & Schedule',
      subItems: [
        { label: 'Calendar View', path: '/calendar/view' },
      ]
    },
    {
      id: 'payments',
      icon: CreditCard,
      label: 'Payments',
      moduleName: 'Payments',
      path: '/payments/all'
    },
    {
      id: 'hr_operations',
      icon: Briefcase,
      label: 'HR Operations',
      moduleName: 'HR Operations',
      subItems: [
        { label: 'Attendance Check', path: '/hr/operations?tab=attendance' },
        { label: 'Leave Management', path: '/hr/operations?tab=leaves' },
        { label: 'Employee Master', path: '/hr/operations?tab=employee_master' },
        { label: 'Payroll Processing', path: '/hr/operations?tab=payroll' },
        { label: 'Organization Info', path: '/hr/operations?tab=organization' },
      ]
    },
    {
      id: 'reports',
      icon: BarChart3,
      label: 'Reports & Analytics',
      moduleName: 'Reports & Analytics',
      subItems: [
        { label: 'Sales Reports', path: '/reports/sales' },
        { label: 'Lead Conversion', path: '/reports/conversion' },
        { label: 'Revenue Reports', path: '/reports/revenue' },
        { label: 'Team Performance', path: '/reports/team' },
      ]
    },
    {
      id: 'notifications',
      icon: Bell,
      label: 'Notifications',
      moduleName: 'Notifications',
      subItems: [
        { label: 'Follow-up Alerts', path: '/notifications/alerts' },
      ]
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      moduleName: 'Settings',
      subItems: [
        { label: 'Profile Settings', path: '/settings/profile' },
        { label: 'My Organization', path: '/settings/organization' },
      ]
    },
  ];

  // Filter menu items based on permissions
  const menuItems = rawMenuItems.filter(item => {
    if (!item.moduleName) return true; // Always show Dashboard
    return hasPermission(item.moduleName, 'read');
  }).map(item => {
    if (item.subItems) {
      return {
        ...item,
        subItems: item.subItems.filter(sub => {
          return hasPermission(item.moduleName, sub.action || 'read', sub.label);
        })
      };
    }
    return item;
  });

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src={logo} alt="Nest CRM Logo" className="sb-logo-img" />
          </div>

          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav custom-scrollbar">
          {(() => {
            const categories = [
              { id: 'DASHBOARD', label: 'Dashboard' },
              { id: 'CRM', label: 'CRM' },
              { id: 'MANAGEMENT', label: 'Management' },
              { id: 'OPERATIONS', label: 'Operations' },
              { id: 'ANALYTICS', label: 'Analytics' },
              { id: 'SYSTEM', label: 'System' }
            ];
            
            const itemCategories = {
              dashboard: 'DASHBOARD',
              projects: 'CRM',
              leads: 'CRM',
              users: 'MANAGEMENT',
              teams: 'MANAGEMENT',
              hr_operations: 'MANAGEMENT',
              calendar: 'OPERATIONS',
              payments: 'OPERATIONS',
              reports: 'ANALYTICS',
              notifications: 'SYSTEM',
              settings: 'SYSTEM'
            };

            return categories.map(cat => {
              const catItems = menuItems.filter(item => itemCategories[item.id] === cat.id);
              if (catItems.length === 0) return null;
              
              return (
                <div key={cat.id} className="sidebar-section-group">
                  <div className="sidebar-section-label">{cat.label}</div>
                  {catItems.map(item => (
                    <NavGroup 
                      key={item.id} 
                      item={item} 
                      isOpen={expandedGroup} 
                      toggleGroup={toggleGroup}
                      onClose={onClose}
                    />
                  ))}
                </div>
              );
            });
          })()}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} className="nav-icon" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
      
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
    </>
  );
};

export default Sidebar;
