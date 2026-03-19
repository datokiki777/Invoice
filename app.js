// =========================================
// GLOBAL STATE
// =========================================
let deferredPrompt = null;
let swRegistration = null;
let modalCallback = null;
let currentLang = 'en';
let userAcceptedUpdate = false;
let clientHistoryOptions = [];

// =========================================
// DATA MODEL
// =========================================
// Global: only companies list + active company id
let APP_DATA = {
    companies: [],
    currentCompanyId: ''
};

// Active company's data (loaded per company)
let COMPANY_DATA = {
    invoices: [],
    clients: [],
    currentInvoice: {
        num: '',
        date: '',
        client: '',
        clientId: '',
        vatRate: 0,
        vatText: '',
        items: [{ desc: '', qty: 1, price: 0 }]
    }
};

// ============================
// LOGO PATHS / INLINE SVGs
// ============================

const LOGO_SVG = {
    shared1: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="5" width="90" height="90" rx="18" fill="#ffffff"/>
        <rect x="10" y="10" width="80" height="80" rx="16" fill="#0d3d7a"/>
        <path d="M22 70 L40 35 L50 50 L60 30 L78 70 Z" fill="white"/>
        <circle cx="70" cy="32" r="7" fill="#ffc107"/>
    </svg>`,
    shared2: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="96" height="96" rx="18" fill="rgba(255,255,255,0.15)"/>
        <rect x="6" y="6" width="88" height="88" rx="15" fill="#0d3d7a"/>
        <rect x="22" y="30" width="56" height="9" rx="4.5" fill="white"/>
        <rect x="22" y="46" width="44" height="9" rx="4.5" fill="rgba(255,255,255,0.65)"/>
        <rect x="22" y="62" width="50" height="9" rx="4.5" fill="white"/>
    </svg>`,
    shared3: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="96" height="96" rx="18" fill="rgba(255,255,255,0.15)"/>
        <rect x="6" y="6" width="88" height="88" rx="15" fill="#0d3d7a"/>
        <path d="M25 35 L50 20 L75 35 L50 50 Z" fill="white"/>
        <path d="M25 50 L50 65 L75 50 L50 35 Z" fill="rgba(255,255,255,0.7)"/>
        <path d="M25 65 L50 80 L75 65 L50 50 Z" fill="white"/>
        <circle cx="50" cy="50" r="6" fill="#0d3d7a"/>
    </svg>`,
    none: ``
};

// =========================================
// COMPANY HELPERS
// =========================================

 // ===== BACKUP MENU =====

function toggleBackupMenu() {
    const menu = document.getElementById('backup-menu');
    menu.classList.toggle('show');
}

function closeBackupMenu() {
    const menu = document.getElementById('backup-menu');
    menu.classList.remove('show');
}

// close menu როცა გარეთ დააჭერ
document.addEventListener('click', function (e) {
    const backupWrap = document.querySelector('.backup-menu-wrap');
    if (backupWrap && !backupWrap.contains(e.target)) {
        closeBackupMenu();
    }

    const historyWrap = document.getElementById('client-history-container');
    if (historyWrap && !historyWrap.contains(e.target)) {
        closeClientHistoryDropdown();
    }
});

function getLogoPath(company) {
    if (!company) return LOGO_SVG.shared1;
    const key = company.logoKey || 'shared1';
    return LOGO_SVG[key] || LOGO_SVG.shared1;
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
        logoKey: 'shared1',
        lang: 'en'
    };
}

function createEmptyCompanyData() {
    return {
        invoices: [],
        clients: [],
        currentInvoice: {
            num: '',
            date: getCurrentDate(),
            client: '',
            clientId: '',
            vatRate: 0,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        }
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
    if (!APP_DATA.currentCompanyId && APP_DATA.companies.length > 0) {
        APP_DATA.currentCompanyId = APP_DATA.companies[0].id;
    }
    const exists = APP_DATA.currentCompanyId &&
        APP_DATA.companies.find(c => c.id === APP_DATA.currentCompanyId);
    if (!exists && APP_DATA.companies.length > 0) {
        APP_DATA.currentCompanyId = APP_DATA.companies[0].id;
    }
}

// =========================================
// LOGO — thumbnail picker (4 options)
// =========================================

function ensureLogoAccess(k) { return k || 'shared1'; }

function refreshUnlockLogoButton() {
    const w = document.getElementById('unlock-logo-wrap');
    if (w) w.style.display = 'none';
}

function selectLogoThumbnail(key) {
    const hi = document.getElementById('new_company_logo');
    if (hi) hi.value = key;
    _updateThumbSelection(key);
}

function _updateThumbSelection(activeKey) {
    ['shared1', 'shared2', 'shared3', 'none'].forEach(k => {
        const el = document.getElementById('logo-thumb-' + k);
        if (!el) return;
        if (k === activeKey) {
            el.style.border = '2.5px solid #4c6ef5';
            el.style.background = '#eef2ff';
        } else {
            el.style.border = '2.5px solid transparent';
            el.style.background = '#f0f4ff';
        }
    });
}

function initLogoFormForCompany(company) {
    const key = (company && company.logoKey) || 'shared1';
    const hi = document.getElementById('new_company_logo');
    if (hi) hi.value = key;
    _updateThumbSelection(key);
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
        billedTo: 'Rechnung an',
        invoiceDetails: 'Rechnungsdaten',
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
// STORAGE — per-company isolated
// =========================================

function getCompanyStorageKey(id) {
    return 'invoice_co_' + id;
}

function loadCompanyData(id) {
    if (!id) {
        COMPANY_DATA = createEmptyCompanyData();
        COMPANY_DATA.currentInvoice.num = new Date().getFullYear() + '-001';
        return;
    }

    const raw = localStorage.getItem(getCompanyStorageKey(id));

    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            COMPANY_DATA = {
                invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
                clients: Array.isArray(parsed.clients) ? parsed.clients : [],
                currentInvoice: parsed.currentInvoice || null
            };
        } catch (e) {
            COMPANY_DATA = createEmptyCompanyData();
        }
    } else {
        COMPANY_DATA = createEmptyCompanyData();
    }

    if (
        !COMPANY_DATA.currentInvoice ||
        !COMPANY_DATA.currentInvoice.num ||
        !Array.isArray(COMPANY_DATA.currentInvoice.items) ||
        COMPANY_DATA.currentInvoice.items.length === 0
    ) {
        COMPANY_DATA.currentInvoice = {
            num: generateInvoiceNumber(),
            date: getCurrentDate(),
            client: '',
            clientId: '',
            vatRate: 0,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        };
    }
}

function saveCompanyData() {
    if (!APP_DATA.currentCompanyId) return;
    localStorage.setItem(
        getCompanyStorageKey(APP_DATA.currentCompanyId),
        JSON.stringify(COMPANY_DATA)
    );
}

function saveGlobalData() {
    localStorage.setItem('invoice_global_v2', JSON.stringify({
        companies: APP_DATA.companies,
        currentCompanyId: APP_DATA.currentCompanyId
    }));
}

function loadAppData() {
    // Try new global storage
    const raw = localStorage.getItem('invoice_global_v2');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            APP_DATA.companies = Array.isArray(parsed.companies) ? parsed.companies : [];
            APP_DATA.currentCompanyId = parsed.currentCompanyId || '';
        } catch(e) {}
    } else {
        // Migrate from old invoice_app_v1
        const oldRaw = localStorage.getItem('invoice_app_v1');
        if (oldRaw) {
            try {
                const old = JSON.parse(oldRaw);
                APP_DATA.companies = Array.isArray(old.companies) ? old.companies : [];
                APP_DATA.currentCompanyId = old.currentCompanyId || '';

                // Migrate old data into per-company storage
                APP_DATA.companies.forEach(co => {
                    const coInvoices = (old.invoices || []).filter(i => i.companyId === co.id);
                    const coClients = (old.clients || []).filter(c => c.companyId === co.id);
                    const coInvoice = (old.currentInvoice && old.currentInvoice.companyId === co.id)
                        ? old.currentInvoice : null;
                    localStorage.setItem(getCompanyStorageKey(co.id), JSON.stringify({
                        invoices: coInvoices,
                        clients: coClients,
                        currentInvoice: coInvoice
                    }));
                });

                // Save new global format and clean up old key
                saveGlobalData();
                localStorage.removeItem('invoice_app_v1');
            } catch(e) {}
        }
    }

    if (!Array.isArray(APP_DATA.companies)) APP_DATA.companies = [];

    // Validate currentCompanyId
    if (APP_DATA.currentCompanyId) {
        const exists = APP_DATA.companies.find(c => c.id === APP_DATA.currentCompanyId);
        if (!exists && APP_DATA.companies.length > 0) {
            APP_DATA.currentCompanyId = APP_DATA.companies[0].id;
        }
    } else if (APP_DATA.companies.length > 0) {
        APP_DATA.currentCompanyId = APP_DATA.companies[0].id;
    }

    // Load active company's data
    if (APP_DATA.currentCompanyId) {
        loadCompanyData(APP_DATA.currentCompanyId);
        // Load lang from active company
        const co = getCurrentCompany();
        if (co && co.lang) currentLang = co.lang;
    }
}

function saveAppData() {
    saveGlobalData();
    saveCompanyData();
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

function isIOSSafari() {
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    // Safari on iOS has 'Safari' but NOT 'CriOS' (Chrome) or 'FxiOS' (Firefox) or 'EdgiOS'
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    return isIos && isSafari;
}

function isInStandaloneMode() {
    return window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
}

function showInstallUI() {
    if (isInStandaloneMode()) return;

    const banner = document.getElementById('ios-banner');
    const sheet = document.getElementById('install-sheet');
    const overlay = document.getElementById('install-sheet-overlay');

    if (banner) banner.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }

    if (isIOSSafari()) {
    if (!sessionStorage.getItem('ios_banner_dismissed')) {
        if (banner) {
            banner.hidden = false;
            banner.classList.add('show');
        }
    }
    return;
}

    if (deferredPrompt) {
    if (sheet) {
        sheet.hidden = false;
        sheet.classList.add('show');
    }
    if (overlay) {
        overlay.hidden = false;
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }
}
}

function hideInstallUI() {
    const sheet = document.getElementById('install-sheet');
    const overlay = document.getElementById('install-sheet-overlay');
    const banner = document.getElementById('ios-banner');

    if (sheet) {
        sheet.classList.remove('show');
        sheet.hidden = true;
    }

    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        overlay.hidden = true;
    }

    if (banner) {
        banner.classList.remove('show');
        banner.hidden = true;
    }
}

function dismissInstallSheet() {
    hideInstallUI();
    sessionStorage.setItem('install_prompt_seen', '1');
}

function dismissIOSBanner() {
    const banner = document.getElementById('ios-banner');
    if (banner) {
        banner.classList.remove('show');
        banner.hidden = true;
    }
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
        userAcceptedUpdate = true;
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

    if (isIOSSafari() && !isInStandaloneMode() && !sessionStorage.getItem('ios_banner_dismissed')) {
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

         // reload only after user explicitly accepted update
        if (!userAcceptedUpdate) return;

         refreshing = true;
         window.location.reload();
      });
    }
}

 // =========================================
// PRINT-ONLY CLEANUP HELPERS
// =========================================
let printCleanupFns = [];

function addPrintCleanup(fn) {
    printCleanupFns.push(fn);
}

function runPrintCleanup() {
    while (printCleanupFns.length) {
        const fn = printCleanupFns.pop();
        try { fn(); } catch (e) {}
    }
}

function getElementTextForPrint(el) {
    if (!el) return '';
    if ('value' in el) return String(el.value || '').trim();
    return String(el.textContent || '').trim();
}

function hideElementOnlyForPrint(el) {
    if (!el) return;

    const oldDisplay = el.style.display;
    addPrintCleanup(() => {
        el.style.display = oldDisplay;
    });

    el.style.display = 'none';
}

function styleElementOnlyForPrint(el, styles) {
    if (!el) return;

    const old = {};
    Object.keys(styles).forEach(key => {
        old[key] = el.style[key];
    });

    addPrintCleanup(() => {
        Object.keys(old).forEach(key => {
            el.style[key] = old[key];
        });
    });

    Object.assign(el.style, styles);
}

function findPrintableRow(el) {
    if (!el) return null;

    return el.closest(
        '.bank-row, .company-row, .company-line, .meta-company-row, .meta-company-line, .detail-row, .info-row, .info-line'
    ) || el.parentElement;
}

function hideFieldRowIfEmptyForPrint(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;

    const text = getElementTextForPrint(el);
    if (text) return;

    const row = findPrintableRow(el);
    hideElementOnlyForPrint(row || el);
}

function hideBankCardIfFullyEmptyForPrint() {
    const ids = ['bank_recip_span', 'bank_name_span', 'bank_iban_span', 'bank_bic_span'];
    const hasAnyValue = ids.some(id => {
        const el = document.getElementById(id);
        return el && getElementTextForPrint(el);
    });

    if (hasAnyValue) return;

    const bankSpan = document.getElementById('bank_recip_span')
        || document.getElementById('bank_name_span')
        || document.getElementById('bank_iban_span')
        || document.getElementById('bank_bic_span');

    if (!bankSpan) return;

    const bankCard = bankSpan.closest('.footer-card, .footer-box, .bank-box, .bank-details-box');
    if (bankCard) {
        hideElementOnlyForPrint(bankCard);
    }
}

function compactVatForPrint() {
    const vatRateInput = document.getElementById('vat_rate');
    const vatTextInput = document.getElementById('vat_text');
    const vatBox = document.querySelector('.summary-vat-label');

    if (vatRateInput) {
        styleElementOnlyForPrint(vatRateInput, {
            width: '32px',
            minWidth: '32px',
            padding: '0',
            margin: '0 2px',
            textAlign: 'center'
        });
    }

    if (vatTextInput) {
        const note = (vatTextInput.value || '').trim();

        if (!note) {
            styleElementOnlyForPrint(vatTextInput, {
                display: 'none',
                width: '0',
                minWidth: '0',
                padding: '0',
                margin: '0',
                border: '0'
            });
        } else {
            styleElementOnlyForPrint(vatTextInput, {
                marginLeft: '4px'
            });
        }
    }

    if (vatBox) {
        styleElementOnlyForPrint(vatBox, {
            gap: '0',
            letterSpacing: '0'
        });
    }
}

function preparePrintLayout() {
    runPrintCleanup();

    calculateAll();

    const vatRateInput = document.getElementById('vat_rate');
    if (vatRateInput) {
        const rawVat = parseFloat(vatRateInput.value);
        if (vatRateInput.value.trim() === '' || isNaN(rawVat) || rawVat < 0) {
            vatRateInput.value = '0';
        }
    }

    // COMPANY block: hide empty lines only on print
    hideFieldRowIfEmptyForPrint('my_reg_no');
    hideFieldRowIfEmptyForPrint('my_addr');
    hideFieldRowIfEmptyForPrint('my_phone');
    hideFieldRowIfEmptyForPrint('my_email');
    hideFieldRowIfEmptyForPrint('my_website');

    // BANK block: hide empty rows only on print
    hideFieldRowIfEmptyForPrint('bank_recip_span');
    hideFieldRowIfEmptyForPrint('bank_name_span');
    hideFieldRowIfEmptyForPrint('bank_iban_span');
    hideFieldRowIfEmptyForPrint('bank_bic_span');

    // If whole bank card is empty, hide full bank card
    hideBankCardIfFullyEmptyForPrint();

    // VAT line: keep visible, but make compact
    const vatLine = document.getElementById('vat_summary_line');
    if (vatLine) {
        vatLine.style.display = '';
    }

    compactVatForPrint();
}

function restorePrintLayout() {
    runPrintCleanup();
    refreshVatVisibility();
}

// =========================================
// INIT
// =========================================
window.onload = function () {
    loadAppData();
    ensureCurrentCompany();

    const todayStatus = document.getElementById('today_status');
    if (todayStatus) {
        todayStatus.innerText = '📅 ' + getCurrentDate();
    }

    // If no companies yet — go straight to Companies page
    const noCompanies = !APP_DATA.companies || APP_DATA.companies.length === 0;

    // Load language from current company
    const co = getCurrentCompany();
    if (co && co.lang) {
        currentLang = co.lang;
    } else {
        currentLang = localStorage.getItem('db_lang') || 'en';
    }

    renderInvoiceForm();
    renderHistory();
    renderClients();
    toggleClientForm(false);
    renderCompanies();
    if (noCompanies) {
    toggleCompanyForm(true);
} else {
    toggleCompanyForm(false);
}
    refreshClientPicker();
    refreshNavCompanyPicker();
    refreshUnlockLogoButton();
    initLogoFormForCompany(getCurrentCompany());
    applyLang();
    initPWA();

    // No companies → open Companies page so user can add one
    if (noCompanies) {
        showPage('companies');
        setTimeout(() => showToast('🏢 Add your first company to get started!'), 600);
    }

    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    if (modalConfirmBtn) {
        modalConfirmBtn.onclick = function () {
            const cb = modalCallback;
            closeModal();
            if (cb) cb();
        };
    }

    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function (e) {
            if (e.target === this) closeModal();
        });
    }

    // ---- PRINT: PDF-only cleanup + compact VAT ----
    
    window.addEventListener('beforeprint', function () {
        preparePrintLayout();
    });

    window.addEventListener('afterprint', function () {
        restorePrintLayout();
    });
};

// =========================================
// PAGE NAVIGATION
// =========================================

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(t => t.classList.remove('active'));

    const page = document.getElementById('page-' + name);
    const tab = document.getElementById('tab-' + name);
    const bottomTab = document.querySelector(`.bottom-nav-item[data-page="${name}"]`);

    if (page) page.classList.add('active');
    if (tab) tab.classList.add('active');
    if (bottomTab) bottomTab.classList.add('active');

    if (name === 'history') renderHistory();
    if (name === 'clients') renderClients();
    if (name === 'companies') renderCompanies();
}

// =========================================
// INVOICE FORM
// =========================================
function renderInvoiceForm() {
    const ci = COMPANY_DATA.currentInvoice;
    const co = getCurrentCompany() || createEmptyCompany();

    document.getElementById('my_comp_name').value = co.name || '';
    document.getElementById('my_reg_no').value = co.reg || '';
    document.getElementById('my_addr').value = co.addr || '';
    document.getElementById('my_phone').value = co.phone || '';
    document.getElementById('my_email').value = co.email || '';
    document.getElementById('my_website').value = co.website || '';

    const bankRecipValue = ci.bankRecip !== undefined ? ci.bankRecip : (co.bankRecip || '');
    const bankNameValue = ci.bankName !== undefined ? ci.bankName : (co.bankName || '');
    const bankIbanValue = ci.bankIban !== undefined ? ci.bankIban : (co.bankIban || '');
    const bankBicValue = ci.bankBic !== undefined ? ci.bankBic : (co.bankBic || '');

    document.getElementById('bank_recip').value = bankRecipValue;
    document.getElementById('bank_name').value = bankNameValue;
    document.getElementById('bank_iban').value = bankIbanValue;
    document.getElementById('bank_bic').value = bankBicValue;

    // Sync print spans so bank details always show on print
    const bankPrintMap = {
        bank_recip_span: bankRecipValue,
        bank_name_span: bankNameValue,
        bank_iban_span: bankIbanValue,
        bank_bic_span: bankBicValue
};
    Object.entries(bankPrintMap).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '';
    });

    document.getElementById('inv_num').value = ci.num || '';
    document.getElementById('inv_date').value = ci.date || '';
    document.getElementById('client_info').value = ci.client || '';
    document.getElementById('vat_rate').value = (ci.vatRate != null) ? ci.vatRate : 0;
    document.getElementById('vat_text').value = ci.vatText || '';

    if (!ci.items || !Array.isArray(ci.items) || ci.items.length === 0) {
        ci.items = [{ desc: '', qty: 1, price: 0 }];
    }

    renderItemRows();
    calculateAll();

    // Logo
    const logoWrap = document.getElementById('logo-wrap');
    if (logoWrap) {
        const key = co.logoKey || 'shared1';
        logoWrap.innerHTML = key === 'none' ? '' : (LOGO_SVG[key] || LOGO_SVG.shared1);
    }

    // Restore client picker to saved selection
    
    const picker = document.getElementById('client_picker');
    if (picker) {
    picker.value = ci.clientId || '';
     }

    refreshVatVisibility();
    updateClientPrintBlock();
}

function renderItemRows() {
    const tbody = document.getElementById('items-body');
    tbody.innerHTML = '';

    COMPANY_DATA.currentInvoice.items.forEach((item, i) => {
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
                ${COMPANY_DATA.currentInvoice.items.length > 1 ? `<button class="remove-row-btn" onclick="removeItemRow(${i})" title="Delete">✕</button>` : ''}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function updateItem(index, field, value) {
    COMPANY_DATA.currentInvoice.items[index][field] = value;
    calculateAll();
    saveAppData();
}

function addItemRow() {
    COMPANY_DATA.currentInvoice.items.push({ desc: '', qty: 1, price: 0 });
    renderItemRows();
    calculateAll();
    saveAppData();

    const rows = document.querySelectorAll('.item-desc-input');
    if (rows.length) rows[rows.length - 1].focus();
}

function removeItemRow(index) {
    COMPANY_DATA.currentInvoice.items.splice(index, 1);
    renderItemRows();
    calculateAll();
    saveAppData();
}

 function cleanupInvoiceItemsForSave() {
    if (!COMPANY_DATA.currentInvoice || !Array.isArray(COMPANY_DATA.currentInvoice.items)) {
        return;
    }

    COMPANY_DATA.currentInvoice.items = COMPANY_DATA.currentInvoice.items.filter(item => {
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        const amount = qty * price;

        // დარჩეს მხოლოდ ის row, რომელსაც თანხა აქვს
        return amount > 0;
    });

    // თუ არაფერი დარჩა, ფორმა სულ არ დაიცალოს
    if (COMPANY_DATA.currentInvoice.items.length === 0) {
        COMPANY_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }
}

function refreshVatVisibility() {
    const vatLine = document.getElementById('vat_summary_line');
    const vatTextInput = document.getElementById('vat_text');

    if (!vatLine || !vatTextInput) return;

    // VAT row ყოველთვის ჩანდეს
    vatLine.style.display = '';

    // edit რეჟიმში note ველი ყოველთვის ჩანდეს
    vatTextInput.style.display = '';
}

function calculateAll() {
    const items = COMPANY_DATA.currentInvoice.items;
    let subtotal = 0;

    items.forEach((item, i) => {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        const t = q * p;
        subtotal += t;

        const el = document.getElementById('row-total-' + i);
        if (el) el.innerText = t.toFixed(2);
    });

    const vatRateInput = document.getElementById('vat_rate');
    const vatTextInput = document.getElementById('vat_text');

    const rawVat = parseFloat(vatRateInput?.value);
    const vatRate = (!isNaN(rawVat) && rawVat > 0) ? rawVat : 0;

    COMPANY_DATA.currentInvoice.vatRate = vatRate;
    COMPANY_DATA.currentInvoice.vatText = vatTextInput ? vatTextInput.value.trim() : '';

    const vat = vatRate > 0 ? subtotal * (vatRate / 100) : 0;
    const total = subtotal + vat;

    document.getElementById('subtotal_display').innerText = subtotal.toFixed(2);
    document.getElementById('vat_amount').innerText = vat.toFixed(2);
    document.getElementById('grand_total').innerText = total.toFixed(2);

    saveAppData();
}

function saveAllData() {
    COMPANY_DATA.currentInvoice.num = document.getElementById('inv_num').value;
    COMPANY_DATA.currentInvoice.date = document.getElementById('inv_date').value;
    COMPANY_DATA.currentInvoice.client = document.getElementById('client_info').value;

    const vatRaw = document.getElementById('vat_rate').value.trim();
    COMPANY_DATA.currentInvoice.vatRate = vatRaw === '' ? 0 : (parseFloat(vatRaw) || 0);

    COMPANY_DATA.currentInvoice.vatText = document.getElementById('vat_text').value.trim();

    calculateAll();
    updateClientPrintBlock();
    saveAppData();
}

// =========================================
// INVOICE HISTORY
// =========================================

 function saveInvoiceToHistory() {
 	// შეცდომების შემოწმება
const errors = validateInvoiceBeforeSave();
if (errors.length > 0) {
    showToast(errors[0]);
    return;
}
    const company = getCurrentCompany();
    if (!company) {
        showToast('⚠️ No company selected');
        return;
    }

    // ჯერ ფორმიდან წამოიღოს ყველა მიმდინარე მნიშვნელობა
    saveAllData();

    // save-ის წინ გაწმინდოს 0-თანხიანი row-ები
    cleanupInvoiceItemsForSave();

    const ci = COMPANY_DATA.currentInvoice;

    // შევინახოთ კლიენტის ბოლო description (პირველი item-ის desc)
    if (ci.clientId && ci.items && ci.items[0] && ci.items[0].desc) {
        saveClientLastDescription(ci.clientId, ci.items[0].desc);
    }

    const hasAmountRow = (ci.items || []).some(item => {
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        return qty * price > 0;
    });

    if (!hasAmountRow) {
        showToast('⚠️ Invoice has no amount to save');
        return;
    }

    const invoiceCopy = JSON.parse(JSON.stringify(ci));
    // clientId უკვე არის currentInvoice-ში, აღარ გვჭირდება დამატებითი შემოწმება
    invoiceCopy.savedAt = new Date().toISOString();

    // ბანკის მონაცემებიც შეინახოს snapshot-ად
    invoiceCopy.bankRecip = company.bankRecip || '';
    invoiceCopy.bankName = company.bankName || '';
    invoiceCopy.bankIban = company.bankIban || '';
    invoiceCopy.bankBic = company.bankBic || '';

    const existingIndex = COMPANY_DATA.invoices.findIndex(inv => inv.num === invoiceCopy.num);

    if (existingIndex >= 0) {
        COMPANY_DATA.invoices[existingIndex] = invoiceCopy;
        showToast('💾 Invoice updated');
    } else {
        COMPANY_DATA.invoices.unshift(invoiceCopy);
        showToast('✅ Invoice saved');
    }
    COMPANY_DATA.currentInvoice = JSON.parse(JSON.stringify(invoiceCopy));
    delete COMPANY_DATA.currentInvoice.savedAt;

    saveAppData();
    renderHistory();
    renderInvoiceForm();
}

function renderHistory() {
    const list = document.getElementById('history-list');

    const companyInvoices = (COMPANY_DATA.invoices || [])
        .map((inv, realIdx) => ({ inv, realIdx }));

    if (companyInvoices.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🗂️</div><p>No invoices saved yet</p></div>`;
        return;
    }

    list.innerHTML = companyInvoices.map(({ inv, realIdx }) => {
        const subtotal = (inv.items || []).reduce(
            (s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0),
            0
        );
        const vat = subtotal * ((parseFloat(inv.vatRate) || 0) / 100);
        const total = subtotal + vat;

        const isCurrent =
        inv.num === COMPANY_DATA.currentInvoice.num &&
       JSON.stringify(inv.items || []) === JSON.stringify(COMPANY_DATA.currentInvoice.items || []) &&
       (inv.client || '') === (COMPANY_DATA.currentInvoice.client || '') &&
       (inv.date || '') === (COMPANY_DATA.currentInvoice.date || '');
        const clientName = (inv.client || '').split('\n')[0] || 'No client';

        const savedDate = inv.savedAt
            ? new Date(inv.savedAt).toLocaleDateString('ka-GE')
            : '';

        return `
        <div class="history-card ${isCurrent ? 'current' : ''}">
            <div class="hist-left">
                <div class="hist-num">${esc(inv.num)}</div>
                <div class="hist-client">${esc(clientName)}</div>
                <div class="hist-meta">📅 ${esc(inv.date)}</div>

                <div class="hist-actions">
                    <button class="hist-btn hist-btn-load" onclick="loadInvoiceFromHistory(${realIdx})">📂 Open</button>
                    <button class="hist-btn hist-btn-print" onclick="printInvoiceFromHistory(${realIdx})">🖨️ Print</button>
                    <button class="hist-btn hist-btn-del" onclick="deleteInvoice(${realIdx})">🗑️ Delete</button>
                </div>
            </div>

            <div class="hist-right">
                <div class="hist-subtotal">€${subtotal.toFixed(2)}</div>
                <div class="hist-date">${savedDate ? 'Saved: ' + savedDate : ''}</div>

                <span class="hist-badge ${isCurrent ? 'badge-current' : 'badge-saved'}">
                    ${isCurrent ? '● Current' : '✓ Saved'}
                </span>

                <div class="hist-total-block">
                    <div class="hist-total-label">TOTAL</div>
                    <div class="hist-amount">€${total.toFixed(2)}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function loadInvoiceFromHistory(index) {
    const loaded = JSON.parse(JSON.stringify(COMPANY_DATA.invoices[index]));
    if (!loaded) return;

    delete loaded.savedAt;

    COMPANY_DATA.currentInvoice = loaded;

    if (!COMPANY_DATA.currentInvoice.items || COMPANY_DATA.currentInvoice.items.length === 0) {
        COMPANY_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }
    
    // აღადგინე clientId client_picker-ში
    if (loaded.clientId) {
    const picker = document.getElementById('client_picker');
    if (picker) {
        picker.value = loaded.clientId;
    }
}

    saveAppData();
    renderInvoiceForm();
    refreshClientPicker();
    showPage('invoice');
    showToast('📂 Invoice loaded');
}

function printInvoiceFromHistory(index) {
    // Load invoice into the form, then print — without changing currentInvoice permanently
    const inv = COMPANY_DATA.invoices[index];
    if (!inv) return;

    // Temporarily swap in the selected invoice
    const previousInvoice = JSON.parse(JSON.stringify(COMPANY_DATA.currentInvoice));
   
    COMPANY_DATA.currentInvoice = JSON.parse(JSON.stringify(inv));
    if (!COMPANY_DATA.currentInvoice.items || !COMPANY_DATA.currentInvoice.items.length) {
        COMPANY_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }

    renderInvoiceForm();
    refreshClientPicker();

    // Switch to invoice page so print captures it correctly
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const invoicePage = document.getElementById('page-invoice');
    if (invoicePage) invoicePage.classList.add('active');

    // Print, then restore everything — longer delay so calculateAll() has time to render
    setTimeout(() => {
        window.print();

        // Restore previous state after print dialog closes
        setTimeout(() => {
            COMPANY_DATA.currentInvoice = previousInvoice;
         
            renderInvoiceForm();
            refreshClientPicker();
            showPage('history');
        }, 500);
    }, 350);
}

function deleteInvoice(index) {
    confirmAction('Delete Invoice', `Delete invoice #${COMPANY_DATA.invoices[index].num}? This cannot be undone.`, () => {
        COMPANY_DATA.invoices.splice(index, 1);
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
        const nextNum = generateInvoiceNumber();

        COMPANY_DATA.currentInvoice = {
            num: nextNum,
            date: getCurrentDate(),
            client: '',
            clientId: '',
            vatRate: 0,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        };

        saveAppData();
        renderInvoiceForm();
        refreshClientPicker();
        showPage('invoice');
        showToast('➕ New Invoice');
    });
}

