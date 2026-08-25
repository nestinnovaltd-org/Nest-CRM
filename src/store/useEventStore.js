import { create } from 'zustand';

const useEventStore = create((set) => ({
  events: [
    { 
      id: 1, 
      title: 'Alice Johnson', 
      type: 'Follow-up', 
      start: '2026-05-04T10:30:00', 
      end: '2026-05-04T11:30:00', 
      status: 'upcoming', 
      location: 'Office',
      notes: 'Initial discussion on villa.'
    },
    { 
      id: 2, 
      title: 'Robert Smith', 
      type: 'Property Visit', 
      start: '2026-05-05T14:00:00', 
      end: '2026-05-05T15:30:00', 
      status: 'upcoming',
      location: 'Site Block A',
      notes: 'Visit scheduled from follow-up.'
    }
  ],
  addEvent: (event) => set((state) => ({ 
    events: [...state.events, { ...event, id: Date.now() }] 
  })),
  updateEventStatus: (id, status) => set((state) => ({
    events: state.events.map(e => e.id === id ? { ...e, status } : e)
  })),
  deleteEvent: (id) => set((state) => ({
    events: state.events.filter(e => e.id !== id)
  }))
}));

export default useEventStore;
