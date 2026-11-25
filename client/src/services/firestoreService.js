import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import rajHistoricalData from '../data/rajHistoricalData.json';
import { 
  computeDashboardFromTransactions, 
  computeReportsFromTransactions,
  computeYearlyReportFromTransactions
} from './sheetsBackend';

// Standard Default 15 Categories for New Users (Clean, comprehensive, non-overlapping)
export const STANDARD_DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'Utensils', color: '#6C47FF', is_quick: true, is_system: true },
  { name: 'Groceries', icon: 'ShoppingBasket', color: '#10B981', is_quick: true, is_system: true },
  { name: 'Transportation', icon: 'Car', color: '#F59E0B', is_quick: true, is_system: true },
  { name: 'Housing & Rent', icon: 'Home', color: '#6366F1', is_quick: false, is_system: true },
  { name: 'Bills & Utilities', icon: 'Lightbulb', color: '#3B82F6', is_quick: false, is_system: true },
  { name: 'Shopping', icon: 'ShoppingBag', color: '#EC4899', is_quick: true, is_system: true },
  { name: 'Health & Medical', icon: 'HeartPulse', color: '#EF4444', is_quick: false, is_system: true },
  { name: 'Personal Care', icon: 'Sparkles', color: '#F43F5E', is_quick: false, is_system: true },
  { name: 'Entertainment', icon: 'Film', color: '#8B5CF6', is_quick: false, is_system: true },
  { name: 'Education', icon: 'BookOpen', color: '#0EA5E9', is_quick: false, is_system: true },
  { name: 'Travel', icon: 'Plane', color: '#F97316', is_quick: false, is_system: true },
  { name: 'EMI & Loans', icon: 'CreditCard', color: '#64748B', is_quick: false, is_system: true },
  { name: 'Gifts & Donations', icon: 'Gift', color: '#D946EF', is_quick: false, is_system: true },
  { name: 'Subscriptions', icon: 'Repeat', color: '#14B8A6', is_quick: false, is_system: true },
  { name: 'Other', icon: 'MoreHorizontal', color: '#94A3B8', is_quick: false, is_system: true }
];

export const MINIMAL_DEFAULT_CATEGORIES = STANDARD_DEFAULT_CATEGORIES;

// Suggested Optional Categories (user-created or 1-click added, non-mandatory)
export const SUGGESTED_OPTIONAL_CATEGORIES = [
  { name: 'Pet Care', icon: 'PawPrint', color: '#F59E0B' },
  { name: 'Insurance', icon: 'ShieldCheck', color: '#3B82F6' },
  { name: 'Investments', icon: 'TrendingUp', color: '#10B981' },
  { name: 'Vehicle Maintenance', icon: 'Wrench', color: '#64748B' },
  { name: 'Bank Charges & Fees', icon: 'Receipt', color: '#EF4444' },
  { name: 'Family Expenses', icon: 'Users', color: '#EC4899' },
  { name: 'Business Expenses', icon: 'Briefcase', color: '#6366F1' }
];

