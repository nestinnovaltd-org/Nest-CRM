import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react';
import { motion } from 'framer-motion';
import useThemeStore from '../store/useThemeStore';
import './ResetPasswordPage.css';

const logo = '/Nest%20CRM%20Logo%20without%20background.png';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email') || '';
  const navigate = useNavigate();


  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(5);

  const { isDarkMode, toggleDarkMode } = useThemeStore();

  // Sync theme attribute with document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Handle countdown and redirect on success
  useEffect(() => {
    if (!success) return;
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [success, navigate]);

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, email: emailFromUrl, newPassword: password }),

      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Password has been reset successfully!');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
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
        
        {/* Main Frosted-Glass Card in the Center */}
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-header">
            <img src={logo} alt="Logo" className="login-header-logo" />
            <h1>Reset Password</h1>
            <p className="header-brand-text">REAL ESTATE CRM</p>
            <p className="header-subtitle">
              {!token 
                ? 'Invalid access link' 
                : success 
                  ? `Redirecting to login in ${countdown}s...` 
                  : 'Enter your new password below'
              }
            </p>
          </div>

          {error && (
            <div className="login-error-msg">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="login-success-msg">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {!token ? (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <p className="header-subtitle" style={{ marginBottom: '20px', color: 'rgba(255,255,255,0.7)' }}>
                This link is invalid or has expired. Please go back to the login page and request a new password reset link.
              </p>
              <button 
                onClick={() => navigate('/login')} 
                className="login-submit-btn" 
                style={{ width: '100%' }}
              >
                <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Go to Login
              </button>
            </div>
          ) : success ? (
            <button 
              onClick={() => navigate('/login')} 
              className="login-submit-btn" 
              style={{ width: '100%' }}
            >
              Go to Login Now <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          ) : (
            <form className="login-form" onSubmit={handleResetPassword}>
              <div className="form-group-v2">
                <label>New Password</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    disabled={loading}
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

              <div className="form-group-v2">
                <label>Confirm Password</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required 
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? "Resetting..." : "Update Password"}
                {!loading && <ArrowRight size={20} />}
              </button>

              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => navigate('/login')} 
                  className="forgot-link"
                  style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0 }}
                >
                  Cancel and Back to Login
                </button>
              </div>
            </form>
          )}

          <div className="login-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <p className="login-footer">
              Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Contact Admin</a>
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

        {/* Feature container and footer buttons directly below the card */}
        <motion.div 
          className="login-bottom-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
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

export default ResetPasswordPage;
