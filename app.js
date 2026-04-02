// =========================================
// GLOBAL STATE
// =========================================
let deferredPrompt = null;
let swRegistration = null;
let modalCallback = null;
let currentLang = 'en';
let userAcceptedUpdate = false;
let isEditingSavedInvoice = false;
let savedInvoiceEditConfirmed = false;
let isApplyingProtectedEdit = false;
let qrStateBeforePrint = false;

const QR_TOGGLE_KEY = 'invoice_show_qr';

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
            paymentStatus: 'unpaid',
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

function getNavCompanyShortName(name) {
    const text = String(name || '').trim();
    if (!text) return 'Untitled';

    const words = text.split(/\s+/);
    return words.slice(0, 2).join(' ');
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

function getInvoiceBackupData() {
    const data = {};

    Object.keys(localStorage).forEach(key => {
        if (isAllowedInvoiceStorageKey(key)) {
            data[key] = localStorage.getItem(key);
        }
    });

    return data;
}

function clearInvoiceAppStorage() {
    const keysToRemove = [];

    Object.keys(localStorage).forEach(key => {
        if (isAllowedInvoiceStorageKey(key)) {
            keysToRemove.push(key);
        }
    });

    keysToRemove.forEach(key => localStorage.removeItem(key));
}

function isAllowedInvoiceStorageKey(key) {
    return (
        key === 'invoice_global_v2' ||
        key === 'invoice_show_qr' ||
        key === 'db_lang' ||
        key.startsWith('invoice_co_')
    );
}

function isValidInvoiceBackupFile(backup) {
    if (!backup || typeof backup !== 'object') return false;

    if (backup.type !== 'invoice_app_backup') return false;

    if (backup.version !== 1) return false;

    if (!backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
        return false;
    }

    const keys = Object.keys(backup.data);
    for (const key of keys) {
        if (typeof key !== 'string') return false;
        if (typeof backup.data[key] !== 'string' && backup.data[key] !== null) {
            return false;
        }
    }

    return true;
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
            COMPANY_DATA.invoices = (COMPANY_DATA.invoices || []).map(inv => ({
                ...inv,
                paymentStatus: inv.paymentStatus || 'unpaid'
            }));

            if (COMPANY_DATA.currentInvoice) {
                COMPANY_DATA.currentInvoice.paymentStatus =
                    COMPANY_DATA.currentInvoice.paymentStatus || 'unpaid';
            }
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
            paymentStatus: 'unpaid',
            items: [{ desc: '', qty: 1, price: 0 }]
        };
    }
    syncSavedInvoiceProtection();
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

function isApplePdfMode() {
    return isIOS();
}

function getPrintButtonLabel() {
    return isApplePdfMode() ? '📄 Save PDF' : '🖨️ Print';
}

function updatePrintButtonsForPlatform() {
    const mainPrintBtn = document.getElementById('print-btn');
    if (mainPrintBtn) {
        mainPrintBtn.innerHTML = getPrintButtonLabel();
    }

    document.querySelectorAll('.hist-btn-print').forEach(btn => {
        btn.innerHTML = getPrintButtonLabel();
    });
}

async function handleCurrentInvoicePrintAction() {
    if (isIOS()) {
        await generateIosPdf();
        return;
    }

    window.print();
}

