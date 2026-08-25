import React from 'react';
import './AppLoader.css';

const AppLoader = () => {
  return (
    <div className="app-loader-overlay">
      <div className="app-loader-card">
        <div className="app-loader-inner">
          <p className="app-loader-label">loading</p>
          <div className="app-loader-words">
            <span className="app-loader-word">CONNECT</span>
            <span className="app-loader-word">NEGOTIATE</span>
            <span className="app-loader-word">WIN</span>
            <span className="app-loader-word">CONNECT</span>
            <span className="app-loader-word">NEGOTIATE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLoader;