// =========================================
// CLIENTS
// =========================================

  function toggleClientForm(forceOpen = null) {
    const card = document.getElementById('client-form-card');
    const body = document.getElementById('client-form-body');
    const toggle = document.getElementById('client-form-toggle');

    if (!card || !body || !toggle) return;

    const isCollapsed = card.classList.contains('collapsed');
    const shouldOpen = forceOpen !== null ? forceOpen : isCollapsed;

    if (shouldOpen) {
        card.classList.remove('collapsed');
        body.style.display = 'block';
        toggle.textContent = '▾';
    } else {
        card.classList.add('collapsed');
        body.style.display = 'none';
        toggle.textContent = '▸';
    }
}

function saveClient() {
    const name = document.getElementById('new_client_name').value.trim();
    if (!name) {
        showToast('⚠️ Name is required!');
        return;
    }

    const editId = document.getElementById('edit_client_id').value;

    const client = {
        id: editId || Date.now().toString(),
        name,
        reg: document.getElementById('new_client_reg').value.trim(),
        addr: document.getElementById('new_client_addr').value.trim(),
        email: document.getElementById('new_client_email').value.trim(),
        phone: document.getElementById('new_client_phone').value.trim(),
        note: document.getElementById('new_client_note').value.trim()
    };

    if (editId) {
        const idx = COMPANY_DATA.clients.findIndex(c => c.id === editId);
        if (idx >= 0) COMPANY_DATA.clients[idx] = client;
    } else {
        COMPANY_DATA.clients.push(client);
    }

    saveAppData();
    clearClientForm();
    renderClients();
    refreshClientPicker();
    showToast('✅ Client saved!');
}

