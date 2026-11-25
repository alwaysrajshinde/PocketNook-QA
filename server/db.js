const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'expense_tracker.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema with Multi-User & Data Isolation Support
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_user_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_spreadsheet_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      google_user_id TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_url TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'migrated', 'initializing'
      is_primary INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_usm_email ON user_spreadsheet_mappings(email);
    CREATE INDEX IF NOT EXISTS idx_usm_user_id ON user_spreadsheet_mappings(user_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Tag',
      color TEXT NOT NULL DEFAULT '#6C47FF',
      is_quick INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_budgets (
      month_key TEXT PRIMARY KEY,
      budget REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_monthly_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      budget REAL NOT NULL,
      UNIQUE(user_id, month_key)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      amount REAL NOT NULL,
      month_key TEXT NOT NULL,
      is_refund INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tx_month_key ON transactions(month_key);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
  `);

  // Safe migration: Add user_id column to transactions if missing
  const txCols = db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name);
  if (!txCols.includes('user_id')) {
    db.exec("ALTER TABLE transactions ADD COLUMN user_id INTEGER DEFAULT 1");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions(user_id)");

  // Safe migration: Add archived column to categories if missing
  const catCols = db.prepare("PRAGMA table_info(categories)").all().map(c => c.name);
  if (!catCols.includes('archived')) {
    db.exec("ALTER TABLE categories ADD COLUMN archived INTEGER DEFAULT 0");
  }

  // Seed default settings for master
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('monthly_budget', '12000');
  insertSetting.run('currency', '₹');
  insertSetting.run('user_name', 'Raj');
}

// Category meta definitions (standard 15 categories + historical categories)
const CATEGORY_META = {
  // 15 Standard Categories for New Users
  'Food & Dining': { icon: 'Utensils', color: '#6C47FF', is_quick: 1, is_system: 1 },
  'Groceries': { icon: 'ShoppingBasket', color: '#10B981', is_quick: 1, is_system: 1 },
  'Transportation': { icon: 'Car', color: '#F59E0B', is_quick: 1, is_system: 1 },
  'Housing & Rent': { icon: 'Home', color: '#6366F1', is_quick: 0, is_system: 1 },
  'Bills & Utilities': { icon: 'Lightbulb', color: '#3B82F6', is_quick: 0, is_system: 1 },
  'Shopping': { icon: 'ShoppingBag', color: '#EC4899', is_quick: 1, is_system: 1 },
  'Health & Medical': { icon: 'HeartPulse', color: '#EF4444', is_quick: 0, is_system: 1 },
  'Personal Care': { icon: 'Sparkles', color: '#F43F5E', is_quick: 0, is_system: 1 },
  'Entertainment': { icon: 'Film', color: '#8B5CF6', is_quick: 0, is_system: 1 },
  'Education': { icon: 'BookOpen', color: '#0EA5E9', is_quick: 0, is_system: 1 },
  'Travel': { icon: 'Plane', color: '#F97316', is_quick: 0, is_system: 1 },
  'EMI & Loans': { icon: 'CreditCard', color: '#64748B', is_quick: 0, is_system: 1 },
  'Gifts & Donations': { icon: 'Gift', color: '#D946EF', is_quick: 0, is_system: 1 },
  'Subscriptions': { icon: 'Repeat', color: '#14B8A6', is_quick: 0, is_system: 1 },
  'Other': { icon: 'MoreHorizontal', color: '#94A3B8', is_quick: 0, is_system: 1 },

  // Quick categories from UI
  'Food': { icon: 'Utensils', color: '#6C47FF', is_quick: 1 },
  'Auto': { icon: 'Car', color: '#F59E0B', is_quick: 1 },
  'Metro': { icon: 'Train', color: '#0EA5E9', is_quick: 1 },
  'Fruits': { icon: 'Apple', color: '#EF4444', is_quick: 1 },
  'Cloths': { icon: 'Shirt', color: '#3B82F6', is_quick: 1 },
  'Shopping': { icon: 'ShoppingBag', color: '#A855F7', is_quick: 1 },

  // Food & Dining
  'Biryani': { icon: 'Utensils', color: '#F97316', is_quick: 0 },
  'Non Veg': { icon: 'Drumstick', color: '#EF4444', is_quick: 0 },
  'Chicken': { icon: 'Drumstick', color: '#EA580C', is_quick: 0 },
  'Mutton': { icon: 'Drumstick', color: '#DC2626', is_quick: 0 },
  'Fish': { icon: 'Fish', color: '#0284C7', is_quick: 0 },
  'Eggs': { icon: 'Egg', color: '#F59E0B', is_quick: 0 },
  'Fast Food': { icon: 'Pizza', color: '#F97316', is_quick: 0 },
  'Office Lunch': { icon: 'UtensilsCrossed', color: '#6366F1', is_quick: 0 },
  'Office Nashta': { icon: 'Coffee', color: '#D97706', is_quick: 0 },
  'Office Tifin': { icon: 'Package', color: '#059669', is_quick: 0 },
  'Office Bottle': { icon: 'Droplet', color: '#06B6D4', is_quick: 0 },
  'Tea': { icon: 'Coffee', color: '#B45309', is_quick: 0 },
  'Coffee Powder': { icon: 'Coffee', color: '#78350F', is_quick: 0 },
  'Cold Drink': { icon: 'CupSoda', color: '#06B6D4', is_quick: 0 },
  'Juice': { icon: 'Wine', color: '#EC4899', is_quick: 0 },
  'Vegitables': { icon: 'Carrot', color: '#10B981', is_quick: 0 },
  'Salad': { icon: 'Salad', color: '#22C55E', is_quick: 0 },
  'Milk': { icon: 'Milk', color: '#3B82F6', is_quick: 0 },
  'Bread': { icon: 'Wheat', color: '#D97706', is_quick: 0 },
  'Paneer': { icon: 'Box', color: '#EAB308', is_quick: 0 },
  'Sweet': { icon: 'Candy', color: '#EC4899', is_quick: 0 },
  'Cadbury': { icon: 'Candy', color: '#9333EA', is_quick: 0 },
  'Icecream': { icon: 'IceCream', color: '#F43F5E', is_quick: 0 },
  'Biscuit': { icon: 'Cookie', color: '#D97706', is_quick: 0 },
  'Groceries': { icon: 'ShoppingCart', color: '#10B981', is_quick: 0 },
  'Curd': { icon: 'Milk', color: '#0EA5E9', is_quick: 0 },
  'Coconut Water': { icon: 'Droplet', color: '#10B981', is_quick: 0 },

  // Transport
  'Rapido': { icon: 'Bike', color: '#F59E0B', is_quick: 0 },
  'Travel': { icon: 'Navigation', color: '#6366F1', is_quick: 0 },
  'Railway Ticket': { icon: 'Ticket', color: '#3B82F6', is_quick: 0 },

  // Personal / Shopping
  'Shoes': { icon: 'Footprints', color: '#64748B', is_quick: 0 },
  'Footwear': { icon: 'Footprints', color: '#64748B', is_quick: 0 },
  'Bag': { icon: 'Briefcase', color: '#8B5CF6', is_quick: 0 },
  'Belt': { icon: 'Watch', color: '#78350F', is_quick: 0 },
  'Watch': { icon: 'Watch', color: '#6366F1', is_quick: 0 },
  'Wallet': { icon: 'Wallet', color: '#64748B', is_quick: 0 },
  'Umbrella': { icon: 'Umbrella', color: '#0284C7', is_quick: 0 },
  'Saloon': { icon: 'Scissors', color: '#8B5CF6', is_quick: 0 },
  'Beard': { icon: 'Scissors', color: '#64748B', is_quick: 0 },
  'Shaving Blade': { icon: 'Sparkles', color: '#94A3B8', is_quick: 0 },

  // Tech & Utilities
  'AI': { icon: 'Bot', color: '#6C47FF', is_quick: 0 },
  'Laptop': { icon: 'Laptop', color: '#3B82F6', is_quick: 0 },
  'Mobile Recharge': { icon: 'Smartphone', color: '#10B981', is_quick: 0 },
  'For Mobile': { icon: 'Smartphone', color: '#6366F1', is_quick: 0 },
  'Mobile Accessories': { icon: 'Headphones', color: '#8B5CF6', is_quick: 0 },
  'Earbud': { icon: 'Headphones', color: '#A855F7', is_quick: 0 },
  'Mobile': { icon: 'Smartphone', color: '#3B82F6', is_quick: 0 },
  'Light Bill': { icon: 'Zap', color: '#F59E0B', is_quick: 0 },

  // Health & Education
  'Medical': { icon: 'Stethoscope', color: '#EF4444', is_quick: 0 },
  'Doctor': { icon: 'HeartPulse', color: '#DC2626', is_quick: 0 },
  'Hospital': { icon: 'Building2', color: '#B91C1C', is_quick: 0 },
  'College': { icon: 'GraduationCap', color: '#3B82F6', is_quick: 0 },
  'Courses': { icon: 'BookOpen', color: '#8B5CF6', is_quick: 0 },
  'Stationary': { icon: 'PenTool', color: '#64748B', is_quick: 0 },

  // Finance & Others
  'Mutual Fund': { icon: 'TrendingUp', color: '#10B981', is_quick: 0 },
  'Stocks': { icon: 'BarChart3', color: '#059669', is_quick: 0 },
  'Savings': { icon: 'PiggyBank', color: '#10B981', is_quick: 0 },
  'Round Figure': { icon: 'CircleDollarSign', color: '#6366F1', is_quick: 0 },
  'Gov Documents': { icon: 'FileText', color: '#64748B', is_quick: 0 },
  'Gifts': { icon: 'Gift', color: '#EC4899', is_quick: 0 },
  'Birthday': { icon: 'Cake', color: '#F43F5E', is_quick: 0 },
  'Home Buy': { icon: 'Home', color: '#6366F1', is_quick: 0 },
  'Movie Ticket': { icon: 'Film', color: '#8B5CF6', is_quick: 0 },
  'In Between Office': { icon: 'Building', color: '#64748B', is_quick: 0 },
  'Other': { icon: 'MoreHorizontal', color: '#94A3B8', is_quick: 0 },
  'temp': { icon: 'HelpCircle', color: '#94A3B8', is_quick: 0 },
  'Unknown': { icon: 'HelpCircle', color: '#94A3B8', is_quick: 0 },
};

function seedCategories() {
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (name, icon, color, is_quick)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [name, meta] of Object.entries(CATEGORY_META)) {
      insertCat.run(name, meta.icon, meta.color, meta.is_quick ? 1 : 0);
    }
  });
  tx();
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = xlsx.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  const parts = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const m = monthMap[parts[2].toLowerCase()];
    if (m) {
      return `${parts[3]}-${m}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return null;
}

function normalizePaymentMode(mode) {
  if (!mode) return 'UPI';
  const m = String(mode).trim().toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'cash') return 'Cash';
  if (m === 'wallet') return 'Wallet';
  if (m === 'card') return 'Card';
  return String(mode).trim();
}

