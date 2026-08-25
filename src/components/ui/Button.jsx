import React from 'react';
import './Button.css';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  isLoading, 
  icon: Icon, 
  ...props 
}) => {
  const classes = twMerge(
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    isLoading && 'btn-loading',
    className
  );

  return (
    <button className={classes} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <span className="loader"></span>
      ) : (
        <>
          {Icon && <Icon size={18} className="btn-icon" />}
          {children && <span className="btn-text">{children}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
