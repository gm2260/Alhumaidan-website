/**
 * Al-Humaidan Family Meeting 1448H
 * Firebase Realtime Database Client & Helper API
 */

const firebaseConfig = {
  apiKey: "AIzaSyAqEfq_5L_bUlWmpkYBskf8ebx0ifq3Hw",
  authDomain: "alhumaidan-f902a.firebaseapp.com",
  projectId: "alhumaidan-f902a",
  storageBucket: "alhumaidan-f902a.firebasestorage.app",
  messagingSenderId: "1082062293174",
  appId: "1:1082062293174:web:f62321240a9c118051be17",
  measurementId: "G-JCGEDW09MX",
  databaseURL: "https://alhumaidan-f902a-default-rtdb.firebaseio.com"
};

let db = null;
let isFirebaseReady = false;

// Initialize Firebase
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    isFirebaseReady = true;
    console.log("✓ تم الاتصال بقاعدة بيانات فايربيس بنجاح (Realtime Database)");
  } else {
    console.warn("Firebase SDK غير متوفر عالمياً، سيتم استخدام التخزين المحلي كبديل مؤقت.");
  }
} catch (e) {
  console.error("خطأ في تهيئة فايربيس:", e);
}

// LocalStorage Fallback Keys
const LOCAL_REGISTRATIONS_KEY = 'humaidan_local_registrations_v1';
const LOCAL_EXPENSES_KEY = 'humaidan_local_expenses_v1';
const LOCAL_SETTINGS_KEY = 'humaidan_local_settings_v1';
const LOCAL_MEETINGS_KEY = 'humaidan_local_meetings_v1';
const LOCAL_FAMILY_HISTORY_KEY = 'humaidan_family_history_v1';

const defaultSettings = {
  bankName: "اسم البنك",
  accountName: "صندوق عائلة الحميدان",
  iban: "SA0000000000000000000000",
  adminPin: "1448",
  meetingTitle: "اجتماع أسرة عائلة الحميدان",
  meetingDate: "تاريخ الاجتماع: يحدد لاحقاً",
  venue: "سيتم تحديد المقر لاحقاً",
  mapsUrl: "#"
};

// ==========================================
// Registrations & Family History API
// ==========================================

/**
 * Save or update family registration
 */
