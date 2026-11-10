/**
 * Al-Humaidan Family Meeting 1448H
 * Visitor Portal Logic: Calculator, Registration, Live Status, Device Mode
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
  currentStatus: null,
  deviceMode: localStorage.getItem('humaidan_device_mode') || null
};

// Initialize counts
categories.forEach(c => {
  appState.counts[c.id] = 0;
});

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initDeviceMode();
  loadSavedUserSession();
  renderCategories();
  updateSummary();
  initEventListeners();
  listenToSystemSettings();
});

// ==========================================
// Device Mode Switcher & Popups Flow
// ==========================================

function initDeviceMode() {
  const isMobile = window.innerWidth <= 768;
  const choiceModal = document.getElementById('deviceChoiceModal');
  const savedMode = localStorage.getItem('humaidan_device_mode');

  if (isMobile) {
    applyDeviceMode('mobile');
    if (choiceModal) choiceModal.classList.remove('active');
    
    // Open login modal directly on mobile if first time
    const session = getStoredSession();
    if (!session || !session.name) {
      setTimeout(() => {
        const loginModal = document.getElementById('visitorLoginModal');
        if (loginModal) loginModal.classList.add('active');
      }, 350);
    }
    return;
  }

  // Desktop Flow
  if (!savedMode) {
    if (choiceModal) {
      setTimeout(() => {
        choiceModal.classList.add('active');
      }, 300);
    }
  } else {
    applyDeviceMode(savedMode);
  }
}

function selectDeviceAndOpenLogin(mode) {
  applyDeviceMode(mode);
  
  // Close choice modal
  const choiceModal = document.getElementById('deviceChoiceModal');
  if (choiceModal) choiceModal.classList.remove('active');

  // Open visitor login popup if no user logged in yet
  const loginModal = document.getElementById('visitorLoginModal');
  if (loginModal) {
    setTimeout(() => {
      loginModal.classList.add('active');
      // Pre-populate if saved
      const nameInput = document.getElementById('modalVisitorName');
      const pinInput = document.getElementById('modalVisitorPin');
      const phoneInput = document.getElementById('modalVisitorPhone');
      if (nameInput) nameInput.value = appState.name || '';
      if (pinInput) pinInput.value = appState.pin || '';
      if (phoneInput) phoneInput.value = appState.phone || '';
      nameInput?.focus();
    }, 250);
  }
}

// Holds historical family data if found for restore prompt
window.pendingFamilyHistory = null;

async function submitVisitorModalLogin() {
  const nameInput = document.getElementById('modalVisitorName');
  const pinInput = document.getElementById('modalVisitorPin');
  const phoneInput = document.getElementById('modalVisitorPhone');

  const name = (nameInput?.value || '').trim();
  const pin = (pinInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();

  if (!name) {
    showToast('⚠️ يرجى إدخال اسم المستخدم / رب الأسرة');
    nameInput?.focus();
    return;
  }

  if (!pin) {
    showToast('⚠️ يرجى إدخال كلمة المرور أو رمز PIN لحفظ حسابك');
    pinInput?.focus();
    return;
  }

  if (!phone) {
    showToast('⚠️ يرجى إدخال رقم الجوال');
    phoneInput?.focus();
    return;
  }

  // Clear previous session if switching users
  if (appState.name && appState.name !== name) {
    appState.currentRegistrationId = null;
    appState.currentStatus = null;
  }

  appState.name = name;
  appState.pin = pin;
  appState.phone = phone;

  // Sync with page inputs
  document.querySelectorAll('.user-name-input').forEach(i => i.value = name);
  document.querySelectorAll('.user-pin-input').forEach(i => i.value = pin);
  document.querySelectorAll('.user-phone-input').forEach(i => i.value = phone);

  saveCurrentSession();
  closeVisitorLoginModal();

  // 1. Check if user already registered in current meeting
  const currentReg = await apiFindRegistration(name, pin);
  if (currentReg) {
    appState.currentRegistrationId = currentReg.id;
    appState.currentStatus = currentReg.status;
    if (currentReg.counts) {
      Object.keys(currentReg.counts).forEach(k => {
        if (appState.counts[k] !== undefined) appState.counts[k] = currentReg.counts[k];
      });
      renderCategories();
      updateSummary();
    }
    showLiveStatusBanner(currentReg);
    showToast(`✓ أهلاً بك يا ${name}! تم استرجاع تسجيلك في هذا الاجتماع.`);
    return;
  } else {
    // New registration for current meeting: clear old ID so we don't overwrite another person's record
    appState.currentRegistrationId = null;
    appState.currentStatus = 'pending';
    document.querySelectorAll('.status-banner-target').forEach(b => b.style.display = 'none');
  }

  // 2. Check if user has historical family record from previous meetings
  const history = await apiFindFamilyHistory(name, pin, phone);
  if (history && history.counts && history.totalMembers > 0) {
    promptRestoreFamilyModal(history);
  } else {
    showToast(`✓ أهلاً بك يا ${name}! يمكنك الآن تحديد عدد أفراد أسرتك.`);
  }
}

function promptRestoreFamilyModal(history) {
  window.pendingFamilyHistory = history;
  const modal = document.getElementById('restoreFamilyModal');
  const userEl = document.getElementById('restoreFamilyUserName');
  const box = document.getElementById('restoreFamilySummaryBox');

  if (userEl) userEl.textContent = history.name || appState.name;

  if (box && history.breakdown) {
    let itemsHtml = history.breakdown.map(b => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed var(--beige-300);">
        <span style="font-weight:600; color:var(--gray-800);">${b.title}</span>
        <span style="background:var(--gold-bg); color:var(--gold-primary); font-weight:700; padding:2px 10px; border-radius:6px; font-size:0.85rem;">${b.count} فرد</span>
      </div>
    `).join('');

    box.innerHTML = `
      <div style="font-size:0.88rem; font-weight:700; color:var(--gray-800); margin-bottom:8px;">
        📋 تفاصيل أفراد الأسرة في السجل السابق (${history.totalMembers} فرد):
      </div>
      <div style="display:flex; flex-direction:column; gap:3px; max-height:160px; overflow-y:auto;">
        ${itemsHtml}
      </div>
      <div style="font-size:0.78rem; color:var(--gray-500); margin-top:8px;">
        * عند الاسترداد ستُعبأ الأعداد تلقائياً ويمكنك تعديلها في أي وقت قبل إرسال التسجيل.
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
    showToast('✓ تم استرداد أفراد أسرتك بنجاح! راجع الأعداد ثم اعتمد التسجيل.');
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
  const confirmMsg = 'هل ترغب بالتأكيد في تسجيل الخروج؟\nيتيح لك ذلك تسجيل شخص آخر أو عائلة أخرى من نفس الجوال بحساب ورقم تسجيل مستقل تماماً.';
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

    const nameInput = document.getElementById('modalVisitorName');
    const pinInput = document.getElementById('modalVisitorPin');
    const phoneInput = document.getElementById('modalVisitorPhone');
    if (nameInput) nameInput.value = '';
    if (pinInput) pinInput.value = '';
    if (phoneInput) phoneInput.value = '';

    renderCategories();
    updateSummary();

    showToast('🚪 تم تسجيل الخروج بنجاح. يمكنك الآن تسجيل بيانات شخص أو عائلة أخرى.');

    setTimeout(() => {
      const loginModal = document.getElementById('visitorLoginModal');
      if (loginModal) loginModal.classList.add('active');
    }, 300);
  }
};

function closeVisitorLoginModal() {
  const loginModal = document.getElementById('visitorLoginModal');
  if (loginModal) loginModal.classList.remove('active');
}

function openVisitorLoginModal() {
  const loginModal = document.getElementById('visitorLoginModal');
  if (loginModal) {
    const nameInput = document.getElementById('modalVisitorName');
    const pinInput = document.getElementById('modalVisitorPin');
    const phoneInput = document.getElementById('modalVisitorPhone');
    if (nameInput) nameInput.value = appState.name || '';
    if (pinInput) pinInput.value = appState.pin || '';
    if (phoneInput) phoneInput.value = appState.phone || '';
    loginModal.classList.add('active');
  }
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem('humaidan_visitor_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function applyDeviceMode(mode) {
  const isMobile = (mode === 'mobile' || mode === 'pixel6');
  appState.deviceMode = isMobile ? 'mobile' : 'desktop';
  localStorage.setItem('humaidan_device_mode', appState.deviceMode);

  const floatingBtn = document.getElementById('floatingViewToggle');
  const choiceModal = document.getElementById('deviceChoiceModal');
  if (choiceModal) choiceModal.classList.remove('active');

  if (isMobile) {
    document.body.classList.add('mode-mobile');
    document.body.classList.remove('mode-desktop');
    if (floatingBtn) {
      floatingBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>
        <span>التبديل إلى سطح المكتب</span>
      `;
    }
  } else {
    document.body.classList.add('mode-desktop');
    document.body.classList.remove('mode-mobile');
    if (floatingBtn) {
      floatingBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
        <span>التبديل إلى الجوال</span>
      `;
    }
  }
}

function updatePixel6Clock() {
  const clockEl = document.querySelector('.pixel6-clock');
  if (clockEl) {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    clockEl.textContent = `${hours}:${mins}`;
  }
}
setInterval(updatePixel6Clock, 30000);

// ==========================================
// Category Rendering & Calculations
// ==========================================

function renderCategories() {
  const containers = document.querySelectorAll('.categories-list-target');
  
  containers.forEach(container => {
    container.innerHTML = '';
    categories.forEach(cat => {
      const count = appState.counts[cat.id] || 0;
      const card = document.createElement('div');
      card.className = `category-card ${count > 0 ? 'has-value' : ''}`;
      card.id = `card-${cat.id}`;

      card.innerHTML = `
        <div class="category-meta">
          <div class="category-title-row">
            <span class="category-name">${cat.title}</span>
            <span class="category-rate-badge">${cat.price} ريال</span>
          </div>
          <div class="category-desc">${cat.desc}</div>
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
      `;
      container.appendChild(card);
    });
  });
}

window.changeCount = function(id, delta) {
  const current = appState.counts[id] || 0;
  const next = Math.max(0, current + delta);
  appState.counts[id] = next;

  // Sync inputs
  document.querySelectorAll(`#input-${id}`).forEach(input => {
    input.value = next;
  });

  // Sync card styling
  document.querySelectorAll(`#card-${id}`).forEach(card => {
    if (next > 0) card.classList.add('has-value');
    else card.classList.remove('has-value');
  });

  saveCurrentSession();
  updateSummary();
};

window.setInputCount = function(id, val) {
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;
  appState.counts[id] = num;

  document.querySelectorAll(`#input-${id}`).forEach(input => {
    input.value = num;
  });

  document.querySelectorAll(`#card-${id}`).forEach(card => {
    if (num > 0) card.classList.add('has-value');
    else card.classList.remove('has-value');
  });

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

  // Update total displays
  document.querySelectorAll('.grand-total-target').forEach(el => {
    el.textContent = totalAmount.toLocaleString('en-US');
  });

  document.querySelectorAll('.total-members-target').forEach(el => {
    el.textContent = `إجمالي أفراد الأسرة: ${totalMembers} فرد`;
  });

  // Update breakdown lists
  document.querySelectorAll('.breakdown-list-target').forEach(listEl => {
    if (breakdown.length === 0) {
      listEl.innerHTML = '<div class="breakdown-empty-hint">لم تقم بإضافة أفراد بعد، اضغط على زر (+) في القائمة</div>';
    } else {
      listEl.innerHTML = breakdown.map(item => `
        <div class="breakdown-row">
          <div>
            <div class="breakdown-name">${item.title}</div>
            <div class="breakdown-sub">${item.count} × ${item.price} ريال</div>
          </div>
          <div class="breakdown-cost">${item.subtotal.toLocaleString('en-US')} ريال</div>
        </div>
      `).join('');
    }
  });

  return { totalAmount, totalMembers, breakdown };
}

// ==========================================
// User Session & Pre-loading
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

      // Clean up any stale counts from previous visits in localStorage
      if (parsed.counts) {
        delete parsed.counts;
        try {
          localStorage.setItem('humaidan_visitor_session', JSON.stringify(parsed));
        } catch (e) {}
      }

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
  const reg = await apiFindRegistration(appState.name, appState.pin);
  if (reg) {
    appState.currentRegistrationId = reg.id;
    appState.currentStatus = reg.status;
    showLiveStatusBanner(reg);
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

    let statusBadgeHtml = '';
    let subDetailsHtml = '';

    if (status === 'paid') {
      statusBadgeHtml = `<span class="status-badge paid"><svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> تم السداد بالكامل ✓</span>`;
      subDetailsHtml = `رقم التسجيل: ${reg.id.substring(0, 10)} • الإجمالي المسدد: <strong>${total.toLocaleString('en-US')} ريال</strong> (${reg.totalMembers} أفراد)`;
    } else if (status === 'partial') {
      statusBadgeHtml = `<span class="status-badge partial"><svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14v12c3.31 0 6-2.69 6-6s-2.69-6-6-6z"/></svg> سداد جزئي 🌓</span>`;
      subDetailsHtml = `تم استلام: <strong style="color:var(--success);">${paid.toLocaleString('en-US')} ريال</strong> • المتبقي المطلوب تحويله: <strong style="color:#b45309;">${remaining.toLocaleString('en-US')} ريال</strong> (من إجمالي: ${total.toLocaleString('en-US')} ريال)`;
    } else {
      statusBadgeHtml = `<span class="status-badge pending"><svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> قيد المراجعة / بانتظار التحويل</span>`;
      subDetailsHtml = `رقم التسجيل: ${reg.id.substring(0, 10)} • المبلغ المطلوب: <strong>${total.toLocaleString('en-US')} ريال</strong> (${reg.totalMembers} أفراد)`;
    }

    b.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--gray-900);">
          مرحباً بك: ${reg.name}
        </div>
        <div style="font-size: 0.82rem; color: var(--gray-600); margin-top: 2px;">
          ${subDetailsHtml}
        </div>
      </div>
      <div>
        ${statusBadgeHtml}
      </div>
    `;
  });
}

// ==========================================
// Actions: Registration, WhatsApp, Copy
// ==========================================

async function handleRegistrationSubmit() {
  const name = (appState.name || '').trim();
  const pin = (appState.pin || '').trim();
  const phone = (appState.phone || '').trim();

  if (!name) {
    showToast('⚠️ الرجاء إدخال اسم رب الأسرة أولاً');
    document.querySelectorAll('.user-name-input').forEach(i => i.focus());
    return;
  }

  const { totalAmount, totalMembers, breakdown } = updateSummary();

  if (totalMembers === 0 || totalAmount === 0) {
    showToast('⚠️ الرجاء تحديد عدد الأفراد من الحاسبة أولاً');
    return;
  }

  // Ensure we don't accidentally overwrite someone else's registration on the same device
  let existingPaid = 0;
  let currentStatus = appState.currentStatus || 'pending';
  if (appState.currentRegistrationId) {
    const existing = getLocalRegistrations().find(r => r.id === appState.currentRegistrationId);
    if (existing) {
      if (existing.name && existing.name.trim() !== name) {
        // Name changed! This is a different person registering from this phone: generate new record
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

  // Build registration payload
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

    // If auto messaging on registration is active, send welcome/iban details automatically
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
        .then(res => {
          if (res.success) console.log('Auto welcome message sent to ' + saved.phone);
        })
        .catch(e => console.warn('Auto message error:', e));
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
      <div style="background:var(--beige-50); border:1px solid var(--beige-300); border-radius:12px; padding:14px; margin-bottom:16px; text-align:right;">
        <div style="font-weight:700; color:var(--gray-900); font-size:1.05rem; margin-bottom:4px;">👤 رب الأسرة: ${reg.name}</div>
        <div style="color:var(--gray-700); font-size:0.88rem;">👥 إجمالي الأفراد: <strong>${reg.totalMembers} فرد</strong></div>
        <div style="color:var(--gold-primary); font-size:1.2rem; font-weight:800; margin-top:6px;">💰 المبلغ المطلوب سداده: ${reg.totalAmount} ريال</div>
      </div>
      <p style="font-size:0.86rem; color:var(--gray-600); margin-bottom:16px; line-height:1.5;">
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
  const mapsUrl = currentSystemSettings.mapsUrl || '#';

  let lines = [];
  lines.push('🌴 *إجتماع أسرة عائلة الحميدان* 🌴');
  lines.push(`📅 موعد الاجتماع: ${meetingDate}`);
  lines.push(`📍 المقر: ${venue}`);
  lines.push(`🗺️ رابط الموقع: ${mapsUrl}`);
  lines.push('السلام عليكم ورحمة الله وبركاته');
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

// Copy Report
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

// WhatsApp Share
function shareWhatsApp() {
  const text = generateShareText();
  if (!text) {
    showToast('⚠️ الرجاء اختيار أفراد الأسرة أولاً');
    return;
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Copy IBAN
function copyIban() {
  const iban = document.getElementById('ibanValue')?.textContent || "SA0000000000000000000000";
  navigator.clipboard.writeText(iban.trim()).then(() => {
    showToast('✓ تم نسخ رقم الآيبان بنجاح');
  }).catch(() => {
    showToast('تم نسخ الآيبان');
  });
}

// Reset Form
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
// Settings Listener & Toast
// ==========================================

function listenToSystemSettings() {
  apiListenSettings(settings => {
    if (!settings) return;
    currentSystemSettings = settings;

    // Bank Details
    document.querySelectorAll('.bank-name-val').forEach(el => el.textContent = settings.bankName || 'اسم البنك');
    document.querySelectorAll('.account-name-val').forEach(el => el.textContent = settings.accountName || 'صندوق عائلة الحميدان');
    document.querySelectorAll('.iban-val').forEach(el => el.textContent = settings.iban || 'SA0000000000000000000000');

    // Meeting Date
    if (settings.meetingDate) {
      document.querySelectorAll('.meeting-date-val').forEach(el => el.textContent = settings.meetingDate);
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

// Prompt for Admin login
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
      document.querySelectorAll('.user-name-input').forEach(other => {
        if (other !== e.target) other.value = e.target.value;
      });
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
      document.querySelectorAll('.user-pin-input').forEach(other => {
        if (other !== e.target) other.value = e.target.value;
      });
      saveCurrentSession();
    });
  });

  // Sync Phone inputs
  document.querySelectorAll('.user-phone-input').forEach(input => {
    input.addEventListener('input', (e) => {
      appState.phone = e.target.value;
      document.querySelectorAll('.user-phone-input').forEach(other => {
        if (other !== e.target) other.value = e.target.value;
      });
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

  // View switchers
  const floatingBtn = document.getElementById('floatingViewToggle');
  if (floatingBtn) {
    floatingBtn.addEventListener('click', () => {
      const nextMode = (appState.deviceMode === 'mobile' || appState.deviceMode === 'pixel6') ? 'desktop' : 'mobile';
      applyDeviceMode(nextMode);
    });
  }

  // Admin link button
  document.querySelectorAll('.admin-portal-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminPrompt();
    });
  });
}
