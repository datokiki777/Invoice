// =========================================
// GLOBAL STATE
// =========================================
let deferredPrompt = null;
let swRegistration = null;
let modalCallback = null;
let currentLang = localStorage.getItem('db_lang') || 'en';

// =========================================
// DATA MODEL
// =========================================
let APP_DATA = {
    companies: [],
    currentCompanyId: '',
    currentInvoice: {
        companyId: '',
        num: '',
        date: '',
        client: '',
        vatRate: 21,
        vatText: '',
        items: [{ desc: '', qty: 1, price: 0 }]
    },
    invoices: [],
    clients: []
};

// ============================
// LOGO PATHS
// ============================

const LOGOS = {
    owner: "icons/mylogo.svg",
    shared1: "icons/logo.svg",
    shared2: "icons/b.logo.svg"
};

// =========================================
// COMPANY HELPERS
// =========================================

function getLogoPath(company) {
    if (!company) return LOGOS.shared1;

    const key = company.logoKey || "shared1";

    return LOGOS[key] || LOGOS.shared1;
}

function createEmptyCompany() {
    return {
        id: 'company_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: '',
        reg: '',
        addr: '',
        phone: '',
        email: '',
        website: '',
        bankRecip: '',
        bankName: '',
        bankIban: '',
        bankBic: '',
        logoKey: 'shared1'
    };
}

function getCurrentCompany() {
    if (!APP_DATA.companies || APP_DATA.companies.length === 0) return null;

    let company = APP_DATA.companies.find(c => c.id === APP_DATA.currentCompanyId);

    if (!company) {
        company = APP_DATA.companies[0];
        APP_DATA.currentCompanyId = company.id;
    }

    return company;
}

function ensureCurrentCompany() {
    if (!APP_DATA.companies) APP_DATA.companies = [];

    if (APP_DATA.companies.length === 0) {
        const company = createEmptyCompany();
        APP_DATA.companies.push(company);
        APP_DATA.currentCompanyId = company.id;
    }

    if (!APP_DATA.currentCompanyId && APP_DATA.companies[0]) {
        APP_DATA.currentCompanyId = APP_DATA.companies[0].id;
    }

    if (!APP_DATA.currentInvoice) {
        APP_DATA.currentInvoice = {
            companyId: APP_DATA.currentCompanyId,
            num: '',
            date: '',
            client: '',
            vatRate: 21,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        };
    }

    if (!APP_DATA.currentInvoice.companyId) {
        APP_DATA.currentInvoice.companyId = APP_DATA.currentCompanyId;
    }
}

// =========================================
// OWNER LOGO LOCK
// =========================================
const OWNER_LOGO_UNLOCK_KEY = 'invoice_owner_logo_unlocked';
const OWNER_LOGO_CODE = '2580';

function isOwnerLogoUnlocked() {
    return localStorage.getItem(OWNER_LOGO_UNLOCK_KEY) === 'yes';
}

function unlockOwnerLogo(code) {
    if (String(code).trim() === OWNER_LOGO_CODE) {
        localStorage.setItem(OWNER_LOGO_UNLOCK_KEY, 'yes');
        refreshLogoHelpText();
        refreshUnlockLogoButton();
        return true;
    }
    return false;
}

function ensureLogoAccess(selectedLogoKey) {
    if (selectedLogoKey !== 'owner') return selectedLogoKey;
    if (isOwnerLogoUnlocked()) return 'owner';

    const code = window.prompt('Enter code to unlock Your Logo:');
    if (!code) {
        const select = document.getElementById('new_company_logo');
        if (select) select.value = 'shared1';
        refreshOwnerLogoOptionText();
        return 'shared1';
    }

    const ok = unlockOwnerLogo(code);

    if (ok) {
        refreshOwnerLogoOptionText();
        showToast('🔓 Your Logo unlocked');
        return 'owner';
    }

    const select = document.getElementById('new_company_logo');
    if (select) select.value = 'shared1';
    refreshOwnerLogoOptionText();
    showToast('❌ Wrong code');

    return 'shared1';
}

function refreshOwnerLogoOptionText() {
    const select = document.getElementById('new_company_logo');
    if (!select) return;

    let ownerOption = select.querySelector('option[value="owner"]');

    if (isOwnerLogoUnlocked()) {
        if (!ownerOption) {
            ownerOption = document.createElement('option');
            ownerOption.value = 'owner';
            select.appendChild(ownerOption);
        }
        ownerOption.textContent = '🔓 Your Logo';
    } else {
        if (ownerOption) {
            if (select.value === 'owner') {
                select.value = 'shared1';
            }
            ownerOption.remove();
        }
    }
}

function unlockYourLogoManually() {
    if (isOwnerLogoUnlocked()) {
        showToast('🔓 Your Logo already unlocked');
        refreshOwnerLogoOptionText();
        refreshLogoHelpText();
        refreshUnlockLogoButton();
        return;
    }

    const code = window.prompt('Enter code to unlock Your Logo:');
    if (!code) return;

    const ok = unlockOwnerLogo(369700);

    if (ok) {
        refreshOwnerLogoOptionText();
        refreshLogoHelpText();
        refreshUnlockLogoButton();
        showToast('🔓 Your Logo unlocked');
    } else {
        showToast('❌ Wrong code');
    }
}

function refreshLogoHelpText() {
    const help = document.getElementById('logo-help-text');
    if (!help) return;

    if (isOwnerLogoUnlocked()) {
        help.textContent = '🔓 Your Logo is unlocked on this device.';
    } else {
        help.textContent = 'Shared logos are available for everyone. Your Logo requires unlock code.';
    }
}

