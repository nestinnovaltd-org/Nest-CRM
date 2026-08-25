import React from 'react';
import { User, Clock, ChevronRight } from 'lucide-react';
import './DashboardComponents.css';

const ActivityFeed = ({ activities = [] }) => {
  if (activities.length === 0) {
    return (
      <div className="empty-feed">
        <Clock size={40} className="text-muted mb-2" />
        <p>No recent activity found</p>
      </div>
    );
  }

  return (
    <div className="activity-timeline">
      {activities.map((activity, index) => (
        <div key={activity.id || index} className="activity-item">
          <div className="activity-dot"></div>
          <div className="activity-content">
            <div className="activity-header">
              <span className="activity-user">{activity.userName}</span>
              <span className="activity-time">{activity.time}</span>
            </div>
            <p className="activity-desc">
              {activity.action} <strong>{activity.target}</strong>
            </p>
          </div>
        </div>
      ))}
      <button className="view-all-btn">
        <span>View All Activity</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
};

export default ActivityFeed;
