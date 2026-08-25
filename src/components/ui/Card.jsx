import React from 'react';
import './Card.css';
import { twMerge } from 'tailwind-merge';

const Card = ({ 
  children, 
  title, 
  subtitle, 
  className, 
  variant = 'default',
  headerAction,
  footer,
  ...props 
}) => {
  return (
    <div className={twMerge('card', `card-${variant}`, className)} {...props}>
      {(title || subtitle || headerAction) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div className="card-header-action">{headerAction}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
