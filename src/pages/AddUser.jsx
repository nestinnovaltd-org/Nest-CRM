import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { SYSTEM_MODULES as modules } from '../constants/modules';
import { 
  ChevronRight, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Copy,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Users,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './AddUser.css';


const AddUserPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = parseInt(searchParams.get('step')) || 1;
  const [currentStep, setCurrentStep] = useState(stepParam);
  
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dynamic Data States
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    role: '',
    reportsTo: '',
    sendEmail: true,
    status: 'Active',
    permissions: null, // User-specific overrides
    orgId: '' // Organization (Super Admin picker)
  });

  // Sync step with URL
  useEffect(() => {
    setSearchParams({ step: currentStep }, { replace: true });
  }, [currentStep]);

  // Load Roles, Potential Managers, and (for Super Admin) Organizations
  useEffect(() => {
    const fetchData = async () => {
      const { data: rolesData } = await supabase.from('roles').select('*').order('created_at', { ascending: true });
      setRoles(rolesData || []);

      const { data: usersData } = await supabase.from('users').select('*').order('full_name', { ascending: true });
      setUsers(usersData || []);

      // Super Admin can pick which org the new user belongs to
      if (user?.account_type === 'super_admin') {
        const { data: orgsData } = await supabase.from('organizations').select('id, name').order('name', { ascending: true });
        setOrganizations(orgsData || []);
      }

      setIsLoading(false);
    };
    fetchData();
  }, [user]);

  // When role changes, sync permissions preview
  useEffect(() => {
    if (formData.role && roles.length > 0) {
      const selectedRole = roles.find(r => r.name === formData.role);
      if (selectedRole && !formData.permissions) {
        setFormData(prev => ({ ...prev, permissions: JSON.parse(JSON.stringify(selectedRole.permissions || {})) }));
      }
    }
  }, [formData.role, roles]);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handlePermissionChange = (moduleName, subModule, action, value) => {
    const updatedPermissions = { ...(formData.permissions || {}) };
    if (!updatedPermissions[moduleName]) updatedPermissions[moduleName] = {};
    if (!updatedPermissions[moduleName][subModule]) updatedPermissions[moduleName][subModule] = {};
    
    updatedPermissions[moduleName][subModule][action] = value;
    
    setFormData({
      ...formData,
      permissions: updatedPermissions
    });
  };

  const handleSelectAllModule = (moduleName, value) => {
    const updatedPermissions = { ...(formData.permissions || {}) };
    const module = modules.find(m => m.name === moduleName);
    
    module.subModules.forEach(sub => {
      if (!updatedPermissions[moduleName]) updatedPermissions[moduleName] = {};
      updatedPermissions[moduleName][sub] = {
        create: value,
        read: value,
        update: value,
        delete: value
      };
    });
    
    setFormData({
      ...formData,
      permissions: updatedPermissions
    });
  };

  const handleSubmit = async (e, addAnother = false) => {
    e?.preventDefault();
    if (!formData.fullName || !formData.email) {
      toast.error('Please fill in the Name and Email fields.');
      setCurrentStep(1);
      return;
    }
    if (!password) {
      toast.error('Please generate or enter a password for the user.');
      setCurrentStep(2);
      return;
    }

    try {
      setIsSubmitting(true);

      // ── Save creator's session BEFORE signUp ─────────────────────────────
      // supabase.auth.signUp() auto-logs-in the new user on the client,
      // switching sessions. We save the current session and restore it after.
      const { data: { session: creatorSession } } = await supabase.auth.getSession();

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: password,
        options: {
          data: {
            full_name: formData.fullName,
            role: formData.role
          }
        }
      });

      // ── Immediately restore creator's session ────────────────────────────
      if (creatorSession?.access_token && creatorSession?.refresh_token) {
        await supabase.auth.setSession({
          access_token: creatorSession.access_token,
          refresh_token: creatorSession.refresh_token,
        });
      }

      if (authError) throw authError;
      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error('User creation failed — no user ID returned.');

      // 2. Determine account_type
      let accountType = 'org_employee';
      if (formData.role === 'Super Admin') accountType = 'super_admin';
      else if (formData.role === 'Admin') accountType = 'org_admin';

      // 3. Determine org_id
      //    - Super Admin picks via org picker (formData.orgId)
      //    - Org Admin/Employee automatically inherits the creator's org
      const resolvedOrgId = user?.account_type === 'super_admin'
        ? (formData.orgId || null)
        : (user?.org_id || user?.org?.id || null);

      // 4. Build permissions — ONLY what was checked in Step 5
      //    Empty permissions array means no custom overrides (role defaults apply)
      let resolvedPermissions = [];
      if (formData.permissions && Object.keys(formData.permissions).length > 0) {
        resolvedPermissions = [formData.permissions];
      }

      // 5. Upsert user profile in users table
      const { error: upsertError } = await supabase.from('users').upsert({
        id: newUserId,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        username: formData.username,
        role: formData.role,
        reports_to: formData.reportsTo,
        send_email: formData.sendEmail,
        status: formData.status,
        permissions: resolvedPermissions,
        uid: newUserId,
        account_type: accountType,
        org_id: resolvedOrgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      if (addAnother) {
        toast.success(`${formData.fullName} created! Add another user.`);
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          username: '',
          role: '',
          reportsTo: '',
          sendEmail: true,
          status: 'Active',
          permissions: null,
          orgId: ''
        });
        setPassword('');
        setCurrentStep(1);
      } else {
        toast.success(`✅ User "${formData.fullName}" created successfully!`);
        setTimeout(() => navigate('/users/all'), 1200);
      }

    } catch (error) {
      console.error('Error creating user:', error);
      let message = 'Failed to create user.';
      if (error.message?.includes('already registered') || error.message?.includes('already been registered'))
        message = 'This email is already registered.';
      if (error.message?.includes('weak') || error.message?.includes('short'))
        message = 'Password is too weak (min 6 characters).';
      toast.error(`❌ ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const steps = [
    { id: 1, label: 'Profile', icon: User },
    { id: 2, label: 'Account', icon: Lock },
    { id: 3, label: 'Status', icon: Shield },
    { id: 4, label: 'Hierarchy', icon: Users },
    { id: 5, label: 'Permissions', icon: Check },
  ];


  return (
    <DashboardLayout>
      <div className="add-user-page">
        {/* Header */}
        <div className="add-user-header">
          <div className="breadcrumb">
            <Link to="/users/all">User Management</Link>
            <ChevronRight size={14} />
            <span>Add User</span>
          </div>
          <div className="header-with-back">
            <div className="title-section">
              <button className="back-btn-v2" onClick={() => navigate('/users/all')}>
                <ArrowLeft size={20} />
              </button>
              <h1>Add New User</h1>
            </div>
            
            <div className="header-actions-v3">
              <button type="button" className="btn-secondary-v3" onClick={() => navigate('/users/all')}>Cancel</button>
              
              {currentStep > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  icon={ArrowLeft} 
                  onClick={prevStep}
                  className="step-btn"
                >
                  Previous
                </Button>
              )}

              {currentStep < 5 ? (
                <Button 
                  type="button" 
                  variant="primary" 
                  icon={ArrowRight} 
                  onClick={nextStep}
                  className="step-btn"
                >
                  Next Step
                </Button>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn-secondary-v3"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, true)}
                  >
                    Save &amp; Add Another
                  </button>
                  <Button 
                    variant="primary" 
                    type="button"
                    icon={Save} 
                    isLoading={isSubmitting}
                    onClick={(e) => handleSubmit(e, false)}
                  >
                    Create User
                  </Button>
                </>

              )}
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="form-stepper">
          {steps.map((step) => (
            <div 
              key={step.id} 
              className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              onClick={() => setCurrentStep(step.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="step-number">
                {currentStep > step.id ? <Check size={18} /> : step.id}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="add-user-container">
          
          {currentStep === 1 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Full Name <span>*</span></label>
                    <input 
                      type="text" 
                      placeholder="e.g. Ahmedullah Khan" 
                      required 
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Email Address <span>*</span></label>
                    <input 
                      type="email" 
                      placeholder="email@nestinnova.com" 
                      required 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Phone Number</label>
                    <div className="phone-input-wrapper">
                      <div className="country-selector">
                        <img src="https://flagcdn.com/w20/bd.png" alt="BD" />
                        <span>+880</span>
                      </div>
                      <input 
                        type="tel" 
                        placeholder="17XX-XXXXXX" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Job Title / Role */}
                  <div className="form-group-v3 full-width">
                    <label>Job Title / Role</label>
                    <div className="select-wrapper">
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="">— Select Role —</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-chevron" />
                    </div>
                  </div>

                  {/* Super Admin: Organization Selector */}
                  {user?.account_type === 'super_admin' && (
                    <div className="form-group-v3 full-width">
                      <label>Organization <span>*</span></label>
                      <div className="select-wrapper">
                        <select
                          value={formData.orgId}
                          onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
                          required
                        >
                          <option value="">— Select Organization —</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="select-chevron" />
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}


          {currentStep === 2 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Username</label>
                    <input 
                      type="text" 
                      placeholder="ahmed.khan" 
                      value={formData.username || formData.fullName.toLowerCase().replace(/\s+/g, '.')}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Password Setup</label>
                    <div className="password-input-wrapper">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create secure password"
                      />
                      <div className="password-actions">
                        <button type="button" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button type="button" title="Generate Password" onClick={generatePassword}>
                          <RefreshCw size={16} />
                        </button>
                        {password && (
                          <button type="button" title="Copy" onClick={handleCopy}>
                            {isCopied ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <label className="checkbox-v3 mt-16">
                  <input 
                    type="checkbox" 
                    checked={formData.sendEmail} 
                    onChange={(e) => setFormData({...formData, sendEmail: e.target.checked})}
                  />
                  <span>Send login details via email automatically</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 3 — Account Status only */}
          {currentStep === 3 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Account Status</label>
                    <div className="toggle-v3">
                      <input 
                        type="checkbox" 
                        checked={formData.status === 'Active'}
                        onChange={(e) => setFormData({...formData, status: e.target.checked ? 'Active' : 'Inactive'})}
                      />
                      <div className="slider"></div>
                      <span>{formData.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {currentStep === 4 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3 full-width">
                    <label>Reports To</label>
                    <select 
                      className="select-v3"
                      value={formData.reportsTo}
                      onChange={(e) => setFormData({...formData, reportsTo: e.target.value})}
                    >
                      <option value="">— Select Manager —</option>
                      {users
                        .filter(u => u.account_type !== 'super_admin')
                        .map(u => {
                          const displayName = u.full_name || u.fullName || u.name || '(No Name)';
                          const displayEmail = u.email ? ` · ${u.email}` : '';
                          const displayRole = u.role ? ` (${u.role})` : '';
                          return (
                            <option key={u.id} value={displayName}>
                              {displayName}{displayEmail}{displayRole}
                            </option>
                          );
                        })
                      }

                    </select>
                  </div>
                </div>
                {formData.reportsTo && (
                  <div className="hierarchy-hint mt-16">
                    <Check size={14} />
                    <span>This user will report to <strong>{formData.reportsTo}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="section-header-v4">
                  <div className="title-area">
                    <h3>Custom Permissions Override</h3>
                    <p>Adjust granular access specifically for this user. These will override role defaults.</p>
                  </div>
                </div>
                
                <div className="permissions-matrix-v2">
                  <table className="permissions-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th className="text-center">Create</th>
                        <th className="text-center">Read</th>
                        <th className="text-center">Update</th>
                        <th className="text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map(module => (
                        <React.Fragment key={module.name}>
                          <tr className="module-group-row">
                            <td colSpan="5">
                              <div className="module-header-row">
                                <div className="module-title">
                                  <module.icon size={16} />
                                  {module.name}
                                </div>
                                <button 
                                  type="button"
                                  className="grant-all-btn"
                                  onClick={() => handleSelectAllModule(module.name, true)}
                                >
                                  Grant All
                                </button>
                              </div>
                            </td>
                          </tr>
                          {module.subModules.map(sub => (
                            <tr key={sub} className="sub-module-row">
                              <td className="sub-module-name">{sub}</td>
                              {['create', 'read', 'update', 'delete'].map(action => (
                                <td key={action} className="text-center">
                                  <input 
                                    type="checkbox" 
                                    className="permission-checkbox"
                                    checked={formData.permissions?.[module.name]?.[sub]?.[action] || false}
                                    onChange={(e) => handlePermissionChange(module.name, sub, action, e.target.checked)}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddUserPage;
