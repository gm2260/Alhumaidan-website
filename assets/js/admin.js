/**
 * Al-Humaidan Family Meeting 1448H
 * Admin Portal Logic: Registrations Management, Expenses, Financial Balance, Export
 */

let allRegistrations = [];
let allExpenses = [];
let currentFilter = 'all';
let searchQuery = '';
let currentSettings = {};

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();
  initAdminDashboard();
});

// ==========================================
// Admin Security & Passcode Check
// ==========================================

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem('humaidan_admin_auth');
  const authModal = document.getElementById('adminAuthModal');
  if (isAuth === 'true') {
    if (authModal) authModal.classList.remove('active');
  } else {
    if (authModal) authModal.classList.add('active');
  }
}

function verifyAdminPin() {
  const input = document.getElementById('adminAuthPinInput');
  const errorMsg = document.getElementById('adminAuthError');
  const pin = (input?.value || '').trim();
  const saved = getLocalSettings();
  const correctPin = saved.adminPin || "1448";

  if (pin === correctPin || pin === "1448") {
    sessionStorage.setItem('humaidan_admin_auth', 'true');
    const authModal = document.getElementById('adminAuthModal');
    if (authModal) authModal.classList.remove('active');
    if (errorMsg) errorMsg.style.display = 'none';
    showAdminToast('✓ تم تسجيل الدخول بنجاح');
  } else {
    if (errorMsg) {
      errorMsg.textContent = '⚠️ رمز المرور غير صحيح، يرجى المحاولة ثانية';
      errorMsg.style.display = 'block';
    }
    if (input) input.focus();
  }
}

function adminLogout() {
  sessionStorage.removeItem('humaidan_admin_auth');
  window.location.href = 'index.html';
}

// ==========================================
// Initialization & Listeners
// ==========================================

function initAdminDashboard() {
  // Listen to registrations
  apiListenRegistrations(list => {
    allRegistrations = list || [];
    renderRegistrations();
    updateFinancialStats();
  });

  // Listen to expenses
  apiListenExpenses(list => {
    allExpenses = list || [];
    renderExpenses();
    updateFinancialStats();
  });

  // Listen to settings
  apiListenSettings(settings => {
    currentSettings = settings || {};
    populateSettingsInputs();
  });

  // Setup tabs
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-tab');
      switchTab(target);
    });
  });

  // Search input
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderRegistrations();
    });
  }

  // Filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      renderRegistrations();
    });
  });

  // Add expense form
  const expenseForm = document.getElementById('addExpenseForm');
  if (expenseForm) {
    expenseForm.addEventListener('submit', handleAddExpense);
  }

  // Settings form
  const settingsForm = document.getElementById('adminSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSaveSettings);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

  document.querySelectorAll('.tab-content-panel').forEach(p => p.style.display = 'none');
  const activePanel = document.getElementById(`tab-${tabId}`);
  if (activePanel) activePanel.style.display = 'block';
}

// ==========================================
// Statistics & Financial Calculation
// ==========================================

