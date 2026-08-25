import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { 
  Users, 
  Target, 
  TrendingUp, 
  Briefcase, 
  ChevronRight,
  ArrowLeft,
  Mail,
  Phone,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';
import './TeamDetails.css';

const TeamDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [team, setTeam] = useState(null);
  const [leadDetails, setLeadDetails] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const unsubscribeTeam = onSnapshot(doc(db, 'teams', id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const teamData = { id: docSnapshot.id, ...docSnapshot.data() };
        setTeam(teamData);

        // Fetch lead details
        const primaryLeadName = (teamData.teamLeads && teamData.teamLeads.length > 0)
          ? teamData.teamLeads[0]
          : teamData.teamLead;

        if (primaryLeadName) {
          const qLead = query(collection(db, 'users'), where('fullName', '==', primaryLeadName));
          onSnapshot(qLead, (snap) => {
            if (!snap.empty) {
              setLeadDetails(snap.docs[0].data());
            }
          });
        }

        // Fetch members details
        if (teamData.members && teamData.members.length > 0) {
          const qMembers = query(collection(db, 'users'), where('fullName', 'in', teamData.members));
          onSnapshot(qMembers, (snap) => {
            setMembersData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });
        }
        
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribeTeam();
  }, [id]);

  const canEditTeam = hasPermission('Team Management', 'edit');
  const canDeleteTeam = hasPermission('Team Management', 'delete');
  const canAddMember = hasPermission('Team Management', 'edit'); // Assuming edit permission allows adding members

  if (isLoading) return <div>Loading...</div>;
  if (!team) return <div>Team not found.</div>;

  return (
    <DashboardLayout>
      <div className="team-details-container">
        {/* Header */}
        <div className="team-details-header">
          <div className="breadcrumb">
            <Link to="/users/teams">Team Management</Link>
            <ChevronRight size={14} />
            <span>{team.teamName || team.name}</span>
          </div>
          <div className="header-main">
            <div className="header-left">
              <button className="back-btn-v2" onClick={() => navigate('/users/teams')}>
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1>{team.teamName || team.name}</h1>
                <p>{team.description}</p>
              </div>
            </div>
            <div className="header-actions">
              {canEditTeam && <Button variant="outline" icon={Edit} onClick={() => navigate(`/users/teams/edit/${team.id}`)}>Edit Team</Button>}
              {canDeleteTeam && <Button variant="outline" icon={Trash2} className="delete-btn">Delete</Button>}
            </div>
          </div>
        </div>

        <div className="details-grid">
          {/* Left Column: Stats & Lead */}
          <div className="details-left">
            
            {/* Team Lead Card */}
            <div className="detail-card team-lead-card">
              <h3>Team Lead</h3>
              <div className="lead-info">
                <div className="lead-avatar">{(team.teamLead || 'L')[0]}</div>
                <div className="lead-meta">
                  <h4>{team.teamLead || team.lead}</h4>
                  <span>{leadDetails?.role || 'Team Manager'}</span>
                </div>
              </div>
              <div className="lead-contact">
                <div className="contact-item">
                  <Mail size={16} />
                  <span>{leadDetails?.email || 'N/A'}</span>
                </div>
                <div className="contact-item">
                  <Phone size={16} />
                  <span>{leadDetails?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="detail-card stats-card">
              <h3>Performance Summary</h3>
              <div className="stats-list">
                <div className="stat-item">
                  <div className="stat-icon-sm blue"><TrendingUp size={18} /></div>
                  <div className="stat-info">
                    <span className="label">Total Leads</span>
                    <span className="value">{team.performance?.leads || 0}</span>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon-sm green"><CheckCircle2 size={18} /></div>
                  <div className="stat-info">
                    <span className="label">Conversions</span>
                    <span className="value">{team.performance?.conversions || 0}</span>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon-sm orange"><Clock size={18} /></div>
                  <div className="stat-info">
                    <span className="label">Avg. Response</span>
                    <span className="value">{team.performance?.avgResponseTime || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Progress */}
            <div className="detail-card target-card">
              <div className="card-header-flex">
                <h3>Target Progress</h3>
                <span className="target-label">Monthly</span>
              </div>
              <div className="progress-section">
                <div className="progress-info">
                  <span>Leads Generated</span>
                  <span>{team.performance?.leads || 0} / {team.targets?.leads || 0}</span>
                </div>
                <div className="progress-bar-large">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min(((team.performance?.leads || 0) / (team.targets?.leads || 1)) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="progress-hint">
                  {Math.round(((team.performance?.leads || 0) / (team.targets?.leads || 1)) * 100)}% of monthly target achieved.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Members & Projects */}
          <div className="details-right">
            
            {/* Members Table */}
            <div className="detail-card table-card">
              <div className="card-header-flex">
                <h3>Team Members ({membersData.length})</h3>
                {canAddMember && <Button variant="ghost" size="sm" icon={UserPlus}>Add Member</Button>}
              </div>
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {membersData.map(member => (
                    <tr key={member.id}>
                      <td data-label="Name">
                        <div className="member-cell">
                          <div className="avatar-xs">{(member.fullName || member.name || 'M')[0]}</div>
                          <span>{member.fullName || member.name}</span>
                        </div>
                      </td>
                      <td data-label="Role">{member.role}</td>
                      <td data-label="Status">
                        <span className={`status-dot ${member.status?.toLowerCase().replace(' ', '-') || 'offline'}`}>
                          {member.status || 'Offline'}
                        </span>
                      </td>
                      <td data-label="Success Rate">
                        <div className="rate-cell">
                          <span className="rate-value">{member.successRate || 0}%</span>
                          <div className="mini-bar">
                            <div className="mini-fill" style={{ width: `${member.successRate || 0}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Assigned Projects */}
            <div className="detail-card table-card mt-24">
              <div className="card-header-flex">
                <h3>Assigned Projects ({team.assignedProjects?.length || 0})</h3>
                {canEditTeam && <Button variant="ghost" size="sm" icon={Plus}>Assign New</Button>}
              </div>
              <div className="projects-list-v2">
                {team.assignedProjects?.map(projectName => (
                  <div key={projectName} className="project-item-v2">
                    <div className="project-icon-v2"><Briefcase size={20} /></div>
                    <div className="project-meta">
                      <h4>{projectName}</h4>
                      <div className="meta-row">
                        <span><MapPin size={12} /> Dhaka</span>
                        <span className="dot"></span>
                        <span>Ongoing</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="arrow" />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeamDetailsPage;
