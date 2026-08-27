import React, { useEffect, useState } from 'react'
import { MessageSquare, Smartphone, Users, Send, MessageCircle, Zap, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { waHealth, waSessions, waCampaigns } from '../../services/whatsappApi'
import DashboardLayout from '../../layouts/DashboardLayout'
import './whatsapp.css'

function StatCard({ icon: Icon, label, value, sub, color = '#25d366' }) {
  return (
    <div className="wa-stat-card">
      <div style={{ color, marginBottom: 4 }}><Icon size={20} /></div>
      <div className="wa-stat-label">{label}</div>
      <div className="wa-stat-value">{value ?? '—'}</div>
      {sub && <div className="wa-stat-sub">{sub}</div>}
    </div>
  )
}

export default function WaDashboard() {
  const [health, setHealth]       = useState(null)
  const [sessions, setSessions]   = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    Promise.all([
      waHealth.check().catch(() => null),
      waSessions.list().catch(() => ({ sessions: [] })),
      waCampaigns.list().catch(() => ({ campaigns: [] }))
    ]).then(([h, s, c]) => {
      setHealth(h)
      setSessions(s?.sessions || [])
      setCampaigns(c?.campaigns || [])
    }).catch(err => setError(err.message))
     .finally(() => setLoading(false))
  }, [])

  const connected    = sessions.filter(s => s.status === 'CONNECTED').length
  const running      = campaigns.filter(c => c.status === 'RUNNING').length
  const totalSent    = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)
  const totalFailed  = campaigns.reduce((acc, c) => acc + (c.failed_count || 0), 0)

  if (loading) return (
    <DashboardLayout>
      <div className="wa-page">
        <div className="wa-page-header">
          <h1 className="wa-page-title"><MessageSquare size={24} className="wa-icon" /> WhatsApp Dashboard</h1>
        </div>
        <div className="wa-empty"><div className="wa-spinner" /><p>Loading dashboard...</p></div>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="wa-page">
        <div className="wa-page-header">
          <h1 className="wa-page-title"><MessageSquare size={24} className="wa-icon" /> WhatsApp Dashboard</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {health && (
              <span style={{ fontSize: '0.8rem', color: health.status === 'ok' ? '#25d366' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className={`wa-dot wa-dot-${health.status === 'ok' ? 'green' : 'red'}`} />
                Backend {health.status === 'ok' ? 'Online' : 'Degraded'}
              </span>
            )}
            <Link to="/whatsapp/sessions" className="wa-btn wa-btn-primary" style={{ textDecoration: 'none' }}>
              <Smartphone size={16} /> Manage Sessions
            </Link>
          </div>
        </div>

        {error && (
          <div className="wa-info-box wa-info-box-yellow">
            ⚠️ Could not connect to WhatsApp backend. Make sure the VPS backend is running.
          </div>
        )}

        {/* Stats */}
        <div className="wa-stats-grid">
          <StatCard icon={Smartphone}    label="Active Sessions"   value={connected}   sub={`of ${sessions.length} total`} />
          <StatCard icon={Zap}           label="Running Campaigns" value={running}      sub={`of ${campaigns.length} total`} color="#818cf8" />
          <StatCard icon={Send}          label="Messages Sent"     value={totalSent.toLocaleString()}   sub="all campaigns" color="#38bdf8" />
          <StatCard icon={TrendingUp}    label="Failed Messages"   value={totalFailed}  sub="all campaigns" color={totalFailed > 0 ? '#ef4444' : '#25d366'} />
        </div>

        {/* Quick links */}
        <div className="wa-card">
          <div className="wa-card-header">
            <span className="wa-card-title"><Zap size={16} /> Quick Actions</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { to: '/whatsapp/sessions',      icon: Smartphone,    label: 'Sessions',      desc: 'Manage connections' },
              { to: '/whatsapp/leads',         icon: Users,         label: 'Leads',         desc: 'Check WA status' },
              { to: '/whatsapp/templates',     icon: MessageSquare, label: 'Templates',     desc: 'Message templates' },
              { to: '/whatsapp/campaigns',     icon: Send,          label: 'Campaigns',     desc: 'Run bulk campaigns' },
              { to: '/whatsapp/conversations', icon: MessageCircle, label: 'Conversations', desc: 'Reply to messages' },
            ].map(item => (
              <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(37,211,102,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                >
                  <item.icon size={20} style={{ color: '#25d366', marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary, #f3f4f6)' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #9ca3af)', marginTop: 2 }}>{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent campaigns */}
        <div className="wa-card">
          <div className="wa-card-header">
            <span className="wa-card-title"><Send size={16} /> Recent Campaigns</span>
            <Link to="/whatsapp/campaigns" className="wa-btn wa-btn-secondary" style={{ textDecoration: 'none', fontSize: '0.8rem', padding: '6px 12px' }}>View All</Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="wa-empty"><div className="wa-empty-icon">📊</div><p>No campaigns yet</p></div>
          ) : (
            <div className="wa-table-wrap">
              <table className="wa-table">
                <thead><tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Failed</th></tr></thead>
                <tbody>
                  {campaigns.slice(0, 8).map(c => (
                    <tr key={c.id}>
                      <td><Link to="/whatsapp/campaigns" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>{c.name}</Link></td>
                      <td><CampaignBadge status={c.status} /></td>
                      <td>{c.sent_count || 0}</td>
                      <td style={{ color: c.failed_count > 0 ? '#ef4444' : 'inherit' }}>{c.failed_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="wa-card">
          <div className="wa-card-header">
            <span className="wa-card-title"><Smartphone size={16} /> Sessions</span>
            <Link to="/whatsapp/sessions" className="wa-btn wa-btn-secondary" style={{ textDecoration: 'none', fontSize: '0.8rem', padding: '6px 12px' }}>Manage</Link>
          </div>
          {sessions.length === 0 ? (
            <div className="wa-empty"><div className="wa-empty-icon">📱</div><p>No sessions yet. <Link to="/whatsapp/sessions" style={{ color: '#25d366' }}>Create one</Link></p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.session_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{s.phone_number || 'Not connected'}</div>
                  </div>
                  <SessionBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function SessionBadge({ status }) {
  const map = { CONNECTED: 'green', QR_REQUIRED: 'yellow', CONNECTING: 'yellow', RECONNECTING: 'yellow', DISCONNECTED: 'gray', ERROR: 'red' }
  return <span className={`wa-badge wa-badge-${map[status] || 'gray'}`}><span className={`wa-dot wa-dot-${map[status] || 'gray'}`} />{status}</span>
}

function CampaignBadge({ status }) {
  const map = { RUNNING: 'green', PAUSED: 'yellow', DRAFT: 'gray', STOPPED: 'red', COMPLETED: 'blue', SCHEDULED: 'purple' }
  return <span className={`wa-badge wa-badge-${map[status] || 'gray'}`}>{status}</span>
}
