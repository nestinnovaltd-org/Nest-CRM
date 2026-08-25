import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import { motion } from 'framer-motion';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  Clock, 
  History, 
  CreditCard, 
  Handshake, 
  User,
  MoreVertical,
  MessageCircle,
  ExternalLink,
  Calendar,
  Plus,
  AlertCircle,
  Car,
  RefreshCcw,
  PlusCircle,
  Edit,
  Camera
} from 'lucide-react';
import { WhatsAppIcon } from '../components/ui/Icons';
import './LeadDetails.css';

const getSubordinateUids = (allUsers, currentUserId) => {
  const user = allUsers.find(u => u.id === currentUserId || u.uid === currentUserId);
  if (!user) return [currentUserId];
  
  const currentName = user.fullName || user.name;
  let subUids = [currentUserId];
  
  const directSubs = allUsers.filter(u => u.reportsTo === currentName && u.id !== currentUserId);
  
  for (const sub of directSubs) {
    const descendants = getSubordinateUids(allUsers, sub.id);
    subUids = [...subUids, ...descendants];
  }
  
  return Array.from(new Set(subUids));
};

const getAllowedTransferUids = (currentUser, usersList, teams) => {
  const isAdmin = ['Admin', 'MD', 'System Admin'].includes(currentUser?.role);
  if (isAdmin) {
    return usersList.map(u => u.uid || u.id).filter(Boolean);
  }

  const currentUid = currentUser?.uid || currentUser?.id;
  const currentUserName = currentUser?.fullName || currentUser?.name || '';
  
  // 1. Subordinates down the hierarchy
  const subUids = getSubordinateUids(usersList, currentUid);
  
  // 2. Members of the teams managed by or participated in by the current user
  const relevantTeams = teams.filter(t => {
    const leads = t.teamLeads || (t.teamLead ? [t.teamLead] : []);
    const members = t.members || [];
    return leads.includes(currentUserName) || members.includes(currentUserName);
  });
  
  const teamMemberNames = new Set();
  relevantTeams.forEach(t => {
    const leads = t.teamLeads || (t.teamLead ? [t.teamLead] : []);
    const members = t.members || [];
    leads.forEach(l => teamMemberNames.add(l));
    members.forEach(m => teamMemberNames.add(m));
  });
  
  const teamUids = usersList
    .filter(u => teamMemberNames.has(u.fullName || u.name))
    .map(u => u.uid || u.id)
    .filter(Boolean);

  // 3. Anyone who directly reportsTo the current user
  const reportsToUids = usersList
    .filter(u => u.reportsTo === currentUserName)
    .map(u => u.uid || u.id)
    .filter(Boolean);

  const combined = Array.from(new Set([
    currentUid,
    ...subUids,
    ...teamUids,
    ...reportsToUids
  ]));

  return combined;
};

