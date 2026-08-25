import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import { 
  ChevronRight, 
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Calendar,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  Save,
  Check,
  ArrowRight,
  Plus,
  Loader2
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import './AddProject.css';

const EditProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    projectName: '',
    plotOwnerName: '',
    plotOwnerContact: '',
    location: '',
    sector: '',
    address: '',
    mapLink: '',
    latitude: '',
    longitude: '',
    plotSize: '',
    plotOrientation: '',
    numberOfFloors: '',
    startingDate: '',
    handoverDate: '',
    projectStatus: 'Upcoming',
    description: '',
    image: null,
    totalApartments: '',
    apartmentSize: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error || !data) {
          showToast('Project not found', 'error');
          setTimeout(() => navigate('/projects'), 2000);
        } else {
          setFormData({ ...data });
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        showToast('Error loading project data', 'error');
      }
    };

    fetchProject();
  }, [id, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("File is too large. Max 5MB allowed.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, image: compressedBase64 }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('projects').update({
        ...formData,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      showToast('Project updated successfully!', 'success');
      setTimeout(() => navigate('/projects'), 1500);
    } catch (error) {
      console.error('Error updating project:', error);
      showToast('Failed to update project', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, label: 'Basic Info', icon: Building2 },
    { id: 2, label: 'Owner Info', icon: User },
    { id: 3, label: 'Location', icon: MapPin },
    { id: 4, label: 'Technical', icon: Layers },
    { id: 5, label: 'Timeline', icon: Calendar },
  ];

  return (
    <DashboardLayout>
      <div className="add-project-page">
        {/* Header */}
        <div className="add-project-header">
          <div className="breadcrumb">
            <Link to="/projects">Project Management</Link>
            <ChevronRight size={14} />
            <span>Edit Project</span>
          </div>
          <div className="header-with-back">
            <button className="back-btn-v2" onClick={() => navigate('/projects')}>
              <ArrowLeft size={20} />
            </button>
            <h1>Edit Project: {formData.projectName}</h1>
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

        <form onSubmit={handleSubmit} className="add-project-container">
          
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3 full-width">
                    <label>Project Image</label>
                    <div className="image-upload-wrapper">
                      <div className="image-preview-large">
                        {formData.image ? (
                          <img src={formData.image} alt="Preview" />
                        ) : (
                          <ImageIcon size={48} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="upload-controls">
                        <label className="upload-btn-label">
                          <Plus size={18} />
                          <span>Change Image</span>
                          <input type="file" hidden onChange={handleImageChange} accept="image/*" />
                        </label>
                        <span className="upload-hint">Recommended: 1200x800px. Max: 5MB (Auto-compressed).</span>
                        {formData.image && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-group-v3">
                    <label>Project Name <span>*</span></label>
                    <input 
                      name="projectName"
                      type="text" 
                      placeholder="e.g. Green Valley Residency" 
                      required 
                      value={formData.projectName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Project Status <span>*</span></label>
                    <select 
                      name="projectStatus"
                      value={formData.projectStatus}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Design Approval">Design Approval</option>
                      <option value="Pilling">Pilling</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Description</label>
                    <textarea 
                      name="description"
                      rows="4" 
                      placeholder="Describe the project's unique features and amenities..."
                      value={formData.description}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Owner Information */}
          {currentStep === 2 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Owner Name</label>
                    <input 
                      name="plotOwnerName"
                      type="text" 
                      placeholder="Enter full name" 
                      value={formData.plotOwnerName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Contact Number</label>
                    <input 
                      name="plotOwnerContact"
                      type="tel" 
                      placeholder="e.g. +880 17XX-XXXXXX" 
                      value={formData.plotOwnerContact}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Location & Address */}
          {currentStep === 3 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>City/Area</label>
                    <input 
                      name="location"
                      type="text" 
                      placeholder="e.g. Uttara" 
                      value={formData.location}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Sector/Block</label>
                    <input 
                      name="sector"
                      type="text" 
                      placeholder="e.g. Sector 4" 
                      value={formData.sector}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Full Plot Address</label>
                    <input 
                      name="address"
                      type="text" 
                      placeholder="Road No, House No, etc." 
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3 full-width">
                    <label>Google Map Link</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        name="mapLink"
                        type="url" 
                        placeholder="Paste Google Maps URL here" 
                        value={formData.mapLink}
                        onChange={handleInputChange}
                        style={{ paddingRight: '3rem' }}
                      />
                      <ExternalLink size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div className="form-group-v3">
                    <label>Latitude Coordinate</label>
                    <input 
                      name="latitude"
                      type="number" 
                      step="any"
                      placeholder="e.g. 23.8103" 
                      value={formData.latitude || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Longitude Coordinate</label>
                    <input 
                      name="longitude"
                      type="number" 
                      step="any"
                      placeholder="e.g. 90.4125" 
                      value={formData.longitude || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3" style={{ justifyContent: 'flex-end', gridColumn: 'span 2' }}>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      icon={MapPin}
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              setFormData(prev => ({
                                ...prev,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                              }));
                              showToast("Location coordinates captured successfully!", "success");
                            },
                            (error) => {
                              console.error(error);
                              showToast("Failed to retrieve GPS location. Enable permissions.", "error");
                            }
                          );
                        } else {
                          showToast("Geolocation is not supported by your browser.", "error");
                        }
                      }}
                    >
                      Capture GPS Coordinates
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Technical Specifications */}
          {currentStep === 4 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Plot Size</label>
                    <input 
                      name="plotSize"
                      type="text" 
                      placeholder="e.g. 5 Katha" 
                      value={formData.plotSize}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Plot Orientation</label>
                    <input 
                      name="plotOrientation"
                      type="text" 
                      placeholder="e.g. South Facing" 
                      value={formData.plotOrientation}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Number of Floors</label>
                    <input 
                      name="numberOfFloors"
                      type="text" 
                      placeholder="e.g. G+9" 
                      value={formData.numberOfFloors}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Total Apartments (Slots)</label>
                    <input 
                      name="totalApartments"
                      type="number" 
                      placeholder="e.g. 18" 
                      value={formData.totalApartments}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Apartment Size (sqft)</label>
                    <input 
                      name="apartmentSize"
                      type="text" 
                      placeholder="e.g. 1450" 
                      value={formData.apartmentSize}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Project Timeline */}
          {currentStep === 5 && (
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">
                  <div className="form-group-v3">
                    <label>Starting Date</label>
                    <input 
                      name="startingDate"
                      type="date" 
                      value={formData.startingDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-v3">
                    <label>Handover Date</label>
                    <input 
                      name="handoverDate"
                      type="date" 
                      value={formData.handoverDate}
                      onChange={handleInputChange}
                    />
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
                <button type="button" className="btn-secondary-v3" onClick={() => navigate('/projects')}>Cancel</button>
                {currentStep < 5 ? (
                  <Button type="button" variant="primary" icon={ArrowRight} onClick={nextStep}>Next Step</Button>
                ) : (
                  <Button variant="primary" type="submit" icon={Save} isLoading={isSubmitting}>Update Project</Button>
                )}
              </div>
            </div>
          </div>
        </form>

        {toastConfig.show && (
          <Toast 
            message={toastConfig.message} 
            type={toastConfig.type} 
            onClose={() => setToastConfig({ ...toastConfig, show: false })} 
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default EditProjectPage;