async function generateIosPdf() {
    try {
        showToast('⏳ Preparing PDF...');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pageW = 210;
        const pageH = 297;
        const margin = 10;
        const contentW = pageW - margin * 2;

        const company = getCurrentCompany() || {};
        const ci = COMPANY_DATA.currentInvoice || {};
        const items = Array.isArray(ci.items) ? ci.items : [];

        const subtotal = items.reduce((sum, item) => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            return sum + qty * price;
        }, 0);

        const vatRate = parseFloat(ci.vatRate) || 0;
        const vatAmount = vatRate > 0 ? subtotal * (vatRate / 100) : 0;
        const total = subtotal + vatAmount;

        const L = LANG[currentLang] || LANG.en;

        function splitLines(text, maxWidth) {
            return pdf.splitTextToSize(String(text || '').trim(), maxWidth);
        }

        let y = 14;

        // =========================
        // HEADER
        // =========================
        const headerH = 30;

        pdf.setFillColor(13, 61, 122);
        pdf.roundedRect(margin, y, contentW, headerH, 4, 4, 'F');

        // Manual logo so it always appears
        const logoX = margin + 5;
        const logoY = y + 4;
        const logoSize = 12;

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F');

        pdf.setFillColor(13, 61, 122);
        pdf.roundedRect(logoX + 1.2, logoY + 1.2, logoSize - 2.4, logoSize - 2.4, 1.6, 1.6, 'F');

        pdf.setFillColor(255, 255, 255);
        pdf.triangle(
            logoX + 2.5, logoY + 9.5,
            logoX + 5.2, logoY + 4.5,
            logoX + 7.0, logoY + 7.2,
            'F'
        );
        pdf.triangle(
            logoX + 5.8, logoY + 7.8,
            logoX + 7.6, logoY + 3.8,
            logoX + 9.3, logoY + 9.5,
            'F'
        );

        pdf.setFillColor(244, 179, 0);
        pdf.circle(logoX + 8.7, logoY + 3.2, 0.9, 'F');

        // Company name
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(String(company.name || ''), margin + 20, y + 8);

        // Company lines — hide empty ones
        const companyLines = [
            company.reg || '',
            company.addr || '',
            company.phone || '',
            company.email || '',
            company.website || ''
        ].filter(Boolean);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);

        let companyY = y + 12.5;
        companyLines.forEach(line => {
            pdf.text(String(line), margin + 20, companyY);
            companyY += 3.9;
        });

        // Invoice title
        pdf.setFont('times', 'bold');
        pdf.setFontSize(17);
        pdf.text(String(L.invoiceWord || 'INVOICE'), pageW - margin - 6, y + 10, { align: 'right' });

        y += headerH + 6;

        // =========================
        // TOP CARDS
        // =========================
        const leftW = 92;
        const gap = 4;
        const rightW = contentW - leftW - gap;
        const topCardH = 34;

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);

        pdf.roundedRect(margin, y, leftW, topCardH, 3, 3, 'FD');
        pdf.roundedRect(margin + leftW + gap, y, rightW, topCardH, 3, 3, 'FD');

        // Left card title
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(String(L.billedTo).toUpperCase(), margin + 4, y + 6);

        // Client lines
        const clientLines = String(ci.client || '')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);

        const clientTextLines = clientLines.flatMap(line => splitLines(line, leftW - 22));

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);

        let clientY2 = y + 14.5;
        clientTextLines.forEach((line, idx) => {
            if (clientY2 > y + topCardH - 3) return;
            if (idx === 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.text(line, margin + 6, clientY2);
                pdf.setFont('helvetica', 'normal');
            } else {
                pdf.text(line, margin + 6, clientY2);
            }
            clientY2 += 5;
        });

        // Right card title
        const rightX = margin + leftW + gap;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(String(L.invoiceDetails).toUpperCase(), rightX + 4, y + 6);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(String(L.invoiceNum).toUpperCase(), rightX + 4, y + 14);
        pdf.text(String(L.date).toUpperCase(), rightX + 4, y + 24);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.text(String(ci.num || ''), pageW - margin - 4, y + 14, { align: 'right' });
        pdf.text(String(ci.date || ''), pageW - margin - 4, y + 24, { align: 'right' });

        y += topCardH + 6;

        // =========================
        // ITEMS TABLE
        // =========================
        const tableHeaderH = 7;

        pdf.setFillColor(13, 61, 122);
        pdf.rect(margin, y, contentW, tableHeaderH, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);

        const descX = margin + 3;
        const qtyX = margin + 126;
        const priceX = margin + 152;
        const amountX = pageW - margin - 3;

        pdf.text(String(L.description).toUpperCase(), descX, y + 4.8);
        pdf.text(String(L.qty).toUpperCase(), qtyX, y + 4.8, { align: 'right' });
        pdf.text(String(L.unitPrice).toUpperCase(), priceX, y + 4.8, { align: 'right' });
        pdf.text(String(L.amount).toUpperCase(), amountX, y + 4.8, { align: 'right' });

        y += 10;

        pdf.setTextColor(25, 25, 25);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);

        items.forEach(item => {
            const desc = String(item.desc || '').trim() || '-';
            const qty = (parseFloat(item.qty) || 0).toString();
            const price = (parseFloat(item.price) || 0).toFixed(2);
            const amount = ((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2);

            const descLines = splitLines(desc, 116);
            const rowH = Math.max(6, descLines.length * 4.1);

            pdf.text(descLines, descX, y);
            pdf.text(qty, qtyX, y, { align: 'right' });
            pdf.text(`€${price}`, priceX, y, { align: 'right' });
            pdf.text(`€${amount}`, amountX, y, { align: 'right' });

            y += rowH;
        });

        y += 3;

        // =========================
        // SUMMARY
        // =========================
        const summaryLabelX = margin + 118;
        const summaryValueX = amountX;

        pdf.setTextColor(35, 35, 35);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);

        pdf.text(String(L.subtotal), summaryLabelX, y);
        pdf.text(`€${subtotal.toFixed(2)}`, summaryValueX, y, { align: 'right' });
        y += 7;

        const vatLabel = currentLang === 'de'
            ? `MwSt. (${vatRate}%)`
            : `VAT (${vatRate}%)`;

        pdf.text(vatLabel, summaryLabelX, y);
        pdf.text(`€${vatAmount.toFixed(2)}`, summaryValueX, y, { align: 'right' });
        y += 8;

        // GESAMT / TOTAL bar
        const totalBarX = summaryLabelX - 3;
        const totalBarW = amountX - totalBarX;
        const totalBarH = 9;

        pdf.setFillColor(244, 179, 0);
        pdf.roundedRect(totalBarX, y - 4.8, totalBarW, totalBarH, 2.5, 2.5, 'F');

        pdf.setTextColor(25, 25, 25);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12.5);
        pdf.text(String(L.total), totalBarX + 4, y + 1.2);
        pdf.text(`€${total.toFixed(2)}`, totalBarX + totalBarW - 3, y + 1.2, { align: 'right' });

        y += 16;

        // =========================
        // FOOTER CARDS
        // =========================
        const footGap = 4;
        const footW = (contentW - footGap) / 2;

        const bankLines = [
            (ci.bankRecip || company.bankRecip) ? `${L.recipient}: ${ci.bankRecip || company.bankRecip}` : '',
            (ci.bankName || company.bankName) ? `${L.bank}: ${ci.bankName || company.bankName}` : '',
            (ci.bankIban || company.bankIban) ? `IBAN: ${ci.bankIban || company.bankIban}` : '',
            (ci.bankBic || company.bankBic) ? `BIC: ${ci.bankBic || company.bankBic}` : ''
        ].filter(Boolean);

        const termsLines = splitLines(
            String(L.termsText || '').replace(/\n/g, ' '),
            footW - 12
        );

        const bankCardH = Math.max(38, 15 + bankLines.length * 5.8);
        const termsCardH = Math.max(36, 15 + termsLines.length * 5.2);
        const footerH = Math.max(bankCardH, termsCardH);

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);

        pdf.roundedRect(margin, y, footW, footerH, 3, 3, 'FD');
        pdf.roundedRect(margin + footW + footGap, y, footW, footerH, 3, 3, 'FD');

        // Bank title
        pdf.setTextColor(30, 30, 30);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(String(L.bankDetails).toUpperCase(), margin + 4, y + 6);

        pdf.setDrawColor(13, 61, 122);
        pdf.setLineWidth(0.35);
        pdf.line(margin + 4, y + 8.8, margin + footW - 4, y + 8.8);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);

        let bankY = y + 18.5;
        bankLines.forEach(line => {
            pdf.text(String(line), margin + 4, bankY);
            bankY += 5.7;
        });

        // Terms title
        const termsX = margin + footW + footGap;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(String(L.terms).toUpperCase(), termsX + 4, y + 6);

        pdf.setDrawColor(13, 61, 122);
        pdf.line(termsX + 4, y + 8.8, termsX + footW - 4, y + 8.8);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.2);
        pdf.text(termsLines, termsX + 4, y + 17.5);

        y += footerH + 8;

        // =========================
        // QR
        // =========================
        const qrImg = document.querySelector('#invoice-qr-container img');

        if (qrImg && qrImg.src) {
            const qrBoxW = 34;
            const qrBoxH = 42;
            const qrX = (pageW - qrBoxW) / 2;

            pdf.setFillColor(250, 250, 250);
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(qrX, y, qrBoxW, qrBoxH, 3, 3, 'FD');

            pdf.setTextColor(35, 35, 35);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.text(currentLang === 'de' ? 'GiroCode' : 'QR Code', pageW / 2, y + 5, { align: 'center' });

            pdf.addImage(qrImg.src, 'PNG', pageW / 2 - 10, y + 8, 20, 20);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6.5);
            pdf.text(
                currentLang === 'de' ? 'Mit Ihrer Banking-App scannen' : 'Scan with your banking app',
                pageW / 2,
                y + 31,
                { align: 'center' }
            );

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.3);
            pdf.text(`${total.toFixed(2)} EUR`, pageW / 2, y + 36, { align: 'center' });

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6.7);
            pdf.text(String(ci.num || ''), pageW / 2, y + 40, { align: 'center' });
        }

        const fileName = getPdfFileName(ci.num);
        const blob = pdf.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: fileName
            });
        } else {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }

        showToast('✅ PDF ready');
    } catch (err) {
        console.error(err);
        showToast('❌ PDF failed');
    }
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

        function checkForWaitingWorker() {
            if (registration.waiting) {
                showUpdateBanner();
            }
        }

        checkForWaitingWorker();

        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    checkForWaitingWorker();
                }
            });
        });

        registration.update().then(() => {
            setTimeout(() => {
                registration.update().then(checkForWaitingWorker).catch(() => {});
            }, 1500);
        }).catch(() => {});
    }).catch(error => {
        console.error('SW registration failed:', error);
    });

    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
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

    // VAT rate input-ის სტილები
    if (vatRateInput) {
        styleElementOnlyForPrint(vatRateInput, {
            width: '22px',
            minWidth: '22px',
            maxWidth: '22px',
            padding: '0',
            margin: '0',
            textAlign: 'center',
            lineHeight: '1'
        });
    }

    // VAT note-ის შემოწმება
    const note = (vatTextInput ? vatTextInput.value || '' : '').trim();
    
    if (!note) {
        // თუ ტექსტი არ არის, მთლიანად დავმალოთ VAT ნოტის ველი
        if (vatTextInput) {
            styleElementOnlyForPrint(vatTextInput, {
                display: 'none',
                width: '0',
                minWidth: '0',
                maxWidth: '0',
                padding: '0',
                margin: '0',
                border: '0'
            });
        }
        
        if (vatBox) {
            // მოვძებნოთ ყველა ტექსტური კვანძი და წავშალოთ ცარიელი
            const childNodes = vatBox.childNodes;
            for (let i = childNodes.length - 1; i >= 0; i--) {
                const node = childNodes[i];
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text === '') {
                        node.remove();
                    }
                }
            }
            
            styleElementOnlyForPrint(vatBox, {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                letterSpacing: '0',
                whiteSpace: 'nowrap',
                lineHeight: '1'
            });
        }
    } else {
        // თუ ტექსტი არის, ვაჩვენოთ ველი
        if (vatTextInput) {
            styleElementOnlyForPrint(vatTextInput, {
                display: 'inline-block',
                marginLeft: '2px',
                lineHeight: '1'
            });
        }
        
        if (vatBox) {
            styleElementOnlyForPrint(vatBox, {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                letterSpacing: '0',
                whiteSpace: 'nowrap',
                lineHeight: '1'
            });
        }
    }
}