// Seed initial historical data from Excel for existing user #1
function seedFromExcelIfNeeded() {
  const countResult = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  if (countResult && countResult.count > 0) {
    return;
  }

  const excelPath = path.join(__dirname, '..', 'Daily Expense.xlsx');
  if (!fs.existsSync(excelPath)) {
    return;
  }

  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets['Expenses'];
  if (!sheet) return;

  const rows = xlsx.utils.sheet_to_json(sheet);
  const validRows = rows.filter(r => r.Date && r.Amount !== undefined && r.Amount !== null && r.Amount !== '');

  const insertTx = db.prepare(`
    INSERT INTO transactions (user_id, date, description, category, payment_mode, amount, month_key, is_refund)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runMigration = db.transaction(() => {
    for (const r of validRows) {
      const dateStr = parseExcelDate(r.Date);
      if (!dateStr) continue;
      const rawCat = r.Category ? String(r.Category).trim() : 'Unknown';
      const desc = r.Description ? String(r.Description).trim() : '';
      const pm = normalizePaymentMode(r['Payment Mode']);
      const amount = parseFloat(r.Amount);
      const isRefund = amount < 0 ? 1 : 0;
      const monthKey = r.Month_Key ? String(r.Month_Key).trim() : dateStr.slice(0, 7);

      insertTx.run(dateStr, desc, rawCat, pm, amount, monthKey, isRefund);
    }
  });

  runMigration();
}

// Migrate existing user raaajshinde@gmail.com
function migrateExistingUser() {
  let raj = db.prepare("SELECT * FROM users WHERE id = 1 OR email = 'raaajshinde@gmail.com'").get();
  if (!raj) {
    db.prepare(`
      INSERT INTO users (id, google_user_id, email, name)
      VALUES (1, 'raj_shinde_master_id', 'raaajshinde@gmail.com', 'Raj Shinde')
    `).run();
    raj = db.prepare("SELECT * FROM users WHERE id = 1").get();
  }

  // Ensure all NULL user_id transactions are mapped to user #1
  db.prepare("UPDATE transactions SET user_id = 1 WHERE user_id IS NULL OR user_id = 0").run();

  // Ensure spreadsheet mapping for Raj exists
  const mapping = db.prepare("SELECT * FROM user_spreadsheet_mappings WHERE user_id = 1").get();
  if (!mapping) {
    db.prepare(`
      INSERT INTO user_spreadsheet_mappings (user_id, google_user_id, email, spreadsheet_id, spreadsheet_url, status)
      VALUES (1, 'raj_shinde_master_id', 'raaajshinde@gmail.com', '1x-master-raj-expenses-sheet-2026', 'https://docs.google.com/spreadsheets/d/1x-master-raj-expenses-sheet-2026/edit', 'migrated')
    `).run();
  }
}

// Initialize tables and migrations
initSchema();
seedCategories();
seedFromExcelIfNeeded();
migrateExistingUser();

// --- MULTI-USER IDENTITY & SPREADSHEET ASSOCIATION ---

function getOrCreateUser(googleUserId, email, name, picture) {
  if (!email) throw new Error('Email is required');
  const cleanEmail = email.trim().toLowerCase();
  const sub = googleUserId || ('google_' + Buffer.from(cleanEmail).toString('hex').slice(0, 16));
  const userName = name || cleanEmail.split('@')[0];

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  if (!user && (cleanEmail === 'raaajshinde@gmail.com')) {
    user = db.prepare('SELECT * FROM users WHERE id = 1').get();
  }

  let isNew = false;
  if (user) {
    db.prepare(`
      UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, picture, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  } else {
    isNew = true;
    const info = db.prepare(`
      INSERT INTO users (google_user_id, email, name, picture)
      VALUES (?, ?, ?, ?)
    `).run(sub, cleanEmail, userName, picture || '');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  // Check spreadsheet mapping
  let mapping = db.prepare('SELECT * FROM user_spreadsheet_mappings WHERE user_id = ?').get(user.id);
  if (!mapping) {
    // Generate new unique spreadsheet mapping for this user
    const generatedSheetId = user.id === 1 ? '1x-master-raj-expenses-sheet-2026' : `1sheet_user_${user.id}_${Date.now()}`;
    const generatedUrl = `https://docs.google.com/spreadsheets/d/${generatedSheetId}/edit`;
    const status = user.id === 1 ? 'migrated' : 'active';

    db.prepare(`
      INSERT INTO user_spreadsheet_mappings (user_id, google_user_id, email, spreadsheet_id, spreadsheet_url, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, user.google_user_id, user.email, generatedSheetId, generatedUrl, status);

    mapping = db.prepare('SELECT * FROM user_spreadsheet_mappings WHERE user_id = ?').get(user.id);
  }

  return { user, spreadsheetMapping: mapping, isNew };
}

function getUserByEmail(email) {
  if (!email) return null;
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

function getUserById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserSpreadsheetMapping(userId) {
  return db.prepare('SELECT * FROM user_spreadsheet_mappings WHERE user_id = ? AND is_primary = 1').get(userId);
}

function setUserSpreadsheetMapping(userId, spreadsheetId, spreadsheetUrl, status = 'active') {
  if (!userId || !spreadsheetId) throw new Error('User ID and spreadsheet ID required');
  const user = getUserById(userId);
  if (!user) throw new Error('User not found');

  db.prepare(`
    INSERT INTO user_spreadsheet_mappings (user_id, google_user_id, email, spreadsheet_id, spreadsheet_url, status, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(user.id, user.google_user_id, user.email, spreadsheetId, spreadsheetUrl || '', status);

  return getUserSpreadsheetMapping(userId);
}

// --- USER-SCOPED QUERY METHODS (DATA ISOLATION) ---

function getSettings(userId = 1) {
  const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId);
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });

  const globalRows = db.prepare('SELECT key, value FROM settings').all();
  globalRows.forEach(r => {
    if (!settings[r.key]) settings[r.key] = r.value;
  });

  const user = getUserById(userId);
  if (user) {
    settings.user_name = user.name;
    settings.user_email = user.email;
  }
  if (!settings.monthly_budget) settings.monthly_budget = userId === 1 ? '12000' : '0';
  if (!settings.currency) settings.currency = '₹';
  return settings;
}

function updateSettings(newSettings, userId = 1) {
  const setStmt = db.prepare(`
    INSERT INTO user_settings (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `);
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(newSettings)) {
      setStmt.run(userId, k, String(v));
    }
  });
  tx();
  return getSettings(userId);
}

