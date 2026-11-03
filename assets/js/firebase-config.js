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

const defaultSettings = {
  bankName: "مصرف الراجحي",
  accountName: "صندوق عائلة الحميدان",
  iban: "SA4480000204608010123456",
  adminPin: "1448",
  meetingDate: "الخميس ١٤٤٨/٥/٤ هـ",
  venue: "قاعة غناتي",
  mapsUrl: "https://maps.app.goo.gl/ThDxkX43xCQwRuti7"
};

// ==========================================
// Registrations API
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
  return payload;
}

/**
 * Find registration by Name and PIN
 */
async function apiFindRegistration(name, pin) {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();

  // If no name or no pin provided, do not look up
  if (!cleanName || !cleanPin) {
    return null;
  }

  // Try Firebase first
  if (isFirebaseReady && db) {
    try {
      const snap = await db.ref('registrations').once('value');
      const val = snap.val();
      if (val) {
        for (const k in val) {
          const item = val[k];
          if (item.name && item.name.trim().toLowerCase() === cleanName && item.pin === cleanPin) {
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
  return localList.find(i => 
    i.name && i.name.trim().toLowerCase() === cleanName && i.pin === cleanPin
  ) || null;
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
 * Toggle Payment Status: 'paid' <-> 'pending'
 */
async function apiUpdatePaymentStatus(regId, newStatus, adminNotes = "") {
  const updatePayload = {
    status: newStatus,
    paidAt: newStatus === 'paid' ? new Date().toISOString() : null,
    adminNotes: adminNotes
  };

  if (isFirebaseReady && db) {
    try {
      await db.ref(`registrations/${regId}`).update(updatePayload);
    } catch (e) {
      console.warn("خطأ تحديث حالة السداد في فايربيس:", e);
    }
  }

  // Update local
  const list = getLocalRegistrations();
  const idx = list.findIndex(r => r.id === regId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updatePayload };
    localStorage.setItem(LOCAL_REGISTRATIONS_KEY, JSON.stringify(list));
  }
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
      { id: 'exp_1', title: 'عربون حجز قاعة غناتي', amount: 3500, category: 'venue', date: '1448/04/15' },
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
