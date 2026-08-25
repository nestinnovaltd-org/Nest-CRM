import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp, 
  getDocs,
  addDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Toast from '../components/ui/Toast';
import { 
  Calendar, 
  Clock, 
  Phone, 
  MessageCircle, 
  Mail, 
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  CalendarCheck,
  List,
  Layout,
  Map,
  Users,
  Printer,
  FileText
} from 'lucide-react';
import { WhatsAppIcon } from '../components/ui/Icons';
import './FollowUps.css';
import './Leads.css';

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

const Visits = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [showModal, setShowModal] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });
  const [modalStatus, setModalStatus] = useState('Confirmed');
  const [modalNote, setModalNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucherVisit, setSelectedVoucherVisit] = useState(null);
  const [projectsList, setProjectsList] = useState([]);
  
  const [rawLeads, setRawLeads] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [selectedAllowanceVisit, setSelectedAllowanceVisit] = useState(null);
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [orgBranding, setOrgBranding] = useState({
    orgName: 'FAHAM ESTATE LTD.',
    orgLogo: '',
    orgAddress: 'Corporate Office: Jabbar Tower, Gulshan-1, Dhaka-1212, Bangladesh',
    orgPhone: '+880 2-988XXXX',
    orgEmail: 'info@fahamestate.com'
  });

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const getSubordinateUids = (allUsers, currentUserId) => {
    const currentUser = allUsers.find(u => u.id === currentUserId || u.uid === currentUserId);
    if (!currentUser) return [currentUserId];
    
    const currentName = currentUser.fullName || currentUser.name;
    let subUids = [currentUserId];
    
    const directSubs = allUsers.filter(u => u.reportsTo === currentName && u.id !== currentUserId);
    
    for (const sub of directSubs) {
      const descendants = getSubordinateUids(allUsers, sub.id);
      subUids = [...subUids, ...descendants];
    }
    
    return Array.from(new Set(subUids));
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'projects'));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjectsList(list);
      } catch (err) {
        console.error("Error fetching projects for location matching:", err);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const unsubAllowances = onSnapshot(collection(db, 'visit_allowances'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllowances(list);
    });

    const unsubBranding = onSnapshot(doc(db, 'hr_settings', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrgBranding({
          orgName: data.orgName || 'FAHAM ESTATE LTD.',
          orgLogo: data.orgLogo || '',
          orgAddress: data.orgAddress || 'Corporate Office: Jabbar Tower, Gulshan-1, Dhaka-1212, Bangladesh',
          orgPhone: data.orgPhone || '+880 2-988XXXX',
          orgEmail: data.orgEmail || 'info@fahamestate.com'
        });
      }
    });

    return () => {
      unsubAllowances();
      unsubBranding();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch all users to determine hierarchy
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
        let allLeads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // In-memory filter if needed
        if (!isAdmin && allowedUids.length > 30) {
          allLeads = allLeads.filter(l => allowedUids.includes(l.assignedTo));
        }

        setRawLeads(allLeads);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching visits:", error);
        setIsLoading(false);
      });

      return () => unsubscribeLeads();
    });

    return () => unsubUsers();
  }, [user]);

  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const processedVisits = rawLeads
      .filter(lead => lead.visitDate)
      .map(lead => {
        let type = 'upcoming';
        if (lead.visitStatus === 'Completed') type = 'completed';
        else if (lead.visitDate === todayStr) type = 'today';
        else if (lead.visitDate < todayStr) type = 'missed';

        const matchedAllowance = allowances.find(a => a.leadId === lead.id && a.visitDate === lead.visitDate);

        return {
          ...lead,
          name: lead.fullName || lead.name,
          company: lead.projectName || 'General Lead',
          visitDate: lead.visitDate,
          visitTime: lead.visitTime || '10:00 AM',
          location: lead.visitLocation || 'Not Specified',
          note: lead.visitNote || 'No specific notes',
          type,
          status: lead.visitStatus || 'Confirmed',
          allowanceId: matchedAllowance ? matchedAllowance.id : null,
          allowanceAmount: matchedAllowance ? matchedAllowance.amount : 0,
          allowanceStatus: matchedAllowance ? matchedAllowance.status : 'None'
        };
      });

    setVisits(processedVisits);
  }, [rawLeads, allowances]);

  const handleAction = (visit) => {
    setSelectedVisit(visit);
    setModalStatus(visit.status || 'Confirmed');
    setModalNote(visit.note || '');
    setShowModal(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      // Find matching project for geolocation check
      const matchedProj = projectsList.find(p => p.projectName === selectedVisit.company);

      if (modalStatus === 'Completed' && matchedProj && matchedProj.latitude && matchedProj.longitude) {
        // Enforce geofencing range verification
        showToast("Verifying site geofence location...", "info");
        
        await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const userLat = position.coords.latitude;
              const userLon = position.coords.longitude;
              const dist = calculateDistance(
                userLat,
                userLon,
                parseFloat(matchedProj.latitude),
                parseFloat(matchedProj.longitude)
              );

              if (dist > 200) {
                reject(new Error(`Location check failed. You must be within 200m of the site to mark visit as Completed. Current distance: ${Math.round(dist)}m.`));
              } else {
                resolve(dist);
              }
            },
            (err) => {
              console.error(err);
              reject(new Error("Unable to retrieve GPS coordinates. Please grant location permissions to confirm check-in."));
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      } else if (modalStatus === 'Completed' && (!matchedProj || !matchedProj.latitude || !matchedProj.longitude)) {
        showToast("Warning: No GPS coordinates set for this project. Validation bypassed.", "warning");
      }

      // Update lead visit status in Firestore
      const leadRef = doc(db, 'leads', selectedVisit.id);
      
      const historyEntry = {
        date: new Date().toISOString(),
        action: `Site Visit Status Updated to ${modalStatus}`,
        note: modalNote,
        performedBy: user.fullName || user.name || 'Sales Staff'
      };

      await updateDoc(leadRef, {
        visitStatus: modalStatus,
        visitNote: modalNote,
        history: arrayUnion(historyEntry),
        updatedAt: serverTimestamp()
      });

      showToast(`Visit marked as ${modalStatus} successfully!`, "success");
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update visit status", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestAllowance = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAllowanceVisit || !allowanceAmount) return;
    setIsSaving(true);
    try {
      const dbRef = collection(db, 'visit_allowances');
      await addDoc(dbRef, {
        leadId: selectedAllowanceVisit.id || '',
        leadName: selectedAllowanceVisit.name || 'Client',
        company: selectedAllowanceVisit.company || 'General Project',
        visitDate: selectedAllowanceVisit.visitDate || '',
        visitTime: selectedAllowanceVisit.visitTime || '10:00 AM',
        location: selectedAllowanceVisit.location || 'Not Specified',
        amount: parseFloat(allowanceAmount) || 0,
        status: 'Pending Approval',
        requestedBy: user?.uid || '',
        requestedByName: user?.fullName || user?.name || 'Sales Representative',
        createdAt: serverTimestamp()
      });
      showToast("Visit Allowance request submitted to Accounts!", "success");
      setShowAllowanceModal(false);
      setAllowanceAmount('');
      setSelectedAllowanceVisit(null);
    } catch (err) {
      console.error("Error in handleRequestAllowance:", err);
      showToast(`Failed to request allowance: ${err.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVisits = visits.filter(v => v.type === activeTab && 
    (v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     v.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const paginatedVisits = filteredVisits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const tabs = [
    { id: 'today', label: 'Today', icon: Clock, iconClass: 'icon-clock', count: visits.filter(v => v.type === 'today').length },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarCheck, iconClass: 'icon-check', count: visits.filter(v => v.type === 'upcoming').length },
    { id: 'completed', label: 'Completed', icon: CheckCircle2, iconClass: 'icon-check', count: visits.filter(v => v.type === 'completed').length },
    { id: 'missed', label: 'Missed', icon: AlertCircle, iconClass: 'icon-alert', count: visits.filter(v => v.type === 'missed').length },
  ];

  const renderGridView = () => (
    <div className="followups-grid">
      {paginatedVisits.map(item => (
        <Card key={item.id} className="followup-item-card">
          <div className="item-main">
            <div className="item-time-box">
              <span className="time-text">{item.visitTime}</span>
              <span className="date-text">{item.visitDate}</span>
            </div>
            
            <div className="item-details">
              <div className="lead-info">
                <h3 className="lead-name">{item.name}</h3>
                <span className="lead-company">{item.company}</span>
                <span className={`priority-badge ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
              <div className="item-sub-info">
                <div className="sub-info-item">
                  <MapPin size={12} />
                  <span>{item.location}</span>
                </div>
              </div>
              <p className="last-note">
                <strong>Meeting Goal:</strong> {item.note}
              </p>
              {item.history && item.history.length > 0 && (
                <div 
                  className="card-last-note-box" 
                  style={{ marginTop: '12px', padding: '10px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageCircle size={14} className="note-icon" />
                    <div className="note-content" style={{ flex: 1 }}>
                      <span className="note-label">Last Follow Up Message</span>
                      {!expandedHistory[item.id] && (
                        <p className="note-text" style={{ margin: 0, fontSize: '0.8rem' }}>
                          {item.history[item.history.length - 1].note}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {expandedHistory[item.id] ? 'Collapse' : 'Expand'}
                    </span>
                  </div>

                  {expandedHistory[item.id] && (
                    <div className="history-timeline-expanded" style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                      {item.history.map((hist, hIdx) => (
                        <div key={hIdx} className="timeline-item" style={{ position: 'relative', paddingLeft: '16px', marginBottom: '8px', borderLeft: '1px dashed var(--border)' }}>
                          <div style={{ position: 'absolute', left: '-4px', top: '4px', width: '7px', height: '7px', borderRadius: '50%', background: hist.type === 'Follow-up' ? 'var(--primary)' : '#10b981' }}></div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <span>{formatDateTime(hist.date)}</span>
                            {hist.createdBy && <span>By: {hist.createdBy}</span>}
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {hist.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="item-actions">
            <div className="contact-actions">
              <a href={`https://wa.me/${item.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" className="action-circle whatsapp icon-whatsapp"><WhatsAppIcon size={16} /></a>
              <a href={`tel:${item.phone?.replace(/[^\d+]/g, '')}`} className="action-circle call icon-call"><Phone size={16} /></a>
              <a href={`mailto:${item.email}`} className="action-circle email icon-email"><Mail size={16} /></a>
            </div>
            <div className="visit-flow-actions">
              {item.allowanceStatus === 'None' || item.allowanceStatus === 'Rejected' ? (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  icon={FileText} 
                  onClick={() => {
                    setSelectedAllowanceVisit(item);
                    setShowAllowanceModal(true);
                  }}
                >
                  Request Allowance
                </Button>
              ) : item.allowanceStatus === 'Pending Approval' ? (
                <div className="allowance-badge-wrap">
                  <div className="badge-allowance-pending">
                    Pending: {item.allowanceAmount} BDT
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={Printer} 
                    onClick={() => {
                      setSelectedVoucherVisit(item);
                      setShowVoucherModal(true);
                    }}
                  >
                    Print
                  </Button>
                </div>
              ) : item.allowanceStatus === 'Approved' ? (
                <div className="allowance-badge-wrap">
                  <div className="badge-allowance-approved">
                    Approved: {item.allowanceAmount} BDT
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    icon={Printer} 
                    onClick={() => {
                      setSelectedVoucherVisit(item);
                      setShowVoucherModal(true);
                    }}
                  >
                    Print
                  </Button>
                </div>
              ) : null}

              {item.status === 'Completed' ? (
                <div className="badge-completed-status">
                  Visit Completed
                </div>
              ) : (
                <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => handleAction(item)}>Mark Done</Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="list-view-container">
      <div className="table-container">
        <table className="leads-table">
        <thead>
          <tr>
            <th>Client Info</th>
            <th>Visit Schedule</th>
            <th>Site Location</th>
            <th>Status</th>
            <th>Notes</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedVisits.map(item => (
            <tr key={item.id}>
              <td>
                <div className="table-name-cell">
                  <div className="table-avatar">{item.name[0]}</div>
                  <div className="name-details">
                    <span className="name-text">{item.name}</span>
                    <span className="email-subtext">{item.company || 'General Lead'}</span>
                    <div className="table-quick-actions">
                      <a href={`https://wa.me/${item.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" className="t-action whatsapp"><WhatsAppIcon size={12} /></a>
                      <a href={`tel:${item.phone?.replace(/[^\d+]/g, '')}`} className="t-action call"><Phone size={12} /></a>
                      <a href={`mailto:${item.email}`} className="t-action email"><Mail size={12} /></a>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span className="t-date">{item.visitDate}</span>
                  <span className="t-time" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.visitTime}</span>
                </div>
              </td>
              <td>
                <div className="table-icon-cell">
                  <MapPin size={14} />
                  <span>{item.location}</span>
                </div>
              </td>
              <td>
                <span className={`priority-badge ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </td>
              <td>
                <div 
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedHistory(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                  }}
                >
                  <p className="table-note-cell" style={{ margin: 0 }}>
                    <strong>Goal:</strong> {item.note}
                  </p>
                  {item.history && item.history.length > 0 && (
                    <>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          <strong style={{ color: 'var(--primary)' }}>Last Follow Up:</strong> {item.history[item.history.length - 1].note}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', marginLeft: '8px', fontWeight: 600 }}>
                          {expandedHistory[item.id] ? 'Collapse' : 'Click to see history'}
                        </span>
                      </p>
                      {expandedHistory[item.id] && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
                          {item.history.map((hist, hIdx) => (
                            <div key={hIdx} style={{ position: 'relative', paddingLeft: '12px', marginBottom: '6px', borderLeft: '1px dashed var(--border)' }}>
                              <div style={{ position: 'absolute', left: '-3px', top: '4px', width: '5px', height: '5px', borderRadius: '50%', background: hist.type === 'Follow-up' ? 'var(--primary)' : '#10b981' }}></div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                <span>{formatDateTime(hist.date)}</span>
                                {hist.createdBy && <span>By: {hist.createdBy}</span>}
                              </div>
                              <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {hist.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </td>
              <td>
                <div className="table-actions" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {item.allowanceStatus === 'None' || item.allowanceStatus === 'Rejected' ? (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      icon={FileText} 
                      onClick={() => {
                        setSelectedAllowanceVisit(item);
                        setShowAllowanceModal(true);
                      }}
                    >
                      Request Allowance
                    </Button>
                  ) : item.allowanceStatus === 'Pending Approval' ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>
                        Pending (BDT {item.allowanceAmount})
                      </span>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon={Printer} 
                        onClick={() => {
                          setSelectedVoucherVisit(item);
                          setShowVoucherModal(true);
                        }}
                      >
                        Print Slip
                      </Button>
                    </div>
                  ) : item.allowanceStatus === 'Approved' ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                        BDT {item.allowanceAmount}
                      </span>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon={Printer} 
                        onClick={() => {
                          setSelectedVoucherVisit(item);
                          setShowVoucherModal(true);
                        }}
                      >
                        Print Slip
                      </Button>
                    </div>
                  ) : null}

                  {item.status === 'Completed' ? (
                    <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, background: '#e0f2fe', padding: '4px 8px', borderRadius: '4px' }}>
                      Completed
                    </span>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => handleAction(item)}>Mark Done</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="followups-container">
        <LeadTabs />
        <div className="followups-header">
          <div className="header-info">
            <h1>Site Visits & Appointments</h1>
            <p>Manage scheduled property viewings and client meetings.</p>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search visits..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={18} /></button>
              <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Layout size={18} /></button>
            </div>
          </div>
        </div>

        <div className="followups-tabs">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setCurrentPage(1);
              }}
            >
              <tab.icon size={18} className={tab.iconClass} />
              <span className="tab-label">{tab.label}</span>
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="followups-content">
          {filteredVisits.length > 0 ? (
            viewMode === 'grid' ? renderGridView() : renderListView()
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Map size={48} />
              </div>
              <h3>No visits found</h3>
              <p>Everything is clear in this section.</p>
            </div>
          )}
        </div>

        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(filteredVisits.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          totalItems={filteredVisits.length}
          itemsPerPage={itemsPerPage}
        />

        {/* Action Modal */}
        <Modal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)}
          title="Update Visit Status"
          className="glass-modal"
        >
          {selectedVisit && (
            <div className="new-lead-form">
              <div className="update-target-info">
                <div className="target-avatar">{selectedVisit.name[0]}</div>
                <div className="target-meta">
                  <div className="target-name">{selectedVisit.name}</div>
                  <div className="target-status">{selectedVisit.location}</div>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Update Status</label>
                <div className="priority-select-wrapper">
                  <CheckCircle2 className="input-icon" size={18} />
                  <select 
                    className="custom-select-field"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                  >
                    <option value="Confirmed">Mark as Confirmed</option>
                    <option value="Completed">Mark as Completed (Requires Geofence verification)</option>
                    <option value="Missed">Mark as Missed</option>
                    <option value="Rescheduled">Rescheduled</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Internal Meeting Note</label>
                <div className="textarea-wrapper">
                  <MessageCircle className="textarea-icon" size={18} />
                  <textarea 
                    className="custom-textarea" 
                    placeholder="Enter visit feedback or outcomes..."
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="form-actions mt-4">
                <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isSaving}>Cancel</Button>
                <Button variant="primary" onClick={handleSaveStatus} isLoading={isSaving}>Save Changes</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Project Visit Allowance Payslip / Voucher Modal */}
        <Modal
          isOpen={showVoucherModal}
          onClose={() => setShowVoucherModal(false)}
          title="Print Project Visit Slip"
          className="glass-modal"
        >
          {selectedVoucherVisit && (
            <div>
              <div className="payslip-print-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <Button variant="secondary" onClick={() => setShowVoucherModal(false)}>Close</Button>
                <Button 
                  variant="primary" 
                  icon={Printer} 
                  onClick={() => {
                    window.print();
                  }}
                >
                  Print Voucher
                </Button>
              </div>

              {/* Company Pad Print Area */}
              <div className="visit-voucher-print-area">
                {selectedVoucherVisit.allowanceStatus === 'Approved' && (
                  <div className="voucher-watermark">APPROVED</div>
                )}
                 <div className="voucher-header-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                  {orgBranding.orgLogo && (
                    <img src={orgBranding.orgLogo} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                  )}
                  <h1>{orgBranding.orgName}</h1>
                  <p>{orgBranding.orgAddress}</p>
                  {(orgBranding.orgPhone || orgBranding.orgEmail) && (
                    <p style={{ fontSize: '0.8rem', marginTop: '-4px' }}>
                      {orgBranding.orgPhone && `Phone: ${orgBranding.orgPhone}`} 
                      {orgBranding.orgPhone && orgBranding.orgEmail && ' | '}
                      {orgBranding.orgEmail && `Email: ${orgBranding.orgEmail}`}
                    </p>
                  )}
                  <div className="voucher-title-chip" style={{ marginTop: '12px' }}>
                    Project Visit Allowance Voucher
                  </div>
                </div>

                <div className="voucher-details-grid">
                  <div className="voucher-col">
                    <span>Voucher No:</span>
                    <strong>FE-PVV-{selectedVoucherVisit.id.substring(0, 6).toUpperCase()}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Date:</span>
                    <strong>{new Date().toLocaleDateString('en-GB')}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Executive Name:</span>
                    <strong>{selectedVoucherVisit.assignedToName || user.fullName || user.name}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Client Name:</span>
                    <strong>{selectedVoucherVisit.name}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Visited Project:</span>
                    <strong>{selectedVoucherVisit.company}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Visit Date & Time:</span>
                    <strong>{selectedVoucherVisit.visitDate} at {selectedVoucherVisit.visitTime}</strong>
                  </div>
                </div>

                <table className="voucher-table">
                  <thead>
                    <tr>
                      <th>Allowance Description</th>
                      <th style={{ textAlign: 'right' }}>Amount (BDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Conveyance & Visit Allowance</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Standard visit allowance for client site viewing at {selectedVoucherVisit.location}.
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{selectedVoucherVisit.allowanceAmount || '0.00'}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Geofence Verification Status</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                          Verified: Within 200m radius of project coordinates.
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>VERIFIED</td>
                    </tr>
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                      <td style={{ borderTop: '2px solid #1e3a8a' }}>Total Allowance Payable:</td>
                      <td style={{ textAlign: 'right', borderTop: '2px solid #1e3a8a', color: '#1e3a8a' }}>BDT {selectedVoucherVisit.allowanceAmount || '0.00'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '20px', fontSize: '0.875rem' }}>
                  <strong>Visit Report / Notes:</strong>
                  <p style={{ margin: '5px 0 0 0', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontStyle: 'italic' }}>
                    "{selectedVoucherVisit.note || 'No specific notes recorded.'}"
                  </p>
                </div>

                <div className="voucher-footer-signatures">
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Prepared By</span>
                  </div>
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Verified (Accounts)</span>
                  </div>
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Managing Director / Authorised</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Request Visit Allowance Modal */}
        <Modal
          isOpen={showAllowanceModal}
          onClose={() => setShowAllowanceModal(false)}
          title="Apply for Visit Allowance"
          className="glass-modal"
        >
          {selectedAllowanceVisit && (
            <form onSubmit={handleRequestAllowance} className="new-lead-form">
              <div className="update-target-info">
                <div className="target-avatar">{selectedAllowanceVisit.name[0]}</div>
                <div className="target-meta">
                  <div className="target-name">{selectedAllowanceVisit.name}</div>
                  <div className="target-status">Project: {selectedAllowanceVisit.company}</div>
                </div>
              </div>

              <div className="form-group mt-3">
                <label className="form-label">Allowance Amount (BDT)</label>
                <div className="priority-select-wrapper">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-muted)', width: '18px', height: '18px' }}>৳</span>
                  <input
                    type="number"
                    className="custom-select-field"
                    placeholder="Enter amount in BDT (e.g. 800)"
                    value={allowanceAmount}
                    onChange={(e) => setAllowanceAmount(e.target.value)}
                    required
                    min="1"
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>

              <div className="form-actions mt-4">
                <Button variant="secondary" onClick={() => setShowAllowanceModal(false)} disabled={isSaving}>Cancel</Button>
                <Button variant="primary" type="submit" isLoading={isSaving}>Submit Request</Button>
              </div>
            </form>
          )}
        </Modal>

        {toastConfig.show && (
          <Toast 
            message={toastConfig.message} 
            type={toastConfig.type} 
            onClose={() => setToastConfig({ ...toastConfig, show: false })} 
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Visits;
