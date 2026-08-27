import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import Pagination from '../components/ui/Pagination';
import { supabase } from '../lib/supabase';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Key, 
  AlertCircle,
  Mail,
  Phone as PhoneIcon,
  X,
  Target,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SYSTEM_MODULES as modules } from '../constants/modules';
import './Users.css';

const UsersPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editReportsTo, setEditReportsTo] = useState('');
  const [editPermissions, setEditPermissions] = useState({});
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Target State
  const [targetData, setTargetData] = useState({
    leads: '',
    followups: ''
  });
  
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [roles, setRoles] = useState([]);

  // Mock User Data
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: usersList, error } = await supabase
        .from('users').select('*').order('created_at', { ascending: false });
      if (error) { console.error('Error fetching users:', error); setIsError(true); }
      else {
        const filteredList = (usersList || []).filter(u => u.role !== 'Super Admin' && u.account_type !== 'super_admin');
        setUsers(filteredList.map(u => ({ ...u, name: u.full_name || u.name || 'Unnamed User' })));
      }
      setIsLoading(false);

      const { data: rolesData } = await supabase.from('roles').select('*');
      setRoles(rolesData || []);
    };

    fetchData();

    const usersChannel = supabase.channel('users-page-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(usersChannel);
  }, []);

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditName(user.name || user.fullName || '');
    setEditRole(user.role || '');
    setEditReportsTo(user.reportsTo || user.reports_to || '');
    
    // Load existing permissions override
    const rawPerms = Array.isArray(user.permissions) && user.permissions.length > 0 ? user.permissions[0] : {};
    setEditPermissions(rawPerms);
    
    setShowEditDrawer(true);
  };

  const handlePermissionChange = (moduleName, subModule, action, value) => {
    setEditPermissions(prev => {
      const next = { ...prev };
      if (!next[moduleName]) next[moduleName] = {};
      if (!next[moduleName][subModule]) next[moduleName][subModule] = {};
      next[moduleName][subModule][action] = value;
      return next;
    });
  };

  const handleSelectAllModule = (moduleName, value) => {
    const module = modules.find(m => m.name === moduleName);
    setEditPermissions(prev => {
      const next = { ...prev };
      if (!next[moduleName]) next[moduleName] = {};
      module.subModules.forEach(sub => {
        next[moduleName][sub] = {
          create: value,
          read: value,
          update: value,
          delete: value
        };
      });
      return next;
    });
  };

  const openTargetModal = (e, user) => {
    e.stopPropagation();
    setSelectedUser(user);
    setTargetData({
      leads: user.target?.leads || '',
      followups: user.target?.followups || ''
    });
    setShowTargetModal(true);
  };

  const handleStatusToggle = async (user) => {
    try {
      await supabase.from('users').update({
        status: user.status === 'Active' ? 'Inactive' : 'Active'
      }).eq('id', user.id);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const saveTarget = async () => {
    try {
      await supabase.from('users').update({
        target: {
          leads: parseInt(targetData.leads),
          followups: parseInt(targetData.followups),
          progress: selectedUser.target?.progress || 0
        }
      }).eq('id', selectedUser.id);
      setShowTargetModal(false);
    } catch (error) {
      console.error('Error saving targets:', error);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      let resolvedPermissions = [];
      if (editPermissions && Object.keys(editPermissions).length > 0) {
        resolvedPermissions = [editPermissions];
      }

      await supabase.from('users').update({
        full_name: editName,
        name: editName,
        role: editRole,
        reports_to: editReportsTo,
        permissions: resolvedPermissions
      }).eq('id', selectedUser.id);

      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { 
              ...u, 
              full_name: editName, 
              name: editName, 
              role: editRole, 
              reports_to: editReportsTo, 
              permissions: resolvedPermissions 
            } 
          : u
      ));

      setShowEditDrawer(false);
    } catch (error) {
      console.error('Error saving user details:', error);
      alert('Failed to save user details.');
    }
  };

  if (isError) {
    return (
      <DashboardLayout>
        <div className="error-state-users">
          <AlertCircle size={64} className="error-icon" />
          <h2>Failed to load users</h2>
          <Button variant="primary" onClick={() => setIsLoading(true)}>Retry</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="users-page-container">
        {/* Header Actions */}
        <div className="users-header">
          <div className="header-info">
            <h1>All Users</h1>
            <p>Manage team hierarchy, access levels, and individual performance targets.</p>
          </div>
          <div className="header-actions">
            <div className="search-box-v2">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {hasPermission('User Management', 'create') && (
              <Button variant="primary" icon={UserPlus} onClick={() => navigate('/users/add')}>Add User</Button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="users-table-card">
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Role</th>
                  <th>Reports To</th>
                  <th>Monthly Target</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="user-row">
                      <td data-label="User Name"><Skeleton width="150px" height="40px" /></td>
                      <td data-label="Role"><Skeleton width="80px" /></td>
                      <td data-label="Reports To"><Skeleton width="120px" /></td>
                      <td data-label="Monthly Target"><Skeleton width="100px" /></td>
                      <td data-label="Status"><Skeleton width="60px" /></td>
                      <td data-label="Actions" className="text-right"><Skeleton width="40px" /></td>
                    </tr>
                  ))
                ) : (
                  users
                    .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map(u => (
                      <tr key={u.id} className="user-row" onClick={() => navigate(`/users/${u.id}`)}>
                        <td data-label="User Name">
                          <div className="user-cell">
                            <div className="user-avatar-v2">{u.name[0]}</div>
                            <div className="user-meta-sm">
                              <span className="user-name-bold">{u.name}</span>
                              <span className="user-email-sm">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Role">
                          <span className={`role-badge ${u.role.toLowerCase().replace(' ', '-')}`}>
                            {u.role}
                          </span>
                        </td>
                        <td data-label="Reports To">{u.reportsTo}</td>
                        <td data-label="Monthly Target">
                          {u.target ? (
                            <div className="target-progress-sm">
                              <div className="progress-text-sm">
                                <Target size={12} />
                                <span>{u.target.progress}%</span>
                              </div>
                              <div className="mini-progress-bg">
                                <div className="mini-progress-fill" style={{ width: `${u.target.progress}%` }}></div>
                              </div>
                            </div>
                          ) : (
                            <span className="no-target-text">No target set</span>
                          )}
                        </td>
                        <td data-label="Status" onClick={(e) => e.stopPropagation()}>
                          <div 
                            className={`status-toggle ${u.status?.toLowerCase() || 'inactive'}`}
                            onClick={() => handleStatusToggle(u)}
                          >
                            <div className="toggle-dot"></div>
                            <span>{u.status}</span>
                          </div>
                        </td>
                        <td data-label="Actions" className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="user-actions">
                            {hasPermission('User Management', 'update') && (
                              <button className="action-circle-btn target icon-target" title="Set Target" onClick={(e) => openTargetModal(e, u)}>
                                <Target size={16} />
                              </button>
                            )}
                            {hasPermission('User Management', 'update') && (
                              <button className="action-circle-btn icon-edit" title="Edit User" onClick={() => openEdit(u)}><Edit3 size={16} /></button>
                            )}
                            <button className="action-circle-btn view icon-view" title="View Details" onClick={() => navigate(`/users/${u.id}`)}>
                              <ChevronRight size={16} />
                            </button>
                            {hasPermission('User Management', 'delete') && (
                              <button className="action-circle-btn delete icon-delete" title="Delete User"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={Math.ceil(users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).length}
            itemsPerPage={itemsPerPage}
          />
        </div>

        {/* Target Modal */}
        <Modal
          isOpen={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          title={`Set Individual Target for ${selectedUser?.name}`}
          size="md"
        >
          <div className="target-modal-body">
            <div className="form-group-v3">
              <label>Monthly Lead Target</label>
              <input 
                type="number" 
                placeholder="e.g. 20" 
                value={targetData.leads}
                onChange={(e) => setTargetData({...targetData, leads: e.target.value})}
              />
            </div>
            <div className="form-group-v3 mt-16">
              <label>Monthly Follow-up Target</label>
              <input 
                type="number" 
                placeholder="e.g. 80" 
                value={targetData.followups}
                onChange={(e) => setTargetData({...targetData, followups: e.target.value})}
              />
            </div>
            <div className="modal-footer-btns mt-24">
              <Button variant="outline" onClick={() => setShowTargetModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveTarget}>Save Targets</Button>
            </div>
          </div>
        </Modal>

        {/* Edit User Drawer */}
        <div className={`edit-user-drawer ${showEditDrawer ? 'open' : ''}`}>
          <div className="drawer-header">
            <h3>User Settings</h3>
            <button className="close-drawer-btn" onClick={() => setShowEditDrawer(false)}><X size={24} /></button>
          </div>
          {selectedUser && (
            <div className="drawer-content">
              <div className="drawer-avatar-section">
                <div className="large-avatar">{selectedUser.name[0]}</div>
                <h4>{selectedUser.name}</h4>
                <p>{selectedUser.role} • {selectedUser.email}</p>
              </div>
              <div className="drawer-form">
                <div className="form-group-v3">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    className="input-v2" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                  />
                </div>
                <div className="form-group-v3 mt-16">
                  <label>Role</label>
                  <select 
                    className="select-v3" 
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-v3 mt-16">
                  <label>Reports To</label>
                  <select 
                    className="select-v3" 
                    value={editReportsTo}
                    onChange={(e) => setEditReportsTo(e.target.value)}
                  >
                    <option value="">No Supervisor (Top Level)</option>
                    {users
                      .filter(u => u.id !== selectedUser.id)
                      .map(u => (
                        <option key={u.id} value={u.name || u.fullName}>{u.name || u.fullName} ({u.role})</option>
                      ))
                    }
                  </select>
                </div>
                <div className="form-group-v3 mt-24">
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 12 }}>Custom Permissions Overrides</label>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--input-bg)' }}>
                    {modules.map(module => (
                      <div key={module.name} style={{ marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <module.icon size={14} />
                            {module.name}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer' }} onClick={() => handleSelectAllModule(module.name, true)}>All</button>
                            <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>|</span>
                            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }} onClick={() => handleSelectAllModule(module.name, false)}>None</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12 }}>
                          {module.subModules.map(sub => (
                            <div key={sub} style={{ fontSize: '0.8rem' }}>
                              <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{sub}</div>
                              <div style={{ display: 'flex', gap: 14 }}>
                                {['create', 'read', 'update', 'delete'].map(action => (
                                  <label key={action} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.75rem', textTransform: 'capitalize' }}>
                                    <input
                                      type="checkbox"
                                      checked={editPermissions?.[module.name]?.[sub]?.[action] || false}
                                      onChange={(e) => handlePermissionChange(module.name, sub, action, e.target.checked)}
                                    />
                                    {action === 'create' ? 'Create' : action === 'read' ? 'Read' : action === 'update' ? 'Update' : 'Delete'}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="drawer-danger-zone mt-24">
                  <h4 className="danger-zone-title">Security Actions</h4>
                  <button className="danger-btn-outline"><Key size={16} /> Reset Password</button>
                </div>
              </div>
              <div className="drawer-footer">
                <Button variant="primary" fullWidth onClick={handleSaveUser}>Save Changes</Button>
              </div>
            </div>
          )}
        </div>
        {showEditDrawer && <div className="drawer-overlay" onClick={() => setShowEditDrawer(false)}></div>}
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;
