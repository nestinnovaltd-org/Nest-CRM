import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  UserCircle2,
  CheckCircle2,
  BarChart3,
  Users,
  Zap,
  AlertCircle,
  Layout,
  ArrowLeft,
  Sun,
  Moon,
  Building2,
  Globe,
  User,
  Smartphone,
  ChevronLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import useThemeStore from '../store/useThemeStore';
import './LoginPage.css';


const logo = '/Nest%20CRM%20Logo%20without%20background.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot Password states
  const [view, setView] = useState('login'); // 'login', 'forgot', or 'signup'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Sign Up states
  const [signUpType, setSignUpType] = useState('select'); // 'select', 'org', 'custom'
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpOrgName, setSignUpOrgName] = useState('');
  const [signUpOrgPackage, setSignUpOrgPackage] = useState('starter'); // 'starter', 'professional', 'enterprise'
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState('');


  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();
  const { isDarkMode, toggleDarkMode } = useThemeStore();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  // Sync theme attribute with document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      // Navigate will be handled by the useEffect above
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e?.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess('');

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setForgotSuccess(data.message || 'Password reset link sent to your email.');
        setForgotEmail('');
      } else {
        setForgotError(data.error || 'Failed to send password reset link.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e?.preventDefault();
    setSignUpLoading(true);
    setSignUpError('');
    setSignUpSuccess('');

    if (!signUpName || !signUpEmail || !signUpPassword) {
      setSignUpError('Please fill in all required fields.');
      setSignUpLoading(false);
      return;
    }

    if (signUpPassword.length < 6) {
      setSignUpError('Password must be at least 6 characters.');
      setSignUpLoading(false);
      return;
    }

    try {
      // 1. Sign Up in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: {
            full_name: signUpName,
            phone: signUpPhone || '',
          }
        }
      });

      if (authError) throw authError;
      if (!authData?.user) throw new Error('No user data returned from authentication.');

      const userId = authData.user.id;

      if (signUpType === 'org') {
        if (!signUpOrgName) {
          throw new Error('Organization name is required.');
        }

        // Generate organization slug
        const slug = signUpOrgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');

        const maxUsers = signUpOrgPackage === 'starter' ? 10 : (signUpOrgPackage === 'professional' ? 25 : -1);

        // Insert organization
        const orgInsert = {
          name: signUpOrgName,
          slug: slug || 'org-' + Math.floor(Math.random() * 100000),
          status: 'pending',
          billing_package: signUpOrgPackage,
          billing_status: 'active',
          owner_id: userId,
          max_users: maxUsers,
          current_users: 1,
          created_at: new Date().toISOString(),
        };

        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .insert(orgInsert)
          .select()
          .single();

        if (orgError) throw orgError;

        // Create org admin user profile linked to org
        const profileData = {
          id: userId,
          full_name: signUpName,
          email: signUpEmail,
          phone: signUpPhone || null,
          org_id: orgData.id,
          account_type: 'org_admin',
          role: 'Admin',
          permissions: ['All'],
          status: 'Pending',
          approval_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from('users')
          .insert(profileData);

        if (profileError) throw profileError;
      }

      setSignUpSuccess('Registration successful! Redirecting...');
      
    } catch (err) {
      console.error('Registration error:', err);
      setSignUpError(err.message || 'Registration failed. Please try again.');
      setSignUpLoading(false);
    }
  };

  return (
    <div className="login-page" data-theme={isDarkMode ? 'dark' : 'light'}>
      {/* Cinematic Background Image with Vignette Overlay */}
      <motion.div 
        className="login-bg-image-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        key={isDarkMode ? 'dark' : 'light'}
      >
        <img 
          src={isDarkMode ? "/Login%20Page%20BG.png" : "/Login%20page%20bg%20light%20mode.png"} 
          alt="Background" 
          className="login-bg-image" 
        />
        <div className="login-bg-overlay"></div>
      </motion.div>

      <div className="login-container">
        
        {/* Main Frosted-Glass Login Card in the Center */}
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {view === 'login' ? (
            <>
              <div className="login-header">
                <img src={logo} alt="Logo" className="login-header-logo" />
                <h1>Welcome Back</h1>
                <p className="header-brand-text">REAL ESTATE CRM</p>
                <p className="header-subtitle">Please enter your credentials to continue</p>
              </div>

              {error && (
                <div className="login-error-msg">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form className="login-form" onSubmit={handleLogin}>
                <div className="form-group-v2">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input 
                      type="email" 
                      placeholder="name@company.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="form-group-v2">
                  <label>Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <button 
                      type="button" 
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-options">
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <button 
                    type="button" 
                    onClick={() => {
                      setView('forgot');
                      setError('');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="forgot-link"
                    style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="login-submit-btn" disabled={loading}>
                  {loading ? "Authenticating..." : "Login to Portal"}
                  {!loading && <ArrowRight size={20} />}
                </button>
              </form>
            </>
          ) : view === 'forgot' ? (
            <>
              <div className="login-header">
                <img src={logo} alt="Logo" className="login-header-logo" />
                <h1>Reset Password</h1>
                <p className="header-brand-text">REAL ESTATE CRM</p>
                <p className="header-subtitle">Enter your email to receive a password reset link</p>
              </div>

              {forgotError && (
                <div className="login-error-msg">
                  <AlertCircle size={18} />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div className="login-success-msg">
                  <CheckCircle2 size={18} />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              <form className="login-form" onSubmit={handleForgotPassword}>
                <div className="form-group-v2">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input 
                      type="email" 
                      placeholder="name@company.com" 
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="login-submit-btn" disabled={forgotLoading}>
                  {forgotLoading ? "Sending Link..." : "Send Reset Link"}
                  {!forgotLoading && <ArrowRight size={20} />}
                </button>

                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setView('login');
                      setError('');
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="forgot-link"
                    style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Sign Up views */}
              {signUpType === 'select' ? (
                <>
                  <div className="login-header">
                    <img src={logo} alt="Logo" className="login-header-logo" />
                    <h1>Create Account</h1>
                    <p className="header-brand-text">CRM REGISTRATION</p>
                    <p className="header-subtitle">Select your workspace account type below</p>
                  </div>

                  <div className="signup-type-grid">
                    <div 
                      className="signup-type-card"
                      onClick={() => { setSignUpType('org'); setSignUpError(''); }}
                    >
                      <div className="stc-icon"><Building2 size={20} /></div>
                      <div className="stc-content">
                        <h3>Organization Space</h3>
                        <p>SaaS Team Space. starter, professional, or enterprise tiers.</p>
                      </div>
                    </div>

                    <div 
                      className="signup-type-card"
                      onClick={() => { setSignUpType('custom'); setSignUpError(''); }}
                    >
                      <div className="stc-icon"><Globe size={20} /></div>
                      <div className="stc-content">
                        <h3>Custom Domain</h3>
                        <p>Dedicated instances with custom domains (Book Demo).</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : signUpType === 'org' ? (
                <>
                  <div className="login-header">
                    <button 
                      type="button" 
                      className="signup-back-link" 
                      onClick={() => setSignUpType('select')}
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <h1>Organization Signup</h1>
                    <p className="header-brand-text">TEAM ENVIRONMENT</p>
                    <p className="header-subtitle">Deploy a tenant CRM space for your team</p>
                  </div>

                  {signUpError && (
                    <div className="login-error-msg">
                      <AlertCircle size={18} />
                      <span>{signUpError}</span>
                    </div>
                  )}

                  {signUpSuccess && (
                    <div className="login-success-msg">
                      <CheckCircle2 size={18} />
                      <span>{signUpSuccess}</span>
                    </div>
                  )}

                  <form className="login-form" onSubmit={handleSignUp}>
                    <div className="form-group-v2">
                      <label>Organization Name</label>
                      <div className="input-with-icon">
                        <Building2 size={18} />
                        <input 
                          type="text" 
                          placeholder="My Agency Ltd" 
                          value={signUpOrgName}
                          onChange={(e) => setSignUpOrgName(e.target.value)}
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group-v2">
                      <label>Select Billing Plan</label>
                      <div className="input-with-icon">
                        <Zap size={18} style={{ pointerEvents: 'none' }} />
                        <select
                          value={signUpOrgPackage}
                          onChange={(e) => setSignUpOrgPackage(e.target.value)}
                          className="signup-select-input"
                          required
                        >
                          <option value="starter">Starter Plan ($49/mo - Max 10 Users)</option>
                          <option value="professional">Professional Plan ($99/mo - Max 25 Users)</option>
                          <option value="enterprise">Enterprise Plan ($199/mo - Unlimited Users)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group-v2">
                      <label>Admin Name</label>
                      <div className="input-with-icon">
                        <User size={18} />
                        <input 
                          type="text" 
                          placeholder="Your Name (Org Owner)" 
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group-v2">
                      <label>Email Address</label>
                      <div className="input-with-icon">
                        <Mail size={18} />
                        <input 
                          type="email" 
                          placeholder="admin@myagency.com" 
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          required 
                        />
                      </div>
                    </div>

                    <div className="form-group-v2">
                      <label>Phone Number</label>
                      <div className="input-with-icon">
                        <Smartphone size={18} />
                        <input 
                          type="tel" 
                          placeholder="+88017XXXXXXXX" 
                          value={signUpPhone}
                          onChange={(e) => setSignUpPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group-v2">
                      <label>Password</label>
                      <div className="input-with-icon">
                        <Lock size={18} />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="•••••••• (Min 6 chars)" 
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          required 
                        />
                        <button 
                          type="button" 
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="login-submit-btn" disabled={signUpLoading}>
                      {signUpLoading ? "Deploying tenant environment..." : "Deploy CRM Environment"}
                      {!signUpLoading && <ArrowRight size={20} />}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="login-header">
                    <button 
                      type="button" 
                      className="signup-back-link" 
                      onClick={() => setSignUpType('select')}
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <h1>Custom Enterprise</h1>
                    <p className="header-brand-text">DEDICATED INSTANCE</p>
                    <p className="header-subtitle">Deploy a custom portal with a personalized domain mapping</p>
                  </div>

                  <div className="custom-domain-info-card">
                    <Globe size={36} className="custom-info-icon" />
                    <p>
                      Custom domain structures (e.g. <strong>crm.mycompany.com</strong>) are provisioned manually by our cloud infrastructure team.
                    </p>
                    <p style={{ marginTop: '8px', fontSize: '0.8125rem', opacity: 0.8 }}>
                      Please request a custom domain setup by submitting a request on our Book Demo page. An engineer will follow up with you.
                    </p>
                  </div>

                  <button 
                    type="button" 
                    className="login-submit-btn" 
                    onClick={() => navigate('/book-demo')}
                    style={{ marginTop: '12px' }}
                  >
                    Go to Book Demo
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
            </>
          )}

          <div className="login-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <p className="login-footer">
              {view === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => {
                      setView('signup');
                      setSignUpType('select');
                      setSignUpError('');
                      setSignUpSuccess('');
                    }}
                    className="forgot-link"
                    style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    Sign Up
                  </button>
                </>
              ) : view === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => {
                      setView('login');
                      setError('');
                    }}
                    className="forgot-link"
                    style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                  >
                    Login
                  </button>
                </>
              ) : (
                <button 
                  type="button" 
                  onClick={() => {
                    setView('login');
                    setError('');
                  }}
                  className="forgot-link"
                  style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                >
                  Back to Login
                </button>
              )}
            </p>
            <button 
              type="button" 
              className="theme-toggle-btn-login"
              onClick={toggleDarkMode}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

        </motion.div>

        {/* Feature container and footer buttons directly below the login card */}
        <motion.div 
          className="login-bottom-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="glass-features-container">
            <div className="glass-feature-card">
              <div className="gf-icon"><BarChart3 size={18} /></div>
              <div className="gf-content">
                <h4>Advanced Analytics</h4>
                <p>Data insights</p>
              </div>
            </div>
            <div className="glass-feature-card">
              <div className="gf-icon"><Users size={18} /></div>
              <div className="gf-content">
                <h4>Lead Management</h4>
                <p>Sales funnel</p>
              </div>
            </div>
            <div className="glass-feature-card">
              <div className="gf-icon"><Layout size={18} /></div>
              <div className="gf-content">
                <h4>Project Management</h4>
                <p>Task tracking</p>
              </div>
            </div>
            <div className="glass-feature-card">
              <div className="gf-icon"><Zap size={18} /></div>
              <div className="gf-content">
                <h4>Team Performance</h4>
                <p>Live activity</p>
              </div>
            </div>
          </div>

          <button className="back-btn-web" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Back to Homepage
          </button>

          <div className="login-features">
            <div className="l-feat"><CheckCircle2 size={16} /> Advanced Encryption</div>
            <div className="l-feat"><CheckCircle2 size={16} /> Role-Based Control</div>
            <div className="l-feat"><CheckCircle2 size={16} /> Session Monitoring</div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default LoginPage;
