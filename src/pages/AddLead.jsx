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
          leadName: leadData.name || leadData.full_name || leadData.company,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teams, setTeams] = useState([]);

  // Form State: Required and optional lead fields
  const [formData, setFormData] = useState({
    image: null,
    company: '',
    contactPerson: '',
    email: '',
    phone: '',
    phoneWhatsapp: false,
    secondPhone: '',
    secondPhoneWhatsapp: false,
    location: '',
    city: '',
    countryCode: '+880',
    countryFlag: '🇧🇩',
    assignedTo: '',
    assignedToName: ''
  });

  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

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
      setTeams(teamsData || []);

      const { data: usersData } = await supabase.from('users').select('*').order('full_name', { ascending: true });
      setUsers(usersData || []);
    };

    fetchData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
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
          setFormData(prev => ({ ...prev, image: compressedBase64 }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate Company Name
    if (!formData.company?.trim()) {
      showToast("Please enter Company Name.", "error");
      return;
    }

    // Validate Phone Number
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

      const displayName = formData.contactPerson?.trim() || formData.company?.trim();

      const leadPayload = {
        name: displayName,
        company: formData.company?.trim(),
        contact_person: formData.contactPerson?.trim() || '',
        email: formData.email?.trim() || '',
        phone: fullPhone,
        phone_whatsapp: formData.phoneWhatsapp || false,
        second_phone: secondPhoneCleaned,
        second_phone_whatsapp: formData.secondPhoneWhatsapp || false,
        location: formData.location?.trim() || '',
        city: formData.city?.trim() || '',
        area: '',
        address: [formData.location?.trim(), formData.city?.trim()].filter(Boolean).join(', '),
        assigned_to: formData.assignedTo || resolvedOwnerId,
        assigned_to_name: formData.assignedToName || user?.full_name || user?.fullName || user?.name || 'Admin',
        owner_id: resolvedOwnerId,
        owner_name: user?.full_name || user?.fullName || user?.name || 'Admin',
        org_id: resolvedOrgId,
        priority: 'Normal',
        source: 'Self Generated',
        status: 'Fresh Lead',
        description: '',
        image: formData.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.company || displayName)}&background=random`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: history
      };

      let { data: newLead, error: leadError } = await supabase.from('leads').insert(leadPayload).select().single();

      // Graceful fallback if city or contact_person columns are not yet in Supabase schema cache
      if (leadError && (leadError.message?.includes('column') || leadError.code === 'PGRST204')) {
        console.warn('Retrying lead insert with core columns:', leadError.message);
        const fallbackPayload = { ...leadPayload };
        delete fallbackPayload.city;
        delete fallbackPayload.contact_person;
        const retry = await supabase.from('leads').insert(fallbackPayload).select().single();
        newLead = retry.data;
        leadError = retry.error;
      }

      if (leadError) throw leadError;

      // Create notification for assigned user
      if (formData.assignedTo && newLead?.id) {
        await supabase.from('notifications').insert({
          user_id: formData.assignedTo,
          title: 'New Lead Assigned',
          description: `${displayName} (${formData.company}) has been assigned to you by ${user?.full_name || user?.fullName || user?.name || 'Admin'}.`,
          type: 'lead',
          is_read: false,
          created_at: new Date().toISOString(),
          link: `/leads/details/${newLead.id}`
        });
      }

      showToast('Lead created successfully!', 'success');
      setTimeout(() => navigate('/leads/mine'), 1200);
    } catch (error) {
      console.error('Error creating lead:', error);
      showToast(error.message || 'Failed to create lead. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <button className="back-btn-v2" onClick={() => navigate(-1)} title="Back">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1>Create New Lead</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
                  Fill in the essential information to add a new lead to your CRM.
                </p>
              </div>
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
            <div className="section-header-v4">
              <div className="title-area">
                <h3>Lead Details</h3>
                <p>Provide lead contact, company, and location details.</p>
              </div>
            </div>

            <div className="section-body">
              <div className="form-grid-v3">
                {/* 1. Photo, 2. Company Name, 3. Contact Person (optional) */}
                <div className="form-group-v3 col-span-4 photo-name-row" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                  <div className="photo-col" style={{ flex: '0 0 auto' }}>
                    <label>Photo</label>
                    <div className="image-upload-wrapper-lead compact" style={{ marginTop: '4px' }}>
                      <div className="lead-avatar-preview" style={{ width: '76px', height: '76px', position: 'relative' }}>
                        {formData.image ? (
                          <img 
                            src={formData.image} 
                            alt="Lead Avatar" 
                            style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--surface)' }} 
                          />
                        ) : (
                          <div className="default-avatar-placeholder" style={{ width: '100%', height: '100%', borderRadius: '16px' }}>
                            <User size={26} />
                          </div>
                        )}
                        <label className="lead-camera-btn compact" title="Upload Photo">
                          <Camera size={14} />
                          <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                        </label>
                      </div>
                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                          style={{
                            marginTop: '6px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger, #ef4444)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'block'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    {/* 2. Company Name */}
                    <div className="form-group-v3">
                      <label>Company Name <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <input 
                        type="text" 
                        name="company" 
                        required 
                        placeholder="e.g. Acme Corp"
                        value={formData.company}
                        onChange={handleChange}
                      />
                    </div>

                    {/* 3. Contact Person (optional) */}
                    <div className="form-group-v3">
                      <label>
                        Contact Person 
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span>
                      </label>
                      <input 
                        type="text" 
                        name="contactPerson" 
                        placeholder="e.g. John Doe"
                        value={formData.contactPerson}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Phone Number */}
                <div className="form-group-v3 col-span-2">
                  <label>Phone Number <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
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
                        if (val.startsWith('0')) val = val.substring(1);
                        if (val.length <= 10) setFormData(prev => ({ ...prev, phone: val }));
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

                {/* 5. Second Phone Number */}
                <div className="form-group-v3 col-span-2">
                  <label>
                    Second Phone Number 
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span>
                  </label>
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
                      value={formData.secondPhone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.startsWith('0')) val = val.substring(1);
                        if (val.length <= 10) setFormData(prev => ({ ...prev, secondPhone: val }));
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
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

                {/* Email Address */}
                <div className="form-group-v3 col-span-2">
                  <label>
                    Email Address 
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span>
                  </label>
                  <input 
                    type="email" 
                    name="email" 
                    placeholder="e.g. client@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

                {/* City */}
                <div className="form-group-v3 col-span-2">
                  <label>City</label>
                  <input 
                    type="text" 
                    name="city" 
                    placeholder="e.g. Dhaka"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>

                {/* Location */}
                <div className="form-group-v3 col-span-4">
                  <label>Location</label>
                  <input 
                    type="text" 
                    name="location" 
                    placeholder="e.g. Banani, Road 11"
                    value={formData.location}
                    onChange={handleChange}
                  />
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