function editClient(id) {
    const c = COMPANY_DATA.clients.find(c => c.id === id);
    if (!c) return;

    confirmAction('Edit Client', `Edit "${c.name}"?`, () => {
        document.getElementById('edit_client_id').value = c.id;
        document.getElementById('new_client_name').value = c.name;
        document.getElementById('new_client_reg').value = c.reg || '';
        document.getElementById('new_client_addr').value = c.addr || '';
        document.getElementById('new_client_email').value = c.email || '';
        document.getElementById('new_client_phone').value = c.phone || '';
        document.getElementById('new_client_note').value = c.note || '';
        document.getElementById('client-form-title').innerText = 'Edit Client';
        document.getElementById('cancel-edit-btn').style.display = 'flex';
        toggleClientForm(true);
        document.getElementById('new_client_name').focus();
        document.getElementById('new_client_name').scrollIntoView({ behavior: 'smooth' });
    });
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
    toggleClientForm(false);
}

function deleteClient(id) {
    const c = COMPANY_DATA.clients.find(cl => cl.id === id);
    if (!c) return;

    confirmAction('Delete Client', `Delete "${c.name}"?`, () => {
        COMPANY_DATA.clients = COMPANY_DATA.clients.filter(cl => cl.id !== id);
        saveAppData();
        renderClients();
        refreshClientPicker();
        showToast('🗑️ Client deleted');
    });
}