function refreshUnlockLogoButton() {
    const wrap = document.getElementById('unlock-logo-wrap');
    if (!wrap) return;

    wrap.style.display = isOwnerLogoUnlocked() ? 'none' : 'block';
}

// =========================================
// LANGUAGE: EN / DE
// =========================================
const LANG = {
    en: {
        invoiceWord: 'INVOICE',
        billedTo: 'Billed To',
        invoiceDetails: 'Invoice Details',
        invoiceNum: 'Invoice #',
        date: 'Date',
        description: 'Description',
        qty: 'Qty',
        unitPrice: 'Unit Price',
        amount: 'Amount',
        subtotal: 'Subtotal',
        total: 'TOTAL',
        bankDetails: 'Bank Details',
        recipient: 'Recipient',
        bank: 'Bank',
        terms: 'Terms',
        termsText: 'Payment due within 7 days of invoice date.\nThank you for your business!',
        addRow: '➕ Add Row',
        selectClient: '— Select a client —',
        vatLabel: (r) => `VAT (${r}%)`
    },
    de: {
        invoiceWord: 'RECHNUNG',
        billedTo: 'Rechnungsempfänger',
        invoiceDetails: 'Rechnungsdetails',
        invoiceNum: 'Rechnungs-Nr.',
        date: 'Datum',
        description: 'Beschreibung',
        qty: 'Menge',
        unitPrice: 'Einzelpreis',
        amount: 'Betrag',
        subtotal: 'Zwischensumme',
        total: 'GESAMT',
        bankDetails: 'Bankverbindung',
        recipient: 'Empfänger',
        bank: 'Bank',
        terms: 'Zahlungsbedingungen',
        termsText: 'Zahlung innerhalb von 7 Tagen nach Rechnungsdatum.\nVielen Dank für Ihr Vertrauen!',
        addRow: '➕ Zeile hinzufügen',
        selectClient: '— Kunde auswählen —',
        vatLabel: (r) => `MwSt. (${r}%)`
    }
};

// =========================================
// STORAGE
// =========================================
function loadAppData() {
    const raw = localStorage.getItem('invoice_app_v1');

    if (raw) {
        try {
            APP_DATA = JSON.parse(raw);
        } catch (e) {}
    }

    // ძველი სტრუქტურიდან ახალ მრავალკომპანიურ სტრუქტურაზე გადაყვანა
    if (!APP_DATA.companies) {
        const oldCompany = APP_DATA.company || {};

        const migratedCompany = {
            id: 'company_' + Date.now(),
            name: oldCompany.name || '',
            reg: oldCompany.reg || '',
            addr: oldCompany.addr || '',
            phone: oldCompany.phone || '',
            email: oldCompany.email || '',
            website: oldCompany.website || '',
            bankRecip: oldCompany.bankRecip || '',
            bankName: oldCompany.bankName || '',
            bankIban: oldCompany.bankIban || '',
            bankBic: oldCompany.bankBic || '',
            logoKey: 'shared1'
        };

        APP_DATA.companies = [migratedCompany];
        APP_DATA.currentCompanyId = migratedCompany.id;

        if (!APP_DATA.currentInvoice) {
            APP_DATA.currentInvoice = {
                companyId: migratedCompany.id,
                num: '',
                date: '',
                client: '',
                vatRate: 21,
                vatText: '',
                items: [{ desc: '', qty: 1, price: 0 }]
            };
        } else {
            APP_DATA.currentInvoice.companyId = migratedCompany.id;
        }

        delete APP_DATA.company;
    }

    if (!Array.isArray(APP_DATA.companies)) APP_DATA.companies = [];
    if (!Array.isArray(APP_DATA.invoices)) APP_DATA.invoices = [];
    if (!Array.isArray(APP_DATA.clients)) APP_DATA.clients = [];

    ensureCurrentCompany();

    if (
        !APP_DATA.currentInvoice.items ||
        !Array.isArray(APP_DATA.currentInvoice.items) ||
        APP_DATA.currentInvoice.items.length === 0
    ) {
        APP_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }

    APP_DATA.invoices = APP_DATA.invoices.map(inv => ({
        ...inv,
        companyId: inv.companyId || APP_DATA.currentCompanyId
    }));

    APP_DATA.clients = APP_DATA.clients.map(client => ({
        ...client,
        companyId: client.companyId || APP_DATA.currentCompanyId
    }));
}

function saveAppData() {
    localStorage.setItem('invoice_app_v1', JSON.stringify(APP_DATA));
}

// =========================================
// PWA / INSTALL / UPDATE
// =========================================
function triggerAndroidInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            showToast('✅ App installed!');
        }
        deferredPrompt = null;
        hideInstallUI();
    });
}

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
    return window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
}

function showInstallUI() {
    if (isInStandaloneMode()) return;

    if (isIOS()) {
        if (!sessionStorage.getItem('ios_banner_dismissed')) {
            const banner = document.getElementById('ios-banner');
            if (banner) banner.classList.add('show');
        }
        return;
    }

    if (deferredPrompt) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.innerHTML = '📲 Install this app on your home screen! <button onclick="triggerAndroidInstall()" style="background:var(--secondary);color:var(--primary);border:none;border-radius:12px;padding:4px 12px;font-size:13px;font-weight:700;cursor:pointer;margin-left:8px;">Install</button>';
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 7000);
    }
}

function hideInstallUI() {
    const toast = document.getElementById('toast');
    if (toast) toast.classList.remove('show');

    const banner = document.getElementById('ios-banner');
    if (banner) banner.classList.remove('show');
}

function dismissIOSBanner() {
    const banner = document.getElementById('ios-banner');
    if (banner) banner.classList.remove('show');
    sessionStorage.setItem('ios_banner_dismissed', '1');
}

function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.classList.add('show');
}

