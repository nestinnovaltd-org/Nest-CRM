import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Clock, 
  MapPin 
} from 'lucide-react';
import './BottomNavbar.css';

const BottomNavbar = () => {
  const navItems = [
    { icon: Users, label: 'My Leads', path: '/leads/mine' },
    { icon: Clock, label: 'Follow-Ups', path: '/leads/follow-ups' },
    { icon: MapPin, label: 'Visits', path: '/leads/visits' },
    { icon: CalendarDays, label: 'Calendar', path: '/calendar/view' },
  ];

  return (
    <nav className="bottom-navbar">
      {navItems.map((item) => (
        <NavLink 
          key={item.path} 
          to={item.path} 
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="nav-item-content">
            <item.icon size={20} className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </div>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNavbar;
