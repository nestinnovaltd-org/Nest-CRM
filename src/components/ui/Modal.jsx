import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, className }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="modal-wrapper">
            <motion.div 
              className={`modal-container ${className || ''}`}
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ 
                type: 'spring', 
                damping: 30, 
                stiffness: 300,
                mass: 0.8
              }}
            >
              <div className="modal-header">
                <h3>{title}</h3>
                <button className="close-btn" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-content">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Modal;