export function getLocalMonthKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Standard 67 Category Meta Definitions (for Raj's historical data migration)
const CATEGORY_META = {
  'Food': { icon: 'Utensils', color: '#6C47FF' },
  'Auto': { icon: 'Car', color: '#F59E0B' },
  'Metro': { icon: 'Train', color: '#0EA5E9' },
  'Fruits': { icon: 'Apple', color: '#EF4444' },
  'Cloths': { icon: 'Shirt', color: '#3B82F6' },
  'Shopping': { icon: 'ShoppingBag', color: '#A855F7' },
  'Biryani': { icon: 'Utensils', color: '#F97316' },
  'Non Veg': { icon: 'Drumstick', color: '#EF4444' },
  'Chicken': { icon: 'Drumstick', color: '#EA580C' },
  'Mutton': { icon: 'Drumstick', color: '#DC2626' },
  'Fish': { icon: 'Fish', color: '#0284C7' },
  'Eggs': { icon: 'Egg', color: '#F59E0B' },
  'Fast Food': { icon: 'Pizza', color: '#F97316' },
  'Office Lunch': { icon: 'UtensilsCrossed', color: '#6366F1' },
  'Office Nashta': { icon: 'Coffee', color: '#D97706' },
  'Office Tifin': { icon: 'Package', color: '#059669' },
  'Office Bottle': { icon: 'Droplet', color: '#06B6D4' },
  'Tea': { icon: 'Coffee', color: '#B45309' },
  'Coffee Powder': { icon: 'Coffee', color: '#78350F' },
  'Cold Drink': { icon: 'CupSoda', color: '#06B6D4' },
  'Juice': { icon: 'Wine', color: '#EC4899' },
  'Vegitables': { icon: 'Carrot', color: '#10B981' },
  'Salad': { icon: 'Salad', color: '#22C55E' },
  'Milk': { icon: 'Milk', color: '#3B82F6' },
  'General': { icon: 'ShoppingBag', color: '#64748B' },
  'Grocery': { icon: 'ShoppingCart', color: '#059669' },
  'Medical': { icon: 'HeartPulse', color: '#E11D48' },
  'Mobile Recharge': { icon: 'Smartphone', color: '#7C3AED' },
  'Rent': { icon: 'Home', color: '#2563EB' },
  'Electricity': { icon: 'Zap', color: '#CA8A04' }
};

/**
 * Ensures user profile and handles historical migration safely
 */
export async function ensureUserProfile(userId, email, displayName = '') {
  if (!isFirebaseConfigured || !db) return;

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const isRaj = email.toLowerCase() === 'raaajshinde@gmail.com';
      const name = displayName || (isRaj ? 'Raj Shinde' : email.split('@')[0]);

      await setDoc(userRef, {
        email: email.toLowerCase(),
        displayName: name,
        monthly_budget: isRaj ? 12000 : 0,
        currency: '₹',
        migrated: false,
        onboarding_completed: isRaj,
        created_at: serverTimestamp()
      });

      // If Raj Shinde, run historical data migration
      if (isRaj) {
        await migrateRajHistoricalData(userId);
      } else {
        await seedDefaultCategories(userId);
      }
    } else {
      const data = snap.data();
      const isRaj = email.toLowerCase() === 'raaajshinde@gmail.com';
      if (isRaj && !data.migrated) {
        await migrateRajHistoricalData(userId);
      }
    }
  } catch (err) {
    console.error('Error in ensureUserProfile:', err);
  }
}

export async function updateProfileName(userId, newName) {
  if (!isFirebaseConfigured || !db || !userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { displayName: newName, user_name: newName }, { merge: true });
  } catch (err) {
    console.error('Error updating profile name in Firestore:', err);
  }
}

/**
 * Batch migrations for Raj Shinde's 1,216 historical transactions and 73 categories
 */
