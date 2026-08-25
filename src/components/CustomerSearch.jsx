import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, X, Phone, Mail, Building2, User, Briefcase, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CustomerSearch.css';

const highlightText = (text, term) => {
  if (!term || !text) return text;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="cs-highlight">{part}</mark> : part
  );
};

const STATUS_COLORS = {
  'Fresh Lead': '#6366f1',
  'Follow Up': '#0ea5e9',
  'Under Negotiation': '#f59e0b',
  'Deal Confirmed': '#10b981',
  'Not Responding': '#ef4444',
  'Not Interested': '#64748b',
  'Junk Lead': '#78716c',
};

const CustomerSearch = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query2, setQuery2] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery2('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const performSearch = useCallback(async (term) => {
    if (!term.trim() || term.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const leadsRef = collection(db, 'leads');
      const snapshot = await getDocs(leadsRef);

      const termLower = term.toLowerCase().trim();
      const matched = [];

      snapshot.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };

        // Only show leads owned by or assigned to the current user
        const isOwner = d.ownerId === user?.uid;
        const isAssigned = d.assignedTo === user?.uid;
        if (!isOwner && !isAssigned) return;

        const fields = [
          d.name, d.designation, d.company,
          d.organization, d.phone, d.email, d.area, d.location
        ].map(f => (f || '').toLowerCase());

        if (fields.some(f => f.includes(termLower))) {
          matched.push(d);
        }
      });

      // Sort: exact name matches first
      matched.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aExact = aName.startsWith(termLower) ? 0 : 1;
        const bExact = bName.startsWith(termLower) ? 0 : 1;
        return aExact - bExact;
      });

      setResults(matched.slice(0, 50));
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery2(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 350);
  };

  const handleResultClick = (lead) => {
    onClose();
    navigate(`/leads/${lead.id}`);
  };

  if (!isOpen) return null;

  return (
    <div className="cs-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cs-modal">
        {/* Search Input */}
        <div className="cs-search-bar">
          <Search className="cs-search-icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="cs-input"
            placeholder="Search by name, designation, company, phone, email…"
            value={query2}
            onChange={handleInput}
            autoComplete="off"
          />
          {query2 && (
            <button className="cs-clear-btn" onClick={() => { setQuery2(''); setResults([]); setHasSearched(false); inputRef.current?.focus(); }}>
              <X size={16} />
            </button>
          )}
          <button className="cs-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Results Area */}
        <div className="cs-results-area">
          {isSearching && (
            <div className="cs-state-center">
              <div className="cs-spinner" />
              <span>Searching records…</span>
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="cs-state-center">
              <Search size={40} className="cs-empty-icon" />
              <p className="cs-empty-title">No records found</p>
              <p className="cs-empty-sub">Try a different name, number, or email</p>
            </div>
          )}

          {!isSearching && !hasSearched && (
            <div className="cs-state-center">
              <Search size={40} className="cs-empty-icon" />
              <p className="cs-empty-title">Search Customer Records</p>
              <p className="cs-empty-sub">Name · Designation · Company · Phone · Email</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <>
              <div className="cs-results-meta">
                {results.length} record{results.length !== 1 ? 's' : ''} found
              </div>
              <ul className="cs-results-list">
                {results.map(lead => {
                  const statusColor = STATUS_COLORS[lead.status] || '#6366f1';
                  const initials = (lead.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <li key={lead.id} className="cs-result-item" onClick={() => handleResultClick(lead)}>
                      <div className="cs-avatar" style={{ background: `${statusColor}22`, color: statusColor }}>
                        {lead.profilePic || lead.avatar
                          ? <img src={lead.profilePic || lead.avatar} alt="" />
                          : initials
                        }
                      </div>
                      <div className="cs-result-body">
                        <div className="cs-result-name">{highlightText(lead.name, query2)}</div>
                        <div className="cs-result-meta">
                          {lead.designation && (
                            <span className="cs-meta-chip"><Briefcase size={11} />{highlightText(lead.designation, query2)}</span>
                          )}
                          {lead.company && (
                            <span className="cs-meta-chip"><Building2 size={11} />{highlightText(lead.company, query2)}</span>
                          )}
                          {lead.phone && (
                            <span className="cs-meta-chip"><Phone size={11} />{highlightText(lead.phone, query2)}</span>
                          )}
                          {lead.email && (
                            <span className="cs-meta-chip"><Mail size={11} />{highlightText(lead.email, query2)}</span>
                          )}
                        </div>
                      </div>
                      <div className="cs-result-right">
                        <span className="cs-status-badge" style={{ background: `${statusColor}20`, color: statusColor, borderColor: `${statusColor}40` }}>
                          {lead.status || 'Fresh Lead'}
                        </span>
                        <ChevronRight size={16} className="cs-chevron" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSearch;
