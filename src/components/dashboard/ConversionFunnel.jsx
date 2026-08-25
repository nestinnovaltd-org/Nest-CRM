import React from 'react';
import './DashboardComponents.css';

const stages = [
  { id: 'fresh', label: 'Fresh', color: '#60EFFF', gradient: 'linear-gradient(to top, #00b0ff, #60EFFF)' },
  { id: 'followup', label: 'Follow-Up', color: '#a855f7', gradient: 'linear-gradient(to top, #7c3aed, #c084fc)' },
  { id: 'visit', label: 'Visit', color: '#3b82f6', gradient: 'linear-gradient(to top, #2563eb, #60a5fa)' },
  { id: 'negotiation', label: 'Negotiation', color: '#ec4899', gradient: 'linear-gradient(to top, #db2777, #f472b6)' },
  { id: 'closed', label: 'Closed', color: '#00FF87', gradient: 'linear-gradient(to top, #00E676, #00FF87)' }
];

const ConversionFunnel = ({ data = {} }) => {
  const maxVal = Math.max(...stages.map(s => data[s.id] || 0), 1);
  const totalSlots = 6; // Number of capsule blocks in the vertical stack

  return (
    <div className="capsule-analytics-container">
      <div className="capsule-grid">
        {stages.map((stage) => {
          const value = data[stage.id] || 0;
          // Calculate how many slots should be illuminated
          const activeSlotsCount = Math.min(totalSlots, Math.max(1, Math.round((value / maxVal) * totalSlots)));
          
          return (
            <div key={stage.id} className="capsule-column">
              <div className="capsule-stack">
                {Array.from({ length: totalSlots }).map((_, idx) => {
                  // Draw from top to bottom (so active slots fill from the bottom)
                  const slotIndex = totalSlots - 1 - idx;
                  const isActive = slotIndex < activeSlotsCount;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`capsule-slot ${isActive ? 'active' : ''}`}
                      style={isActive ? {
                        background: stage.gradient,
                        boxShadow: `0 0 12px ${stage.color}80`
                      } : {}}
                    />
                  );
                })}
              </div>
              <div className="capsule-footer">
                <span className="capsule-val">{value}</span>
                <span className="capsule-lbl">{stage.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversionFunnel;