function dismissUpdate() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.classList.remove('show');
}

function applyUpdate() {
    dismissUpdate();

    if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
        window.location.reload();
    }
}

function initPWA() {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredPrompt = event;

        if (!sessionStorage.getItem('install_prompt_seen')) {
            sessionStorage.setItem('install_prompt_seen', '1');
            setTimeout(() => {
                showInstallUI();
            }, 1200);
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstallUI();
        showToast('✅ App installed!');
    });

    if (isIOS() && !isInStandaloneMode() && !sessionStorage.getItem('ios_banner_dismissed')) {
        setTimeout(() => {
            showInstallUI();
        }, 1400);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            swRegistration = registration;

            if (registration.waiting) {
                showUpdateBanner();
            }

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });

            registration.update().catch(() => {});
        }).catch(error => {
            console.error('SW registration failed:', error);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }
}

// =========================================
// INIT
// =========================================
window.onload = function () {
    loadAppData();

    const todayStatus = document.getElementById('today_status');
    if (todayStatus) {
        todayStatus.innerText = '📅 ' + getCurrentDate();
    }

    APP_DATA.currentInvoice.companyId = APP_DATA.currentCompanyId;

    if (!APP_DATA.currentInvoice.num) APP_DATA.currentInvoice.num = generateInvoiceNumber();
    if (!APP_DATA.currentInvoice.date) APP_DATA.currentInvoice.date = getCurrentDate();

    renderInvoiceForm();
    renderHistory();
    renderClients();
    renderCompanies();
    refreshClientPicker();
    refreshCompanyPicker();
    refreshOwnerLogoOptionText();
    refreshLogoHelpText();
    refreshUnlockLogoButton();
    applyLang();
    initPWA();

    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    if (modalConfirmBtn) {
        modalConfirmBtn.onclick = function () {
            closeModal();
            if (modalCallback) modalCallback();
        };
    }

    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) closeModal();
        });
    }
};

// =========================================
// PAGE NAVIGATION
// =========================================
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const page = document.getElementById('page-' + name);
    const tab = document.getElementById('tab-' + name);

    if (page) page.classList.add('active');
    if (tab) tab.classList.add('active');

    if (name === 'history') renderHistory();
    if (name === 'clients') renderClients();
}

// =========================================
// INVOICE FORM
// =========================================
function renderInvoiceForm() {
    const ci = APP_DATA.currentInvoice;
    const co = getCurrentCompany() || createEmptyCompany();

    document.getElementById('my_comp_name').value = co.name;
    document.getElementById('my_reg_no').value = co.reg;
    document.getElementById('my_addr').value = co.addr;
    document.getElementById('my_phone').value = co.phone;
    document.getElementById('my_email').value = co.email;
    document.getElementById('my_website').value = co.website || '';
    document.getElementById('bank_recip').value = co.bankRecip;
    document.getElementById('bank_name').value = co.bankName;
    document.getElementById('bank_iban').value = co.bankIban;
    document.getElementById('bank_bic').value = co.bankBic;

    document.getElementById('inv_num').value = ci.num;
    document.getElementById('inv_date').value = ci.date;
    document.getElementById('client_info').value = ci.client;
    document.getElementById('vat_rate').value = ci.vatRate;
    document.getElementById('vat_text').value = ci.vatText || '';

    if (!ci.items || ci.items.length === 0) {
        ci.items = [{ desc: '', qty: 1, price: 0 }];
    }

    renderItemRows();
    calculateAll();

    const logo = document.getElementById('company-logo');
    if (logo) {
        logo.src = getLogoPath(co);
    }
}