async function apiSaveRegistration(registrationData) {
  const timestamp = new Date().toISOString();
  const id = registrationData.id || ('reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
  
  const payload = {
    ...registrationData,
    id: id,
    updatedAt: timestamp,
    createdAt: registrationData.createdAt || timestamp
  };

  // Save to Firebase if online
  if (isFirebaseReady && db) {
    try {
      await db.ref(`registrations/${id}`).set(payload);
    } catch (err) {
      console.warn("تعذر الحفظ في فايربيس مباشرة، سيتم الحفظ محلياً:", err);
    }
  }

  // Also cache locally
  saveLocalRegistration(payload);
  saveFamilyHistory(payload);
  return payload;
}

/**
 * Save family profile structure across meetings
 */
function saveFamilyHistory(reg) {
  try {
    const raw = localStorage.getItem(LOCAL_FAMILY_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : {};

    const cleanPhone = (reg.phone || '').replace(/[^0-9]/g, '');
    const cleanName = (reg.name || '').trim().toLowerCase();
    const pin = (reg.pin || '').trim();

    const record = {
      name: reg.name,
      phone: reg.phone || '',
      pin: reg.pin || '',
      counts: reg.counts || {},
      totalMembers: reg.totalMembers || 0,
      breakdown: reg.breakdown || [],
      lastUpdated: new Date().toISOString()
    };

    if (cleanPhone) {
      history['phone_' + cleanPhone] = record;
    }
    if (cleanName && pin) {
      history['user_' + cleanName + '_' + pin] = record;
    }
    localStorage.setItem(LOCAL_FAMILY_HISTORY_KEY, JSON.stringify(history));

    if (isFirebaseReady && db && cleanPhone) {
      db.ref(`family_history/${cleanPhone}`).set(record).catch(() => {});
    }
  } catch (e) {
    console.warn("Error saving family history:", e);
  }
}

/**
 * Find historical family counts by phone or name+pin
 */
async function apiFindFamilyHistory(name, pin, phone) {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const cleanName = (name || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();

  // Try local first
  try {
    const raw = localStorage.getItem(LOCAL_FAMILY_HISTORY_KEY);
    if (raw) {
      const history = JSON.parse(raw);
      if (cleanPhone && history['phone_' + cleanPhone]) {
        return history['phone_' + cleanPhone];
      }
      if (cleanName && cleanPin && history['user_' + cleanName + '_' + cleanPin]) {
        return history['user_' + cleanName + '_' + cleanPin];
      }
      // search by phone in all entries
      for (const k in history) {
        const item = history[k];
        if (cleanPhone && item.phone && item.phone.replace(/[^0-9]/g, '') === cleanPhone) {
          return item;
        }
        if (cleanName && item.name && item.name.trim().toLowerCase() === cleanName) {
          return item;
        }
      }
    }
  } catch (e) {}

  // Also search through current registrations
  const localList = getLocalRegistrations();
  const found = localList.find(r => 
    (cleanPhone && r.phone && r.phone.replace(/[^0-9]/g, '') === cleanPhone) ||
    (cleanName && cleanPin && r.name && r.name.trim().toLowerCase() === cleanName && r.pin === cleanPin) ||
    (cleanName && r.name && r.name.trim().toLowerCase() === cleanName)
  );
  if (found && found.counts && found.totalMembers > 0) {
    return {
      name: found.name,
      phone: found.phone || '',
      pin: found.pin || '',
      counts: found.counts,
      totalMembers: found.totalMembers,
      breakdown: found.breakdown || []
    };
  }

  // Also search through archived meetings
  const meetings = getLocalMeetings();
  for (const m of meetings) {
    if (m.archivedRegistrations && Array.isArray(m.archivedRegistrations)) {
      const archFound = m.archivedRegistrations.find(r => 
        (cleanPhone && r.phone && r.phone.replace(/[^0-9]/g, '') === cleanPhone) ||
        (cleanName && r.name && r.name.trim().toLowerCase() === cleanName)
      );
      if (archFound && archFound.counts && archFound.totalMembers > 0) {
        return {
          name: archFound.name,
          phone: archFound.phone || '',
          pin: archFound.pin || '',
          counts: archFound.counts,
          totalMembers: archFound.totalMembers,
          breakdown: archFound.breakdown || []
        };
      }
    }
  }

  return null;
}

/**
 * Find registration by Name and PIN or Phone
 */
async function apiFindRegistration(name, pin, phone = "") {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

  // Try Firebase first
  if (isFirebaseReady && db) {
    try {
      const snap = await db.ref('registrations').once('value');
      const val = snap.val();
      if (val) {
        for (const k in val) {
          const item = val[k];
          const itemPhone = (item.phone || '').replace(/[^0-9]/g, '');
          const matchPhone = cleanPhone && itemPhone && itemPhone === cleanPhone;
          const matchNamePin = cleanName && cleanPin && item.name && item.name.trim().toLowerCase() === cleanName && item.pin === cleanPin;
          if (matchPhone || matchNamePin) {
            return item;
          }
        }
      }
    } catch (e) {
      console.warn("خطأ قراءة التسجيل من فايربيس:", e);
    }
  }

  // Fallback to local
  const localList = getLocalRegistrations();
  return localList.find(i => {
    const itemPhone = (i.phone || '').replace(/[^0-9]/g, '');
    const matchPhone = cleanPhone && itemPhone && itemPhone === cleanPhone;
    const matchNamePin = cleanName && cleanPin && i.name && i.name.trim().toLowerCase() === cleanName && i.pin === cleanPin;
    return matchPhone || matchNamePin;
  }) || null;
}

/**
 * Real-time listener for registrations (Admin & Live view)
 */
function apiListenRegistrations(callback) {
  if (isFirebaseReady && db) {
    db.ref('registrations').on('value', (snapshot) => {
      const data = snapshot.val();
      const list = data ? Object.values(data) : [];
      // sync to local
      localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(list));
      callback(list);
    }, (error) => {
      console.warn("Firebase listener error:", error);
      callback(getLocalRegistrations());
    });
  } else {
    // Return local data immediately
    callback(getLocalRegistrations());
    window.addEventListener('storage', () => {
      callback(getLocalRegistrations());
    });
  }
}

/**
 * Update Payment Status: 'paid' (كامل) | 'partial' (جزئي) | 'pending' (قيد الانتظار)
 */
async function apiUpdatePaymentStatus(regId, newStatus, paidAmount = null, adminNotes = "") {
  const list = getLocalRegistrations();
  const current = list.find(r => r.id === regId) || {};
  const total = Number(current.totalAmount) || 0;

  let finalPaid = 0;
  let finalRemaining = total;

  if (newStatus === 'paid') {
    finalPaid = total;
    finalRemaining = 0;
  } else if (newStatus === 'partial') {
    finalPaid = Math.max(0, Math.min(total, Number(paidAmount) || 0));
    finalRemaining = Math.max(0, total - finalPaid);
    if (finalPaid >= total && total > 0) {
      newStatus = 'paid';
      finalRemaining = 0;
    } else if (finalPaid === 0) {
      newStatus = 'pending';
      finalRemaining = total;
    }
  } else {
    newStatus = 'pending';
    finalPaid = 0;
    finalRemaining = total;
  }

  const updatePayload = {
    status: newStatus,
    paidAmount: finalPaid,
    remainingAmount: finalRemaining,
    paidAt: (newStatus === 'paid' || newStatus === 'partial') ? new Date().toISOString() : null,
    adminNotes: adminNotes !== undefined ? adminNotes : (current.adminNotes || '')
  };

  if (isFirebaseReady && db) {
    try {
      await db.ref(`registrations/${regId}`).update(updatePayload);
    } catch (e) {
      console.warn("خطأ تحديث حالة السداد في فايربيس:", e);
    }
  }

  // Update local
  const idx = list.findIndex(r => r.id === regId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updatePayload };
    localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(list));
  }
  return list[idx];
}

