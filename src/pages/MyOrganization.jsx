import React, { useState, useEffect } from 'react';
import { useAuth, getOrgModules } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Building2, Mail, Phone, Globe, DollarSign, Calendar, Tag, Shield, Palette, AlertCircle, Users } from 'lucide-react';
import './MyOrganization.css';

const THEME_COLORS = [
  { name: 'Vibrant Green', value: '#26E264' },
  { name: 'Indigo Purple', value: '#8B5CF6' },
  { name: 'Sky Blue', value: '#3B82F6' },
  { name: 'Bright Amber', value: '#F59E0B' },
  { name: 'Deep Crimson', value: '#EF4444' },
];

export default function MyOrganization() {
  const { user, currentTenant, setCurrentTenant } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgUsers, setOrgUsers] = useState([]);
  const [allOrgs, setAllOrgs] = useState([]);
  const [message, setMessage] = useState({ text: '', type: 'success' });

  const [modulesConfig, setModulesConfig] = useState({
    'Dashboard': { read: true, write: true },
    'Project Management': { read: true, write: true },
    'Lead Management': { read: true, write: true },
    'User Management': { read: true, write: true },
    'Team Management': { read: true, write: true },
    'HR Operations': { read: true, write: true },
    'Calendar & Schedule': { read: true, write: true },
    'Payments': { read: true, write: true },
    'Reports & Analytics': { read: true, write: true },
    'Notifications': { read: true, write: true },
    'Settings': { read: true, write: true }
  });

  const handleModuleConfigChange = (moduleName, type, checked) => {
    setModulesConfig(prev => {
      const next = { ...prev };
      next[moduleName] = { ...next[moduleName], [type]: checked };
      if (type === 'write' && checked) {
        next[moduleName].read = true;
      }
      if (type === 'read' && !checked) {
        next[moduleName].write = false;
      }
      return next;
    });
  };

  // Address structures
  const [billing, setBilling] = useState({ street: '', city: '', state: '', zip: '', country: 'Bangladesh' });
  const [shipping, setShipping] = useState({ street: '', city: '', state: '', zip: '', country: 'Bangladesh' });
  const [sameAddress, setSameAddress] = useState(false);

  // General Form States
  const [form, setForm] = useState({
    name: '', org_type: 'Client', industry: 'Real Estate', employee_count: '1-10', description: '',
    email: '', phone: '', secondary_phone: '', website: '', social_link: '',
    trade_license: '', tin_number: '', bin_vat_number: '', currency: 'BDT',
    account_owner_id: '', onboarding_date: '', tags: '', primary_contact_id: '', parent_org_id: '',
    theme_color: '#8B5CF6'
  });

  const isSA = user?.account_type === 'super_admin';
  const orgId = isSA ? currentTenant?.id : user?.org_id;

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // 1. Fetch organization
      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();
      
      if (error) throw error;
      setOrg(orgData);

      // Populate form (filtering out internal module configuration tags)
      setForm({
        name: orgData.name || '',
        org_type: orgData.org_type || 'Client',
        industry: orgData.industry || 'Real Estate',
        employee_count: orgData.employee_count || '1-10',
        description: orgData.description || '',
        email: orgData.email || '',
        phone: orgData.phone || '',
        secondary_phone: orgData.secondary_phone || '',
        website: orgData.website || '',
        social_link: orgData.social_link || '',
        trade_license: orgData.trade_license || '',
        tin_number: orgData.tin_number || '',
        bin_vat_number: orgData.bin_vat_number || '',
        currency: orgData.currency || 'BDT',
        account_owner_id: orgData.account_owner_id || '',
        onboarding_date: orgData.onboarding_date ? orgData.onboarding_date.split('T')[0] : '',
        tags: Array.isArray(orgData.tags) ? orgData.tags.filter(t => !t.startsWith('module:')).join(', ') : '',
        primary_contact_id: orgData.primary_contact_id || '',
        parent_org_id: orgData.parent_org_id || '',
        theme_color: orgData.theme_color || '#8B5CF6'
      });

      if (orgData.billing_address) setBilling({ ...billing, ...orgData.billing_address });
      if (orgData.shipping_address) setShipping({ ...shipping, ...orgData.shipping_address });
      setSameAddress(orgData.same_address || false);

      // Populate custom workspace modules permissions
      const hasCustomModules = Array.isArray(orgData.tags) && orgData.tags.some(t => t.startsWith('module:'));
      if (hasCustomModules) {
        const initialConfig = {
          'Dashboard': { read: false, write: false },
          'Project Management': { read: false, write: false },
          'Lead Management': { read: false, write: false },
          'User Management': { read: false, write: false },
          'Team Management': { read: false, write: false },
          'HR Operations': { read: false, write: false },
          'Calendar & Schedule': { read: false, write: false },
          'Payments': { read: false, write: false },
          'Reports & Analytics': { read: false, write: false },
          'Notifications': { read: false, write: false },
          'Settings': { read: false, write: false }
        };
        orgData.tags.forEach(tag => {
          if (tag.startsWith('module:')) {
            const parts = tag.split(':');
            if (parts.length >= 3) {
              const mName = parts[1];
              const perm = parts[2];
              if (initialConfig[mName]) {
                initialConfig[mName][perm] = true;
              }
            }
          }
        });
        setModulesConfig(initialConfig);
      } else {
        const allowedModules = getOrgModules(orgData.billing_package || 'starter');
        const initialConfig = {
          'Dashboard': { read: true, write: true },
          'Project Management': { read: false, write: false },
          'Lead Management': { read: false, write: false },
          'User Management': { read: false, write: false },
          'Team Management': { read: false, write: false },
          'HR Operations': { read: false, write: false },
          'Calendar & Schedule': { read: false, write: false },
          'Payments': { read: false, write: false },
          'Reports & Analytics': { read: false, write: false },
          'Notifications': { read: false, write: false },
          'Settings': { read: false, write: false }
        };
        Object.keys(initialConfig).forEach(mName => {
          if (allowedModules.includes(mName) || mName === 'Dashboard') {
            initialConfig[mName].read = true;
            initialConfig[mName].write = true;
          }
        });
        setModulesConfig(initialConfig);
      }

      // 2. Fetch users in org
      const { data: users } = await supabase.from('users').select('id, full_name, name').eq('org_id', orgId);
      setOrgUsers(users || []);

      // 3. Fetch all approved orgs (lookup)
      const { data: orgs } = await supabase.from('organizations').select('id, name').eq('status', 'approved');
      setAllOrgs(orgs || []);

    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load organization settings.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      setMessage({ text: 'Please fill in all mandatory fields (Name, Email, Phone).', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage({ text: '', type: 'success' });

    try {
      const finalShipping = sameAddress ? billing : shipping;
      const userTags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      
      const moduleTags = [];
      Object.keys(modulesConfig).forEach(mName => {
        const conf = modulesConfig[mName];
        if (conf.read) moduleTags.push(`module:${mName}:read`);
        if (conf.write) moduleTags.push(`module:${mName}:write`);
      });

      const tagList = [...userTags, ...moduleTags];

      const payload = {
        name: form.name,
        org_type: form.org_type,
        industry: form.industry,
        employee_count: form.employee_count,
        description: form.description,
        email: form.email,
        phone: form.phone,
        secondary_phone: form.secondary_phone,
        website: form.website,
        social_link: form.social_link,
        billing_address: billing,
        shipping_address: finalShipping,
        same_address: sameAddress,
        trade_license: form.trade_license,
        tin_number: form.tin_number,
        bin_vat_number: form.bin_vat_number,
        currency: form.currency,
        account_owner_id: form.account_owner_id || null,
        onboarding_date: form.onboarding_date ? new Date(form.onboarding_date).toISOString() : null,
        tags: tagList,
        primary_contact_id: form.primary_contact_id || null,
        parent_org_id: form.parent_org_id || null,
        theme_color: form.theme_color
      };

      const { error } = await supabase.from('organizations').update(payload).eq('id', orgId);
      if (error) throw error;

      // Update local tenant state if currently active
      if (isSA && currentTenant?.id === orgId) {
        setCurrentTenant({ ...currentTenant, name: form.name, theme_color: form.theme_color });
      }

      setMessage({ text: 'Organization settings updated successfully!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save changes.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading organization settings...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="org-page">
        <div className="org-header">
          <div>
            <h1>My Organization</h1>
            <p>Configure B2B business profile, Jogajoger Tothyo, and custom branding settings.</p>
          </div>
        </div>

        {message.text && (
          <div className={`org-message ${message.type}`}>
            <AlertCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="org-form">
          <div className="org-grid">
            {/* Left columns */}
            <div className="org-col">
              {/* Section 1: Basic Information */}
              <Card title="1. Basic Information" icon={Building2} className="org-card">
                <div className="form-group-row">
                  <label className="org-label">
                    Organization Name <span className="text-red">*</span>
                    <input name="name" value={form.name} onChange={handleChange} required placeholder="Protishthaner nam" />
                  </label>
                  <label className="org-label">
                    Organization Type
                    <select name="org_type" value={form.org_type} onChange={handleChange}>
                      <option>Client</option>
                      <option>Prospect</option>
                      <option>Partner</option>
                      <option>Vendor</option>
                      <option>NGO</option>
                      <option>Government</option>
                    </select>
                  </label>
                </div>
                <div className="form-group-row">
                  <label className="org-label">
                    Industry / Sector
                    <select name="industry" value={form.industry} onChange={handleChange}>
                      <option>Real Estate</option>
                      <option>IT</option>
                      <option>Healthcare</option>
                      <option>Education</option>
                      <option>E-commerce</option>
                      <option>Financial Services</option>
                    </select>
                  </label>
                  <label className="org-label">
                    Number of Employees
                    <select name="employee_count" value={form.employee_count} onChange={handleChange}>
                      <option>1-10</option>
                      <option>11-50</option>
                      <option>51-200</option>
                      <option>200+</option>
                    </select>
                  </label>
                </div>
                <label className="org-label">
                  Description / About
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Company-r kaj ba service somporke short description..." />
                </label>
              </Card>

              {/* Section 2: Contact Details */}
              <Card title="2. Contact Details" icon={Mail} className="org-card">
                <div className="form-group-row">
                  <label className="org-label">
                    Official Email <span className="text-red">*</span>
                    <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="info@company.com" />
                  </label>
                  <label className="org-label">
                    Primary Phone <span className="text-red">*</span>
                    <input name="phone" value={form.phone} onChange={handleChange} required placeholder="Official Phone Number" />
                  </label>
                </div>
                <div className="form-group-row">
                  <label className="org-label">
                    Secondary Phone (Optional)
                    <input name="secondary_phone" value={form.secondary_phone} onChange={handleChange} placeholder="Alternative Phone" />
                  </label>
                  <label className="org-label">
                    Website URL
                    <input name="website" value={form.website} onChange={handleChange} placeholder="https://company.com" />
                  </label>
                </div>
                <label className="org-label">
                  LinkedIn / Social Profile
                  <input name="social_link" value={form.social_link} onChange={handleChange} placeholder="https://linkedin.com/company/..." />
                </label>
              </Card>

              {/* Section 3: Relational Data */}
              <Card title="3. Relational Data" icon={Users} className="org-card">
                <div className="form-group-row">
                  <label className="org-label">
                    Primary Contact Person
                    <select name="primary_contact_id" value={form.primary_contact_id} onChange={handleChange}>
                      <option value="">Select a user...</option>
                      {orgUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="org-label">
                    Parent Organization
                    <select name="parent_org_id" value={form.parent_org_id} onChange={handleChange}>
                      <option value="">None (Independent)</option>
                      {allOrgs.filter(o => o.id !== orgId).map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </Card>

              {/* Section 8: Workspace Module Permissions */}
              <Card title="Workspace Module Permissions" icon={Shield} className="org-card">
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                  Configure active modules and specify Read / Write access for your organization's workspace.
                </p>
                <div className="modules-permissions-table-wrap">
                  <table className="modules-permissions-table">
                    <thead>
                      <tr>
                        <th>Module Name</th>
                        <th style={{ textAlign: 'center', width: '80px' }}>Read</th>
                        <th style={{ textAlign: 'center', width: '80px' }}>Write</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(modulesConfig).map(mName => (
                        <tr key={mName}>
                          <td>
                            <div style={{ fontWeight: 500, color: '#E5E7EB', fontSize: '13px' }}>{mName}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={modulesConfig[mName].read} 
                              onChange={(e) => handleModuleConfigChange(mName, 'read', e.target.checked)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={modulesConfig[mName].write} 
                              onChange={(e) => handleModuleConfigChange(mName, 'write', e.target.checked)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Right columns */}
            <div className="org-col">
              {/* Section 4: Workspace Branding */}
              <Card title="Workspace Branding" icon={Palette} className="org-card select-branding">
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                  Select your organization's primary accent color. This color will apply dynamically to the Leads, Projects, Payments, and Calendar layout workspace.
                </p>
                <div className="theme-options-grid">
                  {THEME_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, theme_color: c.value }))}
                      className={`theme-color-btn ${form.theme_color === c.value ? 'selected' : ''}`}
                      style={{ borderLeft: `5px solid ${c.value}` }}
                    >
                      <div className="theme-color-preview" style={{ background: c.value }}></div>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Custom Color:</span>
                  <input
                    type="color"
                    value={form.theme_color}
                    onChange={(e) => setForm(p => ({ ...p, theme_color: e.target.value }))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', width: 34, height: 34 }}
                  />
                  <span style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#A78BFA' }}>{form.theme_color}</span>
                </div>
              </Card>

              {/* Section 5: Address Information */}
              <Card title="Address Information" icon={Globe} className="org-card">
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: '#E5E7EB', margin: '0 0 10px', fontSize: '12.5px' }}>Billing Address</h4>
                  <div className="address-fields-grid">
                    <input placeholder="Street / Road" value={billing.street || ''} onChange={e => setBilling({ ...billing, street: e.target.value })} />
                    <div className="form-group-row">
                      <input placeholder="City" value={billing.city || ''} onChange={e => setBilling({ ...billing, city: e.target.value })} />
                      <input placeholder="State / Div" value={billing.state || ''} onChange={e => setBilling({ ...billing, state: e.target.value })} />
                    </div>
                    <div className="form-group-row">
                      <input placeholder="Zip Code" value={billing.zip || ''} onChange={e => setBilling({ ...billing, zip: e.target.value })} />
                      <input placeholder="Country" value={billing.country || ''} onChange={e => setBilling({ ...billing, country: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ color: '#E5E7EB', margin: 0, fontSize: '12.5px' }}>Shipping / Office Address</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: '#A78BFA', cursor: 'pointer' }}>
                      <input type="checkbox" checked={sameAddress} onChange={e => setSameAddress(e.target.checked)} />
                      Same as Billing
                    </label>
                  </div>
                  {!sameAddress && (
                    <div className="address-fields-grid">
                      <input placeholder="Street / Road" value={shipping.street || ''} onChange={e => setShipping({ ...shipping, street: e.target.value })} />
                      <div className="form-group-row">
                        <input placeholder="City" value={shipping.city || ''} onChange={e => setShipping({ ...shipping, city: e.target.value })} />
                        <input placeholder="State / Div" value={shipping.state || ''} onChange={e => setShipping({ ...shipping, state: e.target.value })} />
                      </div>
                      <div className="form-group-row">
                        <input placeholder="Zip Code" value={shipping.zip || ''} onChange={e => setShipping({ ...shipping, zip: e.target.value })} />
                        <input placeholder="Country" value={shipping.country || ''} onChange={e => setShipping({ ...shipping, country: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Section 6: Legal & Financial Info */}
              <Card title="Legal & Financial Info" icon={DollarSign} className="org-card">
                <div className="form-group-row">
                  <label className="org-label">
                    Trade License Number
                    <input name="trade_license" value={form.trade_license} onChange={handleChange} placeholder="Trade License No." />
                  </label>
                  <label className="org-label">
                    TIN Number
                    <input name="tin_number" value={form.tin_number} onChange={handleChange} placeholder="12-digit TIN No." />
                  </label>
                </div>
                <div className="form-group-row">
                  <label className="org-label">
                    BIN / VAT Registration
                    <input name="bin_vat_number" value={form.bin_vat_number} onChange={handleChange} placeholder="BIN / VAT No." />
                  </label>
                  <label className="org-label">
                    Default Currency
                    <select name="currency" value={form.currency} onChange={handleChange}>
                      <option>BDT</option>
                      <option>USD</option>
                    </select>
                  </label>
                </div>
              </Card>

              {/* Section 7: Internal System Fields */}
              <Card title="Internal System Fields" icon={Tag} className="org-card">
                <div className="form-group-row">
                  <label className="org-label">
                    Account Owner / Assignee
                    <select name="account_owner_id" value={form.account_owner_id} onChange={handleChange}>
                      <option value="">Select owner...</option>
                      {orgUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="org-label">
                    Onboarding Date
                    <input name="onboarding_date" type="date" value={form.onboarding_date} onChange={handleChange} />
                  </label>
                </div>
                <label className="org-label">
                  Tags / Labels (Comma separated)
                  <input name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. VIP, Dhaka-based, Tech" />
                </label>
              </Card>
            </div>
          </div>

          <div className="org-footer-actions">
            <Button variant="primary" type="submit" isLoading={saving} style={{ padding: '10px 24px' }}>
              Save Organization Profile
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
