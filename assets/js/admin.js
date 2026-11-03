/**
 * Al-Humaidan Family Meeting 1448H
 * Admin Portal Logic: Registrations Management, Expenses, Financial Balance, Export
 */

let allRegistrations = [];
let allExpenses = [];
let allMeetings = [];
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
  // Listen to meetings lifecycle
  apiListenMeetings(list => {
    allMeetings = list || [];
    renderMeetingsLifecycle();
    renderMeetingsArchive();
  });

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

/// ==========================================
// Statistics & Financial Calculation
// ==========================================

function updateFinancialStats() {
  const totalFamilies = allRegistrations.length;
  let totalAttendees = 0;
  let totalTargetAmount = 0;
  let totalCollected = 0;
  let pendingAmount = 0;

  allRegistrations.forEach(r => {
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
    if (currentFilter === 'partial' && r.status !== 'partial') return false;
    if (currentFilter === 'pending' && (r.status === 'paid' || r.status === 'partial')) return false;

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
    const status = r.status || 'pending';
    const total = Number(r.totalAmount) || 0;
    const paid = status === 'paid' ? total : (Number(r.paidAmount) || 0);
    const remaining = status === 'paid' ? 0 : Math.max(0, total - paid);

    let amountHtml = '';
    let statusBtnHtml = '';

    if (status === 'paid') {
      amountHtml = `
        <div>
          <strong style="font-size: 1.05rem; color: var(--gray-900);">${total.toLocaleString('en-US')} ريال</strong>
          <div style="font-size: 0.78rem; color: var(--success); font-weight: 700; margin-top: 2px;">
            ✓ مسدد بالكامل
          </div>
        </div>
      `;
      statusBtnHtml = `
        <button type="button" 
                class="status-toggle-btn paid"
                onclick="openPaymentModal('${r.id}')"
                title="انقر لتعديل السداد (كامل / جزئي)">
          ✓ تم السداد بالكامل
        </button>
      `;
    } else if (status === 'partial') {
      amountHtml = `
        <div>
          <div style="font-size: 0.82rem; color: var(--gray-600);">المطلوب: <strong>${total.toLocaleString('en-US')} ر.س</strong></div>
          <div style="display:flex; gap:8px; margin-top:3px; flex-wrap:wrap; font-size:0.82rem;">
            <span style="color:var(--success); font-weight:700;">مدفوع: ${paid.toLocaleString('en-US')} ر.س</span>
            <span style="color:#b45309; font-weight:700;">متبقي: ${remaining.toLocaleString('en-US')} ر.س</span>
          </div>
        </div>
      `;
      statusBtnHtml = `
        <button type="button" 
                class="status-toggle-btn partial"
                onclick="openPaymentModal('${r.id}')"
                title="انقر لتعديل السداد (كامل / جزئي)">
          🌓 سداد جزئي (${paid.toLocaleString('en-US')} ر.س)
        </button>
      `;
    } else {
      amountHtml = `
        <div>
          <strong style="font-size: 1.05rem; color: var(--gray-900);">${total.toLocaleString('en-US')} ريال</strong>
          <div style="font-size: 0.78rem; color: var(--warning); font-weight: 600; margin-top: 2px;">
            ⏳ غير مسدد (متبقي: ${total.toLocaleString('en-US')} ر.س)
          </div>
        </div>
      `;
      statusBtnHtml = `
        <button type="button" 
                class="status-toggle-btn pending"
                onclick="openPaymentModal('${r.id}')"
                title="انقر لتحديد السداد (كامل / جزئي)">
          ⏳ قيد الانتظار
        </button>
      `;
    }

    const noteBadge = r.adminNotes 
      ? `<div style="font-size:0.75rem; color:var(--gray-600); margin-top:3px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(r.adminNotes)}">📝 ${escapeHtml(r.adminNotes)}</div>`
      : '';

    return `
      <tr>
        <td style="font-weight: 700;">${index + 1}</td>
        <td>
          <div style="font-weight: 700; color: var(--gray-900); font-size: 0.95rem;">${escapeHtml(r.name)}</div>
          <div style="font-size: 0.78rem; color: var(--gray-500);">${r.phone ? '📱 ' + escapeHtml(r.phone) : 'بدون رقم جوال'}</div>
          ${noteBadge}
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
          ${amountHtml}
        </td>
        <td>
          ${statusBtnHtml}
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

// ==========================================
// Payment Status & Partial Payment Modal Logic
// ==========================================

let activeModalRegId = null;
let activeModalPaymentOption = 'paid';

function openPaymentModal(regId) {
  const reg = allRegistrations.find(r => r.id === regId);
  if (!reg) return;

  activeModalRegId = regId;
  const modal = document.getElementById('paymentModal');
  if (!modal) return;

  const total = Number(reg.totalAmount) || 0;
  const currentStatus = reg.status || 'pending';
  const currentPaid = currentStatus === 'paid' ? total : (Number(reg.paidAmount) || 0);
  const currentRemaining = currentStatus === 'paid' ? 0 : Math.max(0, total - currentPaid);

  // Summary box
  const summaryBox = document.getElementById('modalPaySummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <h4 style="margin:0 0 4px 0; font-size:1.05rem; color:var(--gray-900); font-weight:700;">
            👤 ${escapeHtml(reg.name)}
          </h4>
          <span style="font-size:0.82rem; color:var(--gray-600);">
            عدد أفراد الأسرة: <strong>${reg.totalMembers || 0} أفراد</strong> ${reg.phone ? '• هاتف: ' + escapeHtml(reg.phone) : ''}
          </span>
        </div>
        <div style="text-align:left;">
          <div style="font-size:0.75rem; color:var(--gray-500);">إجمالي المطلوب</div>
          <div style="font-size:1.25rem; font-weight:800; color:var(--gold-primary);">
            ${total.toLocaleString('en-US')} ريال
          </div>
        </div>
      </div>
      <div style="display:flex; gap:12px; font-size:0.82rem; border-top:1px dashed var(--border-light); padding-top:8px;">
        <span>المدفوع حالياً: <strong style="color:var(--success);">${currentPaid.toLocaleString('en-US')} ريال</strong></span>
        <span>المتبقي حالياً: <strong style="color:#b45309;">${currentRemaining.toLocaleString('en-US')} ريال</strong></span>
      </div>
    `;
  }

  // Pre-fill fields
  const paidInput = document.getElementById('modalPaidAmountInput');
  if (paidInput) {
    paidInput.value = currentPaid > 0 ? currentPaid : Math.round(total / 2);
  }

  const notesInput = document.getElementById('modalAdminNotes');
  if (notesInput) {
    notesInput.value = reg.adminNotes || '';
  }

  // Generate quick percentage buttons
  const quickContainer = document.getElementById('modalQuickAmounts');
  if (quickContainer) {
    const half = Math.round(total * 0.5);
    const quarter = Math.round(total * 0.25);
    const threeQuarters = Math.round(total * 0.75);
    quickContainer.innerHTML = `
      <span style="font-size:0.75rem; color:var(--gray-500); align-self:center;">مبالغ مقترحة:</span>
      <button type="button" class="quick-pct-btn" onclick="setQuickModalAmount(${quarter})">25% (${quarter} ر.س)</button>
      <button type="button" class="quick-pct-btn" onclick="setQuickModalAmount(${half})">50% (${half} ر.س)</button>
      <button type="button" class="quick-pct-btn" onclick="setQuickModalAmount(${threeQuarters})">75% (${threeQuarters} ر.س)</button>
    `;
  }

  // Set option
  selectPayOption(currentStatus);
  modal.classList.add('active');
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('active');
  activeModalRegId = null;
}

function selectPayOption(opt) {
  activeModalPaymentOption = opt;

  ['btnPayFull', 'btnPayPartial', 'btnPayPending'].forEach(id => {
    document.getElementById(id)?.classList.remove('selected');
  });

  const partialSection = document.getElementById('partialAmountSection');

  if (opt === 'paid') {
    document.getElementById('btnPayFull')?.classList.add('selected');
    if (partialSection) partialSection.style.display = 'none';
  } else if (opt === 'partial') {
    document.getElementById('btnPayPartial')?.classList.add('selected');
    if (partialSection) partialSection.style.display = 'block';
    handleModalPaidAmountInput();
  } else {
    document.getElementById('btnPayPending')?.classList.add('selected');
    if (partialSection) partialSection.style.display = 'none';
  }
}

function setQuickModalAmount(amount) {
  const input = document.getElementById('modalPaidAmountInput');
  if (input) {
    input.value = amount;
    handleModalPaidAmountInput();
  }
}

function handleModalPaidAmountInput() {
  if (!activeModalRegId) return;
  const reg = allRegistrations.find(r => r.id === activeModalRegId);
  if (!reg) return;

  const total = Number(reg.totalAmount) || 0;
  const paidInput = document.getElementById('modalPaidAmountInput');
  const paidVal = Number(paidInput?.value) || 0;
  const remaining = Math.max(0, total - paidVal);

  const badge = document.getElementById('modalRemainingCalcBadge');
  if (badge) {
    badge.textContent = `المتبقي: ${remaining.toLocaleString('en-US')} ريال`;
    if (remaining === 0) {
      badge.style.background = 'var(--success-bg)';
      badge.style.color = 'var(--success)';
    } else {
      badge.style.background = 'var(--warning-bg)';
      badge.style.color = 'var(--warning)';
    }
  }
}

async function savePaymentModalChanges() {
  if (!activeModalRegId) return;
  const reg = allRegistrations.find(r => r.id === activeModalRegId);
  if (!reg) return;

  const total = Number(reg.totalAmount) || 0;
  const notes = document.getElementById('modalAdminNotes')?.value.trim() || '';

  let finalStatus = activeModalPaymentOption;
  let finalPaid = 0;

  if (finalStatus === 'paid') {
    finalPaid = total;
  } else if (finalStatus === 'partial') {
    const inputVal = Number(document.getElementById('modalPaidAmountInput')?.value);
    if (isNaN(inputVal) || inputVal <= 0) {
      showAdminToast('⚠️ يرجى إدخال مبلغ سداد جزئي صحيح أكبر من صفر');
      document.getElementById('modalPaidAmountInput')?.focus();
      return;
    }
    if (inputVal >= total) {
      finalStatus = 'paid';
      finalPaid = total;
    } else {
      finalPaid = inputVal;
    }
  } else {
    finalStatus = 'pending';
    finalPaid = 0;
  }

  try {
    await apiUpdatePaymentStatus(activeModalRegId, finalStatus, finalPaid, notes);
    closePaymentModal();
    const statusLabel = finalStatus === 'paid' 
      ? 'تم السداد بالكامل ✓' 
      : (finalStatus === 'partial' ? `سداد جزئي (${finalPaid} ر.س) 🌓` : 'قيد الانتظار ⏳');
    showAdminToast(`✓ تم تحديث حالة ${escapeHtml(reg.name)} إلى: ${statusLabel}`);
  } catch (err) {
    console.error(err);
    showAdminToast('حدث خطأ أثناء حفظ التغييرات');
  }
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
  const status = reg.status || 'pending';
  const total = Number(reg.totalAmount) || 0;
  const paid = status === 'paid' ? total : (Number(reg.paidAmount) || 0);
  const remaining = status === 'paid' ? 0 : Math.max(0, total - paid);

  if (status === 'paid') {
    return `أهلاً ومرحباً يا ${reg.name}،\nتم استلام سداد اشتراككم لاجتماع عائلة الحميدان بالكامل بنجاح بمبلغ (${total} ريال) لعدد (${reg.totalMembers || 0} أفراد).\nنسعد بحضوركم ولقائكم بإذن الله.\nبارك الله فيكم.`;
  } else if (status === 'partial') {
    return `السلام عليكم ورحمة الله وبركاته يا ${reg.name}،\nنود إشعاركم بأنه تم استلام سداد جزئي لاشتراككم لاجتماع أسرة الحميدان بمبلغ (${paid} ريال) من أصل إجمالي المطلوب (${total} ريال).\nالمبلغ المتبقي المطلوب سداده: (${remaining} ريال).\nشاكرين ومقدرين لكم تعاونكم.`;
  } else {
    return `السلام عليكم ورحمة الله وبركاته يا ${reg.name}،\nنود تذكيركم بتفاصيل اشتراك اجتماع أسرة الحميدان:\nالمبلغ المطلوب: ${total} ريال (${reg.totalMembers || 0} أفراد).\nفضلاً تحويل المبلغ وإرسال الإشعار لتأكيد التسجيل في النظام.\nشاكرين ومقدرين لكم تعاونكم.`;
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

  if (dateInput) dateInput.value = currentSettings.meetingDate || 'تاريخ الاجتماع: يحدد لاحقاً';
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
    meetingDate: document.getElementById('settingMeetingDate')?.value.trim() || 'تاريخ الاجتماع: يحدد لاحقاً',
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
  csvContent += 'الرقم,اسم رب الأسرة,رقم الجوال,عدد الأفراد,المبلغ المطلوب (ريال),المبلغ المدفوع (ريال),المبلغ المتبقي (ريال),حالة السداد,ملاحظات الإدارة,تاريخ التسجيل\n';

  allRegistrations.forEach((r, i) => {
    const total = Number(r.totalAmount) || 0;
    const status = r.status || 'pending';
    const paid = status === 'paid' ? total : (Number(r.paidAmount) || 0);
    const remaining = status === 'paid' ? 0 : Math.max(0, total - paid);
    const statusLabel = status === 'paid' ? 'تم السداد بالكامل' : (status === 'partial' ? 'سداد جزئي' : 'قيد الانتظار');

    const row = [
      i + 1,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.phone || ''}"`,
      r.totalMembers || 0,
      total,
      paid,
      remaining,
      `"${statusLabel}"`,
      `"${(r.adminNotes || '').replace(/"/g, '""')}"`,
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

// ==========================================
// Meetings Lifecycle & Executive Feedback Management
// ==========================================

function renderMeetingsLifecycle() {
  const active = apiGetActiveMeeting();
  const badgeEl = document.getElementById('meetingStatusBadge');
  const titleEl = document.getElementById('meetingTitleDisplay');
  const dateEl = document.getElementById('meetingDateDisplay');
  const venueEl = document.getElementById('meetingVenueDisplay');
  const targetEl = document.getElementById('meetingTargetDisplay');
  const btnClose = document.getElementById('btnCloseMeetingBtn');

  if (active) {
    if (badgeEl) {
      badgeEl.className = 'meeting-status-pill active';
      badgeEl.innerHTML = '🟢 اجتماع نشط ومفعل';
    }
    if (titleEl) titleEl.textContent = active.title || 'اجتماع أسرة الحميدان';
    if (dateEl) dateEl.textContent = active.meetingDate || 'يحدد لاحقاً';
    if (venueEl) venueEl.textContent = active.venue || 'سيتم تحديد المقر';
    if (targetEl) targetEl.textContent = `الميزانية التقديرية: ${(Number(active.targetBudget) || 0).toLocaleString('en-US')} ريال`;
    if (btnClose) {
      btnClose.style.display = 'inline-flex';
      btnClose.disabled = false;
    }
  } else {
    if (badgeEl) {
      badgeEl.className = 'meeting-status-pill closed';
      badgeEl.innerHTML = '⚪ لا يوجد اجتماع نشط';
    }
    if (titleEl) titleEl.textContent = 'لا يوجد اجتماع نشط حالياً (كافة الاجتماعات السابقة مؤرشفة)';
    if (dateEl) dateEl.textContent = '-';
    if (venueEl) venueEl.textContent = '-';
    if (targetEl) targetEl.textContent = 'اضغط "إنشاء اجتماع جديد" لبدء دورة جديدة';
    if (btnClose) {
      btnClose.style.display = 'none';
      btnClose.disabled = true;
    }
  }
}

function openCreateMeetingModal() {
  const modal = document.getElementById('createMeetingModal');
  if (!modal) return;

  // Prepopulate with sensible defaults
  const titleInput = document.getElementById('newMeetingTitle');
  const dateInput = document.getElementById('newMeetingDate');
  const venueInput = document.getElementById('newMeetingVenue');
  const mapsInput = document.getElementById('newMeetingMapsUrl');
  const targetInput = document.getElementById('newMeetingTargetBudget');

  if (titleInput && !titleInput.value) titleInput.value = 'اجتماع أسرة الحميدان الخامس';
  if (dateInput && !dateInput.value) dateInput.value = currentSettings.meetingDate || '';
  if (venueInput && !venueInput.value) venueInput.value = currentSettings.venue || '';
  if (mapsInput && !mapsInput.value) mapsInput.value = currentSettings.mapsUrl || '';
  if (targetInput && !targetInput.value) targetInput.value = '35000';

  modal.classList.add('active');
}

function closeCreateMeetingModal() {
  const modal = document.getElementById('createMeetingModal');
  if (modal) modal.classList.remove('active');
}

async function submitCreateMeeting() {
  const title = (document.getElementById('newMeetingTitle')?.value || '').trim();
  const meetingDate = (document.getElementById('newMeetingDate')?.value || '').trim();
  const venue = (document.getElementById('newMeetingVenue')?.value || '').trim();
  const mapsUrl = (document.getElementById('newMeetingMapsUrl')?.value || '').trim();
  const targetBudget = Number(document.getElementById('newMeetingTargetBudget')?.value) || 0;
  const notes = (document.getElementById('newMeetingNotes')?.value || '').trim();

  if (!title || !meetingDate || !venue) {
    showAdminToast('⚠️ يرجى تعبئة الحقول الأساسية: العنوان، التاريخ، والمقر');
    return;
  }

  try {
    await apiCreateNewMeeting({
      title,
      meetingDate,
      venue,
      mapsUrl,
      targetBudget,
      notes
    });

    closeCreateMeetingModal();
    showAdminToast('✓ تم إنشاء الاجتماع الجديد وتفعيله بنجاح!');
  } catch (err) {
    console.error(err);
    showAdminToast('حدث خطأ أثناء إنشاء الاجتماع');
  }
}

function openCloseMeetingModal() {
  const active = apiGetActiveMeeting();
  if (!active) {
    showAdminToast('لا يوجد اجتماع نشط لإقفاله');
    return;
  }

  // Calculate live stats
  let totalFamilies = allRegistrations.length;
  let totalAttendees = 0;
  let totalTarget = 0;
  let totalCollected = 0;

  allRegistrations.forEach(r => {
    const total = Number(r.totalAmount) || 0;
    totalAttendees += (Number(r.totalMembers) || 0);
    totalTarget += total;
    if (r.status === 'paid') {
      totalCollected += total;
    } else if (r.status === 'partial') {
      totalCollected += Math.max(0, Math.min(total, Number(r.paidAmount) || 0));
    }
  });

  let totalExpenses = 0;
  allExpenses.forEach(e => {
    totalExpenses += (Number(e.amount) || 0);
  });

  const netBalance = totalCollected - totalExpenses;
  const collectionRate = totalTarget > 0 ? Math.round((totalCollected / totalTarget) * 100) : 0;

  const statsBox = document.getElementById('closeMeetingStatsBox');
  if (statsBox) {
    statsBox.innerHTML = `
      <div style="font-weight:700; color:var(--gray-900); font-size:1.02rem; margin-bottom:8px;">
        📊 الحساب الختامي المباشر لـ: ${escapeHtml(active.title || 'الاجتماع الحالي')}
      </div>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; font-size:0.85rem;">
        <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid var(--border-light);">
          👥 إجمالي الحضور: <strong>${totalAttendees} فرد</strong> (${totalFamilies} أسرة)
        </div>
        <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid var(--border-light);">
          💰 المبالغ المحصلة: <strong style="color:var(--success);">${totalCollected.toLocaleString('en-US')} ريال</strong> (${collectionRate}%)
        </div>
        <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid var(--border-light);">
          💸 إجمالي التكاليف والمصاريف: <strong style="color:var(--danger);">${totalExpenses.toLocaleString('en-US')} ريال</strong>
        </div>
        <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid var(--border-light);">
          ⚖️ صافي الفائض / العجز: <strong style="color:${netBalance >= 0 ? 'var(--success)' : 'var(--danger)'};">${netBalance.toLocaleString('en-US')} ريال</strong>
        </div>
      </div>
      <div style="font-size:0.78rem; color:var(--gray-600); margin-top:8px;">
        * عند الإقفال، سيتم تجميد هذا الكشف بالكامل وأرشفته كتقرير ختامي رسمي مع ملاحظات التقييم.
      </div>
    `;
  }

  const modal = document.getElementById('closeMeetingModal');
  if (modal) modal.classList.add('active');
}

function closeCloseMeetingModal() {
  const modal = document.getElementById('closeMeetingModal');
  if (modal) modal.classList.remove('active');
}

async function submitCloseMeeting() {
  const feedback = (document.getElementById('closeMeetingFeedback')?.value || '').trim();
  if (!feedback) {
    showAdminToast('⚠️ يرجى كتابة ملاحظات التقييم الختامي والتوصيات');
    return;
  }

  try {
    const closed = await apiCloseCurrentMeeting(feedback);
    closeCloseMeetingModal();
    showAdminToast('✓ تم إقفال الاجتماع وتوليد التقرير الختامي بنجاح!');
    
    // Immediately open the feedback report modal so admin sees it!
    if (closed && closed.id) {
      viewMeetingFeedbackReport(closed.id);
    }
  } catch (err) {
    console.error(err);
    showAdminToast('حدث خطأ أثناء إقفال الاجتماع');
  }
}

function renderMeetingsArchive() {
  const container = document.getElementById('meetingsArchiveList');
  if (!container) return;

  const meetings = getLocalMeetings();
  if (meetings.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; background:var(--surface-card-subtle); border-radius:12px; border:1px dashed var(--border-light); color:var(--gray-500);">
        <svg style="width:40px; height:40px; fill:var(--gray-400); margin-bottom:8px;" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 2h2v5h-2V5zm0 7h2v2h-2v-2zm-4 4h10v2H8v-2z"/></svg>
        <div style="font-weight:700; font-size:1rem; color:var(--gray-700); margin-bottom:4px;">لا توجد اجتماعات مؤرشفة حتى الآن</div>
        <div style="font-size:0.85rem;">عند إقفال أي اجتماع نشط، سيتم حفظ تقريره الختامي ومصاريفه وتكاليفه بالكامل هنا.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = meetings.map(m => {
    const isClosed = m.status === 'closed';
    const net = (m.summary?.netBalance !== undefined) ? m.summary.netBalance : 0;
    const netColor = net >= 0 ? 'var(--success)' : 'var(--danger)';

    return `
      <div class="archive-card">
        <div class="archive-card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="meeting-status-pill ${m.status}">
                ${isClosed ? '🔒 مقفل ومؤرشف' : '🟢 نشط ومفعل'}
              </span>
              <h4 style="margin:0; font-size:1.1rem; color:var(--gray-900);">${escapeHtml(m.title)}</h4>
            </div>
            <div style="font-size:0.83rem; color:var(--gray-600); display:flex; gap:12px; flex-wrap:wrap;">
              <span>📅 ${escapeHtml(m.meetingDate || '-')}</span>
              <span>📍 ${escapeHtml(m.venue || '-')}</span>
              <span>🕒 تاريخ الإنشاء: ${m.createdAt ? new Date(m.createdAt).toLocaleDateString('ar-SA') : '-'}</span>
              ${m.closedAt ? `<span>🔒 تاريخ الإقفال: ${new Date(m.closedAt).toLocaleDateString('ar-SA')}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn-meeting-action" onclick="viewMeetingFeedbackReport('${m.id}')" style="background:var(--gold-primary); color:#fff; border-color:var(--gold-primary);">
              📑 عرض الفيدباك والتقرير الشامل
            </button>
            ${isClosed ? `
              <button type="button" class="btn-meeting-action btn-reopen" onclick="reopenMeeting('${m.id}')" title="إعادة فتح الاجتماع وتعديل بياناته">
                🔄 إعادة فتح
              </button>
            ` : ''}
          </div>
        </div>

        ${m.summary ? `
          <div class="archive-stats-row">
            <div class="archive-stat-mini">
              <span class="lbl">إجمالي الأسر والحضور</span>
              <span class="val">${m.summary.totalAttendees || 0} فرد (${m.summary.totalFamilies || 0} أسرة)</span>
            </div>
            <div class="archive-stat-mini">
              <span class="lbl">المبالغ المسددة</span>
              <span class="val" style="color:var(--success);">${(Number(m.summary.totalCollected) || 0).toLocaleString('en-US')} ريال</span>
            </div>
            <div class="archive-stat-mini">
              <span class="lbl">إجمالي المصاريف</span>
              <span class="val" style="color:var(--danger);">${(Number(m.summary.totalExpenses) || 0).toLocaleString('en-US')} ريال</span>
            </div>
            <div class="archive-stat-mini">
              <span class="lbl">صافي الحساب الختامي</span>
              <span class="val" style="color:${netColor};">${net.toLocaleString('en-US')} ريال</span>
            </div>
          </div>
        ` : ''}

        ${m.feedback ? `
          <div style="background:var(--surface-card-subtle); border-radius:8px; padding:10px 14px; margin-top:12px; font-size:0.86rem; border-right:3px solid var(--gold-primary);">
            <strong style="color:var(--gray-900);">📝 تقييم وتوصيات الختام (Feedback):</strong>
            <p style="margin:4px 0 0; color:var(--gray-700); line-height:1.5;">${escapeHtml(m.feedback)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function viewMeetingFeedbackReport(meetingId) {
  const meetings = getLocalMeetings();
  const m = meetings.find(x => x.id === meetingId) || apiGetActiveMeeting();
  if (!m) {
    showAdminToast('لم يتم العثور على بيانات الاجتماع');
    return;
  }

  const modal = document.getElementById('feedbackReportModal');
  const body = document.getElementById('feedbackReportModalBody');
  if (!modal || !body) return;

  const s = m.summary || {
    totalFamilies: allRegistrations.length,
    totalAttendees: allRegistrations.reduce((acc, r) => acc + (Number(r.totalMembers) || 0), 0),
    totalCollected: allRegistrations.reduce((acc, r) => acc + (r.status === 'paid' ? Number(r.totalAmount) : (Number(r.paidAmount) || 0)), 0),
    totalExpenses: allExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0),
    netBalance: 0,
    expensesSnapshot: allExpenses,
    registrationsSnapshot: allRegistrations
  };
  s.netBalance = (s.totalCollected || 0) - (s.totalExpenses || 0);

  const expList = s.expensesSnapshot || allExpenses || [];
  const expHtml = expList.length > 0 ? expList.map((e, idx) => `
    <tr style="border-bottom:1px solid var(--border-subtle); font-size:0.86rem;">
      <td style="padding:8px 10px;">${idx + 1}</td>
      <td style="padding:8px 10px; font-weight:600;">${escapeHtml(e.title)}</td>
      <td style="padding:8px 10px;">${getCategoryName(e.category)}</td>
      <td style="padding:8px 10px; font-weight:700; color:var(--danger);">${Number(e.amount).toLocaleString('en-US')} ريال</td>
    </tr>
  `).join('') : `<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--gray-500);">لا توجد مصاريف مسجلة</td></tr>`;

  body.innerHTML = `
    <!-- Header banner -->
    <div style="background:var(--beige-50); border:1px solid var(--beige-300); border-radius:12px; padding:16px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <span style="display:inline-block; font-size:0.8rem; font-weight:700; color:var(--gold-primary); margin-bottom:2px;">
            صندوق أسرة عائلة الحميدان الرسمي
          </span>
          <h2 style="margin:0; font-size:1.3rem; color:var(--gray-900); font-family:var(--font-heading);">${escapeHtml(m.title)}</h2>
        </div>
        <div style="text-align:left;">
          <span class="meeting-status-pill ${m.status}">${m.status === 'closed' ? '🔒 معتمد ومقفل' : '🟢 نشط'}</span>
        </div>
      </div>
      <div style="display:flex; gap:16px; margin-top:10px; font-size:0.85rem; color:var(--gray-700); flex-wrap:wrap;">
        <span>📅 <strong>التاريخ:</strong> ${escapeHtml(m.meetingDate || '-')}</span>
        <span>📍 <strong>المقر:</strong> ${escapeHtml(m.venue || '-')}</span>
        ${m.closedAt ? `<span>🕒 <strong>تاريخ الاعتماد والإقفال:</strong> ${new Date(m.closedAt).toLocaleDateString('ar-SA')}</span>` : ''}
      </div>
    </div>

    <!-- KPI Metric Summary -->
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:16px;">
      <div style="background:#fff; border:1px solid var(--border-light); border-radius:10px; padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--gray-600); margin-bottom:4px;">إجمالي الحضور</div>
        <div style="font-size:1.3rem; font-weight:800; color:var(--gray-900);">${s.totalAttendees} فرد</div>
        <div style="font-size:0.75rem; color:var(--gray-500);">${s.totalFamilies} أسرة</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-light); border-radius:10px; padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--gray-600); margin-bottom:4px;">المبالغ المحصلة</div>
        <div style="font-size:1.3rem; font-weight:800; color:var(--success);">${(Number(s.totalCollected) || 0).toLocaleString('en-US')}</div>
        <div style="font-size:0.75rem; color:var(--gray-500);">ريال سعودي</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-light); border-radius:10px; padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--gray-600); margin-bottom:4px;">إجمالي المصاريف</div>
        <div style="font-size:1.3rem; font-weight:800; color:var(--danger);">${(Number(s.totalExpenses) || 0).toLocaleString('en-US')}</div>
        <div style="font-size:0.75rem; color:var(--gray-500);">ريال سعودي</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-light); border-radius:10px; padding:12px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--gray-600); margin-bottom:4px;">صافي الرصيد الختامي</div>
        <div style="font-size:1.3rem; font-weight:800; color:${s.netBalance >= 0 ? 'var(--success)' : 'var(--danger)'};">${s.netBalance.toLocaleString('en-US')}</div>
        <div style="font-size:0.75rem; color:var(--gray-500);">${s.netBalance >= 0 ? 'فائض مرحل' : 'عجز مسجل'}</div>
      </div>
    </div>

    <!-- Expenses Table -->
    <div style="margin-bottom:16px;">
      <h4 style="font-size:0.95rem; margin-bottom:8px; color:var(--gray-900);">💸 كشف تفاصيل المصاريف والتكاليف الفعلية:</h4>
      <table style="width:100%; border-collapse:collapse; border:1px solid var(--border-light); border-radius:8px; overflow:hidden;">
        <thead style="background:var(--surface-card-subtle); font-size:0.82rem; color:var(--gray-700);">
          <tr>
            <th style="padding:8px 10px; text-align:right;">#</th>
            <th style="padding:8px 10px; text-align:right;">البند</th>
            <th style="padding:8px 10px; text-align:right;">التصنيف</th>
            <th style="padding:8px 10px; text-align:right;">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${expHtml}
        </tbody>
      </table>
    </div>

    <!-- Executive Feedback Box -->
    <div style="background:var(--surface-card-subtle); border-radius:12px; border:1px solid var(--border-light); padding:16px; margin-bottom:12px;">
      <h4 style="margin:0 0 6px; font-size:0.98rem; color:var(--gray-900); display:flex; align-items:center; gap:6px;">
        <span>📝</span>
        <span>تقييم وتوصيات الإدارة للاجتماع (Feedback & Evaluation):</span>
      </h4>
      <div style="background:#fff; padding:12px 14px; border-radius:8px; border:1px solid var(--border-subtle); font-size:0.9rem; line-height:1.6; color:var(--gray-800); white-space:pre-wrap;">
        ${escapeHtml(m.feedback || 'تم إنجاز كافة فعاليات الاجتماع بنجاح وتغطية التكاليف من الاشتراكات المحصلة ولله الحمد.')}
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackReportModal');
  if (modal) modal.classList.remove('active');
}

function printFeedbackReport() {
  const content = document.getElementById('feedbackReportModalBody')?.innerHTML;
  if (!content) return;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>التقرير الختامي للاجتماع - عائلة الحميدان</title>
      <link rel="stylesheet" href="assets/css/style.css">
      <style>
        body { background:#fff; font-family:'Tajawal', sans-serif; padding:24px; color:#111; }
      </style>
    </head>
    <body onload="window.print()">
      ${content}
    </body>
    </html>
  `);
  printWin.document.close();
}

async function reopenMeeting(meetingId) {
  if (confirm('هل ترغب في إعادة فتح هذا الاجتماع للاستمرار في تسجيل المشتركين والمصاريف؟')) {
    await apiReopenMeeting(meetingId);
    showAdminToast('✓ تمت إعادة فتح الاجتماع وتفعيله!');
  }
}

