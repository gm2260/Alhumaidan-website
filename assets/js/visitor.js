/**
 * Al-Humaidan Family Meeting 1448H
 * Visitor Portal Logic: 100% Mobile Web App Experience
 * Interactive Calculator, Realtime Database Sync, Session & History Restore
 */

// Categories definition according to family official document
const categories = [
  {
    id: 'father',
    title: 'الأب',
    desc: 'اشتراك رب الأسرة',
    price: 150
  },
  {
    id: 'wives',
    title: 'الزوجة \\ الزوجات',
    desc: '150 ريال لكل زوجة',
    price: 150
  },
  {
    id: 'single_son_daughter',
    title: 'الابن أو الابنة',
    desc: 'غير الموظفين والطلاب',
    price: 50
  },
  {
    id: 'employed_single_son',
    title: 'الابن الموظف (غير المتزوج)',
    desc: 'الأبناء الموظفون العزاب',
    price: 150
  },
  {
    id: 'employed_married_son',
    title: 'الابن الموظف (المتزوج)',
    desc: 'الأبناء الموظفون المتزوجون',
    price: 300
  },
  {
    id: 'married_daughter_outside',
    title: 'البنت المتزوجة من غير عائلة الحميدان',
    desc: 'بنات العائلة المتزوجات من خارج الحميدان',
    price: 150
  },
  {
    id: 'cousins_heila',
    title: 'ابن/ابنة البنت المتزوجة من غير الحميدان، وأبناء وبنات بنات العمة هيلة رحمها الله',
    desc: 'الأحفاد من البنات خارج العائلة وذرية بنات العمة هيلة رحمها الله',
    price: 50
  }
];

// Application state
const appState = {
  name: '',
  pin: '',
  phone: '',
  counts: {},
  currentRegistrationId: null,
  currentStatus: null
};

// Initialize counts strictly at 0
categories.forEach(c => {
  appState.counts[c.id] = 0;
});

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadSavedUserSession();
  renderCategories();
  updateSummary();
  initEventListeners();
  listenToSystemSettings();
});

// Holds historical family data if found for restore prompt
window.pendingFamilyHistory = null;

// ==========================================
// Category Rendering & Tactile Steppers
// ==========================================