/**
 * Delete registration
 */
async function apiDeleteRegistration(regId) {
  if (isFirebaseReady && db) {
    try {
      await db.ref(`registrations/${regId}`).remove();
    } catch (e) {
      console.warn("خطأ حذف التسجيل في فايربيس:", e);
    }
  }

  const list = getLocalRegistrations().filter(r => r.id !== regId);
  localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(list));
}

// ==========================================
// Expenses API (إدارة مصاريف الاجتماع)
// ==========================================

async function apiSaveExpense(expenseData) {
  const id = expenseData.id || ('exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
  const payload = {
    ...expenseData,
    id: id,
    createdAt: expenseData.createdAt || new Date().toISOString()
  };

  if (isFirebaseReady && db) {
    try {
      await db.ref(`expenses/${id}`).set(payload);
    } catch (e) {
      console.warn("خطأ حفظ المصروف في فايربيس:", e);
    }
  }

  const list = getLocalExpenses();
  const idx = list.findIndex(e => e.id === id);
  if (idx !== -1) list[idx] = payload;
  else list.push(payload);
  localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(list));

  return payload;
}

function apiListenExpenses(callback) {
  if (isFirebaseReady && db) {
    db.ref('expenses').on('value', (snapshot) => {
      const data = snapshot.val();
      const list = data ? Object.values(data) : [];
      localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(list));
      callback(list);
    });
  } else {
    callback(getLocalExpenses());
  }
}

async function apiDeleteExpense(id) {
  if (isFirebaseReady && db) {
    try {
      await db.ref(`expenses/${id}`).remove();
    } catch (e) {}
  }
  const list = getLocalExpenses().filter(e => e.id !== id);
  localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(list));
}

// ==========================================
// Settings API
// ==========================================

function apiListenSettings(callback) {
  if (isFirebaseReady && db) {
    db.ref('settings').on('value', (snapshot) => {
      const data = snapshot.val() || defaultSettings;
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(data));
      callback(data);
    });
  } else {
    callback(getLocalSettings());
  }
}

