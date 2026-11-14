import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';
import { useAuth, parseUserPermissions } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
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
  X,
  Building2,
  RefreshCw
} from 'lucide-react';
import './Roles.css';
import { SYSTEM_MODULES as modules } from '../constants/modules';

const RolesPage = () => {
  const { user, currentTenant, refreshRolePermissions } = useAuth();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [configMode, setConfigMode] = useState('users'); // default to 'users' for direct module access
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load Roles
  useEffect(() => {
    const fetchRoles = async () => {
      const { data, error } = await supabase.from('roles').select('*').order('created_at', { ascending: true });
      if (error) { 
        console.error('Error fetching roles:', error); 
        setIsLoading(false);
        return; 
      }
      const rolesList = data || [];
      setRoles(rolesList);
      if (!selectedRole && rolesList.length > 0) {
        setSelectedRole(rolesList[0]);
      } else if (selectedRole) {
        const updated = rolesList.find(r => r.id === selectedRole.id);
        if (updated) setSelectedRole(updated);
      }
      setIsLoading(false);
    };
    fetchRoles();
    const ch = supabase.channel('roles-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, fetchRoles)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedRole?.id]);

  // Load Users for counting & configuration
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      let query = supabase.from('users').select('*');
      
      if (user.account_type === 'super_admin') {
        if (currentTenant?.type === 'org') {
          query = query.eq('org_id', currentTenant.id);
        }
      } else if (user.org_id) {
        query = query.eq('org_id', user.org_id);
      } else {
        query = query.eq('id', user.uid || user.id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching users:', error);
        return;
      }
      // Filter out Super Admin users and map permissions
      const usersList = (data || []).filter(u => u.role !== 'Super Admin' && u.account_type !== 'super_admin')
        .map(u => ({
          ...u,
          permissions: parseUserPermissions(u.permissions)
        }));
      setUsers(usersList);
      // Keep selectedUser in sync OR auto-select first user
      if (selectedUser) {
        const updated = usersList.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
        else setSelectedUser(usersList[0] || null);
      } else if (usersList.length > 0) {
        setSelectedUser(usersList[0]);
      }
    };
    fetchUsers();
    const ch = supabase.channel('roles-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, currentTenant]);

  // Reset selection when workspace changes
  useEffect(() => {
    setSelectedUser(null);
    setHasChanges(false);
  }, [currentTenant?.id]);

  const handlePermissionChange = (moduleName, subModule, action, value) => {
    if (configMode === 'roles') {
      if (!selectedRole) return;
      
      const updatedPermissions = JSON.parse(JSON.stringify(selectedRole.permissions || {}));
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
      
      let basePermissions = JSON.parse(JSON.stringify(selectedUser.permissions || {}));
      
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
      const updatedPermissions = JSON.parse(JSON.stringify(selectedRole.permissions || {}));
      
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
      
      let basePermissions = JSON.parse(JSON.stringify(selectedUser.permissions || {}));
      
      if (value) {
        if (!basePermissions[moduleName]) basePermissions[moduleName] = {};
        module.subModules.forEach(sub => {
          basePermissions[moduleName][sub] = {
            create: true,
            read: true,
            update: true,
            delete: true
          };
        });
      } else {
        // Revoke entire module from user
        delete basePermissions[moduleName];
      }
      
      setSelectedUser({
        ...selectedUser,
        permissions: basePermissions
      });
      setHasChanges(true);
    }
  };

  const handleGrantAllUserModules = () => {
    if (!selectedUser) return;
    const allPerms = {};
    modules.forEach(m => {
      allPerms[m.name] = {};
      m.subModules.forEach(sub => {
        allPerms[m.name][sub] = {
          create: true,
          read: true,
          update: true,
          delete: true
        };
      });
    });
    setSelectedUser({
      ...selectedUser,
      permissions: allPerms
    });
    setHasChanges(true);
  };

  const handleRevokeAllUserModules = () => {
    if (!selectedUser) return;
    setSelectedUser({
      ...selectedUser,
      permissions: {}
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (configMode === 'roles') {
        const { error } = await supabase.from('roles').update({
          permissions: selectedRole.permissions
        }).eq('id', selectedRole.id);
        
        if (error) throw error;
        setHasChanges(false);
        toast.success('Role permissions saved successfully!');
        // Refresh permissions for the currently logged-in user in real-time
        await refreshRolePermissions();
      } else {
        // Save user's explicit module permissions (strictly what was granted to this user)
        const cleanPermissions = JSON.parse(JSON.stringify(selectedUser.permissions || {}));

        // Clean out empty modules
        Object.keys(cleanPermissions).forEach(modName => {
          const mod = cleanPermissions[modName];
          if (typeof mod === 'object' && mod !== null) {
            let hasAnyTrue = false;
            Object.keys(mod).forEach(sub => {
              if (typeof mod[sub] === 'object' && mod[sub] !== null) {
                const subHasTrue = Object.values(mod[sub]).some(Boolean);
                if (!subHasTrue) delete mod[sub];
                else hasAnyTrue = true;
              } else if (mod[sub] === true) {
                hasAnyTrue = true;
              }
            });
            if (!hasAnyTrue) delete cleanPermissions[modName];
          }
        });

        const permissionsPayload = [JSON.stringify(cleanPermissions)];
        const { error } = await supabase.from('users').update({
          permissions: permissionsPayload,
          updated_at: new Date().toISOString()
        }).eq('id', selectedUser.id);
        
        if (error) throw error;
        setHasChanges(false);
        setSelectedUser({ ...selectedUser, permissions: cleanPermissions });
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, permissions: cleanPermissions } : u));
        toast.success(`Module access saved for ${selectedUser.full_name || selectedUser.name}!`);
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToRoleDefault = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Are you sure you want to reset permissions for ${selectedUser.full_name || selectedUser.fullName || selectedUser.name} to the role default?`)) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('users').update({
        permissions: [],
        updated_at: new Date().toISOString()
      }).eq('id', selectedUser.id);
      
      if (error) throw error;
      setSelectedUser({ ...selectedUser, permissions: {} });
      setHasChanges(false);
      toast.success('Permissions reset to role default!');
    } catch (error) {
      console.error('Error resetting permissions:', error);
      toast.error('Failed to reset permissions: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');

    try {
      const roleId = name.toLowerCase().replace(/\s+/g, '_');
      await supabase.from('roles').upsert({
        id: roleId,
        name,
        permissions: {},
        created_at: new Date().toISOString()
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await supabase.from('roles').delete().eq('id', roleId);
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
        { id: 'admin', name: 'Admin' },
        { id: 'manager', name: 'Manager' },
        { id: 'team_member', name: 'Team Member' }
      ];

      for (const role of defaults) {
        const perms = {};
        modules.forEach(m => {
          perms[m.name] = {};
          m.subModules.forEach(s => {
            const hasAccess = role.id === 'admin';
            perms[m.name][s] = { 
              create: hasAccess, 
              read: true, 
              update: hasAccess, 
              delete: hasAccess 
            };
          });
        });

        await supabase.from('roles').upsert({
          id: role.id,
          name: role.name,
          permissions: perms,
          created_at: new Date().toISOString()
        });
      }
      
      toast.success('System roles initialized successfully!');
    } catch (error) {
      console.error("Error initializing roles:", error);
      toast.error('Failed to initialize roles: ' + error.message);
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
                className={`panel-tab-btn ${configMode === 'users' ? 'active' : ''}`}
                onClick={() => {
                  if (hasChanges && !window.confirm("Unsaved changes will be lost. Continue?")) return;
                  setConfigMode('users');
                  setSelectedRole(null);
                  if (users.length > 0) {
                    setSelectedUser(users[0]);
                  }
                  setHasChanges(false);
                }}
              >
                User Module Access
              </button>
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
                  <h3>User Module Access</h3>
                  <p>{users.length} Users</p>
                </div>
                {/* Workspace context label */}
                {currentTenant?.name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'var(--accent-bg, rgba(0,200,150,0.08))', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, width: '100%' }}>
                    <Building2 size={13} />
                    <span>{currentTenant.name}</span>
                  </div>
                )}
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
                    const fullName = u.full_name || u.fullName || u.name || '';
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

                  return filteredUsers.map(u => {
                    const grantedModules = u.permissions && typeof u.permissions === 'object' 
                      ? Object.keys(u.permissions).filter(k => u.permissions[k] && Object.keys(u.permissions[k]).length > 0)
                      : [];
                    const count = grantedModules.length;

                    return (
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
                          <span className="role-name">{u.full_name || u.fullName || u.name}</span>
                          <span className="role-users" style={{ opacity: 0.7 }}>{u.role || 'No Role'}</span>
                          <span 
                            className="custom-override-badge"
                            style={{ 
                              marginTop: '4px', 
                              display: 'inline-block',
                              background: count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: count > 0 ? '#10b981' : '#ef4444',
                              borderColor: count > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            }}
                          >
                            {count > 0 ? `${count} Modules Granted` : 'No Modules Granted'}
                          </span>
                        </div>
                        <ChevronRight size={16} className="role-chevron" />
                      </div>
                    );
                  });
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
                          ? `${selectedRole?.name} Role Template` 
                          : `${selectedUser?.full_name || selectedUser?.fullName || selectedUser?.name} Module Access`
                        }
                      </h2>
                      <p>
                        {configMode === 'roles' 
                          ? (selectedRole?.description || 'Template permissions for this role')
                          : <>
                              {selectedUser?.email || 'No Email'} • Role: {selectedUser?.role || 'None'}
                              {currentTenant?.name && (
                                <> • <Building2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />{currentTenant.name}</>
                              )}
                            </>
                        }
                      </p>
                    </div>
                  </div>
                  <div className="panel-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {configMode === 'users' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleGrantAllUserModules}
                          disabled={isSaving}
                        >
                          Grant All Modules
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleRevokeAllUserModules}
                          disabled={isSaving}
                        >
                          Clear All
                        </Button>
                      </>
                    )}
                    {hasChanges && (
                      <span className="unsaved-warning">
                        <AlertCircle size={14} /> Unsaved changes
                      </span>
                    )}

                    <Button 
                      variant="primary" 
                      icon={isSaving ? null : Save} 
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{ position: 'relative' }}
                    >
                      {isSaving ? "Saving..." : "Save Module Access"}
                      {hasChanges && !isSaving && (
                        <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', border: '2px solid var(--card-bg)' }} />
                      )}
                    </Button>
                  </div>
                </div>

                {configMode === 'users' && (
                  <div style={{ margin: '0 0 16px 0', padding: '10px 14px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8125rem', color: '#93c5fd' }}>
                    <Info size={16} style={{ flexShrink: 0, color: '#60a5fa' }} />
                    <span>
                      <strong>Direct Module Access:</strong> Non-Super Admin users access ONLY the specific modules and permissions checked below. Access is not inherited from roles.
                    </span>
                  </div>
                )}

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
                                  {/* Controlled: checked if EVERY submodule×action is true */}
                                  {(() => {
                                    const perms = configMode === 'roles' ? selectedRole?.permissions : selectedUser?.permissions;
                                    const isAllChecked = module.subModules.every(sub =>
                                      ['create','read','update','delete'].every(act => perms?.[module.name]?.[sub]?.[act] === true)
                                    );
                                    return (
                                      <input 
                                        type="checkbox"
                                        checked={isAllChecked}
                                        onChange={(e) => handleSelectAllModule(module.name, e.target.checked)} 
                                      />
                                    );
                                  })()}
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
                                  ? selectedRole?.permissions?.[module.name]?.[sub]?.[action] === true
                                  : selectedUser?.permissions?.[module.name]?.[sub]?.[action] === true;

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