export async function migrateRajHistoricalData(userId) {
  if (!isFirebaseConfigured || !db) return;

  try {
    console.log(`Starting historical migration of ${rajHistoricalData.transactions.length} records for user ${userId}...`);

    // 1. Seed categories
    const catCol = collection(db, 'users', userId, 'categories');
    const catBatch = writeBatch(db);
    for (const cat of rajHistoricalData.categories) {
      const docRef = doc(catCol, String(cat.id || cat.name));
      catBatch.set(docRef, {
        name: cat.name,
        icon: cat.icon || CATEGORY_META[cat.name]?.icon || 'Tag',
        color: cat.color || CATEGORY_META[cat.name]?.color || '#6C47FF',
        is_system: true
      });
    }
    await catBatch.commit();

    // 2. Seed transactions in batches of 400 (staying safely below 500-op limit)
    const txCol = collection(db, 'users', userId, 'transactions');
    const transactions = rajHistoricalData.transactions;
    const CHUNK_SIZE = 400;

    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const tx of chunk) {
        const docRef = doc(txCol, String(tx.id));
        batch.set(docRef, {
          id: tx.id,
          date: tx.date,
          month_key: tx.month_key || (tx.date ? tx.date.slice(0, 7) : '2026-11'),
          description: tx.description || '',
          category: tx.category || 'Other',
          payment_mode: tx.payment_mode || 'UPI',
          amount: parseFloat(tx.amount) || 0,
          is_refund: Boolean(tx.is_refund || tx.amount < 0)
        });
      }
      await batch.commit();
      console.log(`Migrated transactions ${i + 1} to ${Math.min(i + CHUNK_SIZE, transactions.length)}...`);
    }

    // 3. Mark migration complete in profile
    await updateDoc(doc(db, 'users', userId), {
      migrated: true,
      migrated_records: transactions.length,
      migration_date: serverTimestamp()
    });

    console.log('Historical migration completed successfully!');
  } catch (err) {
    console.error('Error during historical data migration:', err);
  }
}

/**
 * Seed default categories for new accounts (Clean & Minimal starter set)
 */
export async function seedDefaultCategories(userId) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const catCol = collection(db, 'users', userId, 'categories');
    const batch = writeBatch(db);

    MINIMAL_DEFAULT_CATEGORIES.forEach((cat, idx) => {
      const docRef = doc(catCol, `cat_${idx + 1}`);
      batch.set(docRef, {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        is_quick: Boolean(cat.is_quick),
        is_system: true
      });
    });

    await batch.commit();
  } catch (err) {
    console.error('Error seeding categories:', err);
  }
}

/**
 * Query all distinct historical months containing transactions for this user
 */
export async function getAvailableMonths(userId) {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    const snap = await getDocs(txCol);
    const months = new Set();
    snap.forEach(d => {
      const data = d.data();
      const m = data.month_key || (data.date ? data.date.slice(0, 7) : '');
      if (m && /^\d{4}-\d{2}$/.test(m)) months.add(m);
    });

    try {
      const mCol = collection(db, 'users', userId, 'months');
      const mSnap = await getDocs(mCol);
      mSnap.forEach(d => {
        if (/^\d{4}-\d{2}$/.test(d.id)) months.add(d.id);
      });
    } catch (e) {}

    const isRaj = userId === '1' || String(userId).includes('raj');
    if (months.size === 0 && isRaj && rajHistoricalData && rajHistoricalData.transactions) {
      rajHistoricalData.transactions.forEach(t => {
        const m = t.month_key || (t.date ? t.date.slice(0, 7) : '');
        if (m && /^\d{4}-\d{2}$/.test(m)) months.add(m);
      });
    }

    if (months.size === 0) {
      months.add(getLocalMonthKey());
    }

    return Array.from(months).sort().reverse();
  } catch (err) {
    console.warn('Error fetching available months in Firestore:', err);
    return [getLocalMonthKey()];
  }
}

/**
 * Get monthly dashboard data from Firestore with Monthly Roll-up Cache
 */