function renderItemRows() {
    const tbody = document.getElementById('items-body');
    tbody.innerHTML = '';

    APP_DATA.currentInvoice.items.forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.dataset.index = i;

        const total = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);

        tr.innerHTML = `
            <td>
                <input type="text" class="item-desc-input" value="${esc(item.desc)}"
                    oninput="updateItem(${i}, 'desc', this.value)" placeholder="Description of work...">
            </td>
            <td style="text-align:center">
                <input type="number" class="item-num-input" value="${item.qty}"
                    oninput="updateItem(${i}, 'qty', this.value)" min="0" step="0.01" style="width:70px">
            </td>
            <td>
                <div class="item-price-wrap">
                    <span class="currency">€</span>
                    <input type="number" class="item-num-input" value="${item.price}"
                        oninput="updateItem(${i}, 'price', this.value)" min="0" step="0.01" style="width:90px">
                </div>
            </td>
            <td class="item-total-cell">
                €<span id="row-total-${i}">${total.toFixed(2)}</span>
            </td>
            <td class="no-print" style="width:36px">
                ${APP_DATA.currentInvoice.items.length > 1 ? `<button class="remove-row-btn" onclick="removeItemRow(${i})" title="Delete">✕</button>` : ''}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function updateItem(index, field, value) {
    APP_DATA.currentInvoice.items[index][field] = value;
    calculateAll();
    saveAppData();
}

function addItemRow() {
    APP_DATA.currentInvoice.items.push({ desc: '', qty: 1, price: 0 });
    renderItemRows();
    calculateAll();
    saveAppData();

    const rows = document.querySelectorAll('.item-desc-input');
    if (rows.length) rows[rows.length - 1].focus();
}

function removeItemRow(index) {
    APP_DATA.currentInvoice.items.splice(index, 1);
    renderItemRows();
    calculateAll();
    saveAppData();
}

function calculateAll() {
    const items = APP_DATA.currentInvoice.items;
    let subtotal = 0;

    items.forEach((item, i) => {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        const t = q * p;
        subtotal += t;

        const el = document.getElementById('row-total-' + i);
        if (el) el.innerText = t.toFixed(2);
    });

    const vatRate = parseFloat(document.getElementById('vat_rate').value) || 0;
    APP_DATA.currentInvoice.vatRate = vatRate;

    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    document.getElementById('subtotal_display').innerText = subtotal.toFixed(2);
    document.getElementById('vat_amount').innerText = vat.toFixed(2);
    document.getElementById('grand_total').innerText = total.toFixed(2);

    saveAppData();
}

function saveAllData() {
    const company = getCurrentCompany();
    if (company) {
        company.name = document.getElementById('my_comp_name').value;
        company.reg = document.getElementById('my_reg_no').value;
        company.addr = document.getElementById('my_addr').value;
        company.phone = document.getElementById('my_phone').value;
        company.email = document.getElementById('my_email').value;
        company.website = document.getElementById('my_website').value;
        company.bankRecip = document.getElementById('bank_recip').value;
        company.bankName = document.getElementById('bank_name').value;
        company.bankIban = document.getElementById('bank_iban').value;
        company.bankBic = document.getElementById('bank_bic').value;
    }

    APP_DATA.currentInvoice.companyId = APP_DATA.currentCompanyId;
    APP_DATA.currentInvoice.num = document.getElementById('inv_num').value;
    APP_DATA.currentInvoice.date = document.getElementById('inv_date').value;
    APP_DATA.currentInvoice.client = document.getElementById('client_info').value;
    APP_DATA.currentInvoice.vatRate = parseFloat(document.getElementById('vat_rate').value) || 0;
    APP_DATA.currentInvoice.vatText = document.getElementById('vat_text').value;

    saveAppData();
    calculateAll();
}

// =========================================
// INVOICE HISTORY
// =========================================
function saveInvoiceToHistory() {
    saveAllData();

    const inv = JSON.parse(JSON.stringify(APP_DATA.currentInvoice));
    inv.savedAt = new Date().toISOString();

    const existIdx = APP_DATA.invoices.findIndex(i => i.num === inv.num);

    if (existIdx >= 0) {
        APP_DATA.invoices[existIdx] = inv;
    } else {
        APP_DATA.invoices.unshift(inv);
    }

    saveAppData();
    showToast('✅ Invoice saved!');
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');

    if (!APP_DATA.invoices || APP_DATA.invoices.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🗂️</div><p>No invoices saved yet</p></div>`;
        return;
    }

    list.innerHTML = APP_DATA.invoices.map((inv, i) => {
        const subtotal = (inv.items || []).reduce(
            (s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0),
            0
        );
        const vat = subtotal * ((parseFloat(inv.vatRate) || 0) / 100);
        const total = subtotal + vat;

        const isCurrent = inv.num === APP_DATA.currentInvoice.num;
        const clientName = (inv.client || '').split('\n')[0] || 'No client specified';

        const company = APP_DATA.companies.find(c => c.id === inv.companyId);
        const companyName = company?.name || 'No company';

        const savedDate = inv.savedAt
            ? new Date(inv.savedAt).toLocaleDateString('ka-GE')
            : '';

        return `
        <div class="history-card ${isCurrent ? 'current' : ''}">
            <div>
                <div class="hist-num">${esc(inv.num)}</div>
                <div class="hist-client">${esc(companyName)} — ${esc(clientName)}</div>
                <div class="hist-meta">📅 ${esc(inv.date)}</div>
                <div class="hist-actions">
                    <button class="hist-btn hist-btn-load" onclick="loadInvoiceFromHistory(${i})">📂 Open</button>
                    <button class="hist-btn hist-btn-pdf" onclick="exportHistoryPDF(${i})">📥 PDF</button>
                    <button class="hist-btn hist-btn-del" onclick="deleteInvoice(${i})">🗑️ Delete</button>
                </div>
            </div>
            <div class="hist-right">
                <div class="hist-amount">€${total.toFixed(2)}</div>
                <div class="hist-date">${savedDate ? 'Saved: ' + savedDate : ''}</div>
                <span class="hist-badge ${isCurrent ? 'badge-current' : 'badge-saved'}">
                    ${isCurrent ? '● Current' : '✓ Saved'}
                </span>
            </div>
        </div>`;
    }).join('');
}

function loadInvoiceFromHistory(index) {
    APP_DATA.currentInvoice = JSON.parse(JSON.stringify(APP_DATA.invoices[index]));

    if (!APP_DATA.currentInvoice.items || APP_DATA.currentInvoice.items.length === 0) {
        APP_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }

    APP_DATA.currentCompanyId = APP_DATA.currentInvoice.companyId || APP_DATA.currentCompanyId;

    saveAppData();
    renderInvoiceForm();
    refreshClientPicker();
    showPage('invoice');
    showToast('📂 Invoice loaded');
}

function deleteInvoice(index) {
    confirmAction('Delete Invoice', `Delete invoice #${APP_DATA.invoices[index].num}? This cannot be undone.`, () => {
        APP_DATA.invoices.splice(index, 1);
        saveAppData();
        renderHistory();
        showToast('🗑️ Invoice deleted');
    });
}

// =========================================
// NEW / CLEAR
// =========================================
function newInvoice() {
    confirmAction('New Invoice', 'Create a new invoice? Make sure current invoice is saved.', () => {
        APP_DATA.currentInvoice = {
            companyId: APP_DATA.currentCompanyId,
            num: generateInvoiceNumber(),
            date: getCurrentDate(),
            client: '',
            vatRate: 21,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        };

        saveAppData();
        renderInvoiceForm();
        showToast('➕ New Invoice');
    });
}

function clearEverything() {
    confirmAction('Reset Everything', 'All data will be cleared. Are you sure?', () => {
        localStorage.removeItem('invoice_app_v1');
        localStorage.removeItem('dbuilder_v2');
        location.reload();
    });
}