// =========================================
// CLIENT DESCRIPTION HISTORY
// =========================================

function saveClientLastDescription(clientId, description) {
    if (!clientId || !description) return;
    const client = COMPANY_DATA.clients.find(c => c.id === clientId);
    if (!client) return;

    client.lastDescription = description;

    if (!client.descriptionHistory) client.descriptionHistory = [];

    if (client.descriptionHistory[0] !== description) {
        client.descriptionHistory.unshift(description);
        if (client.descriptionHistory.length > 3) {
            client.descriptionHistory = client.descriptionHistory.slice(0, 3);
        }
    }

    saveAppData();
}

function loadClientLastDescription(clientId) {
    if (!clientId) return '';
    const client = COMPANY_DATA.clients.find(c => c.id === clientId);
    if (!client) return '';
    return client.lastDescription || '';
}

function toggleClientHistoryDropdown() {
    const wrap = document.getElementById('client-history-container');
    if (!wrap || wrap.style.display === 'none') return;
    wrap.classList.toggle('open');
}

function closeClientHistoryDropdown() {
    const wrap = document.getElementById('client-history-container');
    if (wrap) wrap.classList.remove('open');
}

function renderClientHistoryDropdown(options) {
    clientHistoryOptions = Array.isArray(options) ? options : [];

    const container = document.getElementById('client-history-container');
    const menu = document.getElementById('client-history-menu');
    const trigger = document.getElementById('client-history-trigger');

    if (!container || !menu || !trigger) return;

    closeClientHistoryDropdown();

    if (!clientHistoryOptions.length) {
        container.style.display = 'none';
        menu.innerHTML = '';
        return;
    }

    container.style.display = 'block';
    trigger.querySelector('span').textContent = '📋 Load previous description...';

    menu.innerHTML = clientHistoryOptions.map((text, index) => `
        <button type="button" class="client-history-item" onclick="selectClientHistoryDescription(${index})">
            <span class="client-history-text">${esc(text)}</span>
        </button>
    `).join('');
}