function syncItemDescPrintDivs() {
    document.querySelectorAll('.item-row').forEach(row => {
        const input = row.querySelector('.item-desc-input');
        const printDiv = row.querySelector('.item-desc-print');
        if (!input || !printDiv) return;
        const val = input.value || '';
        printDiv.innerHTML = esc(val).replace(/\n/g, '<br>');
    });
}

function preparePrintLayout() {
    runPrintCleanup();

    // განვაახლოთ description print div-ები input-ის მიმდინარე მნიშვნელობით
    syncItemDescPrintDivs();

    calculateAll();

    const vatRateInput = document.getElementById('vat_rate');
    if (vatRateInput) {
        const rawVat = parseFloat(vatRateInput.value);
        if (vatRateInput.value.trim() === '' || isNaN(rawVat) || rawVat < 0) {
            vatRateInput.value = '0';
        }
    }

    // COMPANY block: hide empty lines only on print
    hideFieldRowIfEmptyForPrint('my_reg_no_span');
    hideFieldRowIfEmptyForPrint('my_addr_span');
    hideFieldRowIfEmptyForPrint('my_phone_span');
    hideFieldRowIfEmptyForPrint('my_email_span');
    hideFieldRowIfEmptyForPrint('my_website_span');

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
window.onload = async function () {
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

    await renderInvoiceForm();
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
    updateQrToggleButton();
    updateDocumentTitleForPdf();
    updatePrintButtonsForPlatform();
    initPWA();

    if (isQrEnabled()) {
        document.body.classList.remove('hide-qr');
    } else {
        document.body.classList.add('hide-qr');
    }

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
    qrStateBeforePrint = isQrEnabled();

    if (qrStateBeforePrint) {
        document.body.classList.remove('hide-qr');
    } else {
        document.body.classList.add('hide-qr');
    }

    preparePrintLayout();
});

window.addEventListener('afterprint', function () {
    if (qrStateBeforePrint) {
        document.body.classList.remove('hide-qr');
    } else {
        document.body.classList.add('hide-qr');
    }

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

    if (name === 'history') {
        renderHistory();
        updateQrToggleButton();
    }
    if (name === 'clients') renderClients();
    if (name === 'companies') renderCompanies();
    if (name === 'stats') applyInvoiceStats();
}

// =========================================
// INVOICE FORM
// =========================================
async function renderInvoiceForm() {
    const ci = COMPANY_DATA.currentInvoice;
    const co = getCurrentCompany() || createEmptyCompany();

    document.getElementById('my_comp_name').value = co.name || '';
    document.getElementById('my_reg_no').value = co.reg || '';
    document.getElementById('my_addr').value = co.addr || '';
    document.getElementById('my_phone').value = co.phone || '';
    document.getElementById('my_email').value = co.email || '';
    document.getElementById('my_website').value = co.website || '';
    
    // Sync company print spans so empty placeholders never appear on PDF
const companyPrintMap = {
    my_comp_name_span: co.name || '',
    my_reg_no_span: co.reg || '',
    my_addr_span: co.addr || '',
    my_phone_span: co.phone || '',
    my_email_span: co.email || '',
    my_website_span: co.website || ''
};

Object.entries(companyPrintMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
});

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
    
    const protectedFieldIds = ['inv_num', 'inv_date', 'client_info', 'vat_rate', 'vat_text'];

    protectedFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (!el.dataset.protectBound) {
            el.addEventListener('beforeinput', function (e) {
                if (savedInvoiceEditConfirmed || !isEditingSavedInvoice) return;
                if (e.inputType && e.inputType.startsWith('insert')) {
                    if (!requestProtectedFieldEdit(this)) {
                        e.preventDefault();
                    }
                }
                if (e.inputType && e.inputType.startsWith('delete')) {
                    if (!requestProtectedFieldEdit(this)) {
                        e.preventDefault();
                    }
                }
            });

            el.addEventListener('paste', function (e) {
                if (savedInvoiceEditConfirmed || !isEditingSavedInvoice) return;
                if (!requestProtectedFieldEdit(this)) {
                    e.preventDefault();
                }
            });

            el.dataset.protectBound = '1';
        }
    });

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
 
    // QR CODE RENDER
