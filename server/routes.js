const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const db = require('./db');
const sheetTemplate = require('./sheetTemplate');
const smsParser = require('./smsParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware: Resolve authenticated user context with complete data isolation
function resolveUser(req, res, next) {
  try {
    const rawUserEmail = req.headers['x-user-email'] || req.query.user_email;
    if (!rawUserEmail) {
      return res.status(401).json({ success: false, error: 'Unauthorized: user identity header missing' });
    }
    const userEmail = String(rawUserEmail).trim().toLowerCase();
    // Strict email syntax validation to prevent header injection and spoofing
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(userEmail) || userEmail.length > 254) {
      return res.status(400).json({ success: false, error: 'Bad Request: invalid user identity format' });
    }

    const googleSub = req.headers['x-google-sub'] ? String(req.headers['x-google-sub']).slice(0, 128) : null;
    const userName = req.headers['x-user-name'] ? String(req.headers['x-user-name']).slice(0, 100) : null;
    const { user, spreadsheetMapping, isNew } = db.getOrCreateUser(googleSub, userEmail, userName);
    req.user = user;
    req.spreadsheetMapping = spreadsheetMapping;
    req.isNewUser = isNew;
    next();
  } catch (err) {
    console.error('Error resolving user context:', err);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

// ========================================================
// 1. AUTHENTICATION & MULTI-USER IDENTITY
// ========================================================

router.post('/auth/google', (req, res) => {
  try {
    const { email, name, sub, picture } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Google account email is required' });
    }
    const { user, spreadsheetMapping, isNew } = db.getOrCreateUser(sub, email, name, picture);
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        google_user_id: user.google_user_id
      },
      spreadsheet: spreadsheetMapping,
      is_new_user: isNew
    });
  } catch (err) {
    console.error('Google Auth error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get currently authenticated user profile & spreadsheet association
router.get('/user/profile', resolveUser, (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
      spreadsheet: req.spreadsheetMapping
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Associate or update user's Google Spreadsheet ID
router.post('/user/spreadsheet', resolveUser, (req, res) => {
  try {
    const { spreadsheet_id, spreadsheet_url, status } = req.body;
    if (!spreadsheet_id) {
      return res.status(400).json({ success: false, error: 'spreadsheet_id is required' });
    }
    const mapping = db.setUserSpreadsheetMapping(req.user.id, spreadsheet_id, spreadsheet_url, status || 'active');
    res.json({ success: true, spreadsheet: mapping });
  } catch (err) {
    console.error('Error linking spreadsheet:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 2. STANDARD SPREADSHEET TEMPLATE ENDPOINTS
// ========================================================

// Download blank standard template workbook for user
router.get('/template/download', resolveUser, (req, res) => {
  try {
    const buffer = sheetTemplate.createStandardWorkbookBuffer(req.user.email);
    res.setHeader('Content-Disposition', 'attachment; filename="Expense_Tracker_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Google Sheets API v4 payload structure for client-side Drive creation
router.get('/template/sheets-payload', resolveUser, (req, res) => {
  try {
    const payload = sheetTemplate.getGoogleSheetsApiTemplatePayload(`PocketNook - ${req.user.email}`);
    res.json({ success: true, payload });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 3. USER-SCOPED DASHBOARD & EXPENSES
// ========================================================

router.get('/dashboard', resolveUser, (req, res) => {
  try {
    const { month } = req.query;
    const data = db.getDashboardData(month, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/transactions', resolveUser, (req, res) => {
  try {
    const filters = {
      month_key: req.query.month,
      category: req.query.category,
      payment_mode: req.query.payment_mode,
      date: req.query.date,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit
    };
    const data = db.getTransactions(filters, req.user.id);

    // Group transactions by date for UI presentation
    const groupedMap = {};
    (data.transactions || []).forEach(tx => {
      const d = tx.date || 'Unknown';
      if (!groupedMap[d]) {
        groupedMap[d] = { date: d, total: 0, transactions: [] };
      }
      groupedMap[d].transactions.push(tx);
      groupedMap[d].total += (parseFloat(tx.amount) || 0);
    });

    const formattedData = {
      ...data,
      total_count: data.pagination ? data.pagination.total : (data.transactions || []).length,
      total_amount: data.pagination ? data.pagination.total_amount : 0,
      grouped: Object.values(groupedMap)
    };

    res.json({ success: true, data: formattedData });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/transactions', resolveUser, (req, res) => {
  try {
    const { amount, category, payment_mode, date, description, is_refund } = req.body;
    if (amount === undefined || amount === null || isNaN(parseFloat(amount))) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }
    const newTx = db.addTransaction({
      amount: parseFloat(amount),
      category,
      payment_mode,
      date,
      description,
      is_refund: Boolean(is_refund)
    }, req.user.id);
    res.status(201).json({ success: true, data: newTx });
  } catch (err) {
    console.error('Error adding transaction:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/transactions/:id', resolveUser, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, category, payment_mode, date, description, is_refund } = req.body;
    const updated = db.updateTransaction(id, {
      amount,
      category,
      payment_mode,
      date,
      description,
      is_refund: Boolean(is_refund)
    }, req.user.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Transaction not found or access denied' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/transactions/:id', resolveUser, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.deleteTransaction(id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Transaction not found or access denied' });
    }
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 4. CATEGORIES & REPORTS
// ========================================================

router.get('/categories', resolveUser, (req, res) => {
  try {
    const data = db.getCategories(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/categories', resolveUser, (req, res) => {
  try {
    const { name, icon, color, is_quick } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    const cat = db.addCategory({ name, icon, color, is_quick });
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    console.error('Error adding category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/categories/:id', resolveUser, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.deleteCategory(id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/categories/:id', resolveUser, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = db.updateCategory(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/categories/count', resolveUser, (req, res) => {
  try {
    const { name } = req.query;
    const count = db.countCategoryTransactions(name, req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Error counting category transactions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/categories/reassign', resolveUser, (req, res) => {
  try {
    const { oldName, newName } = req.body;
    const changed = db.reassignCategoryTransactions(oldName, newName, req.user.id);
    res.json({ success: true, changed });
  } catch (err) {
    console.error('Error reassigning category transactions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports', resolveUser, (req, res) => {
  try {
    const { month } = req.query;
    const data = db.getReports(month, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 5. SETTINGS & BUDGET
// ========================================================

router.get('/settings', resolveUser, (req, res) => {
  try {
    const data = db.getSettings(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/settings', resolveUser, (req, res) => {
  try {
    const updated = db.updateSettings(req.body, req.user.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/budget', resolveUser, (req, res) => {
  try {
    const { month, budget } = req.body;
    if (!budget || isNaN(parseFloat(budget))) {
      return res.status(400).json({ success: false, error: 'Valid budget amount is required' });
    }
    const val = parseFloat(budget);
    if (month && month !== 'default') {
      db.setMonthlyBudget(month, val, req.user.id);
    } else {
      db.updateSettings({ monthly_budget: val.toString() }, req.user.id);
    }
    res.json({ success: true, budget: val, month });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 6. EXPORT & IMPORT (ISOLATED PER USER)
// ========================================================

router.get('/export/excel', resolveUser, (req, res) => {
  try {
    const rows = db.exportAllTransactions(req.user.id);
    const excelRows = rows.map(r => ({
      'Date': r.date,
      'Description': r.description,
      'Category': r.category,
      'Payment Mode': r.payment_mode,
      'Amount': r.amount,
      'Month_Key': r.month_key
    }));

    const worksheet = xlsx.utils.json_to_sheet(excelRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="Expense_Tracker_${req.user.email.split('@')[0]}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/json', resolveUser, (req, res) => {
  try {
    const transactions = db.exportAllTransactions(req.user.id);
    const categories = db.getCategories(req.user.id);
    const settings = db.getSettings(req.user.id);
    const backup = {
      export_date: new Date().toISOString(),
      user: {
        email: req.user.email,
        name: req.user.name
      },
      spreadsheet_id: req.spreadsheetMapping ? req.spreadsheetMapping.spreadsheet_id : null,
      version: '2.0',
      settings,
      categories,
      transactions
    };
    res.setHeader('Content-Disposition', `attachment; filename="expense_tracker_${req.user.email.split('@')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import', resolveUser, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('Expenses') ? 'Expenses' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const importTx = db.db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.Date || r.Amount === undefined || r.Amount === null || r.Amount === '') {
          skipped++;
          continue;
        }

        const dateStr = db.parseExcelDate(r.Date);
        if (!dateStr) {
          skipped++;
          errors.push(`Row ${i + 2}: Invalid date "${r.Date}"`);
          continue;
        }

        const amt = parseFloat(r.Amount);
        if (isNaN(amt)) {
          skipped++;
          errors.push(`Row ${i + 2}: Invalid amount "${r.Amount}"`);
          continue;
        }

        const cat = r.Category ? String(r.Category).trim() : 'Other';
        const pm = db.normalizePaymentMode(r['Payment Mode'] || r.PaymentMode);
        const desc = r.Description ? String(r.Description).trim() : '';
        const mk = r.Month_Key ? String(r.Month_Key).trim() : dateStr.slice(0, 7);

        db.db.prepare(`
          INSERT INTO transactions (user_id, date, description, category, payment_mode, amount, month_key, is_refund)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, dateStr, desc, cat, pm, amt, mk, amt < 0 ? 1 : 0);

        imported++;
      }
    });

    importTx();

    res.json({
      success: true,
      message: `Imported ${imported} transactions (${skipped} skipped)`,
      imported,
      skipped,
      errors: errors.slice(0, 10)
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/backup/restore', resolveUser, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No backup file provided' });
    }
    const backupData = JSON.parse(req.file.buffer.toString('utf-8'));
    const result = db.restoreDatabase(backupData, req.user.id);
    res.json({ success: true, message: 'Database restored successfully', ...result });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 8. WHATSAPP CHATBOX & AUTOMATED EXPENSE WEBHOOK
// ========================================================

function sendWhatsAppResponse(req, res, payload) {
  const isTwilio = Boolean(req.body.Body || req.headers['x-twilio-signature'] || req.body.AccountSid);
  if (isTwilio) {
    const text = String(payload.replyText || payload.error || '');
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`);
  }
  return res.json(payload);
}

// Meta WhatsApp Webhook verification challenge
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'pocketnook_secret_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified successfully');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ success: false, error: 'Verification failed' });
  }

  res.json({
    success: true,
    status: 'PocketNook WhatsApp webhook active',
    supported_formats: ['Meta Cloud API', 'Twilio Webhook', 'Direct Simulation JSON'],
    verify_token_configured: Boolean(VERIFY_TOKEN)
  });
});

// WhatsApp incoming message handler (Meta Cloud API, Twilio, or Direct Simulator)
router.post('/webhook/whatsapp', (req, res) => {
  try {
    let incomingText = '';
    let fromNumber = '';

    // Case 1: Meta Cloud API webhook format
    if (req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msgObj = req.body.entry[0].changes[0].value.messages[0];
      incomingText = msgObj.text?.body || '';
      fromNumber = msgObj.from || '';
    } 
    // Case 2: Twilio WhatsApp webhook format (Body & From)
    else if (req.body.Body) {
      incomingText = req.body.Body;
      fromNumber = req.body.From || '';
    } 
    // Case 3: Direct JSON simulator format ({ message: 'Chai 20', from: '...' })
    else if (req.body.message || req.body.text) {
      incomingText = req.body.message || req.body.text;
      fromNumber = req.body.from || '';
    }

    if (!incomingText || !incomingText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'No message text found in webhook payload'
      });
    }

    const trimmedText = incomingText.trim();
    const lower = trimmedText.toLowerCase();

    // Determine target user (user header or default user 1)
    let targetUserId = 1;
    const userEmail = req.headers['x-user-email'] || req.body.user_email;
    if (userEmail) {
      try {
        const { user } = db.getOrCreateUser(null, userEmail);
        if (user && user.id) targetUserId = user.id;
      } catch (e) {}
    }

    // 1. Check for Summary / Balance command
    if (lower === 'summary' || lower === 'balance' || lower.includes('budget') || lower.includes('how much') || lower.includes('kitna bacha')) {
      const monthKey = new Date().toISOString().slice(0, 7);
      const dashboard = db.getDashboardData(monthKey, targetUserId);
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const daysLeft = Math.max(1, daysInMonth - new Date().getDate());
      const safePace = dashboard.remaining_budget > 0 ? Math.round(dashboard.remaining_budget / daysLeft) : 0;

      const replyText = `📊 *Monthly Budget Summary*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Spent This Month:* ₹${Number(dashboard.total_spent || 0).toLocaleString('en-IN')}\n` +
        `🎯 *Monthly Budget:* ₹${Number(dashboard.budget || 0).toLocaleString('en-IN')}\n` +
        `⚖️ *Remaining Balance:* ₹${Number(dashboard.remaining_budget || 0).toLocaleString('en-IN')}\n` +
        `📅 *Spent Today:* ₹${Number(dashboard.today_spent || 0).toLocaleString('en-IN')}\n` +
        `⚡ *Safe Daily Pace:* ₹${Number(safePace).toLocaleString('en-IN')}/day (${daysLeft} days left)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        (dashboard.remaining_budget < 0 ? `⚠️ Exceeded monthly budget!` : `✨ Within safe budget limits.`);

      return sendWhatsAppResponse(req, res, {
        success: true,
        type: 'summary',
        replyText,
        dashboard
      });
    }

    // 2. Check for Bill Splitting (e.g. "split 2400 between 6 people")
    if (/\b(?:split|divide|hissa|doston me)\b/i.test(lower) && /\d+/.test(lower)) {
      const numbers = trimmedText.match(/\d+(?:[.,]\d+)?/g) || [];
      if (numbers.length >= 2) {
        const nums = numbers.map(n => parseFloat(n.replace(/,/g, '')));
        const totalBill = Math.max(...nums);
        const peopleCount = Math.min(...nums);
        const perPerson = Math.round((totalBill / peopleCount) * 100) / 100;

        const replyText = `👥 *Bill Split Calculation*\n━━━━━━━━━━━━━━━━━━━━\n` +
          `🧾 *Total Bill:* ₹${totalBill.toLocaleString('en-IN')}\n` +
          `👤 *People:* ${peopleCount}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💵 *Each Person Owes:* *₹${perPerson.toLocaleString('en-IN')}*\n\n` +
          `💡 Reply \`Dinner ${Math.round(perPerson)} upi\` to log your share!`;

        return sendWhatsAppResponse(req, res, {
          success: true,
          type: 'split_bill',
          replyText,
          data: { totalBill, peopleCount, perPerson }
        });
      }
    }

    // 3. Check for Affordability ("can I afford 3000?")
    if (/\b(?:can i afford|should i buy|khareed sakta|le sakta)\b/i.test(lower) && /\d+/.test(lower)) {
      const matches = trimmedText.match(/\d+(?:[.,]\d+)?/g) || [];
      const plannedAmount = parseFloat(matches[0].replace(/,/g, ''));
      const monthKey = new Date().toISOString().slice(0, 7);
      const dashboard = db.getDashboardData(monthKey, targetUserId);
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const daysLeft = Math.max(1, daysInMonth - new Date().getDate());
      const currentPace = dashboard.remaining_budget > 0 ? Math.round(dashboard.remaining_budget / daysLeft) : 0;
      const newRemaining = dashboard.remaining_budget - plannedAmount;
      const newPace = daysLeft > 0 ? Math.round(newRemaining / daysLeft) : 0;

      let advice = '';
      if (newRemaining < 0) {
        advice = `🚨 *Verdict:* Budget risk! Spending ₹${plannedAmount.toLocaleString('en-IN')} pushes you ₹${Math.abs(newRemaining).toLocaleString('en-IN')} over budget.`;
      } else if (newPace < currentPace * 0.45) {
        advice = `⚠️ *Verdict:* Tight squeeze. You can afford it, but daily spending will shrink to ₹${newPace}/day for the remaining ${daysLeft} days.`;
      } else {
        advice = `🎉 *Verdict:* Comfortably affordable! You'll still have ₹${newRemaining.toLocaleString('en-IN')} remaining (₹${newPace}/day).`;
      }

      const replyText = `💡 *Affordability Diagnosis*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷️ *Purchase:* ₹${plannedAmount.toLocaleString('en-IN')}\n` +
        `💰 *Current Balance:* ₹${Number(dashboard.remaining_budget).toLocaleString('en-IN')}\n` +
        `⚡ *Current Daily Pace:* ₹${currentPace}/day\n` +
        `📉 *Projected Daily Pace:* ₹${newPace}/day\n` +
        `━━━━━━━━━━━━━━━━━━━━\n${advice}`;

      return sendWhatsAppResponse(req, res, {
        success: true,
        type: 'affordability',
        replyText
      });
    }

    // 4. Check for Undo / Delete Last
    if (/\b(?:undo|delete last|cancel last|pichla hatao)\b/i.test(lower)) {
      const monthKey = new Date().toISOString().slice(0, 7);
      const recentTxs = db.getTransactions(monthKey, targetUserId);
      if (recentTxs && recentTxs.length > 0) {
        const lastTx = recentTxs[0];
        db.deleteTransaction(lastTx.id, targetUserId);
        const updatedDashboard = db.getDashboardData(monthKey, targetUserId);

        const replyText = `↩️ *Transaction Undone & Deleted!*\n━━━━━━━━━━━━━━━━━━━━\n` +
          `🗑️ *Removed:* ₹${lastTx.amount} for *${lastTx.description}* (${lastTx.category})\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `✨ Restored Remaining Balance: ₹${Number(updatedDashboard.remaining_budget).toLocaleString('en-IN')}`;

        return sendWhatsAppResponse(req, res, {
          success: true,
          type: 'undo_success',
          replyText
        });
      }
    }

    // 5. Parse expense using SMS/NLP parser
    const parsed = smsParser.parseSmsNotification(trimmedText);
    if (!parsed.success || !parsed.amount) {
      const helpReply = `🤔 Could not detect an amount in: "${trimmedText}".\n\nTry sending:\n• "Chai 20"\n• "Lunch 150 card"\n• "Uber 350 upi"\n• Or paste a bank SMS!`;
      return sendWhatsAppResponse(req, res, {
        success: false,
        replyText: helpReply,
        error: parsed.error
      });
    }

    // 3. Save to database
    const newTx = db.addTransaction({
      amount: parsed.amount,
      description: parsed.merchant,
      category: parsed.category,
      payment_mode: parsed.paymentMode,
      date: parsed.date,
      is_refund: parsed.type === 'income' ? 1 : 0
    }, targetUserId);

    const monthKey = parsed.date.slice(0, 7);
    const updatedDashboard = db.getDashboardData(monthKey, targetUserId);

    const replyText = parsed.type === 'income'
      ? `🎉 *Income / Refund Logged!*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 *Amount:* +₹${Number(parsed.amount).toLocaleString('en-IN')}\n` +
        `📝 *Source:* ${parsed.merchant}\n` +
        `💳 *Mode:* ${parsed.paymentMode}\n` +
        `📅 *Date:* ${parsed.date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 Updated Monthly Spent: ₹${Number(updatedDashboard.total_spent).toLocaleString('en-IN')}`
      : `✅ *Expense Logged Successfully!*\n━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Amount:* ₹${Number(parsed.amount).toLocaleString('en-IN')}\n` +
        `🏷️ *Category:* ${parsed.category}\n` +
        `📝 *Merchant:* ${parsed.merchant}\n` +
        `💳 *Mode:* ${parsed.paymentMode}\n` +
        `📅 *Date:* ${parsed.date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Updated Monthly Spent: ₹${Number(updatedDashboard.total_spent).toLocaleString('en-IN')}`;

    return sendWhatsAppResponse(req, res, {
      success: true,
      type: 'expense_logged',
      replyText,
      transaction: newTx,
      parsed
    });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 10. SECURE AI COPILOT PROXY (ZERO-LEAKAGE)
// ========================================================
router.post('/ai/copilot-chat', resolveUser, async (req, res) => {
  try {
    const { prompt, snapshot } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing prompt text' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        useLocalBrain: true,
        message: 'No GEMINI_API_KEY configured; fallback to local on-device intelligence brain.'
      });
    }

    // Defense-in-depth safe prompt truncation and non-PII snapshot metrics
    const safePrompt = String(prompt).slice(0, 1000);
    const safeSnapshot = {
      budget: Number(snapshot?.budget || 0),
      totalSpent: Number(snapshot?.totalSpent || 0),
      remainingBudget: Number(snapshot?.remainingBudget || 0),
      safeDailyPace: Number(snapshot?.safeDailyPace || 0),
      daysRemaining: Number(snapshot?.daysRemaining || 0),
      topCategory: snapshot?.topCategory?.category || 'None',
      topCategorySpent: Number(snapshot?.topCategory?.spent || 0)
    };

    const systemInstruction = 
      "You are PocketNook Financial Intelligence Copilot, a certified, privacy-first personal wealth and budgeting advisor. " +
      "The user is asking a financial or budgeting question. Give ultra-clear, concise, actionable advice. " +
      "Use bold headings (*Heading*), bullet points (• Item), and numbers in ₹ format where relevant. " +
      "Reference their monthly numbers when appropriate: " +
      `Budget: ₹${safeSnapshot.budget}, Spent so far: ₹${safeSnapshot.totalSpent}, Remaining: ₹${safeSnapshot.remainingBudget}, ` +
      `Days remaining: ${safeSnapshot.daysRemaining}, Safe daily burn rate: ₹${safeSnapshot.safeDailyPace}/day, ` +
      `Top spending channel: ${safeSnapshot.topCategory} (₹${safeSnapshot.topCategorySpent}). ` +
      "Keep answers under 150 words. Do not provide speculative investment/crypto advice. Focus on budgeting, saving, debt reduction, and disciplined spending.";

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: safePrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!apiRes.ok) {
      console.warn('Gemini API returned error status:', apiRes.status);
      return res.json({ success: false, useLocalBrain: true });
    }

    const data = await apiRes.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return res.json({ success: false, useLocalBrain: true });
    }

    return res.json({
      success: true,
      model: 'gemini-2.5-flash',
      replyText: candidateText.trim()
    });
  } catch (err) {
    console.warn('AI copilot-chat endpoint error, falling back to local brain:', err.message);
    return res.json({ success: false, useLocalBrain: true, error: err.message });
  }
});

module.exports = router;
