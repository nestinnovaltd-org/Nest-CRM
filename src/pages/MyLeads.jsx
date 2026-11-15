import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { sendLeadAssignmentEmail } from '../lib/emailService';
import DashboardLayout from '../layouts/DashboardLayout';
import LeadTabs from '../components/LeadTabs';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { 
  Plus, 
  Search, 
  Filter, 
  List, 
  Layout, 
  Phone, 
  Mail, 
  MapPin, 
  MessageCircle, 
  MoreVertical,
  Briefcase,
  ChevronDown,
  Download,
  Clock,
  Calendar,
  StickyNote,
  UserCheck,
  UserPlus,
  History,
  MessageSquarePlus,
  Upload,
  FileSpreadsheet,
  AlertCircle as AlertIcon,
  CheckCircle2,
  GitMerge,
  Link2,
  RefreshCcw,
  RefreshCcw as RefreshIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Folder,
  FolderPlus,
  Tag,
  ArrowLeft,
  Layers,
  Inbox
} from 'lucide-react';
import { WhatsAppIcon } from '../components/ui/Icons';
import { waLeads, waSessions, waCampaigns, waTemplates } from '../services/whatsappApi';
import { fetchLeadCategories, createLeadCategory, deleteLeadCategory } from '../services/leadCategoryService';
import './whatsapp/whatsapp.css';
import './Leads.css';
import './LeadCategories.css';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateStr;
  }
};

const normalizePhoneForDb = (raw) => {
  if (!raw) return '';
  let cleaned = String(raw).trim().replace(/[^\d]/g, '');
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

const formatDateToDDMMYYYY = (dateVal) => {
  if (!dateVal) return 'Not Set';
  
  if (dateVal && typeof dateVal.toDate === 'function') {
    const d = dateVal.toDate();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  if (typeof dateVal !== 'string') {
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch (e) {}
    return String(dateVal);
  }

  const cleanVal = dateVal.trim();
  if (!cleanVal) return 'Not Set';

  const isoMatch = cleanVal.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [_, year, month, day] = isoMatch;
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  }

  const slashMatch = cleanVal.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (slashMatch) {
    const [_, p1, p2, p3] = slashMatch;
    const part1 = parseInt(p1, 10);
    const part2 = parseInt(p2, 10);
    const part3 = parseInt(p3, 10);
    const year = part3 < 100 ? (part3 > 50 ? 1900 + part3 : 2000 + part3) : part3;

    let day, month;
    if (part1 > 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      day = part2;
      month = part1;
    } else {
      day = part2;
      month = part1;
    }
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  }

  const d = new Date(cleanVal);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return cleanVal;
};

const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  let val = phone.toString().replace(/\D/g, '');
  if (val.startsWith('880')) {
    val = val.substring(3);
  }
  if (val.startsWith('0')) {
    val = val.substring(1);
  }
  return val;
};

const parseCSVText = (text) => {
  if (!text) return { headers: [], rows: [] };
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
};

const checkMultiplePhonesDuplicateInTeam = async (cleanedPhones, user, allUsers, teams) => {
  const duplicatesMap = new Map();
  if (!cleanedPhones || cleanedPhones.length === 0) return duplicatesMap;

  // Gather team member UIDs
  const currentUserName = user?.full_name || user?.fullName || user?.name || '';
  const userTeams = (teams || []).filter(team => {
    const leads = team.team_leads || team.teamLeads || (team.team_lead ? [team.team_lead] : []);
    const members = team.members || [];
    return members.includes(currentUserName) || leads.includes(currentUserName);
  });

  const teamMemberNames = new Set([currentUserName]);
  userTeams.forEach(team => {
    if (team.members) team.members.forEach(m => teamMemberNames.add(m));
    const leads = team.team_leads || team.teamLeads || (team.team_lead ? [team.team_lead] : []);
    leads.forEach(l => teamMemberNames.add(l));
  });

  const teamMemberUids = (allUsers || [])
    .filter(u => teamMemberNames.has(u.full_name || u.fullName || u.name))
    .map(u => u.uid || u.id)
    .filter(Boolean);
  
  const currentUserId = user?.uid || user?.id;
  if (currentUserId && !teamMemberUids.includes(currentUserId)) {
    teamMemberUids.push(currentUserId);
  }

  // Create list of search formats for query
  const searchFormats = [];
  cleanedPhones.forEach(phone => {
    searchFormats.push(`+880 ${phone}`);
    searchFormats.push(`+880${phone}`);
    searchFormats.push(`880${phone}`);
    searchFormats.push(`880 ${phone}`);
    searchFormats.push(`0${phone}`);
    searchFormats.push(phone);
  });

  // Chunk formattedPhones into arrays of 30 items
  const chunkSize = 30;
  for (let i = 0; i < searchFormats.length; i += chunkSize) {
    const chunk = searchFormats.slice(i, i + chunkSize);
    const { data: matchedLeads, error } = await supabase.from('leads').select('*').in('phone', chunk);

    if (!error && matchedLeads && matchedLeads.length > 0) {
      matchedLeads.forEach(leadData => {
        const assignee = leadData.assigned_to || leadData.assignedTo;
        const owner = leadData.owner_id || leadData.ownerId;

        if (teamMemberUids.includes(assignee) || teamMemberUids.includes(owner)) {
          const leadCleanedPhone = cleanPhoneNumber(leadData.phone);
          duplicatesMap.set(leadCleanedPhone, {
            duplicate: true,
            leadName: leadData.name || leadData.full_name,
            assignedToName: leadData.assigned_to_name || leadData.assignedToName || 'someone in your team'
          });
        }
      });
    }
  }

  return duplicatesMap;
};

