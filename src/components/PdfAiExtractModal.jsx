import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { supabase } from '../lib/supabase';
import { waAI } from '../services/whatsappApi';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  FileText, 
  Sparkles, 
  Upload, 
  Check, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  Plus, 
  RefreshCcw, 
  CheckCircle2, 
  User, 
  Briefcase, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  ShieldAlert,
  Loader2,
  X
} from 'lucide-react';

const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).trim().replace(/[^\d]/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('01')) {
    return `880${cleaned}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  if (cleaned.startsWith('880') && cleaned.length >= 12) {
    return cleaned;
  }
  return cleaned;
};

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.startsWith('880') && cleaned.length === 13) {
    return `+880 ${cleaned.slice(3, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
};

const PdfAiExtractModal = ({ isOpen, onClose, user, allUsers = [], teams = [], onImportSuccess }) => {
  const { isSuperAdmin } = useAuth();
  const canAssignOthers = (typeof isSuperAdmin === 'function' && isSuperAdmin()) || user?.account_type === 'super_admin' || user?.role === 'Super Admin';

  const [stage, setStage] = useState('upload'); // 'upload' | 'processing' | 'preview' | 'importing'
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [existingPhones, setExistingPhones] = useState(new Set());
  
  // Import Options
  const [defaultSource, setDefaultSource] = useState('PDF AI Extract');
  const [defaultStatus, setDefaultStatus] = useState('Fresh Lead');
  const [assignedUserId, setAssignedUserId] = useState(user?.id || '');
  const [assignedTeamId, setAssignedTeamId] = useState('');

  // Processing state
  const [processingStatus, setProcessingStatus] = useState('Reading PDF document...');
  const [errorMessage, setErrorMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Fetch existing phones for duplicate detection on open
  useEffect(() => {
    if (isOpen) {
      setStage('upload');
      setFile(null);
      setExtractedLeads([]);
      setSelectedIndices([]);
      setErrorMessage('');
      setAssignedUserId(user?.id || '');

      const fetchPhones = async () => {
        try {
          const { data, error } = await supabase
            .from('leads')
            .select('phone, second_phone')
            .eq('org_id', user?.org_id);
          
          if (!error && data) {
            const phonesSet = new Set();
            data.forEach(l => {
              if (l.phone) phonesSet.add(cleanPhoneNumber(l.phone));
              if (l.second_phone) phonesSet.add(cleanPhoneNumber(l.second_phone));
            });
            setExistingPhones(phonesSet);
          }
        } catch (e) {
          console.error('Failed to fetch existing phones for duplicate check', e);
        }
      };
      fetchPhones();
    }
  }, [isOpen, user]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a valid PDF file (.pdf)');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds maximum limit of 20MB');
      return;
    }
    setFile(selectedFile);
    setErrorMessage('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleExtractWithAi = async () => {
    if (!file) {
      toast.error('Please upload a PDF file first');
      return;
    }

    setStage('processing');
    setProcessingStatus('Uploading & reading PDF document...');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProcessingStatus('AI is extracting lead records & contact info...');
      
      const response = await waAI.extractLeadsFromPdf(formData);
      
      if (!response || !response.success || !Array.isArray(response.leads)) {
        throw new Error(response?.error || 'Failed to extract leads from PDF');
      }

      if (response.leads.length === 0) {
        setErrorMessage('No leads could be found in the PDF. Please verify the document text.');
        setStage('upload');
        toast.error('No lead records found in this document.');
        return;
      }

      // Process extracted leads
      const formattedLeads = response.leads.map((lead, idx) => ({
        id: idx + 1,
        name: lead.name || '',
        phone: lead.phone || '',
        second_phone: lead.second_phone || '',
        email: lead.email || '',
        designation: lead.designation || '',
        company: lead.company || '',
        source: lead.source || defaultSource,
        status: lead.status || defaultStatus,
        location: lead.location || '',
        area: lead.area || '',
        address: lead.address || '',
        priority: lead.priority || 'Medium',
        description: lead.description || ''
      }));

      setExtractedLeads(formattedLeads);
      // Select all by default
      setSelectedIndices(formattedLeads.map((_, i) => i));
      setStage('preview');
      toast.success(`Successfully extracted ${formattedLeads.length} leads with AI!`);

    } catch (err) {
      console.error('AI PDF Extraction Error:', err);
      setErrorMessage(err.message || 'An error occurred during AI extraction.');
      setStage('upload');
      toast.error(err.message || 'AI extraction failed');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIndices.length === extractedLeads.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(extractedLeads.map((_, i) => i));
    }
  };

  const handleToggleSelectRow = (index) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...extractedLeads];
    updated[index][field] = value;
    setExtractedLeads(updated);
  };

  const handleDeleteRow = (index) => {
    const updated = extractedLeads.filter((_, i) => i !== index);
    setExtractedLeads(updated);
    setSelectedIndices(selectedIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const handleAddManualRow = () => {
    const newLead = {
      id: extractedLeads.length + 1,
      name: '',
      phone: '',
      second_phone: '',
      email: '',
      designation: '',
      company: '',
      source: defaultSource,
      status: defaultStatus,
      location: '',
      area: '',
      address: '',
      priority: 'Medium',
      description: ''
    };
    setExtractedLeads([...extractedLeads, newLead]);
    setSelectedIndices([...selectedIndices, extractedLeads.length]);
  };

  const handleImportLeads = async () => {
    if (selectedIndices.length === 0) {
      toast.error('Please select at least one lead to import.');
      return;
    }

    const leadsToImport = selectedIndices.map(i => extractedLeads[i]);

    setIsImporting(true);
    setStage('importing');
    setImportProgress(20);

    try {
      // Clean and map payload
      const payload = leadsToImport.map(lead => {
        const cleanedPhone = cleanPhoneNumber(lead.phone);
        const cleanedSecond = cleanPhoneNumber(lead.second_phone);

        return {
          name: lead.name.trim() || 'Unnamed Lead',
          phone: cleanedPhone ? (cleanedPhone.startsWith('1') && cleanedPhone.length === 10 ? `+880 ${cleanedPhone}` : cleanedPhone) : null,
          second_phone: cleanedSecond ? (cleanedSecond.startsWith('1') && cleanedSecond.length === 10 ? `+880 ${cleanedSecond}` : cleanedSecond) : null,
          email: lead.email?.trim() || null,
          designation: lead.designation?.trim() || null,
          company: lead.company?.trim() || null,
          source: lead.source?.trim() || defaultSource,
          status: lead.status?.trim() || defaultStatus,
          location: lead.location?.trim() || null,
          area: lead.area?.trim() || null,
          address: lead.address?.trim() || null,
          priority: lead.priority || 'Medium',
          description: lead.description?.trim() || null,
          assigned_to: assignedUserId || user?.id,
          assigned_team_id: assignedTeamId || null,
          org_id: user?.org_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      setImportProgress(60);

      const { data, error } = await supabase
        .from('leads')
        .insert(payload)
        .select();

      if (error) throw error;

      setImportProgress(100);
      toast.success(`Successfully imported ${data?.length || payload.length} leads to My Leads!`);
      
      if (onImportSuccess) {
        onImportSuccess(data);
      }
      onClose();

    } catch (err) {
      console.error('Lead import failed:', err);
      toast.error(err.message || 'Failed to import leads to database');
      setStage('preview');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI PDF Lead Extractor" className="pdf-ai-modal">
      <div className="pdf-ai-container">

        {/* STAGE 1: UPLOAD */}
        {stage === 'upload' && (
          <div className="pdf-ai-upload-stage">
            <div className="upload-header-banner">
              <div className="banner-icon">
                <Sparkles size={24} className="sparkle-icon" />
              </div>
              <div className="banner-text">
                <h4>Extract Leads Automatically with AI</h4>
                <p>Upload any PDF document (lead lists, contact sheets, quotes, exported reports). Our AI will parse and organize all lead entries cleanly for your review.</p>
              </div>
            </div>

            {/* Dropzone */}
            <div 
              className={`pdf-dropzone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="file-preview-card">
                  <FileText size={40} className="file-icon-pdf" />
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <button type="button" className="remove-file-btn" onClick={() => setFile(null)}>
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <label className="dropzone-label">
                  <input 
                    type="file" 
                    accept=".pdf,application/pdf" 
                    onChange={(e) => handleFileSelect(e.target.files[0])} 
                    hidden 
                  />
                  <div className="upload-icon-circle">
                    <Upload size={28} />
                  </div>
                  <span className="dropzone-main-text">Drag & drop your PDF file here, or <span className="browse-link">Browse</span></span>
                  <span className="dropzone-sub-text">Supports PDF files up to 20MB</span>
                </label>
              )}
            </div>

            {errorMessage && (
              <div className="pdf-error-banner">
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Default Configurations */}
            <div className="pdf-options-grid">
              <div className="option-field">
                <label>Default Lead Source</label>
                <select value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)}>
                  <option value="PDF AI Extract">PDF AI Extract</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Website">Website</option>
                  <option value="Referral">Referral</option>
                  <option value="Event / Expo">Event / Expo</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Cold Call">Cold Call</option>
                </select>
              </div>

              <div className="option-field">
                <label>Default Status</label>
                <select value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)}>
                  <option value="Fresh Lead">Fresh Lead</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Meeting Scheduled">Meeting Scheduled</option>
                </select>
              </div>

              <div className="option-field">
                <label>Assign Lead To User</label>
                <select 
                  value={assignedUserId} 
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  disabled={!canAssignOthers}
                >
                  <option value={user?.id || ''}>Assigned to Me ({user?.user_metadata?.full_name || user?.full_name || user?.email || 'Current User'})</option>
                  {canAssignOthers && allUsers.filter(u => u.id !== user?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role || 'Member'})</option>
                  ))}
                </select>
              </div>

              {teams.length > 0 && (
                <div className="option-field">
                  <label>Assign to Team (Optional)</label>
                  <select value={assignedTeamId} onChange={(e) => setAssignedTeamId(e.target.value)}>
                    <option value="">No Team Assigned</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pdf-modal-footer">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button 
                variant="primary" 
                icon={Sparkles} 
                disabled={!file} 
                onClick={handleExtractWithAi}
              >
                Extract Leads with AI
              </Button>
            </div>
          </div>
        )}

        {/* STAGE 2: PROCESSING */}
        {stage === 'processing' && (
          <div className="pdf-ai-processing-stage">
            <div className="ai-pulse-loader">
              <Sparkles size={48} className="rotating-sparkle" />
            </div>
            <h3>AI Lead Extraction in Progress</h3>
            <p className="processing-status-text">{processingStatus}</p>
            <div className="processing-bar-container">
              <div className="processing-bar-fill"></div>
            </div>
            <span className="processing-note">This usually takes 5-15 seconds depending on document length...</span>
          </div>
        )}

        {/* STAGE 3: PREVIEW & EDIT */}
        {stage === 'preview' && (
          <div className="pdf-ai-preview-stage">
            <div className="preview-top-bar">
              <div className="preview-summary">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span>Extracted <strong>{extractedLeads.length} leads</strong> from <code>{file?.name}</code></span>
              </div>
              
              <div className="preview-actions-right">
                <span className="selected-badge">
                  {selectedIndices.length} of {extractedLeads.length} Selected
                </span>
                <Button variant="secondary" icon={Plus} size="sm" onClick={handleAddManualRow}>
                  Add Row
                </Button>
              </div>
            </div>

            {/* Extracted Leads Table */}
            <div className="extracted-table-wrapper">
              <table className="extracted-leads-table">
                <thead>
                  <tr>
                    <th className="th-checkbox">
                      <input 
                        type="checkbox" 
                        checked={selectedIndices.length === extractedLeads.length && extractedLeads.length > 0}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                    <th>#</th>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Second Phone</th>
                    <th>Email</th>
                    <th>Profession / Title</th>
                    <th>Company / Project</th>
                    <th>Location / Area</th>
                    <th>Priority</th>
                    <th>Description / Notes</th>
                    <th className="th-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedLeads.map((lead, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    const cleanedP = cleanPhoneNumber(lead.phone);
                    const isDuplicate = cleanedP && existingPhones.has(cleanedP);

                    return (
                      <tr key={idx} className={`${isSelected ? 'row-selected' : 'row-unselected'} ${isDuplicate ? 'row-duplicate' : ''}`}>
                        <td className="td-checkbox">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(idx)}
                          />
                        </td>
                        <td className="td-num">{idx + 1}</td>
                        
                        {/* Name */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.name}
                            placeholder="Customer name"
                            onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                          />
                        </td>

                        {/* Phone */}
                        <td>
                          <div className="phone-input-cell">
                            <input 
                              type="text" 
                              className={`table-input ${isDuplicate ? 'input-duplicate-warning' : ''}`}
                              value={lead.phone}
                              placeholder="017xxxxxxxx"
                              onChange={(e) => handleFieldChange(idx, 'phone', e.target.value)}
                            />
                            {isDuplicate && (
                              <span className="duplicate-tag" title="This phone number already exists in My Leads">
                                Duplicate
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Second Phone */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.second_phone}
                            placeholder="Alt phone"
                            onChange={(e) => handleFieldChange(idx, 'second_phone', e.target.value)}
                          />
                        </td>

                        {/* Email */}
                        <td>
                          <input 
                            type="email" 
                            className="table-input" 
                            value={lead.email}
                            placeholder="email@example.com"
                            onChange={(e) => handleFieldChange(idx, 'email', e.target.value)}
                          />
                        </td>

                        {/* Profession */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.designation}
                            placeholder="Designation / Role"
                            onChange={(e) => handleFieldChange(idx, 'designation', e.target.value)}
                          />
                        </td>

                        {/* Company */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.company}
                            placeholder="Project / Company"
                            onChange={(e) => handleFieldChange(idx, 'company', e.target.value)}
                          />
                        </td>

                        {/* Location */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.location || lead.area}
                            placeholder="Dhaka, Gulshan"
                            onChange={(e) => handleFieldChange(idx, 'location', e.target.value)}
                          />
                        </td>

                        {/* Priority */}
                        <td>
                          <select 
                            className="table-select"
                            value={lead.priority}
                            onChange={(e) => handleFieldChange(idx, 'priority', e.target.value)}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>

                        {/* Description */}
                        <td>
                          <input 
                            type="text" 
                            className="table-input" 
                            value={lead.description}
                            placeholder="Notes / details"
                            onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                          />
                        </td>

                        {/* Action */}
                        <td className="td-action">
                          <button 
                            type="button" 
                            className="table-delete-btn" 
                            title="Delete Lead"
                            onClick={() => handleDeleteRow(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pdf-modal-footer">
              <Button variant="secondary" icon={RefreshCcw} onClick={() => setStage('upload')}>
                Re-upload PDF
              </Button>
              <div className="right-footer-btns">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button 
                  variant="primary" 
                  icon={Check} 
                  disabled={selectedIndices.length === 0}
                  onClick={handleImportLeads}
                >
                  Approve & Import ({selectedIndices.length} Leads)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 4: IMPORTING */}
        {stage === 'importing' && (
          <div className="pdf-ai-processing-stage">
            <Loader2 size={44} className="animate-spin text-indigo-400" />
            <h3>Importing Selected Leads...</h3>
            <p className="processing-status-text">Saving approved leads to your database...</p>
            <div className="processing-bar-container">
              <div className="processing-bar-fill" style={{ width: `${importProgress}%` }}></div>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};

export default PdfAiExtractModal;