export async function getDashboardData(userId, monthKey = getLocalMonthKey()) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const isRaj = userDoc.exists() && userDoc.data().email === 'raaajshinde@gmail.com';
    const profile = userDoc.exists() ? userDoc.data() : { monthly_budget: 0, currency: '₹' };
    const budget = profile.monthly_budget !== undefined ? (parseFloat(profile.monthly_budget) || 0) : (isRaj ? 12000 : 0);
    const allMonths = await getAvailableMonths(userId);

    // Check if pre-aggregated monthly summary document exists for instant 1-read load
    const monthDocRef = doc(db, 'users', userId, 'months', monthKey);
    try {
      const monthSnap = await getDoc(monthDocRef);
      if (monthSnap.exists()) {
        const summary = monthSnap.data();
        summary.budget = budget;
        summary.currency = profile.currency || '₹';
        summary.remaining = Math.max(0, budget - (summary.total_spent || 0));
        summary.spent_percentage = budget > 0 ? Math.min(100, Math.round(((summary.total_spent || 0) / budget) * 100)) : 0;
        summary.available_months = allMonths;
        return summary;
      }
    } catch (cacheErr) {}

    // Otherwise, query transactions for the selected month
    const txCol = collection(db, 'users', userId, 'transactions');
    const q = query(txCol, where('month_key', '==', monthKey));
    const snap = await getDocs(q);

    const transactions = [];
    snap.forEach(docSnap => transactions.push(docSnap.data()));

    // Get categories
    const categories = await getCategories(userId);

    // Compute dashboard metrics
    const computed = computeDashboardFromTransactions(transactions, monthKey, budget, categories);
    computed.available_months = allMonths;

    // Cache summary document for instant future dashboard visits
    try {
      await setDoc(monthDocRef, {
        ...computed,
        cached_at: serverTimestamp()
      }, { merge: true });
    } catch (saveErr) {}

    return computed;
  } catch (err) {
    console.error('Error in getDashboardData:', err);
    return null;
  }
}

/**
 * Get monthly reports data from Firestore with category and payment breakdowns
 */
export async function getReports(userId, monthKey = getLocalMonthKey()) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const isRaj = userDoc.exists() && userDoc.data().email === 'raaajshinde@gmail.com';
    const profile = userDoc.exists() ? userDoc.data() : { monthly_budget: 0, currency: '₹' };
    const budget = profile.monthly_budget !== undefined ? (parseFloat(profile.monthly_budget) || 0) : (isRaj ? 12000 : 0);
    const allMonths = await getAvailableMonths(userId);

    // Query transactions for the past 6 months to compute accurate 6-month spending trends
    const [y, m] = monthKey.split('-').map(Number);
    const targetMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      targetMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const minMonthKey = targetMonths[0];

    const txCol = collection(db, 'users', userId, 'transactions');
    let transactions = [];

    try {
      // Fetch each of the 6 months cleanly in parallel without composite index dependencies
      const monthDocs = await Promise.all(
        targetMonths.map(mk => getDocs(query(txCol, where('month_key', '==', mk))))
      );
      monthDocs.forEach(snap => {
        snap.forEach(d => transactions.push(d.data()));
      });
    } catch (e) {
      try {
        const snap = await getDocs(txCol);
        snap.forEach(d => transactions.push(d.data()));
      } catch (e2) {
        console.warn('Fallback error fetching transactions for reports:', e2);
      }
    }

    // Historical fallback for Raj Shinde if Firestore collection is fresh
    if (transactions.length === 0 && isRaj && rajHistoricalData && rajHistoricalData.transactions) {
      transactions = rajHistoricalData.transactions.filter(t => t.month_key >= minMonthKey && t.month_key <= monthKey);
    }

    const categories = await getCategories(userId);
    const rep = computeReportsFromTransactions(transactions, monthKey, budget, categories);
    rep.available_months = allMonths;
    return rep;
  } catch (err) {
    console.error('Error in firestoreService.getReports:', err);
    return null;
  }
}

/**
 * Get annual / yearly reports data from Firestore
 */
export async function getYearlyReports(userId, selectedYear = new Date().getFullYear().toString()) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const isRaj = userDoc.exists() && userDoc.data().email === 'raaajshinde@gmail.com';

    const txCol = collection(db, 'users', userId, 'transactions');
    const snap = await getDocs(txCol);

    let transactions = [];
    snap.forEach(d => transactions.push(d.data()));

    if (transactions.length === 0 && isRaj && rajHistoricalData && rajHistoricalData.transactions) {
      transactions = rajHistoricalData.transactions;
    }

    const categories = await getCategories(userId);
    return computeYearlyReportFromTransactions(transactions, String(selectedYear), categories);
  } catch (err) {
    console.error('Error in firestoreService.getYearlyReports:', err);
    return null;
  }
}

