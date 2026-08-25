import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const SUPER_ADMIN_UID = '970690f1-d3d5-47fd-bd79-fe9c3a2be65c';

export const getIndividualModules = (pkg) => {
  const base = ['Lead Management', 'Calendar & Schedule', 'Notifications', 'Settings'];
  if (pkg === 'individual_pro') return [...base, 'Visits', 'Payments'];
  return base;
};

export const getOrgModules = (pkg) => {
  const starter = ['Lead Management', 'Calendar & Schedule', 'Payments', 'Notifications', 'Settings', 'User Management'];
  const professional = [...starter, 'Project Management', 'Team Management', 'Reports & Analytics', 'HR Operations'];
  const enterprise = [...professional, 'Custom Domain'];
  if (pkg === 'enterprise') return enterprise;
  if (pkg === 'professional') return professional;
  return starter;
};

export const BILLING_PACKAGES = {
  individual: [
    { id: 'free_trial', name: 'Free Trial', price: 0, duration: '1 Month', maxUsers: 1, badge: 'Trial', color: '#6B7280' },
    { id: 'individual_pro', name: 'Individual Pro', price: 19, duration: '/month', maxUsers: 1, badge: 'Pro', color: '#8B5CF6' },
  ],
  organization: [
    { id: 'starter', name: 'Starter', price: 49, duration: '/month', maxUsers: 10, badge: 'Starter', color: '#10B981' },
    { id: 'professional', name: 'Professional', price: 99, duration: '/month', maxUsers: 25, badge: 'Pro', color: '#3B82F6', popular: true },
    { id: 'enterprise', name: 'Enterprise', price: 199, duration: '/month', maxUsers: -1, badge: 'Enterprise', color: '#F59E0B', customDomain: true },
  ],
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);

  const fetchUserProfile = async (supabaseUser) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      let profile = userData || {};

      // Auto-provision Super Admin profile
      if (!userData && supabaseUser.id === SUPER_ADMIN_UID) {
        const adminData = {
          id: SUPER_ADMIN_UID,
          full_name: 'Mohammad Sajjad Khan',
          email: 'nestinnovaltd@gmail.com',
          phone: '+8801972372395',
          username: 'nest_innova',
          role: 'Super Admin',
          account_type: 'super_admin',
          permissions: ['All'],
          status: 'Active',
          approval_status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { data: inserted } = await supabase
          .from('users')
          .upsert(adminData, { onConflict: 'id' })
          .select()
          .single();
        profile = inserted || adminData;
      }

      const accountType = profile.account_type ||
        (supabaseUser.id === SUPER_ADMIN_UID ? 'super_admin' : 'org_employee');

      // Super Admin: Auto-provision 'Nest CRM' organization
      if (accountType === 'super_admin') {
        const { data: existingNestOrg } = await supabase
          .from('organizations')
          .select('*')
          .eq('name', 'Nest CRM')
          .maybeSingle();

        let nestOrg = existingNestOrg;

        if (!existingNestOrg) {
          const { data: newOrg } = await supabase
            .from('organizations')
            .insert({
              name: 'Nest CRM',
              slug: 'nest-crm',
              domain: 'nestcrm.com',
              status: 'approved',
              billing_package: 'enterprise',
              billing_status: 'active',
              owner_id: supabaseUser.id,
              max_users: -1,
            })
            .select()
            .single();
          nestOrg = newOrg;

          // Update user profile with org_id
          if (newOrg) {
            await supabase.from('users').update({ org_id: newOrg.id }).eq('id', supabaseUser.id);
            profile.org_id = newOrg.id;
          }
        }

        // Set default tenant to Nest CRM Org
        if (nestOrg && !currentTenant) {
          setCurrentTenant({ type: 'org', id: nestOrg.id, name: nestOrg.name, theme_color: nestOrg.theme_color });
        }
      }

      let orgData = null;
      if (profile.org_id && ['org_admin', 'org_employee', 'super_admin'].includes(accountType)) {
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .single();
        orgData = org || null;
      }

      // Set default tenant for Org members if not already set
      if (!currentTenant) {
        if (['org_admin', 'org_employee'].includes(accountType) && orgData) {
          setCurrentTenant({ type: 'org', id: orgData.id, name: orgData.name, theme_color: orgData.theme_color });
        }
      }

      const trialExpired = false;
      const subscriptionStatus = profile.subscription_status || 'active';

      if (profile.role && profile.role !== 'Super Admin') {
        const roleId = profile.role.toLowerCase().replace(/\s+/g, '_');
        const { data: roleData } = await supabase
          .from('roles').select('permissions').eq('id', roleId).single();
        if (roleData) profile.rolePermissions = roleData.permissions;
      }

      setUser({
        uid: supabaseUser.id,
        id: supabaseUser.id,
        email: supabaseUser.email,
        ...profile,
        name: profile.full_name || profile.name || 'User',
        account_type: accountType,
        trialExpired,
        subscriptionStatus,
        org: orgData,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      const isSA = supabaseUser.id === SUPER_ADMIN_UID;
      setUser({
        uid: supabaseUser.id,
        id: supabaseUser.id,
        email: supabaseUser.email,
        role: isSA ? 'Super Admin' : 'Team Member',
        account_type: isSA ? 'super_admin' : 'org_employee',
        permissions: isSA ? ['All'] : [],
      });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchUserProfile(session.user).finally(() => setLoading(false));
      else { setUser(null); setLoading(false); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) await fetchUserProfile(session.user);
        else setUser(null);
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, [currentTenant]);

  useEffect(() => {
    let themeColor = '#26E264'; // Default CRM accent color (Radium Green)

    if (user?.account_type === 'super_admin') {
      if (currentTenant?.type === 'org') {
        themeColor = currentTenant.theme_color || '#8B5CF6';
      } else {
        themeColor = '#26E264'; // Individual user
      }
    } else if (user?.org?.theme_color) {
      themeColor = user.org.theme_color;
    }

    const adjustColor = (col, amt) => {
      let usePound = false;
      if (col[0] === "#") { col = col.slice(1); usePound = true; }
      let num = parseInt(col, 16);
      let r = (num >> 16) + amt;
      if (r > 255) r = 255; else if (r < 0) r = 0;
      let b = ((num >> 8) & 0x00FF) + amt;
      if (b > 255) b = 255; else if (b < 0) b = 0;
      let g = (num & 0x0000FF) + amt;
      if (g > 255) g = 255; else if (g < 0) g = 0;
      return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    };

    const getGradientEndColor = (col) => {
      if (!col) return '#00F0FF';
      const upper = col.toUpperCase();
      if (upper === '#26E264') return '#00F0FF'; // Vibrant Green -> Cyan
      if (upper === '#8B5CF6') return '#EC4899'; // Indigo Purple -> Pink/Magenta
      if (upper === '#3B82F6') return '#00F0FF'; // Sky Blue -> Cyan/Teal
      if (upper === '#F59E0B') return '#EF4444'; // Bright Amber -> Deep Crimson
      if (upper === '#EF4444') return '#EC4899'; // Deep Crimson -> Pink/Magenta
      return adjustColor(col, 40); // fallback
    };

    try {
      const gradientEnd = getGradientEndColor(themeColor);
      document.documentElement.style.setProperty('--primary', themeColor);
      document.documentElement.style.setProperty('--primary-hover', adjustColor(themeColor, 20));
      document.documentElement.style.setProperty('--primary-dark', adjustColor(themeColor, -20));
      document.documentElement.style.setProperty('--primary-soft', `${themeColor}14`);
      document.documentElement.style.setProperty('--primary-glow', `${themeColor}22`);
      document.documentElement.style.setProperty('--primary-border', `${themeColor}33`);
      document.documentElement.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${themeColor} 0%, ${gradientEnd} 100%)`);
      document.documentElement.style.setProperty('--gradient-button', `linear-gradient(135deg, ${themeColor} 0%, ${gradientEnd} 100%)`);
    } catch (e) {
      console.error('Error applying theme variables:', e);
    }
  }, [user, currentTenant]);

  const login = async (email, password) => {
    try {
      // Check approval status first
      const { data: dbUser } = await supabase
        .from('users')
        .select('approval_status')
        .eq('email', email)
        .maybeSingle();

      if (dbUser && dbUser.approval_status !== 'approved') {
        return { 
          success: false, 
          message: dbUser.approval_status === 'rejected'
            ? 'Your registration has been rejected by the Super Admin.'
            : 'Your registration is pending Super Admin approval.'
        };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      let message = 'Invalid credentials';
      if (error.message.includes('Invalid login credentials')) message = 'Incorrect email or password';
      if (error.message.includes('Email not confirmed')) message = 'Please confirm your email first';
      return { success: false, message };
    }
  };

  const logout = async () => { try { await supabase.auth.signOut(); } catch (e) { console.error(e); } };

  const isSuperAdmin = () => user?.account_type === 'super_admin' || user?.id === SUPER_ADMIN_UID;
  const isOrgAdmin = () => user?.account_type === 'org_admin';
  const isOrgEmployee = () => user?.account_type === 'org_employee';
  // Individual account type is disabled — always returns false
  const isIndividual = () => false;
  const isOrganizationMember = () => ['org_admin', 'org_employee'].includes(user?.account_type);

  const hasPermission = (module, action = 'read', subModule = null) => {
    if (!user) return false;
    if (isSuperAdmin()) return true;
    if (Array.isArray(user.permissions) && user.permissions.includes('All')) return true;
    if (user.trialExpired) return module === 'Lead Management' && action === 'read';

    // 1. First, check organization-level module authorization limits
    if (isIndividual()) {
      const allowed = getIndividualModules(user.subscription_package || 'free_trial');
      if (!allowed.includes(module)) return false;
    } else if (isOrgAdmin() || isOrgEmployee()) {
      const org = user.org;
      const hasCustomModules = org && Array.isArray(org.tags) && org.tags.some(t => t.startsWith('module:'));
      if (hasCustomModules) {
        const prefix = `module:${module}:`;
        const moduleTags = org.tags.filter(t => t.startsWith(prefix));
        if (moduleTags.length === 0) return false;
        const actionMap = { view:'read', read:'read', add:'create', create:'create', edit:'update', update:'update', delete:'delete' };
        const dbAction = actionMap[action] || action;
        if (['create', 'update', 'delete'].includes(dbAction)) {
          if (!moduleTags.includes(`${prefix}write`)) return false;
        }
      } else {
        const allowed = getOrgModules(user.org?.billing_package || 'starter');
        if (!allowed.includes(module)) return false;
      }
    }

    // 2. Next, check user-specific custom permission overrides in user.permissions array
    if (Array.isArray(user.permissions) && user.permissions.length > 0 && typeof user.permissions[0] === 'object' && user.permissions[0] !== null) {
      const userOverrides = user.permissions[0];
      if (userOverrides[module]) {
        const modulePerms = userOverrides[module];
        const actionMap = { view:'read', read:'read', add:'create', create:'create', edit:'update', update:'update', delete:'delete' };
        const dbAction = actionMap[action] || action;
        
        // Org employees cannot delete by default
        if (isOrgEmployee() && dbAction === 'delete') return false;
        
        if (subModule && modulePerms[subModule]) {
          return modulePerms[subModule][dbAction] === true;
        }
        return Object.values(modulePerms).some(p => p[dbAction] === true);
      }
    }

    // 3. Fallback: check role permissions
    if (user.rolePermissions && user.rolePermissions[module]) {
      const modulePerms = user.rolePermissions[module];
      const actionMap = { view:'read', read:'read', add:'create', create:'create', edit:'update', update:'update', delete:'delete' };
      const dbAction = actionMap[action] || action;
      
      // Org employees cannot delete by default
      if (isOrgEmployee() && dbAction === 'delete') return false;
      
      if (subModule && modulePerms[subModule]) {
        return modulePerms[subModule][dbAction] === true;
      }
      return Object.values(modulePerms).some(p => p[dbAction] === true);
    }

    // Org Admins have access to all modules allowed for their organization by default if no override exists
    if (isOrgAdmin()) return true;

    return false;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, hasPermission,
      isSuperAdmin, isOrgAdmin, isOrgEmployee, isIndividual, isOrganizationMember,
      SUPER_ADMIN_UID, currentTenant, setCurrentTenant
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
