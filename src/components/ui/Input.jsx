import React from 'react';
import './Input.css';
import { twMerge } from 'tailwind-merge';

const Input = ({ 
  label, 
  error, 
  icon: Icon, 
  className, 
  id, 
  ...props 
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className={twMerge('input-group', className)}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <div className="input-wrapper">
        {Icon && <Icon className="input-icon" size={18} />}
        <input 
          id={inputId}
          className={twMerge(
            'input-field', 
            Icon && 'has-icon',
            error && 'has-error'
          )} 
          {...props} 
        />
      </div>
      {error && <p className="input-error-msg">{error}</p>}
    </div>
  );
};

export default Input;
