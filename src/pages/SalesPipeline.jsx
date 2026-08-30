import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import { 
  MoreHorizontal, 
  Plus, 
  User, 
  Phone, 
  Clock, 
  Search, 
  Filter,
  ChevronRight,
  GripVertical,
  MapPin,
  CheckCircle2,
  GitMerge,
  ShieldCheck
} from 'lucide-react';
import './SalesPipeline.css';

const SalesPipeline = () => {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState(null);

  const COLUMNS = [
    { id: 'Fresh Lead', title: 'Fresh Lead', color: '#3b82f6', icon: <Plus size={16} className="icon-plus" /> },
    { id: 'Under Follow Up', title: 'Follow Up', color: '#6366f1', icon: <Phone size={16} className="icon-call" /> },
    { id: 'Next Follow Up', title: 'Next Follow Up', color: '#8b5cf6', icon: <Clock size={16} className="icon-clock" /> },
    { id: 'Confirm Visit', title: 'Confirm Visit', color: '#f59e0b', icon: <MapPin size={16} className="icon-location" /> },
    { id: 'Visited', title: 'Visited', color: '#10b981', icon: <CheckCircle2 size={16} className="icon-check" /> },
    { id: 'Negotiation', title: 'Negotiation', color: '#ec4899', icon: <GitMerge size={16} className="icon-project" /> },
    { id: 'Deal Confirmed', title: 'Deal Confirmed', color: '#059669', icon: <ShieldCheck size={16} className="icon-shield" /> }
  ];

  const getSubordinateUids = (allUsers, currentUserId) => {
    const user = allUsers.find(u => u.id === currentUserId || u.uid === currentUserId);
    if (!user) return [currentUserId];
    
    const currentName = user.fullName || user.name;
    let subUids = [currentUserId];
    
    const directSubs = allUsers.filter(u => u.reportsTo === currentName && u.id !== currentUserId);
    
    for (const sub of directSubs) {
      const descendants = getSubordinateUids(allUsers, sub.id);
      subUids = [...subUids, ...descendants];
    }
    
    return Array.from(new Set(subUids));
  };

  useEffect(() => {
    if (!currentUser) return;

    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'MD' || currentUser.role === 'System Admin';

    const fetchData = async () => {
      const { data: allUsers } = await supabase.from('users').select('*');
      const users = allUsers || [];

      let query = supabase.from('leads').select('*');
      if (!isAdmin) {
        const allowedUids = getSubordinateUids(users, currentUser.uid);
        if (allowedUids.length > 0) {
          query = query.in('assigned_to', allowedUids);
        }
      }
      const { data: leadsData } = await query;
      const mappedLeads = (leadsData || []).map(row => ({
        ...row,
        assignedToName: row.assigned_to_name
      }));
      setLeads(mappedLeads);
      setIsLoading(false);
    };

    fetchData();

    const leadsChannel = supabase.channel('pipeline-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(leadsChannel);
  }, [currentUser]);

  const onDragStart = (e, id) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData('leadId', id);
  };

  const onDrop = async (e, targetStatus) => {
    const leadId = e.dataTransfer.getData('leadId');
    // Implement update in Firestore if needed, for now just local update for UX
    // In a real app, updateDoc(doc(db, 'leads', leadId), { status: targetStatus })
    setDraggedLeadId(null);
  };

  const filteredLeads = leads.filter(l => 
    (l.fullName || l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.phone || '').includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="pipeline-container">
        <div className="pipeline-header">
          <div className="header-info">
            <h1>Sales Pipeline</h1>
            <p>Track leads across the sales funnel.</p>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} className="icon-search" />
              <input 
                type="text" 
                placeholder="Search leads..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-filter">
              <Filter size={18} />
              <span>Filter</span>
            </button>
          </div>
        </div>

        <div className="kanban-board">
          {COLUMNS.map(column => (
            <div 
              key={column.id} 
              className={`kanban-column ${draggedLeadId ? 'drop-target' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, column.id)}
            >
              <div className="column-header" style={{ borderTopColor: column.color }}>
                <div className="column-title-box">
                  <div className="title-icon-wrapper" style={{ color: column.color }}>
                    {column.icon}
                  </div>
                  <h3>{column.title}</h3>
                  <span className="count">{filteredLeads.filter(l => l.status === column.id).length}</span>
                </div>
              </div>

              <div className="column-body">
                <AnimatePresence mode="popLayout">
                  {filteredLeads
                    .filter(lead => lead.status === column.id)
                    .map(lead => (
                      <motion.div
                        layout
                        key={lead.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, lead.id)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="kanban-card"
                      >
                        <div className="card-top">
                          <GripVertical className="drag-handle" size={14} />
                          <span className="lead-id">#{lead.id.slice(-4)}</span>
                        </div>
                        
                        <div className="card-content">
                          <h4 className="lead-name">{lead.fullName || lead.name}</h4>
                          <div className="info-row">
                            <Phone size={12} />
                            <span>{lead.phone}</span>
                          </div>
                        </div>

                        <div className="card-footer">
                          <div className="assigned-user">
                            <div className="user-avatar">
                              {(lead.assignedToName || 'U')[0]}
                            </div>
                            <span>{lead.assignedToName || 'Assigned'}</span>
                          </div>
                          <ChevronRight size={16} className="arrow-icon" />
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SalesPipeline;
