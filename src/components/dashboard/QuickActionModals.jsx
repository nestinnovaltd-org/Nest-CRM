import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, MapPin, Calendar, CreditCard, MessageSquare } from 'lucide-react';

export const QuickLeadModal = ({ isOpen, onClose }) => {
  const { user, currentTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    projectName: '',
    source: 'Quick Add'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isSA = user?.account_type === 'super_admin';
      const resolvedOrgId = (isSA && currentTenant?.type === 'org')
        ? currentTenant?.id
        : (user?.org_id || null);

      const resolvedOwnerId = (isSA && currentTenant?.type === 'individual')
        ? currentTenant?.id
        : (user?.uid || user?.id);

      await supabase.from('leads').insert({
        name: formData.fullName,
        phone: formData.phone,
        company: formData.projectName,
        status: 'Fresh Lead',
        priority: 'Medium',
        source: formData.source || 'Quick Add',
        assigned_to: resolvedOwnerId,
        assigned_to_name: user?.full_name || user?.fullName || user?.name || 'Admin',
        owner_id: resolvedOwnerId,
        owner_name: user?.full_name || user?.fullName || user?.name || 'Admin',
        org_id: resolvedOrgId,
        created_by: user?.name || user?.full_name || user?.fullName || 'Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      console.error('Error adding lead:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add Lead">
      <form onSubmit={handleSubmit} className="quick-form">
        <div className="form-group">
          <label>Full Name</label>
          <div className="input-with-icon">
            <User size={18} />
            <input 
              type="text" 
              required 
              placeholder="Enter client name"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Phone Number</label>
          <div className="input-with-icon">
            <Phone size={18} />
            <input 
              type="tel" 
              required 
              placeholder="017xxxxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Project Interest</label>
          <div className="input-with-icon">
            <MapPin size={18} />
            <input 
              type="text" 
              placeholder="Project Name"
              value={formData.projectName}
              onChange={(e) => setFormData({...formData, projectName: e.target.value})}
            />
          </div>
        </div>
        <div className="modal-footer mt-4">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" isLoading={loading}>Create Lead</Button>
        </div>
      </form>
    </Modal>
  );
};

export const QuickVisitModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  // Simplified for demo - in real app, would select from existing leads
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Site Visit">
      <div className="quick-form">
        <p className="form-helper">Schedule a new property viewing for a client.</p>
        <div className="form-group">
          <label>Select Lead</label>
          <select className="custom-select-full">
            <option>Search for a lead...</option>
          </select>
        </div>
        <div className="grid-2-col-gap">
          <div className="form-group">
            <label>Date</label>
            <input type="date" className="custom-date-input" />
          </div>
          <div className="form-group">
            <label>Time</label>
            <input type="time" className="custom-date-input" />
          </div>
        </div>
        <div className="modal-footer mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onClose}>Schedule Visit</Button>
        </div>
      </div>
    </Modal>
  );
};
