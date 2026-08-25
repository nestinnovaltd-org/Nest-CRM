import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Moon
} from 'lucide-react';
import { motion } from 'framer-motion';
import useThemeStore from '../store/useThemeStore';
import './LoginPage.css';

const logo = '/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot Password states
  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

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
          ) : (
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
          )}

          <div className="login-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <p className="login-footer">
              Don't have an account? <a href="#">Contact Admin</a>
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
