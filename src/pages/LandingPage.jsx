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
  Moon
} from 'lucide-react';
import useThemeStore from '../store/useThemeStore';
import './LandingPage.css';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
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
            <img src="/logo.png" alt="Logo" className="lp-logo-img" />
            <span className="lp-brand-text">REAL ESTATE CRM</span>
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
      <section className="value-props">
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
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="lp-logo">
                <img src="/logo.png" alt="Logo" className="lp-logo-img" style={{ height: '50px', width: '50px' }} />
                <span className="lp-brand-text" style={{ fontSize: '0.7rem' }}>REAL ESTATE CRM</span>
              </div>
              <p style={{ marginTop: '20px', color: 'var(--lp-text-dim)' }}>
                The premium choice for real estate intelligence and team management.
              </p>
            </div>
            <div className="footer-links-wrapper">
              <div>
                <h4 style={{ marginBottom: '24px' }}>Product</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li><a href="#features" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none' }}>Features</a></li>
                  <li><a href="#workflow" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none' }}>Workflow</a></li>
                </ul>
              </div>
              <div>
                <h4 style={{ marginBottom: '24px' }}>Company</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <li><a href="#" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none' }}>About</a></li>
                  <li><a href="#" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none' }}>Contact</a></li>
                  <li><a href="#" style={{ color: 'var(--lp-text-dim)', textDecoration: 'none' }}>Privacy</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="footer-credits">
              <p>
                Product visionary <strong>Sufi Nazib Ahmed Faham</strong> &nbsp; | &nbsp; 
                Designed and developed by <strong>Mohammad Sajjad Khan</strong> &nbsp; | &nbsp; 
                A product of <strong>NestInnova</strong>
              </p>
            </div>
            <div className="footer-legal">
              <p>© 2026 Real Estate CRM. All rights reserved.</p>
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
  <div className={`price-card ${popular ? 'popular' : ''}`}>
    <h4>{plan}</h4>
    <div className="amount">{price}{price !== 'Custom' && <span>/mo</span>}</div>
    <ul style={{ listStyle: 'none', padding: 0, margin: '40px 0', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {features.map((f, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--lp-text-muted)' }}>
          <CheckCircle2 size={16} className="lp-gold" /> {f}
        </li>
      ))}
    </ul>
    <Link to="/login" className={`lp-btn ${popular ? 'lp-btn-primary' : 'lp-btn-outline'}`} style={{ width: '100%', justifyContent: 'center' }}>
      Get Started
    </Link>
  </div>
);

export default LandingPage;
