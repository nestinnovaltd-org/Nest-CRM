import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { 
  Users, 
  UserPlus, 
  Target, 
  TrendingUp, 
  Briefcase, 
  ChevronRight,
  MoreVertical,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  BarChart3,
  Mail,
  Phone
} from 'lucide-react';
import './TeamManagement.css';

const TeamManagement = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const itemsPerPage = 6; // Teams card are large, so 6 is a good number (2 rows of 3)

  const canCreateTeam = hasPermission('Team Management', 'add');
  const canEditTargets = hasPermission('Team Management', 'edit');

  useEffect(() => {
    const fetchData = async () => {
      const { data: teamsData, error } = await supabase.from('teams').select('*');
      if (error) {
        console.error('Error fetching teams:', error);
      } else {
        setTeams(teamsData || []);
      }
      setIsLoading(false);

      const { data: projectsData } = await supabase.from('projects').select('*');
      setProjects(projectsData || []);
    };

    fetchData();

    const teamsChannel = supabase.channel('team-mgmt-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchData)
      .subscribe();
    const projectsChannel = supabase.channel('team-mgmt-projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(projectsChannel);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const totalMembers = teams.reduce((acc, team) => acc + (team.members?.length || 0), 0);

  const stats = [
    { label: 'Total Teams', value: teams.length, icon: Users, color: 'blue' },
    { label: 'Total Members', value: totalMembers, icon: UserPlus, color: 'purple' },
    { label: 'Avg. Success Rate', value: '76%', icon: TrendingUp, color: 'green' },
    { label: 'Active Targets', value: teams.length, icon: Target, color: 'orange' },
  ];

  const filteredTeams = teams.filter(t => 
    (t.teamName || t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.teamLead || t.lead || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedTeams = filteredTeams.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="team-mgmt-container">
        {/* Header */}
        <div className="team-mgmt-header">
          <div className="header-info">
            <h1>Team Management</h1>
            <p>Organize users into teams, assign projects, and set performance targets.</p>
          </div>
          {canCreateTeam && (
            <Button variant="primary" icon={Plus} onClick={() => navigate('/users/teams/add')}>
              Create New Team
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="team-stats-grid">
          {stats.map((stat, i) => (
            <div key={i} className="team-stat-card">
              <div className={`stat-icon-box ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters & Actions */}
        <div className="team-actions-bar">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by team name or lead..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Filter}>Filters</Button>
        </div>

        {/* Teams Grid */}
        <div className="teams-grid">
          {paginatedTeams.map(team => (
            <div key={team.id} className="team-card">
              <div className="team-card-header">
                <div className="team-info">
                  <h3>{team.teamName || team.name}</h3>
                  <span className="team-lead-tag">Lead: {team.teamLead || team.lead}</span>
                </div>
                <div className="card-dropdown-container">
                  <button 
                    className="more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(activeDropdown === team.id ? null : team.id);
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {activeDropdown === team.id && (
                    <div className="card-dropdown-menu">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/users/teams/edit/${team.id}`); setActiveDropdown(null); }}>Edit Team</button>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/users/teams/${team.id}`); setActiveDropdown(null); }}>View Details</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="team-card-body">
                <div className="body-row">
                  <div className="item">
                    <span className="label">Members</span>
                    <span className="value">{(team.membersCount || team.members?.length || 0)} Users</span>
                  </div>
                  <div className="item">
                    <span className="label">Projects</span>
                    <span className="value">{(team.assignedProjects?.length || 0)} Assigned</span>
                  </div>
                </div>

                <div className="projects-tags">
                  {team.assignedProjects.map(p => (
                    <span key={p} className="project-tag">{p}</span>
                  ))}
                </div>

                <div className="target-section">
                  <div className="target-header">
                    <span className="label">Monthly Targets</span>
                    {canEditTargets && (
                      <button className="edit-target-btn" onClick={() => { setSelectedTeam(team); setShowTargetModal(true); }}>
                        Set Targets
                      </button>
                    )}
                  </div>
                  <div className="target-bars">
                    <div className="target-bar-item">
                      <div className="bar-info">
                        <span>Leads</span>
                        <span>{(team.performance?.leads || 0)}/{(team.targets?.leads || 0)}</span>
                      </div>
                      <div className="progress-container">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${Math.min(((team.performance?.leads || 0) / (team.targets?.leads || 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="performance-overview">
                  <div className="perf-item">
                    <TrendingUp size={16} className="icon-trend" />
                    <span>{(team.performance?.successRate || 0)}% Success Rate</span>
                  </div>
                </div>
              </div>

              <div className="team-card-footer">
                <Button variant="ghost" size="sm" fullWidth onClick={() => navigate(`/users/teams/${team.id}`)}>
                  View Team Details
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(filteredTeams.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          totalItems={filteredTeams.length}
          itemsPerPage={itemsPerPage}
        />

        {/* Target Setting Modal */}
        <Modal
          isOpen={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          title={`Set Targets for ${selectedTeam?.name}`}
          size="md"
        >
          <div className="target-modal-content">
            <div className="form-group-v3">
              <label>Monthly Lead Target</label>
              <input type="number" defaultValue={selectedTeam?.targets.leads} placeholder="e.g. 50" />
            </div>
            <div className="form-group-v3" style={{ marginTop: '1.5rem' }}>
              <label>Monthly Follow-up Target</label>
              <input type="number" defaultValue={selectedTeam?.targets.followups} placeholder="e.g. 200" />
            </div>
            <div className="form-group-v3" style={{ marginTop: '1.5rem' }}>
              <label>Assigned Projects</label>
              <div className="multi-select-preview">
                {projects.map(p => (
                  <label key={p.id} className="checkbox-v3">
                    <input type="checkbox" defaultChecked={selectedTeam?.assignedProjects?.includes(p.projectName)} />
                    <span>{p.projectName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer-btns" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setShowTargetModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setShowTargetModal(false)}>Save Targets</Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default TeamManagement;