function getMonthlyBudget(monthKey, userId = 1) {
  const custom = db.prepare('SELECT budget FROM user_monthly_budgets WHERE user_id = ? AND month_key = ?').get(userId, monthKey);
  if (custom) return custom.budget;
  const legacy = db.prepare('SELECT budget FROM monthly_budgets WHERE month_key = ?').get(monthKey);
  if (legacy && userId === 1) return legacy.budget;
  const settings = getSettings(userId);
  return parseFloat(settings.monthly_budget) || (userId === 1 ? 12000 : 0);
}

function setMonthlyBudget(monthKey, budget, userId = 1) {
  db.prepare(`
    INSERT INTO user_monthly_budgets (user_id, month_key, budget)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, month_key) DO UPDATE SET budget = excluded.budget
  `).run(userId, monthKey, parseFloat(budget));
  return getMonthlyBudget(monthKey, userId);
}

function getDashboardData(monthKey, userId = 1) {
  const targetMonth = monthKey || '2026-11';
  const budget = getMonthlyBudget(targetMonth, userId);

  // Spent in this month for THIS user only
  const monthSpendRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_spent,
           COUNT(*) as tx_count
    FROM transactions
    WHERE month_key = ? AND user_id = ?
  `).get(targetMonth, userId);

  const totalSpent = monthSpendRow ? monthSpendRow.total_spent : 0;
  const txCount = monthSpendRow ? monthSpendRow.tx_count : 0;
  const remainingBudget = budget - totalSpent;
  const percentSpent = budget > 0 ? (totalSpent / budget) * 100 : 0;

  // Reference date calculation
  const todayDate = targetMonth === '2026-11' ? '2026-11-20' : `${targetMonth}-01`;
  const todayRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as today_spent
    FROM transactions
    WHERE date = ? AND user_id = ?
  `).get(todayDate, userId);

  // This Week spending for THIS user only
  const weekRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as week_spent
    FROM transactions
    WHERE date <= ? AND date >= date(?, '-6 days') AND user_id = ?
  `).get(todayDate, todayDate, userId);

  // Top expense categories for THIS user only
  const topCatsRaw = db.prepare(`
    SELECT t.category as name,
           COALESCE(SUM(t.amount), 0) as amount,
           COUNT(*) as count
    FROM transactions t
    WHERE t.month_key = ? AND t.amount > 0 AND t.user_id = ?
    GROUP BY t.category
    ORDER BY amount DESC
    LIMIT 6
  `).all(targetMonth, userId);

  const topCategories = topCatsRaw.map(c => {
    const meta = CATEGORY_META[c.name] || { icon: 'Tag', color: '#6C47FF' };
    const percentage = totalSpent > 0 ? (c.amount / totalSpent) * 100 : 0;
    return {
      name: c.name,
      amount: c.amount,
      count: c.count,
      percentage: Math.round(percentage * 10) / 10,
      icon: meta.icon,
      color: meta.color
    };
  });

  // Recent transactions for THIS user only (limit 5)
  const recentRaw = db.prepare(`
    SELECT id, date, description, category, payment_mode, amount, is_refund, created_at, updated_at
    FROM transactions
    WHERE month_key = ? AND user_id = ?
    ORDER BY date DESC, id DESC
    LIMIT 5
  `).all(targetMonth, userId);

  const recentTransactions = recentRaw.map(t => {
    const meta = CATEGORY_META[t.category] || { icon: 'Tag', color: '#6C47FF' };
    return {
      ...t,
      icon: meta.icon,
      color: meta.color
    };
  });

  // Available months list for THIS user only
  const availableMonths = db.prepare(`
    SELECT DISTINCT month_key FROM transactions WHERE user_id = ? ORDER BY month_key DESC
  `).all(userId).map(r => r.month_key);

  if (availableMonths.length === 0) {
    availableMonths.push('2026-11');
  }

  const mapping = getUserSpreadsheetMapping(userId);

  return {
    month_key: targetMonth,
    budget,
    total_spent: totalSpent,
    remaining_budget: remainingBudget,
    percent_spent: Math.round(percentSpent * 10) / 10,
    today_spent: todayRow ? todayRow.today_spent : 0,
    today_date: todayDate,
    week_spent: weekRow ? weekRow.week_spent : 0,
    tx_count: txCount,
    top_categories: topCategories,
    recent_transactions: recentTransactions,
    available_months: availableMonths,
    spreadsheet_id: mapping ? mapping.spreadsheet_id : null,
    spreadsheet_url: mapping ? mapping.spreadsheet_url : null
  };
}

function getTransactions(filters = {}, userId = 1) {
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (filters.month_key && filters.month_key !== 'all') {
    query += ' AND month_key = ?';
    params.push(filters.month_key);
  }

  if (filters.category && filters.category !== 'all') {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.payment_mode && filters.payment_mode !== 'all') {
    query += ' AND payment_mode = ?';
    params.push(filters.payment_mode);
  }

  if (filters.date) {
    query += ' AND date = ?';
    params.push(filters.date);
  }

  if (filters.search) {
    query += ' AND (description LIKE ? OR category LIKE ? OR date LIKE ?)';
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount');
  const totals = db.prepare(countQuery).get(...params);

  query += ' ORDER BY date DESC, id DESC';

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;

  query += ' LIMIT ? OFFSET ?';
  const queryParams = [...params, limit, offset];

  const rows = db.prepare(query).all(...queryParams);

  const transactions = rows.map(t => {
    const meta = CATEGORY_META[t.category] || { icon: 'Tag', color: '#6C47FF' };
    return {
      ...t,
      icon: meta.icon,
      color: meta.color
    };
  });

  return {
    transactions,
    pagination: {
      total: totals ? totals.total : 0,
      total_amount: totals ? totals.total_amount : 0,
      page,
      limit,
      total_pages: Math.ceil((totals ? totals.total : 0) / limit)
    }
  };
}

function addTransaction(data, userId = 1) {
  let { date, description, category, payment_mode, amount, is_refund } = data;
  category = category ? String(category).trim() : 'Other';
  payment_mode = normalizePaymentMode(payment_mode);
  description = description ? String(description).trim() : '';
  const parsedDate = parseExcelDate(date) || date || new Date().toISOString().slice(0, 10);
  const month_key = parsedDate.slice(0, 7);

  let parsedAmount = Math.abs(parseFloat(amount) || 0);
  if (is_refund) {
    parsedAmount = -parsedAmount;
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, date, description, category, payment_mode, amount, month_key, is_refund)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(userId, parsedDate, description, category, payment_mode, parsedAmount, month_key, parsedAmount < 0 ? 1 : 0);
  return db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
}

function updateTransaction(id, data, userId = 1) {
  // Check ownership
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    return null;
  }

  let { date, description, category, payment_mode, amount, is_refund } = data;
  category = category ? String(category).trim() : existing.category;
  payment_mode = payment_mode ? normalizePaymentMode(payment_mode) : existing.payment_mode;
  description = description !== undefined ? String(description).trim() : existing.description;
  const parsedDate = date ? (parseExcelDate(date) || date) : existing.date;
  const month_key = parsedDate.slice(0, 7);

  let parsedAmount = existing.amount;
  if (amount !== undefined && !isNaN(parseFloat(amount))) {
    parsedAmount = Math.abs(parseFloat(amount));
    if (is_refund) {
      parsedAmount = -parsedAmount;
    }
  }

  db.prepare(`
    UPDATE transactions
    SET date = ?,
        description = ?,
        category = ?,
        payment_mode = ?,
        amount = ?,
        month_key = ?,
        is_refund = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(parsedDate, description, category, payment_mode, parsedAmount, month_key, parsedAmount < 0 ? 1 : 0, id, userId);

  return db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
}

