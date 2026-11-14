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

const formatDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const dateFormatted = !isNaN(d.getTime())
      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : dateStr;
    const timeFormatted = timeStr || (!isNaN(d.getTime()) && dateStr.includes('T') ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
    return timeFormatted ? `${dateFormatted} • ${timeFormatted}` : dateFormatted;
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
      const isAdmin = user?.account_type === 'super_admin' || ['Admin', 'MD', 'System Admin'].includes(user.role);
      let allowedUids = [];

      if (!isAdmin) {
        allowedUids = getSubUids(allUsers || [], user.uid || user.id);
      }

      let query = supabase.from('leads').select('*');
      if (!isAdmin && allowedUids.length > 0) {
        query = query.in('assigned_to', allowedUids);
      }

      const { data: leads, error } = await query;
      if (error) { console.error('Error fetching followups:', error); setIsLoading(false); return; }

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const leadsWithFollowUp = (leads || []).filter(l => Boolean(l.next_follow_up_date || l.next_follow_up || l.nextFollowUpDate));

      const processed = leadsWithFollowUp.map(l => {
        const rawDate = l.next_follow_up_date || l.next_follow_up || l.nextFollowUpDate;
        const nd = typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0];
        const type = nd === todayStr ? 'today' : nd < todayStr ? 'missed' : 'upcoming';
        return { 
          ...l, 
          name: l.full_name || l.fullName || l.name || 'Unknown', 
          company: l.project_name || l.projectName || l.company || '', 
          nextDate: nd, 
          nextTime: l.next_follow_up_time || l.nextFollowUpTime || '09:00', 
          lastNote: Array.isArray(l.history) && l.history.length > 0 ? l.history[l.history.length - 1]?.note : null, 
          type, 
          priority: l.priority || 'Normal' 
        };
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
      try {
        const { data: teamsData } = await supabase.from('teams').select('*');
        setTeams(teamsData || []);
        const { data: projectsData } = await supabase.from('projects').select('*');
        if (projectsData) {
          const sorted = [...projectsData].sort((a, b) => 
            (a.projectName || a.project_name || a.name || '').localeCompare(b.projectName || b.project_name || b.name || '')
          );
          setRawProjects(sorted);
        }
      } catch (err) {
        console.error('Error fetching projects in FollowUps:', err);
      }
    };
    fetchFilters();
  }, []);

  const allProjects = React.useMemo(() => {
    const isAdmin = user?.account_type === 'super_admin' || user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
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
      note: '', 
      nextDate: '', 
      nextTime: '',
      priority: lead.priority || 'Normal',
      isAppointment: false, 
      appointmentDate: '', 
      appointmentTime: '',
      appointmentLocation: '', 
      selectedProjects: lead.interests || []
    });
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalMode === 'reschedule' && !formData.nextDate) {
      alert('Please select a new follow-up date to reschedule.');
      return;
    }

    try {
      const now = new Date();
      const nextDateVal = formData.nextDate ? formData.nextDate : null;
      const nextTimeVal = nextDateVal ? (formData.nextTime || '09:00 AM') : null;

      const historyEntry = {
        date:      now.toISOString().split('T')[0],
        time:      now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
        type:      modalMode === 'reschedule' ? 'Rescheduled'
                 : formData.isAppointment ? 'Appointment' : 'Follow-up',
        note:      formData.note?.trim() || (modalMode === 'reschedule' ? `Rescheduled to ${formData.nextDate}` : 'Follow-up completed'),
        status:    selectedLead.status,
        createdBy: user?.full_name || user?.fullName || user?.name || 'User',
        interests: formData.selectedProjects,
        nextFollowUp: nextDateVal,
        nextFollowUpTime: nextTimeVal
      };

      const newHistory = [...(selectedLead.history || []), historyEntry];

      const payload = {
        next_follow_up_date: nextDateVal,
        next_follow_up:      nextDateVal,
        priority:            formData.priority || 'Normal',
        history:             newHistory,
        updated_at:          new Date().toISOString(),
        interests:           formData.selectedProjects || []
      };

      if (formData.isAppointment && modalMode === 'complete') {
        payload.visit_date     = formData.appointmentDate;
        payload.visit_time     = formData.appointmentTime;
        payload.visit_location = formData.appointmentLocation;
        payload.visit_note     = formData.note;
        payload.visit_status   = 'Confirmed';
      }

      let { error } = await supabase.from('leads').update(payload).eq('id', selectedLead.id);
      if (error && (error.message?.includes('interests') || error.code === 'PGRST204')) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.interests;
        const retry = await supabase.from('leads').update(fallbackPayload).eq('id', selectedLead.id);
        error = retry.error;
      }
      if (error) {
        console.error('Error updating lead follow-up in Supabase:', error);
        alert('Failed to update follow-up: ' + error.message);
        return;
      }

      if (nextDateVal) {
        addEvent({
          title:    selectedLead.name,
          type:     formData.isAppointment ? 'Property Visit' : 'Follow-up',
          start:    `${nextDateVal}T${nextTimeVal || '09:00'}`,
          end:      `${nextDateVal}T10:00`,
          status:   'upcoming',
          location: formData.isAppointment ? 'Site Visit' : 'Phone Call',
          notes:    formData.note
        });
      }

      // Update local followUps list
      if (nextDateVal) {
        const nowD = new Date();
        const yyyy = nowD.getFullYear();
        const mm = String(nowD.getMonth() + 1).padStart(2, '0');
        const dd = String(nowD.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const newType = nextDateVal === todayStr ? 'today' : nextDateVal < todayStr ? 'missed' : 'upcoming';

        setFollowUps(prev => prev.map(l => {
          if (l.id === selectedLead.id) {
            return {
              ...l,
              ...payload,
              nextDate: nextDateVal,
              nextTime: nextTimeVal,
              type: newType,
              history: newHistory,
              lastNote: historyEntry.note
            };
          }
          return l;
        }));
      } else {
        // Follow-up is completed without next follow-up scheduled; remove from active follow-ups list!
        setFollowUps(prev => prev.filter(l => l.id !== selectedLead.id));
      }

      setModalMode(null);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      alert('Error: ' + (err.message || err));
    }
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
                    {/* Top Main Row: Identity & Primary Actions */}
                    <div className="fu-card-main">
                      {/* Left: Avatar & Identity */}
                      <div className="fu-card-left">
                        <div className="fu-card-avatar" onClick={() => navigate(`/leads/${item.id}`)}>
                          {item.image
                            ? <img src={item.image} alt={item.name} />
                            : <span>{(item.name)[0].toUpperCase()}</span>
                          }
                          <span className="fu-priority-dot" style={{ background: pc.dot }} />
                        </div>

                        <div className="fu-card-identity" onClick={() => navigate(`/leads/${item.id}`)}>
                          <div className="fu-card-name-row">
                            <span className="fu-card-name">{item.name}</span>
                            <span className="fu-chip" style={{ color: pc.color, background: pc.bg }}>
                              {item.priority === 'Urgent' && <Flame size={10} />}
                              {pc.label}
                            </span>
                          </div>
                          <div className="fu-card-meta">
                            {item.phone && <span className="fu-meta-item"><Phone size={11} />{item.phone}</span>}
                            {item.company && <span className="fu-meta-item"><User size={11} />{item.company}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right: Schedule + Priority + Actions */}
                      <div className="fu-card-right">
                        {/* Schedule block */}
                        <div className="fu-schedule">
                          <div className="fu-sched-date"><Calendar size={12} /><span>{formatDate(item.nextDate)}</span></div>
                          <div className="fu-sched-time"><Clock size={12} /><span>{formatTime(item.nextTime)}</span></div>
                        </div>

                        {/* Quick contact */}
                        <div className="fu-contacts">
                          {item.phone && (
                            <a href={`https://wa.me/${item.phone.replace(/[^\d]/g,'')}`}
                               target="_blank" rel="noopener noreferrer"
                               className="fu-contact-btn wa" title="WhatsApp">
                              <WhatsAppIcon size={15} />
                            </a>
                          )}
                          {item.phone && (
                            <a href={`tel:${item.phone}`} className="fu-contact-btn call" title="Call">
                              <Phone size={14} />
                            </a>
                          )}
                          {item.email && (
                            <a href={`mailto:${item.email}`} className="fu-contact-btn mail" title="Email">
                              <Mail size={14} />
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

                        {/* Arrow */}
                        <button className="fu-arrow" onClick={() => navigate(`/leads/${item.id}`)} title="View Details">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Bottom: Last Note & Collapsible History */}
                    {item.lastNote && (
                      <div className="fu-card-bottom">
                        <div 
                          className="fu-note-summary"
                          onClick={() => setExpandedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        >
                          <div className="fu-note-preview">
                            <MessageSquare size={13} className="fu-note-icon" />
                            <span className="fu-note-label">Last Note:</span>
                            <span className="fu-note-text">{item.lastNote}</span>
                          </div>
                          <div className="fu-history-toggle-pill">
                            <span>{expandedHistory[item.id] ? 'Hide History' : `History (${item.history?.length || 1})`}</span>
                            <ChevronRight size={12} className={`fu-toggle-chevron ${expandedHistory[item.id] ? 'open' : ''}`} />
                          </div>
                        </div>

                        {expandedHistory[item.id] && item.history && item.history.length > 0 && (
                          <div className="fu-expanded-tray">
                            <div className="fu-timeline-list">
                              {[...item.history].reverse().map((hist, hIdx) => {
                                const isFollowUp = hist.type === 'Follow-up' || hist.type === 'Appointment';
                                return (
                                  <div key={hIdx} className="fu-timeline-row">
                                    <div className="fu-tl-timestamp">
                                      <span className="fu-tl-dot" style={{ background: isFollowUp ? 'var(--primary)' : '#10b981' }} />
                                      <span>{formatDateTime(hist.date, hist.time)}</span>
                                    </div>
                                    <div className="fu-tl-body">
                                      <div className="fu-tl-header">
                                        <span className={`fu-tl-badge ${isFollowUp ? 'followup' : 'system'}`}>
                                          {hist.type || 'Follow-up'}
                                        </span>
                                        {hist.createdBy && (
                                          <span className="fu-tl-author">by {hist.createdBy}</span>
                                        )}
                                      </div>
                                      <p className="fu-tl-note">{hist.note}</p>
                                      {hist.nextFollowUp && (
                                        <div className="fu-tl-next">
                                          <Calendar size={11} />
                                          <span>Next Follow-up: {formatDate(hist.nextFollowUp)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                  <label className="form-label">
                    {modalMode === 'reschedule' ? 'New Follow-up Date' : 'Next Follow-up Date (Optional)'}
                  </label>
                  <input 
                    type="date" 
                    className="custom-input-field" 
                    required={modalMode === 'reschedule'}
                    value={formData.nextDate}
                    onChange={e => setFormData({...formData, nextDate: e.target.value})} 
                  />
                  {modalMode === 'complete' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '3px' }}>
                      Leave blank if no further follow-up is required
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {modalMode === 'reschedule' ? 'Time' : 'Time (Optional)'}
                  </label>
                  <input 
                    type="time" 
                    className="custom-input-field"
                    value={formData.nextTime}
                    onChange={e => setFormData({...formData, nextTime: e.target.value})} 
                  />
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
