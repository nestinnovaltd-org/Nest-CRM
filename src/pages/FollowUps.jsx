import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Phone, Mail,
  CheckCircle2, AlertCircle, CalendarCheck,
  Search, ChevronRight, RotateCcw, User,
  MessageSquare, Flame, ArrowRight, X
} from 'lucide-react';
import useEventStore from '../store/useEventStore';
import { WhatsAppIcon } from '../components/ui/Icons';
import './FollowUps.css';

/* ── helpers ── */
const priorityConfig = {
  'Urgent':        { label: 'Urgent',      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    dot: '#EF4444' },
  'High Priority': { label: 'High',        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',   dot: '#F59E0B' },
  'Normal':        { label: 'Normal',      color: 'var(--primary)', bg: 'var(--primary-soft)', dot: 'var(--primary)' },
  'Follow-up':     { label: 'Follow-up',   color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',   dot: '#3B82F6' },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
};

const formatTime = (timeStr) => {
  if (!timeStr) return '09:00 AM';
  try {
    const [h, m] = timeStr.split(':');
    const d = new Date(); d.setHours(+h, +m);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return timeStr; }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateStr;
  }
};

/* ── Component ── */
const FollowUps = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const addEvent  = useEventStore(s => s.addEvent);

  const [followUps,    setFollowUps]    = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [activeTab,    setActiveTab]    = useState('today');
  const [searchTerm,   setSearchTerm]   = useState('');
  const [rawProjects,  setRawProjects]  = useState([]);
  const [teams,        setTeams]        = useState([]);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedProject, setSelectedProject] = useState('All');
  const [expandedHistory, setExpandedHistory] = useState({});

  /* modal state */
  const [modalMode,    setModalMode]    = useState(null); // 'complete' | 'reschedule'
  const [selectedLead, setSelectedLead] = useState(null);
  const [formData,     setFormData]     = useState({
    note: '', nextDate: '', nextTime: '', priority: 'Normal',
    isAppointment: false, appointmentDate: '', appointmentTime: '',
    appointmentLocation: '', selectedProjects: []
  });

  const itemsPerPage = 12;

  /* ── fetch hierarchy util ── */
  const getSubUids = (allUsers, uid) => {
    const me = allUsers.find(u => u.id === uid || u.uid === uid);
    if (!me) return [uid];
    const myName = me.fullName || me.name;
    let ids = [uid];
    for (const u of allUsers.filter(u => u.reportsTo === myName && u.id !== uid))
      ids = [...ids, ...getSubUids(allUsers, u.id)];
    return [...new Set(ids)];
  };

  /* ── realtime listener ── */
  useEffect(() => {
    if (!user) return;

    const fetchLeads = async () => {
      const { data: allUsers } = await supabase.from('users').select('*');
      const isAdmin = ['Admin', 'MD', 'System Admin'].includes(user.role);
      let allowedUids = [];

      if (!isAdmin) {
        allowedUids = getSubUids(allUsers || [], user.uid);
      }

      let query = supabase.from('leads').select('*').not('next_follow_up_date', 'is', null);
      if (!isAdmin && allowedUids.length > 0) {
        query = query.in('assigned_to', allowedUids);
      }

      const { data: leads, error } = await query;
      if (error) { console.error('Error fetching followups:', error); setIsLoading(false); return; }

      const todayStr = new Date().toISOString().split('T')[0];
      const processed = (leads || []).map(l => {
        const nd = l.next_follow_up_date || l.nextFollowUpDate;
        const type = nd === todayStr ? 'today' : nd < todayStr ? 'missed' : 'upcoming';
        return { ...l, name: l.full_name || l.fullName || l.name || 'Unknown', company: l.project_name || l.projectName || l.company || '', nextDate: nd, nextTime: l.next_follow_up_time || l.nextFollowUpTime || '09:00', lastNote: l.history?.slice(-1)[0]?.note || null, type, priority: l.priority || 'Normal' };
      });
      setFollowUps(processed);
      setIsLoading(false);
    };

    fetchLeads();
    const ch = supabase.channel('followups-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [user]);

  useEffect(() => {
    const fetchFilters = async () => {
      const { data: teamsData } = await supabase.from('teams').select('*');
      setTeams(teamsData || []);
      const { data: projectsData } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
      setRawProjects(projectsData || []);
    };
    fetchFilters();
  }, []);

  const allProjects = React.useMemo(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
    if (isAdmin) return rawProjects;

    const userName = user?.fullName || user?.name || '';
    const userTeams = teams.filter(team => 
      (team.members && team.members.includes(userName)) || 
      (team.teamLeads && team.teamLeads.includes(userName)) || 
      team.teamLead === userName
    );

    if (userTeams.length > 0) {
      const assignedProjects = [];
      userTeams.forEach(t => {
        if (t.assignedProjects) {
          assignedProjects.push(...t.assignedProjects);
        }
      });
      return rawProjects.filter(p => assignedProjects.includes(p.projectName));
    }

    return rawProjects;
  }, [rawProjects, user, teams]);

  /* ── open modal ── */
  const openModal = (mode, lead) => {
    setModalMode(mode);
    setSelectedLead(lead);
    setFormData({
      note: '', nextDate: '', nextTime: lead.nextTime || '',
      priority: lead.priority || 'Normal',
      isAppointment: false, appointmentDate: '', appointmentTime: '',
      appointmentLocation: '', selectedProjects: lead.interests || []
    });
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const leadRef = doc(db, 'leads', selectedLead.id);
      const now = new Date();
      const historyEntry = {
        date:      now.toISOString().split('T')[0],
        time:      now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
        type:      modalMode === 'reschedule' ? 'Rescheduled'
                 : formData.isAppointment ? 'Appointment' : 'Follow-up',
        note:      formData.note,
        status:    selectedLead.status,
        createdBy: user?.fullName || user?.name || 'User',
        interests: formData.selectedProjects
      };

      const payload = {
        nextFollowUpDate: formData.nextDate || null,
        nextFollowUpTime: formData.nextTime || '',
        priority:         formData.priority,
        history:          arrayUnion(historyEntry),
        updatedAt:        serverTimestamp(),
        interests:        formData.selectedProjects
      };

      if (formData.isAppointment && modalMode === 'complete') {
        payload.visitDate     = formData.appointmentDate;
        payload.visitTime     = formData.appointmentTime;
        payload.visitLocation = formData.appointmentLocation;
        payload.visitNote     = formData.note;
        payload.visitStatus   = 'Confirmed';
      }

      await updateDoc(leadRef, payload);

      if (formData.nextDate) {
        addEvent({
          title:    selectedLead.name,
          type:     formData.isAppointment ? 'Property Visit' : 'Follow-up',
          start:    `${formData.nextDate}T${formData.nextTime || '09:00'}`,
          end:      `${formData.nextDate}T10:00`,
          status:   'upcoming',
          location: formData.isAppointment ? 'Site Visit' : 'Phone Call',
          notes:    formData.note
        });
      }
      setModalMode(null);
    } catch (err) { console.error(err); }
  };

  /* ── derived data ── */
  const tabs = [
    { id:'today',    label:'Today',    icon: Calendar,      color: 'var(--primary)' },
    { id:'upcoming', label:'Upcoming', icon: CalendarCheck,  color: '#3B82F6' },
    { id:'missed',   label:'Pending',   icon: Clock,          color: '#F59E0B' },
  ];

  const counts = { today: 0, upcoming: 0, missed: 0 };
  followUps.forEach(f => counts[f.type] = (counts[f.type] || 0) + 1);

  const filtered = followUps.filter(f => {
    const matchesTab = f.type === activeTab;
    const matchesSearch = [f.name, f.company, f.phone].some(v => 
      v?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesPriority = selectedPriority === 'All' || f.priority === selectedPriority;
    const matchesProject = selectedProject === 'All' || f.company === selectedProject;
    return matchesTab && matchesSearch && matchesPriority && matchesProject;
  });
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  /* ── render ── */
  return (
    <DashboardLayout>
      <div className="fu-page">
        <LeadTabs />

        {/* ── Page Header ── */}
        <div className="fu-header">
          <div className="fu-header-left">
            <h1 className="fu-title">Follow-Ups</h1>
            <p className="fu-subtitle">Track, complete &amp; reschedule your lead interactions</p>
          </div>
          <div className="fu-controls">
            <div className="fu-search">
              <Search size={14} className="fu-search-icon" />
              <input
                type="text"
                placeholder="Search name, phone, company…"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              {searchTerm && (
                <button className="fu-search-clear" onClick={() => setSearchTerm('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="fu-filter-select-wrapper">
              <select 
                value={selectedPriority} 
                onChange={e => { setSelectedPriority(e.target.value); setCurrentPage(1); }}
                className="fu-filter-select"
              >
                <option value="All">All Priorities</option>
                <option value="Normal">Normal</option>
                <option value="High Priority">High Priority</option>
                <option value="Urgent">Urgent</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>

            <div className="fu-filter-select-wrapper">
              <select 
                value={selectedProject} 
                onChange={e => { setSelectedProject(e.target.value); setCurrentPage(1); }}
                className="fu-filter-select"
              >
                <option value="All">All Projects</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.projectName}>{p.projectName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="fu-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`fu-tab ${activeTab === t.id ? 'active' : ''} tab-${t.id}`}
              onClick={() => { setActiveTab(t.id); setCurrentPage(1); }}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
              <span className="fu-tab-badge">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="fu-list-wrap">
          {isLoading ? (
            <div className="fu-empty">
              <Clock size={32} className="fu-empty-icon" />
              <p>Loading…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="fu-empty">
              {activeTab === 'missed'
                ? <><CheckCircle2 size={40} className="fu-empty-icon" style={{ color: 'var(--primary)' }} /><h3>No pending follow-ups</h3><p>You're all caught up — great job!</p></>
                : <><CalendarCheck size={40} className="fu-empty-icon" /><h3>Nothing {activeTab}</h3><p>No follow-ups scheduled here yet.</p></>
              }
            </div>
          ) : (
            <div className="fu-list">
              {paginated.map((item, idx) => {
                const pc = priorityConfig[item.priority] || priorityConfig['Normal'];
                return (
                  <motion.div
                    key={item.id}
                    className="fu-card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.025, duration: 0.2 }}
                  >
                    {/* Left: Avatar */}
                    <div className="fu-card-avatar" onClick={() => navigate(`/leads/${item.id}`)}>
                      {item.image
                        ? <img src={item.image} alt={item.name} />
                        : <span>{(item.name)[0].toUpperCase()}</span>
                      }
                      <span className="fu-priority-dot" style={{ background: pc.dot }} />
                    </div>

                    {/* Center: Lead Info */}
                    <div className="fu-card-body" onClick={() => navigate(`/leads/${item.id}`)}>
                      <div className="fu-card-name">{item.name}</div>
                      <div className="fu-card-meta">
                        {item.phone && <span className="fu-meta-item"><Phone size={11} />{item.phone}</span>}
                        {item.company && <span className="fu-meta-item"><User size={11} />{item.company}</span>}
                      </div>
                      {item.lastNote && (
                        <div 
                          className="fu-card-note" 
                          style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: 'var(--hover-bg)', border: '1px solid var(--border)', marginTop: '6px', whiteSpace: 'normal' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Last Note: {item.lastNote}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600, marginLeft: '6px', flexShrink: 0 }}>
                              {expandedHistory[item.id] ? 'Collapse' : 'Expand'}
                            </span>
                          </div>

                          {expandedHistory[item.id] && item.history && item.history.length > 0 && (
                            <div className="history-timeline-expanded" style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                              {item.history.map((hist, hIdx) => (
                                <div key={hIdx} className="timeline-item" style={{ position: 'relative', paddingLeft: '12px', marginBottom: '6px', borderLeft: '1px dashed var(--border)', textAlign: 'left' }}>
                                  <div style={{ position: 'absolute', left: '-3px', top: '4px', width: '5px', height: '5px', borderRadius: '50%', background: hist.type === 'Follow-up' ? 'var(--primary)' : '#10b981' }}></div>
                                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <span>{formatDateTime(hist.date)}</span>
                                    {hist.createdBy && <span>By: {hist.createdBy}</span>}
                                  </div>
                                  <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                    {hist.note}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Schedule + Priority + Actions */}
                    <div className="fu-card-right">
                      {/* Schedule block */}
                      <div className="fu-schedule">
                        <div className="fu-sched-date"><Calendar size={11} /><span>{formatDate(item.nextDate)}</span></div>
                        <div className="fu-sched-time"><Clock size={11} /><span>{formatTime(item.nextTime)}</span></div>
                      </div>

                      {/* Priority */}
                      <span className="fu-chip" style={{ color: pc.color, background: pc.bg }}>
                        {item.priority === 'Urgent' && <Flame size={10} />}
                        {pc.label}
                      </span>

                      {/* Quick contact */}
                      <div className="fu-contacts">
                        {item.phone && (
                          <a href={`https://wa.me/${item.phone.replace(/[^\d]/g,'')}`}
                             target="_blank" rel="noopener noreferrer"
                             className="fu-contact-btn wa" title="WhatsApp">
                            <WhatsAppIcon size={16} />
                          </a>
                        )}
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="fu-contact-btn call" title="Call">
                            <Phone size={16} />
                          </a>
                        )}
                        {item.email && (
                          <a href={`mailto:${item.email}`} className="fu-contact-btn mail" title="Email">
                            <Mail size={16} />
                          </a>
                        )}
                      </div>

                      {/* Primary Actions */}
                      <div className="fu-actions">
                        <button className="fu-btn fu-btn-reschedule" onClick={() => openModal('reschedule', item)} title="Reschedule">
                          <RotateCcw size={13} />
                          <span>Reschedule</span>
                        </button>
                        <button className="fu-btn fu-btn-complete" onClick={() => openModal('complete', item)} title="Log & Complete">
                          <CheckCircle2 size={13} />
                          <span>Done</span>
                        </button>
                      </div>
                    </div>

                    {/* Arrow */}
                    <button className="fu-arrow" onClick={() => navigate(`/leads/${item.id}`)}>
                      <ChevronRight size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {filtered.length > itemsPerPage && (
          <div style={{ padding: '8px 20px' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filtered.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}

        {/* ── Modal ── */}
        <Modal
          isOpen={!!modalMode}
          onClose={() => setModalMode(null)}
          title={modalMode === 'reschedule' ? 'Reschedule Follow-up' : 'Log & Complete Follow-up'}
          className="glass-modal"
        >
          {selectedLead && (
            <form className="new-lead-form" onSubmit={handleSubmit}>

              {/* Lead mini-header */}
              <div className="fu-modal-lead">
                <div className="fu-modal-avatar">
                  {selectedLead.image
                    ? <img src={selectedLead.image} alt={selectedLead.name} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} />
                    : <span>{selectedLead.name?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div>
                  <div className="fu-modal-name">{selectedLead.name}</div>
                  <div className="fu-modal-sub">{selectedLead.phone} {selectedLead.company ? `· ${selectedLead.company}` : ''}</div>
                </div>
                <div className={`fu-modal-badge ${modalMode}`}>
                  {modalMode === 'reschedule' ? <><RotateCcw size={11} /> Rescheduling</> : <><CheckCircle2 size={11} /> Logging</>}
                </div>
              </div>

              {/* Note - always shown */}
              <div className="form-group">
                <label className="form-label">
                  {modalMode === 'reschedule' ? 'Reason for Rescheduling' : 'What was discussed?'}
                </label>
                <textarea
                  className="custom-textarea"
                  rows={3}
                  placeholder={modalMode === 'reschedule' ? 'e.g. Client unavailable, moved to next week…' : 'Brief summary of the call / meeting…'}
                  required
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                />
              </div>

              {/* Next date + time */}
              <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div className="form-group">
                  <label className="form-label">Next Follow-up Date</label>
                  <input type="date" className="custom-input-field" required
                    value={formData.nextDate}
                    onChange={e => setFormData({...formData, nextDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="custom-input-field"
                    value={formData.nextTime}
                    onChange={e => setFormData({...formData, nextTime: e.target.value})} />
                </div>
              </div>

              {/* Priority */}
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="custom-select-field"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value})}>
                  <option>Normal</option>
                  <option>High Priority</option>
                  <option>Urgent</option>
                  <option>Follow-up</option>
                </select>
              </div>

              {/* Projects interests - only on complete */}
              {modalMode === 'complete' && allProjects.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Client Interests</label>
                  <div className="interests-selection-grid">
                    {allProjects.map(p => (
                      <label key={p.id} className={`interest-checkbox-card ${formData.selectedProjects.includes(p.projectName) ? 'selected' : ''}`}>
                        <input type="checkbox" hidden
                          checked={formData.selectedProjects.includes(p.projectName)}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              selectedProjects: checked
                                ? [...prev.selectedProjects, p.projectName]
                                : prev.selectedProjects.filter(n => n !== p.projectName)
                            }));
                          }}
                        />
                        <span>{p.projectName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Appointment toggle - only on complete */}
              {modalMode === 'complete' && (
                <>
                  <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom:'8px', fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                    <input type="checkbox" checked={formData.isAppointment}
                      onChange={e => setFormData({...formData, isAppointment: e.target.checked})} />
                    Also schedule a Site Visit / Appointment
                  </label>

                  <AnimatePresence>
                    {formData.isAppointment && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                        <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'8px' }}>
                          <div className="form-group">
                            <label className="form-label">Visit Date</label>
                            <input type="date" className="custom-input-field" required={formData.isAppointment}
                              value={formData.appointmentDate}
                              onChange={e => setFormData({...formData, appointmentDate: e.target.value})} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Visit Time</label>
                            <input type="time" className="custom-input-field" required={formData.isAppointment}
                              value={formData.appointmentTime}
                              onChange={e => setFormData({...formData, appointmentTime: e.target.value})} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Location</label>
                          <input type="text" className="custom-input-field" placeholder="e.g. Project Site A"
                            required={formData.isAppointment}
                            value={formData.appointmentLocation}
                            onChange={e => setFormData({...formData, appointmentLocation: e.target.value})} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              <div className="form-actions mt-4">
                <Button variant="secondary" type="button" onClick={() => setModalMode(null)}>Cancel</Button>
                <Button variant="primary" type="submit"
                  icon={modalMode === 'reschedule' ? RotateCcw : CheckCircle2}>
                  {modalMode === 'reschedule' ? 'Confirm Reschedule' : 'Save & Log'}
                </Button>
              </div>
            </form>
          )}
        </Modal>

      </div>
    </DashboardLayout>
  );
};

export default FollowUps;
