import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Button from '../components/ui/Button';
import { 
  User,
  ArrowLeft,
  Save,
  ChevronRight,
  Phone,
  Camera
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import './AddLead.css';

const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  let val = phone.toString().replace(/\D/g, '');
  if (val.startsWith('880')) {
    val = val.substring(3);
  }
  if (val.startsWith('0')) {
    val = val.substring(1);
  }
  return val;
};

const checkPhoneDuplicateInTeam = async (phoneNumber, user, allUsers, teams) => {
  const cleanedSearchPhone = cleanPhoneNumber(phoneNumber);
  if (!cleanedSearchPhone) return { duplicate: false };

  const currentUserName = user.fullName || user.name || '';
  const userTeams = teams.filter(team => 
    (team.members && team.members.includes(currentUserName)) || 
    (team.teamLeads && team.teamLeads.includes(currentUserName)) || 
    team.teamLead === currentUserName
  );

  const teamMemberNames = new Set([currentUserName]);
  userTeams.forEach(team => {
    if (team.members) team.members.forEach(m => teamMemberNames.add(m));
    if (team.teamLeads) team.teamLeads.forEach(l => teamMemberNames.add(l));
    if (team.teamLead) teamMemberNames.add(team.teamLead);
  });

  const teamMemberUids = allUsers
    .filter(u => teamMemberNames.has(u.fullName || u.name))
    .map(u => u.uid || u.id)
    .filter(Boolean);
  
  if (!teamMemberUids.includes(user.uid)) {
    teamMemberUids.push(user.uid);
  }

  const formats = [
    `+880 ${cleanedSearchPhone}`,
    `+880${cleanedSearchPhone}`,
    `880${cleanedSearchPhone}`,
    `880 ${cleanedSearchPhone}`,
    `0${cleanedSearchPhone}`,
    cleanedSearchPhone
  ];

  const { data: matchedLeads } = await supabase.from('leads').select('*').in('phone', formats);

  if (matchedLeads && matchedLeads.length > 0) {
    for (const leadData of matchedLeads) {
      const assignee = leadData.assigned_to || leadData.assignedTo;
      const owner = leadData.owner_id || leadData.ownerId;
      if (teamMemberUids.includes(assignee) || teamMemberUids.includes(owner)) {
        return {
          duplicate: true,
          leadName: leadData.name || leadData.full_name,
          assignedToName: leadData.assigned_to_name || leadData.assignedToName || 'someone in your team'
        };
      }
    }
  }

  return { duplicate: false };
};

