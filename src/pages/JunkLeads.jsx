import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Pagination from '../components/ui/Pagination';
import { 
  Search, 
  RotateCcw, 
  UserX, 
  Calendar, 
  AlertCircle,
  MessageSquare,
  Filter
} from 'lucide-react';
import './Leads.css';

const JunkLeads = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [droppedLeads, setDroppedLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [rawProjects, setRawProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'Admin' || user.role === 'MD' || user.role === 'System Admin';

    const fetchLeads = async () => {
      let query = supabase.from('leads').select('*').eq('status', 'Released');
      if (!isAdmin) query = query.eq('assigned_to', user.uid);
      const { data, error } = await query;
      if (error) { console.error('Error fetching junk leads:', error); }
      else { setDroppedLeads(data || []); }
      setIsLoading(false);
    };

    fetchLeads();
    const ch = supabase.channel('junk-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [user]);

  // Fetch projects for filtering
  useEffect(() => {
    const fetchFilters = async () => {
      const { data: teamsData } = await supabase.from('teams').select('*');
      setTeams(teamsData || []);
      const { data: projectsData } = await supabase.from('projects').select('*');
      setRawProjects(projectsData || []);
    };
    fetchFilters();
  }, []);

  const projects = React.useMemo(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
    if (isAdmin) return rawProjects;

    const userName = user?.fullName || user?.name || '';
    const userTeams = teams.filter(team => 
      (team.members && team.members.includes(userName)) || 
      (team.teamLeads && team.teamLeads.includes(userName)) || 
      team.teamLead === userName
    );

    if (userTeams.length > 0) {
      const assignedProjects = [];
      userTeams.forEach(t => {
        if (t.assignedProjects) {
          assignedProjects.push(...t.assignedProjects);
        }
      });
      return rawProjects.filter(p => assignedProjects.includes(p.projectName));
    }

    return rawProjects;
  }, [rawProjects, user, teams]);

  // Close filter menu when clicking outside
  useEffect(() => {
    if (!isFilterOpen) return;
    const closeFilter = () => setIsFilterOpen(false);
    document.addEventListener('click', closeFilter);
    return () => document.removeEventListener('click', closeFilter);
  }, [isFilterOpen]);

  const handleRestore = async (id) => {
    try {
      const leadRef = doc(db, 'leads', id);
      await updateDoc(leadRef, {
        status: 'Fresh Lead', // Restore to initial status
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error restoring lead:", error);
    }
  };

  const filteredLeads = droppedLeads.filter(lead => {
    // Search filter
    const matchesSearch = (lead.fullName || lead.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (lead.phone || '').includes(searchTerm);
    
    // Project filter
    const matchesProject = projectFilter === 'all' || 
                           (lead.interests && lead.interests.includes(projectFilter)) ||
                           (lead.project === projectFilter);
    
    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'all' && lead.updatedAt) {
      const dropDate = lead.updatedAt.toDate?.() || new Date(lead.updatedAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (dateFilter === 'today') {
        matchesDate = dropDate >= today;
      } else if (dateFilter === 'yesterday') {
        matchesDate = dropDate >= yesterday && dropDate < today;
      } else if (dateFilter === 'sevenDays') {
        matchesDate = dropDate >= sevenDaysAgo;
      } else if (dateFilter === 'thirtyDays') {
        matchesDate = dropDate >= thirtyDaysAgo;
      }
    }
    
    return matchesSearch && matchesProject && matchesDate;
  });

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="leads-page-container">
        <LeadTabs />
        <div className="leads-header">
          <div className="header-info">
            <h1>Junk Leads</h1>
            <p>Leads that have been marked as junk. You can restore them if needed.</p>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search junk leads..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="filter-wrapper" style={{ position: 'relative' }}>
              <button 
                className="btn-filter"
                onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
              >
                <Filter size={18} />
                <span>Filter</span>
                {(dateFilter !== 'all' || projectFilter !== 'all') && (
                  <span className="filter-active-dot" style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'inline-block',
                    marginLeft: '4px'
                  }} />
                )}
              </button>
              
              {isFilterOpen && (
                <div 
                  className="filter-dropdown-menu" 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 100,
                    width: '280px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>Date Dropped</label>
                    <select 
                      value={dateFilter} 
                      onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--background-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="sevenDays">Last 7 Days</option>
                      <option value="thirtyDays">Last 30 Days</option>
                    </select>
                  </div>

                  <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>Project Interest</label>
                    <select 
                      value={projectFilter} 
                      onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--background-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="all">All Projects</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.projectName}>{p.projectName}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={() => {
                      setDateFilter('all');
                      setProjectFilter('all');
                      setCurrentPage(1);
                      setIsFilterOpen(false);
                    }}
                    style={{
                      marginTop: '4px',
                      padding: '8px',
                      background: 'transparent',
                      border: '1px dashed var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="list-view-container">
          <div className="table-container">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Reason</th>
                  <th>Last Activity</th>
                  <th>Date Dropped</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.length > 0 ? (
                  paginatedLeads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div className="table-name-cell">
                          <div className="table-avatar">{lead.fullName ? lead.fullName[0] : (lead.name ? lead.name[0] : 'U')}</div>
                          <div className="name-details">
                            <span className="name-text">{lead.fullName || lead.name}</span>
                            <span className="email-subtext">{lead.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <AlertCircle size={14} className="icon-alert" />
                          <span className="drop-reason-text">{lead.releaseReason || lead.dropReason || 'Moved to Junk'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <MessageSquare size={14} className="icon-email" />
                          <span style={{ fontSize: '0.8125rem' }}>{lead.history?.[lead.history?.length - 1]?.note || 'No activity recorded'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          <Calendar size={14} className="icon-calendar" />
                          <span>{lead.updatedAt?.toDate?.() ? lead.updatedAt.toDate().toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={RotateCcw}
                            onClick={() => handleRestore(lead.id)}
                          >
                            Restore Lead
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state-table">
                        <UserX size={48} />
                        <h3>No junk leads found</h3>
                        <p>Your archive is currently empty.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={Math.ceil(filteredLeads.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={filteredLeads.length}
            itemsPerPage={itemsPerPage}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default JunkLeads;