// =========================================
// CLIENTS
// =========================================
function saveClient() {
    const name = document.getElementById('new_client_name').value.trim();
    if (!name) {
        showToast('⚠️ Name is required!');
        return;
    }

    const editId = document.getElementById('edit_client_id').value;

    const client = {
        id: editId || Date.now().toString(),
        companyId: APP_DATA.currentCompanyId,
        name,
        reg: document.getElementById('new_client_reg').value.trim(),
        addr: document.getElementById('new_client_addr').value.trim(),
        email: document.getElementById('new_client_email').value.trim(),
        phone: document.getElementById('new_client_phone').value.trim(),
        note: document.getElementById('new_client_note').value.trim()
    };

    if (editId) {
        const idx = APP_DATA.clients.findIndex(c => c.id === editId);
        if (idx >= 0) APP_DATA.clients[idx] = client;
    } else {
        APP_DATA.clients.push(client);
    }

    saveAppData();
    clearClientForm();
    renderClients();
    refreshClientPicker();
    showToast('✅ Client saved!');
}

function editClient(id) {
    const c = APP_DATA.clients.find(c => c.id === id);
    if (!c) return;

    document.getElementById('edit_client_id').value = c.id;
    document.getElementById('new_client_name').value = c.name;
    document.getElementById('new_client_reg').value = c.reg || '';
    document.getElementById('new_client_addr').value = c.addr || '';
    document.getElementById('new_client_email').value = c.email || '';
    document.getElementById('new_client_phone').value = c.phone || '';
    document.getElementById('new_client_note').value = c.note || '';
    document.getElementById('client-form-title').innerText = 'Edit Client';
    document.getElementById('cancel-edit-btn').style.display = 'flex';
    document.getElementById('new_client_name').focus();
    document.getElementById('new_client_name').scrollIntoView({ behavior: 'smooth' });
}

function cancelClientEdit() {
    clearClientForm();
}

