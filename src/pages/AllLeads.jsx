import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Card from '../components/ui/Card';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck,
  UserCircle,
  BarChart3,
  Search,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './AllLeads.css';

const RoleStats = ({ role, name, uid, total, assigned, unassigned, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`hierarchy-node ${isOpen ? 'open' : ''}`}>
      <div className="node-content" onClick={() => setIsOpen(!isOpen)}>
        <div className="node-info">
          {children ? (
            <div className="toggle-icon">
              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
          ) : (
            <div className="dot-icon" />
          )}
          <div className="role-avatar">
            {role === 'MD' ? <ShieldCheck size={20} className="icon-shield" /> : <UserCircle size={20} className="icon-user" />}
          </div>
          <Link to={`/leads/user/${uid}`} className="user-details clickable-link">
            <span className="role-label">{role}</span>
            <span className="user-name">{name}</span>
            <ExternalLink size={12} className="link-icon" />
          </Link>
        </div>

        <div className="node-stats">
          <Link to={`/leads/user/${uid}`} className="stat-pill total clickable">
            <Users size={14} className="icon-team" />
            <span>{total}</span>
          </Link>
          <Link to={`/leads/user/${uid}`} className="stat-pill assigned clickable">
            <UserCheck size={14} className="icon-check" />
            <span>{assigned}</span>
          </Link>
          <Link to={`/leads/user/${uid}`} className="stat-pill unassigned clickable">
            <UserPlus size={14} className="icon-user" />
            <span>{unassigned}</span>
          </Link>
        </div>
      </div>

      {children && isOpen && (
        <div className="node-children">
          {children}
        </div>
      )}
    </div>
  );
};

const AllLeads = () => {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
    
    return subUids;
  };

  useEffect(() => {
    if (!currentUser) return;

    // Fetch users and leads
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'MD' || currentUser.role === 'System Admin';
      
      if (isAdmin) {
        setUsers(allUsers);
      } else {
        // Filter users to only include those in current user's hierarchy
        const allowedUids = getSubordinateUids(allUsers, currentUser.uid);
        setUsers(allUsers.filter(u => allowedUids.includes(u.id)));
      }
    });

    const unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLeads();
    };
  }, [currentUser]);

  // Build hierarchy and calculate stats
  const buildHierarchy = (parentId = null) => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'MD' || currentUser?.role === 'System Admin';
    
    const relevantUsers = users.filter(u => {
      if (!parentId) {
        if (isAdmin) {
          // Admin starts from top
          return u.role === 'MD' || !u.reportsTo || u.reportsTo === 'None (CEO)';
        } else {
          // Others start from themselves
          return u.id === currentUser.uid;
        }
      }
      // Children report to parent
      const parentUser = users.find(user => user.id === parentId);
      const parentName = parentUser?.fullName || parentUser?.name;
      return u.reportsTo === parentName && u.id !== parentId;
    });

    return relevantUsers.map(user => {
      // Calculate leads for this user AND all their subordinates
      const allSubUids = getSubordinateUids(users, user.id);
      const hierarchyLeads = leads.filter(l => allSubUids.includes(l.assignedTo) || (l.ownerId && allSubUids.includes(l.ownerId)));
      
      const stats = {
        total: hierarchyLeads.length,
        assigned: hierarchyLeads.filter(l => l.status !== 'Fresh Lead').length,
        unassigned: hierarchyLeads.filter(l => l.status === 'Fresh Lead').length
      };

      const children = buildHierarchy(user.id);

      return (
        <RoleStats 
          key={user.id} 
          role={user.role} 
          name={user.fullName || user.name} 
          uid={user.id}
          total={stats.total} 
          assigned={stats.assigned} 
          unassigned={stats.unassigned}
          defaultOpen={!parentId || isAdmin}
        >
          {children.length > 0 ? children : null}
        </RoleStats>
      );
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="all-leads-container">
          <div className="loading-state">Building hierarchy...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="all-leads-container">
        <LeadTabs />
        <div className="all-leads-header">
          <div className="header-info">
            <h1>All Leads Hierarchy</h1>
            <p>Drill down through the organizational structure to manage leads.</p>
          </div>
          <div className="header-search">
            <Search size={18} className="search-icon icon-search" />
            <input 
              type="text" 
              placeholder="Search user or role..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hierarchy-root">
          {buildHierarchy()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AllLeads;
