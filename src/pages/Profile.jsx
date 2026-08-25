import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Lock, 
  ShieldCheck, 
  Globe, 
  Bell, 
  Save,
  UserCircle,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Calendar,
  Briefcase,
  Hash,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Toast from '../components/ui/Toast';
import './Profile.css';

const ProfilePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });

  // Password Update Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Stats
  const [leadStats, setLeadStats] = useState({ total: 0, followUps: 0, visits: 0, deals: 0 });

  // User State
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    location: '',
    bio: '',
    avatar: '',
    banner: '',
    joinedAt: null,
    reportsTo: ''
  });

  const [editData, setEditData] = useState({ name: '', phone: '', location: '', bio: '' });

  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [uploading, setUploading] = useState({ type: null, status: false });

  useEffect(() => {
    if (!user?.uid) return;

    const fetchUserProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', user.uid).maybeSingle();
      if (data) {
        const fullName = data.full_name || data.fullName || data.name || '';
        setUserData({
          name: fullName,
          email: data.email || user?.email || '',
          phone: data.phone || '',
          role: data.role || '',
          location: data.location || '',
          bio: data.bio || '',
          avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&background=26e264&color=000&bold=true`,
          banner: data.banner || '',
          joinedAt: data.created_at || data.createdAt || null,
          reportsTo: data.reports_to || data.reportsTo || ''
        });
        setEditData({
          name: fullName,
          phone: data.phone || '',
          location: data.location || '',
          bio: data.bio || ''
        });
      }
      setLoading(false);
    };

    fetchUserProfile();
    const ch = supabase.channel('profile-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, fetchUserProfile)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.uid]);

  // Load real lead stats
  useEffect(() => {
    if (!user?.uid) return;
    const fetchStats = async () => {
      try {
        const { data: leads } = await supabase.from('leads').select('*').or(`assigned_to.eq.${user.uid},assignedTo.eq.${user.uid}`);
        const l = leads || [];
        setLeadStats({
          total: l.length,
          followUps: l.filter(ld => ld.next_follow_up_date || ld.nextFollowUpDate).length,
          visits: l.filter(ld => ld.visit_date || ld.visitDate).length,
          deals: l.filter(ld => ld.status === 'Deal Confirmed').length,
        });
      } catch (e) {
        console.error('Stats fetch error:', e);
      }
    };
    fetchStats();
  }, [user?.uid]);

  function showToast(message, type = 'success') {
    setToastConfig({ show: true, message, type });
  }

  const handleInputChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file || !user?.uid) return;

    if (file.size > 800 * 1024) {
      showToast('File is too large. Max 800KB allowed.', 'error');
      return;
    }

    setUploading({ type, status: true });
    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const base64String = await base64Promise;
      await supabase.from('users').update({
        [type === 'avatar' ? 'avatar' : 'banner']: base64String,
        updated_at: new Date().toISOString()
      }).eq('id', user.uid);
      showToast(`${type === 'avatar' ? 'Profile picture' : 'Cover photo'} updated!`, 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to process image', 'error');
    } finally {
      setUploading({ type: null, status: false });
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      await supabase.from('users').update({
        full_name: editData.name,
        phone: editData.phone,
        location: editData.location,
        bio: editData.bio,
        updated_at: new Date().toISOString()
      }).eq('id', user.uid);
      showToast('Profile updated successfully!', 'success');
      setHasChanges(false);
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showToast('Password updated successfully!', 'success');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setShowCurrentPassword(false); setShowNewPassword(false); setShowConfirmPassword(false);
      setIsPasswordModalOpen(false);
    } catch (err) {
      console.error('Password update error:', err);
      setPasswordError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const formatJoinDate = (ts) => {
    if (!ts) return 'N/A';
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="profile-loading">
          <Loader2 className="animate-spin" size={40} />
          <p>Loading your profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <DashboardLayout>
      <div className="profile-page-container">
        
        {/* Profile Hero Card */}
        <div className="profile-hero-card">
          {/* Cover / Banner */}
          <div
            className="profile-cover"
            style={{
              backgroundImage: userData.banner ? `url(${userData.banner})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!userData.banner && (
              <div className="profile-cover-gradient" />
            )}
            <button
              className="change-banner-btn"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploading.status}
            >
              <Camera size={16} />
              <span>Change Cover</span>
            </button>
            <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
          </div>

          {/* Header Content */}
          <div className="profile-header-content">
            <div className="avatar-wrapper">
              <img src={userData.avatar} alt="Profile" className="profile-avatar-lg" />
              <button
                className="change-avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading.status}
              >
                {uploading.status && uploading.type === 'avatar' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
            </div>

            <div className="profile-main-info">
              <h1>{userData.name || 'Your Name'}</h1>
              <div className="profile-meta-row">
                {userData.role && (
                  <span className="profile-role-chip">
                    <Briefcase size={12} />
                    {userData.role}
                  </span>
                )}
                {userData.location && (
                  <span className="profile-meta-item">
                    <MapPin size={12} />
                    {userData.location}
                  </span>
                )}
                {userData.email && (
                  <span className="profile-meta-item">
                    <Mail size={12} />
                    {userData.email}
                  </span>
                )}
              </div>
            </div>

            <div className="profile-header-actions">
              <Button
                variant="primary"
                icon={isSaving ? Loader2 : Save}
                disabled={!hasChanges || isSaving}
                onClick={handleSave}
                size="sm"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="profile-stats-row">
            <div className="profile-stat-item">
              <span className="pstat-value">{leadStats.total}</span>
              <span className="pstat-label">Total Leads</span>
            </div>
            <div className="profile-stat-item">
              <span className="pstat-value">{leadStats.followUps}</span>
              <span className="pstat-label">Follow-Ups</span>
            </div>
            <div className="profile-stat-item">
              <span className="pstat-value">{leadStats.visits}</span>
              <span className="pstat-label">Site Visits</span>
            </div>
            <div className="profile-stat-item">
              <span className="pstat-value" style={{ color: 'var(--primary)' }}>{leadStats.deals}</span>
              <span className="pstat-label">Deals Done</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="profile-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="profile-content-grid">
          <div className="profile-main-column">
            {activeTab === 'personal' && (
              <div className="settings-section">
                <div className="section-title-v6">
                  <h3>Personal Information</h3>
                  <p>Update your personal details here. Email address cannot be changed.</p>
                </div>

                <div className="settings-form-v6">
                  <div className="form-row-v6">
                    <div className="form-group-v6">
                      <label>Full Name</label>
                      <div className="input-with-icon">
                        <User size={18} />
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="Your full name"
                        />
                      </div>
                    </div>
                    <div className="form-group-v6">
                      <label>Email Address</label>
                      <div className="input-with-icon disabled">
                        <Mail size={18} />
                        <input
                          type="email"
                          value={userData.email}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row-v6">
                    <div className="form-group-v6">
                      <label>Phone Number</label>
                      <div className="input-with-icon">
                        <Phone size={18} />
                        <input
                          type="tel"
                          value={editData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="+880 XXXX XXXXXX"
                        />
                      </div>
                    </div>
                    <div className="form-group-v6">
                      <label>Location</label>
                      <div className="input-with-icon">
                        <MapPin size={18} />
                        <input
                          type="text"
                          value={editData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          placeholder="Your city or area"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group-v6">
                    <label>Bio / Description</label>
                    <textarea
                      rows="4"
                      value={editData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      placeholder="Write something about yourself..."
                    />
                  </div>

                  {hasChanges && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="primary" icon={isSaving ? Loader2 : Save} disabled={isSaving} onClick={handleSave}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-section">
                <div className="section-title-v6">
                  <h3>Security Settings</h3>
                  <p>Keep your account secure with a strong password.</p>
                </div>

                <div className="security-cards-v6">
                  <div className="security-card">
                    <div className="s-card-info">
                      <Lock size={20} />
                      <div>
                        <h4>Password Management</h4>
                        <p>Update your account password anytime</p>
                      </div>
                    </div>
                    <button className="btn-secondary-v6" onClick={() => setIsPasswordModalOpen(true)}>
                      Update Password
                    </button>
                  </div>

                  <div className="security-card">
                    <div className="s-card-info">
                      <ShieldCheck size={20} />
                      <div>
                        <h4>Account Verified</h4>
                        <p>Your email address is verified and secure.</p>
                      </div>
                    </div>
                    <span className="profile-role-chip" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      ✓ Verified
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side Column */}
          <div className="profile-side-column">
            {/* Account Info Card */}
            <div className="info-card-v6">
              <h4>Account Details</h4>
              <div className="info-list-v6">
                <div className="info-item-v6">
                  <Hash size={16} />
                  <span>Role: <strong>{userData.role || 'Not Set'}</strong></span>
                </div>
                {userData.reportsTo && (
                  <div className="info-item-v6">
                    <User size={16} />
                    <span>Reports To: <strong>{userData.reportsTo}</strong></span>
                  </div>
                )}
                <div className="info-item-v6">
                  <Calendar size={16} />
                  <span>Joined: <strong>{formatJoinDate(userData.joinedAt)}</strong></span>
                </div>
                {userData.phone && (
                  <div className="info-item-v6">
                    <Phone size={16} />
                    <span>{userData.phone}</span>
                  </div>
                )}
                {userData.location && (
                  <div className="info-item-v6">
                    <MapPin size={16} />
                    <span>{userData.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lead Performance Card */}
            <div className="info-card-v6">
              <h4>My Performance</h4>
              <div className="perf-grid">
                <div className="perf-item">
                  <span className="perf-val">{leadStats.total}</span>
                  <span className="perf-label">Leads</span>
                </div>
                <div className="perf-item">
                  <span className="perf-val" style={{ color: '#3b82f6' }}>{leadStats.followUps}</span>
                  <span className="perf-label">Follow-Ups</span>
                </div>
                <div className="perf-item">
                  <span className="perf-val" style={{ color: '#f59e0b' }}>{leadStats.visits}</span>
                  <span className="perf-label">Visits</span>
                </div>
                <div className="perf-item">
                  <span className="perf-val" style={{ color: 'var(--primary)' }}>{leadStats.deals}</span>
                  <span className="perf-label">Deals</span>
                </div>
              </div>
              {leadStats.total > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <span>Deal Conversion Rate</span>
                    <span style={{ color: 'var(--primary)' }}>{Math.round((leadStats.deals / leadStats.total) * 100)}%</span>
                  </div>
                  <div className="p-progress-bg">
                    <div
                      className="p-progress-fill"
                      style={{ width: `${Math.round((leadStats.deals / leadStats.total) * 100)}%`, background: 'var(--primary)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError('');
        }}
        title="Update Password"
        className="glass-modal"
      >
        <form onSubmit={handlePasswordUpdate} className="settings-form-v6" style={{ marginTop: '8px' }}>
          {passwordError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', marginBottom: '8px', fontSize: '0.875rem' }}>
              <AlertCircle size={18} />
              <span>{passwordError}</span>
            </div>
          )}

          {[
            { label: 'Current Password', value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, toggleShow: () => setShowCurrentPassword(p => !p), placeholder: 'Enter current password' },
            { label: 'New Password', value: newPassword, setter: setNewPassword, show: showNewPassword, toggleShow: () => setShowNewPassword(p => !p), placeholder: 'Min. 6 characters' },
            { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, toggleShow: () => setShowConfirmPassword(p => !p), placeholder: 'Confirm new password' },
          ].map(({ label, value, setter, show, toggleShow, placeholder }) => (
            <div className="form-group-v6" key={label}>
              <label>{label}</label>
              <div className="input-with-icon">
                <Lock size={18} />
                <input
                  type={show ? "text" : "password"}
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  disabled={isUpdatingPassword}
                />
                <button
                  type="button"
                  onClick={toggleShow}
                  style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => { setIsPasswordModalOpen(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }} disabled={isUpdatingPassword}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isUpdatingPassword} icon={isUpdatingPassword ? Loader2 : undefined}>
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {toastConfig.show && (
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          onClose={() => setToastConfig({ ...toastConfig, show: false })}
        />
      )}
    </DashboardLayout>
  );
};

export default ProfilePage;
