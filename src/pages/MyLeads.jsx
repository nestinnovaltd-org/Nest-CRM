import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { WhatsAppIcon } from '../components/ui/Icons';
import './Leads.css';

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

const checkMultiplePhonesDuplicateInTeam = async (cleanedPhones, user, allUsers, teams) => {
  const duplicatesMap = new Map();
  if (cleanedPhones.length === 0) return duplicatesMap;

  // Gather team member UIDs
  const currentUserName = user.fullName || user.name || '';
  const userTeams = teams.filter(team => 
    (team.members && team.members.includes(currentUserName)) || 
    (team.teamLeads && team.teamLeads.includes(currentUserName)) || 
    team.teamLead === currentUserName
  );

  const teamMemberNames = new Set([currentUserName]);
  userTeams.forEach(team => {
    if (team.members) team.members.forEach(m => teamMemberNames.add(m));
    if (team.teamLeads) team.teamLeads.forEach(l => teamMemberNames.add(l));
    if (team.teamLead) teamMemberNames.add(team.teamLead);
  });

  const teamMemberUids = allUsers
    .filter(u => teamMemberNames.has(u.fullName || u.name))
    .map(u => u.uid || u.id)
    .filter(Boolean);
  
  if (!teamMemberUids.includes(user.uid)) {
    teamMemberUids.push(user.uid);
  }

  // Create list of search formats for query
  const searchFormats = [];
  cleanedPhones.forEach(phone => {
    searchFormats.push(`+880 ${phone}`);
    searchFormats.push(`+880${phone}`);
    searchFormats.push(`0${phone}`);
    searchFormats.push(phone);
  });

  // Chunk formattedPhones into arrays of 30 items
  const chunkSize = 30;
  for (let i = 0; i < searchFormats.length; i += chunkSize) {
    const chunk = searchFormats.slice(i, i + chunkSize);
    const { data: matchedLeads } = await supabase.from('leads').select('*').in('phone', chunk);

    if (matchedLeads && matchedLeads.length > 0) {
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

const BulkUploadModal = ({ isOpen, onClose, onImport, user, allUsers, teams }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [invalidLeads, setInvalidLeads] = useState([]);

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
      'Customer Name', 'Number', 'Profession', 'Project', 
      'Lead Source', 'Lead Status', 'Location', 'Area', 
      'Email', 'Priority', 'Description', 'Next Call Date'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'John Doe,1712345678,Manager,Alpha Project,Facebook,Fresh Lead,Dhaka,Gulshan,john@example.com,High,Interested in 3BHK,2026-08-25';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
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
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
        
        if (rows.length < 2) {
          alert('CSV file is empty or invalid.');
          setIsUploading(false);
          return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1).filter(row => row.length === headers.length && row.some(cell => cell !== ''));
        
        setUploadProgress(35);

        // First pass: parse and validate format
        const parsedRows = [];
        const csvSeenPhones = new Set();
        const errors = [];
        const validCleanedPhones = [];
        const tempInvalidLeads = [];

        dataRows.forEach((row, index) => {
          const obj = {};
          let rawPhone = '';
          headers.forEach((header, colIndex) => {
            const value = row[colIndex];
            const h = header.toLowerCase();
            
            if (h.includes('customer name')) obj.name = value;
            else if (h.includes('profession')) obj.designation = value;
            else if (h.includes('number')) {
              rawPhone = value;
            }
            else if (h.includes('project')) obj.company = value;
            else if (h.includes('lead source')) obj.source = value;
            else if (h.includes('lead status')) obj.status = value;
            else if (h.includes('location')) obj.location = value;
            else if (h.includes('area')) obj.area = value;
            else if (h.includes('email')) obj.email = value;
            else if (h.includes('priority')) obj.priority = value;
            else if (h.includes('description') || h.includes('summary')) obj.description = value;
            else if (h.includes('coment')) obj.comments = value;
            else if (h.includes('next call') || h.includes('follow-up') || h.includes('followup')) {
              obj.nextFollowUp = value;
              obj.nextFollowUpDate = value;
            }
          });

          const cleaned = cleanPhoneNumber(rawPhone);
          const rowNum = index + 2; // row 1 is header
          obj.rowNum = rowNum;

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

        // Second pass: check duplicates in team context via Firestore
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
            // Delete temp helper property
            const importObj = { ...row };
            delete importObj.cleanedPhone;
            delete importObj.rowNum;
            
            // Add default fields
            importObj.createdAt = new Date().toISOString();
            importObj.lastAction = 'Imported';
            importObj.status = importObj.nextFollowUp ? 'Follow Up' : 'Fresh Lead';

            finalImportData.push(importObj);
          }
        });

        setUploadProgress(100);
        setIsUploading(false);

        const successCount = finalImportData.length;
        const failedCount = dataRows.length - successCount;

        setImportSummary({
          total: dataRows.length,
          success: successCount,
          failed: failedCount,
          errors: errors
        });

        setInvalidLeads(tempInvalidLeads);

        if (successCount > 0) {
          onImport(finalImportData);
        }
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

    // Validate the corrected phones locally
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

    // Check duplicates in team context via Firestore
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

        // Add default fields
        importObj.createdAt = new Date().toISOString();
        importObj.lastAction = 'Imported';
        importObj.status = importObj.nextFollowUp ? 'Follow Up' : 'Fresh Lead';

        importData.push(importObj);
      }
    });

    setUploadProgress(100);
    setIsUploading(false);

    if (importData.length > 0) {
      onImport(importData);
    }

    setInvalidLeads(stillInvalidLeads);

    // Update summary stats
    setImportSummary(prev => {
      const newSuccess = (prev?.success || 0) + importData.length;
      const newFailed = stillInvalidLeads.length;
      const newErrors = stillInvalidLeads.map(l => `Row ${l.rowNum}: ${l.errorMsg}`);
      return {
        total: prev?.total || 0,
        success: newSuccess,
        failed: newFailed,
        errors: newErrors
      };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Leads (CSV)" className="glass-modal">
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
                <p>Ensure your CSV columns match the template. All lead fields are supported.</p>
                <a href="#" className="download-template" onClick={(e) => { e.preventDefault(); downloadTemplate(); }}>
                  Download CSV Template
                </a>
              </div>
            </div>

            {isUploading && (
              <div className="upload-progress-section">
                <div className="progress-header">
                  <span>Processing {file.name}...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-bar-v2">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <div className="modal-footer-v5 mt-6">
              <button className="btn-ghost-v2" onClick={onClose}>Cancel</button>
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
              <Button variant="secondary" className="w-full" onClick={onClose}>Done & Close</Button>
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

const LeadCard = ({ lead, index, onDragStart, onAddUpdate, onAssign, onStatusChange, onEditInterests, showAssignment, activeTab, className = '' }) => {
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const cleanPhone = lead.phone.replace(/[^\d+]/g, '');

  useEffect(() => {
    const closeDropdown = () => setIsDropdownOpen(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);
  
  return (
    <Card 
      className={`detailed-lead-card draggable ${className}`} 
      draggable 
      onDragStart={(e) => onDragStart(e, lead.id)}
    >
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
              <Link to={`/leads/${lead.id}`} className="lead-name-link" style={{ marginBottom: 0 }}>
                <h4 className="lead-name" style={{ display: 'inline', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</h4>
              </Link>
              {lead.designation && <span className="lead-designation">{lead.designation}</span>}
            </div>
            {lead.company && (
              <div className="lead-company-info" style={{ marginTop: '2px' }}>
                <Briefcase size={14} className="icon-briefcase" />
                <span className="company-name-text">{lead.company}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="card-body">
        <div className="lead-contact-info">
          {lead.phone && (
            <div className="info-row">
              <Phone size={14} className="info-icon icon-phone" />
              <span className="phone-number">{lead.phone?.replace(/^\+88/, '').replace(/\s+/g, '')}</span>
              <span className="country-flag">{lead.flag}</span>
            </div>
          )}
          {lead.email && (
            <div className="info-row">
              <Mail size={14} className="info-icon icon-email" />
              <span className="info-text">{lead.email}</span>
            </div>
          )}
          {lead.location && (
            <div className="info-row">
              <MapPin size={14} className="info-icon icon-location" />
              <span className="info-text">{lead.location}</span>
            </div>
          )}
          {lead.age && (
            <div className="info-row age-info">
              <Clock size={12} className="info-icon icon-clock" />
              <span className="info-text age-text">{lead.age}</span>
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
              <MessageCircle size={14} className="note-icon" />
              <div className="note-content" style={{ flex: 1 }}>
                <span className="note-label">Last Follow Up Message</span>
                {!expandedHistory && (
                  <p className="note-text">
                    {lead.history[lead.history.length - 1].note}
                  </p>
                )}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
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
                  onClick={() => { onAssign(lead); setIsDropdownOpen(false); }}
                >
                  <UserPlus size={14} style={{ marginRight: '8px' }} />
                  Transfer Lead
                </button>
                <button 
                  className="dropdown-item"
                  onClick={() => { onEditInterests(lead); setIsDropdownOpen(false); }}
                >
                  <Briefcase size={14} style={{ marginRight: '8px' }} />
                  Edit Interests
                </button>
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

const ListView = ({ leads, onAddUpdate, onStatusChange, onAssign, onEditInterests, showAssignment, activeTab }) => {
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
            <th>Lead Name</th>
            <th>Status</th>
            <th>Company</th>
            <th>Contact</th>
            <th>Follow-up</th>
            <th>Age</th>
            <th>History</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
            <tr key={lead.id}>
              <td>
                <div className="table-name-cell">
                  <span className="serial-number" style={{ marginRight: '8px' }}>{(index + 1).toString().padStart(2, '0')}.</span>
                  <div className="table-avatar">{lead.name[0]}</div>
                  <div className="name-details">
                    <Link to={`/leads/${lead.id}`} className="table-name-link">
                      <span className="name-text">{lead.name}</span>
                    </Link>
                    {(showAssignment || activeTab === 'assigned') && (lead.assignedToName || lead.assignedByName) && (
                      <div className="assigned-to-link table-link">
                        <Link2 size={10} />
                        <span>
                          {activeTab === 'assigned' && lead.assignedByName ? `Assigned by: ${lead.assignedByName}` : lead.assignedToName}
                        </span>
                      </div>
                    )}
                    {lead.history && lead.history.length > 0 && (
                      <div className="last-followup-subtext">
                        <MessageCircle size={10} />
                        <span className="truncate-text" title={lead.history[lead.history.length - 1].note}>
                          Last: {lead.history[lead.history.length - 1].note}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <span className={`table-status-pill ${lead.status.toLowerCase().replace(/ /g, '-')}`}>
                  {lead.status}
                </span>
              </td>
              <td>
                <div className="table-company-cell">
                  <span className="company-name">{lead.company}</span>
                  <span className="designation-text">{lead.designation}</span>
                </div>
              </td>
              <td>
                <div className="table-contact-cell">
                  {lead.phone && (
                    <div className="contact-item">
                      <Phone size={12} className="contact-icon" />
                      <span>{lead.phone?.replace(/^\+88/, '').replace(/\s+/g, '')}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="contact-item">
                      <Mail size={12} className="contact-icon" />
                      <span className="email-text" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lead.email}</span>
                    </div>
                  )}
                  {(lead.address || lead.area || lead.location) && (
                    <div className="contact-item">
                      <MapPin size={12} className="contact-icon" />
                      <span className="address-text" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {lead.address || `${lead.area ? lead.area + ', ' : ''}${lead.location || ''}`}
                      </span>
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div className="table-date-cell">
                  <Calendar size={14} />
                  <span>{formatDateToDDMMYYYY(lead.nextFollowUp)}</span>
                </div>
              </td>
              <td><span className="age-badge">{lead.age}</span></td>
              <td>
                <div className="table-history-badge">
                  <History size={14} />
                  <span>{lead.history?.length || 0}</span>
                </div>
              </td>
              <td>
                <div className="table-actions-container">
                  <div className="table-actions">
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

const GridView = ({ leads, onAddUpdate, onAssign, onStatusChange, onEditInterests, showAssignment, activeTab }) => {
  return (
    <div className="leads-grid-view">
      {leads.map((lead, index) => (
        <div key={lead.id} className="grid-card-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Serial Number displayed above the card */}
          <div className="card-serial-number" style={{ 
            fontFamily: "'JetBrains Mono', monospace", 
            fontWeight: '700', 
            color: 'var(--primary)', 
            fontSize: '0.85rem', 
            opacity: 0.8,
            paddingLeft: '4px'
          }}>
            {(index + 1).toString().padStart(2, '0')}.
          </div>
          
          <LeadCard 
            lead={lead} 
            index={index} 
            onDragStart={() => {}} 
            onAddUpdate={onAddUpdate}
            onAssign={onAssign}
            onStatusChange={onStatusChange}
            onEditInterests={onEditInterests}
            showAssignment={showAssignment}
            activeTab={activeTab}
          />
        </div>
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
    const fetchData = async () => {
      const { data: teamsData } = await supabase.from('teams').select('*');
      setTeams(teamsData || []);
      const { data: projectsData } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
      setAllProjects(projectsData || []);
    };
    fetchData();
  }, []);

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
        <div className="form-group mt-4">
          <label className="form-label">Clients Interests (Projects)</label>
          <div className="interests-selection-grid">
            {filteredProjects.map(project => (
              <div 
                key={project.id}
                className={`interest-checkbox-card ${selectedProjects.includes(project.projectName) ? 'selected' : ''}`}
                onClick={() => toggleProject(project.projectName)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedProjects.includes(project.projectName)}
                  onChange={() => {}} // Handled by card click
                />
                <span>{project.projectName}</span>
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <div className="no-projects-hint">No active projects found</div>
            )}
          </div>
        </div>

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
  const [selectedProject, setSelectedProject] = useState('All');
  const [allProjects, setAllProjects] = useState([]);

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

  useEffect(() => {
    if (!user || allUsers.length === 0) return;

    const isAdmin = user.role === 'Admin' || user.role === 'MD' || user.role === 'System Admin' || user.account_type === 'super_admin';

    const fetchLeads = async () => {
      let query = supabase.from('leads').select('*').neq('status', 'Released');

      // Tenant isolation filter
      if (user.account_type === 'super_admin') {
        if (currentTenant?.type === 'org') {
          query = query.eq('org_id', currentTenant.id);
        } else if (currentTenant?.type === 'individual') {
          query = query.eq('owner_id', currentTenant.id);
        }
      } else {
        if (user.org_id) {
          query = query.eq('org_id', user.org_id);
        } else {
          query = query.eq('owner_id', user.uid);
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
          user.uid,
          ...allUsers.filter(u => (u.reports_to || u.reportsTo) === currentUserName).map(u => u.uid || u.id).filter(Boolean),
          ...teamMemberUids
        ]));
        query = query.or(`assigned_to.in.(${allowedUids.join(',')}),owner_id.in.(${allowedUids.join(',')})`);
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching leads:', error); setIsLoading(false); return; }

      let leadsList = (data || []).map(row => ({
        ...row,
        age: row.created_at ? formatDateToDDMMYYYY(row.created_at) : 'Just now'
      }));

      leadsList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setLeads(leadsList);
      setIsLoading(false);
    };

    fetchLeads();
    const ch = supabase.channel('myleads-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
  }, [user, allUsers, currentTenant, teams]);

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
    const leadId = parseInt(e.dataTransfer.getData('leadId') || draggedLeadId);
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
      const newHistory = [
        ...(updateModal.lead.history || []),
        {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: data.note,
          appointment: data.appointmentDate,
          nextFollowUp: data.nextFollowUp,
          priority: data.priority,
          interests: data.interests,
          type: updateModal.lead.status === updateModal.newStatus ? (data.isAppointment ? 'Appointment' : 'Follow-up') : 'Status Change'
        }
      ];

      const updatePayload = {
        status: updateModal.lead.status === 'Fresh Lead' ? 'Follow Up' : updateModal.newStatus,
        history: newHistory,
        updated_at: new Date().toISOString(),
        next_follow_up_date: data.nextFollowUp || updateModal.lead.next_follow_up_date || updateModal.lead.nextFollowUpDate || null,
        interests: data.interests || updateModal.lead.interests || []
      };

      if (data.isAppointment) {
        updatePayload.visit_date = data.appointmentDate;
        updatePayload.visit_time = data.appointmentTime;
        updatePayload.visit_location = data.appointmentLocation;
        updatePayload.visit_status = 'Confirmed';
      }

      await supabase.from('leads').update(updatePayload).eq('id', updateModal.lead.id);
      setUpdateModal({ isOpen: false, lead: null, newStatus: '' });
    } catch (error) {
      console.error('Error updating lead status:', error);
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
      if (!lead.owner_id && !lead.ownerId) updatePayload.owner_id = user.uid;

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

  const filteredLeads = !user ? [] : leads
    .map(l => {
      const assignedUser = allUsers.find(u => u.id === l.assignedTo || u.uid === l.assignedTo);
      return {
        ...l,
        assignedToName: assignedUser ? (assignedUser.fullName || assignedUser.name) : 'Unassigned'
      };
    })
    .filter(l => {
      const matchesSearch = (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (l.phone || '').includes(searchTerm) ||
                           (l.company || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
      if (!matchesStatus) return false;

      const matchesPriority = selectedPriority === 'All' || (l.priority || 'Normal') === selectedPriority;
      const matchesProject = selectedProject === 'All' || l.company === selectedProject;
      if (!matchesPriority || !matchesProject) return false;

      if (userId) {
        return matchesSearch && l.assignedTo === userId;
      }
      
      if (activeTab === 'personal') {
        // My own leads: I am the owner OR it has no owner but is assigned to me
        return matchesSearch && (l.ownerId === user.uid || (!l.ownerId && l.assignedTo === user.uid));
      } else if (activeTab === 'assigned') {
        // Assigned to me: I am assigned but I am NOT the owner
        return matchesSearch && l.assignedTo === user.uid && l.ownerId && l.ownerId !== user.uid;
      } else {
        // Team leads: Owned or assigned to someone else
        return matchesSearch && l.ownerId !== user.uid && l.assignedTo !== user.uid;
      }
    })
    .sort((a, b) => {
      if (activeTab === 'team') {
        return a.assignedToName.localeCompare(b.assignedToName);
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

  return (
    <DashboardLayout>
      <div className="leads-page-container">
        <LeadTabs />
        <div className="leads-page-header">
          <div className="header-title-row">
            <h1>{userId ? `Leads for ${selectedUserName}` : 'My Lead Management'}</h1>
            <div className="header-actions">
              <Button variant="secondary" icon={Download} onClick={handleExport}>Export</Button>
              <Button variant="secondary" icon={Upload} onClick={() => setIsBulkUploadModalOpen(true)}>Bulk Upload</Button>
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
              <span className="tab-count">{user ? leads.filter(l => l.ownerId === user.uid || (!l.ownerId && l.assignedTo === user.uid)).length : 0}</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
              onClick={() => { setActiveTab('assigned'); setCurrentPage(1); }}
            >
              <History size={16} />
              Assigned to Me
              <span className="tab-count">{user ? leads.filter(l => l.assignedTo === user.uid && l.ownerId && l.ownerId !== user.uid).length : 0}</span>
            </button>
            {showTeamTab && (
              <button 
                className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                onClick={() => { setActiveTab('team'); setCurrentPage(1); }}
              >
                <GitMerge size={16} />
                Team's Leads
                <span className="tab-count">{user ? leads.filter(l => l.ownerId !== user.uid && l.assignedTo !== user.uid).length : 0}</span>
              </button>
            )}
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
              // Counts are specific to the active tab (e.g. My Own Leads vs Assigned to Me)
              const tabLeads = !user ? [] : leads.filter(l => {
                if (userId) return l.assignedTo === userId;
                if (activeTab === 'personal') return l.ownerId === user.uid || (!l.ownerId && l.assignedTo === user.uid);
                if (activeTab === 'assigned') return l.assignedTo === user.uid && l.ownerId && l.ownerId !== user.uid;
                return l.ownerId !== user.uid && l.assignedTo !== user.uid;
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
              showAssignment={activeTab === 'team'}
              activeTab={activeTab}
            />
          ) : viewMode === 'grid' ? (
            <GridView 
              leads={paginatedLeads} 
              onAddUpdate={handleAddUpdate} 
              onAssign={(lead) => setAssignModal({ isOpen: true, lead })}
              onStatusChange={(lead, newStatus) => setUpdateModal({ isOpen: true, lead, newStatus })}
              onEditInterests={(lead) => setInterestsModal({ isOpen: true, lead })}
              showAssignment={activeTab === 'team'}
              activeTab={activeTab}
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
                      {filteredLeads
                        .filter(l => l.status === status.id)
                        .map(lead => (
                          <LeadCard 
                            key={lead.id} 
                            lead={lead} 
                            className="kanban-card"
                            onDragStart={handleDragStart}
                            onAddUpdate={handleAddUpdate}
                            showAssignment={activeTab === 'team'}
                            activeTab={activeTab}
                          />
                        ))}
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
                  ))
                }
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
          teamUsers={user ? allUsers.filter(u => u.uid !== user.uid) : []}
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
        onImport={async (data) => {
          try {
            
            const importPromises = data.map(lead => {
              const history = [
                {
                  date: new Date().toISOString(),
                  note: 'Lead imported via CSV.',
                  type: 'System',
                  createdBy: user?.fullName || 'Admin'
                }
              ];
              if (lead.nextFollowUp) {
                history.push({
                  date: new Date().toISOString(),
                  note: `Initial follow-up scheduled for ${lead.nextFollowUp}.`,
                  type: 'Follow-up',
                  createdBy: user?.fullName || 'Admin'
                });
              }

              return supabase.from('leads').insert({
                ...lead,
                created_at: new Date().toISOString(),
                owner_id: user.uid,
                assigned_to: user.uid,
                assigned_to_name: user.full_name || user.fullName || user.name,
                status: lead.nextFollowUp ? 'Follow Up' : 'Fresh Lead',
                history: history,
                type: 'mine'
              });
            });
            
            await Promise.all(importPromises);
            toast.success(`Successfully imported ${data.length} leads!`);
          } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to import leads to database.');
          }
        }}
      />
    </DashboardLayout>
  );
};

export default MyLeads;
