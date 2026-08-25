import React, { useState, useEffect } from 'react';
import SuperAdminLayout from './SuperAdminLayout';
import { supabase } from '../../lib/supabase';
import { Search, CheckCircle, XCircle, MessageSquare, RefreshCw, Phone, Mail, Globe, Calendar } from 'lucide-react';
import './SuperAdminLayout.css';

const STATUS_COLORS = { new: 'new', contacted: 'pending', converted: 'approved', closed: 'suspended' };

export default function BookDemoLeads() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('book_demo_leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await supabase.from('book_demo_leads').update({ status }).eq('id', id);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  };

  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    const notes = [...(selected.notes || []), { text: noteText, at: new Date().toISOString() }];
    await supabase.from('book_demo_leads').update({ notes }).eq('id', selected.id);
    setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, notes } : l));
    setSelected(prev => ({ ...prev, notes }));
    setNoteText('');
    setSaving(false);
  };

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.company_name?.toLowerCase().includes(search.toLowerCase()) || l.full_name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || l.status === filter;
    return matchSearch && matchFilter;
  });

  const counts = { all: leads.length, new: leads.filter(l => l.status === 'new' || !l.status).length, contacted: leads.filter(l => l.status === 'contacted').length, converted: leads.filter(l => l.status === 'converted').length };

  return (
    <SuperAdminLayout>
      <div className="sa-page-header">
        <div>
          <h1 className="sa-page-title">Book Demo Leads</h1>
          <p className="sa-page-subtitle">Custom domain demo requests from organizations</p>
        </div>
        <button className="sa-btn sa-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All', color: 'var(--primary)' },
          { key: 'new', label: '🆕 New', color: 'var(--primary-hover)' },
          { key: 'contacted', label: '📞 Contacted', color: '#F59E0B' },
          { key: 'converted', label: '✅ Converted', color: '#10B981' },
          { key: 'closed', label: '🔒 Closed', color: '#6B7280' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              background: filter === tab.key ? 'var(--primary-soft)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filter === tab.key ? 'var(--primary-border)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '7px 16px', cursor: 'pointer', color: filter === tab.key ? (tab.key === 'all' || tab.key === 'new' ? 'var(--primary-hover)' : tab.color) : '#6B7280',
              fontSize: 13, fontWeight: 600,
            }}>
            {tab.label} {counts[tab.key] !== undefined && <span style={{ opacity: 0.7 }}>({counts[tab.key]})</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* Table */}
        <div className="sa-table-wrap">
          <div className="sa-table-head-bar">
            <div className="sa-search">
              <Search size={15} color="#4B5563" />
              <input placeholder="Search by company, name, email..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="sa-empty"><span style={{ color: '#6B7280' }}>Loading...</span></div>
          ) : filtered.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-icon">📋</div>
              <h3>No demo leads</h3>
              <p>Leads submitted via the Book Demo form appear here</p>
            </div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr><th>Contact</th><th>Company</th><th>Domain</th><th>Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                   <tr key={lead.id} onClick={() => setSelected(lead)} style={{ cursor: 'pointer', background: selected?.id === lead.id ? 'var(--primary-soft)' : '' }}>
                     <td>
                       <div style={{ fontWeight: 600, color: '#F9FAFB', fontSize: 13.5 }}>{lead.full_name}</div>
                       <div style={{ fontSize: 11.5, color: '#6B7280' }}>{lead.email}</div>
                     </td>
                     <td style={{ color: '#D1D5DB' }}>{lead.company_name || '—'}</td>
                     <td style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12 }}>{lead.custom_domain_requested || '—'}</td>
                     <td style={{ color: '#6B7280', fontSize: 12 }}>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}</td>
                     <td><span className={`sa-badge sa-badge-${STATUS_COLORS[lead.status || 'new']}`}>{lead.status || 'new'}</span></td>
                     <td>
                       <select
                         value={lead.status || 'new'}
                         onClick={e => e.stopPropagation()}
                         onChange={e => updateStatus(lead.id, e.target.value)}
                         style={{ background: '#1a1a2e', border: '1px solid var(--primary-border)', borderRadius: 8, padding: '4px 8px', color: '#D1D5DB', fontSize: 12 }}
                       >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="sa-card" style={{ height: 'fit-content', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: '#F9FAFB', margin: 0, fontSize: 15, fontWeight: 700 }}>{selected.full_name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {[
                { icon: Mail, label: selected.email },
                { icon: Phone, label: selected.phone },
                { icon: Globe, label: selected.custom_domain_requested || 'No domain specified' },
                { icon: Calendar, label: selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—' },
              ].map((item, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                   <item.icon size={14} color="var(--primary)" />
                   <span style={{ fontSize: 13, color: '#D1D5DB' }}>{item.label}</span>
                 </div>
               ))}
             </div>
             {selected.message && (
               <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: 12, marginBottom: 18 }}>
                 <p style={{ margin: 0, fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.6 }}>{selected.message}</p>
               </div>
             )}
             {/* Notes */}
             <div style={{ marginBottom: 12 }}>
               <div style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>NOTES</div>
               {(selected.notes || []).length === 0 ? (
                 <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>No notes yet</p>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                   {(selected.notes || []).map((note, i) => (
                     <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
                       <p style={{ margin: 0, fontSize: 12.5, color: '#D1D5DB' }}>{note.text}</p>
                       <span style={{ fontSize: 10.5, color: '#4B5563' }}>{new Date(note.at).toLocaleString()}</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
             <textarea
               value={noteText}
               onChange={e => setNoteText(e.target.value)}
               placeholder="Add a note..."
               rows={3}
               style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--primary-border)', borderRadius: 10, padding: '9px 12px', color: '#F9FAFB', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
             />
            <button className="sa-btn sa-btn-primary" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }} onClick={saveNote} disabled={saving || !noteText.trim()}>
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
