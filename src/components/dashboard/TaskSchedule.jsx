import React from 'react';
import { Check, Phone, MessageCircle, MapPin, Clock } from 'lucide-react';
import './DashboardComponents.css';

const TaskSchedule = ({ tasks = [] }) => {
  if (tasks.length === 0) {
    return (
      <div className="empty-tasks">
        <div className="empty-tasks-icon">🎉</div>
        <h3>All caught up!</h3>
        <p>No tasks or visits scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <div key={task.id} className="task-item">
          <div className={`task-checkbox ${task.completed ? 'checked' : ''}`}>
            {task.completed && <Check size={12} />}
          </div>
          <div className="task-info">
            <h4 className="task-title">{task.name}</h4>
            <div className="task-meta">
              <span className="task-time">
                <Clock size={12} />
                {task.time}
              </span>
              {task.type === 'visit' && (
                <span className="task-location">
                  <MapPin size={12} />
                  {task.location}
                </span>
              )}
            </div>
          </div>
          <div className="task-actions">
            <a href={`https://wa.me/${task.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" className="task-action-btn whatsapp">
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </a>
            <a href={`tel:${task.phone?.replace(/[^\d+]/g, '')}`} className="task-action-btn call">
              <Phone size={14} />
              <span>Call</span>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskSchedule;
