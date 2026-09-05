import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Building2, ArrowRight, Shield, Search, Users, CheckCircle2 } from 'lucide-react';
import './WorkspaceSelect.css';

export default function WorkspaceSelect() {
  const { setCurrentTenant, currentTenant } = useAuth();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { data } = await supabase
          .from('organizations')
          .select('id, name, theme_color, billing_package, status, created_at')
          .eq('status', 'approved')
          .order('name', { ascending: true });
        setOrgs(data || []);
      } catch (e) {
        console.error('WorkspaceSelect fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  const handleSelect = (org) => {
    setSelected(org.id);
    setCurrentTenant({ type: 'org', id: org.id, name: org.name, theme_color: org.theme_color });
    setTimeout(() => navigate('/super-admin/dashboard'), 300);
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const packageColors = {
    starter: '#10B981',
    professional: '#3B82F6',
    enterprise: '#F59E0B',
  };

  return (
    <div className="ws-shell">
      {/* Background decoration */}
      <div className="ws-bg-orb ws-orb-1" />
      <div className="ws-bg-orb ws-orb-2" />

      <div className="ws-card">
        {/* Header */}
        <div className="ws-header">
          <div className="ws-logo-ring">
            <Shield size={28} />
          </div>
          <h1 className="ws-title">Select Workspace</h1>
          <p className="ws-subtitle">Choose an organization workspace to manage</p>
        </div>

        {/* Search */}
        <div className="ws-search-wrap">
          <Search size={16} className="ws-search-icon" />
          <input
            className="ws-search"
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* List */}
        <div className="ws-list custom-scrollbar">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="ws-skeleton" />
            ))
          ) : filtered.length === 0 ? (
            <div className="ws-empty">
              <Building2 size={40} />
              <p>No organizations found</p>
            </div>
          ) : (
            filtered.map(org => (
              <button
                key={org.id}
                className={`ws-org-card ${selected === org.id ? 'ws-org-card--selected' : ''}`}
                onClick={() => handleSelect(org)}
                style={{ '--org-color': org.theme_color || '#26E264' }}
              >
                <div className="ws-org-avatar" style={{ background: org.theme_color || '#26E264' }}>
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="ws-org-info">
                  <span className="ws-org-name">{org.name}</span>
                  <span className="ws-org-pkg" style={{ color: packageColors[org.billing_package] || '#6B7280' }}>
                    {org.billing_package ? org.billing_package.charAt(0).toUpperCase() + org.billing_package.slice(1) : 'Unknown'} Plan
                  </span>
                </div>
                {selected === org.id ? (
                  <CheckCircle2 size={20} className="ws-org-check" />
                ) : (
                  <ArrowRight size={18} className="ws-org-arrow" />
                )}
              </button>
            ))
          )}
        </div>

        <p className="ws-count">{filtered.length} workspace{filtered.length !== 1 ? 's' : ''} available</p>
      </div>
    </div>
  );
}
