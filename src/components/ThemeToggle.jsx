import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
      <div className={`icon-wrapper ${theme === 'dark' ? 'is-dark' : ''}`}>
        {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
      </div>
      <span className="toggle-label">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
      <div className={`toggle-track ${theme === 'dark' ? 'active' : ''}`}>
        <div className="toggle-thumb"></div>
      </div>
    </button>
  );
};

export default ThemeToggle;
