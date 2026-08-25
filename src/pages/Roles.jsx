import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Shield, 
  Plus, 
  ChevronRight, 
  Check, 
  Info, 
  AlertCircle,
  Users,
  Settings,
  LayoutDashboard,
  GitMerge,
  CreditCard,
  CalendarDays,
  BarChart3,
  Bell,
  Search,
  Lock,
  MoreVertical,
  Save,
  Trash2,
  X
} from 'lucide-react';
import './Roles.css';
import { SYSTEM_MODULES as modules } from '../constants/modules';

const RolesPage = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [configMode, setConfigMode] = useState('roles'); // 'roles' or 'users'
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load Roles
  useEffect(() => {
    const q = query(collection(db, 'roles'), orderBy('level', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRoles(rolesList);
      
      // Select first role by default if none selected
      if (!selectedRole && rolesList.length > 0) {
        setSelectedRole(rolesList[0]);
      } else if (selectedRole) {
        // Update selected role data if it changed in DB
        const updated = rolesList.find(r => r.id === selectedRole.id);
        if (updated) setSelectedRole(updated);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedRole?.id]);

  // Load Users for counting & configuration
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      
      if (selectedUser) {
        const updated = usersList.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    });
    return () => unsubscribe();
  }, [selectedUser?.id]);

  const handlePermissionChange = (moduleName, subModule, action, value) => {
    if (configMode === 'roles') {
      if (!selectedRole) return;
      
      const updatedPermissions = { ...selectedRole.permissions };
      if (!updatedPermissions[moduleName]) updatedPermissions[moduleName] = {};
      if (!updatedPermissions[moduleName][subModule]) updatedPermissions[moduleName][subModule] = {};
      
      updatedPermissions[moduleName][subModule][action] = value;
      
      setSelectedRole({
        ...selectedRole,
        permissions: updatedPermissions
      });
      setHasChanges(true);
    } else {
      if (!selectedUser) return;
      
      let basePermissions = { ...(selectedUser.permissions || {}) };
      const hasUserOverride = selectedUser.permissions && Object.keys(selectedUser.permissions).length > 0;
      if (!hasUserOverride) {
        const userRole = roles.find(r => r.name.toLowerCase() === selectedUser.role?.toLowerCase());
        basePermissions = JSON.parse(JSON.stringify(userRole?.permissions || {}));
      }
      
      if (!basePermissions[moduleName]) basePermissions[moduleName] = {};
      if (!basePermissions[moduleName][subModule]) basePermissions[moduleName][subModule] = {};
      basePermissions[moduleName][subModule][action] = value;
      
      setSelectedUser({
        ...selectedUser,
        permissions: basePermissions
      });
      setHasChanges(true);
    }
  };

  const handleSelectAllModule = (moduleName, value) => {
    const module = modules.find(m => m.name === moduleName);
    
    if (configMode === 'roles') {
      if (!selectedRole) return;
      const updatedPermissions = { ...selectedRole.permissions };
      
      module.subModules.forEach(sub => {
        if (!updatedPermissions[moduleName]) updatedPermissions[moduleName] = {};
        updatedPermissions[moduleName][sub] = {
          create: value,
          read: value,
          update: value,
          delete: value
        };
      });
      
      setSelectedRole({
        ...selectedRole,
        permissions: updatedPermissions
      });
      setHasChanges(true);
    } else {
      if (!selectedUser) return;
      
      let basePermissions = { ...(selectedUser.permissions || {}) };
      const hasUserOverride = selectedUser.permissions && Object.keys(selectedUser.permissions).length > 0;
      if (!hasUserOverride) {
        const userRole = roles.find(r => r.name.toLowerCase() === selectedUser.role?.toLowerCase());
        basePermissions = JSON.parse(JSON.stringify(userRole?.permissions || {}));
      }
      
      module.subModules.forEach(sub => {
        if (!basePermissions[moduleName]) basePermissions[moduleName] = {};
        basePermissions[moduleName][sub] = {
          create: value,
          read: value,
          update: value,
          delete: value
        };
      });
      
      setSelectedUser({
        ...selectedUser,
        permissions: basePermissions
      });
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (configMode === 'roles') {
        const roleRef = doc(db, 'roles', selectedRole.id);
        await updateDoc(roleRef, {
          permissions: selectedRole.permissions,
          updatedAt: serverTimestamp()
        });
        setHasChanges(false);
        toast.success("Role permissions saved successfully!");
      } else {
        const userRef = doc(db, 'users', selectedUser.id);
        await updateDoc(userRef, {
          permissions: selectedUser.permissions,
          updatedAt: serverTimestamp()
        });
        setHasChanges(false);
        toast.success("User permissions overrides saved successfully!");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToRoleDefault = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Are you sure you want to reset permissions for ${selectedUser.fullName || selectedUser.name} to the role default?`)) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        permissions: {},
        updatedAt: serverTimestamp()
      });
      setSelectedUser({
        ...selectedUser,
        permissions: {}
      });
      setHasChanges(false);
      toast.success("Permissions reset to role default successfully!");
    } catch (error) {
      console.error("Error resetting permissions:", error);
      toast.error("Failed to reset permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const description = formData.get('description');
    const level = parseInt(formData.get('level'));

    try {
      const roleId = name.toLowerCase().replace(/\s+/g, '_');
      const roleRef = doc(db, 'roles', roleId);
      
      await setDoc(roleRef, {
        name,
        description,
        level,
        users: 0,
        permissions: {}, // Start empty
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating role:", error);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      try {
        await deleteDoc(doc(db, 'roles', roleId));
        if (selectedRole?.id === roleId) {
          setSelectedRole(null);
        }
      } catch (error) {
        console.error("Error deleting role:", error);
      }
    }
  };

  const initializeDefaultRoles = async () => {
    if (!window.confirm("This will initialize default system roles (Admin, Manager, Team Member). Continue?")) return;
    
    setIsLoading(true);
    try {
      const defaults = [
        { id: 'admin', name: 'Admin', description: 'Full system access with all management privileges.', level: 10 },
        { id: 'manager', name: 'Manager', description: 'Management level access for overseeing teams and leads.', level: 5 },
        { id: 'team_member', name: 'Team Member', description: 'Standard access for day-to-day operations.', level: 1 }
      ];

      for (const role of defaults) {
        const roleRef = doc(db, 'roles', role.id);
        
        // Construct a "full" permission set for Admin, and empty for others
        const perms = {};
        modules.forEach(m => {
          perms[m.name] = {};
          m.subModules.forEach(s => {
            // Give Admin full access by default
            const hasAccess = role.id === 'admin';
            perms[m.name][s] = { 
              create: hasAccess, 
              read: true, // Everyone can read by default, or adjust as needed
              update: hasAccess, 
              delete: hasAccess 
            };
          });
        });

        await setDoc(roleRef, {
          ...role,
          users: 0,
          permissions: perms,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      alert("✅ System roles initialized successfully!");
    } catch (error) {
      console.error("Error initializing roles:", error);
      alert("❌ Failed to initialize roles: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="roles-page-container">
        
        <div className="roles-split-layout">
          {/* Left Panel */}
          <div className="roles-left-panel">
            {/* Panel Tabs Selection */}
            <div className="panel-toggle-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
              <button 
                className={`panel-tab-btn ${configMode === 'roles' ? 'active' : ''}`}
                onClick={() => {
                  if (hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) return;
                  setConfigMode('roles');
                  setSelectedUser(null);
                  if (roles.length > 0 && !selectedRole) {
                    setSelectedRole(roles[0]);
                  }
                  setHasChanges(false);
                }}
              >
                System Roles
              </button>
              <button 
                className={`panel-tab-btn ${configMode === 'users' ? 'active' : ''}`}
                onClick={() => {
                  if (hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) return;
                  setConfigMode('users');
                  setSelectedRole(null);
                  if (users.length > 0 && !selectedUser) {
                    setSelectedUser(users[0]);
                  }
                  setHasChanges(false);
                }}
              >
                Users List
              </button>
            </div>

            {configMode === 'roles' ? (
              <div className="panel-header">
                <div className="header-title-v4">
                  <h3>System Roles</h3>
                  <p>{roles.length} Active Roles</p>
                </div>
                <button className="create-role-btn" onClick={() => setShowCreateModal(true)}>
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                <div className="header-title-v4">
                  <h3>User Permissions</h3>
                  <p>{users.length} Total Users</p>
                </div>
                <div className="search-box-v4" style={{ position: 'relative', width: '100%', marginTop: '4px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem'
                    }}
                  />
                </div>
              </div>
            )}

            <div className="role-list">
              {isLoading ? (
                [1, 2, 3].map(i => <div key={i} className="role-item-skeleton"><Skeleton height="50px" /></div>)
              ) : configMode === 'roles' ? (
                roles.length === 0 ? (
                  <div className="empty-roles-v2">
                     <div className="empty-icon-wrapper">
                       <Lock size={32} />
                     </div>
                     <h4>Access Control Empty</h4>
                     <p>No system roles have been initialized yet.</p>
                     <button className="seed-action-btn" onClick={initializeDefaultRoles}>
                       <Plus size={16} />
                       Initialize Default Roles
                     </button>
                  </div>
                ) : (
                  roles.map(role => (
                    <div 
                      key={role.id} 
                      className={`role-item ${selectedRole?.id === role.id ? 'active' : ''}`}
                      onClick={() => {
                        if (hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) return;
                        setSelectedRole(role);
                        setHasChanges(false);
                      }}
                    >
                      <div className="role-info">
                        <span className="role-name">{role.name}</span>
                        <span className="role-users">{users.filter(u => u.role === role.name).length} Users</span>
                      </div>
                      <div className="role-actions-mini">
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }} className="role-delete-btn" title="Delete Role">
                            <Trash2 size={14} />
                         </button>
                         <ChevronRight size={16} className="role-chevron" />
                      </div>
                    </div>
                  ))
                )
              ) : (
                // Users Config Mode
                (() => {
                  const filteredUsers = users.filter(u => {
                    const fullName = u.fullName || u.name || '';
                    const email = u.email || '';
                    const roleName = u.role || '';
                    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           roleName.toLowerCase().includes(searchTerm.toLowerCase());
                  });

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="empty-roles-v2">
                        <h4>No Users Found</h4>
                        <p>No matching users found in the system.</p>
                      </div>
                    );
                  }

                  return filteredUsers.map(u => (
                    <div 
                      key={u.id} 
                      className={`role-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                      onClick={() => {
                        if (hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) return;
                        setSelectedUser(u);
                        setHasChanges(false);
                      }}
                    >
                      <div className="role-info" style={{ width: '100%' }}>
                        <span className="role-name">{u.fullName || u.name}</span>
                        <span className="role-users" style={{ opacity: 0.7 }}>{u.role || 'No Role'}</span>
                        {u.permissions && Object.keys(u.permissions).length > 0 && (
                          <span className="custom-override-badge">
                            Custom Override
                          </span>
                        )}
                      </div>
                      <ChevronRight size={16} className="role-chevron" />
                    </div>
                  ));
                })()
              )}
            </div>

            {configMode === 'roles' && (
              <div className="hierarchy-settings-card">
                <div className="card-header-v4">
                  <Settings size={16} />
                  <span>Reporting Structure</span>
                </div>
                <div className="hierarchy-list">
                  <div className="hierarchy-step">
                    <span className="level">Head</span>
                    <ChevronRight size={14} />
                    <span className="role">CEO / Admin</span>
                  </div>
                  <div className="hierarchy-step">
                    <span className="level">Manager</span>
                    <ChevronRight size={14} />
                    <span className="role">Sales Manager</span>
                  </div>
                  <div className="hierarchy-step">
                    <span className="level">Member</span>
                    <ChevronRight size={14} />
                    <span className="role">Sales Team</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="roles-right-panel">
            {((configMode === 'roles' && selectedRole) || (configMode === 'users' && selectedUser)) ? (
              <>
                <div className="permission-panel-header">
                  <div className="role-meta">
                    <div className="role-icon-large"><Shield size={24} className="icon-shield" /></div>
                    <div>
                      <h2>
                        {configMode === 'roles' 
                          ? `${selectedRole.name} Permissions` 
                          : `${selectedUser.fullName || selectedUser.name} Permissions`
                        }
                        {configMode === 'users' && selectedUser?.permissions && Object.keys(selectedUser.permissions).length > 0 && (
                          <span className="custom-override-badge" style={{ marginLeft: '12px', display: 'inline-block', verticalAlign: 'middle' }}>
                            Custom Override
                          </span>
                        )}
                      </h2>
                      <p>
                        {configMode === 'roles' 
                          ? selectedRole.description 
                          : `${selectedUser.email || 'No Email'} • Default Role: ${selectedUser.role || 'None'}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="panel-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hasChanges && (
                      <span className="unsaved-warning">
                        <AlertCircle size={14} /> Unsaved changes
                      </span>
                    )}
                    {configMode === 'users' && selectedUser?.permissions && Object.keys(selectedUser.permissions).length > 0 && (
                      <Button
                        variant="secondary"
                        onClick={handleResetToRoleDefault}
                        disabled={isSaving}
                      >
                        Reset to Role Default
                      </Button>
                    )}
                    <Button 
                      variant="primary" 
                      icon={isSaving ? null : Save} 
                      onClick={handleSave}
                      disabled={!hasChanges || isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Permissions"}
                    </Button>
                  </div>
                </div>

                <div className="permissions-matrix-container custom-scrollbar">
                  <table className="permissions-table">
                    <thead>
                      <tr>
                        <th>Module & Sub-module</th>
                        <th className="text-center">Create</th>
                        <th className="text-center">Read</th>
                        <th className="text-center">Update</th>
                        <th className="text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((module) => (
                        <React.Fragment key={module.name}>
                          <tr className="module-group-row">
                            <td colSpan="5">
                              <div className="module-header-cell">
                                <module.icon size={18} />
                                <span>{module.name}</span>
                                <div className="select-all-module">
                                  <input 
                                    type="checkbox" 
                                    onChange={(e) => handleSelectAllModule(module.name, e.target.checked)} 
                                  />
                                  <span>Select All Module</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {module.subModules.map(sub => (
                            <tr key={sub} className="sub-module-row">
                              <td className="sub-module-name">{sub}</td>
                              {['create', 'read', 'update', 'delete'].map(action => {
                                const isChecked = configMode === 'roles'
                                  ? selectedRole?.permissions?.[module.name]?.[sub]?.[action] || false
                                  : (() => {
                                      const hasUserOverride = selectedUser?.permissions && Object.keys(selectedUser.permissions).length > 0;
                                      if (hasUserOverride) {
                                        return selectedUser.permissions?.[module.name]?.[sub]?.[action] || false;
                                      } else {
                                        const userRole = roles.find(r => r.name.toLowerCase() === selectedUser?.role?.toLowerCase());
                                        return userRole?.permissions?.[module.name]?.[sub]?.[action] || false;
                                      }
                                    })();

                                return (
                                  <td key={action} className="text-center">
                                    <label className="perm-checkbox">
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => handlePermissionChange(module.name, sub, action, e.target.checked)}
                                      />
                                      <span className="checkmark"></span>
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="no-role-selected">
                 <Shield size={48} />
                 <h3>Select a Config Target</h3>
                 <p>Choose a role or user from the left panel to configure granular access levels across all modules.</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Role Modal */}
        <Modal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
          title="Create New System Role"
        >
          <form className="create-role-form" onSubmit={handleCreateRole}>
            <div className="form-group-v4">
              <label>Role Name</label>
              <input name="name" type="text" placeholder="e.g. Sales Executive" required />
            </div>
            <div className="form-group-v4">
              <label>Description</label>
              <textarea name="description" placeholder="What can users in this role do?"></textarea>
            </div>
            <div className="form-group-v4">
              <label>Hierarchy Level</label>
              <select name="level">
                <option value="1">Level 1 (Entry)</option>
                <option value="2">Level 2 (Intermediate)</option>
                <option value="5">Level 3 (Management)</option>
                <option value="10">Level 4 (Executive)</option>
              </select>
            </div>
            <div className="modal-footer-v4">
              <button type="button" className="btn-ghost-v4" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <Button variant="primary" type="submit">Create Role</Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default RolesPage;
