import React, { useState, useEffect } from 'react';
import SuperAdminLayout from './SuperAdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, Building2, CheckCircle, XCircle, Clock, Users, DollarSign, Calendar, Edit3, Eye, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import './SuperAdminLayout.css';

const STATUS_MAP = { approved: 'approved', pending: 'pending', suspended: 'suspended' };
const PKG_MAP = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };

export default function OrganizationManagement() {
  const [orgs, setOrgs] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    setOrgs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = orgs.filter(o => {
    const matchSearch = !search || o.name?.toLowerCase().includes(search.toLowerCase()) || o.domain?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('organizations').update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    }).eq('id', id);
    if (!error) setOrgs(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const openEdit = (org) => {
    setSelected(org);
    setEditForm({
      name: org.name,
      billing_package: org.billing_package || 'starter',
      billing_status: org.billing_status || 'active',
      billing_amount: org.billing_amount || '',
      next_due_date: org.next_due_date ? org.next_due_date.split('T')[0] : '',
      max_users: org.max_users || 10,
    });
    setShowModal(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from('organizations').update(editForm).eq('id', selected.id);
    if (!error) {
      setOrgs(prev => prev.map(o => o.id === selected.id ? { ...o, ...editForm } : o));
      setShowModal(false);
    }
    setSaving(false);
  };

  const statCounts = {
    all: orgs.length,
    approved: orgs.filter(o => o.status === 'approved').length,
    pending: orgs.filter(o => o.status === 'pending').length,
    suspended: orgs.filter(o => o.status === 'suspended').length,
  };

  return (
    <SuperAdminLayout>
      <div className="sa-page-header">
        <div>
          <h1 className="sa-page-title">Organization Management</h1>
          <p className="sa-page-subtitle">Manage all registered organizations, billing, and access</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'All', key: 'all', color: 'var(--primary)' },
          { label: 'Approved', key: 'approved', color: '#10B981' },
          { label: 'Pending', key: 'pending', color: '#F59E0B' },
          { label: 'Suspended', key: 'suspended', color: '#EF4444' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            style={{
              background: statusFilter === s.key ? (s.key === 'all' ? 'var(--primary-soft)' : `rgba(${s.key === 'approved' ? '16,185,129' : s.key === 'pending' ? '245,158,11' : '239,68,68'},0.15)`) : 'rgba(255,255,255,0.04)',
              border: `1px solid ${statusFilter === s.key ? (s.key === 'all' ? 'var(--primary-border)' : s.color + '40') : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '8px 16px', cursor: 'pointer', color: statusFilter === s.key ? s.color : '#6B7280',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            {s.label} <span style={{ marginLeft: 6, opacity: 0.7 }}>{statCounts[s.key]}</span>
          </button>
        ))}
      </div>

      <div className="sa-table-wrap">
        <div className="sa-table-head-bar">
          <div className="sa-search">
            <Search size={15} color="#4B5563" />
            <input placeholder="Search organizations..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="sa-empty"><div style={{ color: '#6B7280', fontSize: 14 }}>Loading...</div></div>
        ) : filtered.length === 0 ? (
          <div className="sa-empty">
            <div className="sa-empty-icon">🏢</div>
            <h3>No organizations found</h3>
            <p>Organizations registered via the Book Demo form will appear here</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Package</th>
                  <th>Users</th>
                  <th>Payment</th>
                  <th>Next Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(org => (
                  <tr key={org.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#F9FAFB', fontSize: 13.5 }}>{org.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--primary)', fontFamily: 'monospace', marginTop: 2 }}>{org.domain || '—'}</div>
                    </td>
                    <td>
                      <span className={`sa-badge sa-badge-${org.status || 'pending'}`}>
                        {org.status === 'approved' ? <CheckCircle size={11} /> : org.status === 'pending' ? <Clock size={11} /> : <XCircle size={11} />}
                        {org.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`sa-badge sa-badge-${org.billing_package === 'professional' ? 'pro' : (org.billing_package || 'starter')}`}>
                        {PKG_MAP[org.billing_package] || 'Starter'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#D1D5DB', fontSize: 13 }}>
                        <Users size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {org.current_users || 0}/{org.max_users || 10}
                      </span>
                    </td>
                    <td>
                      <span className={`sa-badge sa-badge-${org.billing_status === 'overdue' ? 'overdue' : 'active'}`}>
                        {org.billing_status || 'active'}
                      </span>
                    </td>
                    <td style={{ color: '#9CA3AF', fontSize: 12.5 }}>
                      {org.next_due_date ? new Date(org.next_due_date).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {org.status === 'pending' && (
                          <button className="sa-btn sa-btn-success" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => updateStatus(org.id, 'approved')}>
                            Approve
                          </button>
                        )}
                        {org.status === 'approved' && (
                          <button className="sa-btn sa-btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => updateStatus(org.id, 'suspended')}>
                            Suspend
                          </button>
                        )}
                        {org.status === 'suspended' && (
                          <button className="sa-btn sa-btn-success" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => updateStatus(org.id, 'approved')}>
                            Restore
                          </button>
                        )}
                        <button className="sa-btn sa-btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => openEdit(org)}>
                          <Edit3 size={13} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#12121f', border: '1px solid var(--primary-border)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480 }}>
            <h3 style={{ color: '#F9FAFB', margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>Edit — {selected.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Organization Name', key: 'name', type: 'text' },
                { label: 'Max Users', key: 'max_users', type: 'number' },
                { label: 'Billing Amount ($)', key: 'billing_amount', type: 'number' },
                { label: 'Next Due Date', key: 'next_due_date', type: 'date' },
              ].map(f => (
                <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: '#9CA3AF', fontWeight: 500 }}>{f.label}</span>
                  <input
                    type={f.type}
                    value={editForm[f.key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '9px 14px', color: '#F9FAFB', fontSize: 13.5, outline: 'none' }}
                  />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: '#9CA3AF', fontWeight: 500 }}>Billing Package</span>
                <select value={editForm.billing_package} onChange={e => setEditForm(p => ({ ...p, billing_package: e.target.value }))}
                  style={{ background: '#1a1a2e', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '9px 14px', color: '#F9FAFB', fontSize: 13.5 }}>
                  <option value="starter">Starter ($49/mo)</option>
                  <option value="professional">Professional ($99/mo)</option>
                  <option value="enterprise">Enterprise ($199/mo)</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: '#9CA3AF', fontWeight: 500 }}>Billing Status</span>
                <select value={editForm.billing_status} onChange={e => setEditForm(p => ({ ...p, billing_status: e.target.value }))}
                  style={{ background: '#1a1a2e', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '9px 14px', color: '#F9FAFB', fontSize: 13.5 }}>
                  <option value="active">Active</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="sa-btn sa-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="sa-btn sa-btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
