import React, { useState, useEffect } from 'react';
import SuperAdminLayout from './SuperAdminLayout';
import { supabase } from '../../lib/supabase';
import { Building2, Users, BookOpen, CheckSquare, TrendingUp, DollarSign, Clock, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import './SuperAdminLayout.css';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ orgs: 0, pending: 0, users: 0, demoLeads: 0, approvals: 0, revenue: 0 });
  const [recentOrgs, setRecentOrgs] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [orgsRes, usersRes, leadsRes, approvalsRes] = await Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('users').select('id, account_type'),
      supabase.from('book_demo_leads').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('users').select('id').eq('approval_status', 'pending'),
    ]);

    const orgs = orgsRes.data || [];
    const users = usersRes.data || [];
    const leads = leadsRes.data || [];
    const approvals = approvalsRes.data || [];

    const revenue = orgs.reduce((sum, o) => {
      const prices = { starter: 49, professional: 99, enterprise: 199 };
      return o.billing_status === 'active' ? sum + (prices[o.billing_package] || 0) : sum;
    }, 0);

    setStats({
      orgs: orgs.length,
      pending: orgs.filter(o => o.status === 'pending').length,
      users: users.length,
      demoLeads: leads.length,
      approvals: approvals.length,
      revenue,
    });
    setRecentOrgs(orgs.slice(0, 5));
    setRecentLeads(leads);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statCards = [
    { label: 'Total Organizations', value: stats.orgs, icon: Building2, color: 'var(--primary)', bg: 'var(--primary-soft)', path: '/super-admin/organizations' },
    { label: 'Pending Approvals', value: stats.pending + stats.approvals, icon: AlertCircle, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', path: '/super-admin/approvals' },
    { label: 'Total Users', value: stats.users, icon: Users, color: '#10B981', bg: 'rgba(16,185,129,0.12)', path: '/super-admin/users' },
    { label: 'Demo Leads', value: stats.demoLeads, icon: BookOpen, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', path: '/super-admin/book-demo-leads' },
    { label: 'Monthly Revenue', value: `$${stats.revenue}`, icon: DollarSign, color: '#34D399', bg: 'rgba(16,185,129,0.12)', path: '/super-admin/billing' },
  ];

  return (
    <SuperAdminLayout>
      <div className="sa-page-header">
        <div>
          <h1 className="sa-page-title">Super Admin Dashboard</h1>
          <p className="sa-page-subtitle">Full platform overview — Nest CRM control center</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="sa-stat-grid">
        {statCards.map(card => (
          <Link to={card.path} key={card.label} className="sa-stat-card" style={{ textDecoration: 'none' }}>
            <div className="sa-stat-icon" style={{ background: card.bg }}>
              <card.icon size={22} color={card.color} />
            </div>
            <div>
              <div className="sa-stat-value" style={{ color: card.color }}>{loading ? '—' : card.value}</div>
              <div className="sa-stat-label">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Organizations */}
        <div className="sa-table-wrap">
          <div className="sa-table-head-bar">
            <span style={{ color: '#E5E7EB', fontWeight: 600, fontSize: 14 }}>Recent Organizations</span>
            <Link to="/super-admin/organizations" className="sa-btn sa-btn-ghost" style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}>
              View All <ArrowRight size={13} />
            </Link>
          </div>
          {recentOrgs.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">🏢</div><h3>No organizations yet</h3></div>
          ) : (
            <table className="sa-table">
              <thead><tr><th>Organization</th><th>Status</th><th>Package</th></tr></thead>
              <tbody>
                {recentOrgs.map(org => (
                  <tr key={org.id}>
                    <td style={{ color: '#F9FAFB', fontWeight: 500 }}>{org.name}</td>
                    <td><span className={`sa-badge sa-badge-${org.status}`}>{org.status}</span></td>
                    <td><span className={`sa-badge sa-badge-${org.billing_package === 'professional' ? 'pro' : org.billing_package}`}>{org.billing_package || 'starter'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Demo Leads */}
        <div className="sa-table-wrap">
          <div className="sa-table-head-bar">
            <span style={{ color: '#E5E7EB', fontWeight: 600, fontSize: 14 }}>Recent Demo Leads</span>
            <Link to="/super-admin/book-demo-leads" className="sa-btn sa-btn-ghost" style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}>
              View All <ArrowRight size={13} />
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <div className="sa-empty"><div className="sa-empty-icon">📋</div><h3>No demo leads yet</h3></div>
          ) : (
            <table className="sa-table">
              <thead><tr><th>Company</th><th>Domain</th><th>Status</th></tr></thead>
              <tbody>
                {recentLeads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ color: '#F9FAFB', fontWeight: 500 }}>{lead.company_name || lead.full_name}</td>
                    <td style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12 }}>{lead.custom_domain_requested || '—'}</td>
                    <td><span className={`sa-badge sa-badge-${lead.status || 'new'}`}>{lead.status || 'new'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
