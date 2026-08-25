import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import { 
  ChevronRight, 
  Users, 
  Target, 
  Briefcase, 
  Check, 
  ArrowLeft, 
  ArrowRight,
  Save,
  UserPlus,
  Shield
} from 'lucide-react';
import './AddTeam.css';

const AddTeamPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    teamName: '',
    teamLead: '',
    teamLeads: [],
    members: [],
    assignedProjects: [],
    targets: {
      leads: '',
      followups: '',
      meetings: ''
    },
    description: ''
  });

  useEffect(() => {
    // Fetch users and projects in parallel
    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeProjects = onSnapshot(query(collection(db, 'projects')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeProjects();
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchTeam = async () => {
      try {
        const docRef = doc(db, 'teams', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            teamName: data.teamName || data.name || '',
            teamLead: data.teamLead || '',
            teamLeads: data.teamLeads || (data.teamLead ? [data.teamLead] : []),
            members: data.members || [],
            assignedProjects: data.assignedProjects || [],
            targets: {
              leads: data.targets?.leads || '',
              followups: data.targets?.followups || '',
              meetings: data.targets?.meetings || ''
            },
            description: data.description || ''
          });
        }
      } catch (err) {
        console.error("Error fetching team details:", err);
      }
    };
    fetchTeam();
  }, [id]);

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.teamName || !formData.teamName.trim()) {
        alert("Please enter a team name.");
        return;
      }
      if (!formData.teamLeads || formData.teamLeads.length === 0) {
        alert("Please select at least one Team Lead / Manager.");
        return;
      }
    }
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (id) {
        await updateDoc(doc(db, 'teams', id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'teams'), {
          ...formData,
          status: 'Active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      navigate('/users/teams');
    } catch (error) {
      console.error("Error saving team:", error);
    }
  };

  const steps = [
    { id: 1, label: 'Basic Info', icon: Users },
    { id: 2, label: 'Members', icon: UserPlus },
    { id: 3, label: 'Projects', icon: Briefcase },
    { id: 4, label: 'Targets', icon: Target },
    { id: 5, label: 'Review', icon: Check },
  ];

  return (
    <DashboardLayout>
      <div className="add-team-page">
        <div className="add-team-header">
          <div className="breadcrumb">
            <Link to="/users/teams">Team Management</Link>
            <ChevronRight size={14} />
            <span>{id ? 'Edit Team' : 'Create New Team'}</span>
          </div>
          <div className="header-with-back">
            <button className="back-btn-v2" onClick={() => navigate('/users/teams')}>
              <ArrowLeft size={20} />
            </button>
            <h1>{id ? 'Edit Team' : 'Create New Team'}</h1>
          </div>
        </div>

        {/* Stepper */}
        <div className="form-stepper">
          {steps.map((step) => (
            <div 
              key={step.id} 
              className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              onClick={() => setCurrentStep(step.id)}
            >
              <div className="step-number">
                {currentStep > step.id ? <Check size={18} /> : step.id}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="add-team-container">
          
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3 full-width">
                    <label>Team Name <span>*</span></label>
                    <input 
                      type="text" 
                      placeholder="e.g. Dhaka North Sales Unit" 
                      required 
                      value={formData.teamName}
                      onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                    />
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Team Leads / Managers (Select all that apply) <span>*</span></label>
                    <div className="members-selection-grid mt-12">
                      {users.filter(u => u.role !== 'Team Member').map(u => {
                        const userName = u.fullName || u.name;
                        const isSelected = formData.teamLeads.includes(userName);
                        return (
                          <label key={u.id} className="user-select-card">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                const newLeads = e.target.checked
                                  ? [...formData.teamLeads, userName]
                                  : formData.teamLeads.filter(m => m !== userName);
                                setFormData({
                                  ...formData,
                                  teamLeads: newLeads,
                                  teamLead: newLeads.join(', ')
                                });
                              }}
                            />
                            <div className="card-content">
                              <div className="user-avatar-sm">{(u.fullName || u.name || 'U')[0]}</div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '600' }}>{userName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.role}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Team Description</label>
                    <textarea 
                      className="textarea-v3"
                      placeholder="Briefly describe the team's purpose..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team Members */}
          {currentStep === 2 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="section-header-v3">
                  <h3>Select Team Members</h3>
                  <p>Choose users who will be part of this team.</p>
                </div>
                <div className="members-selection-grid mt-24">
                  {users.map(u => (
                    <label key={u.id} className="user-select-card">
                      <input 
                        type="checkbox" 
                        checked={formData.members.includes(u.fullName || u.name)}
                        onChange={(e) => {
                          const userName = u.fullName || u.name;
                          const newMembers = e.target.checked 
                            ? [...formData.members, userName]
                            : formData.members.filter(m => m !== userName);
                          setFormData({...formData, members: newMembers});
                        }}
                      />
                      <div className="card-content">
                        <div className="user-avatar-sm">{(u.fullName || u.name || 'U')[0]}</div>
                        <span>{u.fullName || u.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Project Assignment */}
          {currentStep === 3 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="section-header-v3">
                  <h3>Assign Projects</h3>
                  <p>Which real estate projects will this team handle?</p>
                </div>
                <div className="projects-selection-grid mt-24">
                  {projects.map(project => (
                    <label key={project.id} className="project-select-card">
                      <input 
                        type="checkbox" 
                        checked={formData.assignedProjects.includes(project.projectName)}
                        onChange={(e) => {
                          const newProjects = e.target.checked 
                            ? [...formData.assignedProjects, project.projectName]
                            : formData.assignedProjects.filter(p => p !== project.projectName);
                          setFormData({...formData, assignedProjects: newProjects});
                        }}
                      />
                      <div className="card-content">
                        <div className="project-icon-box"><Briefcase size={20} /></div>
                        <span>{project.projectName}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Targets */}
          {currentStep === 4 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Monthly Lead Target</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 50"
                      value={formData.targets.leads}
                      onChange={(e) => setFormData({...formData, targets: {...formData.targets, leads: e.target.value}})}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Monthly Follow-up Target</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 200"
                      value={formData.targets.followups}
                      onChange={(e) => setFormData({...formData, targets: {...formData.targets, followups: e.target.value}})}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Monthly Meeting Target</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 20"
                      value={formData.targets.meetings}
                      onChange={(e) => setFormData({...formData, targets: {...formData.targets, meetings: e.target.value}})}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="review-grid">
                  <div className="review-section">
                    <h4>Basic Information</h4>
                    <p><strong>Team Name:</strong> {formData.teamName}</p>
                    <p><strong>Team Lead / Manager(s):</strong> {formData.teamLeads && formData.teamLeads.length > 0 ? formData.teamLeads.join(', ') : (formData.teamLead || 'None')}</p>
                  </div>
                  <div className="review-section">
                    <h4>Members ({formData.members.length})</h4>
                    <div className="review-tags">
                      {formData.members.map(m => <span key={m} className="tag">{m}</span>)}
                    </div>
                  </div>
                  <div className="review-section">
                    <h4>Projects ({formData.assignedProjects.length})</h4>
                    <div className="review-tags">
                      {formData.assignedProjects.map(p => <span key={p} className="tag project">{p}</span>)}
                    </div>
                  </div>
                  <div className="review-section">
                    <h4>Targets</h4>
                    <p>Leads: {formData.targets.leads || 0} / month</p>
                    <p>Follow-ups: {formData.targets.followups || 0} / month</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sticky Footer */}
          <div className="form-sticky-footer">
            <div className="footer-content">
              <div className="footer-left">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" icon={ArrowLeft} onClick={prevStep}>Previous Step</Button>
                )}
              </div>
              <div className="footer-btns">
                <button type="button" className="btn-secondary-v3" onClick={() => navigate('/users/teams')}>Cancel</button>
                {currentStep < 5 ? (
                  <Button type="button" variant="primary" icon={ArrowRight} onClick={nextStep}>Next Step</Button>
                ) : (
                  <Button variant="primary" type="submit" icon={Save}>{id ? 'Save Changes' : 'Create Team'}</Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddTeamPage;
