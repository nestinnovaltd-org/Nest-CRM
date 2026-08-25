import React, { useState, useEffect } from 'react';
import SuperAdminLayout from './SuperAdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, CheckCircle, XCircle, Clock, RefreshCw, Building2, User } from 'lucide-react';
import './SuperAdminLayout.css';

export default function UserApprovals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*, organizations(name)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    setPending(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDecision = async (userId, decision, orgId) => {
    setProcessing(userId);
    await supabase.from('users').update({
      approval_status: decision,
      approved_at: decision === 'approved' ? new Date().toISOString() : null,
      status: decision === 'approved' ? 'Active' : 'Rejected',
    }).eq('id', userId);

    if (decision === 'approved' && orgId) {
      // Increment org user count
      const { data: org } = await supabase.from('organizations').select('current_users').eq('id', orgId).single();
      if (org) {
        await supabase.from('organizations').update({ current_users: (org.current_users || 0) + 1 }).eq('id', orgId);
      }
    }

    setPending(prev => prev.filter(u => u.id !== userId));
    setProcessing(null);
  };

  return (
    <SuperAdminLayout>
      <div className="sa-page-header">
        <div>
          <h1 className="sa-page-title">User Approvals</h1>
          <p className="sa-page-subtitle">Pending user account requests waiting for your approval</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Counter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} color="#FBBF24" />
          <span style={{ color: '#FBBF24', fontWeight: 700, fontSize: 18 }}>{pending.length}</span>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>pending requests</span>
        </div>
      </div>

      <div className="sa-table-wrap">
        {loading ? (
          <div className="sa-empty"><span style={{ color: '#6B7280' }}>Loading...</span></div>
        ) : pending.length === 0 ? (
          <div className="sa-empty">
            <div className="sa-empty-icon">✅</div>
            <h3>All caught up!</h3>
            <p>No pending user approval requests at the moment.</p>
          </div>
        ) : (
          <table className="sa-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Account Type</th>
                <th>Organization</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0
                      }}>
                        {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: '#F9FAFB', fontWeight: 600, fontSize: 13.5 }}>{u.full_name || u.name || 'Unnamed'}</div>
                        <div style={{ color: '#6B7280', fontSize: 12 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`sa-badge ${u.account_type === 'org_employee' ? 'sa-badge-pending' : 'sa-badge-new'}`}>
                      {u.account_type === 'org_employee' ? <Building2 size={11} /> : <User size={11} />}
                      {u.account_type === 'org_employee' ? 'Org Employee' : u.account_type || 'Individual'}
                    </span>
                  </td>
                  <td style={{ color: '#D1D5DB', fontSize: 13 }}>
                    {u.organizations?.name || u.org_id || '—'}
                  </td>
                  <td style={{ color: '#6B7280', fontSize: 12 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="sa-btn sa-btn-success"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => handleDecision(u.id, 'approved', u.org_id)}
                        disabled={processing === u.id}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        className="sa-btn sa-btn-danger"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => handleDecision(u.id, 'rejected', u.org_id)}
                        disabled={processing === u.id}
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SuperAdminLayout>
  );
}
