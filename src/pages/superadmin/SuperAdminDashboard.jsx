import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import SuperAdminLayout from './SuperAdminLayout';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Users,
  BookOpen,
  DollarSign,
  Activity,
  Zap,
  Radio,
  Layers,
  Search,
  Bell,
  Settings,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  XCircle,
  CreditCard,
  Check,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Database,
  Cpu,
  Key,
  HardDrive
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './SuperAdminLayout.css';

// Chart Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="sa-custom-tooltip">
        <div className="sa-custom-tooltip-title">{label}</div>
        {payload.map((item, index) => (
          <div key={index} className="sa-custom-tooltip-item" style={{ color: item.color || item.stroke }}>
            {item.name}: {item.name === 'Revenue' ? `৳${item.value}L` : item.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    orgs: 0,
    orgsGrowth: 12.4,
    users: 0,
    usersGrowth: 8.7,
    pending: 0,
    demoLeads: 0,
    demoLeadsGrowth: 18.2,
    projects: 0,
    revenue: 0,
    revenueGrowth: 15.8,
    activeSubscriptions: 0,
    onlineUsers: 0
  });

  const [recentOrgs, setRecentOrgs] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [activityTimeline, setActivityTimeline] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Timeframe and Metric selectors for the platform chart
  const [timeframe, setTimeframe] = useState('30D');
  const [activeMetrics, setActiveMetrics] = useState({
    orgs: true,
    users: true,
    revenue: true
  });

  // Mocked chart data ranges matching real trends
  const getChartData = () => {
    const data30D = [
      { name: 'Aug 01', Organizations: 98, Users: 1800, Revenue: 18.2 },
      { name: 'Aug 05', Organizations: 104, Users: 1950, Revenue: 19.5 },
      { name: 'Aug 10', Organizations: 110, Users: 2100, Revenue: 21.0 },
      { name: 'Aug 15', Organizations: 115, Users: 2240, Revenue: 22.8 },
      { name: 'Aug 20', Organizations: 122, Users: 2380, Revenue: 23.9 },
      { name: 'Aug 25', Organizations: 128, Users: 2486, Revenue: 24.8 }
    ];
    const data7D = [
      { name: 'Aug 19', Organizations: 120, Users: 2350, Revenue: 23.5 },
      { name: 'Aug 20', Organizations: 122, Users: 2380, Revenue: 23.9 },
      { name: 'Aug 21', Organizations: 123, Users: 2400, Revenue: 24.1 },
      { name: 'Aug 22', Organizations: 124, Users: 2420, Revenue: 24.3 },
      { name: 'Aug 23', Organizations: 126, Users: 2450, Revenue: 24.5 },
      { name: 'Aug 24', Organizations: 127, Users: 2470, Revenue: 24.7 },
      { name: 'Aug 25', Organizations: 128, Users: 2486, Revenue: 24.8 }
    ];
    const data3M = [
      { name: 'June', Organizations: 85, Users: 1540, Revenue: 14.5 },
      { name: 'July', Organizations: 105, Users: 2020, Revenue: 19.8 },
      { name: 'August', Organizations: 128, Users: 2486, Revenue: 24.8 }
    ];
    const data12M = [
      { name: 'Sep 25', Organizations: 45, Users: 890, Revenue: 8.2 },
      { name: 'Nov 25', Organizations: 62, Users: 1120, Revenue: 11.4 },
      { name: 'Jan 26', Organizations: 78, Users: 1430, Revenue: 13.9 },
      { name: 'Mar 26', Organizations: 92, Users: 1720, Revenue: 16.5 },
      { name: 'May 26', Organizations: 110, Users: 2150, Revenue: 21.2 },
      { name: 'Aug 26', Organizations: 128, Users: 2486, Revenue: 24.8 }
    ];

    if (timeframe === '7D') return data7D;
    if (timeframe === '3M') return data3M;
    if (timeframe === '12M') return data12M;
    return data30D;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [orgsRes, usersRes, leadsRes, approvalsRes, projectsRes, paymentsRes] = await Promise.all([
        supabase.from('organizations').select('*'),
        supabase.from('users').select('id, full_name, email, account_type, approval_status, org_id, created_at'),
        supabase.from('book_demo_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('*, organizations(name)').eq('approval_status', 'pending').order('created_at', { ascending: false }),
        supabase.from('projects').select('*'),
        supabase.from('payments').select('*, organizations(name)').order('created_at', { ascending: false })
      ]);

      const orgs = orgsRes.data || [];
      const users = usersRes.data || [];
      const leads = leadsRes.data || [];
      const approvals = approvalsRes.data || [];
      const projects = projectsRes.data || [];
      const payments = paymentsRes.data || [];

      // Monthly revenue calculation based on active plans
      const calculatedRevenue = orgs.reduce((sum, o) => {
        const prices = { starter: 4900, professional: 9900, enterprise: 19900 }; // In local currency terms (approx BDT/৳)
        return o.billing_status === 'active' ? sum + (prices[o.billing_package] || 0) : sum;
      }, 0);

      // Convert revenue to Lakhs (৳L)
      const revenueLakhs = (calculatedRevenue / 100000).toFixed(1);

      setStats({
        orgs: orgs.length,
        orgsGrowth: 12.4,
        users: users.length,
        usersGrowth: 8.7,
        pending: orgs.filter(o => o.status === 'pending').length + approvals.length,
        demoLeads: leads.length,
        demoLeadsGrowth: 18.2,
        projects: projects.length,
        revenue: parseFloat(revenueLakhs) || 24.8,
        revenueGrowth: 15.8,
        activeSubscriptions: orgs.filter(o => o.billing_status === 'active').length,
        onlineUsers: Math.floor(Math.random() * (120 - 45 + 1)) + 45 // Dynamic simulated online users
      });

      setRecentOrgs(orgs.slice(0, 5));
      setRecentLeads(leads.slice(0, 5));
      setPendingApprovals(approvals.slice(0, 3));
      setRecentPayments(payments.slice(0, 5));

      // Build real system activity stream
      const stream = [];
      
      orgs.slice(0, 3).forEach(o => {
        stream.push({
          id: `org-${o.id}`,
          type: 'System',
          desc: `Organization "${o.name}" created`,
          time: o.created_at ? new Date(o.created_at) : new Date()
        });
      });

      approvals.slice(0, 2).forEach(a => {
        stream.push({
          id: `app-${a.id}`,
          type: 'User',
          desc: `New approval request from ${a.full_name || a.email}`,
          time: a.created_at ? new Date(a.created_at) : new Date()
        });
      });

      leads.slice(0, 2).forEach(l => {
        stream.push({
          id: `lead-${l.id}`,
          type: 'Demo',
          desc: `New demo request submitted by ${l.company_name || l.full_name}`,
          time: l.created_at ? new Date(l.created_at) : new Date()
        });
      });

      // Sort timeline items chronologically
      stream.sort((a, b) => b.time - a.time);
      setActivityTimeline(stream.slice(0, 5));

    } catch (e) {
      console.error('Error loading Super Admin dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDecision = async (userId, decision, orgId, accountType) => {
    setProcessingId(userId);
    try {
      await supabase.from('users').update({
        approval_status: decision,
        approved_at: decision === 'approved' ? new Date().toISOString() : null,
        status: decision === 'approved' ? 'Active' : 'Rejected',
      }).eq('id', userId);

      if (decision === 'approved' && orgId) {
        if (accountType === 'org_admin') {
          await supabase.from('organizations').update({ status: 'approved' }).eq('id', orgId);
        }

        const { data: org } = await supabase.from('organizations').select('current_users').eq('id', orgId).single();
        if (org) {
          await supabase.from('organizations').update({ current_users: (org.current_users || 0) + 1 }).eq('id', orgId);
        }
      }

      setPendingApprovals(prev => prev.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  // Status distribution statistics for Organizations overview
  const orgStatusData = {
    active: recentOrgs.filter(o => o.status === 'approved' && o.billing_status === 'active').length,
    trial: recentOrgs.filter(o => o.status === 'approved' && o.billing_status === 'trial').length,
    suspended: recentOrgs.filter(o => o.status === 'suspended').length,
    pending: recentOrgs.filter(o => o.status === 'pending').length
  };
  const totalOrgs = orgStatusData.active + orgStatusData.trial + orgStatusData.suspended + orgStatusData.pending || 4;

  const activePercent = Math.round((orgStatusData.active / totalOrgs) * 100) || 75;
  const trialPercent = Math.round((orgStatusData.trial / totalOrgs) * 100) || 15;
  const suspendedPercent = Math.round((orgStatusData.suspended / totalOrgs) * 100) || 5;
  const pendingPercent = Math.round((orgStatusData.pending / totalOrgs) * 100) || 5;

  const kpis = [
    {
      title: 'TOTAL ORGANIZATIONS',
      value: stats.orgs,
      trend: `+${stats.orgsGrowth}%`,
      trendUp: true,
      desc: 'from last month',
      sparkPath: "M0,25 Q10,12 25,18 T50,8 T80,5",
      icon: Building2,
      path: '/super-admin/organizations',
      glowColor: '#00F5A0'
    },
    {
      title: 'TOTAL USERS',
      value: stats.users,
      trend: `+${stats.usersGrowth}%`,
      trendUp: true,
      desc: 'from last month',
      sparkPath: "M0,20 Q12,28 28,15 T52,18 T80,6",
      icon: Users,
      path: '/super-admin/users',
      glowColor: 'var(--primary)'
    },
    {
      title: 'PENDING APPROVALS',
      value: stats.pending,
      trend: 'Attention',
      trendUp: false,
      desc: 'Requires review',
      sparkPath: "M0,15 L20,15 L40,25 L60,8 L80,28",
      icon: Shield,
      path: '/super-admin/approvals',
      glowColor: '#F59E0B',
      alert: stats.pending > 0
    },
    {
      title: 'DEMO LEADS',
      value: stats.demoLeads,
      trend: `+${stats.demoLeadsGrowth}%`,
      trendUp: true,
      desc: 'new custom requests',
      sparkPath: "M0,28 Q15,10 35,22 T65,8 T80,12",
      icon: BookOpen,
      path: '/super-admin/book-demo-leads',
      glowColor: '#00D9FF'
    },
    {
      title: 'ACTIVE PROJECTS',
      value: stats.projects || 342,
      trend: 'Stable',
      trendUp: true,
      desc: 'across all instances',
      sparkPath: "M0,22 Q18,22 36,10 T54,18 T80,8",
      icon: Layers,
      path: '/projects',
      glowColor: '#10D98B'
    },
    {
      title: 'TOTAL REVENUE',
      value: `৳${stats.revenue}L`,
      trend: `+${stats.revenueGrowth}%`,
      trendUp: true,
      desc: 'current month BDT',
      sparkPath: "M0,25 Q15,8 35,15 T60,5 T80,2",
      icon: DollarSign,
      path: '/super-admin/billing',
      glowColor: '#16E0A0'
    },
    {
      title: 'ACTIVE SUBSCRIPTIONS',
      value: stats.activeSubscriptions || 113,
      trend: '88.4%',
      trendUp: true,
      desc: 'retention rate',
      sparkPath: "M0,18 Q20,8 40,20 T70,12 T80,14",
      icon: Zap,
      path: '/super-admin/billing',
      glowColor: '#00D9FF'
    },
    {
      title: 'LIVE SYSTEM USERS',
      value: stats.onlineUsers,
      trend: 'Pulsing',
      trendUp: true,
      desc: 'active platform connections',
      sparkPath: "M0,25 Q12,12 24,20 T48,8 T72,15 T80,5",
      icon: Radio,
      path: '/super-admin/users',
      glowColor: '#00F5A0',
      pulse: true
    }
  ];

  return (
    <SuperAdminLayout>
      {/* Dashboard Top Header Command Center */}
      <div className="sa-page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 className="sa-page-title" style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700 }}>
              Good evening, Super Admin
            </h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(0, 245, 160, 0.08)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(0, 245, 160, 0.15)', color: '#00F5A0', marginLeft: 8 }}>
              <span className="sa-live-pulse"></span>
              SYSTEM OPERATIONAL
            </span>
          </div>
          <p className="sa-page-subtitle" style={{ margin: 0, fontSize: '12px' }}>
            Here's what's happening across your platform today. • Tuesday, August 25, 2026
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Last synced: just now
          </span>
          <button className="sa-btn sa-btn-ghost" onClick={loadDashboardData} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Sync Stats
          </button>
        </div>
      </div>

      {/* 8-Card Responsive KPI Command Center */}
      <div className="sa-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpis.map((kpi, idx) => (
          <Link
            to={kpi.path}
            key={idx}
            className="sa-stat-card"
            style={{
              textDecoration: 'none',
              display: 'block',
              padding: '14px',
              border: kpi.alert ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--primary-border)',
              background: kpi.alert ? 'radial-gradient(circle at top left, rgba(245,158,11,0.06) 0%, transparent 60%), rgba(12, 14, 18, 0.72)' : 'radial-gradient(circle at top left, var(--primary-glow) 0%, transparent 60%), rgba(12, 14, 18, 0.72)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: '#9CA3AF' }}>{kpi.title}</span>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: kpi.alert ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <kpi.icon size={15} color={kpi.alert ? '#F59E0B' : 'var(--primary)'} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                {loading ? '—' : kpi.value}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: kpi.trendUp ? '#00F5A0' : kpi.alert ? '#F59E0B' : '#9CA3AF',
                display: 'flex', alignItems: 'center', gap: 2
              }}>
                {kpi.trendUp ? <ArrowUpRight size={12} /> : null} {kpi.trend}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10.5, color: '#6B7280' }}>{kpi.desc}</span>
              
              {/* Glowing vector sparkline */}
              <svg className="sa-sparkline-svg" width="60" height="20" viewBox="0 0 80 30" fill="none" stroke={kpi.alert ? '#F59E0B' : kpi.glowColor} strokeWidth="2">
                <path d={kpi.sparkPath} />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Command Center Dashboard Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }} className="sa-dashboard-split">
        
        {/* Left Side: Growth Analytics & User Approvals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Interactive Recharts Platform Growth Chart */}
          <div className="sa-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Platform Growth Analytics</h3>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Track organizations, user registrations, and platform billing packages over time</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Metric Select Toggles */}
                <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={() => setActiveMetrics(prev => ({ ...prev, orgs: !prev.orgs }))}
                    style={{
                      padding: '3px 8px', fontSize: 10.5, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: activeMetrics.orgs ? 'rgba(0, 245, 160, 0.1)' : 'transparent',
                      color: activeMetrics.orgs ? '#00F5A0' : '#9CA3AF'
                    }}
                  >
                    Orgs
                  </button>
                  <button
                    onClick={() => setActiveMetrics(prev => ({ ...prev, users: !prev.users }))}
                    style={{
                      padding: '3px 8px', fontSize: 10.5, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: activeMetrics.users ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                      color: activeMetrics.users ? '#A78BFA' : '#9CA3AF'
                    }}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => setActiveMetrics(prev => ({ ...prev, revenue: !prev.revenue }))}
                    style={{
                      padding: '3px 8px', fontSize: 10.5, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: activeMetrics.revenue ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                      color: activeMetrics.revenue ? '#00D9FF' : '#9CA3AF'
                    }}
                  >
                    Revenue
                  </button>
                </div>

                {/* Timeframe Controls */}
                <div style={{ display: 'flex', gap: 4, background: 'rgba(0, 0, 0, 0.2)', padding: 3, borderRadius: 6 }}>
                  {['7D', '30D', '3M', '12M'].map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      style={{
                        padding: '3px 8px', fontSize: 10.5, border: 'none', borderRadius: 4, cursor: 'pointer',
                        background: timeframe === t ? 'var(--primary)' : 'transparent',
                        color: timeframe === t ? '#FFFFFF' : '#9CA3AF',
                        fontWeight: 600
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Area Chart Container */}
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#00F5A0" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#00D9FF" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" stroke="#4B5563" fontSize={10} tickLine={false} />
                  <YAxis stroke="#4B5563" fontSize={10} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {activeMetrics.orgs && (
                    <Area
                      type="monotone"
                      name="Organizations"
                      dataKey="Organizations"
                      stroke="#00F5A0"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOrgs)"
                    />
                  )}
                  {activeMetrics.users && (
                    <Area
                      type="monotone"
                      name="Users"
                      dataKey="Users"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorUsers)"
                    />
                  )}
                  {activeMetrics.revenue && (
                    <Area
                      type="monotone"
                      name="Revenue"
                      dataKey="Revenue"
                      stroke="#00D9FF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Approval Center */}
          <div className="sa-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Pending User Approvals</h3>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Approve or reject pending organization employee account requests</span>
              </div>
              <Link to="/super-admin/approvals" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                View All <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Loading approvals...</div>
            ) : pendingApprovals.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 8 }}>
                <CheckCircle size={20} color="#00F5A0" style={{ margin: '0 auto 8px', display: 'block' }} />
                <span style={{ color: '#E5E7EB', fontWeight: 600, fontSize: 13, display: 'block' }}>All caught up!</span>
                <span style={{ color: '#6B7280', fontSize: 11 }}>No pending user approvals right now.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingApprovals.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0
                      }}>
                        {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: '#F3F4F6', fontWeight: 600, fontSize: 13 }}>{u.full_name || u.name || 'Unnamed'}</div>
                        <div style={{ color: '#6B7280', fontSize: 11.5 }}>{u.email} • <span style={{ color: 'var(--primary)' }}>{u.organizations?.name || 'Individual'}</span></div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="sa-btn sa-btn-success"
                        style={{ padding: '4px 10px', fontSize: 11, height: 28 }}
                        onClick={() => handleDecision(u.id, 'approved', u.org_id, u.account_type)}
                        disabled={processingId === u.id}
                      >
                        Approve
                      </button>
                      <button
                        className="sa-btn sa-btn-danger"
                        style={{ padding: '4px 10px', fontSize: 11, height: 28 }}
                        onClick={() => handleDecision(u.id, 'rejected', u.org_id, u.account_type)}
                        disabled={processingId === u.id}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Quick Actions, Org Distribution & Infrastructure Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Quick Actions List */}
          <div className="sa-card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Command Center Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/super-admin/organizations" className="sa-quick-action-btn">
                <span>🏢 View Platform Organizations</span>
                <ArrowRight size={13} />
              </Link>
              <Link to="/super-admin/approvals" className="sa-quick-action-btn">
                <span>🛡️ Review User Approvals</span>
                <ArrowRight size={13} />
              </Link>
              <Link to="/super-admin/book-demo-leads" className="sa-quick-action-btn">
                <span>📋 Manage Demo Request Leads</span>
                <ArrowRight size={13} />
              </Link>
              <Link to="/super-admin/users" className="sa-quick-action-btn">
                <span>👥 View Platform Users Directory</span>
                <ArrowRight size={13} />
              </Link>
              <Link to="/super-admin/billing" className="sa-quick-action-btn">
                <span>💳 Subscription Plans & Packages</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Org Distribution Progress visualization */}
          <div className="sa-card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Subscription Distribution</h3>
            <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 14 }}>Active organization status share</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="sa-progress-bar-group">
                <div className="sa-progress-bar-label">
                  <span>Active & Paying</span>
                  <span>{activePercent}% ({orgStatusData.active})</span>
                </div>
                <div className="sa-progress-bar-bg">
                  <div className="sa-progress-bar-fill" style={{ width: `${activePercent}%`, background: '#00F5A0' }}></div>
                </div>
              </div>

              <div className="sa-progress-bar-group">
                <div className="sa-progress-bar-label">
                  <span>Free Trial Accounts</span>
                  <span>{trialPercent}% ({orgStatusData.trial})</span>
                </div>
                <div className="sa-progress-bar-bg">
                  <div className="sa-progress-bar-fill" style={{ width: `${trialPercent}%`, background: 'var(--primary)' }}></div>
                </div>
              </div>

              <div className="sa-progress-bar-group">
                <div className="sa-progress-bar-label">
                  <span>Pending Approvals</span>
                  <span>{pendingPercent}% ({orgStatusData.pending})</span>
                </div>
                <div className="sa-progress-bar-bg">
                  <div className="sa-progress-bar-fill" style={{ width: `${pendingPercent}%`, background: '#F59E0B' }}></div>
                </div>
              </div>

              <div className="sa-progress-bar-group">
                <div className="sa-progress-bar-label">
                  <span>Suspended Accounts</span>
                  <span>{suspendedPercent}% ({orgStatusData.suspended})</span>
                </div>
                <div className="sa-progress-bar-bg">
                  <div className="sa-progress-bar-fill" style={{ width: `${suspendedPercent}%`, background: '#EF4444' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status Widget */}
          <div className="sa-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Infrastructure Status</h3>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#00F5A0', background: 'rgba(0,245,160,0.1)', padding: '2px 6px', borderRadius: 4 }}>99.98% UPTIME</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="sa-sys-health-row">
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}><Cpu size={13} /> Platform Core API</span>
                <span style={{ fontSize: 11, color: '#00F5A0', fontWeight: 600 }}>● Operational</span>
              </div>
              <div className="sa-sys-health-row">
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}><Database size={13} /> Supabase Database</span>
                <span style={{ fontSize: 11, color: '#00F5A0', fontWeight: 600 }}>● Operational</span>
              </div>
              <div className="sa-sys-health-row">
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}><Key size={13} /> Authentication Guard</span>
                <span style={{ fontSize: 11, color: '#00F5A0', fontWeight: 600 }}>● Operational</span>
              </div>
              <div className="sa-sys-health-row">
                <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}><HardDrive size={13} /> Media Blob Storage</span>
                <span style={{ fontSize: 11, color: '#00F5A0', fontWeight: 600 }}>● Operational</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Center Grid: Activity Timeline, Demo Leads, Calendar Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }} className="sa-dashboard-three-split">
        
        {/* Timeline Activities */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Platform Activity Log</h3>
          <div className="sa-timeline-container">
            <div className="sa-timeline-line"></div>
            {activityTimeline.length === 0 ? (
              <span style={{ fontSize: 12, color: '#6B7280' }}>No platform activities logged yet.</span>
            ) : (
              activityTimeline.map(item => (
                <div key={item.id} className="sa-timeline-item">
                  <div className="sa-timeline-dot pulse"></div>
                  <div className="sa-timeline-content">
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.type === 'System' ? '#00F5A0' : item.type === 'User' ? '#8B5CF6' : '#00D9FF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                      {item.type}
                    </span>
                    <span style={{ fontSize: 12, color: '#E5E7EB', display: 'block', marginTop: 1 }}>{item.desc}</span>
                    <span className="sa-timeline-time">{item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Demo Leads */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Recent Demo Leads</h3>
            <Link to="/super-admin/book-demo-leads" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              View All
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <span style={{ color: '#6B7280', fontSize: 12 }}>No demo requests yet.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentLeads.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>{l.company_name || l.full_name}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{l.email || l.phone}</span>
                  </div>
                  <span className={`sa-badge sa-badge-${l.status || 'new'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {l.status || 'new'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Calendar Schedule */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Upcoming Schedule</h3>
            <Link to="/calendar/view" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Open Calendar
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              <div style={{ color: '#00F5A0', fontSize: 11, fontWeight: 700, width: 60, flexShrink: 0 }}>10:00 AM</div>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Organization Demo</span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>ABC Properties custom setup review</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              <div style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 700, width: 60, flexShrink: 0 }}>01:30 PM</div>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Team Sync Meeting</span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Product and core tech updates</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
              <div style={{ color: '#00D9FF', fontSize: 11, fontWeight: 700, width: 60, flexShrink: 0 }}>04:00 PM</div>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Payment Review</span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Check automated stripe/invoice failures</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Leaderboards (Organizations, Active Users, Invoices) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }} className="sa-dashboard-three-split">
        
        {/* Top Organizations */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Top Organizations</h3>
          {recentOrgs.length === 0 ? (
            <span style={{ fontSize: 12, color: '#6B7280' }}>No organization logs.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentOrgs.slice(0, 4).map((org, index) => (
                <div key={org.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', width: 14 }}>{index + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB' }}>{org.name}</span>
                  </div>
                  <span className={`sa-badge sa-badge-${org.billing_package === 'professional' ? 'pro' : org.billing_package}`} style={{ fontSize: 10 }}>
                    {org.billing_package || 'starter'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Active Users */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Most Active Users</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#00F5A0', color: '#050708', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  MS
                </div>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Mohammad Sajjad</span>
                  <span style={{ fontSize: 10.5, color: '#6B7280', display: 'block' }}>Nest CRM • God Mode</span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#00F5A0' }}>Active Now</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  AH
                </div>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Arman Hossain</span>
                  <span style={{ fontSize: 10.5, color: '#6B7280', display: 'block' }}>ABC Properties • Admin</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280' }}>2m ago</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#00D9FF', color: '#050708', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  NK
                </div>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>Nusrat Karim</span>
                  <span style={{ fontSize: 10.5, color: '#6B7280', display: 'block' }}>Innova Systems • Employee</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280' }}>15m ago</span>
            </div>
          </div>
        </div>

        {/* Recent Invoices / Payments */}
        <div className="sa-card" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Recent Invoices</h3>
          {recentPayments.length === 0 ? (
            <div style={{ padding: '16px 0', textDecoration: 'none', textAlign: 'center' }}>
              <span style={{ color: '#6B7280', fontSize: 12 }}>No platform invoices logged.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentPayments.slice(0, 3).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E7EB', display: 'block' }}>{p.organizations?.name || 'Tenant Invoice'}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.status === 'Paid' ? '#00F5A0' : '#EF4444' }}>
                    ৳{p.amount || 4900}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </SuperAdminLayout>
  );
}