function selectClientHistoryDescription(index) {
    const value = clientHistoryOptions[index];
    if (!value) return;
    loadDescriptionFromHistory(value);
    closeClientHistoryDropdown();
}

function refreshDescriptionHistoryDropdown(clientId) {
    const container = document.getElementById('client-history-container');
    if (!container) return;

    const client = (COMPANY_DATA.clients || []).find(c => c.id === clientId);

    if (!client) {
        renderClientHistoryDropdown([]);
        return;
    }

    let descriptions = [];

    if (Array.isArray(client.descriptionHistory)) {
        descriptions = client.descriptionHistory
            .map(x => String(x || '').trim())
            .filter(Boolean);
    }

    if (client.lastDescription && String(client.lastDescription).trim()) {
        const last = String(client.lastDescription).trim();
        descriptions = [last, ...descriptions.filter(x => x !== last)];
    }

    renderClientHistoryDropdown(descriptions);
}

function loadDescriptionFromHistory(value) {
    if (!value) return;

    if (!COMPANY_DATA.currentInvoice.items || !COMPANY_DATA.currentInvoice.items.length) {
        COMPANY_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }

    COMPANY_DATA.currentInvoice.items[0].desc = value;
    renderItemRows();
    calculateAll();
    saveAppData();
    showToast('📝 Description loaded');
}

