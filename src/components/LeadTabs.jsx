import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  UserCheck, 
  Users, 
  PlusCircle, 
  Clock, 
  Calendar, 
  UserX 
} from 'lucide-react';
import './LeadTabs.css';

const LeadTabs = () => {
  const tabs = [
    { label: 'My Leads', path: '/leads/mine', icon: UserCheck },
    { label: 'Follow Ups', path: '/leads/follow-ups', icon: Clock },
    { label: 'All Leads', path: '/leads/all', icon: Users },
    { label: 'Add New Leads', path: '/leads/add', icon: PlusCircle },
    { label: 'Visits', path: '/leads/visits', icon: Calendar },
    { label: 'Junk Leads', path: '/leads/junk', icon: UserX }
  ];

  return (
    <div className="lead-navigation-tabs-container">
      <div className="lead-navigation-tabs">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={idx}
              to={tab.path}
              className={({ isActive }) => `lead-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};

export default LeadTabs;
