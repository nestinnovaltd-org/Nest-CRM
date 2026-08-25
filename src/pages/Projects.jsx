import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  MapPin, 
  Building2, 
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  Hammer,
  ClipboardCheck,
  X,
  RotateCcw,
  Maximize2,
  RefreshCcw,
  Globe,
  User,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import './Projects.css';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [rawProjects, setRawProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Grid view looks better with 8 (2 rows of 4)
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'All',
    location: 'All'
  });
  const filterRef = useRef(null);

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const q = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRawProjects(projectsList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching projects:", error);
      setIsLoading(false);
    });

    return () => {
      unsubTeams();
      unsubscribe();
    };
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

  // Close filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      const projectRef = doc(db, 'projects', id);
      await updateDoc(projectRef, { projectStatus: newStatus });
    } catch (error) {
      console.error("Error updating project status:", error);
    }
  };

  const handleEditClick = (e, id) => {
    e.stopPropagation();
    navigate(`/projects/edit/${id}`);
  };

  const handleDeleteProject = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        const projectRef = doc(db, 'projects', id);
        await deleteDoc(projectRef);
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  };

  const resetFilters = () => {
    setFilters({ status: 'All', location: 'All' });
    setSearchTerm('');
  };

  const locations = ['All', ...new Set(projects.map(p => p.location))];

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status === 'All' || p.projectStatus === filters.status;
    const matchesLocation = filters.location === 'All' || p.location === filters.location;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = [
    { label: 'Total Projects', value: projects.length, icon: Building2, color: 'total' },
    { label: 'Upcoming Projects', value: projects.filter(p => p.projectStatus === 'Upcoming').length, icon: Clock, color: 'upcoming' },
    { label: 'Design Approval', value: projects.filter(p => p.projectStatus === 'Design Approval').length, icon: ClipboardCheck, color: 'approval' },
    { label: 'Pilling', value: projects.filter(p => p.projectStatus === 'Pilling').length, icon: Hammer, color: 'pilling' },
  ];

  return (
    <DashboardLayout>
      <div className="projects-container">
        {/* Header */}
        <div className="projects-header">
          <div className="header-info">
            <h1>Project Management</h1>
            <p>Manage and track all real estate development projects.</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/projects/add')} className="add-project-btn-fab">Add New Project</Button>
        </div>

        {/* Stats */}
        <div className="projects-stats">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card-v2">
              <div className={`stat-icon-wrapper ${stat.color}`}>
                <stat.icon size={24} className={
                  stat.color === 'total' ? 'icon-building' : 
                  stat.color === 'upcoming' ? 'icon-clock' : 
                  stat.color === 'approval' ? 'icon-check' : 
                  stat.color === 'pilling' ? 'icon-project' : ''
                } />
              </div>
              <div className="stat-info">
                <h3>{stat.label}</h3>
                <div className="stat-value">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="projects-actions">
          <div className="actions-left">
            <div className="search-wrapper">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="filter-dropdown-wrapper" ref={filterRef}>
              <Button 
                variant={showFilters || filters.status !== 'All' || filters.location !== 'All' ? 'primary' : 'outline'} 
                icon={Filter}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters {(filters.status !== 'All' || filters.location !== 'All') && '(Active)'}
              </Button>

              {showFilters && (
                <div className="filter-popover">
                  <div className="filter-popover-header">
                    <h4>Filter Projects</h4>
                    <button onClick={resetFilters} className="reset-btn">
                      <RotateCcw size={14} />
                      Reset
                    </button>
                  </div>
                  <div className="filter-popover-body">
                    <div className="filter-group">
                      <label>Status</label>
                      <select 
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                      >
                        <option value="All">All Status</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Design Approval">Design Approval</option>
                        <option value="Pilling">Pilling</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Location</label>
                      <select 
                        value={filters.location}
                        onChange={(e) => setFilters({...filters, location: e.target.value})}
                      >
                        {locations.map(loc => (
                          <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="actions-right">
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={20} />
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Projects List/Table */}
        {filteredProjects.length === 0 ? (
          <div className="no-results">
            <Search size={48} />
            <p>No projects found matching your criteria.</p>
            <Button variant="outline" onClick={resetFilters}>Clear All Filters</Button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="projects-table-wrapper">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Location</th>
                  <th>Plot Size</th>
                  <th>Floors</th>
                  <th>Starting</th>
                  <th>Handover</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map(project => (
                  <tr key={project.id} onClick={() => { setSelectedProject(project); setShowDetailsModal(true); }}>
                    <td>
                      <div className="project-cell">
                        <img src={project.image || 'https://via.placeholder.com/40'} alt="" className="project-img-sm" />
                        <div className="project-name-cell">
                          <span className="project-name-bold">{project.projectName}</span>
                          <span className="project-location-sm">{project.sector}</span>
                        </div>
                      </div>
                    </td>
                    <td>{project.location}</td>
                    <td>{project.plotSize}</td>
                    <td>{project.numberOfFloors}</td>
                    <td>{project.startingDate}</td>
                    <td>{project.handoverDate}</td>
                    <td>
                      <select 
                        className="status-select-sm" 
                        value={project.projectStatus}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateStatus(project.id, e.target.value);
                        }}
                        style={{ border: 'none', background: 'transparent', padding: '0', fontWeight: 'inherit', color: 'inherit' }}
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Design Approval">Design Approval</option>
                        <option value="Pilling">Pilling</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="project-actions">
                        <button className="action-circle-btn" onClick={(e) => handleEditClick(e, project.id)}><Edit size={16} /></button>
                        <button className="action-circle-btn delete" onClick={(e) => handleDeleteProject(e, project.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="projects-grid">
            {paginatedProjects.map(project => (
              <div key={project.id} className="project-card" onClick={() => { setSelectedProject(project); setShowDetailsModal(true); }}>
                <div className="card-image-wrapper">
                  <img src={project.image || 'https://via.placeholder.com/400x200'} alt={project.projectName} />
                  <div className="card-status-tag">
                    <span className={`status-badge ${project.projectStatus.toLowerCase().replace(' ', '-')}`}>
                      {project.projectStatus}
                    </span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="card-header">
                    <h3>{project.projectName}</h3>
                    <div className="card-location">
                      <MapPin size={14} />
                      <span>{project.location}, {project.sector}</span>
                    </div>
                  </div>
                  <div className="card-details-grid">
                    <div className="detail-item" title="Plot Size">
                      <Maximize2 size={12} className="icon-project" />
                      <span className="detail-value">{project.plotSize}</span>
                    </div>
                    <div className="detail-item" title="Floors">
                      <Building2 size={12} className="icon-building" />
                      <span className="detail-value">{project.numberOfFloors} Floors</span>
                    </div>
                    <div className="detail-item" title="Starting Date">
                      <Calendar size={12} className="icon-calendar" />
                      <span className="detail-value">{project.startingDate}</span>
                    </div>
                    <div className="detail-item" title="Handover Date">
                      <ClipboardCheck size={12} className="icon-check" />
                      <span className="detail-value">{project.handoverDate}</span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="ghost" size="sm" icon={ExternalLink}>Details</Button>
                      <button className="action-circle-btn" onClick={(e) => handleEditClick(e, project.id)}><Edit size={16} /></button>
                    </div>
                    <select 
                      className="status-select-sm" 
                      value={project.projectStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateStatus(project.id, e.target.value);
                      }}
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Design Approval">Design Approval</option>
                      <option value="Pilling">Pilling</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination 
          currentPage={currentPage}
          totalPages={Math.ceil(filteredProjects.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          totalItems={filteredProjects.length}
          itemsPerPage={itemsPerPage}
        />

        {/* Project Details Modal */}
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={selectedProject?.projectName}
          size="lg"
        >
          {selectedProject && (
            <div className="project-details-view">
              <div className="details-header-section">
                <img 
                  src={selectedProject.image || 'https://via.placeholder.com/800x400'} 
                  alt="" 
                  className="modal-project-img"
                />
                <div className="modal-title-row">
                  <div className="modal-title-main">
                    <h2>{selectedProject.projectName}</h2>
                    <p className="modal-address-sub"><MapPin size={14} /> {selectedProject.address}</p>
                  </div>
                  <span className={`status-badge ${selectedProject.projectStatus.toLowerCase().replace(' ', '-')}`}>
                    {selectedProject.projectStatus}
                  </span>
                </div>
              </div>

              <div className="details-info-grid">
                <div className="details-section">
                  <h4 className="section-title">
                    <User size={16} className="icon-user" /> Ownership Details
                  </h4>
                  <div className="modal-info-list-v6">
                    <div className="info-item-v6">
                      <span className="info-label-v6">Owner Name</span>
                      <span className="info-value-v6">{selectedProject.plotOwnerName || 'Not Specified'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Contact Number</span>
                      <span className="info-value-v6">{selectedProject.plotOwnerContact || 'Not Specified'}</span>
                    </div>
                    <div className="info-item-v6 span-2">
                      <span className="info-label-v6">Location Map</span>
                      <span className="info-value-v6">
                        {selectedProject.latitude && selectedProject.longitude ? (
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProject.latitude},${selectedProject.longitude}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="modal-map-link-v6"
                          >
                            <Globe size={14} /> Get Directions on Google Maps
                          </a>
                        ) : selectedProject.mapLink ? (
                          <a href={selectedProject.mapLink} target="_blank" rel="noreferrer" className="modal-map-link-v6">
                            <Globe size={14} /> View in Google Maps
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Available</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="details-section">
                  <h4 className="section-title">
                    <Building2 size={16} className="icon-building" /> Plot & Construction
                  </h4>
                  <div className="modal-info-list-v6">
                    <div className="info-item-v6">
                      <span className="info-label-v6">Location</span>
                      <span className="info-value-v6">{selectedProject.location || 'N/A'} {selectedProject.sector ? `(Sector-${selectedProject.sector})` : ''}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Plot Size</span>
                      <span className="info-value-v6">{selectedProject.plotSize || 'N/A'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Orientation</span>
                      <span className="info-value-v6">{selectedProject.plotOrientation || 'N/A'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Floors</span>
                      <span className="info-value-v6">{selectedProject.numberOfFloors ? `${selectedProject.numberOfFloors} Stories` : 'N/A'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Total Units</span>
                      <span className="info-value-v6">{selectedProject.totalApartments ? `${selectedProject.totalApartments} Units` : 'N/A'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Apartment Size</span>
                      <span className="info-value-v6">{selectedProject.apartmentSize ? `${selectedProject.apartmentSize} sqft` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="details-section">
                  <h4 className="section-title">
                    <Clock size={16} className="icon-clock" /> Project Timeline
                  </h4>
                  <div className="modal-info-list-v6">
                    <div className="info-item-v6">
                      <span className="info-label-v6">Start Date</span>
                      <span className="info-value-v6">{selectedProject.startingDate || 'Not Set'}</span>
                    </div>
                    <div className="info-item-v6">
                      <span className="info-label-v6">Handover Date</span>
                      <span className="info-value-v6">{selectedProject.handoverDate || 'Not Set'}</span>
                    </div>
                  </div>
                </div>

                <div className="details-section">
                  <h4 className="section-title">
                    <ShieldCheck size={16} className="icon-check" /> Administrative Info
                  </h4>
                  <div className="modal-info-list-v6">
                    <div className="info-item-v6 span-2">
                      <span className="info-label-v6">Added By</span>
                      <span className="info-value-v6">{selectedProject.addedByEmail || 'System'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default ProjectsPage;