async function apiUpdateSettings(newSettings) {
  if (isFirebaseReady && db) {
    try {
      await db.ref('settings').set(newSettings);
    } catch (e) {}
  }
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(newSettings));
}

// ==========================================
// Local Storage Utilities
// ==========================================

function getLocalRegistrations() {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalRegistration(item) {
  const list = getLocalRegistrations();
  const idx = list.findIndex(r => r.id === item.id);
  if (idx !== -1) list[idx] = item;
  else list.push(item);
  localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(list));
}

function getLocalExpenses() {
  try {
    const raw = localStorage.getItem(LOCAL_EXPENSES_KEY);
    return raw ? JSON.parse(raw) : [
      { id: 'exp_1', title: 'عربون حجز المقر والتجهيزات', amount: 3500, category: 'venue', date: '1448/04/15' },
      { id: 'exp_2', title: 'الضيافة والقهوة والشاي والتمر', amount: 1200, category: 'hospitality', date: '1448/04/20' }
    ];
  } catch (e) {
    return [];
  }
}

function getLocalSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
}

// ==========================================
// Meetings & Archiving API (إدارة الاجتماعات والأرشفة)
// ==========================================

function getLocalMeetings() {
  try {
    const raw = localStorage.getItem(LOCAL_MEETINGS_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!list || list.length === 0) {
      const defMeeting = {
        id: 'meeting_default',
        title: 'اجتماع أسرة عائلة الحميدان القادم',
        date: 'تاريخ الاجتماع: يحدد لاحقاً',
        venue: 'سيتم تحديد المقر لاحقاً',
        mapsUrl: '#',
        status: 'active',
        createdAt: new Date().toISOString(),
        closedAt: null,
        closeNotes: ''
      };
      list = [defMeeting];
      localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return [];
  }
}

function saveLocalMeeting(meeting) {
  const list = getLocalMeetings();
  const idx = list.findIndex(m => m.id === meeting.id);
  if (idx !== -1) list[idx] = meeting;
  else list.unshift(meeting);
  localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(list));
}

function apiGetActiveMeeting() {
  const meetings = getLocalMeetings();
  return meetings.find(m => m.status === 'active') || meetings[0] || null;
}

function apiListenMeetings(callback) {
  if (isFirebaseReady && db) {
    db.ref('meetings').on('value', (snapshot) => {
      const data = snapshot.val();
      const list = data ? Object.values(data) : getLocalMeetings();
      localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(list));
      callback(list);
    }, () => {
      callback(getLocalMeetings());
    });
  } else {
    callback(getLocalMeetings());
    window.addEventListener('storage', () => {
      callback(getLocalMeetings());
    });
  }
}

/**
 * Create a new meeting (with optional archive of current meeting)
 */
async function apiCreateNewMeeting(meetingData, archiveCurrent = true) {
  const currentActive = apiGetActiveMeeting();
  const timestamp = new Date().toISOString();

  // If archiving current meeting:
  if (archiveCurrent && currentActive && currentActive.status === 'active') {
    await apiCloseCurrentMeeting(currentActive.id, 'تمت أرشفة الاجتماع تمهيداً لبدء اجتماع جديد');
    
    // Clear current registrations & expenses for the new meeting fresh start
    if (isFirebaseReady && db) {
      try {
        await db.ref('registrations').remove();
        await db.ref('expenses').remove();
      } catch (e) {}
    }
    localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify([]));
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify([]));
  }

  const newId = 'meeting_' + Date.now();
  const mDate = meetingData.meetingDate || meetingData.date || 'تاريخ يحدد لاحقاً';
  const newMeeting = {
    id: newId,
    title: meetingData.title || 'اجتماع جديد لأسرة الحميدان',
    meetingDate: mDate,
    date: mDate,
    venue: meetingData.venue || 'سيتم تحديد المقر لاحقاً',
    mapsUrl: meetingData.mapsUrl || '#',
    targetBudget: Number(meetingData.targetBudget) || 0,
    status: 'active',
    createdAt: timestamp,
    closedAt: null,
    closeNotes: '',
    feedback: '',
    adminNotes: meetingData.notes || ''
  };

  if (isFirebaseReady && db) {
    try {
      await db.ref(`meetings/${newId}`).set(newMeeting);
    } catch (e) {}
  }
  saveLocalMeeting(newMeeting);

  // Sync with global settings for visitor display
  const settings = getLocalSettings();
  const updatedSettings = {
    ...settings,
    meetingTitle: newMeeting.title,
    meetingDate: newMeeting.meetingDate,
    venue: newMeeting.venue,
    mapsUrl: newMeeting.mapsUrl
  };
  await apiUpdateSettings(updatedSettings);

  return newMeeting;
}

