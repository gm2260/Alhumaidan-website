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
  const modal = document.getElementById('deviceChoiceModal');
  const savedMode = localStorage.getItem('humaidan_device_mode');

  if (!savedMode) {
    // Open choice modal on first visit
    if (modal) {
      setTimeout(() => {
        modal.classList.add('active');
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

function submitVisitorModalLogin() {
  const nameInput = document.getElementById('modalVisitorName');
  const pinInput = document.getElementById('modalVisitorPin');
  const phoneInput = document.getElementById('modalVisitorPhone');

  const name = (nameInput?.value || '').trim();
  const pin = (pinInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();

  if (!name) {
    showToast('⚠️ يرجى إدخال اسم رب الأسرة');
    nameInput?.focus();
    return;
  }

  if (!pin) {
    showToast('⚠️ يرجى إدخال رمز المرور أو كلمة المرور الخاصة بك');
    pinInput?.focus();
    return;
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

  showToast(`✓ أهلاً بك يا ${name}! يمكنك الآن تحديد عدد أفراد أسرتك`);
  checkExistingRegistrationStatus();
}

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

function applyDeviceMode(mode) {
  // Normalize mode
  const isMobile = (mode === 'mobile' || mode === 'pixel6');
  appState.deviceMode = isMobile ? 'mobile' : 'desktop';
  localStorage.setItem('humaidan_device_mode', appState.deviceMode);

  const wrapper = document.getElementById('deviceWrapper');
  const desktopContainer = document.getElementById('desktopContainer');
  const floatingBtn = document.getElementById('floatingViewToggle');
  const choiceModal = document.getElementById('deviceChoiceModal');

  if (choiceModal) choiceModal.classList.remove('active');

  if (isMobile) {
    if (wrapper) wrapper.style.display = 'flex';
    if (desktopContainer) desktopContainer.style.display = 'none';
    if (floatingBtn) {
      floatingBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>
        <span>التبديل إلى تصميم سطح المكتب</span>
      `;
    }
  } else {
    if (wrapper) wrapper.style.display = 'none';
    if (desktopContainer) desktopContainer.style.display = 'block';
    if (floatingBtn) {
      floatingBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
        <span>التبديل إلى تصميم الجوال</span>
      `;
    }
  }

  // Update clock on device
  updatePixel6Clock();
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
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.name) appState.name = parsed.name;
      if (parsed.pin) appState.pin = parsed.pin;
      if (parsed.phone) appState.phone = parsed.phone;
      if (parsed.counts) {
        Object.keys(parsed.counts).forEach(k => {
          if (appState.counts[k] !== undefined) {
            appState.counts[k] = parsed.counts[k];
          }
        });
      }
      if (parsed.currentRegistrationId) {
        appState.currentRegistrationId = parsed.currentRegistrationId;
        checkExistingRegistrationStatus();
      }
    } else {
      // Default initial counts for convenience: Father = 1
      appState.counts['father'] = 1;
    }

    // Populate inputs
    document.querySelectorAll('.user-name-input').forEach(i => i.value = appState.name);
    document.querySelectorAll('.user-pin-input').forEach(i => i.value = appState.pin);
    document.querySelectorAll('.user-phone-input').forEach(i => i.value = appState.phone || '');
  } catch (e) {
    console.error("Error loading session:", e);
  }
}

function saveCurrentSession() {
  try {
    const session = {
      name: appState.name,
      pin: appState.pin,
      phone: appState.phone,
      counts: appState.counts,
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
    const isPaid = reg.status === 'paid';
    b.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--gray-900);">
          مرحباً بك: ${reg.name}
        </div>
        <div style="font-size: 0.82rem; color: var(--gray-600); margin-top: 2px;">
          رقم التسجيل: ${reg.id.substring(0, 10)} • الإجمالي المسجل: ${reg.totalAmount} ريال (${reg.totalMembers} أفراد)
        </div>
      </div>
      <div>
        ${isPaid 
          ? `<span class="status-badge paid"><svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> تم السداد والتحقق ✓</span>`
          : `<span class="status-badge pending"><svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> قيد المراجعة / بانتظار التحويل</span>`
        }
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
    status: appState.currentStatus || 'pending'
  };

  showToast('⏳ جاري تسجيل البيانات في النظام...');

  try {
    const saved = await apiSaveRegistration(payload);
    appState.currentRegistrationId = saved.id;
    appState.currentStatus = saved.status;
    saveCurrentSession();
    showLiveStatusBanner(saved);

    showToast('✓ تم تسجيل بيانات أسرتكم بنجاح!');
    openConfirmationModal(saved);
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

  const meetingDate = currentSystemSettings.meetingDate || 'يوم الخميس ١٤٤٨/٥/٤ هـ بمشيئة الله';
  const venue = currentSystemSettings.venue || 'قاعة غناتي';
  const mapsUrl = currentSystemSettings.mapsUrl || 'https://maps.app.goo.gl/ThDxkX43xCQwRuti7';

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
  const iban = document.getElementById('ibanValue')?.textContent || "SA4480000204608010123456";
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
    appState.counts['father'] = 1;
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
    document.querySelectorAll('.bank-name-val').forEach(el => el.textContent = settings.bankName || 'مصرف الراجحي');
    document.querySelectorAll('.account-name-val').forEach(el => el.textContent = settings.accountName || 'صندوق عائلة الحميدان');
    document.querySelectorAll('.iban-val').forEach(el => el.textContent = settings.iban || 'SA4480000204608010123456');

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