const LeadUpdateModal = ({ isOpen, onClose, lead, newStatus, onConfirm }) => {
  const [note, setNote] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [priority, setPriority] = useState('Normal');
  
  const [isAppointment, setIsAppointment] = useState(false);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [assigneeId, setAssigneeId] = useState(lead?.assignedTo || '');
  const [teamUsers, setTeamUsers] = useState([]);

  const { user: currentUser } = useAuth();
  const [teamsList, setTeamsList] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*');
      setTeamUsers(data || []);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('*');
      setTeamsList(data || []);
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    if (lead) setAssigneeId(lead.assignedTo);
  }, [lead, isOpen]);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
      setAllProjects(data || []);
    };
    if (isOpen) fetchProjects();
  }, [isOpen]);

  const filteredProjects = React.useMemo(() => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'MD' || currentUser?.role === 'System Admin';
    if (isAdmin) return allProjects;

    const userName = currentUser?.fullName || currentUser?.name || '';
    const userTeams = teamsList.filter(team => 
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
      return allProjects.filter(p => assignedProjects.includes(p.projectName));
    }

    return allProjects;
  }, [allProjects, currentUser, teamsList]);

  const toggleProject = (projectName) => {
    setSelectedProjects(prev => 
      prev.includes(projectName) 
        ? prev.filter(p => p !== projectName)
        : [...prev, projectName]
    );
  };

  if (!lead) return null;

  const isFollowUpOnly = lead.status === newStatus;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isFollowUpOnly ? 'Add Follow-up Entry' : `Update Status: ${newStatus === 'Released' ? 'Move to Junk' : newStatus}`}
      className="glass-modal"
    >
      <div className="status-update-form">
        <div className="update-target-info" style={{ padding: '8px 12px', gap: '8px', borderRadius: '12px', marginBottom: '4px' }}>
          <div className="target-avatar" style={{ width: '32px', height: '32px', fontSize: '0.875rem', borderRadius: '8px' }}>{lead.name[0]}</div>
          <div>
            <p className="target-name" style={{ fontSize: '0.875rem', lineHeight: '1.2' }}>{lead.name}</p>
            <p className="target-status">
              {isFollowUpOnly ? (
                <>Logging additional <strong>Follow-up</strong></>
              ) : (
                <>Moving from <strong>{lead.status === 'Released' ? 'Junk Lead' : lead.status}</strong> to <strong>{newStatus === 'Released' ? 'Move to Junk' : newStatus}</strong></>
              )}
            </p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Follow-up Note / Message</label>
          <div className="textarea-wrapper">
            <textarea 
              placeholder="What happened in this follow-up?" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="custom-textarea"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Next Follow-up Date</label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input 
                type="date" 
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="custom-input-field"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Set Priority</label>
            <div className="priority-select-wrapper">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="custom-select-field"
              >
                <option value="Normal">Normal</option>
                <option value="High Priority">High Priority</option>
                <option value="Urgent">Urgent</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Clients Interests (Projects)</label>
          <div className="interests-selection-grid">
            {filteredProjects.map(project => (
              <div 
                key={project.id}
                className={`interest-checkbox-card ${selectedProjects.includes(project.projectName) ? 'selected' : ''}`}
                onClick={() => toggleProject(project.projectName)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedProjects.includes(project.projectName)}
                  onChange={() => {}} 
                />
                <span>{project.projectName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group mt-4">
          <div className="appointment-toggle-section">
            <label className="toggle-v3">
              <input 
                type="checkbox" 
                checked={isAppointment}
                onChange={(e) => setIsAppointment(e.target.checked)}
              />
              <div className="slider"></div>
              <span className="toggle-label">Schedule Appointment / Site Visit</span>
            </label>
          </div>

          {isAppointment && (
            <div className="appointment-details-grid mt-4">
              <div className="form-group">
                <label className="form-label">Visit Date</label>
                <input 
                  type="date" 
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="custom-input-field"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Visit Time</label>
                <input 
                  type="time" 
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="custom-input-field"
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Visit Location / Plot No.</label>
                <input 
                  type="text" 
                  placeholder="e.g. Plot 45, Sector 12" 
                  value={appointmentLocation}
                  onChange={(e) => setAppointmentLocation(e.target.value)}
                  className="custom-input-field"
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Assign for this action</label>
          <select 
            className="custom-select-field"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Select Assignee</option>
            {teamUsers
              .filter(u => {
                const allowedUids = getAllowedTransferUids(currentUser, teamUsers, teamsList);
                return allowedUids.includes(u.uid || u.id);
              })
              .map(u => (
                <option key={u.id} value={u.uid || u.id}>
                  {u.fullName || u.name} ({u.role})
                </option>
              ))
            }
          </select>
          <p className="field-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Ownership will remain with {lead.ownerName || 'the original owner'}.
          </p>
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm({ 
            note, 
            appointmentDate, 
            appointmentTime,
            appointmentLocation,
            isAppointment,
            nextFollowUp, 
            priority,
            interests: selectedProjects,
            assignedTo: assigneeId
          })}>Save Update</Button>
        </div>
      </div>
    </Modal>
  );
};

const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('follow-ups');

  const [lead, setLead] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [deals, setDeals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignInstruction, setAssignInstruction] = useState('');

  useEffect(() => {
    if (lead?.assignedTo) {
      setAssigneeId(lead.assignedTo);
    }
  }, [lead]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max 5MB allowed.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          try {
            await supabase.from('leads').update({
              image: compressedBase64,
              updated_at: new Date().toISOString()
            }).eq('id', id);
          } catch (err) {
            console.error('Error updating profile image: ', err);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAssignConfirm = async (e) => {
    e.preventDefault();
    if (!assigneeId) return;
    try {
      const assignedUser = usersList.find(u => u.uid === assigneeId || u.id === assigneeId);
      const assignedToName = assignedUser ? (assignedUser.full_name || assignedUser.fullName || assignedUser.name) : 'Unassigned';

      const historyRecord = {
        date: new Date().toISOString(),
        note: `Lead reassigned to ${assignedToName} by ${currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Admin'}.${assignInstruction ? ` Instruction: ${assignInstruction}` : ''}`,
        type: 'Assignment',
        createdBy: currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Admin'
      };

      const newHistory = [...(lead.history || []), historyRecord];

      await supabase.from('leads').update({
        assigned_to: assigneeId,
        assigned_to_name: assignedToName,
        last_assigned_at: new Date().toISOString(),
        history: newHistory,
        assigned_by_name: currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Admin'
      }).eq('id', id);

      await supabase.from('notifications').insert({
        user_id: assigneeId,
        title: 'New Lead Assigned',
        message: `${currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'Admin'} assigned you a lead: ${lead.name}.${assignInstruction ? ` \nInstruction: ${assignInstruction}` : ''}`,
        type: 'assignment',
        lead_id: id,
        is_read: false,
        created_at: new Date().toISOString()
      });

      setShowAssignModal(false);
      setAssignInstruction('');
    } catch (error) {
      console.error('Error changing sales person:', error);
    }
  };
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    phoneWhatsapp: false,
    secondPhone: '',
    secondPhoneWhatsapp: false,
    location: '',
    area: '',
    address: '',
    company: '',
    designation: '',
    image: '',
    interests: []
  });

  useEffect(() => {
    if (lead) {
      setEditForm({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone?.replace(/^\+880\s*/, '') || '',
        phoneWhatsapp: lead.phoneWhatsapp || false,
        secondPhone: lead.secondPhone?.replace(/^\+880\s*/, '') || '',
        secondPhoneWhatsapp: lead.secondPhoneWhatsapp || false,
        location: lead.location || '',
        area: lead.area || '',
        address: lead.address || '',
        company: lead.company || '',
        designation: lead.designation || '',
        image: lead.image || '',
        interests: lead.interests || []
      });
    }
  }, [lead, isEditModalOpen]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      let formattedPhone = editForm.phone;
      if (formattedPhone && !formattedPhone.startsWith('+880')) {
        formattedPhone = '+880 ' + formattedPhone.replace(/\D/g, '');
      }
      let formattedSecondPhone = editForm.secondPhone;
      if (formattedSecondPhone && !formattedSecondPhone.startsWith('+880')) {
        formattedSecondPhone = '+880 ' + formattedSecondPhone.replace(/\D/g, '');
      }

      await supabase.from('leads').update({
        name: editForm.name,
        email: editForm.email,
        phone: formattedPhone,
        phone_whatsapp: editForm.phoneWhatsapp,
        second_phone: formattedSecondPhone,
        second_phone_whatsapp: editForm.secondPhoneWhatsapp,
        location: editForm.location,
        area: editForm.area,
        address: editForm.address,
        company: editForm.company,
        designation: editForm.designation,
        image: editForm.image || '',
        interests: editForm.interests || [],
        updated_at: new Date().toISOString()
      }).eq('id', id);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating lead details:', error);
    }
  };
  const [usersList, setUsersList] = useState([]);
  const [teamShares, setTeamShares] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('*');
      setTeams(data || []);
    };
    fetchTeams();
  }, [currentUser]);

  useEffect(() => {
    if (!id || !currentUser) return;

    const fetchLeadAndUsers = async () => {
      const { data: allUsers } = await supabase.from('users').select('*');
      setUsersList(allUsers || []);
      const isAdmin = ['Admin', 'MD', 'System Admin'].includes(currentUser?.role);

      const { data: leadData } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
      if (leadData) {
        if (isAdmin) {
          setLead(leadData);
          setIsAuthorized(true);
        } else {
          const allowedUids = getAllowedTransferUids(currentUser, allUsers || [], teams);
          if (allowedUids.includes(leadData.assigned_to || leadData.assignedTo)) {
            setLead(leadData);
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        }
      } else {
        setLead(null);
      }
      setIsLoading(false);
    };

    fetchLeadAndUsers();
    const ch = supabase.channel(`lead-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${id}` }, fetchLeadAndUsers)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id, currentUser, teams]);

  // Fetch Deals
  useEffect(() => {
    if (!id) return;
    const fetchDeals = async () => {
      const { data } = await supabase.from('deals').select('*').or(`lead_id.eq.${id},leadId.eq.${id}`);
      setDeals(data || []);
      setLoadingDeals(false);
    };
    fetchDeals();
    const ch = supabase.channel(`lead-deals-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, fetchDeals)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id]);

  const [rawProjectsList, setRawProjectsList] = useState([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
        setRawProjectsList(data || []);
      } catch (err) {
        console.error('Error fetching projects in LeadDetails:', err);
      }
    };
    fetchProjects();
  }, []);

  const projectsList = React.useMemo(() => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'MD' || currentUser?.role === 'System Admin';
    if (isAdmin) return rawProjectsList;

    const userName = currentUser?.full_name || currentUser?.fullName || currentUser?.name || '';
    const userTeams = teams.filter(team =>
      (team.members && team.members.includes(userName)) ||
      (team.team_leads && team.team_leads.includes(userName)) ||
      (team.teamLeads && team.teamLeads.includes(userName)) ||
      team.team_lead === userName || team.teamLead === userName
    );

    if (userTeams.length > 0) {
      const assignedProjects = [];
      userTeams.forEach(t => { if (t.assigned_projects || t.assignedProjects) assignedProjects.push(...(t.assigned_projects || t.assignedProjects)); });
      return rawProjectsList.filter(p => assignedProjects.includes(p.project_name || p.projectName));
    }

    return rawProjectsList;
  }, [rawProjectsList, currentUser, teams]);

  // Fetch Payments
  useEffect(() => {
    if (!id) return;
    const fetchPayments = async () => {
      const { data } = await supabase.from('payments').select('*').or(`lead_id.eq.${id},leadId.eq.${id}`);
      setPayments(data || []);
      setLoadingPayments(false);
    };
    fetchPayments();
    const ch = supabase.channel(`lead-payments-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [id]);

  const handleFollowUpConfirm = async (data) => {
    try {
      const now = new Date();
      const historyEntry = {
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: data.isAppointment ? 'Appointment' : 'Follow-up',
        note: data.note,
        status: lead?.status || 'Fresh Lead',
        createdBy: currentUser?.full_name || currentUser?.fullName || currentUser?.name || 'User',
        interests: data.interests || []
      };

      const newHistory = [...(lead.history || []), historyEntry];

      const updatePayload = {
        status: lead.status === 'Fresh Lead' ? 'Follow Up' : lead.status,
        next_follow_up_date: data.nextFollowUp || lead.next_follow_up_date || lead.nextFollowUpDate || '',
        next_follow_up_time: data.appointmentTime || lead.next_follow_up_time || lead.nextFollowUpTime || '09:00 AM',
        priority: data.priority,
        history: newHistory,
        updated_at: new Date().toISOString(),
        interests: data.interests || []
      };

      if (data.isAppointment) {
        updatePayload.visit_date = data.appointmentDate;
        updatePayload.visit_time = data.appointmentTime;
        updatePayload.visit_location = data.appointmentLocation;
        updatePayload.visit_note = data.note;
        updatePayload.visit_status = 'Confirmed';
      }

      if (data.assignedTo && data.assignedTo !== (lead.assigned_to || lead.assignedTo)) {
        updatePayload.assigned_to = data.assignedTo;
        const assigneeUser = teamUsers.find(u => (u.uid || u.id) === data.assignedTo);
        if (assigneeUser) {
          updatePayload.assigned_to_name = assigneeUser.full_name || assigneeUser.fullName || assigneeUser.name;
        }

        await supabase.from('notifications').insert({
          user_id: data.assignedTo,
          title: 'Lead Action Assigned',
          description: `You have been assigned to handle a ${data.isAppointment ? 'Visit' : 'Follow-up'} for ${lead.name} by ${currentUser?.full_name || currentUser?.fullName || currentUser?.name}.`,
          type: 'lead',
          is_read: false,
          created_at: new Date().toISOString(),
          link: `/leads/details/${id}`
        });
      }

      await supabase.from('leads').update(updatePayload).eq('id', id);
      setShowFollowUpModal(false);
    } catch (error) {
      console.error('Error updating follow-up:', error);
    }
  };

  const [dealData, setDealData] = useState({
    projectId: '',
    unitNo: '',
    floorSize: '',
    pricePerSqft: '',
    value: '',
    downPaymentPercent: '20',
    downPaymentAmount: '',
    downPaymentDate: new Date().toISOString().split('T')[0],
    incentiveThresholdPercent: '30',
    hasTeamIncentive: false,
    status: 'Confirmed',
    numberOfInstallments: '',
    installmentStartDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const size = parseFloat(dealData.floorSize || 0);
    const price = parseFloat(dealData.pricePerSqft || 0);
    if (size > 0 && price > 0) {
      setDealData(prev => ({
        ...prev,
        value: (size * price).toString()
      }));
    }
  }, [dealData.floorSize, dealData.pricePerSqft]);

  useEffect(() => {
    const val = parseFloat(dealData.value || 0);
    const pct = parseFloat(dealData.downPaymentPercent || 0);
    if (val && pct) {
      setDealData(prev => ({
        ...prev,
        downPaymentAmount: Math.round((val * pct) / 100).toString()
      }));
    }
  }, [dealData.value, dealData.downPaymentPercent]);

  const generateInstallments = () => {
    const total = parseFloat(dealData.value || 0);
    const downPayment = parseFloat(dealData.downPaymentAmount || 0);
    const numInstallments = parseInt(dealData.numberOfInstallments || 0);
    const startDate = dealData.installmentStartDate;

    if (!total || numInstallments <= 0 || !startDate) return [];

    const remaining = total - downPayment;
    if (remaining <= 0) return [];
    
    const perInstallment = Math.round(remaining / numInstallments);
    let currentDue = remaining;
    
    const installments = [];
    const start = new Date(startDate);
    
    for (let i = 1; i <= numInstallments; i++) {
      currentDue -= perInstallment;
      const amount = (i === numInstallments) ? perInstallment + currentDue : perInstallment;
      const actualDue = (i === numInstallments) ? 0 : currentDue;
      
      const date = new Date(start);
      date.setMonth(start.getMonth() + (i - 1));

      installments.push({
        installmentNumber: i,
        date: date.toISOString().split('T')[0],
        amount: amount,
        dueBalance: actualDue
      });
    }
    return installments;
  };

  const handleDealSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedProject = projectsList.find(p => p.id === dealData.projectId);
      const projectName = selectedProject ? (selectedProject.project_name || selectedProject.projectName || 'General Project') : 'General Project';
      const calculatedInstallments = generateInstallments();

      await supabase.from('deals').insert({
        lead_id: id,
        lead_name: lead?.name || 'Unknown Lead',
        project_id: dealData.projectId,
        project_name: projectName,
        unit_no: dealData.unitNo,
        floor_size: parseFloat(dealData.floorSize || 0),
        price_per_sqft: parseFloat(dealData.pricePerSqft || 0),
        value: parseFloat(dealData.value || 0),
        down_payment_percent: parseFloat(dealData.downPaymentPercent || 0),
        down_payment_amount: parseFloat(dealData.downPaymentAmount || 0),
        down_payment_date: dealData.downPaymentDate,
        incentive_threshold_percent: parseFloat(dealData.incentiveThresholdPercent || 0),
        has_team_incentive: dealData.hasTeamIncentive,
        team_shares: dealData.hasTeamIncentive ? teamShares : [],
        number_of_installments: parseInt(dealData.numberOfInstallments || 0),
        installment_start_date: dealData.installmentStartDate,
        installments: calculatedInstallments,
        status: dealData.status,
        created_at: new Date().toISOString(),
        created_by: currentUser?.uid || currentUser?.id,
        created_by_name: currentUser?.full_name || currentUser?.fullName || currentUser?.name
      });

      if (dealData.projectId) {
        const currentQty = parseInt(selectedProject?.total_apartments || selectedProject?.totalApartments || 0);
        if (currentQty > 0) {
          await supabase.from('projects').update({
            total_apartments: currentQty - 1,
            updated_at: new Date().toISOString()
          }).eq('id', dealData.projectId);
        }
      }

      await supabase.from('leads').update({
        status: 'Sold',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      setShowDealModal(false);
      setTeamShares([]);
      setDealData({
        projectId: '', unitNo: '', floorSize: '', pricePerSqft: '', value: '',
        downPaymentPercent: '20', downPaymentAmount: '',
        downPaymentDate: new Date().toISOString().split('T')[0],
        incentiveThresholdPercent: '30', hasTeamIncentive: false, status: 'Confirmed',
        numberOfInstallments: '', installmentStartDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error creating deal:', error);
    }
  };

  const [paymentData, setPaymentData] = useState({ amount: '', type: 'Cash', status: 'Completed', date: new Date().toISOString().split('T')[0] });
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('payments').insert({
        ...paymentData,
        lead_id: id,
        created_at: new Date().toISOString()
      });
      setShowPaymentModal(false);
      setPaymentData({ amount: '', type: 'Cash', status: 'Completed', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  const tabs = [
    { id: 'follow-ups', label: 'Follow-ups', icon: History },
    { id: 'deals', label: 'Confirmed Deals', icon: Handshake },
    { id: 'payments', label: 'Payment History', icon: CreditCard },
  ];

  const handleWhatsApp = () => {
    if (!lead?.phone) return;
    const phone = lead.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const handleCall = () => {
    if (!lead?.phone) return;
    window.location.href = `tel:${lead.phone.replace(/[^\d+]/g, '')}`;
  };

  const handleEmail = () => {
    if (!lead?.email) return;
    window.location.href = `mailto:${lead.email}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      // If it's an ISO string or similar
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="lead-profile-container" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-state" style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            <Clock className="animate-spin" style={{ marginRight: '10px' }} />
            Loading lead details...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="lead-profile-container" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="error-state" style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Lead Not Found</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>The lead you are looking for does not exist or has been removed.</p>
            <Button onClick={() => navigate('/leads/mine')}>Back to My Leads</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="lead-profile-container">
        {/* Navigation Header */}
        <div className="lead-details-nav-header">
          <button className="lead-details-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
            <span>Back to Leads</span>
          </button>
          <div className="lead-details-header-actions">
            <Button variant="secondary" icon={ExternalLink}>Export Profile</Button>
            <Button variant="primary" icon={Edit} onClick={() => setIsEditModalOpen(true)}>Edit Details</Button>
          </div>
        </div>

        <div className="profile-grid">
          {/* Left Column: Profile Info & Sales Person */}
          <div className="profile-sidebar">
            <Card className="profile-main-card" style={{ position: 'relative' }}>
              <button 
                className="profile-edit-btn-inline" 
                onClick={() => setIsEditModalOpen(true)}
                title="Edit Details"
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s',
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <Edit size={14} />
              </button>
              <div className="profile-header-info">
                <div className="profile-avatar-wrapper">
                  <div className="profile-avatar">
                    {lead?.image ? (
                      <img 
                        src={lead.image} 
                        alt={lead.name} 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <span>{(lead?.name || 'L')[0]}</span>
                    )}
                  </div>
                  <label className="avatar-edit-label" title="Upload profile picture">
                    <Camera size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
                <div className="profile-meta-details">
                  <h2>{lead?.name || 'Unnamed Lead'}</h2>
                  <p className="designation-text">{lead?.designation || 'Lead'} at {lead?.company || 'N/A'}</p>
                  <span className={`status-pill ${(lead?.status || 'Fresh Lead').toLowerCase().replace(/ /g, '-')}`}>
                    {lead?.status === 'Released' ? 'Junk Lead' : (lead?.status || 'Fresh Lead')}
                  </span>
                </div>
              </div>

              <div className="contact-details-list">
                <div className="contact-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={16} className="icon-call" />
                    <span>{lead?.phone?.replace(/^\+88/, '').replace(/\s+/g, '') || 'No Phone'}</span>
                  </div>
                  {lead?.phoneWhatsapp && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                      <WhatsAppIcon size={12} />
                      WhatsApp
                    </span>
                  )}
                </div>
                
                {lead?.secondPhone && (
                  <div className="contact-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={16} className="icon-call" style={{ opacity: 0.7 }} />
                      <span>{lead.secondPhone.replace(/^\+88/, '').replace(/\s+/g, '')}</span>
                    </div>
                    {lead.secondPhoneWhatsapp && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                        <WhatsAppIcon size={12} />
                        WhatsApp
                      </span>
                    )}
                  </div>
                )}

                <div className="contact-item">
                  <Mail size={16} className="icon-email" />
                  <span>{lead?.email || 'No Email'}</span>
                </div>
                <div className="contact-item">
                  <MapPin size={16} className="icon-location" />
                  <span>{lead?.location || 'No Location'}{lead?.area ? `, ${lead.area}` : ''}</span>
                </div>

                {lead?.address && (
                  <div className="contact-item" style={{ alignItems: 'flex-start' }}>
                    <MapPin size={16} className="icon-location" style={{ marginTop: '2px', opacity: 0.8 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '2px' }}>Full Address</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>{lead.address}</span>
                    </div>
                  </div>
                )}

                {lead?.interests && lead.interests.length > 0 ? (
                  <div className="contact-item" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                    <Briefcase size={16} className="icon-project" style={{ marginTop: '2px', opacity: 0.8 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px' }}>Interested Projects</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {lead.interests.map(projectName => (
                          <span key={projectName} style={{
                            padding: '4px 8px',
                            background: 'var(--primary-soft)',
                            border: '1px solid var(--primary-light)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--primary)',
                            whiteSpace: 'nowrap'
                          }}>
                            {projectName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="contact-item" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                    <Briefcase size={16} className="icon-project" style={{ marginTop: '2px', opacity: 0.8 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '2px' }}>Interested Projects</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No projects specified</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="quick-action-grid">
                <button className="q-btn whatsapp icon-whatsapp" onClick={handleWhatsApp} title="WhatsApp">
                  <WhatsAppIcon size={18} />
                </button>
                <button className="q-btn call icon-call" onClick={handleCall} title="Call">
                  <Phone size={18} />
                </button>
                <button className="q-btn email icon-email" onClick={handleEmail} title="Email">
                  <Mail size={18} />
                </button>
              </div>
            </Card>

            <Card className="assigned-person-card">
              <h3 className="section-title">Assigned Sales-Person</h3>
              <div className="assigned-person-body">
                <div className="person-info">
                  <div className="person-avatar">{lead.assignedToName?.[0] || 'U'}</div>
                  <div className="person-details">
                    <p className="person-name">{lead.assignedToName || 'Assigned Agent'}</p>
                    <p className="person-role">Sales Executive</p>
                  </div>
                </div>
                <Button variant="secondary" className="change-person-btn" onClick={() => setShowAssignModal(true)}>Transfer Lead</Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Tabs & Content */}
          <div className="profile-main-content">
            <div className="profile-tabs">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon size={18} className={
                    tab.id === 'follow-ups' ? 'icon-history' : 
                    tab.id === 'deals' ? 'icon-project' : 
                    tab.id === 'payments' ? 'icon-card' : ''
                  } />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'follow-ups' && (
                <div className="timeline-container">
                  {lead.nextFollowUpDate ? (
                    <div className="upcoming-followup-bar" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '10px 16px',
                      marginBottom: '20px',
                      gap: '12px',
                      flexWrap: 'wrap',
                      width: '100%'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span className="card-badge" style={{
                          margin: 0,
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          Upcoming Follow-up
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8125rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <Calendar size={14} style={{ color: 'var(--primary)' }} />
                            <span>{formatDate(lead.nextFollowUpDate)}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <Clock size={14} style={{ color: 'var(--primary)' }} />
                            <span>{lead.nextFollowUpTime || '09:00 AM'}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <AlertCircle size={14} className={`icon-priority priority-${(lead?.priority || 'Normal').toLowerCase().split(' ')[0]}`} />
                            <span>Priority: {lead?.priority || 'Normal'}</span>
                          </div>
                        </div>
                      </div>

                      <Button variant="secondary" size="sm" icon={Plus} onClick={() => setShowFollowUpModal(true)} style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
                        Add Follow-up
                      </Button>
                    </div>
                  ) : (
                    <div className="section-header-row mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <h3 className="text-lg font-semibold" style={{ margin: 0 }}>Interaction History</h3>
                      <Button variant="secondary" size="sm" icon={Plus} onClick={() => setShowFollowUpModal(true)}>
                        Add Follow-up
                      </Button>
                    </div>
                  )}

                  {lead.nextFollowUpDate && (
                    <div className="section-header-row mb-3" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <h3 className="text-lg font-semibold" style={{ margin: 0 }}>Interaction History</h3>
                    </div>
                  )}

                  <div className="chat-timeline">
                    {(lead.history || []).length > 0 ? (
                      [...(lead.history || [])].reverse().map((item, idx) => {
                        const isSystemEvent = item.type === 'Status Change' || item.type === 'Lead Created';
                        const dateObj = item.date ? new Date(item.date) : null;
                        const time = item.time || (dateObj && !isNaN(dateObj) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM');
                        const dateStr = formatDate(item.date);
                        
                        // Icons based on type
                        let TypeIcon = item.type === 'Site Visit' ? Car : Phone;
                        if (isSystemEvent) TypeIcon = item.type === 'Status Change' ? RefreshCcw : PlusCircle;

                        return (
                          <div key={idx} className="chat-row">
                            {/* Left Side: Timestamp */}
                            <div className="chat-timestamp-col">
                              <span className="timestamp-date">{dateStr}</span>
                              <span className="timestamp-time">{time}</span>
                            </div>

                            {/* Middle: Bubble */}
                            <div className="chat-bubble-col">
                              <div className={`chat-bubble ${isSystemEvent ? 'outline' : 'filled'}`}>
                                <div className="chat-bubble-header">
                                  <div className="type-with-icon">
                                    <TypeIcon size={14} className="type-icon" />
                                    <span className="bubble-type">{item.type}</span>
                                  </div>
                                </div>
                                <p className="bubble-note">{item.note}</p>
                                {item.interests && item.interests.length > 0 && (
                                  <div className="bubble-interests">
                                    {item.interests.map((proj, i) => (
                                      <span key={i} className="bubble-tag">{proj}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Side: Salesperson */}
                            <div className="chat-agent-col">
                              {!isSystemEvent && item.createdBy ? (
                                <div className="agent-identity">
                                  <div className="agent-avatar-circle">{item.createdBy[0]}</div>
                                  <span className="agent-name-tiny">{item.createdBy.split(' ')[0]}</span>
                                </div>
                              ) : (
                                <div className="system-identity">
                                  <div className="system-icon-circle"><RefreshCcw size={10} /></div>
                                  <span className="agent-name-tiny">System</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty-tab-state">
                        <History size={48} />
                        <p>No interaction history yet.</p>
                        <Button variant="secondary" icon={Plus} onClick={() => setShowFollowUpModal(true)}>
                          Record First Interaction
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}{activeTab === 'deals' && (
                <div className="deals-grid">
                  {deals.length > 0 ? (
                    deals.map((deal) => (
                      <Card key={deal.id} className="deal-item-card">
                        <div className="deal-header">
                          <h4>{deal.projectName || deal.title || 'Unnamed Deal'}</h4>
                          <span className={`deal-status ${(deal.status || 'confirmed').toLowerCase().replace(/ /g, '-')}`}>
                            {deal.status || 'Confirmed'}
                          </span>
                        </div>
                        <div className="deal-body" style={{ display: 'block' }}>
                          <div className="deal-invoice-layout">
                            <div className="invoice-field">
                              <span className="invoice-field-label">Unit / Apartment:</span>
                              <span className="invoice-field-value">{deal.unitNo || 'N/A'}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Apartment Size:</span>
                              <span className="invoice-field-value">{deal.floorSize ? `${deal.floorSize} sqft` : 'N/A'}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Price per sqft:</span>
                              <span className="invoice-field-value">{deal.pricePerSqft ? `৳ ${parseFloat(deal.pricePerSqft).toLocaleString()}` : 'N/A'}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Total Value:</span>
                              <span className="invoice-field-value" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>৳ {parseFloat(deal.value || 0).toLocaleString()}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Booking Money (DP):</span>
                              <span className="invoice-field-value">৳ {parseFloat(deal.downPaymentAmount || 0).toLocaleString()} ({deal.downPaymentPercent || 0}%)</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Booking Date:</span>
                              <span className="invoice-field-value">{formatDate(deal.downPaymentDate)}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Installments:</span>
                              <span className="invoice-field-value">{deal.numberOfInstallments ? `${deal.numberOfInstallments} Installments` : 'N/A'}</span>
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Incentive Threshold:</span>
                              <span className="invoice-field-value">{deal.incentiveThresholdPercent || 0}% payment received</span>
                            </div>
                            
                            {deal.installments && deal.installments.length > 0 && (
                              <div className="invoice-field" style={{ display: 'block', borderBottom: 'none', paddingBottom: 0, marginTop: '10px' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Installment Schedule</div>
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                                        <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--border)' }}>No.</th>
                                        <th style={{ padding: '6px', textAlign: 'left', border: '1px solid var(--border)' }}>Date</th>
                                        <th style={{ padding: '6px', textAlign: 'right', border: '1px solid var(--border)' }}>Amount (৳)</th>
                                        <th style={{ padding: '6px', textAlign: 'right', border: '1px solid var(--border)' }}>Due Bal. (৳)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {deal.installments.map((inst, i) => (
                                        <tr key={i}>
                                          <td style={{ padding: '6px', border: '1px solid var(--border)' }}>{inst.installmentNumber}</td>
                                          <td style={{ padding: '6px', border: '1px solid var(--border)' }}>{formatDate(inst.date)}</td>
                                          <td style={{ padding: '6px', textAlign: 'right', border: '1px solid var(--border)' }}>{parseFloat(inst.amount).toLocaleString()}</td>
                                          <td style={{ padding: '6px', textAlign: 'right', border: '1px solid var(--border)' }}>{parseFloat(inst.dueBalance).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <div className="invoice-field" style={{ display: 'block', borderBottom: 'none', paddingBottom: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="invoice-field-label">Team Incentive:</span>
                                <span className="invoice-field-value" style={{ color: deal.hasTeamIncentive ? '#d97706' : 'var(--text-muted)' }}>
                                  {deal.hasTeamIncentive ? 'Shared Team' : 'Individual Agent'}
                                </span>
                              </div>
                              {deal.hasTeamIncentive && deal.teamShares && deal.teamShares.length > 0 && (
                                <div className="team-shares-list" style={{ marginTop: '8px', background: 'rgba(0,0,0,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>Allocated Share Distribution:</div>
                                  {deal.teamShares.map((sh, sIdx) => (
                                    <div key={sIdx} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                      <span>{sh.userName}:</span>
                                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {sh.type === 'percentage' ? `${sh.value}%` : `৳${parseFloat(sh.value || 0).toLocaleString()}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="invoice-field">
                              <span className="invoice-field-label">Sold Date:</span>
                              <span className="invoice-field-value">{deal.createdAt?.toDate ? deal.createdAt.toDate().toLocaleDateString('en-GB') : 'N/A'}</span>
                            </div>
                            
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                              <Button variant="outline" size="sm" icon={ExternalLink} onClick={() => window.print()}>Print Invoice / Details</Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="empty-tab-state">
                      <Handshake size={48} />
                      <p>No confirmed deals yet.</p>
                      <Button variant="secondary" icon={Plus} onClick={() => navigate(`/leads/${id}/create-deal`)}>Create New Deal</Button>
                    </div>
                  )}
                  {deals.length > 0 && (
                    <div className="empty-state-btn" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
                      <Button variant="secondary" icon={Plus} onClick={() => navigate(`/leads/${id}/create-deal`)}>Create New Deal</Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="payments-list">
                  {payments.length > 0 ? (
                    <table className="profile-data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{payment.date || (payment.createdAt?.toDate ? payment.createdAt.toDate().toLocaleDateString() : 'N/A')}</td>
                            <td>{payment.type || payment.method || 'N/A'}</td>
                            <td className="amount-text">{payment.amount}</td>
                            <td>
                              <span className={`payment-status ${(payment.status || 'completed').toLowerCase()}`}>
                                {payment.status || 'Completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-tab-state">
                      <CreditCard size={48} />
                      <p>No payment history found.</p>
                      <Button variant="secondary" icon={Plus} onClick={() => setShowPaymentModal(true)}>Record Payment</Button>
                    </div>
                  )}
                  {payments.length > 0 && (
                    <div className="add-log-btn-container mt-4">
                      <Button variant="secondary" icon={Plus} onClick={() => setShowPaymentModal(true)}>Record New Payment</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Modals */}
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Transfer Lead"
          className="glass-modal"
        >
          <form className="new-lead-form" onSubmit={handleAssignConfirm}>
            <div className="form-group">
              <label className="form-label">Select Sales-Person</label>
              <select
                className="custom-select-field"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                required
                style={{ width: '100%' }}
              >
                <option value="">-- Choose Agent --</option>
                {usersList
                  .filter(u => {
                    const allowedUids = getAllowedTransferUids(currentUser, usersList, teams);
                    return allowedUids.includes(u.uid || u.id);
                  })
                  .map(u => (
                    <option key={u.id} value={u.uid || u.id}>
                      {u.fullName || u.name} ({u.role || 'Sales Executive'})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assignment Instruction (Optional)</label>
              <textarea
                className="custom-input-field"
                rows="3"
                placeholder="Add special instructions or notes for the agent..."
                value={assignInstruction}
                onChange={(e) => setAssignInstruction(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Assign Agent</Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Lead Details"
          className="glass-modal"
        >
          <form className="new-lead-form" onSubmit={handleEditSubmit}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
              <label className="form-label" style={{ alignSelf: 'flex-start' }}>Profile Photo</label>
              <div className="image-upload-wrapper-lead compact" style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="lead-avatar-preview" style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {editForm.image ? (
                    <img src={editForm.image} alt="Lead" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="default-avatar-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <User size={32} />
                    </div>
                  )}
                  <label className="lead-camera-btn compact" style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    left: '0',
                    background: 'rgba(0, 0, 0, 0.6)',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}>
                    <Camera size={12} style={{ color: '#fff' }} />
                    <input 
                      type="file" 
                      hidden 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditForm(prev => ({ ...prev, image: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="custom-input-field"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="custom-input-field"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Primary Phone</label>
                <input
                  type="tel"
                  className="custom-input-field"
                  placeholder="1XXXXXXXXX"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '') })}
                  required
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={editForm.phoneWhatsapp}
                    onChange={(e) => setEditForm({ ...editForm, phoneWhatsapp: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>WhatsApp active</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Second Phone</label>
                <input
                  type="tel"
                  className="custom-input-field"
                  placeholder="1XXXXXXXXX (Optional)"
                  value={editForm.secondPhone}
                  onChange={(e) => setEditForm({ ...editForm, secondPhone: e.target.value.replace(/\D/g, '') })}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={editForm.secondPhoneWhatsapp}
                    onChange={(e) => setEditForm({ ...editForm, secondPhoneWhatsapp: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>WhatsApp active</span>
                </label>
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  type="text"
                  className="custom-input-field"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="custom-input-field"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Location (City)</label>
                <input
                  type="text"
                  className="custom-input-field"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Area</label>
                <input
                  type="text"
                  className="custom-input-field"
                  value={editForm.area}
                  onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Address</label>
              <input
                type="text"
                className="custom-input-field"
                placeholder="House, Road, Block, Neighborhood..."
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Interested Projects (Select multiple)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                {projectsList.map(project => {
                  const isChecked = editForm.interests?.includes(project.projectName);
                  return (
                    <label key={project.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: isChecked ? 'var(--primary-soft)' : 'var(--background)',
                      border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: isChecked ? '600' : '500',
                      color: isChecked ? 'var(--primary)' : 'var(--text-primary)',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        onChange={(e) => {
                          const newInterests = e.target.checked
                            ? [...(editForm.interests || []), project.projectName]
                            : (editForm.interests || []).filter(p => p !== project.projectName);
                          setEditForm({ ...editForm, interests: newInterests });
                        }}
                      />
                      <span>{project.projectName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        </Modal>

        <LeadUpdateModal 
          isOpen={showFollowUpModal} 
          onClose={() => setShowFollowUpModal(false)}
          lead={lead}
          newStatus={lead?.status}
          onConfirm={handleFollowUpConfirm}
        />

        <Modal 
          isOpen={showDealModal} 
          onClose={() => setShowDealModal(false)}
          title="Create New Project Deal (Invoice Creation)"
          className="glass-modal"
        >
          <form className="new-lead-form" onSubmit={handleDealSubmit}>
            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Select Sold Project</label>
                <select 
                  className="custom-select-field"
                  required
                  value={dealData.projectId}
                  onChange={(e) => setDealData({...dealData, projectId: e.target.value})}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Choose Project --</option>
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.projectName} ({p.totalApartments || 0} Units Left)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Apartment / Unit No.</label>
                <input 
                  type="text"
                  className="custom-input-field"
                  placeholder="e.g. Flat-4A, Tower-B"
                  required
                  value={dealData.unitNo}
                  onChange={(e) => setDealData({...dealData, unitNo: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Apartment Floor Size (sqft)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="e.g. 1500"
                  required
                  value={dealData.floorSize}
                  onChange={(e) => setDealData({...dealData, floorSize: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Price per sqft (BDT)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="e.g. 5000"
                  required
                  value={dealData.pricePerSqft}
                  onChange={(e) => setDealData({...dealData, pricePerSqft: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Total Sale Value (BDT)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="Calculated automatically..."
                  required
                  value={dealData.value}
                  onChange={(e) => setDealData({...dealData, value: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Booking Money (DP %)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="e.g. 20"
                  required
                  value={dealData.downPaymentPercent}
                  onChange={(e) => setDealData({...dealData, downPaymentPercent: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Booking Money Value (BDT)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="Calculated automatically..."
                  required
                  value={dealData.downPaymentAmount}
                  onChange={(e) => setDealData({...dealData, downPaymentAmount: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Booking / DP Date</label>
                <input 
                  type="date"
                  className="custom-input-field"
                  required
                  value={dealData.downPaymentDate}
                  onChange={(e) => setDealData({...dealData, downPaymentDate: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Number of Installments (Max 36)</label>
                <input 
                  type="number"
                  max="36"
                  className="custom-input-field"
                  placeholder="e.g. 24"
                  value={dealData.numberOfInstallments}
                  onChange={(e) => setDealData({...dealData, numberOfInstallments: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Installment Start Date</label>
                <input 
                  type="date"
                  className="custom-input-field"
                  value={dealData.installmentStartDate}
                  onChange={(e) => setDealData({...dealData, installmentStartDate: e.target.value})}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Incentive Eligibility Threshold (% received)</label>
                <input 
                  type="number"
                  className="custom-input-field"
                  placeholder="e.g. 30"
                  required
                  value={dealData.incentiveThresholdPercent}
                  onChange={(e) => setDealData({...dealData, incentiveThresholdPercent: e.target.value})}
                  style={{ width: '100%' }}
                />
                <span className="field-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Employee can apply for commission once this % of total value is approved.
                </span>
              </div>
              <div className="form-group" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '28px' }}>
                <input 
                  type="checkbox"
                  id="hasTeamIncentive"
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  checked={dealData.hasTeamIncentive}
                  onChange={(e) => setDealData({...dealData, hasTeamIncentive: e.target.checked})}
                />
                <label htmlFor="hasTeamIncentive" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mark Team Incentive Shared
                </label>
              </div>
            </div>

            {dealData.hasTeamIncentive && (
              <div className="team-incentive-section" style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
                  Team Incentive Share Allocation
                </h4>
                {teamShares.map((share, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                    <select
                      className="custom-select-field"
                      value={share.userId}
                      onChange={(e) => {
                        const selectedUser = usersList.find(u => u.id === e.target.value || u.uid === e.target.value);
                        const updated = [...teamShares];
                        updated[idx].userId = e.target.value;
                        updated[idx].userName = selectedUser ? (selectedUser.fullName || selectedUser.name) : 'User';
                        setTeamShares(updated);
                      }}
                      style={{ flex: 2, minWidth: '150px' }}
                      required
                    >
                      <option value="">-- Select Member --</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.uid || u.id}>
                          {u.fullName || u.name} ({u.role})
                        </option>
                      ))}
                    </select>

                    <select
                      className="custom-select-field"
                      value={share.type}
                      onChange={(e) => {
                        const updated = [...teamShares];
                        updated[idx].type = e.target.value;
                        setTeamShares(updated);
                      }}
                      style={{ flex: 1.2, minWidth: '120px' }}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="amount">Amount (BDT)</option>
                    </select>

                    <input
                      type="number"
                      className="custom-input-field"
                      placeholder={share.type === 'percentage' ? 'e.g. 10' : 'e.g. 5000'}
                      value={share.value}
                      onChange={(e) => {
                        const updated = [...teamShares];
                        updated[idx].value = e.target.value;
                        setTeamShares(updated);
                      }}
                      style={{ flex: 1.5, minWidth: '100px' }}
                      required
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setTeamShares(teamShares.filter((_, i) => i !== idx));
                      }}
                      style={{ padding: '8px 12px', minWidth: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTeamShares([...teamShares, { userId: '', userName: '', type: 'percentage', value: '' }]);
                  }}
                  style={{ marginTop: '8px' }}
                >
                  + Add Team Member
                </Button>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowDealModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Confirm Sale & Create Deal</Button>
            </div>
          </form>
        </Modal>

        <Modal 
          isOpen={showPaymentModal} 
          onClose={() => setShowPaymentModal(false)}
          title="Record Payment"
          className="glass-modal"
        >
          <form className="new-lead-form" onSubmit={handlePaymentSubmit}>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input 
                className="custom-input-field"
                placeholder="e.g. $5,000"
                required
                value={paymentData.amount}
                onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select 
                  className="custom-select-field"
                  value={paymentData.type}
                  onChange={(e) => setPaymentData({...paymentData, type: e.target.value})}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="custom-input-field"
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({...paymentData, date: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Record Payment</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default LeadDetails;