/**
 * Query transactions with filters
 */
export async function getTransactions(userId, filters = {}) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    let q = query(txCol);

    if (filters.month && filters.month !== 'all') {
      q = query(q, where('month_key', '==', filters.month));
    }
    if (filters.category && filters.category !== 'all') {
      q = query(q, where('category', '==', filters.category));
    }
    if (filters.payment_mode && filters.payment_mode !== 'all') {
      q = query(q, where('payment_mode', '==', filters.payment_mode));
    }

    const snap = await getDocs(q);
    let rows = [];
    snap.forEach(d => rows.push(d.data()));

    // Fallback: if filtered query returned empty, inspect full user collection before giving up
    if (rows.length === 0) {
      const allSnap = await getDocs(txCol);
      if (allSnap.empty) {
        // Let api.js fall back to local REST API / cached offline ledger
        return null;
      }
      allSnap.forEach(d => {
        const data = d.data();
        const mk = data.month_key || (data.date ? String(data.date).slice(0, 7) : '');
        if (filters.month && filters.month !== 'all' && mk !== filters.month) return;
        if (filters.category && filters.category !== 'all' && data.category !== filters.category) return;
        if (filters.payment_mode && filters.payment_mode !== 'all' && data.payment_mode !== filters.payment_mode) return;
        rows.push(data);
      });
    }

    // Client-side search filtering if query provided
    if (filters.search) {
      const s = filters.search.toLowerCase();
      rows = rows.filter(t => 
        (t.description || '').toLowerCase().includes(s) ||
        (t.category || '').toLowerCase().includes(s) ||
        (t.date || '').includes(s)
      );
    }

    // Sort by date descending
    rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Calculate totals
    const totalCount = rows.length;
    const totalAmount = rows.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // Group transactions by date for UI presentation
    const groupedMap = {};
    rows.forEach(tx => {
      const d = tx.date || 'Unknown';
      if (!groupedMap[d]) {
        groupedMap[d] = { date: d, total: 0, transactions: [] };
      }
      groupedMap[d].transactions.push(tx);
      groupedMap[d].total += (parseFloat(tx.amount) || 0);
    });

    return {
      transactions: rows,
      total_count: totalCount,
      total_amount: totalAmount,
      grouped: Object.values(groupedMap),
      pagination: {
        total: totalCount,
        total_amount: totalAmount,
        page: filters.page || 1,
        limit: filters.limit || 40,
        total_pages: Math.ceil(totalCount / (filters.limit || 40))
      }
    };
  } catch (err) {
    console.error('Error in getTransactions:', err);
    return null;
  }
}

/**
 * Add transaction to Firestore
 */
export async function addTransaction(userId, data) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    const docRef = doc(txCol);
    const txId = docRef.id;

    const parsedDate = data.date || new Date().toISOString().slice(0, 10);
    const monthKey = parsedDate.slice(0, 7);
    let amount = parseFloat(data.amount) || 0;
    if (data.is_refund && amount > 0) amount = -amount;

    const newTx = {
      id: txId,
      date: parsedDate,
      month_key: monthKey,
      category: data.category || 'Food',
      payment_mode: data.payment_mode || 'UPI',
      amount,
      description: data.description || '',
      is_refund: Boolean(data.is_refund || amount < 0),
      created_at: serverTimestamp()
    };

    await setDoc(docRef, newTx);

    // 1. Invalidate monthly roll-up cache so next dashboard visit re-calculates fresh totals
    try {
      await deleteDoc(doc(db, 'users', userId, 'months', monthKey));
    } catch (cacheDelErr) {}

    return newTx;
  } catch (err) {
    console.error('Error adding transaction to Firestore:', err);
    throw err;
  }
}

/**
 * Update transaction in Firestore
 */
