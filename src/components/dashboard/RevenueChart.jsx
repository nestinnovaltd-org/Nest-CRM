import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import './DashboardComponents.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="premium-chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">
          <span className="dot" style={{ backgroundColor: 'var(--primary)' }}></span>
          Revenue: ৳{payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const RevenueChart = ({ data = [] }) => {
  const [filter, setFilter] = useState('7d');

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>Revenue Trend</h3>
          <p className="chart-subtitle">Performance analysis over time</p>
        </div>
        <div className="chart-filters">
          <button 
            className={`filter-btn ${filter === '7d' ? 'active' : ''}`}
            onClick={() => setFilter('7d')}
          >
            7 Days
          </button>
          <button 
            className={`filter-btn ${filter === '30d' ? 'active' : ''}`}
            onClick={() => setFilter('30d')}
          >
            30 Days
          </button>
          <button 
            className={`filter-btn ${filter === 'month' ? 'active' : ''}`}
            onClick={() => setFilter('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: 300, position: 'relative' }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#26E264" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#26E264"/>
                <stop offset="100%" stopColor="#00F0FF"/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.03)" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(value) => `৳${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="url(#strokeGradient)" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorRevenue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
