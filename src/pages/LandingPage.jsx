import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { 
  ArrowRight, 
  Zap, 
  Users, 
  Shield, 
  Smartphone, 
  BarChart3, 
  Calendar, 
  Database, 
  CheckCircle2, 
  MessageSquare,
  Layout,
  MapPin,
  Clock,
  ChevronRight,
  Menu,
  Award,
  TrendingUp,
  Cpu,
  Layers,
  ArrowUpRight,
  Sparkles,
  Play,
  Sun,
  Moon,
  Building2,
  DollarSign,
  LayoutDashboard,
  Mail,
  Phone
} from 'lucide-react';
import useThemeStore from '../store/useThemeStore';
import './LandingPage.css';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  // Live Interactive Portal Sandbox States
  const [activeSandboxTab, setActiveSandboxTab] = useState('dashboard');
  const [mockLeads, setMockLeads] = useState([
    { id: 1, name: 'Zayan Rahman', company: 'Prime Estates Ltd', email: 'zayan@prime.com', status: 'Hot', phone: '+8801712345678' },
    { id: 2, name: 'Nabil Karim', company: 'Innova Towers', email: 'nabil@innova.com', status: 'Warm', phone: '+8801812345679' },
    { id: 3, name: 'Suhana Chowdhury', company: 'Green Valley Properties', email: 'suhana@greenvalley.com', status: 'Cold', phone: '+8801912345680' }
  ]);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState('Hot');
  const [selectedSandboxDate, setSelectedSandboxDate] = useState(12); // Day 12 selected

  const handleAddMockLead = (e) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadEmail.trim()) return;
    const newLead = {
      id: Date.now(),
      name: newLeadName,
      company: newLeadCompany || 'Individual Client',
      email: newLeadEmail,
      status: newLeadStatus,
      phone: '+88017XXXXXXXX'
    };
    setMockLeads([newLead, ...mockLeads]);
    setNewLeadName('');
    setNewLeadCompany('');
    setNewLeadEmail('');
  };

  const handleRemoveMockLead = (id) => {
    setMockLeads(mockLeads.filter(lead => lead.id !== id));
  };

  const { isDarkMode, toggleDarkMode } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  };

  const stagger = {
    whileInView: { transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="landing-page">
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="lp-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#26E264" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>
          <linearGradient id="lp-icon-gradient-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
      </svg>
      <div className="lp-bg-layers">
        <div className="lp-navy-glow"></div>
        <div className="lp-gold-glow-subtle"></div>
      </div>

      {/* 1. Navbar */}
      <nav className={`lp-nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="lp-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '100%' }}>
          <div className="lp-logo">
            <img src="/Nest%20CRM%20Logo%20without%20background.png" alt="Logo" className="lp-logo-img" />
            <span className="lp-brand-text">Nest CRM</span>
          </div>
          <div className={`lp-nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)}>About</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
            <a href="#workflow" onClick={() => setIsMobileMenuOpen(false)}>WorkFlow</a>
            <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
            <button 
              className="lp-theme-toggle" 
              onClick={toggleDarkMode}
              aria-label="Toggle Theme"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lp-text-white)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                margin: '0 8px',
                borderRadius: '50%',
                transition: 'all 0.3s'
              }}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link to="/login" className="lp-btn lp-btn-outline mobile-full-width" style={{ padding: '12px 32px', fontSize: '1rem' }}>Login</Link>
            <Link to="/login" className="lp-btn lp-btn-primary mobile-full-width" style={{ padding: '12px 32px', fontSize: '1rem' }}>Start Free Trial</Link>
          </div>
          <button 
            className="lp-mobile-menu-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            {isMobileMenuOpen ? <ArrowRight size={24} style={{ transform: 'rotate(-90deg)' }} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="hero-layout">
            <div className="hero-content">
              <motion.div 
                className="hero-tag"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Sparkles size={14} />
                <span>Premium Real Estate Intelligence</span>
              </motion.div>
              
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Close More Deals with a Smarter Real Estate CRM
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Track leads, manage teams, automate follow-ups, and monitor transactions in real-time — all in one place.
              </motion.p>

              <motion.div 
                className="hero-actions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <Link to="/login" className="lp-btn lp-btn-primary">
                  Start Free Trial <ArrowRight size={18} />
                </Link>
                <button className="lp-btn lp-btn-outline">
                  <Play size={18} fill="currentColor" /> Watch Demo
                </button>
              </motion.div>
            </div>

            <motion.div 
              className="hero-mockup-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.6 }}
            >
              <div className="mockup-glow"></div>
              <div className="hero-mockup-wrapper">
                <img 
                  src={isDarkMode ? "/landing/dashboard-preview.png?v=1.0.4" : "/landing/dashboard-preview-light.png?v=1.0.2"} 
                  alt="CRM Dashboard" 
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. Core Value Proposition */}
      <section id="about" className="value-props">
        <div className="lp-container">
          <motion.div 
            className="props-grid"
            variants={stagger}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <ValuePropItem icon={<Zap />} title="Real-time Data Sync" desc="Instant updates across all devices." />
            <ValuePropItem icon={<TrendingUp />} title="Lead-to-Conversion" desc="Optimized sales pipeline tracking." />
            <ValuePropItem icon={<Calendar />} title="Smart Scheduling" desc="Automated follow-up reminders." />
            <ValuePropItem icon={<Shield />} title="Hierarchy Control" desc="Granular role-based permissions." />
          </motion.div>
        </div>
      </section>

      {/* Live Interactive Sandbox Section */}
      <section className="sandbox-section">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-title has-subtitle">
              Experience the Live Sandbox
            </motion.h2>
            <motion.p variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-subtitle">
              Explore a fully simulated version of the Nest CRM portal right here. Click tabs to navigate.
            </motion.p>
          </div>

          <motion.div 
            className="sandbox-window"
            variants={fadeIn}
            initial="initial"
            whileInView="whileInView"
          >
            {/* Mock Browser Titlebar */}
            <div className="sandbox-titlebar">
              <div className="titlebar-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="titlebar-url">
                <span>https://app.nestcrm.com/{activeSandboxTab}</span>
              </div>
            </div>

            <div className="sandbox-body">
              {/* Mock Sidebar */}
              <div className="sandbox-sidebar">
                <div className="sandbox-sb-brand">
                  <div className="sandbox-sb-logo">N</div>
                  <span className="sandbox-sb-title">Nest CRM</span>
                </div>
                
                <div className="sandbox-sb-menu">
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                    { id: 'leads', label: 'Leads', icon: Users },
                    { id: 'projects', label: 'Projects', icon: Layers },
                    { id: 'hr', label: 'HR Operations', icon: Layout },
                    { id: 'payments', label: 'Payments', icon: BarChart3 },
                    { id: 'calendar', label: 'Calendar', icon: Calendar }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveSandboxTab(tab.id)}
                      className={`sandbox-sb-item ${activeSandboxTab === tab.id ? 'active' : ''}`}
                    >
                      <tab.icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="sandbox-sb-footer">
                  <div className="sandbox-sb-avatar">MS</div>
                  <div className="sandbox-sb-userinfo">
                    <strong>Mohammad Sajjad</strong>
                    <span>Admin</span>
                  </div>
                </div>
              </div>

              {/* Mock Workspace Content Panel */}
              <div className="sandbox-content-panel">
                {activeSandboxTab === 'dashboard' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header">
                      <h3>Super Admin Dashboard</h3>
                      <p>Full platform overview — Nest CRM control center</p>
                    </div>

                    <div className="sandbox-stats-grid">
                      <div className="sandbox-stat-card">
                        <div className="stat-icon purple"><Building2 size={16} /></div>
                        <div>
                          <div className="stat-value">{mockLeads.length + 12}</div>
                          <div className="stat-label">Total Organizations</div>
                        </div>
                      </div>
                      <div className="sandbox-stat-card">
                        <div className="stat-icon yellow"><Clock size={16} /></div>
                        <div>
                          <div className="stat-value">3</div>
                          <div className="stat-label">Pending Approvals</div>
                        </div>
                      </div>
                      <div className="sandbox-stat-card">
                        <div className="stat-icon green"><Users size={16} /></div>
                        <div>
                          <div className="stat-value">{mockLeads.length + 8}</div>
                          <div className="stat-label">Active Agents</div>
                        </div>
                      </div>
                      <div className="sandbox-stat-card">
                        <div className="stat-icon blue"><DollarSign size={16} /></div>
                        <div>
                          <div className="stat-value">$18,450</div>
                          <div className="stat-label">Monthly Revenue</div>
                        </div>
                      </div>
                    </div>

                    <div className="sandbox-chart-section">
                      <h4>Platform Activity Analytics</h4>
                      <div className="sandbox-mock-chart">
                        <div className="chart-bar" style={{ height: '70%' }}><span>Jan</span></div>
                        <div className="chart-bar" style={{ height: '85%' }}><span>Feb</span></div>
                        <div className="chart-bar active" style={{ height: '95%' }}><span>Mar</span></div>
                        <div className="chart-bar" style={{ height: '60%' }}><span>Apr</span></div>
                        <div className="chart-bar" style={{ height: '80%' }}><span>May</span></div>
                        <div className="chart-bar" style={{ height: '90%' }}><span>Jun</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'leads' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3>Lead Management</h3>
                        <p>Track customer lifecycle and engagement status</p>
                      </div>
                      <span className="sandbox-badge-count">{mockLeads.length} Leads</span>
                    </div>

                    {/* Add Lead Inline Form */}
                    <form onSubmit={handleAddMockLead} className="sandbox-inline-form">
                      <input 
                        type="text" 
                        placeholder="Client Name" 
                        value={newLeadName}
                        onChange={e => setNewLeadName(e.target.value)}
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="Company" 
                        value={newLeadCompany}
                        onChange={e => setNewLeadCompany(e.target.value)}
                      />
                      <input 
                        type="email" 
                        placeholder="Email" 
                        value={newLeadEmail}
                        onChange={e => setNewLeadEmail(e.target.value)}
                        required
                      />
                      <select value={newLeadStatus} onChange={e => setNewLeadStatus(e.target.value)}>
                        <option value="Hot">🔥 Hot</option>
                        <option value="Warm">⚡ Warm</option>
                        <option value="Cold">❄️ Cold</option>
                      </select>
                      <button type="submit">Add Lead</button>
                    </form>

                    <div className="sandbox-table-wrapper">
                      <table className="sandbox-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockLeads.map(lead => (
                            <tr key={lead.id}>
                              <td>
                                <strong style={{ color: 'var(--lp-text-white)' }}>{lead.name}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--lp-text-dim)' }}>{lead.email}</div>
                              </td>
                              <td>{lead.company}</td>
                              <td>
                                <span className={`sandbox-status-badge ${lead.status.toLowerCase()}`}>
                                  {lead.status}
                                </span>
                              </td>
                              <td>
                                <button onClick={() => handleRemoveMockLead(lead.id)} className="sandbox-row-action">Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'projects' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header">
                      <h3>Project Directory</h3>
                      <p>Property portfolio and construction status tracking</p>
                    </div>

                    <div className="sandbox-projects-list">
                      {[
                        { name: 'Nest Green Villa', loc: 'Uttara Sector 12, Dhaka', sales: 85, status: 'Completed' },
                        { name: 'Innova Commercial Space', loc: 'Banani Road 11, Dhaka', sales: 40, status: 'Ongoing' },
                        { name: 'Urban Skyline Residencia', loc: 'Dhanmondi, Dhaka', sales: 95, status: 'Sold Out' }
                      ].map((p, i) => (
                        <div key={i} className="sandbox-project-card">
                          <div className="p-card-header">
                            <h4>{p.name}</h4>
                            <span className={`p-card-status ${p.status.toLowerCase().replace(' ', '-')}`}>{p.status}</span>
                          </div>
                          <p className="p-card-loc"><MapPin size={12} /> {p.loc}</p>
                          <div className="p-progress-container">
                            <span className="progress-label">Sales Conversion</span>
                            <div className="p-progress-bar-bg">
                              <div className="p-progress-bar-fill" style={{ width: `${p.sales}%` }}></div>
                            </div>
                            <span className="progress-percentage">{p.sales}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'hr' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header">
                      <h3>HR & Team Roster</h3>
                      <p>Active agents, system permissions, and logs</p>
                    </div>

                    <div className="sandbox-hr-grid">
                      {[
                        { name: 'Sufi Ahmed Faham', role: 'Product Director', status: 'Active', color: '#26E264' },
                        { name: 'Mohammad Sajjad Khan', role: 'System Admin', status: 'Active', color: '#00F0FF' }
                      ].map((item, i) => (
                        <div key={i} className="sandbox-hr-card">
                          <div className="hr-card-avatar" style={{ border: `2px solid ${item.color}` }}>
                            {item.name.charAt(0)}
                          </div>
                          <div className="hr-card-info">
                            <h4>{item.name}</h4>
                            <p>{item.role}</p>
                            <span className="hr-card-status"><span className="status-dot"></span>{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'payments' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header">
                      <h3>Installment Payments</h3>
                      <p>Monitor transactions and installment dues</p>
                    </div>

                    <div className="sandbox-table-wrapper">
                      <table className="sandbox-table">
                        <thead>
                          <tr>
                            <th>Transaction</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: 'Installment #3 - Nest Green Villa', amt: '$12,500', status: 'Paid', date: '25 Aug' },
                            { name: 'Down Payment - Innova Space', amt: '$45,000', status: 'Pending', date: '21 Aug' },
                            { name: 'Installment #1 - Urban Skyline', amt: '$8,000', status: 'Paid', date: '18 Aug' }
                          ].map((item, i) => (
                            <tr key={i}>
                              <td><strong>{item.name}</strong></td>
                              <td style={{ color: 'var(--lp-text-white)', fontWeight: 600 }}>{item.amt}</td>
                              <td>
                                <span className={`sandbox-status-badge ${item.status.toLowerCase()}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td>{item.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSandboxTab === 'calendar' && (
                  <div className="sandbox-tab-content">
                    <div className="sandbox-tab-header">
                      <h3>Calendar & Schedule</h3>
                      <p>Click day to view schedules and visit reminders</p>
                    </div>

                    <div className="sandbox-calendar-container">
                      <div className="sandbox-calendar-grid">
                        {Array.from({ length: 28 }).map((_, i) => {
                          const day = i + 1;
                          const hasEvent = day === 12 || day === 15 || day === 22;
                          return (
                            <button 
                              key={i} 
                              type="button"
                              onClick={() => setSelectedSandboxDate(day)}
                              className={`calendar-day-btn ${selectedSandboxDate === day ? 'selected' : ''} ${hasEvent ? 'has-event' : ''}`}
                            >
                              <span>{day}</span>
                              {hasEvent && <span className="event-dot"></span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="sandbox-calendar-agenda">
                        <h4>Agenda - Day {selectedSandboxDate}</h4>
                        {selectedSandboxDate === 12 ? (
                          <div className="agenda-item">
                            <span className="agenda-time">10:00 AM</span>
                            <div className="agenda-details">
                              <strong>Site Visit with Client</strong>
                              <p>Nest Green Villa, Uttara Sector 12</p>
                            </div>
                          </div>
                        ) : selectedSandboxDate === 15 ? (
                          <div className="agenda-item">
                            <span className="agenda-time">02:30 PM</span>
                            <div className="agenda-details">
                              <strong>Payment Follow-up</strong>
                              <p>Installment #2 due collection</p>
                            </div>
                          </div>
                        ) : selectedSandboxDate === 22 ? (
                          <div className="agenda-item">
                            <span className="agenda-time">11:00 AM</span>
                            <div className="agenda-details">
                              <strong>Agreement Signing</strong>
                              <p>Prime Estates contract closure</p>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: '12px', color: 'var(--lp-text-dim)' }}>No events scheduled for this day.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. Features Section */}
      <section id="features" className="features-section">
        <div className="lp-container">
          <div style={{ textAlign: 'center' }}>
            <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-title">
              Enterprise-Grade Features
            </motion.h2>
          </div>
          <motion.div 
            className="features-grid"
            variants={stagger}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <FeatureCard 
              icon={<Users />}
              title="Lead Management"
              desc="Lifecycle tracking & timeline history for every interaction."
            />
            <FeatureCard 
              icon={<Database />}
              title="Project & Inventory"
              desc="Comprehensive management of property listings and units."
            />
            <FeatureCard 
              icon={<Clock />}
              title="Smart Scheduling"
              desc="Calendar integration with missed task alerts."
            />
            <FeatureCard 
              icon={<Layers />}
              title="Team & Role"
              desc="RBAC with clear organizational hierarchy and visibility."
            />
            <FeatureCard 
              icon={<BarChart3 />}
              title="Payment Tracking"
              desc="Monitor transactions and installments in real-time."
            />
            <FeatureCard 
              icon={<Zap />}
              title="Real-time Alerts"
              desc="Firebase-powered instant notifications for your team."
            />
          </motion.div>
        </div>
      </section>

      {/* 5. Workflow Section */}
      <section id="workflow" className="workflow-section">
        <div className="lp-container">
          <div style={{ textAlign: 'center' }}>
            <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-title has-subtitle">
              Streamlined Sales Workflow
            </motion.h2>
            <motion.p variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-subtitle">
              From initial contact to final signature, our platform ensures no lead is left behind.
            </motion.p>
          </div>
          <div className="workflow-container">
            <WorkflowCard 
              num="01" 
              title="Lead Capture" 
              brief="Automatically capture leads from all digital touchpoints with instant source tracking." 
            />
            <WorkflowCard 
              num="02" 
              title="Smart Assignment" 
              brief="Intelligently route leads to the right team members based on territory and performance." 
            />
            <WorkflowCard 
              num="03" 
              title="Engagement" 
              brief="Execute timely follow-ups with automated reminders and full interaction histories." 
            />
            <WorkflowCard 
              num="04" 
              title="Closing" 
              brief="Move deals through a visual pipeline with integrated document and payment tracking." 
            />
          </div>
        </div>
      </section>

      {/* 7. Unique Selling Points */}
      <section className="usp-section">
        <div className="lp-container">
          <div className="usp-grid">
            <motion.div className="usp-card" variants={fadeIn} initial="initial" whileInView="whileInView">
              <div className="icon-box"><Sparkles /></div>
              <h3>Premium Glassmorphism</h3>
              <p>A luxury-feel interface designed for high-end real estate professionals.</p>
            </motion.div>
            <motion.div className="usp-card" variants={fadeIn} initial="initial" whileInView="whileInView">
              <div className="icon-box"><Cpu /></div>
              <h3>Real-time Performance</h3>
              <p>Powered by Firebase for sub-second updates across your entire organization.</p>
            </motion.div>
          </div>
        </div>
      </section>


      {/* 8. Mobile Experience */}
      <section className="mobile-section">
        <div className="lp-container">
          <div className="mobile-layout">
            <div className="mobile-content">
              <motion.div 
                className="hero-tag" 
                style={{ marginBottom: '24px' }}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
              >
                <span>The Agent's Companion</span>
              </motion.div>
              <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" style={{ fontSize: '3.5rem', marginBottom: '10px' }}>
                CRM in Your Pocket
              </motion.h2>
              <motion.p variants={fadeIn} initial="initial" whileInView="whileInView" style={{ marginBottom: '30px', color: 'var(--lp-text-muted)', fontSize: '1.1rem' }}>
                Empower your field agents with a mobile experience that's as powerful as the desktop. Designed for the high-paced world of property visits and on-site closings.
              </motion.p>
              
              <div className="mobile-features-grid">
                <div className="m-feat-card">
                  <div className="m-feat-icon"><MapPin size={20} /></div>
                  <div className="m-feat-info">
                    <h4 className="lp-gold-text">On-Site Visits</h4>
                    <p>Log visits and client feedback instantly with GPS-tagged entries.</p>
                  </div>
                </div>
                <div className="m-feat-card">
                  <div className="m-feat-icon"><Zap size={20} /></div>
                  <div className="m-feat-info">
                    <h4 className="lp-gold-text">Instant Comms</h4>
                    <p>One-tap WhatsApp, Email, and Phone integration for every lead.</p>
                  </div>
                </div>
                <div className="m-feat-card">
                  <div className="m-feat-icon"><Layout size={20} /></div>
                  <div className="m-feat-info">
                    <h4 className="lp-gold-text">Smart FAB</h4>
                    <p>Our signature Floating Action Button puts core tools at your thumb.</p>
                  </div>
                </div>
                <div className="m-feat-card">
                  <div className="m-feat-icon"><Cpu size={20} /></div>
                  <div className="m-feat-info">
                    <h4 className="lp-gold-text">Offline Sync</h4>
                    <p>Work even in low-connectivity areas; sync automatically when back online.</p>
                  </div>
                </div>
              </div>

              <motion.div variants={fadeIn} initial="initial" whileInView="whileInView" style={{ marginTop: '20px' }}>
                <button className="lp-btn lp-btn-primary">
                  <Smartphone size={18} /> Explore Mobile Features
                </button>
              </motion.div>
            </div>
            <motion.div 
              className="mobile-mockup-wrapper"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <div className="mobile-glow"></div>
              <img src="/landing/luxury-mobile.png" alt="Mobile App UI" />
            </motion.div>
          </div>
        </div>
      </section>


      {/* 9. Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="lp-container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-title has-subtitle">
              SaaS Subscription Packages
            </motion.h2>
            <motion.p variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-subtitle">
              Flexible pricing options engineered to scale with your real estate organization.
            </motion.p>
          </div>

          <div className="pricing-grid">
            <PriceCard 
              plan="Free Trial" 
              price="$0" 
              features={[
                "1 Month Trial Access",
                "1 User Seat Limit",
                "Lead Management basics",
                "Timeline Logging History",
                "Missed Task Alerts",
                "Standard Web Portal"
              ]} 
            />
            <PriceCard 
              plan="Starter Space" 
              price="$49" 
              features={[
                "Up to 10 Team Members",
                "Lead Lifecycle Manager",
                "Property Inventory logs",
                "Basic Follow-Up Reminders",
                "Secure Supabase DB Backend",
                "Email Support SLA"
              ]} 
            />
            <PriceCard 
              plan="Professional Organization" 
              price="$99" 
              popular={true} 
              features={[
                "Up to 25 Team Members",
                "All CRM Workspaces included",
                "Payments & Installments Log",
                "Smart Roster & Hierarchy",
                "Advanced Sales Pipeline",
                "Priority Support SLA"
              ]} 
            />
            <PriceCard 
              plan="Custom Enterprise" 
              price="Custom" 
              features={[
                "Unlimited Team Members",
                "Custom Domain Branding",
                "Active Directory Integration",
                "Dedicated Account Manager",
                "99.9% Uptime Guarantee",
                "API & Custom Integrations"
              ]} 
            />
          </div>
        </div>
      </section>


      {/* 11. Testimonials */}
      <section className="testimonials-section" style={{ padding: '120px 0', textAlign: 'center' }}>
        <div className="lp-container">
          <div style={{ textAlign: 'center' }}>
            <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView" className="lp-section-title">Trusted by Industry Leaders</motion.h2>
          </div>
          <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'center', gap: '40px', opacity: 0.5 }}>
            {/* Logos could go here */}
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>ESTATE CORP</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>PRIME REALTY</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>LUX HOMES</span>
          </div>
        </div>
      </section>

      {/* 12. Final CTA */}
      <section className="lp-final-cta">
        <div className="cta-content">
          <motion.h2 variants={fadeIn} initial="initial" whileInView="whileInView">
            Ready to Transform Your <br />
            <span className="lp-gold-gradient">Sales Process?</span>
          </motion.h2>
          <motion.p variants={fadeIn} initial="initial" whileInView="whileInView" className="cta-desc">
            Join elite real estate professionals who are already scaling their organizations with our high-performance CRM.
          </motion.p>
          <motion.div variants={fadeIn} initial="initial" whileInView="whileInView">
            <Link to="/login" className="lp-btn lp-btn-primary cta-btn">
              Start Your Journey Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="lp-footer">
        <div className="lp-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="lp-logo">
                <img src="/Nest%20CRM%20Logo%20without%20background.png" alt="Logo" className="lp-logo-img" style={{ height: '50px', width: '50px' }} />
                <span className="lp-brand-text" style={{ fontSize: '0.7rem' }}>Nest CRM</span>
              </div>
              <p style={{ marginTop: '20px', color: 'var(--lp-text-dim)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                The premium choice for real estate intelligence and team management.
              </p>
              
              <div style={{ marginTop: '32px' }}>
                <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', marginBottom: '12px' }}>Stay Updated</h4>
                <form className="lp-newsletter-form" onSubmit={(e) => e.preventDefault()}>
                  <input type="email" placeholder="Enter your email..." required />
                  <button type="submit">Subscribe</button>
                </form>
              </div>
            </div>

            <div>
              <h4 style={{ marginBottom: '24px', fontSize: '1rem', color: '#fff' }}>Quick Links</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li><a href="#features" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none', fontSize: '0.9rem' }}>Features</a></li>
                <li><a href="#sandbox" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none', fontSize: '0.9rem' }}>Live Sandbox</a></li>
                <li><a href="#pricing" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none', fontSize: '0.9rem' }}>Pricing Plans</a></li>
                <li><Link to="/login" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none', fontSize: '0.9rem' }}>Agent Portal</Link></li>
                <li><Link to="/login" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none', fontSize: '0.9rem' }}>Start Free Trial</Link></li>
              </ul>
            </div>

            <div>
              <h4 style={{ marginBottom: '24px', fontSize: '1rem', color: '#fff' }}>Contact Us</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.9rem', color: 'var(--lp-text-dim)' }}>
                  <MapPin size={16} style={{ color: 'var(--lp-gold)', flexShrink: 0, marginTop: '2px' }} />
                  <span>Road: 08, Sector: 07,<br />Uttara, Dhaka-1230.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.9rem', color: 'var(--lp-text-dim)' }}>
                  <Mail size={16} style={{ color: 'var(--lp-gold)', flexShrink: 0 }} />
                  <a href="mailto:nestcrm@nestinnova.com" style={{ color: 'inherit', textDecoration: 'none' }}>nestcrm@nestinnova.com</a>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.9rem', color: 'var(--lp-text-dim)' }}>
                  <Phone size={16} style={{ color: 'var(--lp-gold)', flexShrink: 0 }} />
                  <a href="tel:+8801972372395" style={{ color: 'inherit', textDecoration: 'none' }}>+8801972372395</a>
                </li>
                <li style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                  <a href="#about" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>About Us &rarr;</a>
                </li>
              </ul>
            </div>

            <div className="footer-map-col">
              <h4 style={{ marginBottom: '24px', fontSize: '1rem', color: '#fff' }}>Find Us</h4>
              <div className="lp-footer-map">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3648.432654316049!2d90.3853177!3d23.8742881!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3757c5ef2a39b33b%3A0xe54e6e66e2c340df!2sUttara%20Sector%2012%20Park!5e0!3m2!1sen!2sbd!4v1700000000000!5m2!1sen!2sbd" 
                  width="100%" 
                  height="130" 
                  style={{ border: 0, opacity: 0.8 }} 
                  allowFullScreen="" 
                  loading="lazy"
                  title="Nest Innova Location"
                ></iframe>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-credits">
              <p>
                Product visionary <strong>Sufi Nazib Ahmed Faham</strong> &nbsp; | &nbsp; 
                Designed and developed by <strong>Mohammad Sajjad Khan</strong> &nbsp; | &nbsp; 
                A product of <a href="https://www.nestinnova.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lp-gold)', textDecoration: 'none', fontWeight: 600 }}>Nest Innova Tech</a>
              </p>
            </div>
            <div className="footer-legal">
              <p>© 2026 Nest CRM. All rights reserved.</p>
              <div className="legal-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ValuePropItem = ({ icon, title, desc }) => (
  <motion.div className="prop-item" variants={{ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } }}>
    <div style={{ color: 'var(--lp-gold)', marginBottom: '16px' }}>{icon}</div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </motion.div>
);

const FeatureCard = ({ icon, title, desc }) => (
  <motion.div className="feature-card" variants={{ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } }}>
    <div className="icon-box">{icon}</div>
    <h3>{title}</h3>
    <p>{desc}</p>
  </motion.div>
);

const WorkflowCard = ({ num, title, brief }) => (
  <motion.div className="workflow-card" variants={{ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } }}>
    <div className="workflow-step-num">{num}</div>
    <h3>{title}</h3>
    <p>{brief}</p>
  </motion.div>
);

const PriceCard = ({ plan, price, popular, features }) => (
  <div className={`price-card ${popular ? 'popular' : ''}`} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
    {popular && <div className="popular-pill">Most Popular</div>}
    <h4>{plan}</h4>
    <div className="amount">
      {price !== 'Custom' && <span className="currency">$</span>}
      {price.replace('$', '')}
      {price !== 'Custom' && <span className="period">/mo</span>}
    </div>
    <ul className="price-features" style={{ listStyle: 'none', padding: 0, margin: '20px 0 40px 0', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {features.map((f, i) => (
        <li key={i} className="price-feature-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--lp-text-muted)', transition: 'all 0.2s' }}>
          <CheckCircle2 size={16} className="lp-gold" /> {f}
        </li>
      ))}
    </ul>
    <Link to="/login" className={`lp-btn ${popular ? 'lp-btn-primary' : 'lp-btn-outline'}`} style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
      Get Started
    </Link>
  </div>
);

export default LandingPage;