export async function updateTransaction(userId, id, data) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const docRef = doc(db, 'users', userId, 'transactions', String(id));
    
    // Invalidate old month rollup cache if date changed
    let oldMonthKey = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const oldData = snap.data();
        oldMonthKey = oldData.month_key || (oldData.date ? oldData.date.slice(0, 7) : null);
      }
    } catch (readErr) {}

    const parsedDate = data.date || new Date().toISOString().slice(0, 10);
    const monthKey = parsedDate.slice(0, 7);
    let amount = parseFloat(data.amount) || 0;
    if (data.is_refund && amount > 0) amount = -amount;

    const updated = {
      ...data,
      date: parsedDate,
      month_key: monthKey,
      amount,
      updated_at: serverTimestamp()
    };

    await updateDoc(docRef, updated);

    // Invalidate roll-up caches so dashboard & reports calculate accurate live totals
    try {
      if (oldMonthKey) {
        await deleteDoc(doc(db, 'users', userId, 'months', oldMonthKey));
      }
      if (monthKey && monthKey !== oldMonthKey) {
        await deleteDoc(doc(db, 'users', userId, 'months', monthKey));
      }
    } catch (cacheErr) {}

    return updated;
  } catch (err) {
    console.error('Error updating transaction in Firestore:', err);
    throw err;
  }
}

/**
 * Delete transaction in Firestore
 */
export async function deleteTransaction(userId, id) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const docRef = doc(db, 'users', userId, 'transactions', String(id));
    
    // Fetch monthKey before deleting to invalidate the monthly rollup cache
    let monthKey = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        monthKey = data.month_key || (data.date ? data.date.slice(0, 7) : null);
      }
    } catch (readErr) {}

    await deleteDoc(docRef);

    // Invalidate monthly roll-up cache so dashboard & reports immediately recalculate fresh totals
    if (monthKey) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'months', monthKey));
      } catch (cacheErr) {}
    }

    return { success: true };
  } catch (err) {
    console.error('Error deleting transaction in Firestore:', err);
    throw err;
  }
}

/**
 * Get categories
 */
export async function getCategories(userId) {
  if (!isFirebaseConfigured || !db) {
    return MINIMAL_DEFAULT_CATEGORIES.map((c, idx) => ({ id: idx + 1, ...c }));
  }

  try {
    const catCol = collection(db, 'users', userId, 'categories');
    const snap = await getDocs(catCol);
    if (snap.empty) {
      await seedDefaultCategories(userId);
      const newSnap = await getDocs(catCol);
      const list = [];
      newSnap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return list;
    }

    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    console.error('Error fetching categories:', err);
    return MINIMAL_DEFAULT_CATEGORIES.map((c, idx) => ({ id: idx + 1, ...c }));
  }
}

/**
 * Add custom category
 */
export async function addCategory(userId, catData) {
  if (!isFirebaseConfigured || !db) return { id: Date.now(), ...catData };

  try {
    const catCol = collection(db, 'users', userId, 'categories');
    const docRef = doc(catCol);
    const newCat = {
      id: docRef.id,
      name: catData.name,
      icon: catData.icon || 'Tag',
      color: catData.color || '#6C47FF',
      is_quick: Boolean(catData.is_quick),
      is_system: false,
      created_at: serverTimestamp()
    };
    await setDoc(docRef, newCat);
    return newCat;
  } catch (err) {
    console.error('Error adding category:', err);
    throw err;
  }
}

/**
 * Delete category
 */
export async function deleteCategory(userId, id) {
  if (!isFirebaseConfigured || !db) return { success: true };

  try {
    const docRef = doc(db, 'users', userId, 'categories', String(id));
    await deleteDoc(docRef);
    return { success: true };
  } catch (err) {
    console.error('Error deleting category:', err);
    throw err;
  }
}

/**
 * Update category (rename, change icon, color, quick-status, or archive status)
 */
