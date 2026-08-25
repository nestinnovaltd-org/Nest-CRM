import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import { 
  Users, 
  Target, 
  Wallet,
  Clock,
  Plus,
  Calendar,
  CreditCard,
  CheckSquare,
  TrendingUp,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal, LayoutDashboard
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import RevenueChart from '../components/dashboard/RevenueChart';
import ConversionFunnel from '../components/dashboard/ConversionFunnel';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import TaskSchedule from '../components/dashboard/TaskSchedule';
import CustomerSearch from '../components/CustomerSearch';

import './Overview.css';

const data = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 5000 },
  { name: 'Thu', revenue: 2780 },
  { name: 'Fri', revenue: 4890 },
  { name: 'Sat', revenue: 2390 },
  { name: 'Sun', revenue: 3490 },
];

const StatCard = ({ title, value, icon: Icon, color, link }) => (
  <Link to={link || "#"} className="stat-card-link">
    <Card className="premium-stat-card">
      <div className="stat-content">
        <div className="stat-header">
          <span className="stat-title">{title}</span>
          <div className={`stat-icon ${color}`}>
            <Icon size={18} className={
              color === 'brand' ? 'icon-user' : 
              color === 'blue' ? 'icon-target' : 
              color === 'green' ? 'icon-check' : 
              color === 'indigo' ? 'icon-wallet' : 
              color === 'purple' ? 'icon-location' : 
              color === 'orange' ? 'icon-clock' : ''
            } />
          </div>
        </div>
        <div className="stat-footer">
          <h3 className="stat-value">{value}</h3>
        </div>
      </div>
    </Card>
  </Link>
);

const QuickAction = ({ icon: Icon, label, onClick, color }) => (
  <button className={`quick-action-btn ${color}`} onClick={onClick}>
    <div className="action-icon-box">
      <Icon size={20} className={
        color === 'brand' ? 'icon-plus' : 
        color === 'green' ? 'icon-card' : 
        color === 'purple' ? 'icon-location' : 
        color === 'blue' ? 'icon-check' : ''
      } />
    </div>
    <span className="action-label">{label}</span>
    <ChevronRight size={16} className="chevron" />
  </button>
);