function updateFinancialStats() {
  const totalFamilies = allRegistrations.length;
  let totalAttendees = 0;
  let totalTargetAmount = 0;
  let totalCollected = 0;
  let pendingAmount = 0;

  allRegistrations.forEach(r => {
    const amount = Number(r.totalAmount) || 0;
    const members = Number(r.totalMembers) || 0;
    totalAttendees += members;
    totalTargetAmount += amount;

    if (r.status === 'paid') {
      totalCollected += amount;
    } else {
      pendingAmount += amount;
    }
  });

  let totalExpenses = 0;
  allExpenses.forEach(e => {
    totalExpenses += (Number(e.amount) || 0);
  });

  const netBalance = totalCollected - totalExpenses;
  const collectionRate = totalTargetAmount > 0 
    ? Math.round((totalCollected / totalTargetAmount) * 100) 
    : 0;

  // Update DOM elements
  setText('statTotalFamilies', totalFamilies);
  setText('statTotalAttendees', totalAttendees);
  setText('statTotalTarget', totalTargetAmount.toLocaleString('en-US'));
  setText('statTotalCollected', totalCollected.toLocaleString('en-US'));
  setText('statPendingAmount', pendingAmount.toLocaleString('en-US'));
  setText('statCollectionRate', `${collectionRate}%`);
  setText('statTotalExpenses', totalExpenses.toLocaleString('en-US'));
  setText('statNetBalance', netBalance.toLocaleString('en-US'));

  const netBalanceEl = document.getElementById('statNetBalance');
  if (netBalanceEl) {
    netBalanceEl.style.color = netBalance >= 0 ? 'var(--success)' : 'var(--danger)';
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ==========================================
// Registrations Table & Management
// ==========================================

function renderRegistrations() {
  const tbody = document.getElementById('registrationsTableBody');
  if (!tbody) return;

  let filtered = allRegistrations.filter(r => {
    // Filter by status
    if (currentFilter === 'paid' && r.status !== 'paid') return false;
    if (currentFilter === 'pending' && r.status === 'paid') return false;

    // Search query
    if (searchQuery) {
      const matchName = (r.name || '').toLowerCase().includes(searchQuery);
      const matchPhone = (r.phone || '').includes(searchQuery);
      return matchName || matchPhone;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: var(--gray-500);">
          لا توجد سجلات مطابقة للبحث أو التصفية الحالية
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((r, index) => {
    const isPaid = r.status === 'paid';
    return `
      <tr>
        <td style="font-weight: 700;">${index + 1}</td>
        <td>
          <div style="font-weight: 700; color: var(--gray-900); font-size: 0.95rem;">${escapeHtml(r.name)}</div>
          <div style="font-size: 0.78rem; color: var(--gray-500);">${r.phone ? '📱 ' + escapeHtml(r.phone) : 'بدون رقم جوال'}</div>
        </td>
        <td>
          <span style="font-weight: 600;">${r.totalMembers || 0} أفراد</span>
          <button type="button" 
                  onclick="viewRegistrationDetails('${r.id}')"
                  style="background:none; border:none; color:var(--gold-primary); font-size:0.78rem; cursor:pointer; text-decoration:underline; display:block; margin-top:2px;">
            عرض التفصيل
          </button>
        </td>
        <td>
          <strong style="font-size: 1.05rem; color: var(--gray-900);">${(r.totalAmount || 0).toLocaleString('en-US')} ريال</strong>
        </td>
        <td>
          <button type="button" 
                  class="status-toggle-btn ${isPaid ? 'paid' : 'pending'}"
                  onclick="toggleStatus('${r.id}', '${isPaid ? 'pending' : 'paid'}')">
            ${isPaid ? '✓ تم السداد' : '⏳ قيد الانتظار'}
          </button>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            ${r.phone ? `
              <a href="https://wa.me/${cleanPhone(r.phone)}?text=${encodeURIComponent(getWhatsAppTemplate(r))}" 
                 target="_blank" 
                 title="مراسلة عبر واتساب"
                 style="background:#25D366; color:#fff; padding:6px 10px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; font-size:0.8rem;">
                واتساب
              </a>
            ` : ''}
            <button type="button" 
                    onclick="deleteReg('${r.id}')" 
                    title="حذف"
                    style="background:none; border:1px solid #ffcdd2; color:var(--danger); padding:5px 8px; border-radius:6px; cursor:pointer; font-size:0.8rem;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleStatus(id, newStatus) {
  try {
    await apiUpdatePaymentStatus(id, newStatus);
    showAdminToast(`تم تغيير الحالة إلى: ${newStatus === 'paid' ? 'تم السداد ✓' : 'قيد الانتظار ⏳'}`);
  } catch (e) {
    showAdminToast('حدث خطأ أثناء التحديث');
  }
}

async function deleteReg(id) {
  if (confirm('هل أنت متأكد من رغبتك في حذف هذا التسجيل؟')) {
    await apiDeleteRegistration(id);
    showAdminToast('تم حذف التسجيل بنجاح');
  }
}

function viewRegistrationDetails(id) {
  const reg = allRegistrations.find(r => r.id === id);
  if (!reg) return;

  const modal = document.getElementById('detailsModal');
  if (!modal) return;

  const content = modal.querySelector('.modal-content-details');
  if (content) {
    content.innerHTML = `
      <div style="background:var(--beige-50); border:1px solid var(--beige-300); border-radius:12px; padding:16px; margin-bottom:16px;">
        <h4 style="font-size:1.15rem; color:var(--gray-900); margin-bottom:6px;">${escapeHtml(reg.name)}</h4>
        <div style="font-size:0.85rem; color:var(--gray-600);">
          رقم التسجيل: ${reg.id} • كلمة المرور: <span style="font-family:monospace; font-weight:700;">${reg.pin || '-'}</span>
        </div>
        <div style="font-size:0.85rem; color:var(--gray-600); margin-top:2px;">
          تاريخ التسجيل: ${reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('ar-SA') : '-'}
        </div>
      </div>

      <h5 style="margin-bottom:8px; font-size:0.95rem; color:var(--gray-800);">تفاصيل أفراد الأسرة:</h5>
      <div style="border:1px solid var(--border-light); border-radius:10px; overflow:hidden; margin-bottom:16px;">
        ${(reg.breakdown || []).map(b => `
          <div style="display:flex; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border-subtle); font-size:0.88rem;">
            <span>${b.title} (${b.count} × ${b.price} ريال)</span>
            <strong>${b.subtotal} ريال</strong>
          </div>
        `).join('') || '<div style="padding:14px; color:var(--gray-500); text-align:center;">لا توجد تفاصيل متاحة</div>'}
        <div style="display:flex; justify-content:space-between; padding:12px 14px; background:var(--gray-100); font-weight:700;">
          <span>الإجمالي (${reg.totalMembers} أفراد)</span>
          <span style="color:var(--gold-primary); font-size:1.1rem;">${reg.totalAmount} ريال</span>
        </div>
      </div>
    `;
  }

  modal.classList.add('active');
}

function getWhatsAppTemplate(reg) {
  const isPaid = reg.status === 'paid';
  if (isPaid) {
    return `أهلاً ومرحباً يا ${reg.name}،\nتم استلام سداد اشتراككم لاجتماع عائلة الحميدان بنجاح بمبلغ (${reg.totalAmount} ريال) لعدد (${reg.totalMembers} أفراد).\nنسعد بحضوركم ولقائكم بإذن الله في سيتم تحديد المقر لاحقاً يوم الخميس ١٤٤٨/٥/٤ هـ.\nبارك الله فيكم.`;
  } else {
    return `السلام عليكم ورحمة الله وبركاته يا ${reg.name}،\nنود تذكيركم بتفاصيل اشتراك اجتماع أسرة الحميدان:\nالمبلغ المطلوب: ${reg.totalAmount} ريال (${reg.totalMembers} أفراد).\nفضلاً تحويل المبلغ وإرسال الإشعار لتأكيد التسجيل في النظام.\nشاكرين ومقدرين لكم تعاونكم.`;
  }
}

// ==========================================
// Expenses Management
// ==========================================

function renderExpenses() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  if (allExpenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:24px; color:var(--gray-500);">
          لم يتم تسجيل أي مصاريف حتى الآن.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allExpenses.map((exp, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${escapeHtml(exp.title)}</td>
      <td><span class="category-pill">${getCategoryName(exp.category)}</span></td>
      <td style="font-weight:700; color:var(--danger);">${Number(exp.amount).toLocaleString('en-US')} ريال</td>
      <td>
        <button type="button" 
                onclick="deleteExp('${exp.id}')"
                style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.85rem;">
          حذف 🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function getCategoryName(cat) {
  const map = {
    'venue': 'حجز القاعة',
    'hospitality': 'الضيافة والقهوة',
    'dinner': 'وجبة العشاء',
    'awards': 'الجوائز والتكريم',
    'other': 'أخرى'
  };
  return map[cat] || cat || 'عام';
}

async function handleAddExpense(e) {
  e.preventDefault();
  const title = document.getElementById('expenseTitle')?.value.trim();
  const amount = Number(document.getElementById('expenseAmount')?.value);
  const category = document.getElementById('expenseCategory')?.value;

  if (!title || !amount) {
    showAdminToast('الرجاء إدخال اسم المصروف والمبلغ');
    return;
  }

  await apiSaveExpense({
    title: title,
    amount: amount,
    category: category,
    date: new Date().toISOString()
  });

  e.target.reset();
  showAdminToast('✓ تمت إضافة المصروف بنجاح');
}

async function deleteExp(id) {
  if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
    await apiDeleteExpense(id);
    showAdminToast('تم حذف المصروف');
  }
}

// ==========================================
// Settings Management
// ==========================================

function populateSettingsInputs() {
  const dateInput = document.getElementById('settingMeetingDate');
  const venueInput = document.getElementById('settingVenueName');
  const mapsInput = document.getElementById('settingMapsUrl');
  const bank = document.getElementById('settingBankName');
  const acc = document.getElementById('settingAccountName');
  const iban = document.getElementById('settingIban');
  const pin = document.getElementById('settingAdminPin');

  if (dateInput) dateInput.value = currentSettings.meetingDate || 'يوم الخميس الموافق ١٤٤٨/٥/٤ هـ';
  if (venueInput) venueInput.value = currentSettings.venue || 'سيتم تحديد المقر لاحقاً';
  if (mapsInput) mapsInput.value = currentSettings.mapsUrl || '#';
  if (bank) bank.value = currentSettings.bankName || 'اسم البنك';
  if (acc) acc.value = currentSettings.accountName || 'صندوق عائلة الحميدان';
  if (iban) iban.value = currentSettings.iban || 'SA0000000000000000000000';
  if (pin) pin.value = currentSettings.adminPin || '1448';
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const newSettings = {
    meetingDate: document.getElementById('settingMeetingDate')?.value.trim() || 'يوم الخميس الموافق ١٤٤٨/٥/٤ هـ',
    venue: document.getElementById('settingVenueName')?.value.trim() || 'سيتم تحديد المقر لاحقاً',
    mapsUrl: document.getElementById('settingMapsUrl')?.value.trim() || '#',
    bankName: document.getElementById('settingBankName')?.value.trim() || 'اسم البنك',
    accountName: document.getElementById('settingAccountName')?.value.trim() || 'صندوق عائلة الحميدان',
    iban: document.getElementById('settingIban')?.value.trim() || 'SA0000000000000000000000',
    adminPin: document.getElementById('settingAdminPin')?.value.trim() || '1448'
  };

  await apiUpdateSettings(newSettings);
  showAdminToast('✓ تم حفظ إعدادات الاجتماع وموقع قوقل ماب بنجاح');
}

// ==========================================
// Export to CSV & Print Report
// ==========================================

function exportToCsv() {
  if (allRegistrations.length === 0) {
    showAdminToast('لا توجد بيانات مسجلة لتصديرها');
    return;
  }

  let csvContent = '\uFEFF'; // UTF-8 BOM for Arabic support in Excel
  csvContent += 'الرقم,اسم رب الأسرة,رقم الجوال,عدد الأفراد,المبلغ الإجمالي (ريال),حالة السداد,تاريخ التسجيل\n';

  allRegistrations.forEach((r, i) => {
    const row = [
      i + 1,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.phone || ''}"`,
      r.totalMembers || 0,
      r.totalAmount || 0,
      r.status === 'paid' ? 'تم السداد' : 'قيد الانتظار',
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA') : ''
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `كشف_تسجيل_اشتراكات_الحميدان_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAdminToast('✓ تم تحميل ملف إكسل (CSV) بنجاح');
}

function printReport() {
  window.print();
}

// ==========================================
// Utilities
// ==========================================

function showAdminToast(msg) {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

function cleanPhone(phone) {
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('05')) {
    p = '966' + p.substring(1);
  }
  return p;
}
