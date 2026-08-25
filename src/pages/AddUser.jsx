import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../lib/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
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
import './AddUser.css';

const AddUserPage = () => {
  const navigate = useNavigate();
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
    permissions: null // User-specific overrides
  });

  // Sync step with URL
  useEffect(() => {
    setSearchParams({ step: currentStep }, { replace: true });
  }, [currentStep]);

  // Load Roles & Potential Managers
  useEffect(() => {
    // Load Roles
    const qRoles = query(collection(db, 'roles'), orderBy('level', 'desc'));
    const unsubRoles = onSnapshot(qRoles, (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(rolesList);
    });

    // Load Users (for Reports To)
    const qUsers = query(collection(db, 'users'), orderBy('fullName', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      setIsLoading(false);
    });

    return () => {
      unsubRoles();
      unsubUsers();
    };
  }, []);

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
    if (!password) {
      alert("Please generate or enter a password for the user.");
      setCurrentStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      

      const tempAppName = `temp-app-${Date.now()}`;
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, 'users', newUser.uid), {
        ...formData,
        uid: newUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await signOut(tempAuth);
      await deleteApp(tempApp);

      alert(`✅ User ${formData.fullName} created successfully!`);
      
      if (addAnother) {
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          username: '',
          role: roles.length > 0 ? roles[roles.length - 1].name : '',
          reportsTo: '',
          sendEmail: true,
          status: 'Active',
          permissions: null
        });
        setPassword('');
        setCurrentStep(1);
      } else {
        navigate('/users/all');
      }
    } catch (error) {
      console.error("Error creating user:", error);
      let message = "Failed to create user.";
      if (error.code === 'auth/email-already-in-use') message = "This email is already registered.";
      if (error.code === 'auth/weak-password') message = "The password is too weak.";
      alert(`❌ Error: ${message}\n${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, label: 'Profile', icon: User },
    { id: 2, label: 'Account', icon: Lock },
    { id: 3, label: 'Role', icon: Shield },
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
                    Save & Add Another
                  </button>
                  <Button 
                    variant="primary" 
                    type="submit" 
                    icon={Save} 
                    isLoading={isSubmitting}
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

          {currentStep === 3 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>System Role</label>
                    <select 
                      className="select-v3"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      required
                    >
                      <option value="" disabled>Select Role</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>{role.name}</option>
                      ))}
                    </select>
                  </div>
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
                      <option value="">Select Manager</option>
                      {users.map(u => (
                        <option key={u.id} value={u.fullName || u.name}>{u.fullName || u.name} ({u.role})</option>
                      ))}
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