const qrContainer = document.getElementById('invoice-qr-container');
if (qrContainer) {
    qrContainer.style.display = 'flex';

        const company = getCurrentCompany();

        const invoiceData = {
            num: COMPANY_DATA.currentInvoice.num || '',
            total: parseFloat(document.getElementById('grand_total')?.innerText) || 0,
            description: (COMPANY_DATA.currentInvoice.items || [])
                .map(i => (i.desc || '').trim())
                .filter(Boolean)
                .join(', ')
        };

        const qrCompany = {
            companyName: bankRecipValue || company?.name || '',
            iban: bankIbanValue || '',
            bic: bankBicValue || ''
        };

        await renderInvoicePaymentQR(qrContainer, qrCompany, invoiceData);
    }

    updatePrintButtonsForPlatform();
}

function renderItemRows() {
    const tbody = document.getElementById('items-body');
    tbody.innerHTML = '';

    COMPANY_DATA.currentInvoice.items.forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.dataset.index = i;

        const total = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
        const escapedDesc = esc(item.desc).replace(/\n/g, '<br>');

        tr.innerHTML = `
            <td class="item-desc-cell">
                <input type="text" class="item-desc-input no-print" value="${esc(item.desc)}"
    oninput="updateItem(${i}, 'desc', this.value)"
    autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"
    placeholder="Description of work...">
                <div class="item-desc-print print-only">${escapedDesc}</div>
            </td>
            <td style="text-align:center">
                <input type="number" class="item-num-input" value="${item.qty}"
                    oninput="updateItem(${i}, 'qty', this.value)" min="0" step="0.01" style="width:70px">
            </td>
            <td>
    <div class="item-price-wrap">
        <span class="currency">€</span>
        <input type="number" class="item-num-input no-print" value="${item.price}"
            oninput="updateItem(${i}, 'price', this.value)" min="0" step="0.01" style="width:90px">
        <span class="item-price-print print-only" id="row-price-print-${i}">${(parseFloat(item.price) || 0).toFixed(2)}</span>
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
    ensureSavedInvoiceEditConfirmed(() => {
        COMPANY_DATA.currentInvoice.items[index][field] = value;
        calculateAll();
        saveAppData();
    });
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
        const pricePrintEl = document.getElementById('row-price-print-' + i);
        if (pricePrintEl) pricePrintEl.innerText = p.toFixed(2);
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

function performSaveAllData() {
    COMPANY_DATA.currentInvoice.num = document.getElementById('inv_num').value;
    COMPANY_DATA.currentInvoice.date = document.getElementById('inv_date').value;
    COMPANY_DATA.currentInvoice.client = document.getElementById('client_info').value;

    const vatRaw = document.getElementById('vat_rate').value.trim();
    COMPANY_DATA.currentInvoice.vatRate = vatRaw === '' ? 0 : (parseFloat(vatRaw) || 0);

    COMPANY_DATA.currentInvoice.vatText = document.getElementById('vat_text').value.trim();
    COMPANY_DATA.currentInvoice.paymentStatus =
        COMPANY_DATA.currentInvoice.paymentStatus || 'unpaid';

    calculateAll();
    updateClientPrintBlock();
    saveAppData();
    updateDocumentTitleForPdf();
}

function saveAllData() {
    ensureSavedInvoiceEditConfirmed(() => {
        performSaveAllData();
    });
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

    performSaveAllData();

    // save-ის წინ გაწმინდოს 0-თანხიანი row-ები
    cleanupInvoiceItemsForSave();

    const ci = COMPANY_DATA.currentInvoice;

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
    const existingInvoice = COMPANY_DATA.invoices.find(inv => inv.num === invoiceCopy.num);
    invoiceCopy.paymentStatus = invoiceCopy.paymentStatus || existingInvoice?.paymentStatus || 'unpaid';

    // ბანკის მონაცემებიც შეინახოს snapshot-ად
    invoiceCopy.bankRecip = document.getElementById('bank_recip')?.value.trim() || '';
    invoiceCopy.bankName = document.getElementById('bank_name')?.value.trim() || '';
    invoiceCopy.bankIban = document.getElementById('bank_iban')?.value.trim() || '';
    invoiceCopy.bankBic = document.getElementById('bank_bic')?.value.trim() || '';

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

    syncSavedInvoiceProtection();
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
            
            const paymentStatus = getInvoicePaymentStatus(inv);
        const paymentLabel = paymentStatus === 'paid' ? '✅ Paid' : '○ Unpaid';
        const paymentBtnClass = paymentStatus === 'paid' ? '' : '';
const paymentBtnStyle = paymentStatus === 'paid'
    ? 'background:#e8f1ff;color:#174ea6;border:1.5px solid #b7cdf7;font-weight:800;box-shadow:0 4px 12px rgba(23,78,166,0.12);'
    : 'background:#fff2e8;color:#b85c1e;border:1.5px solid #f0c7a8;font-weight:800;box-shadow:0 4px 12px rgba(184,92,30,0.12);';

        return `
        <div class="history-card ${isCurrent ? 'current' : ''}">
            <div class="hist-left">
                <div class="hist-num">${esc(inv.num)}</div>
                <div class="hist-client">${esc(clientName)}</div>
                <div class="hist-meta">📅 ${esc(inv.date)}</div>

                <div class="hist-actions">
    <button class="hist-btn hist-btn-load" onclick="loadInvoiceFromHistory(${realIdx})">📂 Open</button>
    <button class="hist-btn ${paymentBtnClass}" style="${paymentBtnStyle}" onclick="toggleInvoicePaymentStatus(${realIdx})">${paymentLabel}</button>
    <button class="hist-btn hist-btn-del" onclick="deleteInvoice(${realIdx})">🗑️ Delete</button>
    <button class="hist-btn hist-btn-print" onclick="printInvoiceFromHistory(${realIdx})">${getPrintButtonLabel()}</button>
</div>
            </div>

            <div class="hist-right">
                <div class="hist-subtotal">€${subtotal.toFixed(2)}</div>
                <div class="hist-date">${savedDate ? 'Saved: ' + savedDate : ''}</div>

                <span class="hist-badge ${isCurrent ? 'badge-current' : 'badge-saved'}">
                    ${isCurrent ? '● Current' : '✓ Saved'}
                </span>

                <span class="hist-badge" style="${paymentStatus === 'paid'
    ? 'background:#e8f1ff;color:#174ea6;border:1.5px solid #b7cdf7;font-weight:800;box-shadow:0 3px 10px rgba(23,78,166,0.08);'
    : 'background:#fff2e8;color:#b85c1e;border:1.5px solid #f0c7a8;font-weight:800;box-shadow:0 3px 10px rgba(184,92,30,0.08);'}">
    ${paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
</span>

                <div class="hist-total-block">
                    <div class="hist-total-label">TOTAL</div>
                    <div class="hist-amount">€${total.toFixed(2)}</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function loadInvoiceFromHistory(index) {
    const loaded = JSON.parse(JSON.stringify(COMPANY_DATA.invoices[index]));
    if (!loaded) return;
    
    loaded.paymentStatus = loaded.paymentStatus || 'unpaid';

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

    syncSavedInvoiceProtection();
    saveAppData();
    await renderInvoiceForm();
    updateDocumentTitleForPdf();
    refreshClientPicker();
    showPage('invoice');
    showToast(loaded.paymentStatus === 'paid' ? '📂 Paid invoice loaded' : '📂 Invoice loaded');
}

async function printInvoiceFromHistory(index) {
    const inv = COMPANY_DATA.invoices[index];
    if (!inv) return;

    // შევინახოთ მიმდინარე მდგომარეობა
    const previousInvoice = JSON.parse(JSON.stringify(COMPANY_DATA.currentInvoice));
    const previousPage = document.querySelector('.page.active')?.id || 'page-history';

    // ჩავტვირთოთ არჩეული ინვოისი
    COMPANY_DATA.currentInvoice = JSON.parse(JSON.stringify(inv));

    if (!COMPANY_DATA.currentInvoice.items || !COMPANY_DATA.currentInvoice.items.length) {
        COMPANY_DATA.currentInvoice.items = [{ desc: '', qty: 1, price: 0 }];
    }

    // განვაახლოთ ფორმა
    await renderInvoiceForm();
    updateDocumentTitleForPdf();
    refreshClientPicker();
    updateClientPrintBlock();
    calculateAll();

    // გადავიდეთ ინვოისის გვერდზე
    showPage('invoice');

    // დაველოდოთ DOM-ის და QR-ის სრულ განახლებას
setTimeout(async () => {
    calculateAll();
    document.body.classList.add('printing-invoice');

    const qrContainer = document.getElementById('invoice-qr-container');
    await waitForQrRender(qrContainer, 2500);

    setTimeout(async () => {
        if (!isQrEnabled()) {
            document.body.classList.add('hide-qr');
        } else {
            document.body.classList.remove('hide-qr');
        }

        function onAfterPrint() {
            window.removeEventListener('afterprint', onAfterPrint);
            document.body.classList.remove('hide-qr');
            COMPANY_DATA.currentInvoice = previousInvoice;
            renderInvoiceForm();
            refreshClientPicker();
            document.body.classList.remove('printing-invoice');
            showPage(previousPage.replace('page-', ''));
        }

        iif (isIOS()) {
    try {
        await generateIosPdf();
    } finally {
        onAfterPrint();
    }
    return;
}

window.addEventListener('afterprint', onAfterPrint);
window.print();
    }, 120);
}, 300);
}

function deleteInvoice(index) {
    confirmAction('Delete Invoice', `Delete invoice #${COMPANY_DATA.invoices[index].num}? This cannot be undone.`, () => {
        const deleted = COMPANY_DATA.invoices[index];

        COMPANY_DATA.invoices.splice(index, 1);

        if (
            deleted &&
            COMPANY_DATA.currentInvoice &&
            String(COMPANY_DATA.currentInvoice.num || '') === String(deleted.num || '')
        ) {
            resetSavedInvoiceProtection();
        }

        saveAppData();
        renderHistory();
        showToast('🗑️ Invoice deleted');
    });
}

 function getInvoicePaymentStatus(inv) {
    return inv && inv.paymentStatus === 'paid' ? 'paid' : 'unpaid';
}

function toggleInvoicePaymentStatus(index) {
    const inv = COMPANY_DATA.invoices[index];
    if (!inv) return;

    const currentStatus = getInvoicePaymentStatus(inv);
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';

    confirmAction(
        nextStatus === 'paid' ? 'Mark as Paid' : 'Mark as Unpaid',
        nextStatus === 'paid'
            ? `Mark invoice #${inv.num} as paid?`
            : `Mark invoice #${inv.num} as unpaid?`,
        () => {
            inv.paymentStatus = nextStatus;

            if (
                COMPANY_DATA.currentInvoice &&
                String(COMPANY_DATA.currentInvoice.num || '') === String(inv.num || '')
            ) {
                COMPANY_DATA.currentInvoice.paymentStatus = inv.paymentStatus;
            }

            saveAppData();
            renderHistory();
            showToast(inv.paymentStatus === 'paid' ? '✅ Marked as paid' : '↩️ Marked as unpaid');
        }
    );
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
            paymentStatus: 'unpaid',
            items: [{ desc: '', qty: 1, price: 0 }]
        };

        resetSavedInvoiceProtection();
        saveAppData();
        renderInvoiceForm();
        updateDocumentTitleForPdf();
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

    saveAppData();
    renderClients();
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

  // =========================================
// LOAD LAST INVOICE DESCRIPTION FOR CLIENT
// =========================================

function loadLastInvoiceDescriptionForClient(clientId) {
    if (!clientId) return;
    
    const history = COMPANY_DATA.invoices || [];
    const clientInvoices = history.filter(inv => inv.clientId === clientId);
    
    if (clientInvoices.length === 0) return;
    
    const lastInvoice = clientInvoices[clientInvoices.length - 1];
    
    if (lastInvoice && lastInvoice.items && lastInvoice.items.length > 0) {
        const lastDescription = lastInvoice.items[0].desc || '';
        
        if (lastDescription) {
            // ვაჩვენოთ შეტყობინება toast-ით
            showToast(`📋 Last invoice: "${lastDescription.substring(0, 40)}${lastDescription.length > 40 ? '...' : ''}"`);
            
            const firstDescInput = document.querySelector('.item-desc-input');
            
            if (firstDescInput && lastDescription) {
                // 👇 ბრაუზერის confirm-ის ნაცვლად, გამოიყენე შენი modal
                confirmAction(
    '📋 Use Previous Description?',
    `Last invoice for this client:\n\n"${lastDescription}"\n\nDo you want to use it as description?`,
    () => {
        // OK - ჩაწერა
        firstDescInput.value = lastDescription;
        if (COMPANY_DATA.currentInvoice.items[0]) {
            COMPANY_DATA.currentInvoice.items[0].desc = lastDescription;
            calculateAll();
            saveAppData();
        }
        const row = firstDescInput.closest('.item-row');
        if (row && row.dataset.index !== undefined) {
            updateItem(parseInt(row.dataset.index), 'desc', lastDescription);
        }
        showToast('✅ Description filled!');
                   }
               );
            }
        }
    }
}

function fillClientFromPicker() {
    ensureSavedInvoiceEditConfirmed(() => {
        const id = document.getElementById('client_picker').value;

        if (!id) {
            COMPANY_DATA.currentInvoice.client = '';
            COMPANY_DATA.currentInvoice.clientId = '';
            document.getElementById('client_info').value = '';
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

        saveAppData();
        renderClients();
        renderInvoiceForm();
        showToast('👤 ' + c.name);

        loadLastInvoiceDescriptionForClient(id);
    });
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

async function switchCompany(id) {
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
    await renderInvoiceForm();
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
        opt.textContent = (c.id === APP_DATA.currentCompanyId)
    ? getNavCompanyShortName(c.name)
    : (c.name || 'Untitled');
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

    const validNums = (COMPANY_DATA.invoices || [])
        .map(i => String(i.num || '').trim())
        .filter(n => n.startsWith(year + '-'))
        .map(n => {
            const parts = n.split('-');
            if (parts.length !== 2) return NaN;

            const num = parseInt(parts[1], 10);
            return Number.isFinite(num) && num > 0 ? num : NaN;
        })
        .filter(num => Number.isFinite(num));

    const next = validNums.length ? Math.max(...validNums) + 1 : 1;
    return `${year}-${String(next).padStart(3, '0')}`;
}

function getCurrentDate() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

  function parseAppDate(dateStr) {
    const raw = String(dateStr || '').trim();
    if (!raw) return null;

    const parts = raw.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (!day || !month || !year) return null;

    const d = new Date(year, month - 1, day);
    if (
        d.getFullYear() !== year ||
        d.getMonth() !== month - 1 ||
        d.getDate() !== day
    ) {
        return null;
    }

    d.setHours(0, 0, 0, 0);
    return d;
}

 function parseStatsInputDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const parts = raw.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (!year || !month || !day) return null;

    const d = new Date(year, month - 1, day);
    if (
        d.getFullYear() !== year ||
        d.getMonth() !== month - 1 ||
        d.getDate() !== day
    ) {
        return null;
    }

    d.setHours(0, 0, 0, 0);
    return d;
}

function isQrEnabled() {
    const saved = localStorage.getItem(QR_TOGGLE_KEY);
    return saved !== '0'; // default = on
}

function setQrEnabled(value) {
    localStorage.setItem(QR_TOGGLE_KEY, value ? '1' : '0');
}

function getPdfFileName(invoiceNum) {
    const safeNum = String(invoiceNum || 'invoice').replace(/[^\w\-]+/g, '-');
    const prefix = currentLang === 'de' ? 'Rechnung' : 'Invoice';
    return `${prefix}-${safeNum}.pdf`;
}

function updateDocumentTitleForPdf() {
    const invoiceNum = COMPANY_DATA?.currentInvoice?.num || 'invoice';
    document.title = getPdfFileName(invoiceNum).replace(/\.pdf$/i, '');
}

function csvEscape(value) {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
}

function getInvoiceAmounts(inv) {
    const subtotal = (inv.items || []).reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        return sum + qty * price;
    }, 0);

    const vatRate = parseFloat(inv.vatRate) || 0;
    const vatAmount = vatRate > 0 ? subtotal * (vatRate / 100) : 0;
    const total = subtotal + vatAmount;

    return { subtotal, vatRate, vatAmount, total };
}