const BulkUploadModal = ({ isOpen, onClose, onImport, user, allUsers, teams, categories }) => {
  const [file, setFile] = useState(null);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [invalidLeads, setInvalidLeads] = useState([]);

  const handleClose = () => {
    setFile(null);
    setDefaultCategory('');
    setIsUploading(false);
    setUploadProgress(0);
    setImportSummary(null);
    setInvalidLeads([]);
    onClose();
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setImportSummary(null);
      setInvalidLeads([]);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'Photo',
      'Company Name',
      'Contact Person',
      'Email Address',
      'Category',
      'Phone Number',
      'Second Phone Number',
      'Location',
      'City'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'https://example.com/photo.jpg,Acme Corporation,John Doe,john@example.com,Real Estate,01712345678,01812345678,Road 11 Banani,Dhaka';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'lead_import_template.csv');
    a.click();
  };

  const handleUpload = () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const { headers, rows: dataRows } = parseCSVText(text);
        
        if (!headers || headers.length === 0 || dataRows.length === 0) {
          alert('CSV file is empty or invalid.');
          setIsUploading(false);
          return;
        }

        setUploadProgress(35);

        // First pass: parse and validate format
        const parsedRows = [];
        const csvSeenPhones = new Set();
        const errors = [];
        const validCleanedPhones = [];
        const tempInvalidLeads = [];

        dataRows.forEach((row, index) => {
          if (row.length === 0 || row.every(cell => !cell)) return;

          const obj = {};
          let rawPhone = '';

          headers.forEach((header, colIndex) => {
            const value = (row[colIndex] || '').trim();
            const h = header.toLowerCase().trim();
            
            if (
              h.includes('second') || 
              h.includes('alt') || 
              h.includes('alternative') || 
              h.includes('secondary')
            ) {
              obj.second_phone_raw = value;
            }
            else if (
              h.includes('phone') || 
              h.includes('mobile') || 
              h.includes('cell') ||
              h.includes('number')
            ) {
              rawPhone = value;
            }
            else if (h.includes('company') || h.includes('business') || h.includes('org') || h.includes('project')) {
              obj.company = value;
            }
            else if (h.includes('contact') || h.includes('person') || h.includes('customer') || h.includes('client') || h.includes('name')) {
              obj.contact_person = value;
            }
            else if (h.includes('email') || h.includes('mail')) {
              obj.email = value;
            }
            else if (h.includes('city')) {
              obj.city = value;
            }
            else if (h.includes('location') || h.includes('area') || h.includes('address')) {
              obj.location = value;
            }
            else if (h.includes('photo') || h.includes('image') || h.includes('avatar') || h.includes('picture')) {
              obj.image = value;
            }
            else if (h.includes('category') || h.includes('cat') || h.includes('group') || h.includes('segment')) {
              obj.category = value;
            }
          });

          // Unify fields matching form structure
          obj.company = obj.company || '';
          obj.contact_person = obj.contact_person || '';
          obj.name = obj.contact_person || obj.company || 'Lead';
          obj.category = obj.category || defaultCategory || '';
          obj.email = obj.email || '';
          obj.location = obj.location || '';
          obj.city = obj.city || '';
          obj.area = '';
          obj.address = [obj.location, obj.city].filter(Boolean).join(', ');

          const cleaned = cleanPhoneNumber(rawPhone);
          const rowNum = index + 2; // row 1 is header
          obj.rowNum = rowNum;

          if (obj.second_phone_raw) {
            const cleanedSecond = cleanPhoneNumber(obj.second_phone_raw);
            if (cleanedSecond.startsWith('1') && cleanedSecond.length === 10) {
              obj.second_phone = `+880 ${cleanedSecond}`;
            } else {
              obj.second_phone = obj.second_phone_raw;
            }
            delete obj.second_phone_raw;
          } else {
            obj.second_phone = '';
          }

          if (!cleaned.startsWith('1') || cleaned.length !== 10) {
            errors.push(`Row ${rowNum}: Phone number must start with 1 and be 10 digits (got "${rawPhone}").`);
            tempInvalidLeads.push({
              ...obj,
              originalPhone: rawPhone,
              phone: rawPhone,
              errorType: 'format',
              errorMsg: 'Must start with 1 & be 10 digits'
            });
          } else if (csvSeenPhones.has(cleaned)) {
            errors.push(`Row ${rowNum}: Duplicate phone number "${rawPhone}" found within the CSV.`);
            tempInvalidLeads.push({
              ...obj,
              originalPhone: rawPhone,
              phone: rawPhone,
              errorType: 'duplicate_csv',
              errorMsg: 'Duplicate inside CSV'
            });
          } else {
            csvSeenPhones.add(cleaned);
            obj.phone = `+880 ${cleaned}`;
            obj.cleanedPhone = cleaned;
            validCleanedPhones.push(cleaned);
            parsedRows.push(obj);
          }
        });

        setUploadProgress(65);

        // Second pass: check duplicates in team context
        let duplicatesMap = new Map();
        if (validCleanedPhones.length > 0) {
          duplicatesMap = await checkMultiplePhonesDuplicateInTeam(validCleanedPhones, user, allUsers, teams);
        }

        // Filter out duplicates and record errors
        const finalImportData = [];
        parsedRows.forEach((row) => {
          const dup = duplicatesMap.get(row.cleanedPhone);
          if (dup) {
            errors.push(`Row ${row.rowNum}: Duplicate phone number "+880 ${row.cleanedPhone}" already exists in your team (Lead: "${dup.leadName}", Assigned to: ${dup.assignedToName}).`);
            
            const cleanObj = { ...row };
            delete cleanObj.cleanedPhone;

            tempInvalidLeads.push({
              ...cleanObj,
              originalPhone: `+880 ${row.cleanedPhone}`,
              phone: `+880 ${row.cleanedPhone}`,
              errorType: 'duplicate_team',
              errorMsg: `Duplicate in team (Lead: "${dup.leadName}")`
            });
          } else {
            const importObj = { ...row };
            delete importObj.cleanedPhone;
            delete importObj.rowNum;
            
            importObj.createdAt = new Date().toISOString();
            importObj.lastAction = 'Imported';
            importObj.status = importObj.nextFollowUp ? 'Follow Up' : 'Fresh Lead';

            finalImportData.push(importObj);
          }
        });

        setUploadProgress(85);

        let importedCount = 0;
        if (finalImportData.length > 0 && onImport) {
          importedCount = await onImport(finalImportData);
        }

        setUploadProgress(100);
        setIsUploading(false);

        const successCount = typeof importedCount === 'number' ? importedCount : finalImportData.length;
        const failedCount = dataRows.length - successCount;

        setImportSummary({
          total: dataRows.length,
          success: successCount,
          failed: failedCount,
          errors: errors
        });

        setInvalidLeads(tempInvalidLeads);
      } catch (err) {
        console.error("Error parsing bulk upload:", err);
        alert("An error occurred while parsing the CSV file.");
        setIsUploading(false);
      }
    };

    reader.readAsText(file);
  };

  const handlePhoneChange = (rowIndex, value) => {
    setInvalidLeads(prev => prev.map((lead, idx) => {
      if (idx === rowIndex) {
        return { ...lead, phone: value };
      }
      return lead;
    }));
  };

  const handleImportCorrected = async () => {
    setIsUploading(true);
    setUploadProgress(20);

    const stillInvalidLeads = [];
    const importData = [];
    const validCleanedPhones = [];
    const parsedRows = [];
    const csvSeenPhones = new Set();

    setUploadProgress(40);

    invalidLeads.forEach((lead) => {
      const cleaned = cleanPhoneNumber(lead.phone);
      if (!cleaned.startsWith('1') || cleaned.length !== 10) {
        stillInvalidLeads.push({
          ...lead,
          errorType: 'format',
          errorMsg: 'Must start with 1 & be 10 digits'
        });
      } else if (csvSeenPhones.has(cleaned)) {
        stillInvalidLeads.push({
          ...lead,
          errorType: 'duplicate_csv',
          errorMsg: 'Duplicate within corrections'
        });
      } else {
        csvSeenPhones.add(cleaned);
        const updatedLead = { ...lead };
        updatedLead.phone = `+880 ${cleaned}`;
        updatedLead.cleanedPhone = cleaned;
        validCleanedPhones.push(cleaned);
        parsedRows.push(updatedLead);
      }
    });

    setUploadProgress(70);

    let duplicatesMap = new Map();
    if (validCleanedPhones.length > 0) {
      duplicatesMap = await checkMultiplePhonesDuplicateInTeam(validCleanedPhones, user, allUsers, teams);
    }

    parsedRows.forEach((row) => {
      const dup = duplicatesMap.get(row.cleanedPhone);
      if (dup) {
        stillInvalidLeads.push({
          ...row,
          errorType: 'duplicate_team',
          errorMsg: `Duplicate in team (Lead: "${dup.leadName}")`
        });
      } else {
        const importObj = { ...row };
        delete importObj.cleanedPhone;
        delete importObj.errorType;
        delete importObj.errorMsg;
        delete importObj.originalPhone;
        delete importObj.rowNum;

        importObj.createdAt = new Date().toISOString();
        importObj.lastAction = 'Imported';
        importObj.status = importObj.nextFollowUp ? 'Follow Up' : 'Fresh Lead';

        importData.push(importObj);
      }
    });

    setUploadProgress(85);

    let importedCount = 0;
    if (importData.length > 0 && onImport) {
      importedCount = await onImport(importData);
    }

    setUploadProgress(100);
    setIsUploading(false);

    setInvalidLeads(stillInvalidLeads);

    const actualAdded = typeof importedCount === 'number' ? importedCount : importData.length;

    setImportSummary(prev => {
      const newSuccess = (prev?.success || 0) + actualAdded;
      const newFailed = stillInvalidLeads.length;
      const newErrors = stillInvalidLeads.map(l => `Row ${l.rowNum || ''}: ${l.errorMsg}`);
      return {
        total: prev?.total || 0,
        success: newSuccess,
        failed: newFailed,
        errors: newErrors
      };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Leads (CSV)" className="glass-modal">
      <div className="bulk-upload-container">
        {!importSummary ? (
          <>
            <div className={`upload-dropzone ${file ? 'has-file' : ''}`}>
              <input type="file" accept=".csv" onChange={handleFileChange} id="csv-upload" hidden />
              <label htmlFor="csv-upload" className="dropzone-label">
                <div className="upload-icon-circle">
                  <Upload size={32} />
                </div>
                {file ? (
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                  </div>
                ) : (
                  <div className="upload-text">
                    <p className="main-text">Click or Drag to upload CSV</p>
                    <p className="sub-text">Supported format: .csv (Unlimited rows)</p>
                  </div>
                )}
              </label>
            </div>

            <div className="upload-info-box">
              <div className="info-icon"><FileSpreadsheet size={18} /></div>
              <div className="info-content">
                <p>Ensure your CSV matches template fields: Photo, Company Name, Contact Person, Email Address, Category, Phone Number, Second Phone Number, Location, City.</p>
                <a href="#" className="download-template" onClick={(e) => { e.preventDefault(); downloadTemplate(); }}>
                  Download CSV Template
                </a>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px', marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Assign Category to Imported Leads (Optional):
              </label>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface, #11141c)',
                  border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.8125rem'
                }}
              >
                <option value="">Auto-detect from CSV (or Uncategorized)</option>
                {(categories || []).map(c => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {isUploading && (
              <div className="upload-progress-section">
                <div className="progress-header">
                  <span>Processing {file?.name || 'file'}...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-bar-v2">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <div className="modal-footer-v5 mt-6">
              <button className="btn-ghost-v2" onClick={handleClose}>Cancel</button>
              <Button 
                variant="primary" 
                onClick={handleUpload} 
                disabled={!file || isUploading}
                isLoading={isUploading}
              >
                Start Bulk Import
              </Button>
            </div>
          </>
        ) : (
          <div className="import-success-state" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="success-icon-v5" style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '8px' }}>
                <CheckCircle2 size={48} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>Import Process Summary</h3>
              <p className="summary-desc" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Leads processing and validation results.</p>
            </div>
            
            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div className="summary-stat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{importSummary.total}</span>
                <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Leads</span>
              </div>
              <div className="summary-stat success" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10B981' }}>{importSummary.success}</span>
                <span className="stat-label" style={{ fontSize: '0.75rem', color: '#10B981' }}>Imported</span>
              </div>
              <div className="summary-stat failed" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.1rem', fontWeight: '700', color: '#EF4444' }}>{importSummary.failed}</span>
                <span className="stat-label" style={{ fontSize: '0.75rem', color: '#EF4444' }}>Failed</span>
              </div>
            </div>

            {importSummary.failed > 0 && invalidLeads.length > 0 && (
              <div className="interactive-correction-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Resolve Validation Failures
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Correct the invalid numbers in the fields below and click **Import Corrected Leads** to process them.
                  </p>
                </div>

                <div className="corrections-list-container" style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '4px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Row</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', width: '160px' }}>Contact Number</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Error Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invalidLeads.map((lead, idx) => {
                        const cleaned = cleanPhoneNumber(lead.phone);
                        const isPhoneValid = cleaned.startsWith('1') && cleaned.length === 10;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px dashed var(--border)' }}>
                            <td style={{ padding: '6px 8px', fontWeight: '600', color: 'var(--text-muted)' }}>{lead.rowNum}</td>
                            <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{lead.name || 'N/A'}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <input 
                                type="text"
                                value={lead.phone}
                                onChange={(e) => handlePhoneChange(idx, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: isPhoneValid ? '1px solid #10B981' : '1px solid #EF4444',
                                  background: 'var(--background-secondary)',
                                  color: 'var(--text-primary)',
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: '0.75rem'
                                }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', color: '#EF4444', fontSize: '0.75rem' }}>
                              {lead.errorMsg}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <Button 
                    variant="primary" 
                    onClick={handleImportCorrected}
                    disabled={isUploading}
                    isLoading={isUploading}
                    style={{ fontSize: '0.8rem', padding: '8px 14px' }}
                  >
                    Import Corrected Leads
                  </Button>
                </div>
              </div>
            )}

            <div className="modal-footer-v5" style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '4px' }}>
              <Button variant="secondary" className="w-full" onClick={handleClose}>Done & Close</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// NewLeadModal removed as it is now a dedicated page at /leads/add


const statuses = [
  { id: 'Fresh Lead', title: 'Fresh Lead', color: '#3b82f6', icon: <Plus size={16} className="icon-plus" /> },
  { id: 'Follow Up', title: 'Follow Up', color: '#6366f1', icon: <Phone size={16} className="icon-call" /> },
  { id: 'Under Negotiation', title: 'Under Negotiation', color: '#f59e0b', icon: <GitMerge size={16} className="icon-project" /> },
  { id: 'Deal Confirmed', title: 'Deal Confirmed', color: '#10b981', icon: <CheckCircle2 size={16} className="icon-check" /> },
  { id: 'Released', title: 'Move to Junk', color: '#64748b', icon: <Trash2 size={16} className="icon-status" /> }
];

// INITIAL_LEADS removed in favor of Firestore data

const LEAD_STATUSES = [
  { id: 'Fresh Lead', title: 'Fresh Lead', color: '#6366f1' },
  { id: 'Follow Up', title: 'Follow Up', color: '#0ea5e9' },
  { id: 'Under Negotiation', title: 'Under Negotiation', color: '#f59e0b' },
  { id: 'Deal Confirmed', title: 'Deal Confirmed', color: '#10b981' },
  { id: 'Not Responding', title: 'Not Responding', color: '#ef4444' },
  { id: 'Not Interested', title: 'Not Interested', color: '#64748b' },
  { id: 'Junk Lead', title: 'Junk Lead', color: '#78716c' },
];

const renderWhatsAppBadge = (lead, isMini = false) => {
  const statusObj = Array.isArray(lead.whatsapp_lead_status) 
    ? lead.whatsapp_lead_status[0] 
    : lead.whatsapp_lead_status;
  const status = statusObj?.whatsapp_status || (lead.phone_whatsapp ? 'WHATSAPP_AVAILABLE' : 'PENDING');
  
  const baseStyle = isMini ? {
    fontSize: '0.65rem', 
    padding: '1px 4px', 
    borderRadius: '3px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } : {
    fontSize: '0.7rem', 
    padding: '1px 6px', 
    borderRadius: '4px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  if (status === 'WHATSAPP_AVAILABLE') {
    return (
      <span className="wa-verified-badge" title="WhatsApp Verified" style={{ 
        ...baseStyle,
        background: 'rgba(37, 211, 102, 0.15)', 
        color: '#25d366', 
        border: '1px solid rgba(37, 211, 102, 0.3)'
      }}>🟢 WhatsApp Verified</span>
    );
  }

  if (status === 'CHECKING') {
    return (
      <span className="wa-checking-badge" title="Checking WhatsApp Status" style={{ 
        ...baseStyle,
        background: 'rgba(245, 158, 11, 0.15)', 
        color: '#f59e0b', 
        border: '1px solid rgba(245, 158, 11, 0.3)'
      }}>🟡 Checking...</span>
    );
  }

  if (status === 'WHATSAPP_NOT_AVAILABLE') {
    return (
      <span className="wa-not-available-badge" title="Not on WhatsApp" style={{ 
        ...baseStyle,
        background: 'rgba(239, 68, 68, 0.15)', 
        color: '#f87171', 
        border: '1px solid rgba(239, 68, 68, 0.3)'
      }}>🔴 Not on WhatsApp</span>
    );
  }

  if (status === 'CHECK_FAILED' || status === 'INVALID_NUMBER') {
    return (
      <span className="wa-failed-badge" title="Check Failed" style={{ 
        ...baseStyle,
        background: 'rgba(239, 68, 68, 0.15)', 
        color: '#f87171', 
        border: '1px solid rgba(239, 68, 68, 0.3)'
      }}>⚠ Check Failed</span>
    );
  }

  // Default: PENDING / UNVERIFIED
  return (
    <span className="wa-unverified-badge" title="WhatsApp Unverified" style={{ 
      ...baseStyle,
      background: 'rgba(239, 68, 68, 0.1)', 
      color: '#f87171', 
      border: '1px solid rgba(239, 68, 68, 0.2)'
    }}>🔴 WA Unverified</span>
  );
};

const LeadCard = ({ lead, index, onDragStart, onAddUpdate, onAssign, onStatusChange, onEditInterests, onVerifyWhatsApp, onDelete, showAssignment, activeTab, className = '', isSelected = false, onToggleSelect = null }) => {
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const cleanPhone = (lead?.phone || '').replace(/[^\d+]/g, '');

  useEffect(() => {
    const closeDropdown = () => setIsDropdownOpen(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);
  
  return (
    <Card 
      className={`detailed-lead-card draggable ${className}`} 
      draggable 
      onDragStart={(e) => onDragStart && onDragStart(e, lead.id)}
    >
      {/* Integrated top header bar inside card: Serial, Category Tag & Checkbox */}
      {(typeof index === 'number' || onToggleSelect || lead.category) && (
        <div className="card-inner-top-bar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          marginBottom: '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {typeof index === 'number' && (
              <span className="card-serial-number" style={{ 
                fontFamily: "'JetBrains Mono', monospace", 
                fontWeight: '700', 
                color: 'var(--primary)', 
                fontSize: '0.82rem', 
                opacity: 0.9
              }}>
                {(index + 1).toString().padStart(2, '0')}.
              </span>
            )}
            {lead.category && (
              <span className="category-badge-chip" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap' }}>
                📁 {lead.category}
              </span>
            )}
          </div>
          {onToggleSelect && (
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(lead.id);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
          )}
        </div>
      )}

      <div className="card-header" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <div className="lead-header-profile-section" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {/* Profile Picture / Avatar */}
          <div className="lead-card-avatar" style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            flexShrink: 0,
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'var(--primary)'
          }}>
            {lead.image ? (
              <img src={lead.image} alt={lead.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{lead.name ? lead.name[0].toUpperCase() : 'L'}</span>
            )}
          </div>

          {/* Identity details (Name, Designation, Company) */}
          <div className="lead-identity" style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
            <div className="lead-identity-header" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <Link to={`/leads/${lead.id}`} className="lead-name-link" style={{ marginBottom: 0, minWidth: 0, maxWidth: '100%' }}>
                <h4 className="lead-name" style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }} title={lead.name}>{lead.name}</h4>
              </Link>
              {lead.designation && <span className="lead-designation" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{lead.designation}</span>}
            </div>
            {lead.company && (
              <div className="lead-company-info" style={{ marginTop: '2px' }}>
                <Briefcase size={14} className="icon-briefcase" style={{ flexShrink: 0 }} />
                <span className="company-name-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={lead.company}>{lead.company}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="card-body">
        <div className="lead-contact-info">
          {lead.phone && (
            <div className="info-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Phone size={14} className="info-icon icon-phone" style={{ flexShrink: 0 }} />
              <span className="phone-number" style={{ whiteSpace: 'nowrap' }}>{lead.phone?.replace(/^(\+?88)?0?/, '0').replace(/\s+/g, '')}</span>
              {renderWhatsAppBadge(lead, false)}
              <span className="country-flag">{lead.flag}</span>
            </div>
          )}
          {lead.email && (
            <div className="info-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} className="info-icon icon-email" style={{ flexShrink: 0 }} />
              <span className="info-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={lead.email}>{lead.email}</span>
            </div>
          )}
          {lead.location && (
            <div className="info-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} className="info-icon icon-location" style={{ flexShrink: 0 }} />
              <span className="info-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={lead.location}>{lead.location}</span>
            </div>
          )}
          {lead.age && (
            <div className="info-row age-info" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} className="info-icon icon-clock" style={{ flexShrink: 0 }} />
              <span className="info-text age-text" style={{ whiteSpace: 'nowrap' }}>{lead.age}</span>
            </div>
          )}
        </div>
        {lead.history && lead.history.length > 0 && (
          <div 
            className="card-last-note-box"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedHistory(!expandedHistory);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={14} className="note-icon" style={{ flexShrink: 0 }} />
              <div className="note-content" style={{ flex: 1, minWidth: 0 }}>
                <span className="note-label">Last Follow Up Message</span>
                {!expandedHistory && (
                  <p className="note-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }} title={lead.history[lead.history.length - 1].note}>
                    {lead.history[lead.history.length - 1].note}
                  </p>
                )}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, flexShrink: 0 }}>
                {expandedHistory ? 'Collapse' : 'Expand'}
              </span>
            </div>

            {expandedHistory && (
              <div className="history-timeline-expanded" style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                {lead.history.map((hist, hIdx) => (
                  <div key={hIdx} className="timeline-item" style={{ position: 'relative', paddingLeft: '16px', marginBottom: '8px', borderLeft: '1px dashed var(--border)', textAlign: 'left' }}>
                    <div style={{ position: 'absolute', left: '-4px', top: '4px', width: '7px', height: '7px', borderRadius: '50%', background: hist.type === 'Follow-up' ? 'var(--primary)' : '#10b981' }}></div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span>{formatDateTime(hist.date)}</span>
                      {hist.createdBy && <span>By: {hist.createdBy}</span>}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {hist.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-actions-v2">
        <Button 
          variant="primary" 
          icon={MessageSquarePlus} 
          onClick={(e) => { e.stopPropagation(); onAddUpdate(lead); }}
          className="follow-up-btn-v2"
        >
          Follow Up
        </Button>
        <div className="quick-comm-row">
          <a 
            href={`https://wa.me/${cleanPhone}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="comm-btn-v2 whatsapp" 
            onClick={(e) => e.stopPropagation()}
          >
            <WhatsAppIcon size={20} />
          </a>
          <a 
            href={`tel:${cleanPhone}`} 
            className="comm-btn-v2 call" 
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={20} />
          </a>
          <a 
            href={`mailto:${lead.email}`} 
            className="comm-btn-v2 email" 
            onClick={(e) => e.stopPropagation()}
          >
            <Mail size={20} />
          </a>
          <div className="more-actions-wrapper" style={{ display: 'inline-flex', flex: 1, position: 'relative' }}>
            <button 
              className="comm-btn-v2 more-options" 
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
              onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
            >
              <MoreVertical size={20} />
            </button>
            {isDropdownOpen && (
              <div className="status-dropdown-menu" style={{ 
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                top: 'auto',
                right: 0,
                zIndex: 200,
                width: '200px'
              }}>
                <div className="dropdown-header" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change Status</div>
                {LEAD_STATUSES.map(status => (
                  <button 
                    key={status.id}
                    className={`dropdown-item ${lead.status === status.id ? 'current' : ''}`}
                    onClick={() => { if (onStatusChange) onStatusChange(lead, status.id); setIsDropdownOpen(false); }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color, display: 'inline-block', marginRight: '8px', flexShrink: 0 }}></span>
                    {status.title}
                  </button>
                ))}
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button 
                  className="dropdown-item"
                  onClick={() => { if (onAssign) onAssign(lead); setIsDropdownOpen(false); }}
                >
                  <UserPlus size={14} style={{ marginRight: '8px' }} />
                  Transfer Lead
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => { if (onEditInterests) onEditInterests(lead); setIsDropdownOpen(false); }}
                >
                  <Briefcase size={14} style={{ marginRight: '8px' }} />
                  Edit Interests
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => { if (onVerifyWhatsApp) onVerifyWhatsApp(lead); setIsDropdownOpen(false); }}
                >
                  <WhatsAppIcon size={14} style={{ marginRight: '8px' }} />
                  Verify WhatsApp
                </button>
                {onDelete && (
                  <button 
                    className="dropdown-item"
                    onClick={(e) => { e.stopPropagation(); onDelete(lead); setIsDropdownOpen(false); }}
                    style={{ color: '#ef4444', fontWeight: '600' }}
                  >
                    <Trash2 size={14} style={{ marginRight: '8px' }} />
                    Delete Lead
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-footer-meta">
        {lead.history?.length > 0 && (
          <div className="info-row history-info">
            <History size={12} className="info-icon icon-history" />
            <span className="info-text history-text">{lead.history.length} Follow-ups</span>
          </div>
        )}
        {(showAssignment || activeTab === 'assigned') && (lead.assignedToName || lead.assignedByName) && (
          <div className="assigned-info">
            <UserCheck size={12} className="icon-user" />
            <span className="assigned-text">
              {activeTab === 'assigned' && lead.assignedByName ? `By: ${lead.assignedByName}` : lead.assignedToName}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

const KanbanLeadCard = ({ 
  lead, 
  onDragStart, 
  onAddUpdate, 
  onAssign, 
  onStatusChange, 
  onEditInterests, 
  onVerifyWhatsApp, 
  onDelete 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const cleanPhone = (lead?.phone || '').replace(/[^\d+]/g, '');

  useEffect(() => {
    const closeDropdown = () => setIsDropdownOpen(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  return (
    <div 
      className="kanban-flat-pill-card"
      draggable 
      onDragStart={(e) => onDragStart && onDragStart(e, lead.id)}
    >
      {/* Top row: Name & Category badge */}
      <div className="kanban-pill-top">
        <Link 
          to={`/leads/${lead.id}`} 
          className="kanban-pill-name-link"
          title={lead.name}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="kanban-pill-name">{lead.name}</span>
        </Link>
        {lead.category && (
          <span className="category-badge-chip kanban-pill-cat" title={lead.category}>
            📁 {lead.category}
          </span>
        )}
      </div>

      {/* Middle row: Phone Number + WhatsApp Status */}
      <div className="kanban-pill-middle">
        {lead.phone ? (
          <div className="kanban-pill-phone-wrap">
            <Phone size={12} className="kanban-pill-phone-icon" />
            <span className="kanban-pill-phone">
              {lead.phone.replace(/^(\+?88)?0?/, '0').replace(/\s+/g, '')}
            </span>
            {renderWhatsAppBadge(lead, true)}
          </div>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No phone</span>
        )}
      </div>

      {/* Bottom row: The 4 Action Buttons */}
      <div className="kanban-pill-actions">
        <a 
          href={`https://wa.me/${cleanPhone}`} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="kanban-pill-action-btn whatsapp" 
          title="WhatsApp Chat"
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon size={16} />
        </a>
        <a 
          href={`tel:${cleanPhone}`} 
          className="kanban-pill-action-btn call" 
          title="Call Lead"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone size={13} />
        </a>
        <a 
          href={`mailto:${lead.email || ''}`} 
          className="kanban-pill-action-btn email" 
          title="Send Email"
          onClick={(e) => e.stopPropagation()}
        >
          <Mail size={13} />
        </a>
        <div className="kanban-pill-more-wrapper">
          <button 
            type="button"
            className="kanban-pill-action-btn more-options" 
            title="More Options"
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsDropdownOpen(!isDropdownOpen); 
            }}
          >
            <MoreVertical size={14} />
          </button>
          {isDropdownOpen && (
            <div className="status-dropdown-menu" style={{ 
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              top: 'auto',
              right: 0,
              zIndex: 300,
              width: '190px'
            }}>
              <div className="dropdown-header" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change Status</div>
              {LEAD_STATUSES.map(status => (
                <button 
                  key={status.id}
                  className={`dropdown-item ${lead.status === status.id ? 'current' : ''}`}
                  onClick={() => { if (onStatusChange) onStatusChange(lead, status.id); setIsDropdownOpen(false); }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color, display: 'inline-block', marginRight: '8px', flexShrink: 0 }}></span>
                  {status.title}
                </button>
              ))}
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              {onAddUpdate && (
                <button 
                  className="dropdown-item"
                  onClick={() => { onAddUpdate(lead); setIsDropdownOpen(false); }}
                >
                  <MessageSquarePlus size={13} style={{ marginRight: '8px' }} />
                  Follow Up / Log
                </button>
              )}
              {onAssign && (
                <button 
                  className="dropdown-item"
                  onClick={() => { onAssign(lead); setIsDropdownOpen(false); }}
                >
                  <UserPlus size={13} style={{ marginRight: '8px' }} />
                  Transfer Lead
                </button>
              )}
              {onEditInterests && (
                <button 
                  className="dropdown-item"
                  onClick={() => { onEditInterests(lead); setIsDropdownOpen(false); }}
                >
                  <Briefcase size={13} style={{ marginRight: '8px' }} />
                  Edit Interests
                </button>
              )}
              {onVerifyWhatsApp && (
                <button 
                  className="dropdown-item"
                  onClick={() => { onVerifyWhatsApp(lead); setIsDropdownOpen(false); }}
                >
                  <WhatsAppIcon size={13} style={{ marginRight: '8px' }} />
                  Verify WhatsApp
                </button>
              )}
              {onDelete && (
                <button 
                  className="dropdown-item"
                  onClick={(e) => { e.stopPropagation(); onDelete(lead); setIsDropdownOpen(false); }}
                  style={{ color: '#ef4444', fontWeight: '600' }}
                >
                  <Trash2 size={13} style={{ marginRight: '8px' }} />
                  Delete Lead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PortalDropdown = ({ children, triggerRef, onClose }) => {
  const [coords, setCoords] = useState({ top: 0, left: 0, showAbove: false });
  const [isReady, setIsReady] = useState(false);
  const dropdownRef = useRef(null);

  const updatePosition = () => {
    if (!triggerRef || !dropdownRef.current) return;
    const rect = triggerRef.getBoundingClientRect();
    
    const dropdownWidth = dropdownRef.current.offsetWidth || 180;
    const dropdownHeight = dropdownRef.current.offsetHeight || 270;
    
    // Determine whether to show above or below
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    
    // Calculate coordinates
    const top = showAbove 
      ? rect.top - dropdownHeight - 8 
      : rect.bottom + 8;
      
    let left = rect.right - dropdownWidth;
    left = Math.max(8, Math.min(window.innerWidth - dropdownWidth - 8, left));

    setCoords({ top, left, showAbove });
    setIsReady(true);
  };

  useLayoutEffect(() => {
    // Initial positioning
    updatePosition();
    
    // Re-position on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    // Close on click outside
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        triggerRef && !triggerRef.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [triggerRef, onClose]);

  const style = {
    position: 'fixed',
    top: `${coords.top}px`,
    left: `${coords.left}px`,
    margin: 0,
    zIndex: 9999,
    transformOrigin: coords.showAbove ? 'bottom right' : 'top right',
    opacity: isReady ? 1 : 0,
    visibility: isReady ? 'visible' : 'hidden',
    pointerEvents: isReady ? 'auto' : 'none'
  };

  return createPortal(
    <div 
      ref={dropdownRef} 
      style={style} 
      className="portal-dropdown-wrapper"
    >
      {children}
    </div>,
    document.body
  );
};

const ListView = ({ leads, onAddUpdate, onStatusChange, onAssign, onEditInterests, onVerifyWhatsApp, onDelete, showAssignment, activeTab, selectedLeadIds, setSelectedLeadIds }) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const triggerRefs = useRef({});

  const toggleDropdown = (e, leadId) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === leadId ? null : leadId);
  };

  const handleStatusClick = (lead, status) => {
    onStatusChange(lead, status);
    setActiveDropdown(null);
  };

  return (
    <div className="list-view-container">
      <table className="leads-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>
              <input 
                type="checkbox" 
                checked={leads.length > 0 && leads.slice(0, 40).every(l => selectedLeadIds.has(l.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedLeadIds(prev => {
                      const next = new Set(prev);
                      let limitHit = false;
                      for (const l of leads) {
                        if (next.size >= 40) {
                          limitHit = true;
                          break;
                        }
                        next.add(l.id);
                      }
                      if (limitHit || next.size >= 40) {
                        toast.info('Selected 40 leads (maximum limit for WhatsApp campaigns in 24 hours).');
                      }
                      return next;
                    });
                  } else {
                    setSelectedLeadIds(prev => {
                      const next = new Set(prev);
                      leads.forEach(l => next.delete(l.id));
                      return next;
                    });
                  }
                }}
                style={{ cursor: 'pointer' }}
                title="Select up to 40 leads (24h limit)"
              />
            </th>
            <th style={{ minWidth: '240px', whiteSpace: 'nowrap' }}>Lead Name</th>
            <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Status</th>
            <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Company</th>
            <th style={{ minWidth: '240px', whiteSpace: 'nowrap' }}>Contact</th>
            <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Follow-up</th>
            <th style={{ minWidth: '110px', whiteSpace: 'nowrap' }}>Age</th>
            <th style={{ minWidth: '70px', whiteSpace: 'nowrap' }}>History</th>
            <th className="text-right" style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
            <tr key={lead.id}>
              <td style={{ verticalAlign: 'middle' }}>
                <input 
                  type="checkbox" 
                  checked={selectedLeadIds.has(lead.id)} 
                  onChange={() => {
                    setSelectedLeadIds(prev => {
                      const next = new Set(prev);
                      if (next.has(lead.id)) {
                        next.delete(lead.id);
                      } else {
                        if (next.size >= 40) {
                          toast.warning('Maximum 40 leads can be selected per campaign (24-hour limit).');
                          return prev;
                        }
                        next.add(lead.id);
                      }
                      return next;
                    });
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <div className="table-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="serial-number" style={{ marginRight: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{(index + 1).toString().padStart(2, '0')}.</span>
                  <div className="table-avatar" style={{ flexShrink: 0 }}>{lead.name[0]}</div>
                  <div className="name-details" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                      <Link to={`/leads/${lead.id}`} className="table-name-link" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                        <span className="name-text" title={lead.name} style={{ whiteSpace: 'nowrap' }}>{lead.name}</span>
                      </Link>
                      {lead.category && (
                        <span className="category-badge-chip" title={`Category: ${lead.category}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                          📁 {lead.category}
                        </span>
                      )}
                    </div>
                    {(showAssignment || activeTab === 'assigned') && (lead.assignedToName || lead.assignedByName) && (
                      <div className="assigned-to-link table-link" style={{ whiteSpace: 'nowrap' }}>
                        <Link2 size={10} />
                        <span>
                          {activeTab === 'assigned' && lead.assignedByName ? `Assigned by: ${lead.assignedByName}` : lead.assignedToName}
                        </span>
                      </div>
                    )}
                    {lead.history && lead.history.length > 0 && (
                      <div className="last-followup-subtext" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                        <MessageCircle size={10} style={{ flexShrink: 0 }} />
                        <span className="truncate-text" title={lead.history[lead.history.length - 1].note} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Last: {lead.history[lead.history.length - 1].note}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <span className={`table-status-pill ${lead.status.toLowerCase().replace(/ /g, '-')}`} style={{ whiteSpace: 'nowrap' }}>
                  {lead.status}
                </span>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <div className="table-company-cell" style={{ whiteSpace: 'nowrap' }}>
                  <span className="company-name" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={lead.company}>{lead.company || '-'}</span>
                  {lead.designation && <span className="designation-text" style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{lead.designation}</span>}
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <div className="table-contact-cell" style={{ minWidth: '220px' }}>
                  {lead.phone && (
                    <div className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
                      <Phone size={12} className="contact-icon" style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', fontWeight: '500', wordBreak: 'keep-all' }}>{lead.phone?.replace(/^(\+?88)?0?/, '0').replace(/\s+/g, '')}</span>
                      {renderWhatsAppBadge(lead, true)}
                    </div>
                  )}
                  {lead.email && (
                    <div className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
                      <Mail size={12} className="contact-icon" style={{ flexShrink: 0 }} />
                      <span className="email-text" style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{lead.email}</span>
                    </div>
                  )}
                  {(lead.address || lead.area || lead.location) && (
                    <div className="contact-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <MapPin size={12} className="contact-icon" style={{ flexShrink: 0 }} />
                      <span className="address-text" style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }} title={lead.address || [lead.location, lead.city].filter(Boolean).join(', ') || lead.location || ''}>
                        {lead.address || [lead.location, lead.city].filter(Boolean).join(', ') || lead.location || ''}
                      </span>
                    </div>
                  )}
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <div className="table-date-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Calendar size={14} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>{formatDateToDDMMYYYY(lead.nextFollowUp)}</span>
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <span className="age-badge" style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>{lead.age}</span>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <div className="table-history-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <History size={14} />
                  <span>{lead.history?.length || 0}</span>
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <div className="table-actions-container" style={{ whiteSpace: 'nowrap' }}>
                  <div className="table-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
                    <button 
                      className="table-action-btn follow-up" 
                      onClick={() => onAddUpdate(lead)}
                      title="New Follow Up"
                    >
                      <Plus size={18} />
                    </button>
                    
                    <a 
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="table-action-btn whatsapp icon-whatsapp" 
                      title="WhatsApp"
                    >
                      <WhatsAppIcon size={18} />
                    </a>
                    
                    <a 
                      href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} 
                      className="table-action-btn call icon-call" 
                      title="Call"
                    >
                      <Phone size={18} />
                    </a>
                    
                    <a 
                      href={`mailto:${lead.email}`} 
                      className="table-action-btn email icon-email" 
                      title="Email"
                    >
                      <Mail size={18} />
                    </a>

                    <div className="more-actions-wrapper">
                      <button 
                         ref={el => triggerRefs.current[lead.id] = el}
                         className={`table-action-btn more ${activeDropdown === lead.id ? 'active' : ''}`}
                         onClick={(e) => toggleDropdown(e, lead.id)}
                       >
                         <MoreVertical size={18} />
                       </button>
                       
                       {activeDropdown === lead.id && (
                         <PortalDropdown
                           triggerRef={triggerRefs.current[lead.id]}
                           onClose={() => setActiveDropdown(null)}
                         >
                           <div className="status-dropdown-menu" style={{ position: 'static', margin: 0 }}>
                             <div className="dropdown-header">Change Status</div>
                             {statuses.map(status => (
                               <button 
                                 key={status.id}
                                 className={`dropdown-item ${lead.status === status.id ? 'current' : ''}`}
                                 onClick={() => handleStatusClick(lead, status.id)}
                               >
                                 <span className="status-dot" style={{ backgroundColor: status.color }}></span>
                                 {status.title}
                               </button>
                             ))}
                             <div className="dropdown-divider" style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}></div>
                             <button 
                               className="dropdown-item"
                               onClick={() => { onAssign(lead); setActiveDropdown(null); }}
                               style={{ color: 'var(--primary)', fontWeight: '600' }}
                             >
                               <UserPlus size={14} style={{ marginRight: '8px' }} />
                               Assign Lead
                             </button>
                             <button 
                               className="dropdown-item"
                               onClick={() => { onEditInterests(lead); setActiveDropdown(null); }}
                               style={{ color: 'var(--primary)', fontWeight: '600' }}
                             >
                               <Briefcase size={14} style={{ marginRight: '8px' }} />
                               Edit Interests
                             </button>
                             <button 
                               className="dropdown-item"
                               onClick={() => { onVerifyWhatsApp(lead); setActiveDropdown(null); }}
                               style={{ color: 'var(--primary)', fontWeight: '600' }}
                             >
                               <WhatsAppIcon size={14} style={{ marginRight: '8px' }} />
                               Verify WhatsApp
                             </button>
                             {onDelete && (
                               <button 
                                 className="dropdown-item"
                                 onClick={() => { onDelete(lead); setActiveDropdown(null); }}
                                 style={{ color: '#ef4444', fontWeight: '600' }}
                               >
                                 <Trash2 size={14} style={{ marginRight: '8px' }} />
                                 Delete Lead
                               </button>
                             )}
                           </div>
                         </PortalDropdown>
                       )}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GridView = ({ leads, onAddUpdate, onAssign, onStatusChange, onEditInterests, onVerifyWhatsApp, onDelete, showAssignment, activeTab, selectedLeadIds, setSelectedLeadIds }) => {
  const handleToggleSelect = (leadId) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        if (next.size >= 40) {
          toast.warning('Maximum 40 leads can be selected per campaign (24-hour limit).');
          return prev;
        }
        next.add(leadId);
      }
      return next;
    });
  };

  return (
    <div className="leads-grid-view">
      {leads.map((lead, index) => (
        <LeadCard 
          key={lead.id} 
          lead={lead} 
          index={index} 
          isSelected={selectedLeadIds.has(lead.id)}
          onToggleSelect={handleToggleSelect}
          onDragStart={() => {}} 
          onAddUpdate={onAddUpdate}
          onAssign={onAssign}
          onStatusChange={onStatusChange}
          onEditInterests={onEditInterests}
          onVerifyWhatsApp={onVerifyWhatsApp}
          onDelete={onDelete}
          showAssignment={showAssignment}
          activeTab={activeTab}
        />
      ))}
    </div>
  );
};

const LeadUpdateModal = ({ isOpen, onClose, lead, newStatus, onConfirm }) => {
  const [note, setNote] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [priority, setPriority] = useState('Normal');
  
  // New features
  const { user } = useAuth();
  const [isAppointment, setIsAppointment] = useState(false);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (lead && isOpen) {
      setNote('');
      setNextFollowUp(lead.next_follow_up_date || lead.next_follow_up || lead.nextFollowUpDate || '');
      setPriority(lead.priority || 'Normal');
      setSelectedProjects(lead.interests || []);
      setIsAppointment(false);
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentLocation('');
    }
  }, [lead, isOpen]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: teamsData } = await supabase.from('teams').select('*');
        setTeams(teamsData || []);
        const { data: projectsData } = await supabase.from('projects').select('*');
        if (projectsData) {
          const sorted = [...projectsData].sort((a, b) => 
            (a.projectName || a.project_name || a.name || '').localeCompare(b.projectName || b.project_name || b.name || '')
          );
          setAllProjects(sorted);
        }
      } catch (err) {
        console.error('Error fetching projects in MyLeads:', err);
      }
    };
    fetchData();
  }, []);

  const filteredProjects = React.useMemo(() => {
    const isAdmin = user?.account_type === 'super_admin' || user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
    if (isAdmin) return allProjects;

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
      return allProjects.filter(p => assignedProjects.includes(p.projectName || p.project_name || p.name));
    }

    return allProjects;
  }, [allProjects, user, teams]);

  const toggleProject = (projectName) => {
    setSelectedProjects(prev => 
      prev.includes(projectName) 
        ? prev.filter(p => p !== projectName)
        : [...prev, projectName]
    );
  };

  if (!lead) return null;

  const isFollowUpOnly = lead.status === newStatus;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isFollowUpOnly ? 'Add Follow-up Entry' : `Update Status: ${newStatus === 'Released' ? 'Move to Junk' : newStatus}`}
      className="glass-modal"
    >
      <div className="status-update-form">
        <div className="update-target-info" style={{ padding: '8px 12px', gap: '8px', borderRadius: '12px', marginBottom: '4px' }}>
          <div className="target-avatar" style={{ width: '32px', height: '32px', fontSize: '0.875rem', borderRadius: '8px' }}>{lead.name[0]}</div>
          <div>
            <p className="target-name" style={{ fontSize: '0.875rem', lineHeight: '1.2' }}>{lead.name}</p>
            <p className="target-status">
              {isFollowUpOnly ? (
                <>Logging additional <strong>Follow-up</strong></>
              ) : (
                <>Moving from <strong>{lead.status === 'Released' ? 'Junk Lead' : lead.status}</strong> to <strong>{newStatus === 'Released' ? 'Move to Junk' : newStatus}</strong></>
              )}
            </p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Follow-up Note / Message</label>
          <div className="textarea-wrapper">
            <textarea 
              placeholder="What happened in this follow-up?" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="custom-textarea"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Next Follow-up Date</label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input 
                type="date" 
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="custom-input-field"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Set Priority</label>
            <div className="priority-select-wrapper">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="custom-select-field"
              >
                <option value="Normal">Normal</option>
                <option value="High Priority">High Priority</option>
                <option value="Urgent">Urgent</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clients Interests Section */}
        {filteredProjects && filteredProjects.length > 0 && (
          <div className="form-group mt-4">
            <label className="form-label">
              Clients Interests (Projects) <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <div className="interests-selection-grid">
              {filteredProjects.map(project => {
                const pName = project.projectName || project.project_name || project.name;
                return (
                  <div 
                    key={project.id || pName}
                    className={`interest-checkbox-card ${selectedProjects.includes(pName) ? 'selected' : ''}`}
                    onClick={() => toggleProject(pName)}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedProjects.includes(pName)}
                      onChange={() => {}} // Handled by card click
                    />
                    <span>{pName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Site Visit Section */}
        <div className="form-group mt-4">
          <div className="appointment-toggle-section">
            <label className="toggle-v3">
              <input 
                type="checkbox" 
                checked={isAppointment}
                onChange={(e) => setIsAppointment(e.target.checked)}
              />
              <div className="slider"></div>
              <span className="toggle-label">Schedule Appointment / Site Visit</span>
            </label>
          </div>

          {isAppointment && (
            <div className="appointment-details-grid mt-4">
              <div className="form-group">
                <label className="form-label">Visit Date</label>
                <input 
                  type="date" 
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="custom-input-field"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Visit Time</label>
                <input 
                  type="time" 
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="custom-input-field"
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Visit Location / Plot No.</label>
                <input 
                  type="text" 
                  placeholder="e.g. Plot 45, Sector 12" 
                  value={appointmentLocation}
                  onChange={(e) => setAppointmentLocation(e.target.value)}
                  className="custom-input-field"
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm({ 
            note, 
            appointmentDate, 
            appointmentTime,
            appointmentLocation,
            isAppointment,
            nextFollowUp, 
            priority,
            interests: selectedProjects
          })}>Save Update</Button>
        </div>
      </div>
    </Modal>
  );
};

const AssignLeadModal = ({ isOpen, onClose, lead, teamUsers, onConfirm }) => {
  const [assigneeId, setAssigneeId] = useState('');
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    if (lead) {
      setAssigneeId(lead.assignedTo || '');
      setInstruction('');
    }
  }, [lead, isOpen]);

  if (!lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Lead: ${lead.name}`} className="glass-modal">
      <div className="assign-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>Assign to Team Member</label>
          <select 
            value={assigneeId} 
            onChange={(e) => setAssigneeId(e.target.value)}
            className="form-select"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="">Select User</option>
            {teamUsers.map(u => (
              <option key={u.id} value={u.uid}>{u.fullName || u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>Instruction</label>
          <textarea 
            value={instruction} 
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Enter instructions for the team member..."
            className="form-textarea"
            rows={4}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background-secondary)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(assigneeId, instruction)}>Assign Lead</Button>
        </div>
      </div>
    </Modal>
  );
};


const InterestsModal = ({ isOpen, onClose, lead, onConfirm, projects }) => {
  const [selectedProjects, setSelectedProjects] = useState([]);

  useEffect(() => {
    if (lead) {
      setSelectedProjects(lead.interests || []);
    }
  }, [lead, isOpen]);

  const toggleProject = (projectName) => {
    setSelectedProjects(prev => 
      prev.includes(projectName)
        ? prev.filter(p => p !== projectName)
        : [...prev, projectName]
    );
  };

  if (!lead) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit Interests: ${lead.name}`}
      className="glass-modal"
    >
      <div className="status-update-form">
        <div className="form-group">
          <label className="form-label" style={{ display: 'block', marginBottom: '12px', fontSize: '0.875rem', fontWeight: '600' }}>
            Select Interested Projects (Select multiple)
          </label>
          <div className="interests-selection-grid">
            {projects.map(project => (
              <div 
                key={project.id}
                className={`interest-checkbox-card ${selectedProjects.includes(project.projectName) ? 'selected' : ''}`}
                onClick={() => toggleProject(project.projectName)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedProjects.includes(project.projectName)}
                  onChange={() => {}} 
                />
                <span>{project.projectName}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="no-projects-hint">No active projects found</div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(selectedProjects)}>Save Interests</Button>
        </div>
      </div>
    </Modal>
  );
};


const WaCampaignCreateModal = ({ selectedCount, onSave, onClose }) => {
  const [sessions, setSessions]   = useState([])
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({
    name: '', session_id: '', template_id: '',
    daily_limit: 40, min_delay_seconds: 10, max_delay_seconds: 25,
    consent_confirmed: false
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      waSessions.list().catch(() => ({ sessions: [] })),
      waTemplates.list().catch(() => ({ templates: [] }))
    ]).then(([s, t]) => {
      setSessions((s.sessions || []).filter(ses => ses.status === 'CONNECTED' || ses.live_status === 'CONNECTED'))
      setTemplates(t.templates || [])
    })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.consent_confirmed) return alert('You must confirm consent to proceed.')
    if (selectedCount > 40) return alert('Maximum 40 leads can be selected per campaign (24-hour limit).')
    setSaving(true)
    try { await onSave({ ...form, daily_limit: 40 }) } finally { setSaving(false) }
  }

  return (
    <div className="wa-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="wa-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <span className="wa-modal-title">Create WhatsApp Campaign ({selectedCount} leads selected)</span>
          <button className="wa-btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="wa-form">
          <div className="wa-form-group">
            <label className="wa-form-label">Campaign Name *</label>
            <input className="wa-form-input" placeholder="e.g. Selected Leads Campaign" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="wa-form-group">
            <label className="wa-form-label">WhatsApp Session *</label>
            <select className="wa-form-select" value={form.session_id} onChange={e => set('session_id', e.target.value)} required>
              <option value="">Select connected session…</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name} — {s.phone_number}</option>)}
            </select>
            {sessions.length === 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>No connected sessions. Please connect a session first.</span>}
          </div>
          <div className="wa-form-group">
            <label className="wa-form-label">Message Template *</label>
            <select className="wa-form-select" value={form.template_id} onChange={e => set('template_id', e.target.value)} required>
              <option value="">Select template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="wa-form-group">
              <label className="wa-form-label">24h Message Limit</label>
              <input className="wa-form-input" type="number" value={40} disabled style={{ opacity: 0.85, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ fontSize: '0.7rem', color: '#25d366' }}>Fixed: 40 msgs / 24h per user</span>
            </div>
            <div className="wa-form-group">
              <label className="wa-form-label">Min Delay (sec)</label>
              <input className="wa-form-input" type="number" min={8} value={form.min_delay_seconds} onChange={e => set('min_delay_seconds', e.target.value)} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Min 8s enforced</span>
            </div>
            <div className="wa-form-group">
              <label className="wa-form-label">Max Delay (sec)</label>
              <input className="wa-form-input" type="number" min={10} value={form.max_delay_seconds} onChange={e => set('max_delay_seconds', e.target.value)} />
            </div>
          </div>

          <div className="wa-info-box wa-info-box-yellow" style={{ fontSize: '0.8rem' }}>
            <AlertIcon size={14} />
            <div>
              <strong>Consent Requirement:</strong> Only message leads who have given explicit permission to receive WhatsApp messages from your organization. Sending unsolicited messages may violate WhatsApp's Terms of Service.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" id="consent" checked={form.consent_confirmed} onChange={e => set('consent_confirmed', e.target.checked)} style={{ marginTop: 3 }} />
            <label htmlFor="consent" style={{ fontSize: '0.83rem', color: 'var(--text-primary, #f3f4f6)', cursor: 'pointer' }}>
              I confirm that all selected leads have given consent to receive WhatsApp messages from our organization.
            </label>
          </div>

          <div className="wa-modal-footer">
            <button type="button" className="wa-btn wa-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={saving || !form.consent_confirmed || !form.session_id || !form.template_id}>
              {saving ? <span className="wa-spinner" /> : <Plus size={16} />}
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


const MyLeads = () => {
  const { user, currentTenant, hasPermission } = useAuth();
  const { userId } = useParams();
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'grid' : 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [updateModal, setUpdateModal] = useState({
    isOpen: false,
    lead: null,
    newStatus: ''
  });
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    lead: null
  });
  const [interestsModal, setInterestsModal] = useState({
    isOpen: false,
    lead: null
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState(userId ? 'team' : 'personal'); // 'personal' or 'team'
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedWhatsAppStatus, setSelectedWhatsAppStatus] = useState('All');
  const [selectedProject, setSelectedProject] = useState('All');
  const [allProjects, setAllProjects] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [showWaCampaignModal, setShowWaCampaignModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    leadIds: [],
    leadName: '',
    isBulk: false
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSingleDelete = (lead) => {
    setDeleteModal({
      isOpen: true,
      leadIds: [lead.id],
      leadName: lead.name,
      isBulk: false
    });
  };

  const handleBulkDelete = () => {
    if (selectedLeadIds.size === 0) return;
    setDeleteModal({
      isOpen: true,
      leadIds: Array.from(selectedLeadIds),
      leadName: '',
      isBulk: true
    });
  };

  const confirmDeleteLeads = async () => {
    if (!deleteModal.leadIds || deleteModal.leadIds.length === 0) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', deleteModal.leadIds);

      if (error) {
        console.error('Error deleting lead(s):', error);
        toast.error(error.message || 'Failed to delete lead(s)');
      } else {
        toast.success(
          deleteModal.isBulk
            ? `Successfully deleted ${deleteModal.leadIds.length} lead(s).`
            : `Successfully deleted lead "${deleteModal.leadName}".`
        );
        setSelectedLeadIds(new Set());
        setDeleteModal({ isOpen: false, leadIds: [], leadName: '', isBulk: false });
        fetchLeads();
      }
    } catch (err) {
      console.error('Error deleting lead(s):', err);
      toast.error('An error occurred while deleting lead(s).');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    setSelectedLeadIds(new Set());
  }, [activeTab, statusFilter, searchTerm, selectedPriority, selectedWhatsAppStatus, selectedProject, currentPage]);

  useEffect(() => {
    const fetchProjectsList = async () => {
      try {
        const { data } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
        setAllProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects in MyLeads:', err);
      }
    };
    fetchProjectsList();
  }, []);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    fetchLeadCategories().then(cats => setCategories(cats || []));
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    setIsCreatingCategory(true);
    try {
      const isSA = user?.account_type === 'super_admin';
      const resolvedOrgId = (isSA && currentTenant?.type === 'org') ? currentTenant.id : (user?.org_id || null);
      const resolvedOwnerId = (isSA && currentTenant?.type === 'individual') ? currentTenant.id : (user?.uid || user?.id);

      const created = await createLeadCategory({
        name: newCategoryName.trim(),
        color: newCategoryColor,
        description: newCategoryDesc,
        org_id: resolvedOrgId,
        owner_id: resolvedOwnerId
      });

      setCategories(prev => {
        const filtered = prev.filter(c => c.name.toLowerCase() !== created.name.toLowerCase());
        return [...filtered, created];
      });

      toast.success(`Category "${created.name}" created!`);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNewCategoryColor('#3B82F6');
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Error creating category:', err);
      toast.error('Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (e, cat) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await deleteLeadCategory(cat.id, cat.name);
      setCategories(prev => prev.filter(c => c.name !== cat.name && c.id !== cat.id));
      if (selectedCategory === cat.name) {
        setSelectedCategory(null);
      }
      toast.success(`Category "${cat.name}" deleted.`);
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('Failed to delete category');
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('*');
      setTeams(data || []);
    };
    fetchTeams();
  }, [user]);

  const filteredProjects = React.useMemo(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
    if (isAdmin) return allProjects;

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
      return allProjects.filter(p => assignedProjects.includes(p.projectName));
    }

    return allProjects;
  }, [allProjects, user, teams]);

  const itemsPerPage = 12; // 3x4 grid or 12 list items

  const getSubordinateUids = (allUsers, currentUserId) => {
    const foundUser = allUsers.find(u => u.id === currentUserId || u.uid === currentUserId);
    if (!foundUser) return [currentUserId];
    
    const currentName = foundUser.fullName || foundUser.name;
    let subUids = [currentUserId];
    
    // Find users who report to this user
    const directSubs = allUsers.filter(u => u.reportsTo === currentName && u.id !== currentUserId);
    
    for (const sub of directSubs) {
      const descendants = getSubordinateUids(allUsers, sub.id);
      subUids = [...subUids, ...descendants];
    }
    
    return Array.from(new Set(subUids));
  };

  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*');
      setAllUsers(data || []);
    };
    fetchUsers();
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!user || allUsers.length === 0) return;

    const isAdmin = user.role === 'Admin' || user.role === 'MD' || user.role === 'System Admin' || user.account_type === 'super_admin';

    let query = supabase.from('leads').select('*').neq('status', 'Released');

    // Tenant isolation filter
    const currentUserId = user.uid || user.id;
    if (user.account_type === 'super_admin') {
      if (currentTenant?.type === 'org') {
        query = query.or(`org_id.eq.${currentTenant.id},and(org_id.is.null,owner_id.eq.${currentUserId})`);
      } else if (currentTenant?.type === 'individual') {
        query = query.eq('owner_id', currentTenant.id);
      }
    } else {
      if (user.org_id) {
        query = query.or(`org_id.eq.${user.org_id},and(org_id.is.null,owner_id.eq.${currentUserId})`);
      } else {
        query = query.eq('owner_id', currentUserId);
      }
    }

    if (!isAdmin) {
      const currentUserName = user.full_name || user.fullName || user.name || '';
      const managedTeams = teams.filter(t => {
        const leads = t.team_leads || t.teamLeads || (t.team_lead ? [t.team_lead] : []);
        return leads.includes(currentUserName);
      });
      const teamMemberNames = new Set();
      managedTeams.forEach(t => { if (t.members) t.members.forEach(m => teamMemberNames.add(m)); });
      const teamMemberUids = allUsers.filter(u => teamMemberNames.has(u.full_name || u.fullName || u.name)).map(u => u.uid || u.id).filter(Boolean);
      const allowedUids = Array.from(new Set([
        user.uid || user.id,
        ...allUsers.filter(u => (u.reports_to || u.reportsTo) === currentUserName).map(u => u.uid || u.id).filter(Boolean),
        ...teamMemberUids
      ]));
      query = query.or(`assigned_to.in.(${allowedUids.join(',')}),owner_id.in.(${allowedUids.join(',')})`);
    }

    const { data, error } = await query;
    if (error) { console.error('Error fetching leads:', error); setIsLoading(false); return; }

    // Fetch whatsapp statuses in a separate query to bypass the missing foreign key relationship cache constraint
    let whatsappStatusMap = {};
    if (data && data.length > 0) {
      try {
        const leadIds = data.map(l => l.id);
        const { data: statusData, error: statusErr } = await supabase
          .from('whatsapp_lead_status')
          .select('lead_id, whatsapp_status, check_error, last_checked_at')
          .in('lead_id', leadIds);
        
        if (!statusErr && statusData) {
          statusData.forEach(row => {
            whatsappStatusMap[row.lead_id] = row;
          });
        }
      } catch (e) {
        console.error('Error fetching whatsapp lead statuses:', e);
      }
    }

    let leadsList = (data || []).map(row => ({
      ...row,
      category: row.category || (Array.isArray(row.history) && row.history.find(h => h.category)?.category) || '',
      ownerId: row.owner_id,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      phoneWhatsapp: row.phone_whatsapp,
      secondPhoneWhatsapp: row.second_phone_whatsapp,
      nextFollowUp: row.next_follow_up,
      nextFollowUpDate: row.next_follow_up_date,
      whatsapp_lead_status: whatsappStatusMap[row.id] || null,
      age: row.created_at ? formatDateToDDMMYYYY(row.created_at) : 'Just now'
    }));

    leadsList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setLeads(leadsList);
    setIsLoading(false);
  }, [user, allUsers, currentTenant, teams]);

  useEffect(() => {
    fetchLeads();
    const ch = supabase.channel('myleads-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_lead_status' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
  }, [fetchLeads]);

  const handleDragStart = (e, leadId) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('leadId', leadId);
    e.target.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId') || draggedLeadId;
    const lead = leads.find(l => l.id === leadId);
    
    if (lead && lead.status !== newStatus) {
      setUpdateModal({
        isOpen: true,
        lead: lead,
        newStatus: newStatus
      });
    }
    setDraggedLeadId(null);
  };

  const handleAddUpdate = (lead) => {
    setUpdateModal({
      isOpen: true,
      lead: lead,
      newStatus: lead.status
    });
  };

  // handleSaveNewLead removed as it is now handled in /leads/add page


  const confirmStatusUpdate = async (data) => {
    try {
      const now = new Date();
      const historyEntry = {
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: data.note?.trim() || (data.nextFollowUp ? `Follow-up scheduled for ${data.nextFollowUp}` : 'Follow-up recorded'),
        appointment: data.appointmentDate,
        nextFollowUp: data.nextFollowUp || null,
        priority: data.priority || 'Normal',
        interests: data.interests || [],
        type: updateModal.lead.status === updateModal.newStatus ? (data.isAppointment ? 'Appointment' : 'Follow-up') : 'Status Change',
        createdBy: user?.full_name || user?.fullName || user?.name || 'User'
      };

      const newHistory = [
        ...(updateModal.lead.history || []),
        historyEntry
      ];

      const targetNextDate = data.nextFollowUp ? data.nextFollowUp : (updateModal.lead.next_follow_up_date || updateModal.lead.next_follow_up || null);

      const updatePayload = {
        status: updateModal.lead.status === 'Fresh Lead' ? 'Follow Up' : updateModal.newStatus,
        history: newHistory,
        updated_at: new Date().toISOString(),
        next_follow_up_date: targetNextDate,
        next_follow_up: targetNextDate,
        priority: data.priority || updateModal.lead.priority || 'Normal',
        interests: data.interests || updateModal.lead.interests || []
      };

      if (data.isAppointment) {
        updatePayload.visit_date = data.appointmentDate;
        updatePayload.visit_time = data.appointmentTime;
        updatePayload.visit_location = data.appointmentLocation;
        updatePayload.visit_status = 'Confirmed';
      }

      let { error: updateError } = await supabase.from('leads').update(updatePayload).eq('id', updateModal.lead.id);
      if (updateError && (updateError.message?.includes('interests') || updateError.code === 'PGRST204')) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.interests;
        const retry = await supabase.from('leads').update(fallbackPayload).eq('id', updateModal.lead.id);
        updateError = retry.error;
      }
      if (updateError) {
        console.error('Error updating lead status in Supabase:', updateError);
        alert('Failed to update lead: ' + updateError.message);
        return;
      }

      setLeads(prev => prev.map(l => l.id === updateModal.lead.id ? { ...l, ...updatePayload, history: newHistory } : l));
      setUpdateModal({ isOpen: false, lead: null, newStatus: '' });
    } catch (error) {
      console.error('Error updating lead status:', error);
      alert('Error updating lead: ' + (error.message || error));
    }
  };

  const handleAssignConfirm = async (assigneeId, instruction) => {
    if (!assignModal.lead || !assigneeId) return;

    try {
      const lead = assignModal.lead;
      const assignedUser = allUsers.find(u => u.uid === assigneeId || u.id === assigneeId);
      const assignedToName = assignedUser ? (assignedUser.full_name || assignedUser.fullName || assignedUser.name) : 'Unassigned';

      const historyRecord = {
        date: new Date().toISOString(),
        note: `Lead assigned to ${assignedToName} by ${user.full_name || user.fullName || user.name}.${instruction ? ` Instruction: ${instruction}` : ''}`,
        type: 'Assignment',
        createdBy: user.full_name || user.fullName || user.name
      };

      const newHistory = [...(lead.history || []), historyRecord];

      const updatePayload = {
        assigned_to: assigneeId,
        assigned_to_name: assignedToName,
        last_assigned_at: new Date().toISOString(),
        history: newHistory,
        assigned_by_name: user.full_name || user.fullName || user.name
      };
      if (!lead.owner_id && !lead.ownerId) updatePayload.owner_id = user.uid || user.id;

      await supabase.from('leads').update(updatePayload).eq('id', lead.id);

      await supabase.from('notifications').insert({
        user_id: assigneeId,
        title: 'New Lead Assigned',
        message: `${user.full_name || user.fullName || user.name} assigned you a lead: ${lead.name}.${instruction ? ` \nInstruction: ${instruction}` : ''}`,
        type: 'assignment',
        lead_id: lead.id,
        is_read: false,
        created_at: new Date().toISOString()
      });

      if (assignedUser && assignedUser.email) {
        const shouldSendEmail = assignedUser.notification_settings?.mail_alerts?.lead_assigned !== false &&
          assignedUser.notificationSettings?.mailAlerts?.leadAssigned !== false;
        if (shouldSendEmail) {
          await sendLeadAssignmentEmail(
            assignedUser.email,
            assignedToName,
            user.full_name || user.fullName || user.name,
            lead.name,
            instruction
          );
        }
      }

      setAssignModal({ isOpen: false, lead: null });
    } catch (error) {
      console.error('Error assigning lead:', error);
    }
  };

  const handleSaveInterests = async (selectedProjects) => {
    if (!interestsModal.lead) return;
    try {
      await supabase.from('leads').update({
        interests: selectedProjects,
        updated_at: new Date().toISOString()
      }).eq('id', interestsModal.lead.id);
      setInterestsModal({ isOpen: false, lead: null });
    } catch (error) {
      console.error("Error saving lead interests:", error);
    }
  };



  const isAdmin = user ? (user.role === 'Admin' || user.role === 'MD' || user.role === 'System Admin') : false;
  const isManager = user ? (
    allUsers.some(u => u.reportsTo === (user.fullName || user.name)) ||
    teams.some(t => {
      const leads = t.teamLeads || (t.teamLead ? [t.teamLead] : []);
      return leads.includes(user.fullName || user.name);
    })
  ) : false;
  const showTeamTab = isAdmin || isManager;

  const categoryStats = React.useMemo(() => {
    const currentUserId = user?.uid || user?.id;
    const tabLeads = !user ? [] : leads.filter(l => {
      if (userId) return l.assignedTo === userId;
      if (activeTab === 'personal') return l.ownerId === currentUserId || (!l.ownerId && l.assignedTo === currentUserId);
      if (activeTab === 'assigned') return l.assignedTo === currentUserId && l.ownerId && l.ownerId !== currentUserId;
      return l.ownerId !== currentUserId && l.assignedTo !== currentUserId;
    });

    const stats = {};
    (categories || []).forEach(cat => {
      const catLeads = tabLeads.filter(l => (l.category || '').toLowerCase() === cat.name.toLowerCase());
      stats[cat.name] = {
        total: catLeads.length,
        fresh: catLeads.filter(l => l.status === 'Fresh Lead').length,
        followup: catLeads.filter(l => l.status === 'Follow Up').length,
        deals: catLeads.filter(l => l.status === 'Deal Confirmed' || l.status === 'Under Negotiation').length
      };
    });

    const uncategorizedLeads = tabLeads.filter(l => !l.category || l.category.trim() === '');
    stats['UNCATEGORIZED'] = {
      total: uncategorizedLeads.length,
      fresh: uncategorizedLeads.filter(l => l.status === 'Fresh Lead').length,
      followup: uncategorizedLeads.filter(l => l.status === 'Follow Up').length,
      deals: uncategorizedLeads.filter(l => l.status === 'Deal Confirmed' || l.status === 'Under Negotiation').length
    };

    stats['ALL'] = {
      total: tabLeads.length,
      fresh: tabLeads.filter(l => l.status === 'Fresh Lead').length,
      followup: tabLeads.filter(l => l.status === 'Follow Up').length,
      deals: tabLeads.filter(l => l.status === 'Deal Confirmed' || l.status === 'Under Negotiation').length
    };

    return stats;
  }, [leads, categories, user, activeTab, userId]);

  const filteredLeads = !user ? [] : leads
    .map(l => {
      const assignedUser = allUsers.find(u => u.id === l.assignedTo || u.uid === l.assignedTo);
      return {
        ...l,
        assignedToName: assignedUser
          ? (assignedUser.full_name || assignedUser.fullName || assignedUser.name || 'Unassigned')
          : (l.assignedToName || l.assigned_to_name || 'Unassigned')
      };
    })
    .filter(l => {
      if (selectedCategory && selectedCategory !== 'ALL') {
        if (selectedCategory === 'UNCATEGORIZED') {
          if (l.category && l.category.trim() !== '') return false;
        } else {
          if ((l.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
      }

      const matchesSearch = (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (l.phone || '').includes(searchTerm) ||
                           (l.company || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
      if (!matchesStatus) return false;

      const matchesPriority = selectedPriority === 'All' || (l.priority || 'Normal') === selectedPriority;
      const matchesProject = selectedProject === 'All' || l.company === selectedProject;
      if (!matchesPriority || !matchesProject) return false;

      const matchesWhatsApp = selectedWhatsAppStatus === 'All' || 
        (selectedWhatsAppStatus === 'Verified' && (l.phone_whatsapp || l.phoneWhatsapp)) ||
        (selectedWhatsAppStatus === 'Unverified' && !(l.phone_whatsapp || l.phoneWhatsapp));
      if (!matchesWhatsApp) return false;

      const currentUserId = user.uid || user.id;

      if (userId) {
        return matchesSearch && l.assignedTo === userId;
      }
      
      if (activeTab === 'personal') {
        // My own leads: I am the owner OR it has no owner but is assigned to me
        return matchesSearch && (l.ownerId === currentUserId || (!l.ownerId && l.assignedTo === currentUserId));
      } else if (activeTab === 'assigned') {
        // Assigned to me: I am assigned but I am NOT the owner
        return matchesSearch && l.assignedTo === currentUserId && l.ownerId && l.ownerId !== currentUserId;
      } else {
        // Team leads: Owned or assigned to someone else
        return matchesSearch && l.ownerId !== currentUserId && l.assignedTo !== currentUserId;
      }
    })
    .sort((a, b) => {
      if (activeTab === 'team') {
        const nameA = a.assignedToName || '';
        const nameB = b.assignedToName || '';
        return nameA.localeCompare(nameB);
      }
      return 0; // Already sorted by date
    });

  const selectedUserName = userId ? allUsers.find(u => u.id === userId || u.uid === userId)?.fullName || 'User' : null;

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    if (filteredLeads.length === 0) {
      alert("No leads to export.");
      return;
    }

    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Designation",
      "Source",
      "Status",
      "Priority",
      "Next Follow Up",
      "Last Note",
      "Date Created"
    ];

    const rows = filteredLeads.map(lead => [
      lead.name || "",
      lead.email || "",
      lead.phone || "",
      lead.company || "",
      lead.designation || "",
      lead.source || "",
      lead.status || "",
      lead.priority || "",
      lead.nextFollowUp || "",
      lead.history?.[lead.history?.length - 1]?.note || "",
      lead.createdAt?.toDate?.() ? lead.createdAt.toDate().toLocaleDateString() : (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "")
    ]);

    let csvContent = "\ufeff";
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChangeFromTable = (lead, newStatus) => {
    setUpdateModal({
      isOpen: true,
      lead: lead,
      newStatus: newStatus
    });
  };

  const handleVerifyWhatsApp = async (lead) => {
    try {
      const sessionsRes = await waSessions.list();
      const connectedSession = (sessionsRes.sessions || []).find(
        s => s.status === 'CONNECTED' || s.live_status === 'CONNECTED'
      );

      if (!connectedSession) {
        toast.error('No connected WhatsApp session found. Please connect a WhatsApp session first under WhatsApp > Sessions.');
        return;
      }

      await waLeads.checkBulk([lead.id], connectedSession.id);
      toast.success(`Verification queued for ${lead.name} in background...`);
    } catch (err) {
      console.error('Error verifying WhatsApp:', err);
      toast.error('Failed to initiate WhatsApp verification.');
    }
  };

  const handleCampaignSave = async (formData) => {
    try {
      const data = {
        ...formData,
        lead_filter: {
          lead_ids: Array.from(selectedLeadIds)
        }
      };
      await waCampaigns.create(data);
      toast.success('Campaign created successfully!');
      setSelectedLeadIds(new Set());
      setShowWaCampaignModal(false);
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error(err.message || 'Failed to create campaign');
    }
  };

  const handleBulkVerifyWhatsApp = async () => {
    try {
      const unverifiedLeads = filteredLeads.filter(l => l.phone && !(l.phoneWhatsapp || l.phone_whatsapp));
      if (unverifiedLeads.length === 0) {
        toast.error('No unverified leads found on this tab.');
        return;
      }

      const sessionsRes = await waSessions.list();
      const connectedSession = (sessionsRes.sessions || []).find(
        s => s.status === 'CONNECTED' || s.live_status === 'CONNECTED'
      );

      if (!connectedSession) {
        toast.error('No connected WhatsApp session found. Please connect a WhatsApp session first under WhatsApp > Sessions.');
        return;
      }

      const leadIds = unverifiedLeads.map(l => l.id);
      await waLeads.checkBulk(leadIds, connectedSession.id);
      toast.success(`Queued WhatsApp verification for ${unverifiedLeads.length} leads in background...`);
    } catch (err) {
      console.error('Error in bulk WhatsApp verification:', err);
      toast.error('Failed to initiate bulk WhatsApp verification.');
    }
  };

  return (
    <DashboardLayout>
      <div className="leads-page-container">
        <LeadTabs />
        <div className="leads-page-header">
          <div className="header-title-row">
            <h1>{userId ? `Leads for ${selectedUserName}` : 'My Lead Management'}</h1>
            <div className="header-actions">
              {selectedLeadIds.size > 0 && (
                <Button 
                  variant="danger" 
                  icon={Trash2} 
                  onClick={handleBulkDelete}
                  style={{ backgroundColor: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                >
                  Delete Selected ({selectedLeadIds.size})
                </Button>
              )}
              <Button variant="secondary" icon={Download} onClick={handleExport}>Export</Button>
              <Button variant="secondary" icon={Upload} onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
              <Button 
                variant="secondary" 
                icon={WhatsAppIcon} 
                onClick={handleBulkVerifyWhatsApp}
                title="Verify WhatsApp for all unverified leads on this page"
              >
                Verify WhatsApp Status
              </Button>
              <Button 
                variant="outline" 
                icon={FolderPlus} 
                onClick={() => setShowCategoryModal(true)}
              >
                Add Category
              </Button>
              {hasPermission('Lead Management', 'create') && (
                <Link to="/leads/add">
                  <Button variant="primary" icon={Plus}>Add New Lead</Button>
                </Link>
              )}
            </div>
          </div>
          <p className="header-desc">
            {userId 
              ? `Viewing lead bucket assigned to ${selectedUserName}.` 
              : 'Track and manage your personalized lead pipeline.'}
          </p>
        </div>

        <div className="leads-tabs-container">
          <div className="leads-type-tabs">
            <button 
              className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => { setActiveTab('personal'); setCurrentPage(1); }}
            >
              <UserCheck size={16} />
              My Own Leads
              <span className="tab-count">{user ? leads.filter(l => l.ownerId === (user.uid || user.id) || (!l.ownerId && l.assignedTo === (user.uid || user.id))).length : 0}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
              onClick={() => { setActiveTab('assigned'); setCurrentPage(1); }}
            >
              <History size={16} />
              Assigned to Me
              <span className="tab-count">{user ? leads.filter(l => l.assignedTo === (user.uid || user.id) && l.ownerId && l.ownerId !== (user.uid || user.id)).length : 0}</span>
            </button>
            {showTeamTab && (
              <button 
                className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => { setActiveTab('team'); setCurrentPage(1); }}
              >
                <GitMerge size={16} />
                Team's Leads
                <span className="tab-count">{user ? leads.filter(l => l.ownerId !== (user.uid || user.id) && l.assignedTo !== (user.uid || user.id)).length : 0}</span>
              </button>
            )}
          </div>
        </div>

        {selectedCategory === null ? (
          <div className="lead-categories-container">
            <div className="lead-categories-header">
              <div className="lead-categories-title-group">
                <h2><Folder size={20} style={{ color: 'var(--primary)' }} /> Lead Categories</h2>
                <p>Click on any category box below to view and manage its leads.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="outline" size="sm" icon={FolderPlus} onClick={() => setShowCategoryModal(true)}>
                  Add Category
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSelectedCategory('ALL')}>
                  View All Leads ({categoryStats['ALL']?.total || 0})
                </Button>
              </div>
            </div>

            <div className="lead-categories-grid">
              {/* All Leads Box */}
              <div 
                className="lead-category-box" 
                onClick={() => setSelectedCategory('ALL')}
                style={{ '--card-accent': 'var(--primary)', '--card-glow': 'rgba(0, 209, 255, 0.2)' }}
              >
                <div className="lead-category-top">
                  <div className="category-icon-wrapper" style={{ background: 'rgba(0, 209, 255, 0.15)', color: 'var(--primary)' }}>
                    <Layers size={22} />
                  </div>
                  <span className="category-lead-count-badge">
                    {categoryStats['ALL']?.total || 0} Leads
                  </span>
                </div>
                <div className="lead-category-info">
                  <h3 className="lead-category-name">All Leads</h3>
                  <p className="lead-category-desc">Complete overview of all leads across every category</p>
                </div>
                <div className="lead-category-footer">
                  <div className="category-stats-pills">
                    <span className="cat-pill fresh">{categoryStats['ALL']?.fresh || 0} Fresh</span>
                    <span className="cat-pill followup">{categoryStats['ALL']?.followup || 0} Follow-up</span>
                    <span className="cat-pill deal">{categoryStats['ALL']?.deals || 0} Deals</span>
                  </div>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Explore →</span>
                </div>
              </div>

              {/* Individual Category Boxes */}
              {categories.map(cat => {
                const stat = categoryStats[cat.name] || { total: 0, fresh: 0, followup: 0, deals: 0 };
                return (
                  <div 
                    key={cat.id || cat.name}
                    className="lead-category-box"
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{ '--card-accent': cat.color || '#3B82F6', '--card-glow': `${cat.color || '#3B82F6'}33` }}
                  >
                    <div className="lead-category-top">
                      <div className="category-icon-wrapper" style={{ background: `${cat.color || '#3B82F6'}22`, color: cat.color || '#3B82F6' }}>
                        <Folder size={22} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="category-lead-count-badge">
                          {stat.total} Leads
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCategory(e, cat)}
                          title="Delete Category"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="lead-category-info">
                      <h3 className="lead-category-name">{cat.name}</h3>
                      <p className="lead-category-desc">{cat.description || `Leads organized under ${cat.name}`}</p>
                    </div>
                    <div className="lead-category-footer">
                      <div className="category-stats-pills">
                        <span className="cat-pill fresh">{stat.fresh} Fresh</span>
                        <span className="cat-pill followup">{stat.followup} Follow-up</span>
                        <span className="cat-pill deal">{stat.deals} Deals</span>
                      </div>
                      <span style={{ color: cat.color || '#3B82F6', fontWeight: 600 }}>Open →</span>
                    </div>
                  </div>
                );
              })}

              {/* Uncategorized Box (if has leads) */}
              {categoryStats['UNCATEGORIZED']?.total > 0 && (
                <div 
                  className="lead-category-box"
                  onClick={() => setSelectedCategory('UNCATEGORIZED')}
                  style={{ '--card-accent': '#64748B', '--card-glow': 'rgba(100, 116, 139, 0.2)' }}
                >
                  <div className="lead-category-top">
                    <div className="category-icon-wrapper" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8' }}>
                      <Tag size={22} />
                    </div>
                    <span className="category-lead-count-badge">
                      {categoryStats['UNCATEGORIZED'].total} Leads
                    </span>
                  </div>
                  <div className="lead-category-info">
                    <h3 className="lead-category-name">Uncategorized</h3>
                    <p className="lead-category-desc">Leads not yet assigned to any specific category</p>
                  </div>
                  <div className="lead-category-footer">
                    <div className="category-stats-pills">
                      <span className="cat-pill fresh">{categoryStats['UNCATEGORIZED'].fresh} Fresh</span>
                      <span className="cat-pill followup">{categoryStats['UNCATEGORIZED'].followup} Follow-up</span>
                    </div>
                    <span style={{ color: '#94A3B8', fontWeight: 600 }}>Open →</span>
                  </div>
                </div>
              )}

              {/* Dashed Add New Category Box */}
              <div 
                className="lead-category-box add-new-box"
                onClick={() => setShowCategoryModal(true)}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FolderPlus size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>+ Add New Category</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Create custom lead segment</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Active Category Header */}
            <div className="category-active-banner">
              <div className="category-banner-left">
                <button className="category-back-btn" onClick={() => setSelectedCategory(null)}>
                  <ArrowLeft size={15} /> All Categories
                </button>
                <div className="category-banner-info">
                  <h2 className="category-banner-title">
                    <Folder size={20} style={{ color: 'var(--primary)' }} />
                    {selectedCategory === 'ALL' ? 'All Leads' : selectedCategory === 'UNCATEGORIZED' ? 'Uncategorized Leads' : selectedCategory}
                  </h2>
                  <span className="category-banner-count">{filteredLeads.length} Leads</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="fu-filter-select"
                  style={{ height: '36px', fontSize: '0.8125rem' }}
                >
                  <option value="ALL">All Leads</option>
                  {categories.map(c => (
                    <option key={c.id || c.name} value={c.name}>{c.name}</option>
                  ))}
                  {categoryStats['UNCATEGORIZED']?.total > 0 && (
                    <option value="UNCATEGORIZED">Uncategorized</option>
                  )}
                </select>
                <Button variant="outline" size="sm" onClick={() => setSelectedCategory(null)}>
                  Back to Categories
                </Button>
              </div>
            </div>

            {/* Status Filters */}
            <div className="leads-status-filter-bar">
              <div className="leads-status-filter-label">
                <Filter size={14} style={{ color: 'var(--primary)' }} />
                <span>Filter Status:</span>
              </div>
              <div className="leads-status-filter-group">
                {['All', ...statuses.filter(s => s.id !== 'Released').map(s => s.id)].map(status => {
                  const tabLeads = !user ? [] : leads.filter(l => {
                    if (userId) return l.assignedTo === userId;
                    const currentUserId = user.uid || user.id;
                    const catMatch = !selectedCategory || selectedCategory === 'ALL' || (selectedCategory === 'UNCATEGORIZED' ? (!l.category || l.category.trim() === '') : (l.category || '').toLowerCase() === selectedCategory.toLowerCase());
                    if (!catMatch) return false;

                    if (activeTab === 'personal') return l.ownerId === currentUserId || (!l.ownerId && l.assignedTo === currentUserId);
                    if (activeTab === 'assigned') return l.assignedTo === currentUserId && l.ownerId && l.ownerId !== currentUserId;
                    return l.ownerId !== currentUserId && l.assignedTo !== currentUserId;
                  });
                  const count = tabLeads.filter(l => status === 'All' || l.status === status).length;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                      className={`status-pill-btn ${statusFilter === status ? 'active' : ''}`}
                    >
                      <span>{status}</span>
                      <span className="count-badge">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="leads-toolbar">
              <div className="toolbar-left" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-box">
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search your leads..." 
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>

                <div className="fu-filter-select-wrapper">
                  <select 
                    value={selectedPriority} 
                    onChange={e => { setSelectedPriority(e.target.value); setCurrentPage(1); }}
                    className="fu-filter-select"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Normal">Normal</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <div className="fu-filter-select-wrapper">
                  <select 
                    value={selectedWhatsAppStatus} 
                    onChange={e => { setSelectedWhatsAppStatus(e.target.value); setCurrentPage(1); }}
                    className="fu-filter-select"
                  >
                    <option value="All">All WhatsApp Status</option>
                    <option value="Verified">WhatsApp Verified Leads</option>
                    <option value="Unverified">WhatsApp Unverified</option>
                  </select>
                </div>

                <div className="fu-filter-select-wrapper">
                  <select 
                    value={selectedProject} 
                    onChange={e => { setSelectedProject(e.target.value); setCurrentPage(1); }}
                    className="fu-filter-select"
                  >
                    <option value="All">All Projects</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.projectName}>{p.projectName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="toolbar-right">
                <div className="view-toggle">
                  <button 
                    className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    <List size={18} />
                  </button>
                  <button 
                    className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <Layout size={18} />
                  </button>
                  <button 
                    className={`toggle-btn kanban-toggle ${viewMode === 'kanban' ? 'active' : ''}`}
                    onClick={() => setViewMode('kanban')}
                    title="Kanban Board"
                  >
                    <GitMerge size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="leads-content-area">
              {viewMode === 'list' ? (
                <ListView 
                  leads={paginatedLeads} 
                  onAddUpdate={handleAddUpdate} 
                  onStatusChange={handleStatusChangeFromTable}
                  onAssign={(lead) => setAssignModal({ isOpen: true, lead })}
                  onEditInterests={(lead) => setInterestsModal({ isOpen: true, lead })}
                  onVerifyWhatsApp={handleVerifyWhatsApp}
                  onDelete={handleSingleDelete}
                  showAssignment={activeTab === 'team'}
                  activeTab={activeTab}
                  selectedLeadIds={selectedLeadIds}
                  setSelectedLeadIds={setSelectedLeadIds}
                />
              ) : viewMode === 'grid' ? (
                <GridView 
                  leads={paginatedLeads} 
                  onAddUpdate={handleAddUpdate} 
                  onAssign={(lead) => setAssignModal({ isOpen: true, lead })}
                  onStatusChange={(lead, newStatus) => setUpdateModal({ isOpen: true, lead, newStatus })}
                  onEditInterests={(lead) => setInterestsModal({ isOpen: true, lead })}
                  onVerifyWhatsApp={handleVerifyWhatsApp}
                  onDelete={handleSingleDelete}
                  showAssignment={activeTab === 'team'}
                  activeTab={activeTab}
                  selectedLeadIds={selectedLeadIds}
                  setSelectedLeadIds={setSelectedLeadIds}
                />
              ) : (
                <div className="kanban-board-container">
                  <div className="kanban-board">
                    {statuses.map(status => (
                      <div 
                        key={status.id} 
                        className="kanban-column"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, status.id)}
                      >
                        <div className="column-header" style={{ borderTop: `4px solid ${status.color}` }}>
                          <div className="header-title-group">
                            <span className="status-dot" style={{ backgroundColor: status.color }}></span>
                            <h3>{status.title}</h3>
                            <span className="count-pill" style={{ backgroundColor: `${status.color}15`, color: status.color }}>
                              {filteredLeads.filter(l => l.status === status.id).length}
                            </span>
                          </div>
                          <button className="col-action-btn"><MoreVertical size={16} /></button>
                        </div>
                        <div className="column-content custom-scrollbar">
                          {filteredLeads.filter(l => l.status === status.id).length === 0 ? (
                            <div className="kanban-empty-dropzone">
                              <Inbox size={26} style={{ opacity: 0.35 }} />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>No leads in this stage</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.6 }}>Drag & drop cards here</span>
                            </div>
                          ) : (
                            filteredLeads
                              .filter(l => l.status === status.id)
                              .map(lead => (
                                <KanbanLeadCard 
                                  key={lead.id} 
                                  lead={lead} 
                                  onDragStart={handleDragStart}
                                  onAddUpdate={handleAddUpdate}
                                  onAssign={(l) => setAssignModal({ isOpen: true, lead: l })}
                                  onStatusChange={(l, newStatus) => setUpdateModal({ isOpen: true, lead: l, newStatus })}
                                  onEditInterests={(l) => setInterestsModal({ isOpen: true, lead: l })}
                                  onVerifyWhatsApp={handleVerifyWhatsApp}
                                  onDelete={handleSingleDelete}
                                />
                              ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {viewMode !== 'kanban' && filteredLeads.length > itemsPerPage && (
              <div className="pagination-container-v2">
                <div className="pagination-info">
                  Showing <span>{(currentPage - 1) * itemsPerPage + 1}</span> to <span>{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> of <span>{filteredLeads.length}</span> leads
                </div>
                <div className="pagination-controls">
                  <button 
                    className="pag-btn" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>
                  
                  <div className="page-numbers">
                    {Array.from({ length: Math.ceil(filteredLeads.length / itemsPerPage) }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === Math.ceil(filteredLeads.length / itemsPerPage) || Math.abs(p - currentPage) <= 1)
                      .map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && arr[i-1] !== p - 1 && <span className="pag-dots">...</span>}
                          <button 
                            className={`pag-number ${currentPage === p ? 'active' : ''}`}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button 
                    className="pag-btn" 
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredLeads.length / itemsPerPage), prev + 1))}
                    disabled={currentPage === Math.ceil(filteredLeads.length / itemsPerPage)}
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

        <LeadUpdateModal 
          isOpen={updateModal.isOpen}
          onClose={() => setUpdateModal({ isOpen: false, lead: null, newStatus: '' })}
          lead={updateModal.lead}
          newStatus={updateModal.newStatus}
          onConfirm={confirmStatusUpdate}
        />

        <AssignLeadModal 
          isOpen={assignModal.isOpen}
          onClose={() => setAssignModal({ isOpen: false, lead: null })}
          lead={assignModal.lead}
          teamUsers={user ? allUsers.filter(u => (u.uid || u.id) !== (user.uid || user.id)) : []}
          onConfirm={handleAssignConfirm}
        />

        <InterestsModal 
          isOpen={interestsModal.isOpen}
          onClose={() => setInterestsModal({ isOpen: false, lead: null })}
          lead={interestsModal.lead}
          projects={filteredProjects}
          onConfirm={handleSaveInterests}
        />

      <BulkUploadModal 
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        user={user}
        allUsers={allUsers}
        teams={teams}
        categories={categories}
        onImport={async (data) => {
          try {
            const importPromises = data.map(lead => {
              const history = [
                {
                  date: new Date().toISOString(),
                  note: 'Lead imported via CSV.',
                  type: 'System',
                  createdBy: user?.full_name || user?.fullName || 'Admin'
                }
              ];
              if (lead.nextFollowUp) {
                history.push({
                  date: new Date().toISOString(),
                  note: `Initial follow-up scheduled for ${lead.nextFollowUp}.`,
                  type: 'Follow-up',
                  createdBy: user?.full_name || user?.fullName || 'Admin'
                });
              }

              // Explicitly map keys to match DB schema columns to avoid PostgREST column cache mismatch errors
              const isSA = user?.account_type === 'super_admin';
              const resolvedOrgId = (isSA && currentTenant?.type === 'org')
                ? currentTenant.id
                : (user?.org_id || null);

              const resolvedOwnerId = (isSA && currentTenant?.type === 'individual')
                ? currentTenant.id
                : (user?.uid || user?.id);

              const displayName = lead.contact_person || lead.name || lead.company || 'Unnamed Lead';
              const dbPayload = {
                name:                  displayName,
                company:               lead.company || '',
                contact_person:        lead.contact_person || '',
                category:              lead.category || '',
                email:                 lead.email || '',
                phone:                 normalizePhoneForDb(lead.phone || ''),
                phone_whatsapp:        lead.phone_whatsapp || false,
                second_phone:          normalizePhoneForDb(lead.second_phone || ''),
                second_phone_whatsapp: lead.second_phone_whatsapp || false,
                location:              lead.location || '',
                city:                  lead.city || '',
                area:                  '',
                address:               lead.address || [lead.location, lead.city].filter(Boolean).join(', ') || '',
                assigned_to:           resolvedOwnerId,
                assigned_to_name:      user?.full_name || user?.fullName || user?.name || 'Admin',
                owner_id:              resolvedOwnerId,
                owner_name:            user?.full_name || user?.fullName || user?.name || 'Admin',
                priority:              'Normal',
                source:                'CSV Import',
                status:                'Fresh Lead',
                description:           '',
                image:                 lead.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.company || displayName)}&background=random`,
                history:               history,
                org_id:                resolvedOrgId,
                created_at:            new Date().toISOString(),
                updated_at:            new Date().toISOString()
              };

              return (async () => {
                let payload = { ...dbPayload };
                while (true) {
                  const res = await supabase.from('leads').insert(payload).select();
                  if (res.error) {
                    const colMatch = res.error.message?.match(/Could not find the '([^']+)' column/i);
                    if (colMatch && colMatch[1] && payload[colMatch[1]] !== undefined) {
                      delete payload[colMatch[1]];
                      continue;
                    }
                    if (res.error.code === 'PGRST204') {
                      delete payload.category;
                      delete payload.city;
                      delete payload.contact_person;
                      return supabase.from('leads').insert(payload).select();
                    }
                  }
                  return res;
                }
              })();
            });
            
            const insertResults = await Promise.all(importPromises);
            const failedInserts = insertResults.filter(res => res.error);
            if (failedInserts.length > 0) {
              console.error('Some lead inserts failed:', failedInserts);
              failedInserts.forEach(res => {
                toast.error(`Database Error: ${res.error.message}`);
              });
            }

            const insertedLeads = insertResults
              .map(res => res.data?.[0])
              .filter(Boolean);
            
            const insertedIds = insertedLeads.map(l => l.id);

            toast.success(`Successfully imported ${insertedLeads.length} leads!`);

            // Refetch leads immediately so UI table updates without page refresh
            await fetchLeads();

            if (insertedIds.length > 0) {
              try {
                const sessionsRes = await waSessions.list();
                const connectedSession = (sessionsRes.sessions || []).find(
                  s => s.status === 'CONNECTED' || s.live_status === 'CONNECTED'
                );

                if (connectedSession) {
                  await waLeads.checkBulk(insertedIds, connectedSession.id);
                  toast.success(`Checking WhatsApp status for ${insertedIds.length} leads in background...`, {
                    duration: 5000
                  });
                } else {
                  console.info('No active WhatsApp session connected. Automatic check skipped.');
                }
              } catch (sessionErr) {
                console.error('Error initiating automatic WhatsApp check:', sessionErr);
              }
            }

            return insertedLeads.length;
          } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to import leads to database.');
            return 0;
          }
        }}
      />
      {selectedLeadIds.size > 0 && (
        <div className="wa-campaign-action-bar" style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          zIndex: 1000,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#f3f4f6', fontWeight: 500 }}>
            {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead' : 'leads'} selected
          </span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="wa-btn wa-btn-secondary" 
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setSelectedLeadIds(new Set())}
            >
              Clear Selection
            </button>
            <button 
              className="wa-btn" 
              style={{ 
                fontSize: '0.85rem', 
                padding: '6px 16px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={handleBulkDelete}
            >
              <Trash2 size={16} />
              Delete Marked Leads ({selectedLeadIds.size})
            </button>
            <button 
              className="wa-btn wa-btn-primary" 
              style={{ fontSize: '0.85rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setShowWaCampaignModal(true)}
            >
              Create WhatsApp Campaign
            </button>
          </div>
        </div>
      )}
      {showWaCampaignModal && (
        <WaCampaignCreateModal 
          selectedCount={selectedLeadIds.size}
          onSave={handleCampaignSave}
          onClose={() => setShowWaCampaignModal(false)}
        />
      )}
      {deleteModal.isOpen && (
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={() => !isDeleting && setDeleteModal({ isOpen: false, leadIds: [], leadName: '', isBulk: false })}
          title={deleteModal.isBulk ? "Delete Multiple Leads" : "Delete Lead"}
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {deleteModal.isBulk
                ? `Are you sure you want to permanently delete ${deleteModal.leadIds.length} marked lead(s)?`
                : `Are you sure you want to permanently delete the lead "${deleteModal.leadName}"?`
              }
              <br />
              <span style={{ color: '#ef4444', fontSize: '0.85rem', display: 'block', marginTop: '8px', fontWeight: 600 }}>
                This action cannot be undone.
              </span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <Button
                variant="secondary"
                onClick={() => setDeleteModal({ isOpen: false, leadIds: [], leadName: '', isBulk: false })}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={confirmDeleteLeads}
                disabled={isDeleting}
                style={{ backgroundColor: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Category Creation Modal */}
      {showCategoryModal && (
        <Modal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Create New Lead Category"
        >
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '6px' }}>
                Category Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Real Estate, Corporate Clients, VIP Buyers"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '6px' }}>
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Brief description or purpose of this category..."
                value={newCategoryDesc}
                onChange={e => setNewCategoryDesc(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '6px' }}>
                Tag Color
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#64748B'].map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setNewCategoryColor(c)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: c,
                      border: newCategoryColor === c ? '3px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={e => setNewCategoryColor(e.target.value)}
                  style={{
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                  title="Choose custom color"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCategoryModal(false)}
                disabled={isCreatingCategory}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={FolderPlus}
                disabled={isCreatingCategory || !newCategoryName.trim()}
              >
                {isCreatingCategory ? 'Creating...' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default MyLeads;