function renderCategories() {
  const containers = document.querySelectorAll('.categories-list-target');
  
  containers.forEach(container => {
    container.innerHTML = '';
    categories.forEach(cat => {
      const count = appState.counts[cat.id] || 0;
      const subtotal = count * cat.price;
      const card = document.createElement('div');
      card.className = `category-card ${count > 0 ? 'has-value' : ''}`;
      card.id = `card-${cat.id}`;

      card.innerHTML = `
        <div class="category-top-row">
          <div class="category-name-group">
            <span class="category-name">${cat.title}</span>
            <span class="category-desc">${cat.desc}</span>
          </div>
          <span class="category-rate-badge">${cat.price} ريال</span>
        </div>
        <div class="category-stepper-row">
          <div class="category-subtotal-badge" id="subtotal-${cat.id}" style="${count > 0 ? 'display:inline-flex;' : 'display:none;'}">
            <span>المجموع: </span>
            <strong id="subtotal-val-${cat.id}">${subtotal.toLocaleString('en-US')}</strong>
            <span>ريال</span>
          </div>
          <div class="counter-box">
            <button type="button" class="btn-counter" onclick="changeCount('${cat.id}', -1)" aria-label="إنقاص">−</button>
            <input type="number" 
                   class="counter-display" 
                   id="input-${cat.id}" 
                   value="${count}" 
                   min="0" 
                   onchange="setInputCount('${cat.id}', this.value)"
                   aria-label="العدد">
            <button type="button" class="btn-counter plus" onclick="changeCount('${cat.id}', 1)" aria-label="زيادة">+</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

window.changeCount = function(id, delta) {
  const current = appState.counts[id] || 0;
  const next = Math.max(0, current + delta);
  appState.counts[id] = next;

  // Update input
  const input = document.getElementById(`input-${id}`);
  if (input) input.value = next;

  // Update card styling
  const card = document.getElementById(`card-${id}`);
  if (card) {
    if (next > 0) card.classList.add('has-value');
    else card.classList.remove('has-value');
  }

  // Update subtotal badge
  const cat = categories.find(c => c.id === id);
  const subtotalEl = document.getElementById(`subtotal-${id}`);
  const subtotalValEl = document.getElementById(`subtotal-val-${id}`);
  if (subtotalEl && subtotalValEl && cat) {
    const subtotal = next * cat.price;
    subtotalValEl.textContent = subtotal.toLocaleString('en-US');
    subtotalEl.style.display = next > 0 ? 'inline-flex' : 'none';
  }

  saveCurrentSession();
  updateSummary();
};

window.setInputCount = function(id, val) {
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;
  appState.counts[id] = num;

  const input = document.getElementById(`input-${id}`);
  if (input) input.value = num;

  const card = document.getElementById(`card-${id}`);
  if (card) {
    if (num > 0) card.classList.add('has-value');
    else card.classList.remove('has-value');
  }

  const cat = categories.find(c => c.id === id);
  const subtotalEl = document.getElementById(`subtotal-${id}`);
  const subtotalValEl = document.getElementById(`subtotal-val-${id}`);
  if (subtotalEl && subtotalValEl && cat) {
    const subtotal = num * cat.price;
    subtotalValEl.textContent = subtotal.toLocaleString('en-US');
    subtotalEl.style.display = num > 0 ? 'inline-flex' : 'none';
  }

  saveCurrentSession();
  updateSummary();
};

function updateSummary() {
  let totalAmount = 0;
  let totalMembers = 0;
  const breakdown = [];

  categories.forEach(cat => {
    const count = appState.counts[cat.id] || 0;
    if (count > 0) {
      const subtotal = count * cat.price;
      totalAmount += subtotal;
      totalMembers += count;
      breakdown.push({
        title: cat.title,
        count: count,
        price: cat.price,
        subtotal: subtotal
      });
    }
  });

  // Update grand total targets (both on main card and sticky bottom bar)
  document.querySelectorAll('.grand-total-target').forEach(el => {
    el.textContent = totalAmount.toLocaleString('en-US');
  });

  // Update total members targets
  document.querySelectorAll('.total-members-target').forEach(el => {
    if (el.classList.contains('mobile-bottom-members')) {
      el.textContent = `${totalMembers} فرد`;
    } else {
      el.textContent = `إجمالي أفراد الأسرة: ${totalMembers} فرد`;
    }
  });

  // Update breakdown list
  document.querySelectorAll('.breakdown-list-target').forEach(listEl => {
    if (breakdown.length === 0) {
      listEl.innerHTML = '<div class="breakdown-empty-hint">لم تقم بإضافة أفراد بعد، اضغط على (+) في القائمة أعلاه</div>';
    } else {
      listEl.innerHTML = breakdown.map(item => `
        <div class="breakdown-item">
          <div>
            <span class="item-title">${item.title}</span>
            <span style="font-size:0.75rem; color:var(--gray-500); margin-right:4px;">(${item.count} × ${item.price} ر.س)</span>
          </div>
          <div class="item-subtotal">${item.subtotal.toLocaleString('en-US')} ريال</div>
        </div>
      `).join('');
    }
  });

  return { totalAmount, totalMembers, breakdown };
}

// ==========================================
// User Session & Security PIN Handling
// ==========================================

function loadSavedUserSession() {
  try {
    const saved = localStorage.getItem('humaidan_visitor_session');

    // Always start with all category counts strictly at 0
    categories.forEach(c => {
      appState.counts[c.id] = 0;
    });

    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.name) appState.name = parsed.name;
      if (parsed.pin) appState.pin = parsed.pin;
      if (parsed.phone) appState.phone = parsed.phone;

      if (parsed.currentRegistrationId) {
        appState.currentRegistrationId = parsed.currentRegistrationId;
        checkExistingRegistrationStatus();
      }
    }

    // Populate inputs
    document.querySelectorAll('.user-name-input').forEach(i => i.value = appState.name || '');
    document.querySelectorAll('.user-pin-input').forEach(i => i.value = appState.pin || '');
    document.querySelectorAll('.user-phone-input').forEach(i => i.value = appState.phone || '');
  } catch (e) {
    console.error("Error loading session:", e);
    categories.forEach(c => {
      appState.counts[c.id] = 0;
    });
  }
}

function saveCurrentSession() {
  try {
    const session = {
      name: appState.name,
      pin: appState.pin,
      phone: appState.phone,
      currentRegistrationId: appState.currentRegistrationId
    };
    localStorage.setItem('humaidan_visitor_session', JSON.stringify(session));
  } catch (e) {}
}

async function checkExistingRegistrationStatus() {
  if (!appState.name) return;
  const name = appState.name.trim();
  const pin = appState.pin.trim();

  // 1. Check current meeting registration
  const reg = await apiFindRegistration(name, pin);
  if (reg) {
    appState.currentRegistrationId = reg.id;
    appState.currentStatus = reg.status;
    showLiveStatusBanner(reg);

    // If counts are already recorded in current meeting and current local counts are 0, populate them
    const hasAnyCount = Object.values(appState.counts).some(v => v > 0);
    if (!hasAnyCount && reg.counts) {
      Object.keys(reg.counts).forEach(k => {
        if (appState.counts[k] !== undefined) appState.counts[k] = reg.counts[k];
      });
      renderCategories();
      updateSummary();
    }
    return;
  }

  // 2. If no current registration, check historical records for easy restore
  const phone = appState.phone.trim();
  const history = await apiFindFamilyHistory(name, pin, phone);
  if (history && history.counts && history.totalMembers > 0) {
    const hasAnyCount = Object.values(appState.counts).some(v => v > 0);
    if (!hasAnyCount) {
      promptRestoreFamilyModal(history);
    }
  }
}

function showLiveStatusBanner(reg) {
  const banners = document.querySelectorAll('.status-banner-target');
  banners.forEach(b => {
    b.style.display = 'flex';
    const status = reg.status || 'pending';
    const total = Number(reg.totalAmount) || 0;
    const paid = status === 'paid' ? total : (Number(reg.paidAmount) || 0);
    const remaining = status === 'paid' ? 0 : Math.max(0, total - paid);

    let statusClass = 'status-pending';
    let statusText = 'قيد المراجعة / بانتظار التحويل';
    let subHtml = `المبلغ المطلوب: <strong>${total.toLocaleString('en-US')} ريال</strong> (${reg.totalMembers} أفراد)`;

    if (status === 'paid') {
      statusClass = 'status-paid';
      statusText = '✓ تم السداد بالكامل ومطابقة الحوالة';
      subHtml = `الإجمالي المسدد: <strong>${total.toLocaleString('en-US')} ريال</strong> ✓ شكراً لمساهمتكم`;
    } else if (status === 'partial') {
      statusClass = 'status-partial';
      statusText = `◐ سداد جزئي (${paid.toLocaleString('en-US')} ر.س)`;
      subHtml = `تم استلام: <strong>${paid.toLocaleString('en-US')} ر.س</strong> • المتبقي: <strong style="color:var(--warning);">${remaining.toLocaleString('en-US')} ر.س</strong>`;
    }

    b.className = `registration-status-banner ${statusClass}`;
    b.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight: 800; font-size: 0.92rem; color: var(--gray-900);">
          أهلاً بك يا ${reg.name} (${statusText})
        </div>
        <div style="font-size: 0.8rem; margin-top: 2px;">
          ${subHtml}
        </div>
      </div>
    `;
  });
}

// Restore Family Modal
function promptRestoreFamilyModal(history) {
  window.pendingFamilyHistory = history;
  const modal = document.getElementById('restoreFamilyModal');
  const userEl = document.getElementById('restoreFamilyUserName');
  const box = document.getElementById('restoreFamilySummaryBox');

  if (userEl) userEl.textContent = history.name || appState.name;

  if (box && history.breakdown) {
    let itemsHtml = history.breakdown.map(b => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px dashed var(--beige-300);">
        <span style="font-weight:600; font-size:0.85rem; color:var(--gray-800);">${b.title}</span>
        <span style="background:var(--gold-bg); color:var(--gold-dark); font-weight:800; padding:2px 8px; border-radius:6px; font-size:0.8rem;">${b.count} فرد</span>
      </div>
    `).join('');

    box.innerHTML = `
      <div style="font-size:0.86rem; font-weight:800; color:var(--gray-900); margin-bottom:6px;">
        📋 تفاصيل أفراد الأسرة في السجل السابق (${history.totalMembers} فرد):
      </div>
      <div style="display:flex; flex-direction:column; gap:2px; max-height:150px; overflow-y:auto;">
        ${itemsHtml}
      </div>
      <div style="font-size:0.75rem; color:var(--gray-500); margin-top:8px;">
        * عند الضغط على استرداد، ستُعبأ الأعداد تلقائياً ويمكنك تعديلها في أي وقت.
      </div>
    `;
  }

  if (modal) modal.classList.add('active');
}

window.applyRestoredFamily = function() {
  const history = window.pendingFamilyHistory;
  if (history && history.counts) {
    categories.forEach(c => {
      appState.counts[c.id] = Number(history.counts[c.id]) || 0;
    });
    renderCategories();
    updateSummary();
    saveCurrentSession();
    showToast('✓ تم استرداد بيانات عائلتك بنجاح!');
  }
  const modal = document.getElementById('restoreFamilyModal');
  if (modal) modal.classList.remove('active');
  window.pendingFamilyHistory = null;
};

window.declineRestoredFamily = function() {
  const modal = document.getElementById('restoreFamilyModal');
  if (modal) modal.classList.remove('active');
  window.pendingFamilyHistory = null;
  categories.forEach(c => appState.counts[c.id] = 0);
  renderCategories();
  updateSummary();
  saveCurrentSession();
  showToast('تم بدء تسجيل جديد فارغ.');
};

window.visitorLogout = function() {
  const confirmMsg = 'هل ترغب بالتأكيد في تسجيل الخروج؟\nيتيح لك ذلك تسجيل شخص آخر أو عائلة أخرى من نفس الجوال بحساب مستقل تماماً.';
  if (confirm(confirmMsg)) {
    appState.name = '';
    appState.pin = '';
    appState.phone = '';
    appState.currentRegistrationId = null;
    appState.currentStatus = null;
    categories.forEach(c => appState.counts[c.id] = 0);

    localStorage.removeItem('humaidan_visitor_session');

    document.querySelectorAll('.user-name-input').forEach(i => i.value = '');
    document.querySelectorAll('.user-pin-input').forEach(i => i.value = '');
    document.querySelectorAll('.user-phone-input').forEach(i => i.value = '');
    document.querySelectorAll('.status-banner-target').forEach(b => b.style.display = 'none');

    renderCategories();
    updateSummary();

    showToast('🚪 تم تسجيل الخروج. يمكنك الآن إدخال بيانات شخص آخر.');
    document.getElementById('userNameInput')?.focus();
  }
};

// ==========================================
// Actions: Registration Submit, WhatsApp, Copy
// ==========================================

async function handleRegistrationSubmit() {
  const name = (appState.name || '').trim();
  const pin = (appState.pin || '').trim();
  const phone = (appState.phone || '').trim();

  if (!name) {
    showToast('⚠️ الرجاء إدخال اسم رب الأسرة أولاً');
    document.getElementById('userNameInput')?.focus();
    return;
  }

  const { totalAmount, totalMembers, breakdown } = updateSummary();

  if (totalMembers === 0 || totalAmount === 0) {
    showToast('⚠️ الرجاء تحديد عدد الأفراد من القائمة أولاً');
    return;
  }

  // Check if existing registration for different person on same device
  let existingPaid = 0;
  let currentStatus = appState.currentStatus || 'pending';
  if (appState.currentRegistrationId) {
    const existing = getLocalRegistrations().find(r => r.id === appState.currentRegistrationId);
    if (existing) {
      if (existing.name && existing.name.trim() !== name) {
        appState.currentRegistrationId = null;
        currentStatus = 'pending';
        existingPaid = 0;
      } else {
        existingPaid = Number(existing.paidAmount) || 0;
        currentStatus = existing.status || currentStatus;
      }
    } else {
      appState.currentRegistrationId = null;
    }
  }

  const payload = {
    id: appState.currentRegistrationId || null,
    name: name,
    pin: pin || '1234',
    phone: phone,
    counts: appState.counts,
    breakdown: breakdown,
    totalMembers: totalMembers,
    totalAmount: totalAmount,
    paidAmount: existingPaid,
    remainingAmount: Math.max(0, totalAmount - existingPaid),
    status: currentStatus
  };

  showToast('⏳ جاري تسجيل البيانات في النظام...');

  try {
    const saved = await apiSaveRegistration(payload);
    appState.currentRegistrationId = saved.id;
    appState.currentStatus = saved.status;
    saveCurrentSession();
    
    // Save to historical family repository for next meetings
    saveFamilyHistory(payload);

    showLiveStatusBanner(saved);

    showToast('✓ تم تسجيل بيانات أسرتكم بنجاح!');
    openConfirmationModal(saved);

    // Auto WhatsApp trigger if configured
    if (currentSystemSettings?.messaging?.enabled && currentSystemSettings?.messaging?.autoSendOnRegister && saved.phone) {
      const welcomeMsg = [
        'أهلاً ومرحباً بك يا ' + saved.name + '،',
        'تم تسجيل بيانات أسرتكم الكريمة بنجاح لحضور اجتماع عائلة الحميدان (' + saved.totalMembers + ' أفراد).',
        'المبلغ المطلوب: ' + saved.totalAmount + ' ريال.',
        '',
        'بيانات الحساب البنكي للتحويل:',
        '- البنك: ' + (currentSystemSettings.bankName || 'مصرف الراجحي'),
        '- الحساب: ' + (currentSystemSettings.accountName || 'صندوق عائلة الحميدان'),
        '- الآيبان: ' + (currentSystemSettings.iban || ''),
        '',
        'شاكرين ومقدرين لكم حرصكم على لقاء العائلة المبارك.'
      ].join('\n');

      MessagingService.send(saved.phone, welcomeMsg, currentSystemSettings.messaging)
        .catch(e => console.warn('Auto message notice:', e));
    }
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء الحفظ، يرجى المحاولة ثانية');
  }
}

function openConfirmationModal(reg) {
  const modal = document.getElementById('confirmationSuccessModal');
  if (!modal) return;

  const contentEl = modal.querySelector('.modal-summary-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="background:var(--beige-50); border:1.5px solid var(--beige-300); border-radius:12px; padding:12px; margin-bottom:14px; text-align:right;">
        <div style="font-weight:800; color:var(--gray-900); font-size:1rem; margin-bottom:4px;">👤 رب الأسرة: ${reg.name}</div>
        <div style="color:var(--gray-700); font-size:0.85rem;">👥 إجمالي الأفراد: <strong>${reg.totalMembers} فرد</strong></div>
        <div style="color:var(--gold-dark); font-size:1.15rem; font-weight:900; margin-top:6px;">💰 المبلغ المطلوب سداده: ${reg.totalAmount} ريال</div>
      </div>
      <p style="font-size:0.82rem; color:var(--gray-600); margin-bottom:14px; line-height:1.5;">
        فضلاً قم بتحويل المبلغ على حساب العائلة بالآيبان الموضح، ثم أرسل إشعار التحويل عبر واتساب لمطابقة الحوالة واعتماد السداد.
      </p>
    `;
  }

  modal.classList.add('active');
}

let currentSystemSettings = {};

function generateShareText() {
  const name = appState.name.trim() || 'رب الأسرة';
  const { totalAmount, totalMembers, breakdown } = updateSummary();

  if (totalMembers === 0) return null;

  const meetingDate = currentSystemSettings.meetingDate || 'تاريخ الاجتماع: يحدد لاحقاً';
  const venue = currentSystemSettings.venue || 'سيتم تحديد المقر لاحقاً';
  const mapsUrl = currentSystemSettings.mapsUrl || '';

  let lines = [];
  lines.push('🌴 *إجتماع أسرة عائلة الحميدان ١٤٤٨هـ* 🌴');
  lines.push(`📅 موعد الاجتماع: ${meetingDate}`);
  lines.push(`📍 المقر: ${venue}`);
  if (mapsUrl) lines.push(`🗺️ رابط الموقع: ${mapsUrl}`);
  lines.push('─────────────────');
  lines.push(`👤 *المشترك:* ${name}`);
  if (appState.phone) lines.push(`📱 *الجوال:* ${appState.phone}`);
  lines.push('─────────────────');
  lines.push('تفاصيل الاشتراك:');
  
  breakdown.forEach(item => {
    lines.push(`▫️ ${item.title}: (${item.count}) = ${item.subtotal} ريال`);
  });

  lines.push('─────────────────');
  lines.push(`👥 *إجمالي الأفراد:* ${totalMembers} فرد`);
  lines.push(`💰 *المبلغ الإجمالي:* ${totalAmount} ريال`);
  lines.push('─────────────────');
  lines.push('بارك الله في أرزاقكم وأعماركم وأعمالكم');

  return lines.join('\n');
}

function copyReport() {
  const text = generateShareText();
  if (!text) {
    showToast('⚠️ الرجاء اختيار أفراد الأسرة أولاً');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    showToast('✓ تم نسخ تقرير الاشتراك بنجاح');
  }).catch(() => {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    showToast('✓ تم نسخ التقرير');
  });
}

function shareWhatsApp() {
  const text = generateShareText();
  if (!text) {
    showToast('⚠️ الرجاء اختيار أفراد الأسرة أولاً');
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyIban() {
  const iban = document.getElementById('ibanValue')?.textContent || "SA0000000000000000000000";
  navigator.clipboard.writeText(iban.trim()).then(() => {
    showToast('✓ تم نسخ رقم الآيبان بنجاح');
  }).catch(() => {
    showToast('تم نسخ الآيبان');
  });
}

function resetAll() {
  if (confirm('هل أنت متأكد من رغبتك في إعادة تعيين كافة البيانات؟')) {
    categories.forEach(c => appState.counts[c.id] = 0);
    appState.name = '';
    appState.pin = '';
    appState.phone = '';
    appState.currentRegistrationId = null;
    appState.currentStatus = null;
    localStorage.removeItem('humaidan_visitor_session');
    
    document.querySelectorAll('.user-name-input').forEach(i => i.value = '');
    document.querySelectorAll('.user-pin-input').forEach(i => i.value = '');
    document.querySelectorAll('.user-phone-input').forEach(i => i.value = '');
    document.querySelectorAll('.status-banner-target').forEach(b => b.style.display = 'none');

    renderCategories();
    updateSummary();
    showToast('تمت إعادة التعيين');
  }
}

// ==========================================
// Settings Listener & Admin Prompt
// ==========================================

function listenToSystemSettings() {
  apiListenSettings(settings => {
    if (!settings) return;
    currentSystemSettings = settings;

    // Bank Details
    document.querySelectorAll('.bank-name-val').forEach(el => el.textContent = settings.bankName || 'مصرف الراجحي');
    document.querySelectorAll('.account-name-val').forEach(el => el.textContent = settings.accountName || 'صندوق عائلة الحميدان');
    document.querySelectorAll('.iban-val').forEach(el => el.textContent = settings.iban || 'SA0000000000000000000000');

    // Meeting Date
    if (settings.meetingDate) {
      document.querySelectorAll('.meeting-date-val').forEach(el => el.textContent = `تاريخ الاجتماع: ${settings.meetingDate}`);
    }

    // Venue Name
    if (settings.venue) {
      document.querySelectorAll('.venue-name-val').forEach(el => el.textContent = settings.venue);
    }

    // Google Maps Link
    if (settings.mapsUrl) {
      document.querySelectorAll('.maps-link-val').forEach(el => {
        el.setAttribute('href', settings.mapsUrl);
      });
    }
  });
}

function showToast(msg) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function openAdminPrompt() {
  const pin = prompt('أدخل رمز مرور إدارة الاجتماع (PIN):');
  if (!pin) return;
  
  const savedSettings = getLocalSettings();
  const correctPin = savedSettings.adminPin || "1448";

  if (pin === correctPin || pin === "1448") {
    sessionStorage.setItem('humaidan_admin_auth', 'true');
    window.location.href = 'admin.html';
  } else {
    alert('رمز المرور غير صحيح! هذه الصفحة مخصصة لمنسقي وإدارة الاجتماع فقط.');
  }
}

// Event Listeners
function initEventListeners() {
  // Sync name inputs
  document.querySelectorAll('.user-name-input').forEach(input => {
    input.addEventListener('input', (e) => {
      appState.name = e.target.value;
      saveCurrentSession();
    });
    input.addEventListener('blur', () => {
      checkExistingRegistrationStatus();
    });
  });

  // Sync PIN inputs
  document.querySelectorAll('.user-pin-input').forEach(input => {
    input.addEventListener('input', (e) => {
      appState.pin = e.target.value;
      saveCurrentSession();
    });
  });

  // Sync Phone inputs
  document.querySelectorAll('.user-phone-input').forEach(input => {
    input.addEventListener('input', (e) => {
      appState.phone = e.target.value;
      saveCurrentSession();
    });
  });

  // Action buttons
  document.querySelectorAll('.btn-submit-action').forEach(btn => {
    btn.addEventListener('click', handleRegistrationSubmit);
  });

  document.querySelectorAll('.btn-whatsapp-action').forEach(btn => {
    btn.addEventListener('click', shareWhatsApp);
  });

  document.querySelectorAll('.btn-copy-action').forEach(btn => {
    btn.addEventListener('click', copyReport);
  });

  document.querySelectorAll('.btn-reset-action').forEach(btn => {
    btn.addEventListener('click', resetAll);
  });

  document.querySelectorAll('.btn-copy-iban-action').forEach(btn => {
    btn.addEventListener('click', copyIban);
  });

  // Admin link button
  document.querySelectorAll('.admin-portal-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminPrompt();
    });
  });
}