function exportInvoicesCsv() {
    const invoices = COMPANY_DATA.invoices || [];

    if (!invoices.length) {
        showToast('⚠️ No invoices to export');
        return;
    }

    const rows = [
        [
            'Invoice Number',
            'Date',
            'Client',
            'Description',
            'Subtotal',
            'VAT Rate',
            'VAT Amount',
            'Total',
            'Payment Status',
            'Saved At'
        ]
    ];

    invoices.forEach(inv => {
        const { subtotal, vatRate, vatAmount, total } = getInvoiceAmounts(inv);

        const clientName = String(inv.client || '').split('\n')[0] || '';
        const description = (inv.items || [])
            .map(item => String(item.desc || '').trim())
            .filter(Boolean)
            .join(' | ');

        rows.push([
            inv.num || '',
            inv.date || '',
            clientName,
            description,
            subtotal.toFixed(2),
            vatRate.toFixed(2),
            vatAmount.toFixed(2),
            total.toFixed(2),
            getInvoicePaymentStatus(inv),
            inv.savedAt || ''
        ]);
    });

    const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showToast('✅ CSV exported');
}

  function filterInvoicesByStatsDate(invoices, fromDateStr, toDateStr) {
    const fromDate = parseStatsInputDate(fromDateStr);
    const toDate = parseStatsInputDate(toDateStr);

    return (invoices || []).filter(inv => {
        const invDate = parseAppDate(inv.date);
        if (!invDate) return false;

        if (fromDate && invDate < fromDate) return false;
        if (toDate && invDate > toDate) return false;

        return true;
    });
}