function deleteTransaction(id, userId = 1) {
  // Enforce ownership check
  return db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
}

function getCategories(userId = 1) {
  const cats = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM transactions t WHERE t.category = c.name AND t.user_id = ?) as usage_count,
           (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.category = c.name AND t.user_id = ?) as total_spent
    FROM categories c
    ORDER BY c.is_quick DESC, usage_count DESC, c.name ASC
  `).all(userId, userId);
  return cats;
}

function addCategory(data) {
  const { name, icon, color, is_quick } = data;
  const cleanName = String(name).trim();
  const cleanIcon = icon || 'Tag';
  const cleanColor = color || '#6C47FF';
  const quickVal = is_quick ? 1 : 0;

  db.prepare(`
    INSERT INTO categories (name, icon, color, is_quick)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET icon = excluded.icon, color = excluded.color, is_quick = excluded.is_quick
  `).run(cleanName, cleanIcon, cleanColor, quickVal);

  return db.prepare('SELECT * FROM categories WHERE name = ?').get(cleanName);
}

function deleteCategory(id) {
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

function updateCategory(id, data) {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return null;
  const name = data.name !== undefined ? String(data.name).trim() : existing.name;
  const icon = data.icon !== undefined ? String(data.icon) : existing.icon;
  const color = data.color !== undefined ? String(data.color) : existing.color;
  const is_quick = data.is_quick !== undefined ? (data.is_quick ? 1 : 0) : existing.is_quick;
  const archived = data.archived !== undefined ? (data.archived ? 1 : 0) : (existing.archived || 0);

  db.prepare(`
    UPDATE categories
    SET name = ?, icon = ?, color = ?, is_quick = ?, archived = ?
    WHERE id = ?
  `).run(name, icon, color, is_quick, archived, id);

  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function countCategoryTransactions(name, userId = 1) {
  const row = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE category = ? AND user_id = ?').get(name, userId);
  return row ? row.count : 0;
}

function reassignCategoryTransactions(oldName, newName, userId = 1) {
  const info = db.prepare('UPDATE transactions SET category = ? WHERE category = ? AND user_id = ?').run(newName, oldName, userId);
  return info.changes;
}

function getReports(monthKey, userId = 1) {
  const targetMonth = monthKey || '2026-11';
  const budget = getMonthlyBudget(targetMonth, userId);

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_spent,
           COUNT(*) as tx_count
    FROM transactions
    WHERE month_key = ? AND user_id = ?
  `).get(targetMonth, userId);

  const totalSpent = totalRow ? totalRow.total_spent : 0;
  const txCount = totalRow ? totalRow.tx_count : 0;

  const categoryBreakdown = db.prepare(`
    SELECT category as name,
           COALESCE(SUM(amount), 0) as amount,
           COUNT(*) as count
    FROM transactions
    WHERE month_key = ? AND user_id = ?
    GROUP BY category
    ORDER BY amount DESC
  `).all(targetMonth, userId).map(c => {
    const meta = CATEGORY_META[c.name] || { icon: 'Tag', color: '#6C47FF' };
    const pct = totalSpent > 0 ? (c.amount / totalSpent) * 100 : 0;
    return {
      name: c.name,
      amount: c.amount,
      count: c.count,
      percentage: Math.round(pct * 10) / 10,
      icon: meta.icon,
      color: meta.color
    };
  });

  const topForChart = categoryBreakdown.slice(0, 5);
  const remainingCats = categoryBreakdown.slice(5);
  const othersAmount = remainingCats.reduce((sum, c) => sum + c.amount, 0);
  const othersPct = totalSpent > 0 ? (othersAmount / totalSpent) * 100 : 0;

  const chartData = [...topForChart];
  if (remainingCats.length > 0) {
    chartData.push({
      name: 'Others',
      amount: Math.round(othersAmount * 100) / 100,
      count: remainingCats.reduce((sum, c) => sum + c.count, 0),
      percentage: Math.round(othersPct * 10) / 10,
      icon: 'MoreHorizontal',
      color: '#8B5CF6'
    });
  }

  const paymentBreakdown = db.prepare(`
    SELECT payment_mode as mode,
           COALESCE(SUM(amount), 0) as amount,
           COUNT(*) as count
    FROM transactions
    WHERE month_key = ? AND user_id = ?
    GROUP BY payment_mode
    ORDER BY amount DESC
  `).all(targetMonth, userId).map(p => {
    const pct = totalSpent > 0 ? (p.amount / totalSpent) * 100 : 0;
    return {
      mode: p.mode,
      amount: p.amount,
      count: p.count,
      percentage: Math.round(pct * 10) / 10
    };
  });

  const allMonths = db.prepare(`
    SELECT month_key,
           COALESCE(SUM(amount), 0) as total,
           COUNT(*) as count
    FROM transactions
    WHERE user_id = ?
    GROUP BY month_key
    ORDER BY month_key ASC
  `).all(userId);

  const monthMap = {};
  allMonths.forEach(m => {
    monthMap[m.month_key] = { total: m.total, count: m.count };
  });

  const monthNames = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  };

  const [tYear, tMon] = (targetMonth || '2026-11').split('-').map(Number);
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tYear, tMon - 1 - i, 1);
    const yStr = String(d.getFullYear());
    const mNum = String(d.getMonth() + 1).padStart(2, '0');
    const mk = `${yStr}-${mNum}`;
    const mData = monthMap[mk] || { total: 0, count: 0 };
    monthlyTrend.push({
      month_key: mk,
      label: monthNames[mNum] || mk,
      month_label: `${monthNames[mNum] || mk} '${yStr.slice(2)}`,
      total: mData.total,
      count: mData.count,
      is_current: mk === targetMonth
    });
  }

  return {
    month_key: targetMonth,
    budget,
    total_spent: totalSpent,
    remaining_budget: budget - totalSpent,
    tx_count: txCount,
    category_breakdown: categoryBreakdown,
    chart_data: chartData,
    payment_breakdown: paymentBreakdown,
    monthly_trend: monthlyTrend
  };
}

