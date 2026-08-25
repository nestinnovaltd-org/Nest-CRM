import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData = {};
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            // Check if this is the target Admin user to auto-provision
            const adminUID = "Xx2tPCJro5akfg2HIHNCxXBvZXs1";
            if (firebaseUser.uid === adminUID) {
              userData = {
                fullName: "Mohammad Sajjad Khan",
                email: "nestinnovaltd@gmail.com",
                phone: "+8801972372395",
                username: "nest_innova",
                role: "Admin",
                permissions: ["All"],
                uid: adminUID,
                status: "Active",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              await setDoc(userDocRef, userData);
              console.log("✅ Admin profile auto-provisioned!");
            }
          }

          // Fetch role permissions (as default) or use user-level overrides
          if (userData.permissions && Object.keys(userData.permissions).length > 0) {
            userData.rolePermissions = userData.permissions;
          } else if (userData.role) {
            const roleId = userData.role.toLowerCase().replace(/\s+/g, '_');
            const roleDoc = await getDoc(doc(db, 'roles', roleId));
            if (roleDoc.exists()) {
              userData.rolePermissions = roleDoc.data().permissions;
            }
          }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: userData.fullName || userData.name || 'User',
            role: userData.role || 'Team Member',
            ...userData
          });

        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'Team Member'
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      console.error("Login Error:", error.code);
      let message = "Invalid credentials";
      if (error.code === 'auth/user-not-found') message = "User not found";
      if (error.code === 'auth/wrong-password') message = "Incorrect password";
      if (error.code === 'auth/invalid-email') message = "Invalid email address";
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Helper to check permissions
  const hasPermission = (module, action = 'read', subModule = null) => {
    if (!user) return false;
    
    // Always allow Admin
    if (user.role === 'Admin' || user.role === 'System Admin') return true;
    
    // Check dynamic permissions from DB
    if (user.rolePermissions && user.rolePermissions[module]) {
      const modulePerms = user.rolePermissions[module];
      
      // Map actions to CRUD
      const actionMap = {
        'view': 'read',
        'read': 'read',
        'add': 'create',
        'create': 'create',
        'edit': 'update',
        'update': 'update',
        'delete': 'delete'
      };
      
      const firestoreAction = actionMap[action] || action;
      
      // If a specific sub-module is provided, check it exactly
      if (subModule && modulePerms[subModule]) {
        return modulePerms[subModule][firestoreAction] === true;
      }
      
      // If no sub-module is provided, check if any sub-module in this module has the action permission
      // This is used for module-level visibility in the sidebar
      return Object.values(modulePerms).some(subPerm => subPerm[firestoreAction] === true);
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