function renderStatsSummary(filteredInvoices) {
    const summaryEl = document.getElementById('stats-summary-cards');
    if (!summaryEl) return;

    let paidCount = 0;
    let unpaidCount = 0;

    let subtotalSum = 0;
    let vatSum = 0;
    let totalSum = 0;

    let paidTotal = 0;
    let unpaidTotal = 0;

    let paidVat = 0;

    filteredInvoices.forEach(inv => {
        const { subtotal, vatAmount, total } = getInvoiceAmounts(inv);

        subtotalSum += subtotal;
        vatSum += vatAmount;
        totalSum += total;

        const status = getInvoicePaymentStatus(inv);

        if (status === 'paid') {
            paidCount++;
            paidTotal += total;
            paidVat += vatAmount;
        } else {
            unpaidCount++;
            unpaidTotal += total;
        }
    });

    summaryEl.innerHTML = `
        <div class="stats-card">
            <div class="stats-card-label">Total Invoices</div>
            <div class="stats-card-value">${filteredInvoices.length}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">Paid</div>
            <div class="stats-card-value">${paidCount}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">Unpaid</div>
            <div class="stats-card-value">${unpaidCount}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">Paid Total</div>
            <div class="stats-card-value">€${paidTotal.toFixed(2)}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">Unpaid Total</div>
            <div class="stats-card-value">€${unpaidTotal.toFixed(2)}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">VAT (Paid)</div>
            <div class="stats-card-value">€${paidVat.toFixed(2)}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">VAT (All)</div>
            <div class="stats-card-value">€${vatSum.toFixed(2)}</div>
        </div>

        <div class="stats-card">
            <div class="stats-card-label">Total Revenue</div>
            <div class="stats-card-value">€${totalSum.toFixed(2)}</div>
        </div>
    `;
}