function exportAllTransactions(userId = 1) {
  const rows = db.prepare(`
    SELECT date, description, category, payment_mode, amount, month_key
    FROM transactions
    WHERE user_id = ?
    ORDER BY date ASC, id ASC
  `).all(userId);
  return rows;
}

function restoreDatabase(backupData, userId = 1) {
  if (!backupData || !Array.isArray(backupData.transactions)) {
    throw new Error('Invalid backup data format: missing transactions array');
  }

  const clearTx = db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    if (backupData.settings) {
      updateSettings(backupData.settings, userId);
    }
    const insertTx = db.prepare(`
      INSERT INTO transactions (user_id, date, description, category, payment_mode, amount, month_key, is_refund)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of backupData.transactions) {
      const d = parseExcelDate(t.date) || t.date;
      const mk = t.month_key || d.slice(0, 7);
      const amt = parseFloat(t.amount);
      insertTx.run(userId, d, t.description || '', t.category || 'Other', normalizePaymentMode(t.payment_mode), amt, mk, amt < 0 ? 1 : 0);
    }
  });

  clearTx();
  return {
    status: 'success',
    restored_transactions: backupData.transactions.length
  };
}

module.exports = {
  db,
  getOrCreateUser,
  getUserByEmail,
  getUserById,
  getUserSpreadsheetMapping,
  setUserSpreadsheetMapping,
  getSettings,
  updateSettings,
  getMonthlyBudget,
  setMonthlyBudget,
  getDashboardData,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  countCategoryTransactions,
  reassignCategoryTransactions,
  getReports,
  exportAllTransactions,
  restoreDatabase,
  parseExcelDate,
  normalizePaymentMode
};