export async function updateCategory(userId, id, data) {
  if (!isFirebaseConfigured || !db) return { id, ...data };

  try {
    const docRef = doc(db, 'users', userId, 'categories', String(id));
    const updates = {
      updated_at: serverTimestamp()
    };
    if (data.name !== undefined) updates.name = String(data.name).trim();
    if (data.icon !== undefined) updates.icon = String(data.icon);
    if (data.color !== undefined) updates.color = String(data.color);
    if (data.is_quick !== undefined) updates.is_quick = Boolean(data.is_quick);
    if (data.archived !== undefined) updates.archived = Boolean(data.archived);

    await updateDoc(docRef, updates);
    return { id, ...data };
  } catch (err) {
    console.error('Error updating category:', err);
    throw err;
  }
}

/**
 * Archive category (preserves all historical transactions)
 */
export async function archiveCategory(userId, id) {
  return await updateCategory(userId, id, { archived: true });
}

/**
 * Restore an archived category
 */
export async function restoreCategory(userId, id) {
  return await updateCategory(userId, id, { archived: false });
}

/**
 * Count transactions for a given category name
 */
export async function countTransactionsForCategory(userId, categoryName) {
  if (!isFirebaseConfigured || !db || !userId || !categoryName) return 0;

  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    const q = query(txCol, where('category', '==', categoryName));
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    console.warn('Error counting category transactions:', err);
    return 0;
  }
}

/**
 * Reassign historical transactions from oldCategoryName to newCategoryName
 */
export async function reassignCategoryTransactions(userId, oldCategoryName, newCategoryName) {
  if (!isFirebaseConfigured || !db || !userId || !oldCategoryName || !newCategoryName) return 0;

  try {
    const txCol = collection(db, 'users', userId, 'transactions');
    const q = query(txCol, where('category', '==', oldCategoryName));
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    let updatedCount = 0;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const chunk = docs.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.update(d.ref, {
          category: newCategoryName,
          updated_at: serverTimestamp()
        });
      });
      await batch.commit();
      updatedCount += chunk.length;
    }
    return updatedCount;
  } catch (err) {
    console.error('Error reassigning category transactions:', err);
    throw err;
  }
}

/**
 * Get user settings
 */
export async function getSettings(userId) {
  if (!isFirebaseConfigured || !db) {
    return {
      monthly_budget: '0',
      currency: '₹',
      user_name: 'User',
      user_email: '',
      onboarding_completed: false
    };
  }

  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const d = snap.data();
      const isRaj = d.email === 'raaajshinde@gmail.com';
      return {
        monthly_budget: String(d.monthly_budget !== undefined ? d.monthly_budget : (isRaj ? 12000 : 0)),
        currency: d.currency || '₹',
        user_name: d.displayName || (d.email ? d.email.split('@')[0] : 'User'),
        user_email: d.email || '',
        onboarding_completed: Boolean(d.onboarding_completed)
      };
    }
  } catch (err) {
    console.error('Error getting settings:', err);
  }

  return {
    monthly_budget: '12000',
    currency: '₹',
    user_name: 'User',
    user_email: '',
    onboarding_completed: false
  };
}

/**
 * Update user settings
 */
export async function updateSettings(userId, settings) {
  if (!isFirebaseConfigured || !db) return settings;

  try {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      ...settings,
      updated_at: serverTimestamp()
    });
    return settings;
  } catch (err) {
    console.error('Error updating settings:', err);
    throw err;
  }
}

/**
 * Update monthly budget
 */
export async function updateBudget(userId, month, budget) {
  if (!isFirebaseConfigured || !db) return { success: true };

  try {
    const docRef = doc(db, 'users', userId);
    const numBudget = parseFloat(budget) || 0;
    await updateDoc(docRef, {
      monthly_budget: numBudget,
      updated_at: serverTimestamp()
    });
    if (month) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'months', month));
      } catch (cacheErr) {}
    }
    return { success: true };
  } catch (err) {
    console.error('Error updating budget:', err);
    throw err;
  }
}
