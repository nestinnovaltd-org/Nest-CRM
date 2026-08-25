import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalItems, 
  itemsPerPage,
  showInfo = true 
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      if (end === totalPages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  return (
    <div className="pagination-container">
      {showInfo && (
        <div className="pagination-info">
          Showing <span>{startItem}</span> to <span>{endItem}</span> of <span>{totalItems}</span> entries
        </div>
      )}
      
      <div className="pagination-controls">
        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(1)} 
          disabled={currentPage === 1}
          title="First Page"
        >
          <ChevronsLeft size={16} />
        </button>
        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="pagination-pages">
          {getPageNumbers().map(page => (
            <button
              key={page}
              className={`pagination-page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
        </div>

        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(totalPages)} 
          disabled={currentPage === totalPages}
          title="Last Page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
