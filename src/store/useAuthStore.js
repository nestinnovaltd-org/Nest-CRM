import { create } from 'zustand';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const useAuthStore = create((set) => ({
  user: null,
  role: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  init: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // In a real app, fetch role from Firestore here
        // const userDoc = await getDoc(doc(db, 'users', user.uid));
        // const role = userDoc.data()?.role || 'team_member';
        
        set({ user, role: 'md', loading: false }); // Mocking MD role for now
      } else {
        set({ user: null, role: null, loading: false });
      }
    });
  },

  signOut: async () => {
    await auth.signOut();
    set({ user: null, role: null });
  }
}));

export default useAuthStore;