function renderStatsInvoiceList(filteredInvoices) {
    const listEl = document.getElementById('stats-invoice-list');
    if (!listEl) return;

    if (!filteredInvoices.length) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <p>No invoices in selected range</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filteredInvoices.map(inv => {
        const { total } = getInvoiceAmounts(inv);
        const clientName = String(inv.client || '').split('\n')[0] || 'No client';
        const status = getInvoicePaymentStatus(inv);

        return `
            <div class="stats-list-card">
                <div class="stats-list-top">
                    <div class="stats-list-num">${esc(inv.num || '')}</div>
                    <div class="stats-list-total">€${total.toFixed(2)}</div>
                </div>
                <div class="stats-list-client">${esc(clientName)}</div>
                <div class="stats-list-date">📅 ${esc(inv.date || '')}</div>
                <div class="stats-list-status">${status === 'paid' ? '✅ Paid' : '○ Unpaid'}</div>
            </div>
        `;
    }).join('');
}

function applyInvoiceStats() {
    const fromEl = document.getElementById('stats_date_from');
    const toEl = document.getElementById('stats_date_to');

    const fromValue = fromEl ? fromEl.value.trim() : '';
    const toValue = toEl ? toEl.value.trim() : '';

    if (fromValue && !parseStatsInputDate(fromValue)) {
        showToast('⚠️ Invalid Date From');
        return;
    }

    if (toValue && !parseStatsInputDate(toValue)) {
        showToast('⚠️ Invalid Date To');
        return;
    }

    const filteredInvoices = filterInvoicesByStatsDate(
        COMPANY_DATA.invoices || [],
        fromValue,
        toValue
    );

    renderStatsSummary(filteredInvoices);
    renderStatsInvoiceList(filteredInvoices);
}

function resetInvoiceStats() {
    const fromEl = document.getElementById('stats_date_from');
    const toEl = document.getElementById('stats_date_to');

    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';

    applyInvoiceStats();
}

function openStatsPage() {
    showPage('stats');
    resetInvoiceStats();
}