/**
 * Close and finalize meeting, computing its final feedback report
 */
async function apiCloseCurrentMeeting(meetingIdOrFeedback, feedbackNotes = "") {
  let meetingId = meetingIdOrFeedback;
  let closeNotes = feedbackNotes;
  
  if (typeof meetingIdOrFeedback === 'string' && !meetingIdOrFeedback.startsWith('meeting_')) {
    closeNotes = meetingIdOrFeedback;
    meetingId = null;
  }

  const meetings = getLocalMeetings();
  const meeting = (meetingId ? meetings.find(m => m.id === meetingId) : null) || apiGetActiveMeeting();
  if (!meeting) return null;

  const registrations = getLocalRegistrations();
  const expenses = getLocalExpenses();

  // Compute final financial stats
  let totalAttendees = 0;
  let totalTargetAmount = 0;
  let totalCollected = 0;
  let pendingAmount = 0;

  registrations.forEach(r => {
    const total = Number(r.totalAmount) || 0;
    const members = Number(r.totalMembers) || 0;
    totalAttendees += members;
    totalTargetAmount += total;

    if (r.status === 'paid') {
      totalCollected += total;
    } else if (r.status === 'partial') {
      const paid = Math.max(0, Math.min(total, Number(r.paidAmount) || 0));
      totalCollected += paid;
      pendingAmount += Math.max(0, total - paid);
    } else {
      pendingAmount += total;
    }
  });

  let totalExpenses = 0;
  expenses.forEach(e => {
    totalExpenses += (Number(e.amount) || 0);
  });

  const netBalance = totalCollected - totalExpenses;
  const collectionRate = totalTargetAmount > 0 
    ? Math.round((totalCollected / totalTargetAmount) * 100) 
    : 0;

  const summaryReport = {
    closedDate: new Date().toLocaleDateString('ar-SA'),
    closedTimestamp: new Date().toISOString(),
    totalFamilies: registrations.length,
    totalAttendees: totalAttendees,
    totalTargetAmount: totalTargetAmount,
    totalCollected: totalCollected,
    pendingAmount: pendingAmount,
    collectionRate: collectionRate,
    totalExpenses: totalExpenses,
    netBalance: netBalance,
    closeNotes: closeNotes,
    feedback: closeNotes,
    // Snapshots:
    expensesSnapshot: expenses,
    registrationsSnapshot: registrations,
    archivedRegistrations: registrations,
    archivedExpenses: expenses
  };

  meeting.status = 'closed';
  meeting.closedAt = new Date().toISOString();
  meeting.closeNotes = closeNotes;
  meeting.feedback = closeNotes;
  meeting.summary = summaryReport;
  meeting.summaryReport = summaryReport;
  meeting.archivedRegistrations = registrations;
  meeting.archivedExpenses = expenses;

  if (isFirebaseReady && db) {
    try {
      await db.ref(`meetings/${meeting.id}`).set(meeting);
    } catch (e) {}
  }
  saveLocalMeeting(meeting);

  return meeting;
}

/**
 * Re-open or set a meeting as active
 */
