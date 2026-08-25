import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import Pagination from '../components/ui/Pagination';
import Toast from '../components/ui/Toast';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  Download, 
  User, 
  Plus, 
  Search, 
  Settings, 
  Lock, 
  PlusCircle, 
  Trash2, 
  Briefcase, 
  Navigation, 
  Check, 
  X, 
  ShieldAlert, 
  AlertCircle, 
  Sparkles,
  Eye,
  Edit
} from 'lucide-react';
import './HROperations.css';

const HROperations = () => {
  const { user, hasPermission, currentTenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'attendance';
  
  // Toast notifications
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToastConfig({ show: true, message, type });
  };

  // State Declarations
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);
  
  // 1. Attendance Tab States
  const [userLocation, setUserLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    distance: null,
    withinFence: false,
    error: null,
    loading: true
  });
  const [adminOverrideActive, setAdminOverrideActive] = useState(false);
  const [userTodayAttendance, setUserTodayAttendance] = useState(null);
  const [userAttendanceHistory, setUserAttendanceHistory] = useState([]);
  const [allAttendanceLogs, setAllAttendanceLogs] = useState([]);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  
  // Manual Log Modal
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false);
  const [newManualLog, setNewManualLog] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    checkInTime: '09:00',
    checkOutTime: '18:00',
    status: 'Present',
    notes: ''
  });

  // 2. Leave Tab States
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [allLeaveApplications, setAllLeaveApplications] = useState([]);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveSearch, setLeaveSearch] = useState('');
  const [newLeaveApplication, setNewLeaveApplication] = useState({
    leaveType: 'Casual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ''
  });
  
  // Leave Balance summary state
  const [leaveBalances, setLeaveBalances] = useState({
    casual: { quota: 10, taken: 0 },
    medical: { quota: 14, taken: 0 },
    earn: { quota: 15, taken: 0 }
  });

  // 3. Employee Master States
  const [empMasterSearch, setEmpMasterSearch] = useState('');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [editEmployeeData, setEditEmployeeData] = useState({
    effectiveFrom: '',
    role: '',
    basicSalary: 0,
    houseRent: 0,
    medical: 0,
    transport: 0,
    otherAllowance: 0,
    festiveBonuses: 0,
    salesIncentiveRate: 0,
    providentFund: 0,
    taxCategory: 'male',
    loan: 0,
    otherDeductions: 0
  });

  // 4. Payroll Tab States
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  React.useEffect(() => {
    setPayrollMonth(`${selectedYear}-${selectedMonthIndex}`);
  }, [selectedYear, selectedMonthIndex]);

  const [payrollSheet, setPayrollSheet] = useState([]);
  const [isPayrollGenerated, setIsPayrollGenerated] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [editingPayrollRow, setEditingPayrollRow] = useState(null);
  const [editingRowIdx, setEditingRowIdx] = useState(-1);
  const [submittedPayrollStatus, setSubmittedPayrollStatus] = useState(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  // 5. Settings Tab States
  const [hrSettings, setHrSettings] = useState({
    shiftStart: '09:00',
    shiftEnd: '18:00',
    graceTime: 15,
    otThreshold: 30,
    officeLatitude: 23.7915,
    officeLongitude: 90.4125,
    officeRadius: 100,
    weekendDays: ['Friday', 'Saturday'],
    holidays: [],
    casualQuota: 10,
    medicalQuota: 14,
    earnedQuota: 15,
    orgName: 'Nest CRM',
    orgLogo: '',
    orgAddress: 'House 12, Road 5, Banani, Dhaka, Bangladesh',
    orgPhone: '+880 2-988XXXX',
    orgEmail: 'info@nestcrm.com'
  });
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Pagination states
  const [attendancePage, setAttendancePage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const itemsPerPage = 10;

  // Haversine Distance helper (meters)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  // Helper: parse "HH:MM" into hours/minutes
  const parseTime = (timeStr) => {
    if (!timeStr) return { hours: 9, minutes: 0 };
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
  };

  // Check user permissions
  const isAdmin = user?.role === 'Admin';
  const hasHRAccess = hasPermission('HR Operations', 'read');

  useEffect(() => {
    if (!hasHRAccess) {
      navigate('/dashboard');
    }
  }, [hasHRAccess, navigate]);

  // Load configuration & users
  useEffect(() => {
    if (!user) return;

    const fetchBaseData = async () => {
      const isSA = user.account_type === 'super_admin';
      
      // Determine queries based on tenant selection
      let usersQuery = supabase.from('users').select('*');
      let hrQuery = supabase.from('hr_settings').select('*');

      if (isSA) {
        if (currentTenant?.type === 'org') {
          usersQuery = usersQuery.eq('org_id', currentTenant.id);
          hrQuery = hrQuery.eq('org_id', currentTenant.id);
        } else if (currentTenant?.type === 'individual') {
          usersQuery = usersQuery.eq('id', currentTenant.id);
          hrQuery = hrQuery.eq('org_id', currentTenant.id); // fallback
        }
      } else {
        if (user.org_id) {
          usersQuery = usersQuery.eq('org_id', user.org_id);
          hrQuery = hrQuery.eq('org_id', user.org_id);
        } else {
          usersQuery = usersQuery.eq('id', user.uid);
        }
      }

      const [userRes, hrRes, usersRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.uid).maybeSingle(),
        hrQuery.eq('id', 'config').maybeSingle(),
        usersQuery
      ]);

      if (userRes.data) setCurrentUserData(userRes.data);

      if (hrRes.data) {
        setHrSettings(prev => ({ ...prev, ...hrRes.data }));
        setLeaveBalances(prev => ({
          casual: { ...prev.casual, quota: hrRes.data.casual_quota || hrRes.data.casualQuota || 10 },
          medical: { ...prev.medical, quota: hrRes.data.medical_quota || hrRes.data.medicalQuota || 14 },
          earn: { ...prev.earn, quota: hrRes.data.earned_quota || hrRes.data.earnedQuota || 15 }
        }));
      } else {
        const defaultSettings = { ...hrSettings };
        if (currentTenant?.type === 'org') {
          defaultSettings.org_id = currentTenant.id;
        } else if (user.org_id) {
          defaultSettings.org_id = user.org_id;
        }
        await supabase.from('hr_settings').upsert({ id: 'config', ...defaultSettings });
      }

      const users = (usersRes.data || []).map(u => ({ ...u, name: u.full_name || u.fullName || u.name || 'Employee' }));
      setUsersList(users);
      setLoading(false);
    };

    fetchBaseData();
  }, [user, currentTenant]);

  // Load attendance data
  useEffect(() => {
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const uids = usersList.map(u => u.id || u.uid);

    const fetchAttendance = async () => {
      const [todayRes, historyRes] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', user.uid).eq('date', todayStr).maybeSingle(),
        supabase.from('attendance').select('*').eq('user_id', user.uid).order('date', { ascending: false })
      ]);
      setUserTodayAttendance(todayRes.data || null);
      setUserAttendanceHistory(historyRes.data || []);
      
      if (isAdmin || user.account_type === 'super_admin') {
        let query = supabase.from('attendance').select('*').order('date', { ascending: false });
        if (uids.length > 0) {
          query = query.in('user_id', uids);
        } else {
          query = query.eq('user_id', '00000000-0000-0000-0000-000000000000'); // empty fallback
        }
        const { data: allLogs } = await query;
        setAllAttendanceLogs(allLogs || []);
      }
    };
    fetchAttendance();
    const ch = supabase.channel('hr-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, fetchAttendance)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, isAdmin, usersList]);

  // Load Leave Management data
  useEffect(() => {
    if (!user) return;
    const uids = usersList.map(u => u.id || u.uid);

    const fetchLeaves = async () => {
      const { data: myLeaves } = await supabase.from('leave_applications').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
      setLeaveApplications(myLeaves || []);

      const approvedLeaves = (myLeaves || []).filter(l => l.status === 'Approved');
      const taken = { casual: 0, medical: 0, earn: 0 };
      approvedLeaves.forEach(l => {
        const type = (l.leave_type || l.leaveType || '').toLowerCase();
        if (type === 'casual') taken.casual += l.days || 0;
        else if (type === 'medical' || type === 'sick') taken.medical += l.days || 0;
        else if (type === 'earned' || type === 'earn') taken.earn += l.days || 0;
      });
      setLeaveBalances(prev => ({
        casual: { ...prev.casual, taken: taken.casual },
        medical: { ...prev.medical, taken: taken.medical },
        earn: { ...prev.earn, taken: taken.earn }
      }));

      if (isAdmin || user.account_type === 'super_admin') {
        let query = supabase.from('leave_applications').select('*').order('created_at', { ascending: false });
        if (uids.length > 0) {
          query = query.in('user_id', uids);
        } else {
          query = query.eq('user_id', '00000000-0000-0000-0000-000000000000');
        }
        const { data: allLeaves } = await query;
        setAllLeaveApplications(allLeaves || []);
      }
    };
    fetchLeaves();
    const ch = supabase.channel('hr-leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, fetchLeaves)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, isAdmin, usersList]);

  // Synchronize submitted/approved payroll sheet for selected month
  useEffect(() => {
    if (!payrollMonth) return;
    const fetchPayroll = async () => {
      const { data } = await supabase.from('salary_payroll_approvals').select('*').eq('month', payrollMonth);
      if (data && data.length > 0) {
        const docData = data[0];
        setSubmittedPayrollStatus(docData.status);
        if (docData.payroll_rows || docData.payrollRows) {
          const rows = (docData.payroll_rows || docData.payrollRows).map(row => ({
            ...row,
            baseSalary: row.base_salary || row.baseSalary || row.grossSalary || 0,
            salesIncentive: row.sales_incentive || row.salesIncentive || row.commission || 0,
            totalDeduction: row.total_deduction || row.totalDeduction || row.deductions || 0
          }));
          setPayrollSheet(rows);
          setIsPayrollGenerated(true);
        }
      } else {
        setSubmittedPayrollStatus(null);
      }
    };
    fetchPayroll();
  }, [payrollMonth]);

  // Geolocation Handler
  useEffect(() => {
    if (activeTab !== 'attendance' || !hrSettings) return;

    setUserLocation(prev => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setUserLocation(prev => ({
        ...prev,
        loading: false,
        error: "Geolocation is not supported by your browser."
      }));
      return;
    }

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      
      const officeLat = hrSettings.officeLatitude || 23.7915;
      const officeLon = hrSettings.officeLongitude || 90.4125;
      const radius = hrSettings.officeRadius || 100;
      
      const dist = calculateDistance(latitude, longitude, officeLat, officeLon);
      const within = dist <= radius;

      setUserLocation({
        latitude,
        longitude,
        accuracy,
        distance: dist,
        withinFence: within,
        error: null,
        loading: false
      });
    };

    const handleError = (error) => {
      let msg = "Failed to retrieve location.";
      if (error.code === error.PERMISSION_DENIED) {
        msg = "Location permission denied. Please allow location access to verify attendance.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = "Location information is unavailable.";
      } else if (error.code === error.TIMEOUT) {
        msg = "Location request timed out.";
      }
      setUserLocation(prev => ({
        ...prev,
        loading: false,
        error: msg
      }));
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });

    // Watch position for live coordinates
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeTab, hrSettings]);

  // Tab switcher
  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // CHECK IN Logic
  const handleCheckIn = async () => {
    if (!user) return;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Time calculations
    const { hours: sHours, minutes: sMinutes } = parseTime(hrSettings.shiftStart);
    const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sHours, sMinutes, 0);
    const graceLimit = new Date(shiftStart.getTime() + hrSettings.graceTime * 60 * 1000);

    let status = 'Present';
    let lateMinutes = 0;

    if (now > graceLimit) {
      status = 'Late';
      lateMinutes = Math.floor((now.getTime() - shiftStart.getTime()) / (60 * 1000));
    }

    const docId = `${user.uid}_${dateStr}`;
    const newLog = {
      userId: user.uid,
      userName: currentUserData?.fullName || user.displayName || 'Employee',
      userEmail: user.email,
      date: dateStr,
      checkIn: now.toISOString(),
      checkOut: null,
      status,
      lateMinutes,
      otMinutes: 0,
      type: adminOverrideActive ? 'manual' : 'gps',
      notes: adminOverrideActive ? 'Admin Override GPS Bypass' : 'Self-Check-In via App'
    };

    try {
      await supabase.from('attendance').upsert({
        id: docId,
        ...newLog,
        user_id: newLog.userId,
        user_name: newLog.userName,
        user_email: newLog.userEmail,
        check_in: newLog.checkIn,
        check_out: newLog.checkOut,
        late_minutes: newLog.lateMinutes,
        ot_minutes: newLog.otMinutes
      });
      showToast('Checked in successfully!', 'success');
    } catch (error) {
      console.error('Check-in error:', error);
      showToast('Failed to check in.', 'error');
    }
  };

  // CHECK OUT Logic
  const handleCheckOut = async () => {
    if (!user || !userTodayAttendance) return;
    const now = new Date();

    // OT calculations
    const { hours: eHours, minutes: eMinutes } = parseTime(hrSettings.shiftEnd);
    const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eHours, eMinutes, 0);
    const otLimit = new Date(shiftEnd.getTime() + hrSettings.otThreshold * 60 * 1000);

    let otMinutes = 0;
    if (now > otLimit) {
      otMinutes = Math.floor((now.getTime() - shiftEnd.getTime()) / (60 * 1000));
    }

    const dateStr = now.toISOString().split('T')[0];
    const docId = `${user.uid}_${dateStr}`;

    try {
      await supabase.from('attendance').update({
        check_out: now.toISOString(),
        ot_minutes: otMinutes,
        notes: ((userTodayAttendance.notes || userTodayAttendance.note) || '') + ' | Checked Out via App'
      }).eq('id', docId);
      showToast('Checked out successfully!', 'success');
    } catch (error) {
      console.error('Check-out error:', error);
      showToast('Failed to check out.', 'error');
    }
  };

  // Apply Leave submission
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!user) return;

    const start = new Date(newLeaveApplication.startDate);
    const end = new Date(newLeaveApplication.endDate);

    if (end < start) {
      showToast("End date cannot be earlier than start date.", "error");
      return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check leave quotas
    const typeKey = newLeaveApplication.leaveType?.toLowerCase();
    const balance = leaveBalances[typeKey];
    if (balance && (balance.quota - balance.taken) < diffDays) {
      showToast(`Insufficient leave balance! Required: ${diffDays}, Remaining: ${balance.quota - balance.taken}`, "error");
      return;
    }

    try {
      await supabase.from('leave_applications').insert({
        user_id: user.uid,
        user_name: currentUserData?.full_name || currentUserData?.fullName || user.email || 'Employee',
        user_email: user.email,
        leave_type: newLeaveApplication.leaveType,
        start_date: newLeaveApplication.startDate,
        end_date: newLeaveApplication.endDate,
        days: diffDays,
        reason: newLeaveApplication.reason,
        status: 'Pending',
        created_at: new Date().toISOString()
      });

      showToast('Leave application submitted!', 'success');
      setIsLeaveModalOpen(false);
      setNewLeaveApplication({
        leaveType: 'Casual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: ''
      });
    } catch (error) {
      console.error('Apply Leave error:', error);
      showToast('Failed to apply for leave.', 'error');
    }
  };

  // Leave Approval actions
  const handleLeaveApproval = async (applicationId, status) => {
    try {
      await supabase.from('leave_applications').update({ status }).eq('id', applicationId);
      showToast(`Leave application ${status.toLowerCase()}!`, 'success');
    } catch (error) {
      console.error('Leave approval error:', error);
      showToast('Failed to update leave application.', 'error');
    }
  };

  // Save base salary in Employee Master
  const handleSaveSalary = async (employeeId, salary) => {
    try {
      await supabase.from('users').update({ base_salary: parseFloat(salary) || 0 }).eq('id', employeeId);
      showToast('Base salary updated successfully!', 'success');
    } catch (error) {
      console.error('Save salary error:', error);
      showToast('Failed to update salary.', 'error');
    }
  };

  const calculateSalaryBreakdown = (basic, houseRent, medical, transport, otherAllowance, festiveBonuses, taxCategory, pfValue, loan, otherDeductions) => {
    const b = parseFloat(basic) || 0;
    const hr = parseFloat(houseRent) || 0;
    const med = parseFloat(medical) || 0;
    const trans = parseFloat(transport) || 0;
    const other = parseFloat(otherAllowance) || 0;
    const gross = b + hr + med + trans + other;

    const fBonuses = parseFloat(festiveBonuses) || 0;
    const annualIncome = gross * 12 + b * fBonuses;

    const exemption = Math.min(450000, annualIncome / 3);
    const taxable = Math.max(0, annualIncome - exemption);

    let threshold = 350000;
    if (taxCategory === 'female_senior') threshold = 400000;
    else if (taxCategory === 'disabled') threshold = 475000;
    else if (taxCategory === 'freedom_fighter') threshold = 500000;

    let tax = 0;
    if (taxable > threshold) {
      let remaining = taxable - threshold;

      const slab2 = Math.min(remaining, 100000);
      tax += slab2 * 0.05;
      remaining -= slab2;

      const slab3 = Math.min(remaining, 400000);
      tax += slab3 * 0.10;
      remaining -= slab3;

      const slab4 = Math.min(remaining, 500000);
      tax += slab4 * 0.15;
      remaining -= slab4;

      const slab5 = Math.min(remaining, 500000);
      tax += slab5 * 0.20;
      remaining -= slab5;

      const slab6 = Math.min(remaining, 2000000);
      tax += slab6 * 0.25;
      remaining -= slab6;

      if (remaining > 0) {
        tax += remaining * 0.30;
      }

      if (tax > 0 && tax < 5000) {
        tax = 5000;
      }
    }

    const monthlyTax = Math.round(tax / 12);
    const pf = pfValue !== undefined ? (parseFloat(pfValue) || 0) : Math.round(b * 0.1);
    const l = parseFloat(loan) || 0;
    const od = parseFloat(otherDeductions) || 0;
    const totalDeductions = pf + monthlyTax + l + od;
    const netSalary = gross - totalDeductions;

    return {
      basicSalary: b,
      houseRent: hr,
      medical: med,
      transport: trans,
      otherAllowance: other,
      grossSalary: gross,
      annualIncome,
      exemption,
      taxableIncome: taxable,
      annualTax: tax,
      incomeTax: monthlyTax,
      providentFund: pf,
      loan: l,
      otherDeductions: od,
      totalDeductions,
      netSalary
    };
  };

  const handleOpenEditModal = (emp) => {
    const struct = emp.salaryStructure || {};
    setSelectedEmployeeForEdit(emp);
    
    const basic = struct.basicSalary || emp.baseSalary || 0;
    setEditEmployeeData({
      effectiveFrom: new Date().toISOString().split('T')[0],
      role: emp.role || 'Staff',
      basicSalary: basic,
      houseRent: struct.houseRent !== undefined ? struct.houseRent : Math.round(basic * 0.5),
      medical: struct.medical !== undefined ? struct.medical : Math.round(basic * 0.1),
      transport: struct.transport !== undefined ? struct.transport : Math.round(basic * 0.05),
      otherAllowance: struct.otherAllowance || 0,
      festiveBonuses: struct.festiveBonuses || 0,
      salesIncentiveRate: struct.salesIncentiveRate || 0,
      providentFund: struct.providentFund !== undefined ? struct.providentFund : Math.round(basic * 0.1),
      taxCategory: struct.taxCategory || 'male',
      loan: struct.loan || 0,
      otherDeductions: struct.otherDeductions || 0
    });
    setIsEmployeeModalOpen(true);
  };

  const handleSaveEmployeeProfile = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeForEdit) return;

    const breakdown = calculateSalaryBreakdown(
      editEmployeeData.basicSalary,
      editEmployeeData.houseRent,
      editEmployeeData.medical,
      editEmployeeData.transport,
      editEmployeeData.otherAllowance,
      editEmployeeData.festiveBonuses,
      editEmployeeData.taxCategory,
      editEmployeeData.providentFund,
      editEmployeeData.loan,
      editEmployeeData.otherDeductions
    );

    const isPromotion = editEmployeeData.role !== selectedEmployeeForEdit.role;
    const historyEntry = {
      effectiveFrom: editEmployeeData.effectiveFrom || new Date().toISOString().split('T')[0],
      oldRole: selectedEmployeeForEdit.role || 'Staff',
      newRole: editEmployeeData.role,
      oldSalary: selectedEmployeeForEdit.salaryStructure?.grossSalary || selectedEmployeeForEdit.baseSalary || 0,
      newSalary: breakdown.grossSalary,
      isPromotion,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUserData?.fullName || user.displayName || 'Admin'
    };

    try {
      const salaryHistory = selectedEmployeeForEdit.salary_history || selectedEmployeeForEdit.salaryHistory || [];
      const newHistory = [...salaryHistory, historyEntry];

      await supabase.from('users').update({
        role: editEmployeeData.role,
        base_salary: breakdown.basicSalary,
        salary_structure: {
          effective_from: editEmployeeData.effectiveFrom || new Date().toISOString().split('T')[0],
          basic_salary: breakdown.basicSalary,
          house_rent: breakdown.houseRent,
          medical: breakdown.medical,
          transport: breakdown.transport,
          other_allowance: breakdown.otherAllowance,
          gross_salary: breakdown.grossSalary,
          festive_bonuses: parseFloat(editEmployeeData.festiveBonuses) || 0,
          sales_incentive_rate: parseFloat(editEmployeeData.salesIncentiveRate) || 0,
          provident_fund: breakdown.providentFund,
          tax_category: editEmployeeData.taxCategory,
          income_tax: breakdown.incomeTax,
          loan: breakdown.loan,
          other_deductions: breakdown.otherDeductions,
          total_deductions: breakdown.totalDeductions,
          net_salary: breakdown.netSalary
        },
        salary_history: newHistory
      }).eq('id', selectedEmployeeForEdit.id);
      showToast('Employee profile and salary structure updated!', 'success');
      setIsEmployeeModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to update employee profile.', 'error');
    }
  };

  // Generate Payroll Sheet
  const handleGeneratePayroll = async () => {
    if (!payrollMonth) return;
    setLoading(true);

    try {
      const [year, month] = payrollMonth.split('-').map(Number);
      
      // Calculate start and end date of target month
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0); // Last day of month
      const totalDays = monthEnd.getDate();

      // Retrieve all attendance logs in month
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endStr = `${year}-${String(month).padStart(2, '0')}-${totalDays}`;

      const { data: attData } = await supabase.from('attendance').select('*').gte('date', startStr).lte('date', endStr);
      const allAttRecords = attData || [];

      const { data: allDeals } = await supabase.from('deals').select('*');
      const { data: allLeads } = await supabase.from('leads').select('*');

      // Loop through all active employees to build row
      const payrollRows = usersList.map(emp => {
        const empAtt = allAttRecords.filter(r => r.userId === emp.id);

        const presentDays = empAtt.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const lateCount = empAtt.filter(r => r.status === 'Late').length;
        const totalOtMins = empAtt.reduce((sum, r) => sum + (r.otMinutes || 0), 0);
        
        // Detailed salary structure check
        const struct = emp.salaryStructure || {
          basicSalary: emp.baseSalary || 0,
          houseRent: 0,
          medical: 0,
          transport: 0,
          otherAllowance: 0,
          grossSalary: emp.baseSalary || 0,
          festiveBonuses: 0,
          salesIncentiveRate: 0,
          providentFund: 0,
          taxCategory: 'male',
          incomeTax: 0,
          loan: 0,
          otherDeductions: 0,
          totalDeductions: 0,
          netSalary: emp.baseSalary || 0
        };

        const grossSalary = struct.grossSalary || emp.baseSalary || 0;
        
        // Calculate Sales Incentives
        const empLeads = allLeads.filter(l => l.assignedTo === emp.id || l.assignedTo === emp.uid);
        const empLeadsIds = empLeads.map(l => l.id);
        const empDeals = allDeals.filter(d => empLeadsIds.includes(d.leadId));
        
        const monthDeals = empDeals.filter(d => {
          let dateObj = null;
          if (d.createdAt && typeof d.createdAt.toDate === 'function') {
            dateObj = d.createdAt.toDate();
          } else if (d.date) {
            dateObj = new Date(d.date);
          }
          if (!dateObj || isNaN(dateObj.getTime())) return false;
          const dealMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          return dealMonth === payrollMonth;
        });

        let totalSalesValue = 0;
        monthDeals.forEach(d => {
          const val = parseFloat(String(d.value || d.price).replace(/[^\d.]/g, '')) || 0;
          totalSalesValue += val;
        });
        const salesIncentive = Math.round(totalSalesValue * (struct.salesIncentiveRate || 0) / 100);

        // Unpaid Leaves / Absence: Deduct salary for missing days (excluding weekends)
        let weekendCount = 0;
        for (let d = 1; d <= totalDays; d++) {
          const dateObj = new Date(year, month - 1, d);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          if (hrSettings.weekendDays.includes(dayName)) {
            weekendCount++;
          }
        }
        
        const totalHolidays = hrSettings.holidays.filter(h => {
          const hDate = new Date(h.date);
          return hDate.getFullYear() === year && (hDate.getMonth() + 1) === month;
        }).length;

        const workingDays = totalDays - weekendCount - totalHolidays;
        const absentDays = Math.max(0, workingDays - presentDays);
        
        // Late Penalty: 1 day salary deducted for every 3 lates
        const latePenaltyDays = Math.floor(lateCount / 3);
        
        // Rate details
        const dailyRate = grossSalary / 30;
        const hourlyOtRate = 200; // BDT 200/hr OT rate
        
        const otHours = totalOtMins / 60;
        const otPay = otHours * hourlyOtRate;
        const absenceDeduction = absentDays * dailyRate;
        const latePenaltyDeduction = latePenaltyDays * dailyRate;

        // Structured Deductions
        const providentFund = struct.providentFund || 0;
        const incomeTax = struct.incomeTax || 0;
        const loan = struct.loan || 0;
        const otherDeductions = struct.otherDeductions || 0;

        const totalDeduction = providentFund + incomeTax + loan + otherDeductions + absenceDeduction + latePenaltyDeduction;
        const netPayable = Math.max(0, grossSalary + otPay + salesIncentive - totalDeduction);

        return {
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email || '',
          role: emp.role || 'Staff',
          baseSalary: struct.basicSalary || emp.baseSalary || 0,
          salaryStructure: struct,
          presentDays,
          lateCount,
          otHours: parseFloat(otHours.toFixed(1)),
          otPay: Math.round(otPay),
          salesIncentive,
          totalSalesValue,
          absentDays,
          absenceDeduction: Math.round(absenceDeduction),
          latePenaltyDays,
          latePenaltyDeduction: Math.round(latePenaltyDeduction),
          providentFund,
          incomeTax,
          loan,
          otherDeductions,
          totalDeduction: Math.round(totalDeduction),
          netPayable: Math.round(netPayable)
        };
      });

      setPayrollSheet(payrollRows);
      setIsPayrollGenerated(true);
      showToast("Payroll sheets compiled!", "success");
    } catch (e) {
      console.error(e);
      showToast("Error generating payroll.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayrollToAccounts = async () => {
    if (!payrollMonth || payrollSheet.length === 0) return;
    try {
      const totalPayable = payrollSheet.reduce((acc, row) => acc + (parseFloat(row.netPayable) || 0), 0);

      const { data: existing } = await supabase.from('salary_payroll_approvals').select('id').eq('month', payrollMonth);
      if (existing && existing.length > 0) {
        showToast(`Payroll for ${payrollMonth} has already been submitted to Accounts!`, 'warning');
        return;
      }

      await supabase.from('salary_payroll_approvals').insert({
        month: payrollMonth,
        payroll_rows: payrollSheet.map(row => ({
          employeeId: row.employeeId || '',
          employeeName: row.employeeName || '',
          employeeEmail: row.employeeEmail || '',
          role: row.role || 'Staff',
          baseSalary: parseFloat(row.baseSalary) || 0,
          grossSalary: parseFloat(row.grossSalary || row.baseSalary) || 0,
          presentDays: parseInt(row.presentDays) || 0,
          lateCount: parseInt(row.lateCount) || 0,
          otHours: parseFloat(row.otHours) || 0,
          otPay: parseFloat(row.otPay) || 0,
          salesIncentive: parseFloat(row.salesIncentive || row.commission) || 0,
          absentDays: parseInt(row.absentDays) || 0,
          absenceDeduction: parseFloat(row.absenceDeduction) || 0,
          latePenaltyDays: parseInt(row.latePenaltyDays) || 0,
          latePenaltyDeduction: parseFloat(row.latePenaltyDeduction) || 0,
          providentFund: parseFloat(row.providentFund) || 0,
          incomeTax: parseFloat(row.incomeTax) || 0,
          loan: parseFloat(row.loan) || 0,
          otherDeductions: parseFloat(row.otherDeductions) || 0,
          totalDeduction: parseFloat(row.totalDeduction || row.deductions) || 0,
          netPayable: parseFloat(row.netPayable) || 0,
          salaryStructure: row.salaryStructure || {}
        })),
        totalPayable,
        status: 'Pending Approval',
        submittedBy: user.fullName || user.name || 'HR Specialist',
        createdAt: serverTimestamp()
      });

      showToast(`Payroll for ${payrollMonth} submitted to Accounts successfully!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to submit payroll to Accounts", "error");
    }
  };

  const handleEditFieldChange = (field, val) => {
    const numVal = parseFloat(val) || 0;
    setEditingPayrollRow(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: numVal };
      
      // Recalculate totals
      const pf = field === 'providentFund' ? numVal : (prev.providentFund || 0);
      const tax = field === 'incomeTax' ? numVal : (prev.incomeTax || 0);
      const loan = field === 'loan' ? numVal : (prev.loan || 0);
      const otherD = field === 'otherDeductions' ? numVal : (prev.otherDeductions || 0);
      const absD = field === 'absenceDeduction' ? numVal : (prev.absenceDeduction || 0);
      const lateD = field === 'latePenaltyDeduction' ? numVal : (prev.latePenaltyDeduction || 0);
      
      updated.totalDeduction = pf + tax + loan + otherD + absD + lateD;
      
      const base = field === 'baseSalary' ? numVal : (parseFloat(prev.baseSalary) || 0);
      const ot = field === 'otPay' ? numVal : (prev.otPay || 0);
      const inc = field === 'salesIncentive' ? numVal : (prev.salesIncentive || 0);
      
      updated.netPayable = Math.max(0, base + ot + inc - updated.totalDeduction);
      
      return updated;
    });
  };

  // Submit Manual Log Form (Admin)
  const handleAddManualLog = async (e) => {
    e.preventDefault();
    if (!newManualLog.userId) {
      showToast("Please select an employee.", "error");
      return;
    }

    const selectedEmp = usersList.find(u => u.id === newManualLog.userId);
    const dateStr = newManualLog.date;
    const docId = `${newManualLog.userId}_${dateStr}`;

    const checkInDateTime = new Date(`${dateStr}T${newManualLog.checkInTime}`);
    const checkOutDateTime = new Date(`${dateStr}T${newManualLog.checkOutTime}`);

    if (checkOutDateTime <= checkInDateTime) {
      showToast("Check-out time must be after check-in time.", "error");
      return;
    }

    // Process late mins
    const { hours: sHours, minutes: sMinutes } = parseTime(hrSettings.shiftStart);
    const shiftStart = new Date(checkInDateTime.getFullYear(), checkInDateTime.getMonth(), checkInDateTime.getDate(), sHours, sMinutes, 0);
    const graceLimit = new Date(shiftStart.getTime() + hrSettings.graceTime * 60 * 1000);

    let status = newManualLog.status;
    let lateMinutes = 0;
    if (status === 'Present' && checkInDateTime > graceLimit) {
      status = 'Late';
      lateMinutes = Math.floor((checkInDateTime.getTime() - shiftStart.getTime()) / (60 * 1000));
    }

    // Overtime
    const { hours: eHours, minutes: eMinutes } = parseTime(hrSettings.shiftEnd);
    const shiftEnd = new Date(checkOutDateTime.getFullYear(), checkOutDateTime.getMonth(), checkOutDateTime.getDate(), eHours, eMinutes, 0);
    const otLimit = new Date(shiftEnd.getTime() + hrSettings.otThreshold * 60 * 1000);

    let otMinutes = 0;
    if (checkOutDateTime > otLimit) {
      otMinutes = Math.floor((checkOutDateTime.getTime() - shiftEnd.getTime()) / (60 * 1000));
    }

    try {
      await supabase.from('attendance').upsert({
        id: docId,
        user_id: newManualLog.userId,
        user_name: selectedEmp?.name || 'Employee',
        user_email: selectedEmp?.email || '',
        date: dateStr,
        check_in: checkInDateTime.toISOString(),
        check_out: checkOutDateTime.toISOString(),
        status,
        late_minutes: lateMinutes,
        ot_minutes: otMinutes,
        type: 'manual',
        notes: newManualLog.notes || 'Manually logged by Admin'
      });

      showToast("Manual log saved!", "success");
      setIsManualLogModalOpen(false);
      setNewManualLog({
        userId: '',
        date: new Date().toISOString().split('T')[0],
        checkInTime: '09:00',
        checkOutTime: '18:00',
        status: 'Present',
        notes: ''
      });
    } catch (err) {
      console.error(err);
      showToast("Error adding manual log.", "error");
    }
  };

  // Add / Remove Holidays
  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name) return;

    const list = [...(hrSettings.holidays || [])];
    const isExist = list.some(h => h.date === newHoliday.date);
    if (isExist) {
      showToast("Holiday for this date already exists.", "error");
      return;
    }

    const updated = {
      ...hrSettings,
      holidays: [...list, { id: Date.now().toString(), ...newHoliday }]
    };

    setHrSettings(updated);
    setNewHoliday({ date: '', name: '' });
  };

  const handleRemoveHoliday = (holidayId) => {
    const list = hrSettings.holidays.filter(h => h.id !== holidayId);
    setHrSettings({ ...hrSettings, holidays: list });
  };

  // Toggle Weekend Days
  const handleWeekendDayToggle = (day) => {
    let list = [...hrSettings.weekendDays];
    if (list.includes(day)) {
      list = list.filter(d => d !== day);
    } else {
      list.push(day);
    }
    setHrSettings({ ...hrSettings, weekendDays: list });
  };

  // Save Settings Tab configuration
  const handleSaveHrSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.from('hr_settings').upsert({ id: 'config', ...hrSettings });
      showToast('Configuration saved successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast("Failed to save settings.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Coordinates retrieval
  const handleGetCurrentCoords = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setHrSettings({
            ...hrSettings,
            officeLatitude: parseFloat(position.coords.latitude.toFixed(6)),
            officeLongitude: parseFloat(position.coords.longitude.toFixed(6))
          });
          showToast("Successfully fetched current GPS coordinates!", "success");
        },
        (error) => {
          showToast("Could not retrieve GPS coordinates automatically.", "error");
        }
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="hr-ops-container">
        
        {/* Header */}
        <div className="hr-ops-header">
          <div className="header-info">
            <h1>{
              activeTab === 'attendance' ? 'Attendance Verification' :
              activeTab === 'leaves' ? 'Leave Management' :
              activeTab === 'employee_master' ? 'Employee Master Database' :
              activeTab === 'payroll' ? 'Payroll Processing' :
              activeTab === 'organization' ? 'Organization Settings' : 'HR Operations Portal'
            }</h1>
            <p>{
              activeTab === 'attendance' ? 'Verify daily shift check-in and check-out logs via geofenced coordinates.' :
              activeTab === 'leaves' ? 'Apply for leaves, track quotas, and review approval history.' :
              activeTab === 'employee_master' ? 'Configure basic salary structures and quotas for system employees.' :
              activeTab === 'payroll' ? 'Generate payroll sheets, calculate late/absence deductions, and print payslips.' :
              activeTab === 'organization' ? 'Configure shift timings, grace periods, geofence radius, weekend days, and holiday lists.' : 
              'Administer office settings, track employee geolocation logs, approvals, and compile salary payslips.'
            }</p>
          </div>
        </div>

        {/* Content Tabs */}
        
        {/* 1. ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="attendance-grid-container">
            <div className="attendance-grid">
              
              {/* Geofencing Verification Card */}
              <Card>
                <div className="card-header-ops">
                  <h3>Verify Attendance</h3>
                  <div className="current-date-badge">
                    <Calendar size={14} />
                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                
                <div className="card-body-ops">
                  {/* Shift Times */}
                  <div className="policy-timing-grid">
                    <div className="timing-box">
                      <Clock size={16} />
                      <div>
                        <span className="timing-label">Shift Start</span>
                        <span className="timing-val">{hrSettings.shiftStart} AM</span>
                      </div>
                    </div>
                    <div className="timing-box">
                      <Clock size={16} />
                      <div>
                        <span className="timing-label">Shift End</span>
                        <span className="timing-val">{hrSettings.shiftEnd} PM</span>
                      </div>
                    </div>
                    <div className="timing-box">
                      <Clock size={16} />
                      <div>
                        <span className="timing-label">Grace Time</span>
                        <span className="timing-val">{hrSettings.graceTime} Mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Geofence Status */}
                  <div className="geofence-status-box">
                    <div className="status-item-line">
                      <span className="status-label">Your Lat / Lon</span>
                      <span className="status-value">
                        {userLocation.loading ? 'Tracking GPS...' : 
                         userLocation.error ? 'Unavailable' : 
                         `${userLocation.latitude?.toFixed(5)}, ${userLocation.longitude?.toFixed(5)}`}
                      </span>
                    </div>
                    <div className="status-item-line">
                      <span className="status-label">Accuracy Radius</span>
                      <span className="status-value">
                        {userLocation.loading ? 'Calculating...' : 
                         userLocation.error ? 'N/A' : 
                         `±${Math.round(userLocation.accuracy || 0)} meters`}
                      </span>
                    </div>
                    <div className="status-item-line">
                      <span className="status-label">Distance to Office</span>
                      <span className="status-value">
                        {userLocation.loading ? 'Calculating...' : 
                         userLocation.error ? 'N/A' : 
                         userLocation.distance > 1000 ? 
                         `${(userLocation.distance / 1000).toFixed(2)} km` : 
                         `${Math.round(userLocation.distance || 0)} meters`}
                      </span>
                    </div>
                    
                    {/* Banner Alerts */}
                    {userLocation.loading ? (
                      <div className="location-loading-state">
                        <Clock className="animate-spin" size={16} />
                        Loading current GPS coordinates...
                      </div>
                    ) : userLocation.error ? (
                      <div className="location-error-state">
                        <AlertCircle size={16} />
                        <span>{userLocation.error}</span>
                      </div>
                    ) : userLocation.withinFence ? (
                      <div className="geofence-status-banner within-fence">
                        <CheckCircle size={16} />
                        Within Geofence Range (Check-in Enabled)
                      </div>
                    ) : (
                      <div className="geofence-status-banner outside-fence">
                        <AlertTriangle size={16} />
                        Outside Office Geofence Range ({Math.round(userLocation.distance || 0)}m / Max {hrSettings.officeRadius}m allowed)
                      </div>
                    )}

                    {/* Admin Bypass Toggle */}
                    {isAdmin && (
                      <div className="override-switch-container">
                        <label className="checkbox-v3">
                          <input 
                            type="checkbox" 
                            checked={adminOverrideActive}
                            onChange={(e) => setAdminOverrideActive(e.target.checked)}
                          />
                          <span className="text-xs font-bold text-danger">Bypass Geofence restriction (Admin mode)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="action-buttons-attendance">
                    {!userTodayAttendance?.checkIn ? (
                      <Button 
                        variant="primary" 
                        className="attendance-btn"
                        onClick={handleCheckIn}
                        disabled={userLocation.loading || (!userLocation.withinFence && !adminOverrideActive)}
                      >
                        Check In Attendance
                      </Button>
                    ) : !userTodayAttendance?.checkOut ? (
                      <div className="flex flex-col gap-2">
                        <div className="attendance-completed-banner mb-1">
                          <CheckCircle size={18} />
                          <div>
                            <h4>Checked-in today</h4>
                            <p>Checked in at: {new Date(userTodayAttendance.checkIn).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <Button 
                          variant="secondary" 
                          className="attendance-btn"
                          onClick={handleCheckOut}
                          disabled={userLocation.loading || (!userLocation.withinFence && !adminOverrideActive)}
                        >
                          Check Out Shift
                        </Button>
                      </div>
                    ) : (
                      <div className="attendance-completed-banner">
                        <CheckCircle size={20} />
                        <div>
                          <h4>Shift Finished Successfully</h4>
                          <p>In: {new Date(userTodayAttendance.checkIn).toLocaleTimeString()} | Out: {new Date(userTodayAttendance.checkOut).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Today's Log Card */}
              <Card>
                <div className="card-header-ops">
                  <h3>Today's Log</h3>
                </div>
                <div className="card-body-ops">
                  {userTodayAttendance ? (
                    <div className="today-log-details">
                      <div className="log-row">
                        <span className="status-label">Status</span>
                        <span className={`status-value ${userTodayAttendance.status?.toLowerCase() === 'present' ? 'text-success' : 'text-danger'}`}>
                          {userTodayAttendance.status}
                        </span>
                      </div>
                      <div className="log-row">
                        <span className="status-label">Checked In</span>
                        <span className="status-value">
                          {userTodayAttendance.checkIn ? new Date(userTodayAttendance.checkIn).toLocaleTimeString() : '--'}
                        </span>
                      </div>
                      <div className="log-row">
                        <span className="status-label">Checked Out</span>
                        <span className="status-value">
                          {userTodayAttendance.checkOut ? new Date(userTodayAttendance.checkOut).toLocaleTimeString() : '--'}
                        </span>
                      </div>
                      <div className="log-row">
                        <span className="status-label">Late Penalty Mins</span>
                        <span className="status-value text-danger">{userTodayAttendance.lateMinutes || 0} mins</span>
                      </div>
                      <div className="log-row">
                        <span className="status-label">Overtime Hours</span>
                        <span className="status-value text-success">
                          {userTodayAttendance.otMinutes ? (userTodayAttendance.otMinutes / 60).toFixed(2) : '0.00'} hrs
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-attendance-recorded">
                      <Clock size={40} />
                      <p>No check-in recorded for today.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Attendance Logs List */}
            <div className="attendance-logs-section">
              <div className="section-header-ops">
                <h3>{isAdmin ? 'All Attendance Logs' : 'Your Attendance History'}</h3>
                <div className="flex gap-2 items-center">
                  <div className="search-box-v2" style={{ padding: '4px 10px' }}>
                    <Search size={16} />
                    <input 
                      type="text" 
                      placeholder="Search Logs..." 
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'white', outline: 'none', fontSize: '12px' }}
                    />
                  </div>
                  {isAdmin && (
                    <Button variant="primary" icon={Plus} onClick={() => setIsManualLogModalOpen(true)}>
                      Add Manual Log
                    </Button>
                  )}
                </div>
              </div>

              <div className="table-responsive-ops">
                <table className="hr-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee Name</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Status</th>
                      <th>Mins Late</th>
                      <th>OT Hrs</th>
                      <th>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isAdmin ? allAttendanceLogs : userAttendanceHistory)
                      .filter(log => 
                        log.userName?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
                        log.date?.includes(attendanceSearch)
                      )
                      .slice((attendancePage - 1) * itemsPerPage, attendancePage * itemsPerPage)
                      .map((log, index) => (
                        <tr key={log.id || index}>
                          <td>{log.date}</td>
                          <td>
                            <div className="emp-cell">
                              <span className="emp-name">{log.userName}</span>
                              <span className="emp-email">{log.userEmail}</span>
                            </div>
                          </td>
                          <td>{log.checkIn ? new Date(log.checkIn).toLocaleTimeString() : '--'}</td>
                          <td>{log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : '--'}</td>
                          <td>
                            <span className={`type-tag ${log.status === 'Present' ? 'gps' : 'manual'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className={log.lateMinutes > 0 ? 'text-danger' : ''}>{log.lateMinutes || 0}</td>
                          <td className={log.otMinutes > 0 ? 'text-success' : ''}>
                            {log.otMinutes ? (log.otMinutes / 60).toFixed(1) : '0.0'}
                          </td>
                          <td>
                            <span className={`type-tag ${log.type === 'gps' ? 'gps' : 'manual'}`}>
                              {log.type === 'gps' ? 'GPS' : 'Manual'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              <Pagination 
                currentPage={attendancePage}
                totalPages={Math.ceil(
                  (isAdmin ? allAttendanceLogs : userAttendanceHistory).filter(log => 
                    log.userName?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
                    log.date?.includes(attendanceSearch)
                  ).length / itemsPerPage
                )}
                onPageChange={setAttendancePage}
                totalItems={(isAdmin ? allAttendanceLogs : userAttendanceHistory).filter(log => 
                  log.userName?.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
                  log.date?.includes(attendanceSearch)
                ).length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </div>
        )}

        {/* 2. LEAVE MANAGEMENT TAB */}
        {activeTab === 'leaves' && (
          <div className="leave-tab-container">
            
            {/* Quota overview grid */}
            <div className="leave-quota-grid card mb-4">
              <div className="quota-card casual">
                <div className="quota-header">
                  <h4>Casual Leave</h4>
                  <span className="balance-circle">{leaveBalances.casual.quota - leaveBalances.casual.taken} / {leaveBalances.casual.quota} Days</span>
                </div>
                <p>Allocated for general activities, short-term urgent matters. Must be planned where possible.</p>
                <span className="days-taken-sub">{leaveBalances.casual.taken} days taken</span>
              </div>
              <div className="quota-card medical">
                <div className="quota-header">
                  <h4>Medical Leave</h4>
                  <span className="balance-circle">{leaveBalances.medical.quota - leaveBalances.medical.taken} / {leaveBalances.medical.quota} Days</span>
                </div>
                <p>Allocated for physical sickness, rehabilitation, or unexpected medical check-ups.</p>
                <span className="days-taken-sub">{leaveBalances.medical.taken} days taken</span>
              </div>
              <div className="quota-card earn">
                <div className="quota-header">
                  <h4>Earned Leave</h4>
                  <span className="balance-circle">{leaveBalances.earn.quota - leaveBalances.earn.taken} / {leaveBalances.earn.quota} Days</span>
                </div>
                <p>Accrued annual vacation period. Demands prior manager validation and scheduling.</p>
                <span className="days-taken-sub">{leaveBalances.earn.taken} days taken</span>
              </div>
            </div>

            {/* Leave Applications Tab Lists */}
            {isAdmin && (
              <div className="leave-approvals-section card mb-4">
                <div className="section-header-ops">
                  <h3>Pending Leave Approvals</h3>
                  <div className="search-box-v2" style={{ padding: '4px 10px' }}>
                    <Search size={16} />
                    <input 
                      type="text" 
                      placeholder="Search approvals..." 
                      value={leaveSearch}
                      onChange={(e) => setLeaveSearch(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'white', outline: 'none', fontSize: '12px' }}
                    />
                  </div>
                </div>
                <div className="table-responsive-ops">
                  <table className="hr-data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Total Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLeaveApplications
                        .filter(app => 
                          app.userName?.toLowerCase().includes(leaveSearch.toLowerCase()) &&
                          app.status === 'Pending'
                        )
                        .map(app => (
                          <tr key={app.id}>
                            <td>
                              <div className="emp-cell">
                                <span className="emp-name">{app.userName}</span>
                                <span className="emp-email">{app.userEmail}</span>
                              </div>
                            </td>
                            <td><span className="leave-type-pill">{app.leaveType}</span></td>
                            <td>{app.startDate}</td>
                            <td>{app.endDate}</td>
                            <td>{app.days} Days</td>
                            <td>
                              <div className="reason-cell-width" title={app.reason}>{app.reason}</div>
                            </td>
                            <td><span className="type-tag manual">{app.status}</span></td>
                            <td className="action-buttons-cell">
                              <button 
                                className="approve-action-btn"
                                onClick={() => handleLeaveApproval(app.id, 'Approved')}
                              >
                                Approve
                              </button>
                              <button 
                                className="reject-action-btn"
                                onClick={() => handleLeaveApproval(app.id, 'Rejected')}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leave History List */}
            <div className="leave-history-section">
              <div className="section-header-ops">
                <h3>{isAdmin ? 'All Leave History Logs' : 'Your Leave History'}</h3>
                <Button variant="primary" icon={PlusCircle} onClick={() => setIsLeaveModalOpen(true)}>
                  Apply for Leave
                </Button>
              </div>

              <div className="table-responsive-ops">
                <table className="hr-data-table">
                  <thead>
                    <tr>
                      <th>Date Applied</th>
                      <th>Leave Type</th>
                      <th>Duration</th>
                      <th>Total Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isAdmin ? allLeaveApplications : leaveApplications)
                      .slice((leavePage - 1) * itemsPerPage, leavePage * itemsPerPage)
                      .map((app, idx) => (
                        <tr key={app.id || idx}>
                          <td>{app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '--'}</td>
                          <td><span className="leave-type-pill">{app.leaveType}</span></td>
                          <td>{app.startDate} to {app.endDate}</td>
                          <td>{app.days} Days</td>
                          <td>
                            <div className="reason-cell-width" title={app.reason}>{app.reason}</div>
                          </td>
                          <td>
                            <span className={`type-tag ${app.status === 'Approved' ? 'gps' : app.status === 'Rejected' ? 'manual' : 'info'}`}>
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              <Pagination 
                currentPage={leavePage}
                totalPages={Math.ceil((isAdmin ? allLeaveApplications : leaveApplications).length / itemsPerPage)}
                onPageChange={setLeavePage}
                totalItems={(isAdmin ? allLeaveApplications : leaveApplications).length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          </div>
        )}

        {/* 3. EMPLOYEE MASTER TAB */}
        {activeTab === 'employee_master' && isAdmin && (
          <div className="employee-base-salaries">
            <div className="section-header-ops">
              <h3>Employee Master & Salary Structures</h3>
              <div className="search-box-v2" style={{ padding: '4px 10px' }}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search Employee..." 
                  value={empMasterSearch}
                  onChange={(e) => setEmpMasterSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', color: 'white', outline: 'none', fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="table-responsive-ops">
              <table className="hr-data-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Designation (Role)</th>
                    <th>Email Address</th>
                    <th>Gross Salary</th>
                    <th>Monthly TDS (Tax)</th>
                    <th>Net Monthly Salary</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList
                    .filter(u => u.name.toLowerCase().includes(empMasterSearch.toLowerCase()) || u.email?.toLowerCase().includes(empMasterSearch.toLowerCase()))
                    .slice((employeePage - 1) * itemsPerPage, employeePage * itemsPerPage)
                    .map(emp => {
                      const struct = emp.salaryStructure || {};
                      const gross = struct.grossSalary || emp.baseSalary || 0;
                      const tax = struct.incomeTax || 0;
                      const net = struct.netSalary || emp.baseSalary || 0;

                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="emp-cell">
                              <span className="emp-name">{emp.name}</span>
                              <span className="emp-email">{emp.phone || 'No phone'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="leave-type-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                              {emp.role || 'Staff'}
                            </span>
                          </td>
                          <td>{emp.email}</td>
                          <td className="font-bold">BDT {gross.toLocaleString()}</td>
                          <td className="text-danger">BDT {tax.toLocaleString()}</td>
                          <td className="text-success font-bold">BDT {net.toLocaleString()}</td>
                          <td className="text-right">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              icon={Settings} 
                              onClick={() => handleOpenEditModal(emp)}
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            
            <Pagination 
              currentPage={employeePage}
              totalPages={Math.ceil(usersList.filter(u => u.name.toLowerCase().includes(empMasterSearch.toLowerCase()) || u.email?.toLowerCase().includes(empMasterSearch.toLowerCase())).length / itemsPerPage)}
              onPageChange={setEmployeePage}
              totalItems={usersList.filter(u => u.name.toLowerCase().includes(empMasterSearch.toLowerCase()) || u.email?.toLowerCase().includes(empMasterSearch.toLowerCase())).length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}

        {/* 4. PAYROLL TAB */}
        {activeTab === 'payroll' && (
          <div className="payroll-tab-container">
            <Card className="payroll-controls-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Generate Salary Payroll Sheet</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>Compile monthly salaries, check late penalities, overtime, and sales incentives.</p>
                </div>
                <div>
                  <Button variant="primary" onClick={() => setIsGenerateModalOpen(true)}>
                    Generate Payroll Sheet
                  </Button>
                </div>
              </div>
            </Card>

            {isPayrollGenerated && (
              <div className="payroll-sheet-section">
                <div className="section-header-ops" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h3>Compiled Salaries for {payrollMonth}</h3>
                    {submittedPayrollStatus && (
                      <span className={`status-badge ${submittedPayrollStatus === 'Approved' ? 'deal-confirmed' : 'follow-up'}`} style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}>
                        Status: {submittedPayrollStatus}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Button 
                      variant="secondary" 
                      onClick={() => window.print()}
                      className="print-btn-no-print"
                      icon={Printer}
                    >
                      Print Sheet
                    </Button>
                    {!submittedPayrollStatus && (
                      <Button 
                        variant="primary" 
                        onClick={handleSubmitPayrollToAccounts}
                      >
                        Submit Payroll to Accounts
                      </Button>
                    )}
                  </div>
                </div>
                <div className="table-responsive-ops payroll-print-sheet-area" style={{ position: 'relative' }}>
                  {submittedPayrollStatus === 'Approved' && (
                    <div className="payslip-watermark" style={{ fontSize: '7rem', opacity: 0.15 }}>APPROVED</div>
                  )}
                  <table className="hr-data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Gross Base</th>
                        <th>Days Present</th>
                        <th>Lates</th>
                        <th>Sales Commission</th>
                        <th>OT (Hrs)</th>
                        <th>Total Deductions</th>
                        <th>Net Payable</th>
                        <th className="text-right print-btn-no-print">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollSheet.map((row, idx) => (
                        <tr key={row.employeeId || idx}>
                          <td>
                            <div className="emp-cell">
                              <span className="emp-name">{row.employeeName}</span>
                              <span className="emp-email">{row.employeeEmail}</span>
                            </div>
                          </td>
                          <td>BDT {parseFloat(row.baseSalary || row.grossSalary || 0).toLocaleString()}</td>
                          <td>{row.presentDays} / 30</td>
                          <td className={row.lateCount > 0 ? 'text-danger' : ''}>
                            {row.lateCount} ({row.latePenaltyDays}d penalty)
                          </td>
                          <td className={row.salesIncentive > 0 ? 'text-success font-bold' : ''}>
                             BDT {parseFloat(row.salesIncentive || 0).toLocaleString()}
                          </td>
                          <td>{row.otHours} hrs (BDT {parseFloat(row.otPay || 0).toLocaleString()})</td>
                          <td className="text-danger">BDT {parseFloat(row.totalDeduction || 0).toLocaleString()}</td>
                          <td className="font-bold text-success">BDT {parseFloat(row.netPayable || 0).toLocaleString()}</td>
                          <td className="text-right print-btn-no-print" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {!submittedPayrollStatus && (
                              <button 
                                className="payslip-btn-icon"
                                onClick={() => {
                                  setEditingPayrollRow(row);
                                  setEditingRowIdx(idx);
                                }}
                                style={{ background: 'rgba(197, 160, 89, 0.15)', color: 'var(--primary)' }}
                              >
                                <Edit size={12} />
                                Edit
                              </button>
                            )}
                            <button 
                              className="payslip-btn-icon"
                              onClick={() => {
                                setSelectedPayslip({ 
                                  ...row, 
                                  month: payrollMonth, 
                                  isApproved: submittedPayrollStatus === 'Approved' 
                                });
                                setIsPayslipModalOpen(true);
                              }}
                            >
                              <Eye size={12} />
                              Payslip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Seal and Sign Space */}
                  <div className="sheet-signatures" style={{ display: 'none', justifyContent: 'space-between', marginTop: '60px', padding: '20px' }}>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Prepared By (HR)</span>
                    </div>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Checked By (Accounts)</span>
                    </div>
                    <div style={{ textAlign: 'center', width: '180px' }}>
                      <div style={{ borderTop: '1px dashed #333', marginBottom: '8px' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Approved & Sealed (MD)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. ORGANIZATION SETTINGS TAB */}
        {activeTab === 'organization' && isAdmin && (
          <div className="settings-grid-dashboard">
            
            {/* Shift Config */}
            <Card className="settings-card-full">
              <div className="card-header-ops">
                <h3>Shift Timing Configuration</h3>
              </div>
              <div className="card-body-ops">
                <div className="settings-form-row">
                  <div className="form-group-ops">
                    <label>Shift Start Time</label>
                    <input 
                      type="time" 
                      value={hrSettings.shiftStart} 
                      onChange={(e) => setHrSettings({ ...hrSettings, shiftStart: e.target.value })}
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Shift End Time</label>
                    <input 
                      type="time" 
                      value={hrSettings.shiftEnd} 
                      onChange={(e) => setHrSettings({ ...hrSettings, shiftEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div className="settings-form-row mt-16">
                  <div className="form-group-ops">
                    <label>Grace Time Buffer (Minutes)</label>
                    <input 
                      type="number" 
                      value={hrSettings.graceTime} 
                      onChange={(e) => setHrSettings({ ...hrSettings, graceTime: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Overtime Threshold Buffer (Minutes)</label>
                    <input 
                      type="number" 
                      value={hrSettings.otThreshold} 
                      onChange={(e) => setHrSettings({ ...hrSettings, otThreshold: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Geofencing Config */}
            <Card className="settings-card-full">
              <div className="card-header-ops">
                <h3>Geofencing Range Control</h3>
              </div>
              <div className="card-body-ops">
                <div className="geolocation-config-box">
                  <h4>Configure Location Geofence Boundary</h4>
                  <p className="hint-text">Check-in from coordinates other than office latitude/longitude will be locked.</p>
                  
                  <div className="coords-inputs-row">
                    <div className="form-group-ops">
                      <label>Latitude Coordinate</label>
                      <input 
                        type="number" 
                        step="any"
                        value={hrSettings.officeLatitude}
                        onChange={(e) => setHrSettings({ ...hrSettings, officeLatitude: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group-ops">
                      <label>Longitude Coordinate</label>
                      <input 
                        type="number" 
                        step="any"
                        value={hrSettings.officeLongitude}
                        onChange={(e) => setHrSettings({ ...hrSettings, officeLongitude: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <Button variant="secondary" icon={MapPin} onClick={handleGetCurrentCoords}>
                      Get GPS Coords
                    </Button>
                  </div>

                  <div className="form-group-ops mt-16">
                    <label>Fence Radius Buffer Range (meters)</label>
                    <input 
                      type="number" 
                      value={hrSettings.officeRadius}
                      onChange={(e) => setHrSettings({ ...hrSettings, officeRadius: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Weekend Policy selector */}
            <Card className="settings-card-full weekend-policy-selector">
              <div className="card-header-ops">
                <h3>Weekend Policy Selection</h3>
              </div>
              <div className="card-body-ops">
                <span className="section-label">Select Weekend Days</span>
                <div className="weekdays-checkboxes-grid">
                  {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                    <label key={day} className="checkbox-v3">
                      <input 
                        type="checkbox" 
                        checked={hrSettings.weekendDays.includes(day)}
                        onChange={() => handleWeekendDayToggle(day)}
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            {/* Annual Quotas */}
            <Card className="settings-card-full annual-leave-quotas">
              <div className="card-header-ops">
                <h3>Annual Leave Quotas Allocation</h3>
              </div>
              <div className="card-body-ops">
                <div className="quotas-inputs-row">
                  <div className="form-group-ops">
                    <label>Casual Leave Quota</label>
                    <input 
                      type="number" 
                      value={hrSettings.casualQuota}
                      onChange={(e) => setHrSettings({ ...hrSettings, casualQuota: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Medical Leave Quota</label>
                    <input 
                      type="number" 
                      value={hrSettings.medicalQuota}
                      onChange={(e) => setHrSettings({ ...hrSettings, medicalQuota: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Earned Leave Quota</label>
                    <input 
                      type="number" 
                      value={hrSettings.earnedQuota}
                      onChange={(e) => setHrSettings({ ...hrSettings, earnedQuota: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Holiday Calendar */}
            <Card className="settings-card-full">
              <div className="card-header-ops">
                <h3>Holiday Calendar List</h3>
              </div>
              <div className="card-body-ops">
                <form onSubmit={handleAddHoliday} className="add-holiday-inline-form">
                  <div className="form-group-ops">
                    <label>Holiday Description</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Eid-ul-Fitr Vacation" 
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Holiday Date</label>
                    <input 
                      type="date" 
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    />
                  </div>
                  <Button variant="primary" type="submit">
                    Add Holiday
                  </Button>
                </form>

                <div className="holidays-list-container">
                  <h4>Registered Holidays List</h4>
                  <div className="holidays-scroll-grid">
                    {(hrSettings.holidays || []).map((h) => (
                      <div key={h.id} className="holiday-item-chip">
                        <div className="holiday-info">
                          <span className="holiday-date">{h.date}</span>
                          <span className="holiday-name">{h.name}</span>
                        </div>
                        <button 
                          className="remove-holiday-btn"
                          onClick={() => handleRemoveHoliday(h.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Organization Info & Document Branding Card */}
            <Card className="settings-card-full">
              <div className="card-header-ops">
                <h3>Organization Info & Document Branding</h3>
              </div>
              <div className="card-body-ops">
                <div className="settings-form-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group-ops" style={{ flex: 1, minWidth: '280px' }}>
                    <label>Organization Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Khan Shaheb Development Ltd"
                      value={hrSettings.orgName || ''} 
                      onChange={(e) => setHrSettings({ ...hrSettings, orgName: e.target.value })}
                    />
                  </div>
                  <div className="form-group-ops" style={{ flex: 1, minWidth: '280px' }}>
                    <label>Organization Logo (Used on Slip/PDF)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setHrSettings(prev => ({
                              ...prev,
                              orgLogo: event.target.result
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ padding: '6px 12px' }}
                    />
                    {hrSettings.orgLogo && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={hrSettings.orgLogo} 
                          alt="Org Logo Preview" 
                          style={{ height: '40px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px', background: '#fff' }} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setHrSettings({ ...hrSettings, orgLogo: '' })}
                          style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Remove Logo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="settings-form-row mt-16" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div className="form-group-ops" style={{ flex: 1.5, minWidth: '280px' }}>
                    <label>Organization Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. House 12, Road 5, Banani, Dhaka"
                      value={hrSettings.orgAddress || ''} 
                      onChange={(e) => setHrSettings({ ...hrSettings, orgAddress: e.target.value })}
                    />
                  </div>
                  <div className="form-group-ops" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Organization Phone</label>
                    <input 
                      type="text" 
                      placeholder="e.g. +880 1234-567890"
                      value={hrSettings.orgPhone || ''} 
                      onChange={(e) => setHrSettings({ ...hrSettings, orgPhone: e.target.value })}
                    />
                  </div>
                  <div className="form-group-ops" style={{ flex: 1, minWidth: '200px' }}>
                    <label>Organization Email</label>
                    <input 
                      type="email" 
                      placeholder="e.g. info@khanshaheb.com"
                      value={hrSettings.orgEmail || ''} 
                      onChange={(e) => setHrSettings({ ...hrSettings, orgEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Save Buttons */}
            <div className="settings-save-footer">
              <Button 
                variant="primary" 
                onClick={handleSaveHrSettings}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'Saving Settings...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* MODALS */}

      {/* A. Apply Leave Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Apply for Leave"
        size="md"
      >
        <form onSubmit={handleApplyLeave} className="hr-modal-form">
          <div className="form-group-ops">
            <label>Leave Category Type</label>
            <select 
              value={newLeaveApplication.leaveType}
              onChange={(e) => setNewLeaveApplication({ ...newLeaveApplication, leaveType: e.target.value })}
            >
              <option value="Casual">Casual Leave</option>
              <option value="Medical">Medical Leave</option>
              <option value="Earned">Earned Leave</option>
            </select>
          </div>

          <div className="form-row-ops">
            <div className="form-group-ops">
              <label>Start Date</label>
              <input 
                type="date" 
                value={newLeaveApplication.startDate}
                onChange={(e) => setNewLeaveApplication({ ...newLeaveApplication, startDate: e.target.value })}
              />
            </div>
            <div className="form-group-ops">
              <label>End Date</label>
              <input 
                type="date" 
                value={newLeaveApplication.endDate}
                onChange={(e) => setNewLeaveApplication({ ...newLeaveApplication, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group-ops">
            <label>Leave Reason Justification</label>
            <textarea 
              rows={3} 
              placeholder="Detail reasons for manager confirmation..."
              value={newLeaveApplication.reason}
              onChange={(e) => setNewLeaveApplication({ ...newLeaveApplication, reason: e.target.value })}
            />
          </div>

          <div className="modal-actions-ops">
            <Button variant="outline" type="button" onClick={() => setIsLeaveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* B. Manual Attendance Log Modal (Admin) */}
      <Modal
        isOpen={isManualLogModalOpen}
        onClose={() => setIsManualLogModalOpen(false)}
        title="Add Manual Attendance Log"
        size="md"
      >
        <form onSubmit={handleAddManualLog} className="hr-modal-form">
          <div className="form-group-ops">
            <label>Select Employee Name</label>
            <select 
              value={newManualLog.userId}
              onChange={(e) => setNewManualLog({ ...newManualLog, userId: e.target.value })}
              required
            >
              <option value="" disabled>Select Employee</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="form-group-ops">
            <label>Attendance Date</label>
            <input 
              type="date" 
              value={newManualLog.date}
              onChange={(e) => setNewManualLog({ ...newManualLog, date: e.target.value })}
              required
            />
          </div>

          <div className="form-row-ops">
            <div className="form-group-ops">
              <label>Check In Time</label>
              <input 
                type="time" 
                value={newManualLog.checkInTime}
                onChange={(e) => setNewManualLog({ ...newManualLog, checkInTime: e.target.value })}
                required
              />
            </div>
            <div className="form-group-ops">
              <label>Check Out Time</label>
              <input 
                type="time" 
                value={newManualLog.checkOutTime}
                onChange={(e) => setNewManualLog({ ...newManualLog, checkOutTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group-ops">
            <label>Attendance Status Override</label>
            <select 
              value={newManualLog.status}
              onChange={(e) => setNewManualLog({ ...newManualLog, status: e.target.value })}
            >
              <option value="Present">Present</option>
              <option value="Late">Late (Shift late)</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          <div className="form-group-ops">
            <label>Notes / Explanations</label>
            <input 
              type="text" 
              placeholder="e.g. Client meeting or Field visit bypass" 
              value={newManualLog.notes}
              onChange={(e) => setNewManualLog({ ...newManualLog, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions-ops">
            <Button variant="outline" type="button" onClick={() => setIsManualLogModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Log</Button>
          </div>
        </form>
      </Modal>

      {/* C. Salary Slip / Payslip Modal */}
      <Modal
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
        title="Employee Payslip Receipt"
        size="lg"
      >
        {selectedPayslip && (
          <div>
            <div className="payslip-print-area" style={{ position: 'relative' }}>
              {(selectedPayslip.isApproved || submittedPayrollStatus === 'Approved') && (
                <div className="payslip-watermark">APPROVED</div>
              )}
              <div className="payslip-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                {hrSettings.orgLogo && (
                  <img src={hrSettings.orgLogo} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '10px' }} />
                )}
                <h2>{hrSettings.orgName || 'Nest CRM'}</h2>
                <p>{hrSettings.orgAddress || 'House 12, Road 5, Banani, Dhaka, Bangladesh'}</p>
                {(hrSettings.orgPhone || hrSettings.orgEmail) && (
                  <p style={{ fontSize: '0.8rem', marginTop: '-4px' }}>
                    {hrSettings.orgPhone && `Phone: ${hrSettings.orgPhone}`} 
                    {hrSettings.orgPhone && hrSettings.orgEmail && ' | '}
                    {hrSettings.orgEmail && `Email: ${hrSettings.orgEmail}`}
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
                  <strong>{selectedPayslip.employeeEmail}</strong>
                </div>
                <div className="payslip-col">
                  <span>System Designation / Role</span>
                  <strong>{selectedPayslip.role}</strong>
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
                      <td style={{ textAlign: 'right' }}>{(selectedPayslip.salaryStructure?.basicSalary || selectedPayslip.baseSalary || 0).toLocaleString()}</td>
                    </tr>
                    {selectedPayslip.salaryStructure?.houseRent > 0 && (
                      <tr>
                        <td>House Rent Allowance</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.salaryStructure.houseRent.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.salaryStructure?.medical > 0 && (
                      <tr>
                        <td>Medical Allowance</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.salaryStructure.medical.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.salaryStructure?.transport > 0 && (
                      <tr>
                        <td>Transport Allowance</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.salaryStructure.transport.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.salaryStructure?.otherAllowance > 0 && (
                      <tr>
                        <td>Other Allowances</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.salaryStructure.otherAllowance.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.otPay > 0 && (
                      <tr>
                        <td>Overtime Pay ({selectedPayslip.otHours} hrs)</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.otPay.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.salesIncentive > 0 && (
                      <tr>
                        <td>Sales Incentive Commission ({selectedPayslip.salaryStructure?.salesIncentiveRate || 0}%)</td>
                        <td style={{ textAlign: 'right' }}>{selectedPayslip.salesIncentive.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                      <th>Deductions Component</th>
                      <th style={{ textAlign: 'right' }}>Amount (BDT)</th>
                    </tr>
                    {selectedPayslip.providentFund > 0 && (
                      <tr>
                        <td className="text-danger">Provident Fund Contribution</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.providentFund.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.incomeTax > 0 && (
                      <tr>
                        <td className="text-danger">Income Tax (TDS) (BD Gov Rules)</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.incomeTax.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.loan > 0 && (
                      <tr>
                        <td className="text-danger">Loan Repayment / Advance</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.loan.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.otherDeductions > 0 && (
                      <tr>
                        <td className="text-danger">Other Deductions</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.otherDeductions.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.absenceDeduction > 0 && (
                      <tr>
                        <td className="text-danger">Unpaid Absences ({selectedPayslip.absentDays} days)</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.absenceDeduction.toLocaleString()}</td>
                      </tr>
                    )}
                    {selectedPayslip.latePenaltyDeduction > 0 && (
                      <tr>
                        <td className="text-danger">Late Penalties ({selectedPayslip.lateCount} lates)</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{selectedPayslip.latePenaltyDeduction.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr className="grand-total-row">
                      <td><strong>NET PAYABLE SALARY</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                        BDT {selectedPayslip.netPayable.toLocaleString()}
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

      {/* Edit Payroll Modal */}
      <Modal
        isOpen={editingPayrollRow !== null}
        onClose={() => setEditingPayrollRow(null)}
        title={`Modify Payroll: ${editingPayrollRow?.employeeName || ''}`}
        size="md"
      >
        {editingPayrollRow && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const updatedRows = [...payrollSheet];
            updatedRows[editingRowIdx] = editingPayrollRow;
            setPayrollSheet(updatedRows);
            setEditingPayrollRow(null);
            showToast("Payroll updated locally!", "success");
          }} className="hr-modal-form">
            <div className="form-row-ops">
              <div className="form-group-ops">
                <label>Gross Base Salary (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.baseSalary}
                  onChange={(e) => handleEditFieldChange('baseSalary', e.target.value)}
                  required
                />
              </div>
              <div className="form-group-ops">
                <label>Overtime Pay (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.otPay}
                  onChange={(e) => handleEditFieldChange('otPay', e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="form-row-ops">
              <div className="form-group-ops">
                <label>Sales Commission / Incentive (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.salesIncentive}
                  onChange={(e) => handleEditFieldChange('salesIncentive', e.target.value)}
                  required
                />
              </div>
              <div className="form-group-ops">
                <label>Unpaid Absences Deduction (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.absenceDeduction}
                  onChange={(e) => handleEditFieldChange('absenceDeduction', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-ops">
              <div className="form-group-ops">
                <label>Late Penalty Deduction (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.latePenaltyDeduction}
                  onChange={(e) => handleEditFieldChange('latePenaltyDeduction', e.target.value)}
                  required
                />
              </div>
              <div className="form-group-ops">
                <label>Provident Fund (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.providentFund}
                  onChange={(e) => handleEditFieldChange('providentFund', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-ops">
              <div className="form-group-ops">
                <label>Income Tax (TDS) (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.incomeTax}
                  onChange={(e) => handleEditFieldChange('incomeTax', e.target.value)}
                  required
                />
              </div>
              <div className="form-group-ops">
                <label>Loan Repayment / Advance (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.loan}
                  onChange={(e) => handleEditFieldChange('loan', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row-ops">
              <div className="form-group-ops">
                <label>Other Deductions (BDT)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.otherDeductions}
                  onChange={(e) => handleEditFieldChange('otherDeductions', e.target.value)}
                  required
                />
              </div>
              <div className="form-group-ops">
                <label>Total Deductions (BDT - Computed)</label>
                <input 
                  type="number"
                  value={editingPayrollRow.totalDeduction}
                  disabled
                  style={{ opacity: 0.7, background: 'var(--background-secondary)' }}
                />
              </div>
            </div>

            <div className="form-group-ops">
              <label>Net Payable Salary (BDT - Final)</label>
              <input 
                type="number"
                value={editingPayrollRow.netPayable}
                onChange={(e) => setEditingPayrollRow(prev => ({ ...prev, netPayable: parseFloat(e.target.value) || 0 }))}
                style={{ fontWeight: 'bold', color: 'var(--success)' }}
                required
              />
            </div>

            <div className="modal-actions-ops">
              <Button variant="outline" type="button" onClick={() => setEditingPayrollRow(null)}>Cancel</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Generate Payroll Month Select Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Payroll Sheet"
        size="sm"
      >
        <div style={{ padding: '10px 5px' }}>
          <div className="form-group-ops" style={{ marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Target Month & Year</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={selectedMonthIndex}
                onChange={(e) => setSelectedMonthIndex(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  background: 'var(--background-secondary)', 
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
              
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  background: 'var(--background-secondary)', 
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y.toString()}>{y}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="info-note" style={{ marginBottom: '20px', display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <AlertCircle size={16} style={{ marginTop: '2px', color: 'var(--primary)' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Calculates basic base salary, overtime hours, sales commissions, late penalties, and unpaid absence deductions for all active employees.
            </div>
          </div>
          <div className="modal-actions-ops" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="outline" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              handleGeneratePayroll();
              setIsGenerateModalOpen(false);
            }}>Generate Sheet</Button>
          </div>
        </div>
      </Modal>

      {/* D. Employee Profile & Salary Structure Modal */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title={`Manage Employee Profile & Salary: ${selectedEmployeeForEdit?.name || ''}`}
        size="lg"
      >
        {selectedEmployeeForEdit && (
          <form onSubmit={handleSaveEmployeeProfile} className="hr-modal-form">
            
            {/* Row 1: Profile & Promotion Details */}
            <div className="employee-modal-section mb-16">
              <h4>Profile & Promotion Settings</h4>
              <div className="form-row-ops">
                <div className="form-group-ops">
                  <label>Effective From Date</label>
                  <input 
                    type="date" 
                    value={editEmployeeData.effectiveFrom}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, effectiveFrom: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-ops">
                  <label>System Role (Designation)</label>
                  <select 
                    value={editEmployeeData.role}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, role: e.target.value })}
                    required
                  >
                    <option value="Admin">Admin</option>
                    <option value="MD">MD</option>
                    <option value="System Admin">System Admin</option>
                    <option value="Sales Manager">Sales Manager</option>
                    <option value="Sales Executive">Sales Executive</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="HR Executive">HR Executive</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Earnings & Deductions Details (2-Column Grid) */}
            <div className="employee-modal-grid">
              
              {/* Column 1: Earnings */}
              <div className="employee-modal-section">
                <h4>Earnings Structure</h4>
                
                <div className="form-group-ops mb-16">
                  <label>Basic Salary (BDT)</label>
                  <input 
                    type="number" 
                    value={editEmployeeData.basicSalary}
                    onChange={(e) => {
                      const basic = parseFloat(e.target.value) || 0;
                      setEditEmployeeData({ 
                        ...editEmployeeData, 
                        basicSalary: basic,
                        houseRent: Math.round(basic * 0.5),
                        medical: Math.round(basic * 0.1),
                        transport: Math.round(basic * 0.05),
                        providentFund: Math.round(basic * 0.1)
                      });
                    }}
                    required
                  />
                </div>

                <div className="form-group-ops mb-16">
                  <label>House Rent (BDT)</label>
                  <input 
                    type="number" 
                    value={editEmployeeData.houseRent}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, houseRent: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group-ops mb-16">
                  <label>Medical Allowance (BDT)</label>
                  <input 
                    type="number" 
                    value={editEmployeeData.medical}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, medical: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-row-ops mb-16">
                  <div className="form-group-ops">
                    <label>Transport / Conveyance</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.transport}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, transport: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Other Allowances</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.otherAllowance}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, otherAllowance: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-ops mb-16">
                  <div className="form-group-ops">
                    <label>Festive Bonuses (Annual Count)</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.festiveBonuses}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, festiveBonuses: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Sales Incentive Rate (%)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={editEmployeeData.salesIncentiveRate}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, salesIncentiveRate: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group-ops">
                  <label>Calculated Gross Salary</label>
                  <span className="read-only-val">
                    BDT {(
                      (parseFloat(editEmployeeData.basicSalary) || 0) +
                      (parseFloat(editEmployeeData.houseRent) || 0) +
                      (parseFloat(editEmployeeData.medical) || 0) +
                      (parseFloat(editEmployeeData.transport) || 0) +
                      (parseFloat(editEmployeeData.otherAllowance) || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Column 2: Deductions */}
              <div className="employee-modal-section">
                <h4>Deductions Structure</h4>

                <div className="form-row-ops mb-16">
                  <div className="form-group-ops">
                    <label>Tax Bracket Category</label>
                    <select 
                      value={editEmployeeData.taxCategory}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, taxCategory: e.target.value })}
                      required
                    >
                      <option value="male">General / Male (350K Limit)</option>
                      <option value="female_senior">Female / Senior (65+) (400K Limit)</option>
                      <option value="disabled">Disabled Person (475K Limit)</option>
                      <option value="freedom_fighter">Freedom Fighter (500K Limit)</option>
                    </select>
                  </div>
                  <div className="form-group-ops">
                    <label>Provident Fund (BDT)</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.providentFund}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, providentFund: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-ops mb-16">
                  <div className="form-group-ops">
                    <label>Loan Installment (BDT)</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.loan}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, loan: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group-ops">
                    <label>Other Deductions (BDT)</label>
                    <input 
                      type="number" 
                      value={editEmployeeData.otherDeductions}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, otherDeductions: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                {/* Auto Tax Calculation details according to BD Law */}
                {(() => {
                  const calc = calculateSalaryBreakdown(
                    editEmployeeData.basicSalary,
                    editEmployeeData.houseRent,
                    editEmployeeData.medical,
                    editEmployeeData.transport,
                    editEmployeeData.otherAllowance,
                    editEmployeeData.festiveBonuses,
                    editEmployeeData.taxCategory,
                    editEmployeeData.providentFund,
                    editEmployeeData.loan,
                    editEmployeeData.otherDeductions
                  );
                  return (
                    <>
                      <div className="form-group-ops mb-16">
                        <label>Auto-Calculated Tax (BD Law)</label>
                        <span className="read-only-val deduction">
                          BDT {calc.incomeTax.toLocaleString()} / Month
                        </span>
                        <div className="tax-calc-box">
                          <strong>BD Tax Calculation Basis (Income Tax Act 2023):</strong>
                          <span>Projected Annual Income: BDT {calc.annualIncome.toLocaleString()}</span>
                          <span>Salary Exemption (1/3rd or 450K): BDT {calc.exemption.toLocaleString()}</span>
                          <span>Net Taxable Income: BDT {calc.taxableIncome.toLocaleString()}</span>
                          <span>Annual Income Tax Due: BDT {calc.annualTax.toLocaleString()}</span>
                          <span>Monthly TDS Deduction: BDT {calc.incomeTax.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="form-group-ops mb-16">
                        <label>Total Deductions</label>
                        <span className="read-only-val deduction">
                          BDT {calc.totalDeductions.toLocaleString()}
                        </span>
                      </div>

                      <div className="form-group-ops">
                        <label>Net Monthly Take-home Salary</label>
                        <span className="read-only-val" style={{ color: 'var(--success)', background: 'rgba(34, 197, 94, 0.1)' }}>
                          BDT {calc.netSalary.toLocaleString()}
                        </span>
                      </div>
                    </>
                  );
                })()}

              </div>
            </div>

            {/* Section 3: Promotion / Update History */}
            <div className="promotion-history-box">
              <h4>Promotion & Salary Structure History</h4>
              <div className="table-responsive-ops">
                <table className="promotion-history-table">
                  <thead>
                    <tr>
                      <th>Effective Date</th>
                      <th>Designation Change</th>
                      <th>Salary Change</th>
                      <th>Update Context</th>
                      <th>Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeForEdit.salaryHistory && selectedEmployeeForEdit.salaryHistory.length > 0 ? (
                      selectedEmployeeForEdit.salaryHistory.map((hist, idx) => (
                        <tr key={idx}>
                          <td>{hist.effectiveFrom || hist.updatedAt?.split('T')[0]}</td>
                          <td>
                            {hist.oldRole !== hist.newRole ? (
                              <><strong>{hist.oldRole}</strong> &rarr; <strong>{hist.newRole}</strong></>
                            ) : (
                              <span>{hist.newRole} (No change)</span>
                            )}
                          </td>
                          <td>
                            BDT {hist.oldSalary?.toLocaleString()} &rarr; BDT {hist.newSalary?.toLocaleString()}
                          </td>
                          <td>
                            {hist.isPromotion ? (
                              <span className="type-tag gps">Promotion</span>
                            ) : (
                              <span className="type-tag manual">Adjustment</span>
                            )}
                          </td>
                          <td>{hist.updatedBy}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No promotion or salary adjustment history recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-actions-ops">
              <Button variant="outline" type="button" onClick={() => setIsEmployeeModalOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Toast Notifications container */}
      {toastConfig.show && (
        <Toast 
          message={toastConfig.message} 
          type={toastConfig.type} 
          onClose={() => setToastConfig({ ...toastConfig, show: false })} 
        />
      )}

    </DashboardLayout>
  );
};

export default HROperations;