function clearClientForm() {
    document.getElementById('edit_client_id').value = '';
    document.getElementById('new_client_name').value = '';
    document.getElementById('new_client_reg').value = '';
    document.getElementById('new_client_addr').value = '';
    document.getElementById('new_client_email').value = '';
    document.getElementById('new_client_phone').value = '';
    document.getElementById('new_client_note').value = '';
    document.getElementById('client-form-title').innerText = 'New Client';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function deleteClient(id) {
    const c = APP_DATA.clients.find(cl => cl.id === id);
    if (!c) return;

    confirmAction('Delete Client', `Delete "${c.name}"?`, () => {
        APP_DATA.clients = APP_DATA.clients.filter(cl => cl.id !== id);
        saveAppData();
        renderClients();
        refreshClientPicker();
        showToast('🗑️ Client deleted');
    });
}

function useClientForInvoice(id) {
    const c = APP_DATA.clients.find(cl => cl.id === id);
    if (!c) return;

    let info = c.name;
    if (c.reg) info += '\n' + c.reg;
    if (c.addr) info += '\n' + c.addr;
    if (c.email) info += '\n' + c.email;
    if (c.phone) info += '\n' + c.phone;

    APP_DATA.currentInvoice.client = info;
    document.getElementById('client_info').value = info;
    saveAppData();
    showPage('invoice');
    showToast('👤 Client added to invoice');
}

function renderClients() {
    const grid = document.getElementById('clients-grid');
    const companyClients = (APP_DATA.clients || []).filter(c => c.companyId === APP_DATA.currentCompanyId);

    if (!companyClients.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">👤</div><p>No clients yet</p></div>`;
        return;
    }

    grid.innerHTML = companyClients.map(c => `
        <div class="client-card">
            <div class="client-name">${esc(c.name)}</div>
            <div class="client-detail">${[c.reg, c.addr, c.email, c.phone].filter(Boolean).map(esc).join('\n')}</div>
            ${c.note ? `<div style="font-size:12px;color:#a0aec0;margin-top:6px;font-style:italic">${esc(c.note)}</div>` : ''}
            <div class="client-card-actions">
                <button class="hist-btn hist-btn-load" onclick="useClientForInvoice('${c.id}')">📄 Use in Invoice</button>
                <button class="hist-btn" style="background:#eef2ff;color:#4c6ef5;" onclick="editClient('${c.id}')">✏️ Edit</button>
                <button class="hist-btn hist-btn-del" onclick="deleteClient('${c.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function refreshClientPicker() {
    const sel = document.getElementById('client_picker');
    sel.innerHTML = '<option value="">— Select a client —</option>';

    const companyClients = (APP_DATA.clients || []).filter(c => c.companyId === APP_DATA.currentCompanyId);

    companyClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
    });
}

function fillClientFromPicker() {
    const id = document.getElementById('client_picker').value;
    if (!id) return;

    useClientForInvoice(id);
    document.getElementById('client_picker').value = '';
    showPage('invoice');
}

  // =========================================
// COMPANIES
// =========================================

function saveCompany() {
    const name = document.getElementById('new_company_name').value.trim();
    if (!name) {
        showToast('⚠️ Company name is required!');
        return;
    }

    const editId = document.getElementById('edit_company_id').value;

    const selectedLogoKey = ensureLogoAccess(
        document.getElementById('new_company_logo').value || 'shared1'
    );

    const company = {
        id: editId || 'company_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name,
        reg: document.getElementById('new_company_reg').value.trim(),
        addr: document.getElementById('new_company_addr').value.trim(),
        phone: document.getElementById('new_company_phone').value.trim(),
        email: document.getElementById('new_company_email').value.trim(),
        website: document.getElementById('new_company_website').value.trim(),
        bankRecip: document.getElementById('new_company_bank_recip').value.trim(),
        bankName: document.getElementById('new_company_bank_name').value.trim(),
        bankIban: document.getElementById('new_company_bank_iban').value.trim(),
        bankBic: document.getElementById('new_company_bank_bic').value.trim(),
        logoKey: selectedLogoKey
    };

    if (editId) {
        const idx = APP_DATA.companies.findIndex(c => c.id === editId);
        if (idx >= 0) APP_DATA.companies[idx] = company;
    } else {
        APP_DATA.companies.push(company);
    }

    APP_DATA.currentCompanyId = company.id;
    APP_DATA.currentInvoice.companyId = company.id;

    saveAppData();
    clearCompanyForm();
    renderCompanies();
    refreshCompanyPicker();
    renderInvoiceForm();
    renderClients();
    refreshClientPicker();
    refreshOwnerLogoOptionText();

    showToast('✅ Company saved!');
}

function renderCompanies() {
    const grid = document.getElementById('companies-grid');
    if (!grid) return;

    if (!APP_DATA.companies || APP_DATA.companies.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:span 2;">
                <div class="empty-icon">🏢</div>
                <p>No companies yet</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = APP_DATA.companies.map(c => {
        const isCurrent = c.id === APP_DATA.currentCompanyId;

        return `
                <div class="client-card ${isCurrent ? 'current-company-card' : ''}">
                <div class="client-name">${esc(c.name || 'Untitled Company')}</div>
                <div style="font-size:12px;color:#718096;margin-bottom:6px;">
                      ${c.logoKey === 'owner'
                  ? (isOwnerLogoUnlocked() ? 'Logo: 🔓 Your Logo' : 'Logo: 🔒 Your Logo')
                  : c.logoKey === 'shared2'
                  ? 'Logo: Shared Logo 2'
                  : 'Logo: Shared Logo 1'}
                </div>
                <div class="client-detail">${[
                    c.reg,
                    c.addr,
                    c.phone,
                    c.email,
                    c.website
                ].filter(Boolean).map(esc).join('\n')}</div>

                <div style="font-size:12px;color:#a0aec0;margin-top:8px;white-space:pre-wrap;">${[
                    c.bankRecip ? 'Recipient: ' + esc(c.bankRecip) : '',
                    c.bankName ? 'Bank: ' + esc(c.bankName) : '',
                    c.bankIban ? 'IBAN: ' + esc(c.bankIban) : '',
                    c.bankBic ? 'BIC: ' + esc(c.bankBic) : ''
                ].filter(Boolean).join('\n')}</div>

                <div class="client-card-actions">
                    <button class="hist-btn hist-btn-load" onclick="switchCompany('${c.id}')">🏢 Use</button>
                    <button class="hist-btn" style="background:#eef2ff;color:#4c6ef5;" onclick="editCompany('${c.id}')">✏️ Edit</button>
                    <button class="hist-btn hist-btn-del" onclick="deleteCompany('${c.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function editCompany(id) {
    const c = APP_DATA.companies.find(company => company.id === id);
    if (!c) return;

    document.getElementById('edit_company_id').value = c.id;
    document.getElementById('new_company_name').value = c.name || '';
    document.getElementById('new_company_reg').value = c.reg || '';
    document.getElementById('new_company_addr').value = c.addr || '';
    document.getElementById('new_company_phone').value = c.phone || '';
    document.getElementById('new_company_email').value = c.email || '';
    document.getElementById('new_company_website').value = c.website || '';
    document.getElementById('new_company_bank_recip').value = c.bankRecip || '';
    document.getElementById('new_company_bank_name').value = c.bankName || '';
    document.getElementById('new_company_bank_iban').value = c.bankIban || '';
    document.getElementById('new_company_bank_bic').value = c.bankBic || '';
    refreshOwnerLogoOptionText();
    document.getElementById('new_company_logo').value = c.logoKey || 'shared1';

    document.getElementById('company-form-title').innerText = 'Edit Company';
    document.getElementById('cancel-company-edit-btn').style.display = 'flex';
    refreshOwnerLogoOptionText();
    refreshLogoHelpText();
    refreshUnlockLogoButton();

    document.getElementById('new_company_name').focus();
    document.getElementById('new_company_name').scrollIntoView({ behavior: 'smooth' });
}

function cancelCompanyEdit() {
    clearCompanyForm();
}

function clearCompanyForm() {
    document.getElementById('edit_company_id').value = '';
    document.getElementById('new_company_name').value = '';
    document.getElementById('new_company_reg').value = '';
    document.getElementById('new_company_addr').value = '';
    document.getElementById('new_company_phone').value = '';
    document.getElementById('new_company_email').value = '';
    document.getElementById('new_company_website').value = '';
    document.getElementById('new_company_bank_recip').value = '';
    document.getElementById('new_company_bank_name').value = '';
    document.getElementById('new_company_bank_iban').value = '';
    document.getElementById('new_company_bank_bic').value = '';
    document.getElementById('new_company_logo').value = 'shared1';

    document.getElementById('company-form-title').innerText = 'New Company';
    document.getElementById('cancel-company-edit-btn').style.display = 'none';
    refreshOwnerLogoOptionText();
    refreshLogoHelpText();
    refreshUnlockLogoButton();
}

function deleteCompany(id) {
    const c = APP_DATA.companies.find(company => company.id === id);
    if (!c) return;

    if (APP_DATA.companies.length === 1) {
        showToast('⚠️ You need at least one company');
        return;
    }

    confirmAction('Delete Company', `Delete "${c.name}"?`, () => {
        APP_DATA.companies = APP_DATA.companies.filter(company => company.id !== id);

        if (APP_DATA.currentCompanyId === id) {
            APP_DATA.currentCompanyId = APP_DATA.companies[0]?.id || '';
            APP_DATA.currentInvoice.companyId = APP_DATA.currentCompanyId;
            APP_DATA.currentInvoice.client = '';
        }

        saveAppData();
        renderCompanies();
        refreshCompanyPicker();
        renderInvoiceForm();
        renderClients();
        refreshClientPicker();

        showToast('🗑️ Company deleted');
    });
}

function switchCompany(id) {
    if (!id) return;

    const company = APP_DATA.companies.find(c => c.id === id);
    if (!company) return;

    APP_DATA.currentCompanyId = id;

    APP_DATA.currentInvoice = {
        companyId: id,
        num: generateInvoiceNumber(),
        date: getCurrentDate(),
        client: '',
        vatRate: 21,
        vatText: '',
        items: [{ desc: '', qty: 1, price: 0 }]
    };

    saveAppData();
    refreshCompanyPicker();
    renderInvoiceForm();
    renderClients();
    refreshClientPicker();
    showPage('invoice');

    showToast('🏢 New invoice started for selected company');
}

function refreshCompanyPicker() {
    const sel = document.getElementById('company_picker');
    if (!sel) return;

    sel.innerHTML = '<option value="">— Select a company —</option>';

    (APP_DATA.companies || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || 'Untitled Company';
        if (c.id === APP_DATA.currentCompanyId) opt.selected = true;
        sel.appendChild(opt);
    });
}

// =========================================
// PDF EXPORT (jsPDF)
// =========================================
function buildPDFFromInvoice(inv) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const H = 297;
    const margin = 15;

    const L = LANG[currentLang] || LANG.en;
    const co = APP_DATA.companies.find(c => c.id === inv.companyId) || getCurrentCompany() || createEmptyCompany();

    doc.setFillColor(13, 61, 122);
    doc.roundedRect(0, 0, W, 48, 0, 0, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(co.name || '', margin, 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(
        [co.reg, co.addr, co.phone, co.email, co.website].filter(Boolean).join('  |  '),
        margin,
        22,
        { maxWidth: 130 }
    );

    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(L.invoiceWord, W - margin, 20, { align: 'right' });

    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, 52, W - margin * 2, 28, 4, 4, 'F');

    doc.setTextColor(13, 61, 122);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(L.billedTo.toUpperCase(), margin + 4, 59);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);

    const clientLines = (inv.client || '').split('\n').slice(0, 4);
    doc.text(clientLines, margin + 4, 64);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(9);
    doc.text(L.invoiceNum, W / 2 + 10, 59);
    doc.text(L.date, W / 2 + 10, 65);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(inv.num || '', W - margin, 59, { align: 'right' });
    doc.text(inv.date || '', W - margin, 65, { align: 'right' });

    let y = 86;

    doc.setFillColor(13, 61, 122);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(L.description.toUpperCase(), margin + 3, y + 5.5);
    doc.text(L.qty.toUpperCase(), 125, y + 5.5, { align: 'center' });
    doc.text(L.unitPrice.toUpperCase(), 155, y + 5.5, { align: 'center' });
    doc.text(L.amount.toUpperCase(), W - margin - 2, y + 5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const items = inv.items || [];
    let subtotal = 0;

    items.forEach((item, i) => {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        const t = q * p;
        subtotal += t;

        if (i % 2 === 0) {
            doc.setFillColor(248, 250, 254);
            doc.rect(margin, y, W - margin * 2, 8, 'F');
        }

        doc.setTextColor(30, 30, 30);
        const descText = doc.splitTextToSize(item.desc || '', 90);
        doc.text(descText[0] || '', margin + 3, y + 5.5);
        doc.text(q.toString(), 125, y + 5.5, { align: 'center' });
        doc.text('€' + p.toFixed(2), 155, y + 5.5, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 61, 122);
        doc.text('€' + t.toFixed(2), W - margin - 2, y + 5.5, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        y += 8;
    });

    y += 4;

    const vatRate = parseFloat(inv.vatRate) || 0;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    const sW = 80;
    const sX = W - margin - sW;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(L.subtotal, sX, y + 5);
    doc.text('€' + subtotal.toFixed(2), W - margin, y + 5, { align: 'right' });

    y += 7;

    const vatLabel = L.vatLabel(vatRate) + (inv.vatText ? ' ' + inv.vatText : '');
    doc.text(vatLabel, sX, y + 5);
    doc.text('€' + vat.toFixed(2), W - margin, y + 5, { align: 'right' });

    y += 4;

    doc.setFillColor(255, 193, 7);
    doc.roundedRect(sX - 2, y, sW + margin + 2, 12, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(L.total, sX + 2, y + 8.5);
    doc.text('€' + total.toFixed(2), W - margin - 2, y + 8.5, { align: 'right' });

    y += 18;

    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, y, (W - margin * 2) / 2 - 5, 32, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(L.bankDetails.toUpperCase(), margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const bankLines = [
        `${L.recipient}: ${co.bankRecip || ''}`,
        `${L.bank}: ${co.bankName || ''}`,
        `IBAN: ${co.bankIban || ''}`,
        `BIC: ${co.bankBic || ''}`
    ];

    doc.text(bankLines, margin + 4, y + 12, { lineHeightFactor: 1.5 });

    const tX = W / 2 + 2;
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(tX, y, W - margin - tX, 32, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFont('helvetica', 'bold');
    doc.text(L.terms.toUpperCase(), tX + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(L.termsText.replace('\\n', '\n'), tX + 4, y + 12, {
        lineHeightFactor: 1.6,
        maxWidth: W - margin - tX - 4
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
        [co.name, co.email, co.phone, co.website].filter(Boolean).join(' | '),
        W / 2,
        H - 8,
        { align: 'center' }
    );

    return doc;
}

function exportPDF() {
    saveAllData();

    try {
        const doc = buildPDFFromInvoice(APP_DATA.currentInvoice);
        doc.save(`invoice-${APP_DATA.currentInvoice.num || 'draft'}.pdf`);
        showToast('📥 PDF ready!');
    } catch (e) {
        showToast('❌ PDF error: ' + e.message);
    }
}

function exportHistoryPDF(index) {
    const inv = APP_DATA.invoices[index];
    if (!inv) return;

    try {
        const doc = buildPDFFromInvoice(inv);
        doc.save(`invoice-${inv.num || 'draft'}.pdf`);
        showToast('📥 PDF: ' + inv.num);
    } catch (e) {
        showToast('❌ PDF error');
    }
}

 // =========================================
// LOGO RENDER
// =========================================
function getNeutralLogoSVG() {
    return `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="2" width="96" height="96" rx="18" fill="rgba(255,255,255,0.15)"/>
            <rect x="6" y="6" width="88" height="88" rx="15" fill="#0d3d7a"/>
            <path d="M25 35 L50 20 L75 35 L50 50 Z" fill="white"/>
            <path d="M25 50 L50 65 L75 50 L50 35 Z" fill="rgba(255,255,255,0.7)"/>
            <path d="M25 65 L50 80 L75 65 L50 50 Z" fill="white"/>
            <circle cx="50" cy="50" r="6" fill="#0d3d7a"/>
        </svg>
    `;
}

function getLogoMarkup(logoKey) {
    switch (logoKey) {
        case 'neutral':
        default:
            return getNeutralLogoSVG();
    }
}

// =========================================
// HELPERS
// =========================================
function generateInvoiceNumber() {
    const year = new Date().getFullYear();

    const lastNums = (APP_DATA.invoices || [])
        .map(i => i.num)
        .filter(n => n && n.startsWith(year + '-'))
        .map(n => parseInt(n.split('-')[1]) || 0);

    const next = lastNums.length ? Math.max(...lastNums) + 1 : 1;
    return `${year}-${next.toString().padStart(3, '0')}`;
}

function getCurrentDate() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;

    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

function confirmAction(title, msg, callback) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    modalCallback = callback;
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    modalCallback = null;
}

function setTxt(sel, txt) {
    const el = document.querySelector(sel);
    if (el) el.textContent = txt;
}

// =========================================
// LANGUAGE SWITCH
// =========================================
function toggleLang() {
    currentLang = currentLang === 'en' ? 'de' : 'en';
    localStorage.setItem('db_lang', currentLang);
    applyLang();
}

function applyLang() {
    const L = LANG[currentLang];
    const btn = document.getElementById('lang-toggle');

    if (btn) {
        if (currentLang === 'de') {
            btn.textContent = '🇩🇪 DE';
            btn.title = 'Switch to English';
        } else {
            btn.textContent = '🇬🇧 EN';
            btn.title = 'Switch to German';
        }
    }

    const iw = document.querySelector('.invoice-word');
    if (iw) iw.textContent = L.invoiceWord;

    setTxt('.meta-left .meta-label', L.billedTo);
    setTxt('.meta-right .meta-label', L.invoiceDetails);

    const mRows = document.querySelectorAll('.meta-detail-row label');
    if (mRows[0]) mRows[0].textContent = L.invoiceNum;
    if (mRows[1]) mRows[1].textContent = L.date;

    const ths = document.querySelectorAll('.items-table th');
    if (ths[0]) ths[0].textContent = L.description;
    if (ths[1]) ths[1].textContent = L.qty;
    if (ths[2]) ths[2].textContent = L.unitPrice;
    if (ths[3]) ths[3].textContent = L.amount;

    const sumLines = document.querySelectorAll('.summary-line');
    if (sumLines[0]) {
        const firstSpan = sumLines[0].querySelector('span:first-child');
        if (firstSpan) firstSpan.textContent = L.subtotal;
    }

    updateVatLabel();

    const totalBox = document.querySelector('.summary-total span:first-child');
    if (totalBox) totalBox.textContent = L.total;

    const ftitles = document.querySelectorAll('.footer-title');
    if (ftitles[0]) ftitles[0].textContent = L.bankDetails;
    if (ftitles[1]) ftitles[1].textContent = L.terms;

    const termsEl = document.querySelector('.terms-text');
    if (termsEl) termsEl.innerHTML = L.termsText.replace('\n', '<br>');

    const bankLabels = document.querySelectorAll('.bank-row strong');
    if (bankLabels[0]) bankLabels[0].textContent = L.recipient;
    if (bankLabels[1]) bankLabels[1].textContent = L.bank;

    const addBtn = document.querySelector('.add-row-btn');
    if (addBtn) addBtn.innerHTML = L.addRow;

    const picker = document.getElementById('client_picker');
    if (picker && picker.options[0]) picker.options[0].text = L.selectClient;
}

function updateVatLabel() {
    const vatBox = document.querySelector('.summary-vat-label');
    if (!vatBox) return;

    const inputs = vatBox.querySelectorAll('input');
    const vatRateInput = inputs[0];
    const vatTextInput = inputs[1];

    vatBox.innerHTML = '';

    if (currentLang === 'de') {
        vatBox.appendChild(document.createTextNode('MwSt. ('));
    } else {
        vatBox.appendChild(document.createTextNode('VAT ('));
    }

    if (vatRateInput) vatBox.appendChild(vatRateInput);
    vatBox.appendChild(document.createTextNode('%)'));
    vatBox.appendChild(document.createTextNode(' '));
    if (vatTextInput) vatBox.appendChild(vatTextInput);
}
