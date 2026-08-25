import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import Pagination from '../components/ui/Pagination';
import Toast from '../components/ui/Toast';
import { 
  CreditCard, 
  Clock, 
  Search, 
  Plus, 
  Filter,
  AlertCircle,
  CheckCircle2,
  Calendar,
  History,
  Wallet,
  RefreshCcw,
  Percent,
  Check,
  X,
  FileText,
  Printer,
  Eye
} from 'lucide-react';
import './Payments.css';

const Payments = () => {
  const { user, currentTenant } = useAuth();
  const [activeTab, setActiveTab] = useState('sale_receives');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSalarySheetModal, setShowSalarySheetModal] = useState(false);
  const [showIncentiveClaimModal, setShowIncentiveClaimModal] = useState(false);

  // Selected entities for modals
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedSalarySheet, setSelectedSalarySheet] = useState(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucherVisit, setSelectedVoucherVisit] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);

  // States for list loading
  const [isLoading, setIsLoading] = useState(true);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });
  const [isSaving, setIsSaving] = useState(false);

  // Database lists
  const [paymentsList, setPaymentsList] = useState([]);
  const [salaryApprovals, setSalaryApprovals] = useState([]);
  const [visitAllowances, setVisitAllowances] = useState([]);
  const [incentiveClaims, setIncentiveClaims] = useState([]);
  const [dealsList, setDealsList] = useState([]);
  const [closedLeads, setClosedLeads] = useState([]);

  // Form states for new Client Payment Receipt
  const [formLeadId, setFormLeadId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState('Bank Transfer');
  const [formType, setFormType] = useState('Partial');
  const [formNote, setFormNote] = useState('');

  // Form states for Incentive Claim
  const [selectedDealForClaim, setSelectedDealForClaim] = useState(null);
  const [incentivePercent, setIncentivePercent] = useState('30');
  const [calculatedClaimAmount, setCalculatedClaimAmount] = useState(0);
  const [orgBranding, setOrgBranding] = useState({
    orgName: 'NEST CRM',
    orgLogo: '',
    orgAddress: 'Corporate Office: Jabbar Tower, Gulshan-1, Dhaka-1212, Bangladesh',
    orgPhone: '+880 2-988XXXX',
    orgEmail: 'info@nestcrm.com'
  });

  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  const isAdminOrAccounts = user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin' || user?.role === 'Accounts' || user?.role === 'Accountant';

  // Subscriptions to Supabase tables
  useEffect(() => {
    const fetchAll = async () => {
      const filterTenant = (q) => {
        if (user?.account_type === 'super_admin') {
          if (currentTenant?.type === 'org') return q.eq('org_id', currentTenant.id);
          return q.eq('owner_id', currentTenant.id);
        }
        if (user?.org_id) return q.eq('org_id', user.org_id);
        return q.eq('owner_id', user.uid);
      };

      const [paymentsRes, salariesRes, allowancesRes, incentivesRes, dealsRes, leadsRes, hrRes] = await Promise.all([
        filterTenant(supabase.from('payments').select('*')),
        filterTenant(supabase.from('salary_payroll_approvals').select('*')),
        filterTenant(supabase.from('visit_allowances').select('*')),
        filterTenant(supabase.from('incentive_claims').select('*')),
        filterTenant(supabase.from('deals').select('*')),
        filterTenant(supabase.from('leads').select('*').in('status', ['Sold', 'Deal Closed', 'Closed'])),
        supabase.from('hr_settings').select('*').eq('id', 'config').maybeSingle()
      ]);
      setPaymentsList(paymentsRes.data || []);
      setSalaryApprovals(salariesRes.data || []);
      setVisitAllowances(allowancesRes.data || []);
      setIncentiveClaims(incentivesRes.data || []);
      setDealsList(dealsRes.data || []);
      setClosedLeads(leadsRes.data || []);
      if (hrRes.data) {
        const data = hrRes.data;
        setOrgBranding({
          orgName: data.org_name || data.orgName || 'Nest CRM',
          orgLogo: data.org_logo || data.orgLogo || '',
          orgAddress: data.org_address || data.orgAddress || '',
          orgPhone: data.org_phone || data.orgPhone || '',
          orgEmail: data.org_email || data.orgEmail || ''
        });
      }
      setIsLoading(false);
    };
    fetchAll();
    const ch = supabase.channel('payments-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incentive_claims' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [currentTenant]);

  // Update calculated claim amount when deal or percent changes
  useEffect(() => {
    if (selectedDealForClaim) {
      const dealVal = parseFloat(selectedDealForClaim.dealValue || selectedDealForClaim.value || 0);
      // standard commission is 5% (or user's incentive rate if specified, let's use 5% as default)
      const incentiveRate = parseFloat(user?.salesIncentiveRate) || 5;
      const totalCommission = dealVal * (incentiveRate / 100);
      
      let maxIncentiveForUser = totalCommission;
      if (selectedDealForClaim.hasTeamIncentive && selectedDealForClaim.teamShares) {
        const myShare = selectedDealForClaim.teamShares.find(ts => ts.userId === user.uid);
        if (myShare) {
          if (myShare.type === 'percentage') {
            maxIncentiveForUser = totalCommission * (parseFloat(myShare.value || 0) / 100);
          } else {
            maxIncentiveForUser = parseFloat(myShare.value || 0);
          }
        } else {
          maxIncentiveForUser = 0;
        }
      }
      
      const claimVal = maxIncentiveForUser * (parseFloat(incentivePercent) / 100);
      setCalculatedClaimAmount(Math.round(claimVal));
    }
  }, [selectedDealForClaim, incentivePercent, user]);

  // Handle Client Payment Submit (Salesperson uploads receipt)
  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!formLeadId || !formAmount) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setIsSaving(true);
    try {
      const targetLead = closedLeads.find(l => l.id === formLeadId);
      const leadName = targetLead ? (targetLead.fullName || targetLead.name) : 'Unknown Client';
      const projectName = targetLead ? (targetLead.projectName || 'General') : 'General';

      await supabase.from('payments').insert({
        lead_id: formLeadId,
        lead_name: leadName,
        project_name: projectName,
        amount: parseFloat(formAmount),
        method: formMethod,
        payment_type: formType,
        note: formNote,
        status: 'Pending Approval',
        received_by: user.uid,
        received_by_name: user.full_name || user.fullName || user.name || 'Sales Representative',
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

      showToast('Client money receipt uploaded! Awaiting Accounts Approval.', 'success');
      setShowAddModal(false);
      setFormLeadId('');
      setFormAmount('');
      setFormNote('');
    } catch (err) {
      console.error(err);
      showToast('Failed to upload client payment', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Client Payment Approval (Accounts)
  const handleApprovePayment = async (payId, status) => {
    try {
      await supabase.from('payments').update({
        status,
        approved_by: user.full_name || user.fullName || user.name || 'Accounts Staff',
        approved_at: new Date().toISOString()
      }).eq('id', payId);
      showToast(`Payment receipt marked as ${status}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update payment status', 'error');
    }
  };

  // Handle Salary Sheet Approval (Accounts)
  const handleApproveSalarySheet = async (sheetId, status) => {
    try {
      await supabase.from('salary_payroll_approvals').update({
        status,
        approved_by: user.full_name || user.fullName || user.name || 'Accounts Manager',
        approved_at: new Date().toISOString()
      }).eq('id', sheetId);
      setSelectedSalarySheet(prev => prev && prev.id === sheetId ? { ...prev, status } : prev);
      showToast(`Salary payroll sheet has been set to ${status}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update salary sheet status', 'error');
    }
  };

  // Handle Visit Allowance Approval (Accounts)
  const handleApproveVisitAllowance = async (allowanceId, status) => {
    try {
      await supabase.from('visit_allowances').update({
        status,
        approved_by: user.full_name || user.fullName || user.name || 'Accounts Representative',
        approved_at: new Date().toISOString()
      }).eq('id', allowanceId);
      showToast(`Visit Allowance marked as ${status}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to process allowance status', 'error');
    }
  };

  // Handle Payout Incentive Request Submit (Salesperson)
  const handleSubmitIncentiveClaim = async (e) => {
    if (e) e.preventDefault();
    if (!selectedDealForClaim || !calculatedClaimAmount) return;

    const dealId = selectedDealForClaim.id;
    
    // Check Client Payment Received Threshold
    const dealVal = parseFloat(selectedDealForClaim.dealValue || selectedDealForClaim.value || 0);
    const approvedReceivedAmount = getDealPaidApprovedAmount(selectedDealForClaim.leadId || selectedDealForClaim.id);
    const percentReceived = dealVal > 0 ? (approvedReceivedAmount / dealVal) * 100 : 0;
    const threshold = parseFloat(selectedDealForClaim.incentiveThresholdPercent) || 30;

    if (percentReceived < threshold) {
      showToast(`Incentive claim failed. Accounts has only approved ${percentReceived.toFixed(1)}% of payments. (Required threshold: ${threshold}%)`, "error");
      return;
    }

    // Check if user already claimed up to 100% of their allocated percentage
    const dealClaims = incentiveClaims.filter(c => c.dealId === dealId && c.userId === user.uid && c.status !== 'Rejected');
    const totalClaimedPercent = dealClaims.reduce((acc, c) => acc + (parseFloat(c.requestedPercentage) || 0), 0);

    if (totalClaimedPercent + parseFloat(incentivePercent) > 100) {
      showToast(`Limit exceeded. You have already claimed ${totalClaimedPercent}% of your incentives for this project.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      const incentiveRate = parseFloat(user?.salesIncentiveRate) || 5;
      const totalCommission = dealVal * (incentiveRate / 100);

      await supabase.from('incentive_claims').insert({
        deal_id: dealId,
        project_name: selectedDealForClaim.project_name || selectedDealForClaim.projectName,
        deal_value: dealVal,
        total_incentive: totalCommission,
        requested_percentage: parseFloat(incentivePercent),
        requested_amount: calculatedClaimAmount,
        status: 'Pending Approval',
        user_id: user.uid,
        user_name: user.full_name || user.fullName || user.name || 'Sales Staff',
        created_at: new Date().toISOString()
      });

      showToast(`Incentive payout claim of ${incentivePercent}% submitted to Accounts!`, 'success');
      setShowIncentiveClaimModal(false);
      setSelectedDealForClaim(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to submit incentive claim', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Incentive Claim Approval (Accounts)
  const handleApproveIncentiveClaim = async (claimId, status) => {
    try {
      await supabase.from('incentive_claims').update({
        status,
        approved_by: user.full_name || user.fullName || user.name || 'Accounts Auditor',
        approved_at: new Date().toISOString()
      }).eq('id', claimId);
      showToast(`Incentive claim ${status === 'Approved' ? 'Approved & Paid' : 'Rejected'}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to process incentive claim', 'error');
    }
  };

  // Helper: check if a deal has been fully or partially paid and approved by accounts
  const getDealPaidApprovedAmount = (leadId) => {
    const approvedPayments = paymentsList.filter(p => p.leadId === leadId && p.status === 'Approved');
    return approvedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  // Filters and searches based on active tab
  const getFilteredData = () => {
    if (activeTab === 'sale_receives') {
      return paymentsList.filter(p => 
        p.leadName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'salary_approvals') {
      return salaryApprovals.filter(s => 
        s.month.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'visit_allowances') {
      return visitAllowances.filter(v => 
        v.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'incentive_claims') {
      return incentiveClaims.filter(i => 
        i.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'trans_history') {
      // Compiled approved lists
      const approvedPayments = paymentsList.filter(p => p.status === 'Approved').map(p => ({
        ...p,
        type: 'Client Payment Received',
        icon: CheckCircle2,
        color: 'var(--success)'
      }));
      const approvedSalaries = salaryApprovals.filter(s => s.status === 'Approved').map(s => ({
        ...s,
        leadName: `Salary Roll - ${s.month}`,
        amount: s.totalPayable,
        type: 'Employee Salary Paid',
        icon: Wallet,
        color: 'var(--info)'
      }));
      const approvedVisits = visitAllowances.filter(v => v.status === 'Approved').map(v => ({
        ...v,
        leadName: `Visit Allowance - ${v.leadName}`,
        type: 'Visit Allowance Paid',
        icon: FileText,
        color: 'var(--primary)'
      }));
      const approvedIncentives = incentiveClaims.filter(i => i.status === 'Approved').map(i => ({
        ...i,
        leadName: `Incentive - ${i.userName}`,
        amount: i.requestedAmount,
        type: 'Sales Incentive Paid',
        icon: Percent,
        color: 'var(--warning)'
      }));

      return [...approvedPayments, ...approvedSalaries, ...approvedVisits, ...approvedIncentives]
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .filter(t => t.leadName.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return [];
  };

  const filteredItems = getFilteredData();
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Financial analytics summaries
  const totalReceived = paymentsList.filter(p => p.status === 'Approved').reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const totalSalaries = salaryApprovals.filter(s => s.status === 'Approved').reduce((acc, s) => acc + (parseFloat(s.totalPayable) || 0), 0);
  const totalClaims = incentiveClaims.filter(i => i.status === 'Approved').reduce((acc, i) => acc + (parseFloat(i.requestedAmount) || 0), 0);
  const totalVisits = visitAllowances.filter(v => v.status === 'Approved').reduce((acc, v) => acc + (parseFloat(v.amount) || 0), 0);

  const totalExpense = totalSalaries + totalClaims + totalVisits;

  return (
    <DashboardLayout>
      <div className="payments-container">
        
        {/* Top Summary Cards */}
        <div className="payment-summary-grid">
          <Card className="summary-card total">
            <div className="summary-icon brand" style={{ fontSize: '1.4rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>৳</div>
            <div className="summary-content">
              <span className="summary-label">Total Revenue</span>
              <h2 className="summary-value">BDT {totalReceived.toLocaleString('en-US')}</h2>
              <div className="summary-footer">
                <span className="summary-period">Total Approved Receipts</span>
              </div>
            </div>
          </Card>

          <Card className="summary-card collected">
            <div className="summary-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><Wallet size={24} /></div>
            <div className="summary-content">
              <span className="summary-label">Salary Expense</span>
              <h2 className="summary-value">BDT {totalSalaries.toLocaleString('en-US')}</h2>
              <div className="summary-footer">
                <span className="summary-period">Staff Salary Paid</span>
              </div>
            </div>
          </Card>

          <Card className="summary-card recent">
            <div className="summary-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Percent size={24} /></div>
            <div className="summary-content">
              <span className="summary-label">Incentives Paid</span>
              <h2 className="summary-value">BDT {totalClaims.toLocaleString('en-US')}</h2>
              <div className="summary-footer">
                <span className="summary-period">Agent Payouts Approved</span>
              </div>
            </div>
          </Card>

          <Card className="summary-card due">
            <div className="summary-icon" style={{ background: '#f5f5f5', color: '#666' }}><History size={24} /></div>
            <div className="summary-content">
              <span className="summary-label">Total Outflow</span>
              <h2 className="summary-value">BDT {totalExpense.toLocaleString('en-US')}</h2>
              <div className="summary-footer">
                <span className="summary-period">Salaries + Claims + Visits</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Dashboard Title & Actions */}
        <div className="payments-header" style={{ marginTop: '30px' }}>
          <div className="header-info">
            <h1>Accounts & Approvals Center</h1>
            <p>Approve salaries, verify property sell receive vouchers, and payout incentives.</p>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            
            {/* Sales Representative Action to Claim Payout or submit money receipt */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                variant="secondary" 
                icon={Percent} 
                onClick={() => setShowIncentiveClaimModal(true)}
              >
                Claim Incentive
              </Button>
              <Button 
                variant="primary" 
                icon={Plus} 
                onClick={() => setShowAddModal(true)}
              >
                Add Receipt
              </Button>
            </div>
          </div>
        </div>

        {/* Custom Approvals Tab Layout */}
        <div className="followups-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <button 
            className={`tab-btn ${activeTab === 'sale_receives' ? 'active' : ''}`}
            onClick={() => { setActiveTab('sale_receives'); setCurrentPage(1); }}
          >
            <span style={{ fontWeight: 'bold', marginRight: '4px', fontSize: '1.1rem' }}>৳</span>
            Client Payments ({paymentsList.filter(p => p.status === 'Pending Approval').length} Pending)
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'salary_approvals' ? 'active' : ''}`}
            onClick={() => { setActiveTab('salary_approvals'); setCurrentPage(1); }}
          >
            <Wallet size={16} />
            Salary Approvals ({salaryApprovals.filter(s => s.status === 'Pending Approval').length} Pending)
          </button>

          <button 
            className={`tab-btn ${activeTab === 'incentive_claims' ? 'active' : ''}`}
            onClick={() => { setActiveTab('incentive_claims'); setCurrentPage(1); }}
          >
            <Percent size={16} />
            Incentive Claims ({incentiveClaims.filter(c => c.status === 'Pending Approval').length} Pending)
          </button>

          <button 
            className={`tab-btn ${activeTab === 'visit_allowances' ? 'active' : ''}`}
            onClick={() => { setActiveTab('visit_allowances'); setCurrentPage(1); }}
          >
            <FileText size={16} />
            Visit Allowance ({visitAllowances.filter(v => v.status === 'Pending Approval').length} Pending)
          </button>

          <button 
            className={`tab-btn ${activeTab === 'trans_history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trans_history'); setCurrentPage(1); }}
          >
            <History size={16} />
            Transaction Log
          </button>
        </div>

        {/* Dynamic List Render */}
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              {activeTab === 'sale_receives' && (
                <tr>
                  <th>Client & Project</th>
                  <th>Amount Received</th>
                  <th>Method</th>
                  <th>Sales Agent</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              )}
              {activeTab === 'salary_approvals' && (
                <tr>
                  <th>Salary Month</th>
                  <th>Total Payable</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              )}
              {activeTab === 'incentive_claims' && (
                <tr>
                  <th>Salesperson</th>
                  <th>Project Details</th>
                  <th>Incentive Claim BDT</th>
                  <th>Percentage</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              )}
              {activeTab === 'visit_allowances' && (
                <tr>
                  <th>Client & Project</th>
                  <th>Allowance Requested</th>
                  <th>Destination</th>
                  <th>Salesperson</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              )}
              {activeTab === 'trans_history' && (
                <tr>
                  <th>Log description</th>
                  <th>Transaction Type</th>
                  <th>Amount Paid/Recv</th>
                  <th>Date Approved</th>
                  <th>Approver</th>
                  <th className="text-right">Ref ID</th>
                </tr>
              )}
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td><Skeleton width="150px" height="30px" /></td>
                    <td><Skeleton width="100px" /></td>
                    <td><Skeleton width="80px" /></td>
                    <td><Skeleton width="100px" /></td>
                    <td><Skeleton width="70px" /></td>
                    <td className="text-right"><Skeleton width="40px" /></td>
                  </tr>
                ))
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state-payments">
                      <Wallet size={48} />
                      <h3>No items found</h3>
                      <p>Everything is currently up to date in this section.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => (
                  <tr key={item.id} className="payment-row">
                    
                    {/* Tab 1: Client Payments */}
                    {activeTab === 'sale_receives' && (
                      <>
                        <td>
                          <div className="lead-cell">
                            <div className="lead-avatar-sm">{item.leadName[0]}</div>
                            <div className="lead-info-mini">
                              <span className="lead-name-small">{item.leadName}</span>
                              <span className="lead-deal-small">{item.projectName}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="amount-val">BDT {parseFloat(item.amount || 0).toLocaleString()}</span>
                        </td>
                        <td>
                          <div className="method-cell-v2">
                            <CreditCard size={14} className="icon-card" />
                            <span>{item.method} ({item.paymentType})</span>
                          </div>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.receivedByName}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${item.status === 'Approved' ? 'paid' : item.status === 'Pending Approval' ? 'pending' : 'partial'}`} style={{ textTransform: 'capitalize' }}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-row-actions">
                            {item.status === 'Pending Approval' && isAdminOrAccounts ? (
                              <>
                                <button className="row-action-btn" title="Approve Payment" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => handleApprovePayment(item.id, 'Approved')}><Check size={16} /></button>
                                <button className="row-action-btn delete" title="Reject Payment" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleApprovePayment(item.id, 'Rejected')}><X size={16} /></button>
                              </>
                            ) : (
                              <span className="lead-deal-small">{item.approvedBy ? `Approved by ${item.approvedBy}` : 'Locked'}</span>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Tab 2: Salary Approvals */}
                    {activeTab === 'salary_approvals' && (
                      <>
                        <td>
                          <div className="method-cell-v2">
                            <Calendar size={14} className="icon-calendar" />
                            <strong style={{ color: 'var(--text-primary)' }}>Payroll - {item.month}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="amount-val" style={{ color: 'var(--info)' }}>BDT {parseFloat(item.totalPayable || 0).toLocaleString()}</span>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.submittedBy}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${item.status === 'Approved' ? 'paid' : 'pending'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-row-actions" style={{ gap: '8px' }}>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => {
                                setSelectedSalarySheet(item);
                                setShowSalarySheetModal(true);
                              }}
                            >
                              View Sheet
                            </Button>
                            {item.status === 'Pending Approval' && isAdminOrAccounts && (
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleApproveSalarySheet(item.id, 'Approved')}
                              >
                                Approve & Pay
                              </Button>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Tab 3: Incentive Claims */}
                    {activeTab === 'incentive_claims' && (
                      <>
                        <td>
                          <div className="lead-cell">
                            <div className="lead-avatar-sm" style={{ background: '#fef3c7', color: '#d97706' }}>{item.userName[0]}</div>
                            <div className="lead-info-mini">
                              <span className="lead-name-small">{item.userName}</span>
                              <span className="lead-deal-small">Agent Executive</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="lead-info-mini">
                            <span className="lead-name-small">{item.projectName}</span>
                            <span className="lead-deal-small">Total Commission: BDT {parseFloat(item.totalIncentive || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td>
                          <strong className="amount-val" style={{ color: 'var(--success)' }}>BDT {parseFloat(item.requestedAmount || 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.requestedPercentage}% payout</span>
                        </td>
                        <td>
                          <span className={`status-pill ${item.status === 'Approved' ? 'paid' : item.status === 'Pending Approval' ? 'pending' : 'partial'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-row-actions">
                            {item.status === 'Pending Approval' && isAdminOrAccounts ? (
                              <>
                                <button className="row-action-btn" title="Approve Claim" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => handleApproveIncentiveClaim(item.id, 'Approved')}><Check size={16} /></button>
                                <button className="row-action-btn delete" title="Reject Claim" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleApproveIncentiveClaim(item.id, 'Rejected')}><X size={16} /></button>
                              </>
                            ) : (
                              <span className="lead-deal-small">{item.approvedBy ? `Approved by ${item.approvedBy}` : 'Claim Completed'}</span>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Tab 4: Visit Allowance Approvals */}
                    {activeTab === 'visit_allowances' && (
                      <>
                        <td>
                          <div className="lead-cell">
                            <div className="lead-avatar-sm" style={{ background: '#e0f2fe', color: '#0284c7' }}>{item.leadName[0]}</div>
                            <div className="lead-info-mini">
                              <span className="lead-name-small">{item.leadName}</span>
                              <span className="lead-deal-small">{item.company}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="amount-val" style={{ color: 'var(--primary)' }}>BDT {parseFloat(item.amount || 0).toLocaleString()}</span>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.location}</span>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.requestedByName}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${item.status === 'Approved' ? 'paid' : item.status === 'Pending Approval' ? 'pending' : 'partial'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="table-row-actions" style={{ gap: '8px' }}>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              icon={Printer} 
                              onClick={() => {
                                setSelectedVoucherVisit({
                                  id: item.id,
                                  name: item.leadName,
                                  company: item.company || 'General Lead',
                                  visitDate: item.visitDate || '',
                                  visitTime: item.visitTime || '10:00 AM',
                                  location: item.location || 'Not Specified',
                                  allowanceAmount: item.amount,
                                  note: item.note || '',
                                  allowanceStatus: item.status,
                                  assignedToName: item.requestedByName
                                });
                                setShowVoucherModal(true);
                              }}
                            >
                              Print
                            </Button>
                            {item.status === 'Pending Approval' && isAdminOrAccounts ? (
                              <>
                                <button className="row-action-btn" title="Approve Allowance" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => handleApproveVisitAllowance(item.id, 'Approved')}><Check size={16} /></button>
                                <button className="row-action-btn delete" title="Reject Allowance" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleApproveVisitAllowance(item.id, 'Rejected')}><X size={16} /></button>
                              </>
                            ) : (
                              <span className="lead-deal-small">{item.approvedBy ? `Approved by ${item.approvedBy}` : 'Locked'}</span>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Tab 5: Transaction History */}
                    {activeTab === 'trans_history' && (
                      <>
                        <td>
                          <div className="lead-cell">
                            <div className="lead-avatar-sm" style={{ background: '#f3f4f6', color: '#1f2937' }}><item.icon size={14} /></div>
                            <div className="lead-info-mini">
                              <span className="lead-name-small">{item.leadName}</span>
                              <span className="lead-deal-small">{item.projectName}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="lead-deal-small" style={{ fontWeight: 600 }}>{item.type}</span>
                        </td>
                        <td>
                          <span className="amount-val" style={{ color: item.color }}>
                            {item.type === 'Client Payment Received' ? '+' : '-'} BDT {parseFloat(item.amount || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span className="lead-deal-small">
                            {item.approvedAt ? new Date(item.approvedAt.seconds * 1000).toLocaleDateString('en-GB') : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="lead-deal-small">{item.approvedBy}</span>
                        </td>
                        <td>
                          <span className="lead-deal-small" style={{ fontFamily: 'monospace' }}>#{item.id.substring(0, 8).toUpperCase()}</span>
                        </td>
                      </>
                    )}

                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          <Pagination 
            currentPage={currentPage}
            totalPages={Math.ceil(filteredItems.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={filteredItems.length}
            itemsPerPage={itemsPerPage}
          />
        </div>

        {/* Modal: Add Client Payment Receipt */}
        <Modal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)}
          title="Record Client Project Payment"
          className="glass-modal"
        >
          <form className="entry-form" onSubmit={handleAddPayment}>
            <div className="form-group">
              <label className="form-label">Client Lead</label>
              <div className="priority-select-wrapper">
                <select 
                  className="custom-select-field" 
                  value={formLeadId}
                  onChange={(e) => setFormLeadId(e.target.value)}
                  required
                >
                  <option value="">Select Closed/Sold Lead...</option>
                  {closedLeads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.fullName || l.name} - {l.projectName} (Deal Value: BDT {parseFloat(l.dealValue || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-dual">
              <div className="form-group">
                <label className="form-label">Amount (BDT)</label>
                <div className="priority-select-wrapper">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-muted)', width: '18px', height: '18px' }}>৳</span>
                  <input 
                    type="number" 
                    className="custom-select-field" 
                    placeholder="Enter BDT amount" 
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required 
                    min="1"
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <div className="priority-select-wrapper">
                  <CreditCard className="input-icon" size={18} />
                  <select 
                    className="custom-select-field"
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash Payment</option>
                    <option value="Cheque">Cheque Deposit</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Breakdown Type</label>
              <div className="toggle-group-v2">
                <button 
                  type="button" 
                  className={`toggle-item ${formType === 'Partial' ? 'active' : ''}`}
                  onClick={() => setFormType('Partial')}
                >
                  Partial Installment
                </button>
                <button 
                  type="button" 
                  className={`toggle-item ${formType === 'Full Payment' ? 'active' : ''}`}
                  onClick={() => setFormType('Full Payment')}
                >
                  Full Booking Payment
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Description / Notes</label>
              <textarea 
                className="custom-textarea" 
                placeholder="e.g. Bank slip transaction reference or bank check deposit details..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              ></textarea>
            </div>

            <div className="form-actions mt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} disabled={isSaving}>Cancel</Button>
              <Button variant="primary" type="submit" isLoading={isSaving}>Save Receipt</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: View Generated Salary Sheet Details */}
        <Modal
          isOpen={showSalarySheetModal}
          onClose={() => setShowSalarySheetModal(false)}
          title={`Monthly Payroll Details - ${selectedSalarySheet?.month}`}
          className="glass-modal"
          size="lg"
        >
          {selectedSalarySheet && (
            <div style={{ padding: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }} className="print-btn-no-print">
                <div>
                  <strong>Submitted By:</strong> {selectedSalarySheet.submittedBy}
                </div>
                <div>
                  <strong>Status:</strong> <span className={`status-badge ${selectedSalarySheet.status === 'Approved' ? 'deal-confirmed' : 'follow-up'}`} style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}>{selectedSalarySheet.status}</span>
                </div>
              </div>
              <div className="payroll-sheet-section">
                {/* Print area matching Project Visit Slip layout */}
                <div className="visit-voucher-print-area payroll-print-sheet-area" style={{ position: 'relative', overflowX: 'auto', background: '#ffffff', color: '#000000', padding: '30px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  {selectedSalarySheet.status === 'Approved' && (
                    <div className="voucher-watermark" style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-30deg)',
                      fontSize: '5rem',
                      fontWeight: 900,
                      color: 'rgba(34, 197, 94, 0.15)',
                      border: '6px dashed rgba(34, 197, 94, 0.25)',
                      padding: '8px 25px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      pointerEvents: 'none',
                      zIndex: 100,
                      letterSpacing: '3px'
                    }}>APPROVED</div>
                  )}

                  {/* Company Pad Header */}
                  <div className="voucher-header-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '25px', borderBottom: '3px double #1e3a8a', paddingBottom: '15px' }}>
                    {orgBranding.orgLogo && (
                      <img src={orgBranding.orgLogo} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                    )}
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{orgBranding.orgName}</h1>
                    <p style={{ fontSize: '0.875rem', color: '#475569', margin: '2px 0' }}>{orgBranding.orgAddress}</p>
                    {(orgBranding.orgPhone || orgBranding.orgEmail) && (
                      <p style={{ fontSize: '0.875rem', color: '#475569', margin: '2px 0' }}>
                        {orgBranding.orgPhone && `Phone: ${orgBranding.orgPhone}`} 
                        {orgBranding.orgPhone && orgBranding.orgEmail && ' | '}
                        {orgBranding.orgEmail && `Email: ${orgBranding.orgEmail}`}
                      </p>
                    )}
                    <div className="voucher-title-chip" style={{ display: 'inline-block', background: '#1e3a8a', color: '#ffffff', padding: '6px 20px', fontSize: '1.1rem', fontWeight: 700, borderRadius: '5px', marginTop: '15px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Monthly Salary Payroll Sheet - {selectedSalarySheet.month}
                    </div>
                  </div>

                  <table className="hr-data-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#000000', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '10px', textAlign: 'left', color: '#0f172a', fontWeight: 700 }}>Employee Name</th>
                        <th style={{ padding: '10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Gross BDT</th>
                        <th style={{ padding: '10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Deductions</th>
                        <th style={{ padding: '10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Commission</th>
                        <th style={{ padding: '10px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>Net Payable</th>
                        <th style={{ padding: '10px', textAlign: 'right' }} className="print-btn-no-print">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSalarySheet.payrollRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px', color: '#334155' }}>{row.employeeName}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>{parseFloat(row.grossSalary || row.baseSalary || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444' }}>{parseFloat(row.deductions || row.totalDeduction || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#22c55e' }}>{parseFloat(row.commission || row.salesIncentive || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{parseFloat(row.netPayable || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }} className="print-btn-no-print">
                            <button 
                              onClick={() => {
                                setSelectedPayslip({
                                  ...row,
                                  month: selectedSalarySheet.month,
                                  isApproved: selectedSalarySheet.status === 'Approved'
                                });
                                setIsPayslipModalOpen(true);
                              }}
                              className="payslip-btn-icon"
                              style={{ background: 'rgba(138, 110, 47, 0.15)', color: 'var(--primary)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                            >
                              <Eye size={12} /> Payslip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ textAlign: 'right', marginTop: '20px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', borderTop: '2px solid #cbd5e1', paddingTop: '15px' }}>
                    Grand Total Payable: <span style={{ color: '#2563eb' }}>BDT {parseFloat(selectedSalarySheet.totalPayable || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Seal and Sign Space */}
                  <div className="sheet-signatures" style={{ display: 'none', justifyContent: 'space-between', marginTop: '60px', padding: '20px 10px' }}>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Prepared By (HR)</span>
                    </div>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Checked By (Accounts)</span>
                    </div>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Approved & Sealed (MD)</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="form-actions mt-4 print-btn-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                {(user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'Accounts' || user?.role === 'System Admin') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Set Approval Status:</span>
                    <select
                      value={selectedSalarySheet.status}
                      onChange={(e) => handleApproveSalarySheet(selectedSalarySheet.id, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--background-secondary)',
                        color: 'var(--text)',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                ) : <div />}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button variant="secondary" onClick={() => setShowSalarySheetModal(false)}>Close</Button>
                  <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print Sheet</Button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Salary Slip / Payslip Modal */}
        <Modal
          isOpen={isPayslipModalOpen}
          onClose={() => setIsPayslipModalOpen(false)}
          title="Employee Payslip Receipt"
          size="lg"
        >
          {selectedPayslip && (
            <div>
              <div className="payslip-print-area" style={{ position: 'relative' }}>
                {(selectedPayslip.isApproved || selectedSalarySheet?.status === 'Approved') && (
                  <div className="payslip-watermark">APPROVED</div>
                )}
                <div className="payslip-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                  {orgBranding.orgLogo && (
                    <img src={orgBranding.orgLogo} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                  )}
                  <h2>{orgBranding.orgName || 'NEST CRM'}</h2>
                  <p>{orgBranding.orgAddress || 'House 12, Road 5, Banani, Dhaka, Bangladesh'}</p>
                  {(orgBranding.orgPhone || orgBranding.orgEmail) && (
                    <p style={{ fontSize: '0.8rem', marginTop: '-4px' }}>
                      {orgBranding.orgPhone && `Phone: ${orgBranding.orgPhone}`} 
                      {orgBranding.orgPhone && orgBranding.orgEmail && ' | '}
                      {orgBranding.orgEmail && `Email: ${orgBranding.orgEmail}`}
                    </p>
                  )}
                  <div className="payslip-title" style={{ marginTop: '12px' }}>Salary Slip Receipt</div>
                </div>

                <div className="payslip-details-grid">
                  <div className="payslip-col">
                    <span>Employee Name</span>
                    <strong>{selectedPayslip.employeeName}</strong>
                  </div>
                  <div className="payslip-col">
                    <span>Email Address</span>
                    <strong>{selectedPayslip.employeeEmail || ''}</strong>
                  </div>
                  <div className="payslip-col">
                    <span>System Designation / Role</span>
                    <strong>{selectedPayslip.role || 'Staff'}</strong>
                  </div>
                  <div className="payslip-col">
                    <span>Salary Pay Period</span>
                    <strong>{selectedPayslip.month}</strong>
                  </div>
                </div>

                <div className="payslip-breakdown">
                  <table className="breakdown-table">
                    <thead>
                      <tr>
                        <th>Earnings Component</th>
                        <th style={{ textAlign: 'right' }}>Amount (BDT)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Basic Salary</td>
                        <td style={{ textAlign: 'right' }}>{(parseFloat(selectedPayslip.baseSalary || selectedPayslip.grossSalary || 0)).toLocaleString()}</td>
                      </tr>
                      {selectedPayslip.salaryStructure?.houseRent > 0 && (
                        <tr>
                          <td>House Rent Allowance</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.salaryStructure.houseRent || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.salaryStructure?.medical > 0 && (
                        <tr>
                          <td>Medical Allowance</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.salaryStructure.medical || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.salaryStructure?.transport > 0 && (
                        <tr>
                          <td>Transport Allowance</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.salaryStructure.transport || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.salaryStructure?.otherAllowance > 0 && (
                        <tr>
                          <td>Other Allowances</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.salaryStructure.otherAllowance || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.otPay > 0 && (
                        <tr>
                          <td>Overtime Pay ({selectedPayslip.otHours || 0} hrs)</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.otPay || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.salesIncentive > 0 && (
                        <tr>
                          <td>Sales Incentive Commission</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(selectedPayslip.salesIncentive || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                        <th>Deductions Component</th>
                        <th style={{ textAlign: 'right' }}>Amount (BDT)</th>
                      </tr>
                      {selectedPayslip.providentFund > 0 && (
                        <tr>
                          <td className="text-danger">Provident Fund Contribution</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.providentFund || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.incomeTax > 0 && (
                        <tr>
                          <td className="text-danger">Income Tax (TDS) (BD Gov Rules)</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.incomeTax || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.loan > 0 && (
                        <tr>
                          <td className="text-danger">Loan Repayment / Advance</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.loan || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.otherDeductions > 0 && (
                        <tr>
                          <td className="text-danger">Other Deductions</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.otherDeductions || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.absenceDeduction > 0 && (
                        <tr>
                          <td className="text-danger">Unpaid Absences ({selectedPayslip.absentDays || 0} days)</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.absenceDeduction || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedPayslip.latePenaltyDeduction > 0 && (
                        <tr>
                          <td className="text-danger">Late Penalties ({selectedPayslip.lateCount || 0} lates)</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{parseFloat(selectedPayslip.latePenaltyDeduction || 0).toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="grand-total-row">
                        <td><strong>NET PAYABLE SALARY</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                          BDT {parseFloat(selectedPayslip.netPayable || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="payslip-footer">
                  <div className="signature-box">
                    <div className="sig-line"></div>
                    <span>Employee Signature</span>
                  </div>
                  <div className="signature-box">
                    <div className="sig-line"></div>
                    <span>Authorized HR Executive</span>
                  </div>
                </div>
              </div>

              <div className="payslip-print-actions">
                <Button variant="outline" onClick={() => setIsPayslipModalOpen(false)}>Close</Button>
                <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                  Print Payslip
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: Apply for Payout of Sales Incentives */}
        <Modal
          isOpen={showIncentiveClaimModal}
          onClose={() => setShowIncentiveClaimModal(false)}
          title="Apply for Sales Incentive Payout"
          className="glass-modal"
        >
          <form className="entry-form" onSubmit={handleSubmitIncentiveClaim}>
            <div className="form-group">
              <label className="form-label">Select Sold Project Deal</label>
              <div className="priority-select-wrapper">
                <select
                  className="custom-select-field"
                  value={selectedDealForClaim ? selectedDealForClaim.id : ''}
                  onChange={(e) => {
                    const matched = dealsList.find(d => d.id === e.target.value);
                    setSelectedDealForClaim(matched);
                  }}
                  required
                >
                  <option value="">Choose closed project...</option>
                  {dealsList
                    .filter(d => d.createdBy === user.uid || (d.teamShares && d.teamShares.some(ts => ts.userId === user.uid)))
                    .map(d => {
                      const collected = getDealPaidApprovedAmount(d.leadId || d.id);
                      return (
                        <option key={d.id} value={d.id}>
                          {d.projectName} (Unit: {d.unitNo || 'N/A'}) - BDT {parseFloat(d.dealValue || d.value || 0).toLocaleString()} (Recv: BDT {collected.toLocaleString()})
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {selectedDealForClaim && (() => {
              const dealVal = parseFloat(selectedDealForClaim.dealValue || selectedDealForClaim.value || 0);
              const approvedReceivedAmount = getDealPaidApprovedAmount(selectedDealForClaim.leadId || selectedDealForClaim.id);
              const percentReceived = dealVal > 0 ? (approvedReceivedAmount / dealVal) * 100 : 0;
              const threshold = parseFloat(selectedDealForClaim.incentiveThresholdPercent) || 30;
              const isEligible = percentReceived >= threshold;

              const creatorIncentiveRate = parseFloat(user?.salesIncentiveRate) || 5;
              const totalCommission = dealVal * (creatorIncentiveRate / 100);

              let maxIncentiveForUser = totalCommission;
              let myShareInfo = null;
              if (selectedDealForClaim.hasTeamIncentive && selectedDealForClaim.teamShares) {
                myShareInfo = selectedDealForClaim.teamShares.find(ts => ts.userId === user.uid);
                if (myShareInfo) {
                  if (myShareInfo.type === 'percentage') {
                    maxIncentiveForUser = totalCommission * (parseFloat(myShareInfo.value || 0) / 100);
                  } else {
                    maxIncentiveForUser = parseFloat(myShareInfo.value || 0);
                  }
                } else {
                  maxIncentiveForUser = 0;
                }
              }

              return (
                <>
                  <div style={{ background: 'var(--card-bg, #f8fafc)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Deal Value:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>BDT {dealVal.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Deal Commission ({creatorIncentiveRate}%):</span>
                      <strong style={{ color: 'var(--text-primary)' }}>BDT {totalCommission.toLocaleString()}</strong>
                    </div>
                    
                    {selectedDealForClaim.hasTeamIncentive && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Your Allocated Team Share:</span>
                        <strong style={{ color: 'var(--primary)' }}>
                          {myShareInfo 
                            ? (myShareInfo.type === 'percentage' ? `${myShareInfo.value}% (BDT ${maxIncentiveForUser.toLocaleString()})` : `BDT ${parseFloat(myShareInfo.value).toLocaleString()}`)
                            : '0% (Not in team share)'
                          }
                        </strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span>Approved Client Payment:</span>
                      <strong>BDT {approvedReceivedAmount.toLocaleString()} ({percentReceived.toFixed(1)}%)</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Eligibility Threshold Required:</span>
                      <strong>{threshold}% Received</strong>
                    </div>
                  </div>

                  {/* Eligibility Alert Status */}
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    lineHeight: '1.4',
                    background: isEligible ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    color: isEligible ? '#16a34a' : '#dc2626',
                    border: `1px solid ${isEligible ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`
                  }}>
                    {isEligible ? (
                      <span>✓ Eligible: Approved received payment ({percentReceived.toFixed(1)}%) satisfies the {threshold}% incentive payout threshold.</span>
                    ) : (
                      <span>✗ Ineligible: Accounts must approve at least {threshold}% of deal payments before you can claim incentives. Currently only {percentReceived.toFixed(1)}% is approved.</span>
                    )}
                  </div>

                  <div className="form-group mt-3">
                    <label className="form-label">Select Payout Percentage</label>
                    <div className="priority-select-wrapper">
                      <Percent className="input-icon" size={18} />
                      <select
                        className="custom-select-field"
                        value={incentivePercent}
                        onChange={(e) => setIncentivePercent(e.target.value)}
                      >
                        <option value="10">10% Payout</option>
                        <option value="20">20% Payout</option>
                        <option value="30">30% Payout</option>
                        <option value="40">40% Payout</option>
                        <option value="50">50% Payout</option>
                        <option value="60">60% Payout</option>
                        <option value="70">70% Payout</option>
                        <option value="80">80% Payout</option>
                        <option value="90">90% Payout</option>
                        <option value="100">100% Full Payout</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '15px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Calculated Claim Amount:</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: isEligible ? 'var(--success)' : '#94a3b8', margin: '5px 0 0 0' }}>
                      BDT {calculatedClaimAmount.toLocaleString()}
                    </h3>
                  </div>

                  <div className="form-actions mt-4">
                    <Button type="button" variant="secondary" onClick={() => setShowIncentiveClaimModal(false)} disabled={isSaving}>Cancel</Button>
                    <Button variant="primary" type="submit" isLoading={isSaving} disabled={!selectedDealForClaim || !isEligible}>Apply for Incentive</Button>
                  </div>
                </>
              );
            })()}
          </form>
        </Modal>

        {/* Project Visit Allowance Payslip / Voucher Modal */}
        <Modal
          isOpen={showVoucherModal}
          onClose={() => setShowVoucherModal(false)}
          title="Print Project Visit Slip"
          className="glass-modal"
        >
          {selectedVoucherVisit && (
            <div>
              <div className="payslip-print-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <Button variant="secondary" onClick={() => setShowVoucherModal(false)}>Close</Button>
                <Button 
                  variant="primary" 
                  icon={Printer} 
                  onClick={() => {
                    window.print();
                  }}
                >
                  Print Voucher
                </Button>
              </div>

              {/* Company Pad Print Area */}
              <div className="visit-voucher-print-area">
                {selectedVoucherVisit.allowanceStatus === 'Approved' && (
                  <div className="voucher-watermark">APPROVED</div>
                )}
                <div className="voucher-header-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                  {orgBranding.orgLogo && (
                    <img src={orgBranding.orgLogo} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                  )}
                  <h1>{orgBranding.orgName}</h1>
                  <p>{orgBranding.orgAddress}</p>
                  {(orgBranding.orgPhone || orgBranding.orgEmail) && (
                    <p style={{ fontSize: '0.8rem', marginTop: '-4px' }}>
                      {orgBranding.orgPhone && `Phone: ${orgBranding.orgPhone}`} 
                      {orgBranding.orgPhone && orgBranding.orgEmail && ' | '}
                      {orgBranding.orgEmail && `Email: ${orgBranding.orgEmail}`}
                    </p>
                  )}
                  <div className="voucher-title-chip" style={{ marginTop: '12px' }}>
                    Project Visit Allowance Voucher
                  </div>
                </div>

                <div className="voucher-details-grid">
                  <div className="voucher-col">
                    <span>Voucher No:</span>
                    <strong>FE-PVV-{selectedVoucherVisit.id.substring(0, 6).toUpperCase()}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Date:</span>
                    <strong>{new Date().toLocaleDateString('en-GB')}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Executive Name:</span>
                    <strong>{selectedVoucherVisit.assignedToName || user.fullName || user.name}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Client Name:</span>
                    <strong>{selectedVoucherVisit.name}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Visited Project:</span>
                    <strong>{selectedVoucherVisit.company}</strong>
                  </div>
                  <div className="voucher-col">
                    <span>Visit Date & Time:</span>
                    <strong>{selectedVoucherVisit.visitDate} at {selectedVoucherVisit.visitTime}</strong>
                  </div>
                </div>

                <table className="voucher-table">
                  <thead>
                    <tr>
                      <th>Allowance Description</th>
                      <th style={{ textAlign: 'right' }}>Amount (BDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Conveyance & Visit Allowance</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Standard visit allowance for client site viewing at {selectedVoucherVisit.location}.
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{selectedVoucherVisit.allowanceAmount || '0.00'}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Geofence Verification Status</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                          Verified: Within 200m radius of project coordinates.
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>VERIFIED</td>
                    </tr>
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                      <td style={{ borderTop: '2px solid #1e3a8a' }}>Total Allowance Payable:</td>
                      <td style={{ textAlign: 'right', borderTop: '2px solid #1e3a8a', color: '#1e3a8a' }}>BDT {selectedVoucherVisit.allowanceAmount || '0.00'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '20px', fontSize: '0.875rem' }}>
                  <strong>Visit Report / Notes:</strong>
                  <p style={{ margin: '5px 0 0 0', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontStyle: 'italic' }}>
                    "{selectedVoucherVisit.note || 'No specific notes recorded.'}"
                  </p>
                </div>

                <div className="voucher-footer-signatures">
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Prepared By</span>
                  </div>
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Verified (Accounts)</span>
                  </div>
                  <div className="voucher-sig-box">
                    <div className="voucher-sig-line"></div>
                    <span>Managing Director / Authorised</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Toast Notification */}
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

export default Payments;
