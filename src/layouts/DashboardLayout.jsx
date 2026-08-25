import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { 
  Menu, 
  X, 
  Bell, 
  User, 
  Search, 
  Moon, 
  Sun, 
  Check, 
  MessageSquare, 
  Clock,
  CreditCard
} from 'lucide-react';
import useThemeStore from '../store/useThemeStore';
import BottomNavbar from '../components/BottomNavbar';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  writeBatch,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { sendVisitReminderEmail } from '../lib/emailService';
import './DashboardLayout.css';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  const [liveNotifications, setLiveNotifications] = useState([]);
  const unreadCount = liveNotifications.filter(n => !n.isRead).length;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLiveNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  // Background check for upcoming site visit reminders (1 day before)
  useEffect(() => {
    if (!user) return;

    const checkVisitReminders = async () => {
      try {
        // Calculate tomorrow's date string (YYYY-MM-DD)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // Query leads assigned to this user with a visit scheduled for tomorrow
        const leadsRef = collection(db, 'leads');
        const q = query(
          leadsRef,
          where('assignedTo', '==', user.uid),
          where('visitDate', '==', tomorrowStr)
        );

        const querySnapshot = await getDocs(q);
        
        for (const docSnap of querySnapshot.docs) {
          const leadData = docSnap.data();
          const leadId = docSnap.id;

          // Check if reminder was already sent for this visit date
          if (leadData.visitReminderSentDate === tomorrowStr) {
            continue;
          }

          // Fetch the latest follow-up note from the lead's history
          let lastFollowUp = 'No previous follow-up notes.';
          if (leadData.history && leadData.history.length > 0) {
            lastFollowUp = leadData.history[leadData.history.length - 1].note;
          }

          console.log(`Sending upcoming visit reminder email to ${user.email} for client ${leadData.name || leadData.fullName}`);

          const response = await sendVisitReminderEmail(
            user.email,
            user.fullName || user.name || 'Team Member',
            leadData.fullName || leadData.name || 'Client',
            leadData.phone || '',
            leadData.email || '',
            lastFollowUp,
            leadData.visitDate,
            leadData.visitTime || '10:00 AM',
            leadData.visitLocation || 'Not Specified',
            leadData.visitNote || 'No specific notes',
            leadData.designation || '',
            leadData.company || ''
          );

          if (response.success) {
            // Update Firestore so we don't send reminder again for this visit date
            await updateDoc(doc(db, 'leads', leadId), {
              visitReminderSentDate: tomorrowStr
            });
          }
        }
      } catch (error) {
        console.error("Error checking visit reminders:", error);
      }
    };

    // Run check once on login/mount, and then every 4 hours if the app stays open
    checkVisitReminders();
    const interval = setInterval(checkVisitReminders, 4 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      liveNotifications.forEach(n => {
        if (!n.isRead) {
          batch.update(doc(db, 'notifications', n.id), { isRead: true });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return (
    <div className={`dashboard-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <div className="dashboard-bg">
        {isDarkMode && (
          <img 
            src="/app-background-image.png?v=1.0.1" 
            alt="Background" 
            className="dashboard-bg-image" 
          />
        )}
        <div className="dashboard-overlay"></div>
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="main-content">
        <header className={`top-bar ${isScrolled ? 'scrolled' : ''}`}>
          <div className="top-bar-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="header-search-container">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Global Search (Leads, Projects, Users...)" className="header-search-input" />
              <span className="search-shortcut">⌘K</span>
            </div>
          </div>
          
          <div className="top-bar-right">
            <button className="theme-toggle-btn" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="notification-wrapper">
              <button 
                className={`icon-btn ${notificationsOpen ? 'active' : ''}`}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell size={20} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <div className="notifications-panel">
                  <div className="panel-header">
                    <h3>Notifications</h3>
                    <button className="mark-read" onClick={markAllAsRead}>Mark all as read</button>
                  </div>
                  <div className="notifications-list custom-scrollbar">
                    {liveNotifications.length === 0 ? (
                      <div className="no-notifications">
                        <Bell size={40} className="empty-icon" />
                        <p>No notifications yet</p>
                      </div>
                    ) : (
                      liveNotifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div className={`notification-icon-v2 ${n.type || 'info'}`}>
                            {n.type === 'lead' ? <User size={14} /> : n.type === 'reminder' ? <Clock size={14} /> : n.type === 'payment' ? <CreditCard size={14} /> : <Check size={14} />}
                          </div>
                          <div className="notification-content">
                            <p className="notif-title">{n.title}</p>
                            <p className="notif-desc">{n.description || n.desc}</p>
                            <span className="notif-time">{formatTimeAgo(n.createdAt)}</span>
                          </div>
                          {!n.isRead && <div className="unread-dot"></div>}
                        </div>
                      ))
                    )}
                  </div>
                  <button className="view-all-notif" onClick={() => navigate('/notifications/alerts')}>View All Notifications</button>
                </div>
              )}
            </div>

            <div className="profile-wrapper">
              <button 
                className={`header-user-profile ${profileOpen ? 'active' : ''}`}
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className="header-avatar-modern">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="User" />
                  ) : (
                    <div className="avatar-placeholder">{user?.name ? user.name[0] : 'U'}</div>
                  )}
                  <div className="avatar-status-dot"></div>
                </div>
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="dropdown-header">
                    <p className="user-email">{user?.email}</p>
                    <p className="user-role-badge">{user?.role || 'Team Member'}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link to="/settings/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                    <User size={16} />
                    <span>My Profile</span>
                  </Link>
                  <button className="dropdown-item logout" onClick={() => { logout(); setProfileOpen(false); }}>
                    <X size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        <main className="content-area">
          {children}
        </main>
      </div>

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="db-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#26E264" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>
        </defs>
      </svg>

      <BottomNavbar />
    </div>
  );
};

export default DashboardLayout;