function useClientForInvoice(id) {
    const c = COMPANY_DATA.clients.find(cl => cl.id === id);
    if (!c) return;

    let info = c.name;
    if (c.reg) info += '\n' + c.reg;
    if (c.addr) info += '\n' + c.addr;
    if (c.email) info += '\n' + c.email;
    if (c.phone) info += '\n' + c.phone;

    COMPANY_DATA.currentInvoice.client = info;
    COMPANY_DATA.currentInvoice.clientId = id;
    document.getElementById('client_info').value = info;

    // ბოლო description პირველ item-ში
    const lastDesc = loadClientLastDescription(id);
    if (lastDesc && COMPANY_DATA.currentInvoice.items && COMPANY_DATA.currentInvoice.items[0]) {
        COMPANY_DATA.currentInvoice.items[0].desc = lastDesc;
    }

    saveAppData();
    renderClients();
    refreshDescriptionHistoryDropdown(id);
    showPage('invoice');
    renderInvoiceForm();
    showToast('👤 Client added to invoice');
}

function renderClients() {
    const grid = document.getElementById('clients-grid');
    const companyClients = COMPANY_DATA.clients || [];

    if (!companyClients.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">👤</div><p>No clients yet</p></div>`;
        return;
    }

    grid.innerHTML = companyClients.map(c => `
    <div class="client-card ${COMPANY_DATA.currentInvoice.clientId === c.id ? 'active-client-card' : ''}">
            <div class="client-name">${esc(c.name)}</div>
            <div class="client-detail">${[c.reg, c.addr, c.email, c.phone].filter(Boolean).map(esc).join('\n')}</div>
            ${c.note ? `<div style="font-size:12px;color:#a0aec0;margin-top:6px;font-style:italic">${esc(c.note)}</div>` : ''}
            ${c.lastDescription ? `
            <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #e2e8f0;">
                <div style="font-size:11px;font-weight:600;color:#4c6ef5;margin-bottom:2px;">📝 Last description:</div>
                <div style="font-size:12px;color:#2d3748;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.lastDescription)}</div>
            </div>
            ` : ''}
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
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select a client —</option>';

    const companyClients = COMPANY_DATA.clients || [];

    companyClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        if (COMPANY_DATA.currentInvoice.clientId && COMPANY_DATA.currentInvoice.clientId === c.id) {
            opt.selected = true;
        }
        sel.appendChild(opt);
    });
}

function fillClientFromPicker() {
    const id = document.getElementById('client_picker').value;
    if (!id) {
        COMPANY_DATA.currentInvoice.client = '';
        COMPANY_DATA.currentInvoice.clientId = '';
        document.getElementById('client_info').value = '';
        const container = document.getElementById('client-history-container');
        if (container) container.style.display = 'none';
        saveAppData();
        return;
    }

    const c = COMPANY_DATA.clients.find(cl => cl.id === id);
    if (!c) {
        document.getElementById('client_picker').value = '';
        showToast('⚠️ Selected client not found');
        return;
    }

    let info = c.name;
    if (c.reg) info += '\n' + c.reg;
    if (c.addr) info += '\n' + c.addr;
    if (c.email) info += '\n' + c.email;
    if (c.phone) info += '\n' + c.phone;

    COMPANY_DATA.currentInvoice.client = info;
    COMPANY_DATA.currentInvoice.clientId = id;
    document.getElementById('client_info').value = info;

    // ბოლო description პირველ item-ში (textarea-ში არ ჩაემატოს!)
    const lastDesc = loadClientLastDescription(id);
    if (lastDesc && COMPANY_DATA.currentInvoice.items && COMPANY_DATA.currentInvoice.items[0]) {
        COMPANY_DATA.currentInvoice.items[0].desc = lastDesc;
    }

    refreshDescriptionHistoryDropdown(id);
    saveAppData();
    renderClients();
    renderInvoiceForm();
    showToast('👤 ' + c.name);
}

  // =========================================
// COMPANIES
// =========================================

  function toggleCompanyForm(forceOpen = null) {
    const card = document.getElementById('company-form-card');
    const body = document.getElementById('company-form-body');
    const toggle = document.getElementById('company-form-toggle');

    if (!card || !body || !toggle) return;

    const isCollapsed = card.classList.contains('collapsed');
    const shouldOpen = forceOpen !== null ? forceOpen : isCollapsed;

    if (shouldOpen) {
        card.classList.remove('collapsed');
        body.style.display = 'block';
        toggle.textContent = '▾';
    } else {
        card.classList.add('collapsed');
        body.style.display = 'none';
        toggle.textContent = '▸';
    }
}

function saveCompany() {
    const name = document.getElementById('new_company_name').value.trim();
    if (!name) {
        showToast('⚠️ Company name is required!');
        return;
    }

    const editId = document.getElementById('edit_company_id').value;

    const selectedLogoKey = document.getElementById('new_company_logo').value || 'shared1';
    const existingCompany = editId ? APP_DATA.companies.find(c => c.id === editId) : null;

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
        logoKey: selectedLogoKey,
        lang: existingCompany ? (existingCompany.lang || 'en') : 'en'
    };

    if (editId) {
        const idx = APP_DATA.companies.findIndex(c => c.id === editId);
        if (idx >= 0) APP_DATA.companies[idx] = company;
    } else {
        APP_DATA.companies.push(company);
    }

    const isFirstCompany = !editId && APP_DATA.companies.length === 1;
    const previousCompanyId = APP_DATA.currentCompanyId;

    if (!editId) {
        saveAllData();
        saveCompanyData();

        APP_DATA.currentCompanyId = company.id;
        COMPANY_DATA = createEmptyCompanyData();
        COMPANY_DATA.currentInvoice.num = new Date().getFullYear() + '-001';
    } else if (editId !== previousCompanyId) {
        // Editing a different (non-active) company:
        // save current active company's data first, then load the edited company's data
        saveCompanyData();
        APP_DATA.currentCompanyId = company.id;
        loadCompanyData(company.id);
    } else {
        // Editing the currently active company — just update currentCompanyId (same)
        APP_DATA.currentCompanyId = company.id;
    }

    saveAppData();
    clearCompanyForm();
    refreshNavCompanyPicker();
    renderCompanies();
    renderInvoiceForm();
    renderClients();
    refreshClientPicker();
    renderHistory();
    currentLang = company.lang || 'en';
    applyLang();

    if (isFirstCompany) {
        showPage('invoice');
        showToast('✅ Company saved! Start creating your invoice.');
    } else {
        showToast('✅ Company saved!');
    }
}

function renderCompanies() {
    const grid = document.getElementById('companies-grid');
    if (!grid) return;

    const currentCompany = getCurrentCompany();

    if (!currentCompany) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:span 2;">
                <div class="empty-icon">🏢</div>
                <p>No company selected</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = `
        <div class="client-card current-company-card">
            <div class="client-name">${esc(currentCompany.name || 'Untitled Company')}</div>
            <div style="font-size:12px;color:#718096;margin-bottom:6px;">
                ${currentCompany.logoKey === 'none'
                    ? 'Logo: None'
                    : currentCompany.logoKey === 'shared3'
                    ? 'Logo: Shared 3'
                    : currentCompany.logoKey === 'shared2'
                    ? 'Logo: Shared 2'
                    : 'Logo: Shared 1'}
            </div>

            <div class="client-detail">${[
                currentCompany.reg,
                currentCompany.addr,
                currentCompany.phone,
                currentCompany.email,
                currentCompany.website
            ].filter(Boolean).map(esc).join('\n')}</div>

            <div style="font-size:12px;color:#a0aec0;margin-top:8px;white-space:pre-wrap;">${[
                currentCompany.bankRecip ? 'Recipient: ' + esc(currentCompany.bankRecip) : '',
                currentCompany.bankName ? 'Bank: ' + esc(currentCompany.bankName) : '',
                currentCompany.bankIban ? 'IBAN: ' + esc(currentCompany.bankIban) : '',
                currentCompany.bankBic ? 'BIC: ' + esc(currentCompany.bankBic) : ''
            ].filter(Boolean).join('\n')}</div>

            <div class="client-card-actions">
                <button class="hist-btn" style="background:#eef2ff;color:#4c6ef5;" onclick="editCompany('${currentCompany.id}')">✏️ Edit</button>
                <button class="hist-btn hist-btn-del" onclick="deleteCompany('${currentCompany.id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

function editCompany(id) {
    const c = APP_DATA.companies.find(company => company.id === id);
    if (!c) return;

    confirmAction('Edit Company', `Edit "${c.name}"?`, () => {
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
        initLogoFormForCompany(c);

        document.getElementById('company-form-title').innerText = 'Edit Company';
        document.getElementById('cancel-company-edit-btn').style.display = 'flex';
        refreshUnlockLogoButton();
        toggleCompanyForm(true);

        document.getElementById('new_company_name').focus();
        document.getElementById('new_company_name').scrollIntoView({ behavior: 'smooth' });
    });
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
    initLogoFormForCompany(null);

    document.getElementById('company-form-title').innerText = 'New Company';
    document.getElementById('cancel-company-edit-btn').style.display = 'none';
    refreshUnlockLogoButton();
    toggleCompanyForm(false);
}

function deleteCompany(id) {
    const c = APP_DATA.companies.find(company => company.id === id);
    if (!c) return;

    confirmAction('Delete Company', `Delete "${c.name}"?`, () => {
        APP_DATA.companies = APP_DATA.companies.filter(company => company.id !== id);
        localStorage.removeItem(getCompanyStorageKey(id));

        if (APP_DATA.currentCompanyId === id) {
            APP_DATA.currentCompanyId = APP_DATA.companies[0]?.id || '';
            if (APP_DATA.currentCompanyId) {
                loadCompanyData(APP_DATA.currentCompanyId);
                const newCo = getCurrentCompany();
                currentLang = newCo?.lang || 'en';
            } else {
                COMPANY_DATA = createEmptyCompanyData();
                COMPANY_DATA.currentInvoice.num = new Date().getFullYear() + '-001';
                currentLang = 'en';
            }
        }

        saveAppData();
        renderCompanies();
        refreshNavCompanyPicker();
        renderInvoiceForm();
        renderClients();
        refreshClientPicker();
        renderHistory();
        applyLang();
        showToast('🗑️ Company deleted');

        if (APP_DATA.companies.length === 0) {
            showPage('companies');
        }
    });
}

function switchCompany(id) {
    if (!id || id === APP_DATA.currentCompanyId) return;

    const company = APP_DATA.companies.find(c => c.id === id);
    if (!company) return;

    bankEditConfirmed = false;

    // Save current active company data before switch
    
    saveAllData();
    saveCompanyData();

    // Switch active company
    
    APP_DATA.currentCompanyId = id;
    saveGlobalData();

    // Load selected company data
    
    loadCompanyData(id);

    // Apply selected company's language
    
    currentLang = company.lang || 'en';

    // Refresh whole UI from selected company
    
    refreshNavCompanyPicker();
    renderInvoiceForm();
    renderClients();
    refreshClientPicker();
    renderHistory();
    renderCompanies();
    applyLang();
    showPage('invoice');

    showToast('🏢 ' + (company.name || 'Company'));
}

function refreshNavCompanyPicker() {
    const sel = document.getElementById('nav_company_picker');
    if (!sel) return;

    sel.innerHTML = '';

    (APP_DATA.companies || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || 'Untitled';
        if (c.id === APP_DATA.currentCompanyId) opt.selected = true;
        sel.appendChild(opt);
    });

    if (APP_DATA.companies.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— No companies —';
        sel.appendChild(opt);
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
// BANK DETAILS EDIT PROTECTION
// =========================================
let bankEditConfirmed = false;

function requestBankEdit(inputEl) {
    if (bankEditConfirmed) return; // already confirmed this session
    // blur to prevent immediate editing
    inputEl.blur();
    confirmAction(
        '✏️ Edit Bank Details?',
        'Bank details are shared across all invoices for this company. Are you sure you want to edit them?',
        () => {
            bankEditConfirmed = true;
            // focus the input after confirmation
            setTimeout(() => {
                inputEl.focus();
                // move cursor to end
                const v = inputEl.value;
                inputEl.value = '';
                inputEl.value = v;
            }, 50);
        }
    );
}


function generateInvoiceNumber() {
    const year = new Date().getFullYear();

    const lastNums = (COMPANY_DATA.invoices || [])
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

function updateClientPrintBlock() {
    const src = document.getElementById('client_info');
    const target = document.getElementById('client_info_print');

    if (!src || !target) return;

    const lines = String(src.value || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        target.innerHTML = '';
        return;
    }

    const firstLine = esc(lines[0]);
    const otherLines = lines.slice(1).map(esc);

    target.innerHTML = `
        <div class="client-print-name">${firstLine}</div>
        ${otherLines.map(line => `<div class="client-print-line">${line}</div>`).join('')}
    `;
}

// =========================================
// LANGUAGE SWITCH
// =========================================
function toggleLang() {
    const panel = document.getElementById('lang-dropdown');
    if (!panel) return;
    const isOpen = panel.classList.contains('show');
    if (isOpen) {
        closeLangDropdown();
    } else {
        panel.classList.add('show');
        // close on outside tap
        setTimeout(() => {
            document.addEventListener('click', closeLangDropdownOutside, { once: true });
        }, 10);
    }
}

function closeLangDropdown() {
    const panel = document.getElementById('lang-dropdown');
    if (panel) panel.classList.remove('show');
}

function closeLangDropdownOutside(e) {
    const panel = document.getElementById('lang-dropdown');
    const btn = document.getElementById('lang-toggle');
    if (panel && !panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('show');
    }
}

function selectLang(lang) {
    currentLang = lang;
    closeLangDropdown();
    const co = getCurrentCompany();
    if (co) {
        co.lang = currentLang;
        saveAppData();
    } else {
        localStorage.setItem('db_lang', currentLang);
    }
    applyLang();
}

function applyLang() {
    const L = LANG[currentLang];
    const btn = document.getElementById('lang-toggle');

    if (btn) {
    const flag = currentLang === 'de' ? '🇩🇪' : '🇬🇧';
    const code = currentLang === 'de' ? 'DE' : 'EN';
    
    btn.innerHTML = `<span class="lang-flag">${flag}</span><span class="lang-code">${code}</span>`;
    btn.title = currentLang === 'de' ? 'Switch to English' : 'Switch to German';
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

    if (!vatRateInput) return;

    // წავშალოთ მხოლოდ ტექსტის კვანძები, დავტოვოთ input ელემენტები
    const textNodes = [];
    vatBox.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) textNodes.push(node);
    });
    textNodes.forEach(node => node.remove());

    // დავამატოთ ახალი ტექსტი
    const prefix = currentLang === 'de' ? 'MwSt. (' : 'VAT (';
    vatBox.insertBefore(document.createTextNode(prefix), vatRateInput);

    // მოვძებნოთ არსებული %-ის კვანძი
    let percentNode = null;
    vatBox.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('%')) {
            percentNode = node;
        }
    });

    if (percentNode) {
        percentNode.textContent = '%) ';
    } else {
        vatBox.insertBefore(document.createTextNode('%) '), vatTextInput || null);
    }

    refreshVatVisibility();
}

 // ===== EXPORT FULL BACKUP =====

