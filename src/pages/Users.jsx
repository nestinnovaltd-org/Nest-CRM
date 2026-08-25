import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import Pagination from '../components/ui/Pagination';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
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
import './Users.css';

const UsersPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editReportsTo, setEditReportsTo] = useState('');
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
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Map fullName to name for backward compatibility if needed
        name: doc.data().fullName || doc.data().name || 'Unnamed User'
      }));
      setUsers(usersList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsError(true);
      setIsLoading(false);
    });

    // Fetch Roles
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubRoles();
    };
  }, []);

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditName(user.name || user.fullName || '');
    setEditRole(user.role || '');
    setEditReportsTo(user.reportsTo || '');
    setShowEditDrawer(true);
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
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        status: user.status === 'Active' ? 'Inactive' : 'Active'
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const saveTarget = async () => {
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        target: { 
          leads: parseInt(targetData.leads), 
          followups: parseInt(targetData.followups), 
          progress: selectedUser.target?.progress || 0 
        }
      });
      setShowTargetModal(false);
    } catch (error) {
      console.error("Error saving targets:", error);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        fullName: editName,
        name: editName,
        role: editRole,
        reportsTo: editReportsTo
      });
      setShowEditDrawer(false);
    } catch (error) {
      console.error("Error saving user details:", error);
      alert("Failed to save user details.");
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
            <Button variant="primary" icon={UserPlus} onClick={() => navigate('/users/add')}>Add User</Button>
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
                            <button className="action-circle-btn target icon-target" title="Set Target" onClick={(e) => openTargetModal(e, u)}>
                              <Target size={16} />
                            </button>
                            <button className="action-circle-btn icon-edit" title="Edit User" onClick={() => openEdit(u)}><Edit3 size={16} /></button>
                            <button className="action-circle-btn view icon-view" title="View Details" onClick={() => navigate(`/users/${u.id}`)}>
                              <ChevronRight size={16} />
                            </button>
                            <button className="action-circle-btn delete icon-delete" title="Delete User"><Trash2 size={16} /></button>
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