function updateQrToggleButton() {
    const btn = document.getElementById('qr_toggle_btn');
    if (!btn) return;

    const textEl = btn.querySelector('.qr-toggle-text');
    const enabled = isQrEnabled();

    if (textEl) {
        textEl.textContent = enabled ? 'QR ON' : 'QR OFF';
    }

    if (enabled) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

function toggleQrGlobal() {
    const next = !isQrEnabled();
    setQrEnabled(next);
    updateQrToggleButton();

    if (next) {
        document.body.classList.remove('hide-qr');
    } else {
        document.body.classList.add('hide-qr');
    }

    showToast(next ? '✅ QR ON' : '🚫 QR OFF');
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

 function isCurrentInvoiceSaved() {
    const num = String(COMPANY_DATA?.currentInvoice?.num || '').trim();
    if (!num) return false;

    return (COMPANY_DATA.invoices || []).some(inv => String(inv.num || '').trim() === num);
}

function syncSavedInvoiceProtection() {
    isEditingSavedInvoice = isCurrentInvoiceSaved();
    savedInvoiceEditConfirmed = false;
}

function resetSavedInvoiceProtection() {
    isEditingSavedInvoice = false;
    savedInvoiceEditConfirmed = false;
}

function ensureSavedInvoiceEditConfirmed(applyChange) {
    if (!isEditingSavedInvoice || savedInvoiceEditConfirmed || isApplyingProtectedEdit) {
        applyChange();
        return;
    }

    confirmAction(
        'Edit Saved Invoice',
        'This invoice is already saved. Are you sure you want to edit it?',
        () => {
            savedInvoiceEditConfirmed = true;
            isApplyingProtectedEdit = true;

            try {
                applyChange();
            } finally {
                isApplyingProtectedEdit = false;
            }

            showToast('✏️ Saved invoice unlocked for editing');
        }
    );
}

 function requestProtectedFieldEdit(inputEl) {
    if (!inputEl) return false;
    if (!isEditingSavedInvoice || savedInvoiceEditConfirmed || isApplyingProtectedEdit) return true;
    if (inputEl.dataset.protectBusy === '1') return false;

    inputEl.dataset.protectBusy = '1';

    const oldValue = inputEl.value;

    confirmAction(
        'Edit Saved Invoice',
        'This invoice is already saved. Are you sure you want to edit it?',
        () => {
            savedInvoiceEditConfirmed = true;

            setTimeout(() => {
                inputEl.focus();
                inputEl.value = oldValue;
                inputEl.removeAttribute('data-protect-busy');
            }, 30);

            showToast('✏️ Saved invoice unlocked for editing');
        }
    );

    setTimeout(() => {
        inputEl.removeAttribute('data-protect-busy');
    }, 300);

    return false;
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
            data: getInvoiceBackupData()
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

            if (!isValidInvoiceBackupFile(backup)) {
    showToast('❌ Invalid or unsupported backup file');
    return;
}

            confirmAction(
    'Import Backup',
    'Import will replace current Invoice app data only. Continue?',
    () => {
        try {
            // Clear only this app's storage
            clearInvoiceAppStorage();

            // Restore only backup keys
            Object.keys(backup.data).forEach(key => {
    if (isAllowedInvoiceStorageKey(key)) {
        localStorage.setItem(key, backup.data[key]);
    }
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

 // =========================================
// SEPA QR CODE (EUROPE ONLY)
// =========================================

function parseInvoiceAmount(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;

    let cleaned = value.trim().replace(/[€$£₾\s]/g, '');
    cleaned = cleaned.replace(/[^\d.,-]/g, '');

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '');
        cleaned = cleaned.replace(',', '.');
    } else if (lastDot > lastComma) {
        cleaned = cleaned.replace(/,/g, '');
    } else if (lastComma !== -1) {
        cleaned = cleaned.replace(',', '.');
    }

    const number = Number(cleaned);
    return Number.isFinite(number) ? number : NaN;
}

function cleanIban(iban) {
    return String(iban || '')
        .toUpperCase()
        .replace(/\s+/g, '');
}

function isValidIban(iban) {
    const v = cleanIban(iban);
    return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v);
}

function safeText(value) {
    return String(value || '').trim();
}

function getInvoiceQrPayload(company, invoice) {
    const missing = [];
    
    const companyName = safeText(company?.companyName) || safeText(company?.name);
    const iban = cleanIban(company?.iban);
    const bic = safeText(company?.bic).replace(/\s+/g, '').toUpperCase();
    
    const invoiceNumber = safeText(invoice?.num) || safeText(invoice?.number);
    const description = safeText(invoice?.description) || 
                        safeText(invoice?.title) || 
                        safeText(invoice?.service);
    
    const amountRaw = invoice?.total ?? invoice?.grandTotal ?? invoice?.amount;
    const amount = parseInvoiceAmount(amountRaw);
    
    if (!companyName) missing.push('company name');
    if (!iban) {
        missing.push('IBAN');
    } else if (!isValidIban(iban)) {
        missing.push('valid IBAN');
    }
    if (!invoiceNumber) missing.push('invoice number');
    if (!Number.isFinite(amount) || amount <= 0) missing.push('valid amount');
    
    if (missing.length) {
        return {
            ok: false,
            message: `QR code missing: ${missing.join(', ')}`
        };
    }
    
    const amountEur = amount.toFixed(2);
    const remittanceText = description 
        ? `Invoice ${invoiceNumber} - ${description}`
        : `Invoice ${invoiceNumber}`;
    
    const giroLines = [
        'BCD',
        '002',
        '1',
        'SCT',
        bic || '',
        companyName.slice(0, 70),
        iban,
        `EUR${amountEur}`,
        '',
        '',
        remittanceText.slice(0, 140),
        ''
    ];
    
    return {
        ok: true,
        text: giroLines.join('\n'),
        remittanceText: remittanceText,
        amountEur: amountEur,
        companyName: companyName,
        invoiceNumber: invoiceNumber,
        iban: iban,
        bic: bic || 'Not required'
    };
}

function generateSEPAQRCode(text, size = 180) {
    return new Promise((resolve, reject) => {
        if (typeof QRCode === 'undefined') {
            reject(new Error('QRCode library not loaded'));
            return;
        }
        
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        document.body.appendChild(container);
        
        let timeoutId = null;
        let intervalId = null;
        
        const cleanup = () => {
            if (intervalId) clearInterval(intervalId);
            if (timeoutId) clearTimeout(timeoutId);
            if (container.parentNode) container.remove();
        };
        
        new QRCode(container, {
            text: text,
            width: size * 2,
            height: size * 2,
            correctLevel: QRCode.CorrectLevel.M
        });
        
        intervalId = setInterval(() => {
            const canvas = container.querySelector('canvas');
            const img = container.querySelector('img');
            
            if (canvas) {
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    cleanup();
                    resolve(dataUrl);
                } catch (err) {
                    cleanup();
                    reject(new Error('Failed to convert canvas to image'));
                }
            } else if (img && img.complete && img.src) {
                cleanup();
                resolve(img.src);
            }
        }, 50);
        
        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('QR code generation timeout'));
        }, 2000);
    });
}

function createQrCard(payload, qrDataUrl) {
    const card = document.createElement('div');
    card.className = 'qr-card';
    card.style.cssText = `
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 10px;
        background: #ffffff;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 140px;
        max-width: 160px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        margin: 6px auto;
    `;

    const title = document.createElement('div');
    title.textContent = currentLang === 'de' ? 'GiroCode' : 'SEPA Payment';
    title.style.cssText = `
        font-size: 12px;
        font-weight: 700;
        color: #1a202c;
        text-align: center;
        letter-spacing: 0.3px;
    `;

    const qrImg = document.createElement('img');
    qrImg.src = qrDataUrl;
    qrImg.alt = currentLang === 'de' ? 'GiroCode' : 'QR Code';
    qrImg.style.cssText = `
        width: 100px;
        height: 100px;
        display: block;
        border-radius: 6px;
        background: white;
        padding: 2px;
        image-rendering: crisp-edges;
    `;

    const hint = document.createElement('div');
    hint.textContent = currentLang === 'de'
        ? 'Mit Ihrer Banking-App scannen'
        : 'Scan with your banking app';
    hint.style.cssText = `
        font-size: 10px;
        color: #64748b;
        text-align: center;
    `;

    const info = document.createElement('div');
    info.style.cssText = `
        font-size: 10px;
        line-height: 1.25;
        color: #334155;
        text-align: center;
        background: #f8fafc;
        padding: 6px;
        border-radius: 8px;
        width: 100%;
    `;

    const amountSpan = document.createElement('div');
    amountSpan.style.fontWeight = '700';
    amountSpan.style.fontSize = '12px';
    amountSpan.textContent = `${payload.amountEur} EUR`;

    const invoiceSpan = document.createElement('div');
    invoiceSpan.style.fontSize = '9px';
    invoiceSpan.style.marginTop = '2px';
    invoiceSpan.textContent = `${currentLang === 'de' ? 'Rechnung' : 'Invoice'} ${payload.invoiceNumber}`;

    info.appendChild(amountSpan);
    info.appendChild(invoiceSpan);

    card.appendChild(title);
    card.appendChild(qrImg);
    card.appendChild(hint);
    card.appendChild(info);

    return card;
}

function createErrorBox(message) {
    const box = document.createElement('div');
    box.style.cssText = `
        border: 1px solid #fecaca;
        border-radius: 12px;
        padding: 12px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 500;
        break-inside: avoid;
        page-break-inside: avoid;
        max-width: 220px;
        margin: 10px auto;
    `;
    box.textContent = message;
    return box;
}

async function renderInvoicePaymentQR(targetEl, company, invoice) {
    if (!targetEl) {
        console.warn('renderInvoicePaymentQR: target element not found');
        return;
    }
    
    targetEl.innerHTML = '';
    
    if (typeof QRCode === 'undefined') {
        targetEl.appendChild(createErrorBox(
            'QR library not loaded. Please include qrcode.js'
        ));
        return;
    }
    
    const payload = getInvoiceQrPayload(company, invoice);
    
    if (!payload.ok) {
        targetEl.appendChild(createErrorBox(payload.message));
        return;
    }
    
    try {
        const qrDataUrl = await generateSEPAQRCode(payload.text, 180);
        const card = createQrCard(payload, qrDataUrl);
        targetEl.appendChild(card);
    } catch (error) {
        console.error('QR generation error:', error);
        targetEl.appendChild(createErrorBox(
            'Failed to generate QR code. Please refresh and try again.'
        ));
    }
}

  function waitForQrRender(targetEl, timeout = 2500) {
    return new Promise(resolve => {
        if (!targetEl) {
            resolve(false);
            return;
        }

        const hasReadyQr = () => {
            const img = targetEl.querySelector('img');
            return !!(img && img.src && img.complete);
        };

        if (hasReadyQr()) {
            resolve(true);
            return;
        }

        const start = Date.now();

        const interval = setInterval(() => {
            if (hasReadyQr()) {
                clearInterval(interval);
                resolve(true);
                return;
            }

            if (Date.now() - start >= timeout) {
                clearInterval(interval);
                resolve(false);
            }
        }, 50);
    });
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
    ensureSavedInvoiceEditConfirmed(() => {
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
    });
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