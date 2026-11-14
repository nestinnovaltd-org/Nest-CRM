import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import { 
  ChevronRight, 
  ArrowLeft,
  Image as ImageIcon,
  ExternalLink,
  Save,
  Plus,
  X,
  Sparkles,
  Globe,
  Loader2
} from 'lucide-react';
import Toast from '../components/ui/Toast';
import './AddProject.css';

const SUGGESTED_FEATURES = [
  '24/7 Security',
  'Rooftop Garden',
  'Swimming Pool',
  'Gym & Fitness',
  'Modern Elevators',
  'Standby Generator',
  'CCTV Surveillance',
  'Car Parking'
];

const EditProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    projectName: '',
    projectStatus: 'Upcoming',
    image: null,
    projectUrl: '',
    description: '',
    features: []
  });

  const [currentFeature, setCurrentFeature] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });
  const availableColsRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error || !data) {
          showToast('Project not found', 'error');
          setTimeout(() => navigate('/projects'), 2000);
        } else {
          availableColsRef.current = new Set(Object.keys(data));
          let parsedFeatures = [];
          if (Array.isArray(data.features)) {
            parsedFeatures = data.features;
          } else if (typeof data.features === 'string' && data.features.trim()) {
            try {
              const json = JSON.parse(data.features);
              parsedFeatures = Array.isArray(json) ? json : [data.features];
            } catch {
              parsedFeatures = data.features.split(',').map(f => f.trim()).filter(Boolean);
            }
          }

          setFormData({
            projectName: data.projectName || '',
            projectStatus: data.projectStatus || 'Upcoming',
            image: data.image || null,
            projectUrl: data.projectUrl || data.url || data.mapLink || '',
            description: data.description || '',
            features: parsedFeatures
          });
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        showToast('Error loading project data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("File is too large. Max 5MB allowed.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
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
  };

  const handleAddFeature = (featureToAdd) => {
    const feat = (featureToAdd || currentFeature).trim();
    if (!feat) return;

    if (formData.features.includes(feat)) {
      showToast("Feature already added", "error");
      return;
    }

    setFormData(prev => ({
      ...prev,
      features: [...prev.features, feat]
    }));
    setCurrentFeature('');
  };

  const handleRemoveFeature = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleFeatureKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFeature();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.projectName.trim()) {
      showToast("Please enter a Project Name", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      const available = availableColsRef.current;
      const payload = {
        updated_at: new Date().toISOString()
      };

      const setIfAvailable = (key, val) => {
        if (!available || available.has(key)) {
          payload[key] = val;
        }
      };

      // Project Name
      if (!available || available.has('projectName')) {
        payload.projectName = formData.projectName.trim();
      } else if (available.has('project_name')) {
        payload.project_name = formData.projectName.trim();
      } else if (available.has('name')) {
        payload.name = formData.projectName.trim();
      }

      // Status
      if (!available || available.has('projectStatus')) {
        payload.projectStatus = formData.projectStatus;
      }
      if (available && available.has('status')) {
        payload.status = formData.projectStatus;
      }

      // Optional columns
      setIfAvailable('image', formData.image);
      setIfAvailable('description', formData.description);
      setIfAvailable('features', formData.features);
      setIfAvailable('projectUrl', formData.projectUrl.trim());
      setIfAvailable('url', formData.projectUrl.trim());

      let currentPayload = { ...payload };
      let { error } = await supabase.from('projects').update(currentPayload).eq('id', id);

      // In case availableCols didn't catch a missing column reported by PostgREST schema cache
      while (error && (error.message?.includes('column') || error.code === 'PGRST204')) {
        const match = error.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && match[1] in currentPayload) {
          const missingCol = match[1];
          console.warn(`Column '${missingCol}' not found in 'projects'. Removing and retrying...`);
          delete currentPayload[missingCol];
          const retry = await supabase.from('projects').update(currentPayload).eq('id', id);
          error = retry.error;
        } else {
          break;
        }
      }

      if (error) throw error;

      showToast('Project updated successfully!', 'success');
      setTimeout(() => navigate('/projects'), 1200);
    } catch (error) {
      console.error('Error updating project:', error);
      showToast(error.message || 'Failed to update project', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <button className="back-btn-v2" onClick={() => navigate('/projects')} title="Back to Projects">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                {isLoading ? 'Loading Project...' : `Edit Project: ${formData.projectName || 'Untitled'}`}
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
                Update project information, status, images, and links.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="add-project-container">
            <div className="form-section-card">
              <div className="section-body">
                <div className="form-grid-v3">

                  {/* 1. Project Image */}
                  <div className="form-group-v3 full-width">
                    <label>Project Image</label>
                    <div className="image-upload-wrapper">
                      <div className="image-preview-large">
                        {formData.image ? (
                          <img 
                            src={formData.image} 
                            alt="Project Preview" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <ImageIcon size={38} strokeWidth={1.5} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No image uploaded</span>
                          </div>
                        )}
                      </div>
                      <div className="upload-controls" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <label className="upload-btn-label" style={{ margin: 0, cursor: 'pointer' }}>
                            <Plus size={16} />
                            <span>{formData.image ? 'Change Image' : 'Upload Image'}</span>
                            <input type="file" hidden onChange={handleImageChange} accept="image/*" />
                          </label>
                          {formData.image && (
                            <button 
                              type="button"
                              className="btn-secondary-v3"
                              style={{ padding: '0.5rem 1rem' }}
                              onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                            >
                              Remove Image
                            </button>
                          )}
                        </div>
                        <p className="upload-hint" style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Recommended resolution: 1200×800px. JPG, PNG or WebP (Max: 5MB, auto-compressed).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Project Name */}
                  <div className="form-group-v3">
                    <label>Project Name <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                    <input 
                      name="projectName"
                      type="text" 
                      placeholder="e.g. Green Valley Residency" 
                      required 
                      value={formData.projectName}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* 3. Project Status */}
                  <div className="form-group-v3">
                    <label>Project Status <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                    <select 
                      name="projectStatus"
                      value={formData.projectStatus}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                      <option value="Design Approval">Design Approval</option>
                      <option value="Pilling">Pilling</option>
                    </select>
                  </div>

                  {/* 4. URL Link of the Project */}
                  <div className="form-group-v3 full-width">
                    <label>Project URL Link</label>
                    <div className="url-input-container">
                      <Globe size={18} className="url-icon-prefix" />
                      <input 
                        name="projectUrl"
                        type="url" 
                        placeholder="https://example.com/project-preview" 
                        value={formData.projectUrl}
                        onChange={handleInputChange}
                      />
                      {formData.projectUrl && (
                        <a 
                          href={formData.projectUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="url-test-link"
                          title="Open Link"
                        >
                          <ExternalLink size={13} />
                          Visit
                        </a>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Provide live website, virtual tour, or preview URL of the project.
                    </span>
                  </div>

                  {/* 5. Features */}
                  <div className="form-group-v3 full-width">
                    <label>Project Features & Amenities</label>
                    <div className="features-input-box">
                      <div className="features-input-row">
                        <input 
                          type="text"
                          placeholder="Type a feature and press Enter (e.g. Swimming Pool, 24/7 Security)..."
                          value={currentFeature}
                          onChange={(e) => setCurrentFeature(e.target.value)}
                          onKeyDown={handleFeatureKeyDown}
                        />
                        <Button 
                          type="button" 
                          variant="secondary" 
                          icon={Plus}
                          onClick={() => handleAddFeature()}
                          disabled={!currentFeature.trim()}
                          className="feature-add-btn"
                        >
                          Add
                        </Button>
                      </div>

                      {/* Chips Display */}
                      <div className="features-chips-wrap">
                        {formData.features.length === 0 ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No features added yet. Type above or click suggestions below.
                          </span>
                        ) : (
                          formData.features.map((feat, idx) => (
                            <span key={idx} className="feature-chip">
                              <Sparkles size={12} />
                              {feat}
                              <button 
                                type="button" 
                                className="feature-chip-remove"
                                onClick={() => handleRemoveFeature(idx)}
                                title="Remove"
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Quick Suggestions */}
                      <div className="quick-suggestions">
                        <span className="quick-sugg-label">Quick suggestions:</span>
                        {SUGGESTED_FEATURES.map((item) => {
                          const isAdded = formData.features.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              className={`quick-sugg-chip ${isAdded ? 'added' : ''}`}
                              onClick={() => !isAdded && handleAddFeature(item)}
                              disabled={isAdded}
                            >
                              + {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 6. Descriptions */}
                  <div className="form-group-v3 full-width">
                    <label>Description</label>
                    <textarea 
                      name="description"
                      rows="4" 
                      placeholder="Describe the project overview, key highlights, architectural details, and offerings..."
                      value={formData.description}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>

                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="form-sticky-footer">
              <div className="footer-content">
                <div className="footer-left">
                  <Button 
                    type="button" 
                    variant="outline" 
                    icon={ArrowLeft} 
                    onClick={() => navigate('/projects')}
                  >
                    Back to Projects
                  </Button>
                </div>
                <div className="footer-btns">
                  <button 
                    type="button" 
                    className="btn-secondary-v3" 
                    onClick={() => navigate('/projects')}
                  >
                    Cancel
                  </button>
                  <Button 
                    variant="primary" 
                    type="submit" 
                    icon={Save} 
                    isLoading={isSubmitting}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}

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