const Overview = () => {
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeDeals: 0,
    closedDeals: 0,
    revenue: 0,
    pending: 0,
    visits: 0
  });
  const [funnelData, setFunnelData] = useState({});
  const [chartData, setChartData] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [hotLeads, setHotLeads] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const getSubordinateUids = (allUsers, currentUserId) => {
    const user = allUsers.find(u => u.id === currentUserId || u.uid === currentUserId);
    if (!user) return [currentUserId];
    
    const currentName = user.fullName || user.name;
    let subUids = [currentUserId];
    
    const directSubs = allUsers.filter(u => u.reportsTo === currentName && u.id !== currentUserId);
    
    for (const sub of directSubs) {
      const descendants = getSubordinateUids(allUsers, sub.id);
      subUids = [...subUids, ...descendants];
    }
    
    return Array.from(new Set(subUids));
  };

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'MD' || currentUser?.role === 'System Admin';
  const isManager = currentUser ? (
    currentUser.role === 'Sales Manager' || 
    currentUser.role === 'Manager' || 
    currentUser.role === 'Team Leader'
  ) : false;
  
  const hasDashboardConfig = currentUser?.rolePermissions?.Dashboard !== undefined;
  
  const hasOverviewAccess = hasDashboardConfig 
    ? hasPermission('Dashboard', 'read', 'Overview') 
    : true; // Default fallback to active Overview tab
  
  const hasMyPerformanceAccess = hasDashboardConfig 
    ? hasPermission('Dashboard', 'read', 'My Performance') 
    : true; // Default fallback to active My Performance tab
    
  const hasTeamPerformanceAccess = hasDashboardConfig 
    ? hasPermission('Dashboard', 'read', 'Team Performance') 
    : (isAdmin || isManager); // Default fallback for Team Performance (Admin/Manager only)

  const availableTabs = [];
  if (hasOverviewAccess) availableTabs.push('Overview');
  if (hasMyPerformanceAccess) availableTabs.push('My Performance');
  if (hasTeamPerformanceAccess) availableTabs.push('Team Performance');

  // Safety fallback if no tabs are allowed
  if (availableTabs.length === 0) {
    availableTabs.push('Overview');
  }

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [currentUser?.rolePermissions, activeTab]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchProjects = async () => {
      const { data } = await supabase.from('projects').select('*').limit(3);
      setProjects(data || []);
    };
    fetchProjects();
    const ch = supabase.channel('overview-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('*');
      setTeams(data || []);
    };
    fetchTeams();
    const ch = supabase.channel('overview-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchTeams)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*');
      setAllUsers(data || []);
    };
    fetchUsers();
    const ch = supabase.channel('overview-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || allUsers.length === 0) return;

    const currentUserName = currentUser.fullName || currentUser.name || '';
    
    // Find all teams managed by the current user
    const managedTeams = teams.filter(t => {
      const leads = t.teamLeads || (t.teamLead ? [t.teamLead] : []);
      return leads.includes(currentUserName);
    });

    // Collect all member names from these teams
    const teamMemberNames = new Set();
    managedTeams.forEach(t => {
      if (t.members) {
        t.members.forEach(m => teamMemberNames.add(m));
      }
    });

    // Map member names to uids
    const teamMemberUids = allUsers
      .filter(u => teamMemberNames.has(u.fullName || u.name))
      .map(u => u.uid || u.id)
      .filter(Boolean);

    const subordinates = Array.from(new Set([
      currentUser.uid, 
      ...getSubordinateUids(allUsers, currentUser.uid),
      ...teamMemberUids
    ]));

    let leadsQuery = supabase.from('leads').select('*');

    const fetchLeads = async () => {
      const { data: allLeadsData, error } = await leadsQuery;
      if (error) { console.error('Error fetching overview stats:', error); setIsLoading(false); return; }
      let allLeads = allLeadsData || [];

      let filteredLeads = allLeads;
      if (!isAdmin && !isManager) {
        filteredLeads = allLeads.filter(l => l.assigned_to === currentUser.uid || l.assignedTo === currentUser.uid);
      } else {
        filteredLeads = allLeads.filter(l => subordinates.includes(l.assigned_to || l.assignedTo));
      }

      if (activeTab === 'My Performance') {
        filteredLeads = filteredLeads.filter(l => (l.assigned_to || l.assignedTo) === currentUser.uid);
      } else if (activeTab === 'Team Performance') {
        filteredLeads = filteredLeads.filter(l => (l.assigned_to || l.assignedTo) !== currentUser.uid);
      }

      let total = 0, active = 0, closed = 0, rev = 0, pend = 0, visits = 0;
      let funnel = { fresh: 0, followup: 0, visit: 0, negotiation: 0, closed: 0 };
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      let todayTasks = [];

      filteredLeads.forEach(data => {
        total++;
        if (data.status === 'Deal Confirmed') {
          closed++; funnel.closed++;
          const valueStr = data.value?.toString().replace(/[^\d.]/g, '') || '0';
          rev += parseFloat(valueStr);
        } else if (data.status === 'Under Negotiation') {
          active++; funnel.negotiation++;
        } else if (data.status === 'Follow Up') {
          pend++; funnel.followup++;
        } else if (data.status === 'Fresh Lead') {
          funnel.fresh++;
        }
        if (data.visitDate || data.visit_date) { visits++; funnel.visit++; }
        const followUpDate = data.followUpDate || data.follow_up_date;
        const visitDate = data.visitDate || data.visit_date;
        if (visitDate === todayStr) {
          todayTasks.push({ id: data.id, name: data.fullName || data.full_name || data.name, time: data.visitTime || 'TBD', type: 'visit', location: data.visitLocation || 'Site', phone: data.phone, completed: data.visitStatus === 'Completed' });
        }
        if (followUpDate === todayStr) {
          todayTasks.push({ id: data.id, name: data.fullName || data.full_name || data.name, time: data.followUpTime || 'TBD', type: 'followup', phone: data.phone, completed: data.followUpStatus === 'Completed' });
        }
      });

      const recentActivities = filteredLeads
        .filter(l => l.updated_at || l.updatedAt)
        .sort((a, b) => new Date(b.updated_at || b.updatedAt) - new Date(a.updated_at || a.updatedAt))
        .slice(0, 5)
        .map(l => ({ id: l.id, userName: l.updatedBy || 'System', action: 'Updated lead', target: l.fullName || l.full_name || l.name, time: new Date(l.updated_at || l.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));

      setStats({ totalLeads: total, activeDeals: active, closedDeals: closed, revenue: rev, pending: pend, visits });

      const teamPerf = subordinates.map(uid => {
        const userDoc = allUsers.find(u => u.id === uid || u.uid === uid);
        if (!userDoc) return null;
        const userLeads = allLeads.filter(l => (l.assigned_to || l.assignedTo) === uid);
        const userDeals = userLeads.filter(l => l.status === 'Deal Confirmed');
        const userRevenue = userDeals.reduce((sum, l) => sum + parseFloat(l.value?.toString().replace(/[^\d.]/g, '') || '0'), 0);
        const resolvedName = (userDoc.full_name || userDoc.fullName || userDoc.name || userDoc.email || 'Unknown').trim();
        return { id: uid, name: resolvedName, leads: userLeads.length, deals: userDeals.length, revenue: userRevenue };
      }).filter(Boolean).sort((a, b) => b.revenue - a.revenue);

      setTeamData(teamPerf);
      setFunnelData(funnel);
      setTasks(todayTasks);
      setActivities(recentActivities);
      setChartData([{ name: 'Mon', revenue: rev * 0.1 }, { name: 'Tue', revenue: rev * 0.15 }, { name: 'Wed', revenue: rev * 0.25 }, { name: 'Thu', revenue: rev * 0.2 }, { name: 'Fri', revenue: rev * 0.3 }, { name: 'Sat', revenue: rev * 0.1 }, { name: 'Sun', revenue: rev * 0.05 }]);
      const hot = filteredLeads.filter(l => l.priority === 'High Priority' || l.priority === 'Urgent' || l.status === 'Under Negotiation').slice(0, 4);
      setHotLeads(hot);
      const events = {};
      filteredLeads.forEach(l => {
        const fd = l.followUpDate || l.follow_up_date; const vd = l.visitDate || l.visit_date;
        if (fd) { if (!events[fd]) events[fd] = []; events[fd].push({ type: 'followup', name: l.fullName || l.full_name || l.name }); }
        if (vd) { if (!events[vd]) events[vd] = []; events[vd].push({ type: 'visit', name: l.fullName || l.full_name || l.name }); }
      });
      setCalendarEvents(events);
      setIsLoading(false);
    };

    fetchLeads();

    const ch = supabase.channel('overview-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [currentUser, allUsers, teams, activeTab]);

  const renderCalendarWidget = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthNames = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    const cells = [];
    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevTotalDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      cells.push({
        day: d,
        isCurrentMonth: false,
        dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        day: i,
        isCurrentMonth: true,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }
    // Next month padding to make complete 6-week grid (42 cells)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

    const handlePrevMonth = () => {
      setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
      setViewDate(new Date(year, month + 1, 1));
    };

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div className="premium-glass-card dashboard-calendar-card">
        <div className="calendar-card-header">
          <div className="calendar-header-title">
            <Calendar size={18} className="cal-icon-accent" />
            <h3>{monthNames[month]} {year}</h3>
          </div>
          <div className="calendar-nav-buttons">
            <button className="cal-nav-btn" onClick={handlePrevMonth}><ChevronLeft size={16} /></button>
            <button className="cal-nav-btn" onClick={() => setViewDate(new Date())}>Today</button>
            <button className="cal-nav-btn" onClick={handleNextMonth}><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="calendar-grid-wrapper">
          <div className="calendar-weekdays-grid">
            {weekdays.map(day => (
              <span key={day} className="cal-weekday">{day}</span>
            ))}
          </div>

          <div className="calendar-days-grid">
            {cells.map((cell, idx) => {
              const isToday = cell.dateString === todayStr;
              const dayEvents = calendarEvents[cell.dateString] || [];
              const hasFollowUp = dayEvents.some(e => e.type === 'followup');
              const hasVisit = dayEvents.some(e => e.type === 'visit');

              return (
                <div 
                  key={idx} 
                  className={`cal-day-cell ${cell.isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'is-today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
                >
                  <span className="cal-day-number">{cell.day}</span>
                  {dayEvents.length > 0 && (
                    <div className="cal-cell-events">
                      {hasFollowUp && <span className="cal-dot-event dot-followup" title="Follow-up Scheduled"></span>}
                      {hasVisit && <span className="cal-dot-event dot-visit" title="Site Visit Scheduled"></span>}
                    </div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="cal-cell-tooltip">
                      <div className="tooltip-header">Events ({dayEvents.length})</div>
                      <div className="tooltip-list">
                        {dayEvents.map((evt, eIdx) => (
                          <div key={eIdx} className={`tooltip-item ${evt.type}`}>
                            <span className="evt-type-label">{evt.type === 'visit' ? 'Visit' : 'FollowUp'}:</span>
                            <span className="evt-lead-name">{evt.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    const closedPercent = stats.totalLeads ? Math.round((stats.closedDeals / stats.totalLeads) * 100) : 0;
    const activePercent = stats.totalLeads ? Math.round((stats.activeDeals / stats.totalLeads) * 100) : 0;
    
    return (
      <>
        {/* ── CUSTOMER RECORDS SPARKLE SEARCH ── */}
        <div className="customer-records-bar" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button
            className="customer-records-sparkle-btn"
            onClick={() => setIsSearchOpen(true)}
            style={{
              '--border_radius': '9999px',
              '--transition': '0.3s ease-in-out',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--border_radius)',
              transformOrigin: 'center',
              transition: 'transform var(--transition)',
              flex: 1
            }}
          >
            {/* Dark background layer */}
            <span className="crb-bg-before" />
            {/* Gradient hover glow layer */}
            <span className="crb-bg-after" />
            {/* Rotating dots border */}
            <span className="crb-dots-border">
              <span className="crb-dots-before" />
            </span>
            {/* Sparkle Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 10, width: '1.4rem', color: 'white' }}>
              <path strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="currentColor" d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z" />
              <path strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="currentColor" d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z" />
              <path strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="currentColor" d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z" />
            </svg>
            {/* Button Label */}
            <span className="crb-text" style={{
              position: 'relative',
              zIndex: 10,
              fontSize: '0.95rem',
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 120%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              whiteSpace: 'nowrap'
            }}>
              Customer Records
            </span>
          </button>
        </div>

        <div className="dashboard-three-col-grid">
        <div className="dashboard-left-span-area">
          <div className="dashboard-top-row-grid">
            {/* ── COLUMN 1: PORTFOLIO STACK ── */}
            <div className="dashboard-col portfolio-column">
              <div className="premium-glass-card portfolio-main-card">
                <div className="portfolio-header-group">
                  <h3>Your Portfolio</h3>
                  <div className="portfolio-pills">
                    <button className="portfolio-pill active">All</button>
                    <button className="portfolio-pill" onClick={() => navigate('/leads/all')}>Active</button>
                    <button className="portfolio-pill" onClick={() => navigate('/pipeline/sales')}>Closed</button>
                  </div>
                </div>

                <div className="portfolio-action-row">
                  <button className="portfolio-action-btn" onClick={() => navigate('/leads/all')}>
                    <div className="p-action-icon"><Users size={16} /></div>
                    <span>Leads</span>
                  </button>
                  <button className="portfolio-action-btn" onClick={() => navigate('/pipeline/sales')}>
                    <div className="p-action-icon"><Target size={16} /></div>
                    <span>Deals</span>
                  </button>
                  <button className="portfolio-action-btn" onClick={() => navigate('/leads/add')}>
                    <div className="p-action-icon"><Plus size={16} /></div>
                    <span>Add</span>
                  </button>
                </div>

                <div className="portfolio-balance-section">
                  <div className="balance-labels">
                    <span className="lbl-title">Conversion Ratio</span>
                    <span className="lbl-val">{closedPercent}%</span>
                  </div>
                  <div className="balance-progress-bar">
                    <div className="balance-progress-fill" style={{ width: `${closedPercent}%` }}></div>
                  </div>
                  <div className="balance-details">
                    <span className="detail-txt">Closed: <strong>{stats.closedDeals}</strong></span>
                    <span className="detail-txt">Active: <strong>{stats.activeDeals}</strong></span>
                  </div>
                </div>
              </div>

              {/* Green Card: Total Leads */}
              <div className="gradient-info-card green-gradient" onClick={() => navigate('/leads/all')}>
                <div className="card-glow"></div>
                <div className="gi-header">
                  <div className="gi-icon"><Users size={18} /></div>
                  <span className="gi-title">Total Leads</span>
                  <button className="gi-dots" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={16} /></button>
                </div>
                <h2 className="gi-value">{isLoading ? "..." : stats.totalLeads.toLocaleString()}</h2>
                <div className="gi-footer">
                  <span className="gi-badge">+12.5%</span>
                  <span className="gi-sub">from last month</span>
                </div>
              </div>

              {/* Purple Card: Revenue */}
              <div className="gradient-info-card purple-gradient" onClick={() => navigate('/pipeline/sales')}>
                <div className="card-glow"></div>
                <div className="gi-header">
                  <div className="gi-icon"><Wallet size={18} /></div>
                  <span className="gi-title">Revenue</span>
                  <button className="gi-dots" onClick={(e) => e.stopPropagation()}><MoreHorizontal size={16} /></button>
                </div>
                <h2 className="gi-value">{isLoading ? "..." : `৳${stats.revenue.toLocaleString()}`}</h2>
                <div className="gi-footer">
                  <span className="gi-badge">+18.9%</span>
                  <span className="gi-sub">from last month</span>
                </div>
              </div>
            </div>

            {/* ── COLUMN 2: CHARTS STACK ── */}
            <div className="dashboard-col charts-column">
              <div className="premium-glass-card chart-main-card">
                <RevenueChart data={chartData} />
              </div>

              <div className="premium-glass-card analytics-main-card">
                <div className="analytics-header">
                  <div className="analytics-title-group">
                    <h3>Analytics</h3>
                    <p className="analytics-subtitle">Lead pipeline distribution</p>
                  </div>
                  <Calendar size={18} className="analytics-cal-icon" />
                </div>
                <ConversionFunnel data={funnelData} />
              </div>
            </div>
          </div>

          {/* ── MONTHLY CALENDAR WIDGET ── */}
          {renderCalendarWidget()}
        </div>

        {/* ── COLUMN 3: SIDEBAR STACK ── */}
        <div className="dashboard-col sidebar-column">
          {/* User Profile Info */}
          <div className="profile-widget-header">
            <div className="profile-user-info">
              <span className="p-welcome">Hi, {currentUser?.fullName || currentUser?.name || 'User'}</span>
              <span className="p-role">{currentUser?.role || 'Executive'}</span>
            </div>
            <div className="profile-avatar-circle">
              {currentUser?.avatar || currentUser?.photoURL ? (
                <img src={currentUser.avatar || currentUser.photoURL} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">{(currentUser?.fullName || currentUser?.name || 'U')[0]}</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="premium-glass-card sidebar-action-card">
            <div className="sidebar-card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="actions-list">
              <QuickAction icon={Plus} label="New Lead" color="brand" onClick={() => navigate('/leads/add')} />
              <QuickAction icon={Calendar} label={isManager || isAdmin ? "Team Schedule" : "My Schedule"} color="green" onClick={() => navigate('/calendar/view')} />
              <QuickAction icon={Clock} label={isManager || isAdmin ? "Team Follow-Ups" : "My Follow-Ups"} color="purple" onClick={() => navigate('/leads/follow-ups')} />
              <QuickAction icon={MapPin} label={isManager || isAdmin ? "Team Visits" : "My Visits"} color="blue" onClick={() => navigate('/leads/visits')} />
            </div>
          </div>

          {/* Today's Tasks */}
          <div className="premium-glass-card tasks-widget-card">
            <div className="sidebar-card-header">
              <h3>Today's Tasks</h3>
              <span className="task-count-badge">{tasks.length}</span>
            </div>
            <TaskSchedule tasks={tasks} />
          </div>

          {/* Real-time Activity Feed */}
          <div className="premium-glass-card activity-widget-card">
            <div className="sidebar-card-header">
              <h3>Real-time Activity</h3>
            </div>
            <ActivityFeed activities={activities} />
            <button className="view-all-btn-v3" onClick={() => navigate('/notifications/alerts')}>
              View All Activity <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      </>
    );
  };

  const renderPerformance = () => {
    const target = { leads: 50, revenue: 5000000, closed: 10 };
    const progressLeads = Math.min(100, (stats.totalLeads / target.leads) * 100);
    const progressRevenue = Math.min(100, (stats.revenue / target.revenue) * 100);
    const progressClosed = Math.min(100, (stats.closedDeals / target.closed) * 100);

    return (
      <div className="performance-view-v2">
        <div className="perf-targets-grid">
          <Card className="perf-target-card">
            <div className="target-info">
              <div className="target-label">
                <Target size={16} />
                <span>Monthly Leads Target</span>
              </div>
              <div className="target-stats">
                <span className="current">{stats.totalLeads}</span>
                <span className="goal">/ {target.leads}</span>
              </div>
            </div>
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-fill brand" style={{ width: `${progressLeads}%` }}></div>
              </div>
              <span className="percent">{Math.round(progressLeads)}%</span>
            </div>
          </Card>

          <Card className="perf-target-card">
            <div className="target-info">
              <div className="target-label">
                <Wallet size={16} />
                <span>Revenue Target</span>
              </div>
              <div className="target-stats">
                <span className="current">৳{(stats.revenue / 100000).toFixed(1)}L</span>
                <span className="goal">/ {(target.revenue / 100000).toFixed(1)}L</span>
              </div>
            </div>
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-fill indigo" style={{ width: `${progressRevenue}%` }}></div>
              </div>
              <span className="percent">{Math.round(progressRevenue)}%</span>
            </div>
          </Card>

          <Card className="perf-target-card">
            <div className="target-info">
              <div className="target-label">
                <CheckCircle2 size={16} />
                <span>Closed Deals Target</span>
              </div>
              <div className="target-stats">
                <span className="current">{stats.closedDeals}</span>
                <span className="goal">/ {target.closed}</span>
              </div>
            </div>
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-fill green" style={{ width: `${progressClosed}%` }}></div>
              </div>
              <span className="percent">{Math.round(progressClosed)}%</span>
            </div>
          </Card>
        </div>

        <div className="perf-secondary-grid">
          <Card title="Conversion Efficiency" subtitle="Key conversion metrics">
            <div className="kpi-grid">
              <div className="kpi-item">
                <span className="kpi-label">Lead to Visit</span>
                <div className="kpi-value-container">
                  <span className="kpi-value">{stats.totalLeads ? Math.round((stats.visits / stats.totalLeads) * 100) : 0}%</span>
                  <div className="kpi-trend up"><TrendingUp size={12} /> +2%</div>
                </div>
              </div>
              <div className="kpi-item">
                <span className="kpi-label">Visit to Deal</span>
                <div className="kpi-value-container">
                  <span className="kpi-value">{stats.visits ? Math.round((stats.closedDeals / stats.visits) * 100) : 0}%</span>
                  <div className="kpi-trend down"><TrendingUp size={12} /> -1%</div>
                </div>
              </div>
              <div className="kpi-item">
                <span className="kpi-label">Avg. Ticket Size</span>
                <div className="kpi-value-container">
                  <span className="kpi-value">৳{stats.closedDeals ? Math.round(stats.revenue / stats.closedDeals / 1000) : 0}k</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Activity Intensity" subtitle="Engagement levels">
             <div className="intensity-chart">
                <div className="intensity-bars">
                  {[45, 60, 85, 30, 90, 55, 70].map((h, i) => (
                    <div key={i} className="intensity-bar-wrapper">
                      <div className="intensity-bar" style={{ height: `${h}%`, opacity: 0.3 + (h/100) }}></div>
                      <span className="bar-label">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                    </div>
                  ))}
                </div>
             </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderTeamPerformance = () => {
    const totalTeamRevenue = teamData.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalTeamLeads = teamData.reduce((acc, curr) => acc + curr.leads, 0);
    const totalTeamDeals = teamData.reduce((acc, curr) => acc + curr.deals, 0);
    const avgConversion = totalTeamLeads > 0 ? Math.round((totalTeamDeals / totalTeamLeads) * 100) : 0;

    return (
      <div className="team-perf-view">
        <div className="team-stats-summary">
           <Card className="summary-pill">
              <span className="label">Total Team Revenue</span>
              <span className="value">৳{(totalTeamRevenue / 100000).toFixed(2)}L</span>
           </Card>
           <Card className="summary-pill">
              <span className="label">Active Members</span>
              <span className="value">{teamData.length}</span>
           </Card>
           <Card className="summary-pill">
              <span className="label">Average Conversion</span>
              <span className="value">{avgConversion}%</span>
           </Card>
        </div>

        <Card title="Team Leaderboard" subtitle="Revenue-based performance ranking">
          <div className="leaderboard-table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member</th>
                  <th>Leads</th>
                  <th>Deals</th>
                  <th>Revenue</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((member, idx) => (
                  <tr key={idx} className={member.name === currentUser?.name ? 'highlight' : ''}>
                    <td>
                      <div className={`rank-badge ${idx < 3 ? `top-${idx + 1}` : ''}`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td>
                      <div className="member-cell">
                        <div className="member-avatar">{member.name[0]}</div>
                        <span>{member.name}</span>
                      </div>
                    </td>
                    <td>{member.leads}</td>
                    <td>{member.deals}</td>
                    <td>৳{(member.revenue / 100000).toFixed(1)}L</td>
                    <td>
                      <div className="mini-spark-container">
                        <div className="mini-spark-bar" style={{ width: `${(member.revenue / (teamData[0].revenue || 1)) * 100}%` }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="dashboard-header-minimal">
        <div className="tab-pill-container">
          {availableTabs.map(tab => (
            <button 
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <div className="tab-btn-content">
                {{
                  'Overview': LayoutDashboard,
                  'My Performance': TrendingUp,
                  'Team Performance': Users
                }[tab] && React.createElement({
                  'Overview': LayoutDashboard,
                  'My Performance': TrendingUp,
                  'Team Performance': Users
                }[tab], { size: 16 })}
                <span>{tab}</span>
              </div>
              {activeTab === tab && <div className="tab-indicator" />}
            </button>
          ))}
        </div>
      </div>

      <div className="overview-container">
        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'My Performance' && renderPerformance()}
        {activeTab === 'Team Performance' && renderTeamPerformance()}
      </div>

      <CustomerSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </DashboardLayout>
  );
};

export default Overview;
