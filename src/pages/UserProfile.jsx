import React, { useState } from 'react';
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
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  TrendingUp,
  Target,
  Users,
  CheckCircle,
  Clock,
  Briefcase,
  History,
  Settings as SettingsIcon,
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Profile.css'; // Reusing profile styles

const UserProfile = () => {
  // Mock User State
  const userData = {
    name: 'Ahmedullah Khan',
    email: 'ahmed@nestinnova.com',
    phone: '+880 1711-223344',
    role: 'CEO & Founder',
    location: 'Dhaka, Bangladesh',
    bio: 'Leading the future of real estate technology with Faham-Estate.',
    avatar: 'https://i.pravatar.cc/150?u=ahmed'
  };

  // Mock Stats
  const stats = [
    { label: 'Lead Entries', value: '1,245', icon: Target, color: 'var(--primary)', className: 'icon-target' },
    { label: 'Assigned Leads', value: '840', icon: Users, color: '#10B981', className: 'icon-team' },
    { label: 'Success Deals', value: '156', icon: CheckCircle, color: '#F59E0B', className: 'icon-check' },
    { label: 'Performance KPI', value: '94%', icon: TrendingUp, color: '#8B5CF6', className: 'icon-trend' },
  ];

  // Mock Analytics Data
  const chartData = [
    { name: 'Mon', leads: 40, deals: 4 },
    { name: 'Tue', leads: 30, deals: 2 },
    { name: 'Wed', leads: 65, deals: 8 },
    { name: 'Thu', leads: 45, deals: 5 },
    { name: 'Fri', leads: 90, deals: 12 },
    { name: 'Sat', leads: 55, deals: 7 },
    { name: 'Sun', leads: 20, deals: 1 },
  ];

  const pieData = [
    { name: 'Success', value: 156 },
    { name: 'Pending', value: 450 },
    { name: 'Lost', value: 234 },
  ];
  const COLORS = ['#10B981', 'var(--primary)', '#EF4444'];

  const teamHistory = [
    { team: 'Strategic Sales', role: 'Team Lead', period: '2025 - Present', status: 'Active', icon: Briefcase, iconClass: 'icon-building' },
    { team: 'Customer Relations', role: 'Manager', period: '2023 - 2024', status: 'Previous', icon: History, iconClass: 'icon-history' },
    { team: 'Market Research', role: 'Senior Executive', period: '2021 - 2023', status: 'Previous', icon: Users, iconClass: 'icon-team' },
  ];

  return (
    <DashboardLayout>
      <div className="profile-page-container">
        
        {/* Profile Header Card */}
        <div className="profile-hero-card">
          <div className="profile-cover"></div>
          <div className="profile-header-content">
            <div className="avatar-wrapper">
              <img src={userData.avatar} alt="Profile" className="profile-avatar-lg" />
            </div>
            <div className="profile-main-info">
              <h1>{userData.name}</h1>
              <p>{userData.role} • {userData.location}</p>
            </div>
            <div className="profile-header-actions">
              <Link to="/settings/profile">
                <Button variant="secondary" icon={SettingsIcon}>Settings</Button>
              </Link>
              <Button variant="primary" icon={MessageSquare}>Message</Button>
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

          {/* Analytics Section */}
          <div className="analytics-section">
            <Card className="chart-card main-chart">
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
                    <span className="p-target-value">42 / 50</span>
                  </div>
                  <div className="p-progress-bg">
                    <div className="p-progress-fill" style={{ width: '84%', background: 'linear-gradient(90deg, var(--primary), #7C3AED)' }}></div>
                  </div>
                  <div className="p-progress-hint">84% achieved. You are almost there!</div>
                </div>

                <div className="p-target-item">
                  <div className="p-target-info">
                    <div className="p-target-label">
                      <Users size={18} className="icon-team" />
                      <span>Follow-up Target</span>
                    </div>
                    <span className="p-target-value">120 / 200</span>
                  </div>
                  <div className="p-progress-bg">
                    <div className="p-progress-fill" style={{ width: '60%', background: 'linear-gradient(90deg, #10B981, #34D399)' }}></div>
                  </div>
                  <div className="p-progress-hint">60% achieved. Keep up the momentum!</div>
                </div>
              </div>
            </Card>

            <Card className="chart-card main-chart">
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

            <div className="side-analytics">
              <Card className="chart-card">
                <h3>Deal Conversion</h3>
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
                    <span className="p-val">156</span>
                    <span className="p-label">Success</span>
                  </div>
                </div>
                <div className="pie-legend">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="legend-item">
                      <span className="l-dot" style={{ backgroundColor: COLORS[idx] }}></span>
                      <span className="l-name">{item.name}</span>
                      <span className="l-val">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="chart-card team-history-card">
                <h3>Team History</h3>
                <div className="timeline-v6">
                  {teamHistory.map((item, idx) => (
                    <div key={idx} className={`timeline-item ${item.status.toLowerCase()}`}>
                      <div className="t-icon">
                        <item.icon size={16} className={item.iconClass} />
                      </div>
                      <div className="t-content">
                        <div className="t-header">
                          <h4>{item.team}</h4>
                          <span className={`t-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                        </div>
                        <p className="t-role">{item.role}</p>
                        <p className="t-date"><Clock size={12} /> {item.period}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserProfile;
