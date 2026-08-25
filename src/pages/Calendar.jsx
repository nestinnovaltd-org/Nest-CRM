import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Bell,
  Search,
  Users,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import Toast from '../components/ui/Toast';
import useEventStore from '../store/useEventStore';
import './Calendar.css';

const formatDateToISOString = (dateVal) => {
  if (!dateVal) return '';
  try {
    let dateObj;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
      dateObj = dateVal.toDate();
    } else {
      dateObj = new Date(dateVal);
    }
    
    if (isNaN(dateObj.getTime())) {
      const cleaned = String(dateVal).trim();
      dateObj = new Date(cleaned);
    }
    
    if (!isNaN(dateObj.getTime())) {
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }
  return '';
};

const getSafeDate = (dateVal) => {
  if (!dateVal) return new Date();
  
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    return dateVal.toDate();
  }
  
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? new Date() : dateVal;
  }
  
  if (typeof dateVal === 'string') {
    let parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) return parsed;
    
    if (dateVal.includes('T')) {
      const cleanStr = dateVal.replace('T', ' ');
      parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    parsed = new Date(dateVal.trim());
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return new Date();
};

const CalendarPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getSubordinateUids = (allUsers, currentUserId) => {
    const subordinates = allUsers.filter(u => u.reportsTo === currentUserId);
    let uids = [currentUserId, ...subordinates.map(u => u.id)];
    
    subordinates.forEach(sub => {
      const descendants = getSubordinateUids(allUsers, sub.id);
      uids = [...uids, ...descendants];
    });
    
    return [...new Set(uids)];
  };

  useEffect(() => {
    if (!user) return;

    // Fetch all users to determine hierarchy
    const unsubUsers = onSnapshot(collection(db, 'users'), (userSnapshot) => {
      const allUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const isAdmin = user.role === 'Admin' || user.role === 'MD' || user.role === 'System Admin';
      
      let q;
      let allowedUids = [];

      if (isAdmin) {
        q = query(collection(db, 'leads'));
      } else {
        allowedUids = getSubordinateUids(allUsers, user.uid);
        if (allowedUids.length <= 30) {
          q = query(
            collection(db, 'leads'),
            where('assignedTo', 'in', allowedUids)
          );
        } else {
          q = query(collection(db, 'leads'));
        }
      }

      const unsubscribeLeads = onSnapshot(q, (snapshot) => {
        let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(l => l.status !== 'Released');

        // In-memory filter if allowedUids is large and not admin
        if (!isAdmin && allowedUids.length > 30) {
          leads = leads.filter(l => allowedUids.includes(l.assignedTo));
        }

        setAllLeads(leads);

        const calendarEvents = [];
        leads.forEach(l => {
          if (l.visitDate) {
            const isoVisitDate = formatDateToISOString(l.visitDate);
            if (isoVisitDate) {
              const todayStr = new Date().toISOString().split('T')[0];
              let status = 'upcoming';
              if (isoVisitDate < todayStr) {
                status = 'missed';
              }

              calendarEvents.push({
                id: `${l.id}-visit`,
                title: `${l.fullName || l.name} (Visit)`,
                type: 'Property Visit',
                start: `${isoVisitDate}T${l.visitTime || '10:00:00'}`,
                end: `${isoVisitDate}T${l.visitTime ? '12:00:00' : '12:00:00'}`,
                status: status,
                location: l.visitLocation || 'Project Site',
                notes: l.visitNote || 'Scheduled site visit'
              });
            }
          }
        });
        
        setEvents(calendarEvents);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching calendar events:", error);
        setIsLoading(false);
      });

      return () => unsubscribeLeads();
    });

    return () => unsubUsers();
  }, [user]);
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [allLeads, setAllLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });
  
  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };
  
  const [newEventData, setNewEventData] = useState({
    type: 'Property Visit',
    time: '10:00',
    notes: '',
    reminder: '10 minutes before'
  });
  
  // Notifications State
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Follow-up with Rahim in 10 minutes', time: '10m ago', type: 'alert', read: false },
    { id: 2, text: 'Site visit scheduled for tomorrow', time: '2h ago', type: 'info', read: true }
  ]);

  // Removed mock events as they are now in useEventStore
  
  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsRescheduling(false);
    setRescheduleDate(event.start.split('T')[0] || '');
    setRescheduleTime(event.start.split('T')[1]?.substring(0, 5) || '09:00');
    setShowDetailModal(true);
  };

  const handleRescheduleConfirm = async (e) => {
    e.preventDefault();
    if (!selectedEvent || !rescheduleDate) return;
    
    try {
      const leadId = selectedEvent.id.replace('-followup', '').replace('-visit', '');
      const leadRef = doc(db, 'leads', leadId);
      const isFollowup = selectedEvent.type === 'Follow-up';
      
      const updatePayload = {
        updatedAt: serverTimestamp()
      };
      
      if (isFollowup) {
        updatePayload.nextFollowUp = rescheduleDate;
        updatePayload.nextFollowUpDate = rescheduleDate;
        updatePayload.nextFollowUpTime = rescheduleTime || '09:00';
      } else {
        updatePayload.visitDate = rescheduleDate;
        updatePayload.visitTime = rescheduleTime || '10:00';
      }
      
      const historyEntry = {
        date: new Date().toISOString(),
        note: `${selectedEvent.type} rescheduled to ${rescheduleDate} at ${rescheduleTime || '09:00'} by ${user?.fullName || user?.name || 'User'}.`,
        type: 'System',
        createdBy: user?.fullName || user?.name || 'User'
      };
      updatePayload.history = arrayUnion(historyEntry);
      
      await updateDoc(leadRef, updatePayload);
      showToast(`${selectedEvent.type} rescheduled successfully!`, 'success');
      setShowDetailModal(false);
      setIsRescheduling(false);
    } catch (error) {
      console.error("Error rescheduling event:", error);
      showToast("Failed to reschedule event.", "error");
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedEvent) return;
    
    try {
      const leadId = selectedEvent.id.replace('-followup', '').replace('-visit', '');
      const leadRef = doc(db, 'leads', leadId);
      const isFollowup = selectedEvent.type === 'Follow-up';
      
      const updatePayload = {
        updatedAt: serverTimestamp()
      };
      
      if (isFollowup) {
        updatePayload.nextFollowUp = '';
        updatePayload.nextFollowUpDate = null;
        updatePayload.nextFollowUpTime = '';
      } else {
        updatePayload.visitDate = '';
        updatePayload.visitTime = '';
      }
      
      const historyEntry = {
        date: new Date().toISOString(),
        note: `${selectedEvent.type} completed and closed on timeline by ${user?.fullName || user?.name || 'User'}.`,
        type: 'System',
        createdBy: user?.fullName || user?.name || 'User'
      };
      updatePayload.history = arrayUnion(historyEntry);
      
      await updateDoc(leadRef, updatePayload);
      showToast(`${selectedEvent.type} marked as completed!`, 'success');
      setShowDetailModal(false);
    } catch (error) {
      console.error("Error completing event:", error);
      showToast("Failed to update event status.", "error");
    }
  };

  // Helper to get days in month
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days for current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.start.startsWith(dateStr));
      const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

      days.push(
        <div 
          key={i} 
          className={`calendar-day ${isToday ? 'today' : ''}`}
          onClick={() => {
            setSelectedDate(dateStr);
            setShowAddModal(true);
          }}
        >
          <span className="day-number">{i}</span>
          <div className="day-events">
            {dayEvents.map(e => (
              <div 
                key={e.id} 
                className={`event-tag ${e.type.toLowerCase().replace(' ', '-')}-tag ${e.status}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleEventClick(e);
                }}
              >
                <span className="event-time">{getSafeDate(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="event-title">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="calendar-month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="calendar-weekday-header">{d}</div>
        ))}
        {days}
      </div>
    );
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!selectedLead || !selectedDate) {
      showToast('Please select a lead and date', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const leadRef = doc(db, 'leads', selectedLead.id);
      
      const updatePayload = {
        visitDate: selectedDate,
        visitTime: newEventData.time,
        visitLocation: selectedLead.area || selectedLead.location || 'Project Site',
        visitStatus: 'Confirmed',
        visitNote: newEventData.notes || 'Scheduled site visit',
        updatedAt: serverTimestamp()
      };
      
      const historyEntry = {
        date: new Date().toISOString().split('T')[0],
        time: newEventData.time,
        type: 'Appointment',
        note: `Scheduled Property Visit: ${newEventData.notes || 'No notes added'}`,
        createdBy: user?.fullName || user?.name || 'User'
      };
      updatePayload.history = arrayUnion(historyEntry);

      await updateDoc(leadRef, updatePayload);

      showToast(`Property Visit scheduled successfully!`);
      setShowAddModal(false);
      // Reset form
      setSelectedLead(null);
      setSearchQuery('');
      setNewEventData({
        type: 'Property Visit',
        time: '10:00',
        notes: '',
        reminder: '10 minutes before'
      });
    } catch (error) {
      console.error("Error saving event:", error);
      showToast('Failed to save event', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLeads = searchQuery.length > 0
    ? allLeads.filter(l => 
        (l.fullName || l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.phone || '').includes(searchQuery)
      )
    : [];

  return (
    <DashboardLayout>
      <div className="calendar-module-container">
        <div className="calendar-main-content">
          <div className="calendar-top-controls">
            <div className="controls-left">
              <h1>Calendar & Schedule</h1>
              <div className="mobile-notification-wrapper">
                <div className="notification-bell" onClick={() => {}}>
                  <Bell size={22} className="icon-alert" />
                  {notifications.some(n => !n.read) && <span className="notification-dot"></span>}
                </div>
              </div>
              <div className="view-toggle-row">
                <div className="view-toggle-group">
                  <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>Month</button>
                  <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Week</button>
                  <button className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>Day</button>
                </div>
                <button className="mobile-add-event-btn" onClick={() => setShowAddModal(true)}>
                  <Plus size={20} />
                </button>
              </div>
            </div>
            
            <div className="controls-center">
              <button className="nav-btn" onClick={handlePrev}><ChevronLeft size={20} /></button>
              <h2 className="current-date-display">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button className="nav-btn" onClick={handleNext}><ChevronRight size={20} /></button>
              <button className="today-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
            </div>

            <div className="controls-right">
              <div className="desktop-notification-wrapper">
                <div className="notification-bell" onClick={() => {}}>
                  <Bell size={22} className="icon-alert" />
                  {notifications.some(n => !n.read) && <span className="notification-dot"></span>}
                </div>
              </div>
              <Button variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>Add Event</Button>
            </div>
          </div>

          <div className="calendar-viewport">
            {viewMode === 'month' ? renderMonthView() : (
              <div className="view-placeholder">
                <LayoutGrid size={48} />
                <p>{viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view is under development</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="calendar-sidebar">
          <div className="sidebar-section">
            <h3>Today's Schedule</h3>
            <div className="mini-schedule-list">
              {events
                .filter(e => e.start.startsWith(formatDateToISOString(new Date())))
                .map(e => (
                  <div key={e.id} className={`mini-event-card ${e.status}`} onClick={() => handleEventClick(e)}>
                    <div className="mini-event-time">{getSafeDate(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="mini-event-info">
                      <h4>{e.title}</h4>
                      <span className="mini-type">{e.type}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="text-red">Missed Tasks</h3>
            <div className="mini-schedule-list">
              {events.filter(e => e.status === 'missed').map(e => (
                <div key={e.id} className="mini-event-card missed" onClick={() => handleEventClick(e)}>
                  <div className="mini-event-time">Missed</div>
                  <div className="mini-event-info">
                    <h4>{e.title}</h4>
                    <span className="mini-type">{e.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Modal 
          isOpen={showAddModal} 
          onClose={() => {
            setShowAddModal(false);
            setSelectedLead(null);
            setSearchQuery('');
          }}
          title="Schedule New Event"
        >
          <form className="new-lead-form" onSubmit={handleSaveEvent}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Search Lead</label>
              <div className="input-with-icon">
                <Search className="input-icon icon-search" size={18} />
                <input 
                  type="text" 
                  className="custom-input-field" 
                  placeholder="Type lead name or phone..." 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedLead) setSelectedLead(null);
                  }}
                />
              </div>
              {searchQuery && !selectedLead && filteredLeads.length > 0 && (
                <div className="lead-search-results">
                  {filteredLeads.map(l => (
                    <div 
                      key={l.id} 
                      className="search-result-item"
                      onClick={() => {
                        setSelectedLead(l);
                        setSearchQuery(l.fullName || l.name);
                      }}
                    >
                      <span className="res-name">{l.fullName || l.name}</span>
                      <span className="res-phone">{l.phone}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && !selectedLead && filteredLeads.length === 0 && (
                <div className="lead-search-results" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No leads found matching your search.
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Event Type</label>
                <input 
                  type="text" 
                  className="custom-input-field" 
                  value="Property Visit" 
                  disabled 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reminder</label>
                <select 
                  className="custom-select-field"
                  value={newEventData.reminder}
                  onChange={(e) => setNewEventData({...newEventData, reminder: e.target.value})}
                >
                  <option>10 minutes before</option>
                  <option>30 minutes before</option>
                  <option>1 hour before</option>
                  <option>1 day before</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="custom-input-field" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input 
                  type="time" 
                  className="custom-input-field" 
                  value={newEventData.time}
                  onChange={(e) => setNewEventData({...newEventData, time: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Internal Notes</label>
              <textarea 
                className="custom-textarea" 
                placeholder="Add details..."
                value={newEventData.notes}
                onChange={(e) => setNewEventData({...newEventData, notes: e.target.value})}
              ></textarea>
            </div>

            <div className="form-actions mt-4">
              <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit" isLoading={isSaving}>Save Event</Button>
            </div>
          </form>
        </Modal>

        {/* Detail Modal */}
        <Modal 
          isOpen={showDetailModal} 
          onClose={() => setShowDetailModal(false)}
          title="Event Details"
        >
          {selectedEvent && (
            <div className="event-details-content">
              <div className="detail-header">
                <div className="lead-avatar">{selectedEvent.title[0]}</div>
                <div className="lead-info">
                  <h2>{selectedEvent.title}</h2>
                  <span className={`status-pill ${selectedEvent.status}`}>{selectedEvent.status}</span>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item">
                  <Clock size={16} className="icon-history" />
                  <span>{getSafeDate(selectedEvent.start).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <MapPin size={16} className="icon-whatsapp" />
                  <span>{selectedEvent.location}</span>
                </div>
              </div>

              <div className="detail-notes">
                <label>Notes:</label>
                <p>{selectedEvent.notes}</p>
              </div>

              {isRescheduling ? (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>New Date</label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        required
                        style={{
                          background: 'var(--background-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          fontSize: '0.8125rem'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>New Time</label>
                      <input
                        type="time"
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        required
                        style={{
                          background: 'var(--background-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          fontSize: '0.8125rem'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <Button variant="secondary" size="sm" onClick={() => setIsRescheduling(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleRescheduleConfirm}>Save Changes</Button>
                  </div>
                </div>
              ) : (
                <div className="detail-actions">
                  <div className="contact-btns">
                    <button className="contact-btn call"><Phone size={18} className="icon-call" /></button>
                    <button className="contact-btn email"><Mail size={18} className="icon-email" /></button>
                  </div>
                  <div className="main-actions">
                    <Button variant="secondary" onClick={() => setIsRescheduling(true)}>Reschedule</Button>
                    <Button variant="primary" icon={CheckCircle2} onClick={handleMarkCompleted}>Mark Completed</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

      </div>

      <AnimatePresence>
        {toastConfig.show && (
          <Toast 
            message={toastConfig.message} 
            type={toastConfig.type} 
            onClose={() => setToastConfig({ ...toastConfig, show: false })} 
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default CalendarPage;
