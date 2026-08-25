import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';
import { 
  Bell, 
  Mail, 
  Clock, 
  Smartphone, 
  Settings2, 
  Check, 
  AlertTriangle,
  Calendar,
  MessageSquare,
  ArrowRight,
  Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { sendEmail } from '../lib/emailService';
import './Alerts.css';

const AlertsPage = () => {
  const { user } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [followUpAlerts, setFollowUpAlerts] = useState({
    inApp: true,
    browser: true,
    desktop: false,
    timing: ['10_min', '1_hour'],
    autoRescheduleReminders: true
  });

  const [mailAlerts, setMailAlerts] = useState({
    dailyDigest: true,
    immediateDeals: true,
    weeklyReport: false,
    leadAssigned: true,
    followUpMissed: true,
    followUpEmails: true,
    siteVisitEmails: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const { data: userDoc } = await supabase.from('users').select('notification_settings').eq('id', user.uid).maybeSingle();
        if (userDoc?.notification_settings) {
          const settings = userDoc.notification_settings;
          if (settings.followUpAlerts) setFollowUpAlerts(settings.followUpAlerts);
          if (settings.mailAlerts) setMailAlerts(settings.mailAlerts);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleChange = () => setHasChanges(true);

  const handleSave = async () => {
    if (!user || isSaving) return;
    try {
      setIsSaving(true);
      await supabase.from('users').update({
        notification_settings: {
          followUpAlerts,
          mailAlerts,
          updatedAt: new Date().toISOString()
        }
      }).eq('id', user.uid);
      setHasChanges(false);
      toast.success('Configurations saved successfully!');
    } catch (error) {
      console.error('Error saving configurations:', error);
      toast.error('Failed to save configurations.');
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestNotification = async () => {
    if (!user || isSendingTest) return;
    try {
      setIsSendingTest(true);
      await supabase.from('notifications').insert({
        user_id: user.uid,
        title: 'Test Notification',
        description: 'This is a test notification to verify the functional system.',
        type: 'info',
        is_read: false,
        created_at: new Date().toISOString(),
        link: '/notifications/alerts'
      });
      toast.success('Test notification sent! Check your header bell icon.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const sendTestEmail = async () => {
    if (!user || isSendingTestEmail) return;

    // Check if EmailJS is configured
    if (!import.meta.env.VITE_EMAILJS_PUBLIC_KEY) {
      toast.error('EmailJS is not configured yet. Please check the setup guide.');
      return;
    }

    try {
      setIsSendingTestEmail(true);
      
      const result = await sendEmail({
        to_email: user.email,
        to_name: user.fullName || user.name || 'User',
        from_name: 'Real Estate CRM',
        subject: 'Test Email Alert - Real Estate CRM',
        message: 'This is a test email from your Real Estate CRM. Your EmailJS configuration is working correctly!'
      });

      if (result.success) {
        toast.success('Test email sent! Check your inbox.');
      } else {
        toast.error(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error('Failed to trigger test email.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="alerts-page-container">
        
        {/* Header */}
        <div className="alerts-header">
          <div>
            <h1>Notification & Alerts Setup</h1>
            <p>Configure how and when you want to be notified about lead activities.</p>
          </div>
          <Button 
            variant="primary" 
            icon={Save} 
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            isLoading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Configurations'}
          </Button>
        </div>

        <div className="alerts-grid">
          
          {/* Section 1: Follow-Up Alerts */}
          <div className="alerts-card">
            <div className="card-header-v5">
              <div className="header-icon blue"><Clock size={20} className="icon-history" /></div>
              <h3>Follow-Up Alerts</h3>
            </div>
            <div className="card-body-v5">
              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">In-App Notifications</span>
                  <p className="setting-desc">Show pop-up alerts inside the CRM dashboard.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={followUpAlerts.inApp} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>

              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Browser Push Notifications</span>
                  <p className="setting-desc">Get notified even when you're on another tab.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={followUpAlerts.browser} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>

              <div className="timing-setup">
                <label className="sub-label-v5">Alert Timing (Before Event)</label>
                <div className="timing-chips">
                  {['5 Minutes', '10 Minutes', '30 Minutes', '1 Hour', '1 Day'].map(time => (
                    <div 
                      key={time} 
                      className={`time-chip ${followUpAlerts.timing.includes(time.replace(' ', '_').toLowerCase()) ? 'active' : ''}`}
                      onClick={handleChange}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Email Notifications */}
          <div className="alerts-card">
            <div className="card-header-v5">
              <div className="header-icon purple"><Mail size={20} className="icon-email" /></div>
              <h3>Email Alerts</h3>
            </div>
            <div className="card-body-v5">
              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Follow-up Email Alerts</span>
                  <p className="setting-desc">Receive email reminders for your scheduled follow-ups.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.followUpEmails} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>

              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Site Visit & Appointment Alerts</span>
                  <p className="setting-desc">Get email notifications for site visits and client meetings.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.siteVisitEmails} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>

              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Lead Assignment Alerts</span>
                  <p className="setting-desc">Get an email as soon as a new lead is assigned to you.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.leadAssigned} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>

              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Daily Performance Digest</span>
                  <p className="setting-desc">A summary of your leads and tasks every morning.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.dailyDigest} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: System & Security */}
          <div className="alerts-card full-width">
            <div className="card-header-v5">
              <div className="header-icon blue"><Settings2 size={20} className="icon-building" /></div>
              <h3>System Event Alerts</h3>
            </div>
            <div className="card-body-v5 horizontal-grid">
              <div className="alert-setting-item">
                <div className="setting-info">
                  <span className="setting-title">Missed Follow-up Warning</span>
                  <p className="setting-desc">Alert your manager if a follow-up is missed for 24h.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.followUpMissed} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>
              <div className="alert-setting-item border-left">
                <div className="setting-info">
                  <span className="setting-title">Weekly Team Analytics</span>
                  <p className="setting-desc">Send weekly performance PDF to your inbox.</p>
                </div>
                <label className="switch-v5">
                  <input type="checkbox" checked={mailAlerts.weeklyReport} onChange={handleChange} />
                  <span className="slider-v5"></span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* Action History / Preview */}
        <div className="alert-preview-banner">
          <div className="banner-content">
            <div className="info-icon"><Bell size={24} className="icon-alert" /></div>
            <div>
              <h4>Real-time Notifications are Active</h4>
              <p>You will receive approximately <strong>4-6 alerts per day</strong> based on your current settings.</p>
            </div>
          </div>
          <div className="banner-actions-v5">
            <button 
              className="test-alert-btn secondary" 
              onClick={sendTestNotification}
              disabled={isSendingTest}
            >
              {isSendingTest ? 'Sending...' : 'Test In-App Alert'}
            </button>
            <button 
              className="test-alert-btn" 
              onClick={sendTestEmail}
              disabled={isSendingTestEmail}
            >
              {isSendingTestEmail ? 'Triggering...' : 'Send Test Email'}
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default AlertsPage;
