import { supabase } from '../lib/supabase';

// No pre-existing demo categories. Only user-created categories will exist.
const DEFAULT_CATEGORIES = [];
const SEED_IDS = ['cat-real-estate', 'cat-corporate', 'cat-vip', 'cat-retail'];
const SEED_NAMES = ['real estate', 'corporate clients', 'vip investors', 'retail buyers'];

const STORAGE_KEY = 'nest_lead_categories';

export const getStoredCategories = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Strip any previous mock/seed categories
        const clean = parsed.filter(c => 
          !SEED_IDS.includes(c?.id) && 
          !SEED_NAMES.includes((c?.name || '').trim().toLowerCase())
        );
        return clean;
      }
    }
  } catch (e) {
    console.error('Error reading lead categories from localStorage:', e);
  }
  return DEFAULT_CATEGORIES;
};

export const setStoredCategories = (cats) => {
  try {
    const clean = Array.isArray(cats)
      ? cats.filter(c => 
          !SEED_IDS.includes(c?.id) && 
          !SEED_NAMES.includes((c?.name || '').trim().toLowerCase())
        )
      : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Error saving lead categories to localStorage:', e);
  }
};

export const fetchLeadCategories = async () => {
  let categories = [];
  try {
    const { data, error } = await supabase.from('lead_categories').select('*').order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      const clean = data.filter(c => 
        !SEED_IDS.includes(c?.id) && 
        !SEED_NAMES.includes((c?.name || '').trim().toLowerCase())
      );
      setStoredCategories(clean);
      return clean;
    }
  } catch (err) {
    console.warn('lead_categories table query fallback to localStorage:', err);
  }

  // Fallback to local storage
  categories = getStoredCategories();
  return categories;
};

export const createLeadCategory = async ({ name, color, description, org_id, owner_id }) => {
  const newCat = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`,
    name: name.trim(),
    color: color || '#3B82F6',
    description: description ? description.trim() : '',
    org_id: org_id || null,
    owner_id: owner_id || null,
    created_at: new Date().toISOString()
  };

  // Try DB insert
  try {
    const { data, error } = await supabase.from('lead_categories').insert(newCat).select().single();
    if (!error && data) {
      const existing = getStoredCategories();
      const updated = [...existing.filter(c => c.name.toLowerCase() !== newCat.name.toLowerCase()), data];
      setStoredCategories(updated);
      return data;
    }
  } catch (err) {
    console.warn('lead_categories insert fallback to local storage:', err);
  }

  // Fallback local storage
  const existing = getStoredCategories();
  const updated = [...existing.filter(c => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat];
  setStoredCategories(updated);
  return newCat;
};

export const deleteLeadCategory = async (id, name) => {
  try {
    await supabase.from('lead_categories').delete().eq('id', id);
  } catch (err) {
    console.warn('lead_categories delete failed in Supabase:', err);
  }
  const existing = getStoredCategories();
  const updated = existing.filter(c => c.id !== id && c.name !== name);
  setStoredCategories(updated);
  return updated;
};
