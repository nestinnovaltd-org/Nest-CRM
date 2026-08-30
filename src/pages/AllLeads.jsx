import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'MD' || 
                    currentUser.role === 'System Admin' || currentUser.account_type === 'org_admin';

    // Fetch users — scope to current user's org, exclude super admins
    const fetchUsers = async () => {
      let query = supabase.from('users').select('*')
        .neq('account_type', 'super_admin')
        .neq('role', 'Super Admin');

      // Scope by org
      if (currentUser.org_id) {
        query = query.eq('org_id', currentUser.org_id);
      } else if (currentUser.account_type === 'super_admin' && currentUser.org_id) {
        query = query.eq('org_id', currentUser.org_id);
      }

      const { data: allUsers, error } = await query;
      if (!allUsers || error) return;
      if (isAdmin) {
        setUsers(allUsers);
      } else {
        const allowedUids = getSubordinateUids(allUsers, currentUser.uid || currentUser.id);
        setUsers(allUsers.filter(u => allowedUids.includes(u.id)));
      }
    };

    // Fetch leads
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*');
      const mappedLeads = (data || []).map(row => ({
        ...row,
        ownerId: row.owner_id,
        assignedTo: row.assigned_to,
        assignedToName: row.assigned_to_name,
        phoneWhatsapp: row.phone_whatsapp,
        secondPhoneWhatsapp: row.second_phone_whatsapp,
        nextFollowUp: row.next_follow_up,
        nextFollowUpDate: row.next_follow_up_date
      }));
      setLeads(mappedLeads);
      setIsLoading(false);
    };

    fetchUsers();
    fetchLeads();

    // Real-time subscriptions
    const usersChannel = supabase.channel('all-leads-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();
    const leadsChannel = supabase.channel('all-leads-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [currentUser]);

  // Build hierarchy and calculate stats
  const buildHierarchy = (parentId = null) => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'MD' || 
                    currentUser?.role === 'System Admin' || currentUser?.account_type === 'org_admin';

    
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