const AddLeadPage = () => {
  const navigate = useNavigate();
  const { user, currentTenant } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    designation: '',
    phone: '',
    phoneWhatsapp: false,
    secondPhone: '',
    secondPhoneWhatsapp: false,
    countryCode: '+880',
    countryFlag: '🇧🇩',
    email: '',
    location: '',
    assignedTo: '',
    assignedToName: '',
    priority: 'Normal',
    source: 'Self Generated',
    description: '',
    image: null,
    area: '',
    address: '',
    nextCallDate: ''
  });
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  const [userTeam, setUserTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Set initial assignment when user context is ready
  useEffect(() => {
    if (user && !formData.assignedTo) {
      setFormData(prev => ({
        ...prev,
        assignedTo: user.uid || user.id,
        assignedToName: user.full_name || user.fullName || user.name || 'Admin'
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: teamsData } = await supabase.from('teams').select('*');
      const teamsList = teamsData || [];
      setTeams(teamsList);
      const userName = user.full_name || user.fullName || user.name;

      const foundTeam = teamsList.find(team =>
        (team.members && team.members.includes(userName)) ||
        team.team_lead === userName || team.teamLead === userName
      );
      setUserTeam(foundTeam);

      const { data: usersData } = await supabase.from('users').select('*').order('full_name', { ascending: true });
      setUsers(usersData || []);
      setIsLoading(false);
    };

    fetchData();
  }, [user]);

  // Handle Filtering Logic
  useEffect(() => {
    if (!users.length) return;

    const isAdmin = user?.role === 'Admin' || user?.role === 'System Admin' || user?.role === 'MD';
    
    if (isAdmin) {
      setFilteredUsers(users);
    } else if (userTeam) {
      const teamMemberNames = [...(userTeam.members || [])];
      if (userTeam.teamLead) teamMemberNames.push(userTeam.teamLead);
      
      const members = users.filter(u => teamMemberNames.includes(u.fullName || u.name));
      setFilteredUsers(members);
    } else {
      // If no team found and not admin, only show self
      setFilteredUsers(users.filter(u => u.uid === user?.uid));
    }
  }, [users, userTeam, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCountryChange = (e) => {
    const selected = countryCodes.find(c => c.code === e.target.value);
    setFormData(prev => ({ 
      ...prev, 
      countryCode: selected.code, 
      countryFlag: selected.flag 
    }));
  };

  const handleUserSelect = (selectedUser) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: selectedUser.id,
      assignedToName: selectedUser.fullName || selectedUser.name
    }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("File is too large. Max 5MB allowed.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 600; // Smaller for avatars
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
          setFormData(prev => ({ ...prev, image: compressedBase64 }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate Phone
    const cleanedPhone = cleanPhoneNumber(formData.phone);
    if (!cleanedPhone.startsWith('1') || cleanedPhone.length !== 10) {
      showToast("Phone number must start with 1 and be exactly 10 digits (e.g. 1712345678).", "error");
      return;
    }

    // Validate Second Phone if provided
    if (formData.secondPhone) {
      const cleanedSecond = cleanPhoneNumber(formData.secondPhone);
      if (!cleanedSecond.startsWith('1') || cleanedSecond.length !== 10) {
        showToast("Second phone number must start with 1 and be exactly 10 digits.", "error");
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Check for duplicate phone in same team
      const duplicateResult = await checkPhoneDuplicateInTeam(formData.phone, user, users, teams);
      if (duplicateResult.duplicate) {
        showToast(`A lead with this phone number already exists in your team (Lead: "${duplicateResult.leadName}", Assigned to: ${duplicateResult.assignedToName})!`, "error");
        setIsSubmitting(false);
        return;
      }

      const history = [{
        date: new Date().toISOString(),
        note: 'Lead created manually via platform.',
        type: 'System',
        createdBy: user?.fullName || 'Admin'
      }];

      if (formData.description && formData.nextCallDate) {
        history.push({
          date: new Date().toISOString(),
          note: `${formData.description}. Initial follow-up scheduled for ${formData.nextCallDate}.`,
          type: 'Follow-up',
          createdBy: user?.fullName || 'Admin'
        });
      } else if (formData.description) {
        history.push({
          date: new Date().toISOString(),
          note: formData.description,
          type: 'Follow-up',
          createdBy: user?.fullName || 'Admin'
        });
      } else if (formData.nextCallDate) {
        history.push({
          date: new Date().toISOString(),
          note: `Initial follow-up scheduled for ${formData.nextCallDate}.`,
          type: 'Follow-up',
          createdBy: user?.fullName || 'Admin'
        });
      }

      const isSA = user?.account_type === 'super_admin';
      const resolvedOrgId = (isSA && currentTenant?.type === 'org')
        ? currentTenant?.id
        : (user?.org_id || null);

      const resolvedOwnerId = (isSA && currentTenant?.type === 'individual')
        ? currentTenant?.id
        : (user?.uid || user?.id);

      const codeCleaned = formData.countryCode.replace(/[^\d]/g, '');
      const fullPhone = `${codeCleaned}${cleanedPhone}`;
      const secondPhoneCleaned = formData.secondPhone ? `${codeCleaned}${cleanPhoneNumber(formData.secondPhone)}` : '';

      const leadPayload = {
        name: formData.name,
        company: formData.company,
        designation: formData.designation,
        phone: fullPhone,
        phone_whatsapp: formData.phoneWhatsapp || false,
        second_phone: secondPhoneCleaned,
        second_phone_whatsapp: formData.secondPhoneWhatsapp || false,
        email: formData.email,
        location: formData.location,
        area: formData.area,
        address: formData.address || '',
        assigned_to: formData.assignedTo || resolvedOwnerId,
        assigned_to_name: formData.assignedToName || user?.full_name || user?.fullName || user?.name || 'Admin',
        owner_id: resolvedOwnerId,
        owner_name: user?.full_name || user?.fullName || user?.name || 'Admin',
        org_id: resolvedOrgId,
        priority: formData.priority,
        source: formData.source,
        status: formData.nextCallDate ? 'Follow Up' : 'Fresh Lead',
        description: formData.description,
        next_follow_up: formData.nextCallDate || '',
        next_follow_up_date: formData.nextCallDate || null,
        image: formData.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: history
      };

      const { data: newLead, error: leadError } = await supabase.from('leads').insert(leadPayload).select().single();
      if (leadError) throw leadError;

      // Create notification for assigned user
      if (formData.assignedTo) {
        await supabase.from('notifications').insert({
          user_id: formData.assignedTo,
          title: 'New Lead Assigned',
          description: `${formData.name} has been assigned to you by ${user?.full_name || user?.fullName || user?.name || 'Admin'}.`,
          type: 'lead',
          is_read: false,
          created_at: new Date().toISOString(),
          link: `/leads/details/${newLead.id}`
        });
      }

      showToast('Lead created successfully!', 'success');
      setTimeout(() => navigate('/leads/mine'), 1500);
    } catch (error) {
      console.error('Error creating lead:', error);
      showToast('Failed to create lead. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const countryCodes = [
    { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
    { code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+91', flag: '🇮🇳', name: 'India' },
    { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: '+974', flag: '🇶🇦', name: 'Qatar' },
    { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
    { code: '+968', flag: '🇴🇲', name: 'Oman' },
    { code: '+973', flag: '🇧🇭', name: 'Bahrain' }
  ];


  return (
    <DashboardLayout>
      <div className="add-lead-page">
        <LeadTabs />
        {/* Header */}
        <div className="add-lead-header">
          <div className="header-left-group">
            <div className="breadcrumb">
              <Link to="/leads/all">Lead Management</Link>
              <ChevronRight size={14} />
              <span>Add New Lead</span>
            </div>
            <div className="header-with-back">
              <button className="back-btn-v2" onClick={() => navigate(-1)}>
                <ArrowLeft size={20} />
              </button>
              <h1>Create New Lead</h1>
            </div>
          </div>
          <div className="header-actions">
            <button 
              type="button" 
              className="btn-secondary-v3" 
              onClick={() => navigate('/leads/mine')}
            >
              Cancel
            </button>
            <Button 
              variant="primary" 
              type="submit" 
              form="add-lead-form"
              icon={Save} 
              isLoading={isSubmitting}
            >
              Create Lead
            </Button>
          </div>
        </div>

        <form id="add-lead-form" onSubmit={handleSubmit} className="add-lead-container">
          <div className="form-section-card">
            {/* Section 1: Lead Information */}
            <div className="section-header-v4">
              <div className="title-area">
                <h3>Lead Information</h3>
                <p>Basic identification and priority settings for the new lead.</p>
              </div>
            </div>
              <div className="section-body">
                <div className="form-grid-v3">
                  {/* Row 1: Photo & Name */}
                  <div className="form-group-v3 col-span-4 photo-name-row">
                    <div className="photo-col">
                      <label>Photo</label>
                      <div className="image-upload-wrapper-lead compact">
                        <div className="lead-avatar-preview">
                          {formData.image ? (
                            <img src={formData.image} alt="Lead" />
                          ) : (
                            <div className="default-avatar-placeholder">
                              <User size={18} />
                            </div>
                          )}
                          <label className="lead-camera-btn compact">
                            <Camera size={10} />
                            <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="name-col">
                      <label>Lead Full Name <span>*</span></label>
                      <input 
                        type="text" 
                        name="name" 
                        required 
                        placeholder="e.g. John Doe"
                        value={formData.name}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* Row 2: Company & Designation */}
                  <div className="form-group-v3 col-span-2">
                    <label>Company Name</label>
                    <input 
                      type="text" 
                      name="company" 
                      placeholder="e.g. Acme Corp"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Designation</label>
                    <input 
                      type="text" 
                      name="designation" 
                      placeholder="e.g. Managing Director"
                      value={formData.designation}
                      onChange={handleChange}
                    />
                  </div>

                  {/* Row 3: Priority & Source */}
                  <div className="form-group-v3 col-span-2">
                    <label>Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange}>
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Lead Source</label>
                    <select name="source" value={formData.source} onChange={handleChange}>
                      <option value="Self Generated">Self Generated</option>
                      <option value="Facebook">Facebook</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Website">Website</option>
                      <option value="Referral">Referral</option>
                      <option value="Walk-in">Walk-in</option>
                    </select>
                  </div>
                </div>
              </div>
            <div className="section-divider-v2"></div>

            {/* Section 2: Contact Details */}
            <div className="section-header-v4">
              <div className="title-area">
                <h3>Contact & Location</h3>
                <p>How to reach the lead and their physical location details.</p>
              </div>
            </div>
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3 col-span-2">
                    <label>Phone Number <span>*</span></label>
                    <div className="phone-input-wrapper compact">
                      <div className="country-selector-v2 compact">
                        <div className="selected-country">
                          <span>{formData.countryFlag}</span>
                          <span>{formData.countryCode}</span>
                        </div>
                      </div>
                      <input 
                        type="tel" 
                        name="phone" 
                        required 
                        placeholder="1XXXXXXXXX"
                        maxLength={10}
                        value={formData.phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          // Automatically remove leading zero if entered
                          if (val.startsWith('0')) {
                            val = val.substring(1);
                          }
                          if (val.length <= 10) {
                            setFormData(prev => ({ ...prev, phone: val }));
                          }
                        }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                      <input 
                        type="checkbox" 
                        name="phoneWhatsapp"
                        checked={formData.phoneWhatsapp || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneWhatsapp: e.target.checked }))}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                      />
                      <span>WhatsApp active on this number</span>
                    </label>
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Second Phone Number</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="phone-input-wrapper compact">
                        <div className="country-selector-v2 compact">
                          <div className="selected-country">
                            <span>{formData.countryFlag}</span>
                            <span>{formData.countryCode}</span>
                          </div>
                        </div>
                        <input 
                          type="tel" 
                          name="secondPhone" 
                          placeholder="1XXXXXXXXX (Optional)"
                          maxLength={10}
                          value={formData.secondPhone || ''}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.startsWith('0')) {
                              val = val.substring(1);
                            }
                            if (val.length <= 10) {
                              setFormData(prev => ({ ...prev, secondPhone: val }));
                            }
                          }}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                        <input 
                          type="checkbox" 
                          name="secondPhoneWhatsapp"
                          checked={formData.secondPhoneWhatsapp || false}
                          onChange={(e) => setFormData(prev => ({ ...prev, secondPhoneWhatsapp: e.target.checked }))}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--primary)' }}
                        />
                        <span>WhatsApp active on this number</span>
                      </label>
                    </div>
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      name="email" 
                      placeholder="client@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Location (City)</label>
                    <input 
                      type="text" 
                      name="location" 
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group-v3 col-span-2">
                    <label>Area</label>
                    <input 
                      type="text" 
                      name="area" 
                      placeholder="Specific Area/Neighborhood"
                      value={formData.area}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group-v3 col-span-4">
                    <label>Full Address</label>
                    <input 
                      type="text" 
                      name="address" 
                      placeholder="e.g. House 42, Road 11, Gabtoli, Mohammadpur, Dhaka"
                      value={formData.address || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group-v3 col-span-4">
                    <label>Next Call Date (Scheduled Follow-up)</label>
                    <input 
                      type="date" 
                      name="nextCallDate" 
                      value={formData.nextCallDate || ''}
                      onChange={handleChange}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group-v3 col-span-4">
                    <label>Follow Up Message</label>
                    <textarea 
                      name="description" 
                      rows="2" 
                      placeholder="Follow up message..."
                      value={formData.description}
                      onChange={handleChange}
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>



        </form>

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

export default AddLeadPage;