async function apiReopenMeeting(meetingId) {
  const meetings = getLocalMeetings();
  meetings.forEach(m => {
    if (m.id === meetingId) {
      m.status = 'active';
      m.closedAt = null;
    }
  });
  localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(meetings));

  const target = meetings.find(m => m.id === meetingId);
  if (target) {
    if (isFirebaseReady && db) {
      try {
        await db.ref(`meetings/${target.id}`).update({ status: 'active', closedAt: null });
      } catch (e) {}
    }
    // Sync settings
    const settings = getLocalSettings();
    await apiUpdateSettings({
      ...settings,
      meetingTitle: target.title,
      meetingDate: target.date,
      venue: target.venue,
      mapsUrl: target.mapsUrl
    });
  }
  return target;
}

// ==========================================
// Automated Messaging & WhatsApp / SMS Service
// ==========================================

const MessagingService = {
  cleanPhoneNumber(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/[^0-9]/g, '');
    if (p.startsWith('05')) {
      p = '966' + p.substring(1);
    } else if (p.startsWith('5')) {
      p = '966' + p;
    } else if (p.startsWith('00966')) {
      p = '966' + p.substring(5);
    } else if (p.startsWith('+966')) {
      p = '966' + p.substring(4);
    }
    return p;
  },

  formatLocalPhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/[^0-9]/g, '');
    if (p.startsWith('9665')) {
      return '05' + p.substring(4);
    }
    return p;
  },

  async send({ phone, message, settings = null }) {
    const config = (settings && settings.messaging) ? settings.messaging : (getLocalSettings().messaging || {});
    const cleanNum = this.cleanPhoneNumber(phone);
    if (!cleanNum) {
      return { success: false, error: 'رقم الجوال غير صحيح أو فارغ' };
    }

    const provider = config.provider || 'ultramsg';
    const token = (config.token || '').trim();
    const instanceId = (config.instanceId || '').trim();
    let endpoint = (config.endpoint || '').trim();

    if (!token && provider !== 'custom') {
      return { 
        success: false, 
        error: 'لم يتم حفظ مفتاح الربط (API Token). يرجى ضبط إعدادات بوابة الإرسال أولاً.' 
      };
    }

    try {
      if (provider === 'ultramsg') {
        const url = endpoint || `https://api.ultramsg.com/${instanceId}/messages/chat`;
        const bodyParams = new URLSearchParams({
          token: token,
          to: cleanNum,
          body: message
        });

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyParams.toString()
        });
        const data = await res.json();
        if (data.sent === 'true' || data.id || data.status === 'success') {
          return { success: true, data };
        } else {
          return { success: false, error: data.message || data.error || JSON.stringify(data) };
        }
      } 
      else if (provider === 'taqnyat') {
        const url = endpoint || 'https://api.taqnyat.sa/v1/messages';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            recipients: [cleanNum],
            sender: instanceId || 'AL-HUMAIDAN',
            body: message
          })
        });
        const data = await res.json();
        if (data.statusCode === 201 || data.statusCode === 200 || data.success) {
          return { success: true, data };
        } else {
          return { success: false, error: data.message || JSON.stringify(data) };
        }
      }
      else if (provider === '4jawaly') {
        const url = endpoint || 'https://api-sms.4jawaly.com/api/v1/account/area/sms/send';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            messages: [
              {
                text: message,
                numbers: [cleanNum],
                sender: instanceId || 'ALHUMAIDAN'
              }
            ]
          })
        });
        const data = await res.json();
        if (data.code === 200 || data.success) {
          return { success: true, data };
        } else {
          return { success: false, error: data.message || JSON.stringify(data) };
        }
      }
      else if (provider === 'wasapi') {
        const url = endpoint || 'https://api.wasapi.io/v1/messages';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: cleanNum,
            message: message
          })
        });
        const data = await res.json();
        if (res.ok) {
          return { success: true, data };
        } else {
          return { success: false, error: data.message || JSON.stringify(data) };
        }
      }
      else {
        const url = endpoint;
        if (!url) throw new Error('رابط الـ Webhook غير محدد');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          body: JSON.stringify({
            phone: cleanNum,
            message: message,
            sender: instanceId
          })
        });
        const data = await res.json().catch(() => ({}));
        return { success: res.ok, data };
      }
    } catch (err) {
      console.error('MessagingService error:', err);
      return { success: false, error: err.message || 'فشل الاتصال بخادم الرسائل' };
    }
  }
};

