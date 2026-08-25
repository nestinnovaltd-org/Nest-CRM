import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid
} from 'recharts';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import {
  User,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Target,
  Users,
  CheckCircle,
  Clock,
  Briefcase,
  History,
  MessageSquare,
  ChevronLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';
import './Profile.css';

const UserDetails = () => {
  const { userId } = useParams();
  const [userData, setUserData] = useState({
    name: 'Loading...',
    email: '',
    phone: '',
    role: '',
    location: '',
    bio: '',
    avatar: '',
    status: 'Active',
    target: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (error || !data) { setError(true); setLoading(false); return; }
      const resolvedName = (
        data.full_name ||
        data.fullName ||
        data.display_name ||
        data.name ||
        data.username ||
        (data.first_name ? `${data.first_name} ${data.last_name || ''}` : null) ||
        data.email ||
        'Unnamed User'
      ).toString().trim();
      setUserData({
        id: data.id,
        name: resolvedName,
        email: data.email || data.username || 'No email',
        phone: data.phone || 'No phone',
        role: data.role || 'Team Member',
        location: data.location || 'Not specified',
        bio: data.bio || "This user hasn't added a bio yet.",
        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=random`,
        status: data.status || 'Active',
        target: data.target || null
      });
      setError(false);
      setLoading(false);
    };
    fetchUser();
  }, [userId]);

  const [leadStats, setLeadStats] = useState({
    entries: 0,
    assigned: 0,
    success: 0,
    kpi: 0
  });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const fetchLeads = async () => {
      const { data: assignedLeads } = await supabase.from('leads').select('*').eq('assigned_to', userId);
      const { data: ownedLeads } = await supabase.from('leads').select('*').eq('owner_id', userId);
      const allLeads = [
        ...(assignedLeads || []),
        ...(ownedLeads || []).filter(l => !assignedLeads?.some(a => a.id === l.id))
      ];

      const entries = allLeads.filter(l => (l.owner_id || l.ownerId) === userId).length;
      const assigned = allLeads.filter(l => (l.assigned_to || l.assignedTo) === userId).length;
      const success = allLeads.filter(l => (l.assigned_to || l.assignedTo) === userId && l.status === 'Deal Confirmed').length;
      const followups = allLeads.filter(l => (l.assigned_to || l.assignedTo) === userId && (l.next_follow_up_date || l.nextFollowUpDate)).length;
      const kpi = assigned > 0 ? Math.round((success / assigned) * 100) : 0;
      setLeadStats({ entries, assigned, success, followups, kpi });

      const statusCounts = allLeads.reduce((acc, lead) => {
        const status = lead.status || 'Fresh Lead';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const processedPieData = [
        { name: 'Success', value: statusCounts['Deal Confirmed'] || 0 },
        { name: 'Pending', value: (statusCounts['Follow Up'] || 0) + (statusCounts['Under Negotiation'] || 0) },
        { name: 'Lost', value: statusCounts['Lost'] || 0 },
      ];
      setPieData(processedPieData.filter(d => d.value > 0));

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return { name: days[d.getDay()], dateStr: d.toISOString().split('T')[0], leads: 0, deals: 0 };
      }).reverse();

      allLeads.forEach(lead => {
        const createdAt = lead.created_at || lead.createdAt;
        if (!createdAt) return;
        const leadDate = new Date(createdAt).toISOString().split('T')[0];
        const dayMatch = last7Days.find(d => d.dateStr === leadDate);
        if (dayMatch) { dayMatch.leads++; if (lead.status === 'Deal Confirmed') dayMatch.deals++; }
      });
      setChartData(last7Days);
    };
    fetchLeads();
  }, [userId]);

  const COLORS = ['#10B981', 'var(--primary)', '#EF4444'];

  const stats = [
    { label: 'Lead Entries', value: leadStats.entries.toLocaleString(), icon: Target, color: 'var(--primary)', className: 'icon-target' },
    { label: 'Assigned Leads', value: leadStats.assigned.toLocaleString(), icon: Users, color: '#10B981', className: 'icon-team' },
    { label: 'Success Deals', value: leadStats.success.toLocaleString(), icon: CheckCircle, color: '#F59E0B', className: 'icon-check' },
    { label: 'Performance KPI', value: `${leadStats.kpi}%`, icon: TrendingUp, color: '#8B5CF6', className: 'icon-trend' },
  ];

  const leadProgress = userData.target?.leads ? Math.round((leadStats.assigned / userData.target.leads) * 100) : 0;
  const followUpProgress = userData.target?.followups ? Math.round((leadStats.followups / userData.target.followups) * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="profile-page-container">
          <Skeleton height="300px" borderRadius="24px" marginBottom="24px" />
          <div className="kpi-grid">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !userData) {
    return (
      <DashboardLayout>
        <div className="error-container" style={{ padding: '40px', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
          <h2>User Not Found</h2>
          <p>The user you are looking for does not exist or you don't have permission to view it.</p>
          <Link to="/users/all" style={{ marginTop: '20px', display: 'inline-block' }}>
            <Button variant="primary" icon={ChevronLeft}>Back to Users</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="profile-page-container">
        {/* Navigation Header */}
        <div className="details-nav-header" style={{ marginBottom: '20px' }}>
          <Link to="/users/all" className="back-link-v2">
            <ChevronLeft size={20} />
            <span>Back to User Management</span>
          </Link>
        </div>
        
        {/* Profile Header Card */}
        <div className="profile-hero-card">
          <div className="profile-cover"></div>
          <div className="profile-header-content">
            <div className="avatar-wrapper">
              <img src={userData.avatar} alt="Profile" className="profile-avatar-lg" />
            </div>
            <div className="profile-main-info">
              <div style={{ 
                fontSize: '1.75rem', 
                fontWeight: '800', 
                color: 'var(--text-primary)', 
                marginBottom: '4px',
                display: 'block'
              }}>
                {userData.name || 'Unnamed User'}
              </div>
              <p>{userData.role} • {userData.location}</p>
              <div className={`status-badge-v6 ${userData.status.toLowerCase()}`} style={{ marginTop: '8px', display: 'inline-flex' }}>
                <div className="dot"></div>
                {userData.status}
              </div>
            </div>
            <div className="profile-header-actions">
              <Button variant="secondary" icon={MessageSquare}>Send Message</Button>
              <Link to={`/leads/user/${userData.id}`}>
                <Button variant="primary" icon={Users}>View Assigned Leads</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="overview-tab-content">
          {/* KPI Grid */}
          <div className="kpi-grid">
            {stats.map((stat, idx) => (
              <Card key={idx} className="kpi-card">
                <div className="kpi-icon-box" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                  <stat.icon size={24} className={stat.className} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">{stat.label}</span>
                  <h2 className="kpi-value">{stat.value}</h2>
                </div>
              </Card>
            ))}
          </div>

          <div className="profile-content-grid">
            <div className="profile-main-column">
              {/* Analytics Section */}
              <div className="analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Performance Targets</h3>
                    <p>Monthly goal tracking and current progress</p>
                  </div>
                  <div className="profile-targets-grid">
                    <div className="p-target-item">
                      <div className="p-target-info">
                        <div className="p-target-label">
                          <Target size={18} className="icon-target" />
                          <span>Monthly Lead Target</span>
                        </div>
                        <span className="p-target-value">{leadStats.assigned} / {userData.target?.leads || 0} Leads</span>
                      </div>
                      <div className="p-progress-bg">
                        <div 
                          className="p-progress-fill" 
                          style={{ 
                            width: `${Math.min(100, leadProgress)}%`, 
                            background: 'linear-gradient(90deg, var(--primary), #7C3AED)' 
                          }}
                        ></div>
                      </div>
                      <div className="p-progress-hint">
                        {userData.target ? `${leadProgress}% achieved. Keep going!` : 'No target set for this month.'}
                      </div>
                    </div>

                    <div className="p-target-item">
                      <div className="p-target-info">
                        <div className="p-target-label">
                          <Clock size={18} className="icon-team" />
                          <span>Follow-up Target</span>
                        </div>
                        <span className="p-target-value">{leadStats.followups} / {userData.target?.followups || 0} Updates</span>
                      </div>
                      <div className="p-progress-bg">
                        <div className="p-progress-fill" style={{ width: `${Math.min(100, followUpProgress)}%`, background: 'linear-gradient(90deg, #10B981, #34D399)' }}></div>
                      </div>
                      <div className="p-progress-hint">
                        {userData.target ? `${followUpProgress}% achieved based on current activity.` : 'No follow-up target set.'}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="chart-card">
                  <div className="chart-header">
                    <h3>Lead Activity vs Success</h3>
                    <p>Live analytics for the current week</p>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="leads" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={32} />
                        <Bar dataKey="deals" fill="#10B981" radius={[4, 4, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>

            <div className="profile-side-column">
              <Card className="info-card-v6">
                <h4>Contact Details</h4>
                <div className="info-list-v6">
                  <div className="info-item-v6">
                    <Mail size={16} />
                    <span>{userData.email}</span>
                  </div>
                  <div className="info-item-v6">
                    <Phone size={16} />
                    <span>{userData.phone}</span>
                  </div>
                  <div className="info-item-v6">
                    <MapPin size={16} />
                    <span>{userData.location}</span>
                  </div>
                </div>
              </Card>

              <Card className="info-card-v6" style={{ marginTop: '20px' }}>
                <h4>About {userData.name ? userData.name.split(' ')[0] : 'User'}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {userData.bio}
                </p>
              </Card>

              <Card className="chart-card" style={{ marginTop: '20px' }}>
                <h3>Conversion Rate</h3>
                <div className="chart-container pie-container">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-center-text">
                    <span className="p-val">{leadStats.success}</span>
                    <span className="p-label">Success</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserDetails;