function exportFullBackup() {
    try {
        const backup = {
            type: "invoice_app_backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            data: localStorage
        };

        const json = JSON.stringify(backup, null, 2);

        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;

        const date = new Date().toISOString().slice(0, 10);
        a.download = `invoice-backup-${date}.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        closeBackupMenu();
        showToast("📦 Backup exported");

    } catch (err) {
        console.error(err);
        showToast("❌ Export failed");
    }
}

 // ===== IMPORT FULL BACKUP =====

function startImportBackup() {
    closeBackupMenu();
    const input = document.getElementById('backup-file-input');
    if (!input) return;
    input.value = '';
    input.click();
}

function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const text = e.target.result;
            const backup = JSON.parse(text);

            if (!backup || backup.type !== 'invoice_app_backup' || !backup.data) {
                showToast('❌ Invalid backup file');
                return;
            }

            confirmAction(
                'Import Backup',
                'Import will replace all current app data. Continue?',
                () => {
                    try {
                        // Clear current storage
                        localStorage.clear();

                        // Restore all keys
                        Object.keys(backup.data).forEach(key => {
                            localStorage.setItem(key, backup.data[key]);
                        });

                        showToast('✅ Backup imported');

                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } catch (err) {
                        console.error(err);
                        showToast('❌ Import failed');
                    }
                }
            );
        } catch (err) {
            console.error(err);
            showToast('❌ Invalid JSON file');
        }
    };

    reader.readAsText(file);
}

// ===== ERROR PREVENTION FUNCTIONS =====

function validateVatRate(input) {
    const raw = input.value.trim();

    if (raw === '') {
        input.value = '';
        COMPANY_DATA.currentInvoice.vatRate = 0;
        saveAppData();
        return;
    }

    let val = parseFloat(raw);

    if (isNaN(val)) {
        input.value = '';
        COMPANY_DATA.currentInvoice.vatRate = 0;
        saveAppData();
        return;
    }

    if (val < 0) {
        val = 0;
        showToast('⚠️ VAT rate cannot be negative');
    } else if (val > 100) {
        val = 100;
        showToast('⚠️ VAT rate maximum is 100%');
    }

    input.value = String(val);
    COMPANY_DATA.currentInvoice.vatRate = val;
    saveAppData();
}

 function handleVatInput(input) {
    // აკრეფის დროს მივუშვათ ცარიელი მნიშვნელობაც,
    // რომ 0 არ ჩაისვას წინ ავტომატურად
    const raw = input.value.trim();

    if (raw === '') {
        COMPANY_DATA.currentInvoice.vatRate = 0;
        calculateAll();
        return;
    }

    const val = parseFloat(raw);

    if (!isNaN(val)) {
        COMPANY_DATA.currentInvoice.vatRate = val;
    }

    calculateAll();
}

function validateInvoiceBeforeSave() {
    const errors = [];
    
    // 1. კლიენტის შემოწმება
    if (!COMPANY_DATA.currentInvoice.client || !COMPANY_DATA.currentInvoice.client.trim()) {
        errors.push('⚠️ Client information is required');
    }
    
    // 2. ინვოისის ნომრის შემოწმება
    if (!COMPANY_DATA.currentInvoice.num || !COMPANY_DATA.currentInvoice.num.trim()) {
        errors.push('⚠️ Invoice number is required');
    }
    
    // 3. VAT rate-ის შემოწმება (0-100)
    const vatRateInput = document.getElementById('vat_rate');
    if (vatRateInput) {
        const vatRate = parseFloat(vatRateInput.value);
        if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
            errors.push('⚠️ VAT rate must be between 0 and 100');
        }
    }
    
    // 4. Item-ების შემოწმება
    const items = COMPANY_DATA.currentInvoice.items || [];
    const hasValidItems = items.some(item => {
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        return qty > 0 && price > 0 && item.desc && item.desc.trim();
    });
    
    if (!hasValidItems) {
        errors.push('⚠️ Add at least one item with description, quantity and price');
    }
    
    return errors;
}