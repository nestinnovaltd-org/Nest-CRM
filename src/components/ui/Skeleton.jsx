import React from 'react';
import './Skeleton.css';
import { twMerge } from 'tailwind-merge';

const Skeleton = ({ className, width, height, circle }) => {
  return (
    <div 
      className={twMerge('skeleton-box', className)} 
      style={{ 
        width: width || '100%', 
        height: height || '1rem',
        borderRadius: circle ? '50%' : 'var(--radius-sm)'
      }}
    />
  );
};

export default Skeleton;
