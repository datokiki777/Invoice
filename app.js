// =========================================
// DATA MODEL
// =========================================
let DB = {
    company: {
        name: 'D-BUILDER SIA',
        reg: 'Reg No: 40203480659',
        addr: 'Mirdzas Ķempes iela 11-34, Rīga, LV-1014',
        phone: 'Tel: +371 28601141',
        email: 'dbuilder.team@gmail.com',
        bankRecip: 'D-BUILDER SIA',
        bankName: 'Revolut Bank UAB',
        bankIban: 'LT68 3250 0118 6894 4162',
        bankBic: 'REVOLT21'
    },
    currentInvoice: {
        num: '',
        date: '',
        due: '',
        client: '',
        vatRate: 21,
        vatText: '',
        items: [{ desc: '', qty: 1, price: 0 }]
    },
    invoices: [],   // history
    clients: []     // client db
};

function loadDB() {
    const raw = localStorage.getItem('dbuilder_v2');
    if (raw) {
        try { DB = JSON.parse(raw); } catch(e) {}
    }
}

function saveDB() {
    localStorage.setItem('dbuilder_v2', JSON.stringify(DB));
}

// =========================================
// INIT
// =========================================
window.onload = function() {
    loadDB();
    document.getElementById('today_status').innerText = '📅 ' + getCurrentDate();
    
    if (!DB.currentInvoice.num) DB.currentInvoice.num = generateInvoiceNumber();
    if (!DB.currentInvoice.date) DB.currentInvoice.date = getCurrentDate();

    renderInvoiceForm();
    renderHistory();
    renderClients();
    refreshClientPicker();

    // ---- PWA: Service Worker + Install + Update ----
    let deferredPrompt = null;       // Android install prompt
    let swRegistration = null;

    // Android: catch install prompt
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        // Only show if not dismissed before
        if (!sessionStorage.getItem('install_dismissed')) {
            setTimeout(() => showAndroidInstallToast(), 1500);
        }
    });

    function showAndroidInstallToast() {
        if (!deferredPrompt) return;
        const t = document.getElementById('toast');
        t.innerHTML = '📲 Install this app on your home screen! <button onclick="triggerAndroidInstall()" style="background:var(--secondary);color:var(--primary);border:none;border-radius:12px;padding:4px 12px;font-size:13px;font-weight:700;cursor:pointer;margin-left:8px;">Install</button>';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 7000);
    }

    function triggerAndroidInstall() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') showToast('✅ App installed!');
            deferredPrompt = null;
        });
    }

    // iOS: detect Safari and show banner
    function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent);
    }
    function isInStandaloneMode() {
        return window.navigator.standalone === true ||
               window.matchMedia('(display-mode: standalone)').matches;
    }

    if (isIOS() && !isInStandaloneMode() && !sessionStorage.getItem('ios_banner_dismissed')) {
        setTimeout(() => {
            document.getElementById('ios-banner').classList.add('show');
        }, 1800);
    }

    function dismissIOSBanner() {
        document.getElementById('ios-banner').classList.remove('show');
        sessionStorage.setItem('ios_banner_dismissed', '1');
    }

    // Service Worker registration + update detection
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            swRegistration = reg;

            // Check for waiting SW (= new version available)
            if (reg.waiting) showUpdateBanner();

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });
        }).catch(() => {});

        // When SW activates after skip-waiting, reload
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) { refreshing = true; window.location.reload(); }
        });
    }

    function showUpdateBanner() {
        document.getElementById('update-banner').classList.add('show');
    }

    function applyUpdate() {
        dismissUpdate();
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }

    function dismissUpdate() {
        document.getElementById('update-banner').classList.remove('show');
    }
};

// =========================================
// PAGE NAVIGATION
// =========================================
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
    if (name === 'history') renderHistory();
    if (name === 'clients') renderClients();
}

// =========================================
// INVOICE FORM
// =========================================
function renderInvoiceForm() {
    const ci = DB.currentInvoice;
    const co = DB.company;

    // company
    document.getElementById('my_comp_name').value = co.name;
    document.getElementById('my_reg_no').value = co.reg;
    document.getElementById('my_addr').value = co.addr;
    document.getElementById('my_phone').value = co.phone;
    document.getElementById('my_email').value = co.email;
    document.getElementById('bank_recip').value = co.bankRecip;
    document.getElementById('bank_name').value = co.bankName;
    document.getElementById('bank_iban').value = co.bankIban;
    document.getElementById('bank_bic').value = co.bankBic;

    // invoice fields
    document.getElementById('inv_num').value = ci.num;
    document.getElementById('inv_date').value = ci.date;
    document.getElementById('inv_due').value = ci.due || '';
    document.getElementById('client_info').value = ci.client;
    document.getElementById('vat_rate').value = ci.vatRate;
    document.getElementById('vat_text').value = ci.vatText || '';

    // items
    if (!ci.items || ci.items.length === 0) {
        ci.items = [{ desc: '', qty: 1, price: 0 }];
    }
    renderItemRows();
    calculateAll();
}

function renderItemRows() {
    const tbody = document.getElementById('items-body');
    tbody.innerHTML = '';
    DB.currentInvoice.items.forEach((item, i) => {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.dataset.index = i;
        const total = (parseFloat(item.qty)||0) * (parseFloat(item.price)||0);
        tr.innerHTML = `
            <td>
                <input type="text" class="item-desc-input" value="${esc(item.desc)}"
                    oninput="updateItem(${i},'desc',this.value)" placeholder="Description of work...">
            </td>
            <td style="text-align:center">
                <input type="number" class="item-num-input" value="${item.qty}"
                    oninput="updateItem(${i},'qty',this.value)" min="0" step="0.01" style="width:70px">
            </td>
            <td>
                <div class="item-price-wrap">
                    <span class="currency">€</span>
                    <input type="number" class="item-num-input" value="${item.price}"
                        oninput="updateItem(${i},'price',this.value)" min="0" step="0.01" style="width:90px">
                </div>
            </td>
            <td class="item-total-cell">
                €<span id="row-total-${i}">${total.toFixed(2)}</span>
            </td>
            <td class="no-print" style="width:36px">
                ${DB.currentInvoice.items.length > 1 ? `<button class="remove-row-btn" onclick="removeItemRow(${i})" title="Delete">✕</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateItem(index, field, value) {
    DB.currentInvoice.items[index][field] = value;
    calculateAll();
    saveDB();
}

function addItemRow() {
    DB.currentInvoice.items.push({ desc: '', qty: 1, price: 0 });
    renderItemRows();
    calculateAll();
    saveDB();
    // focus the new row
    const rows = document.querySelectorAll('.item-desc-input');
    if (rows.length) rows[rows.length - 1].focus();
}

function removeItemRow(index) {
    DB.currentInvoice.items.splice(index, 1);
    renderItemRows();
    calculateAll();
    saveDB();
}

function calculateAll() {
    const items = DB.currentInvoice.items;
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
    DB.currentInvoice.vatRate = vatRate;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    document.getElementById('subtotal_display').innerText = subtotal.toFixed(2);
    document.getElementById('vat_amount').innerText = vat.toFixed(2);
    document.getElementById('grand_total').innerText = total.toFixed(2);
}

function saveAllData() {
    // company
    DB.company.name = document.getElementById('my_comp_name').value;
    DB.company.reg = document.getElementById('my_reg_no').value;
    DB.company.addr = document.getElementById('my_addr').value;
    DB.company.phone = document.getElementById('my_phone').value;
    DB.company.email = document.getElementById('my_email').value;
    DB.company.bankRecip = document.getElementById('bank_recip').value;
    DB.company.bankName = document.getElementById('bank_name').value;
    DB.company.bankIban = document.getElementById('bank_iban').value;
    DB.company.bankBic = document.getElementById('bank_bic').value;

    // invoice
    DB.currentInvoice.num = document.getElementById('inv_num').value;
    DB.currentInvoice.date = document.getElementById('inv_date').value;
    DB.currentInvoice.due = document.getElementById('inv_due').value;
    DB.currentInvoice.client = document.getElementById('client_info').value;
    DB.currentInvoice.vatRate = parseFloat(document.getElementById('vat_rate').value) || 0;
    DB.currentInvoice.vatText = document.getElementById('vat_text').value;

    saveDB();
    calculateAll();
}

// =========================================
// INVOICE HISTORY
// =========================================
function saveInvoiceToHistory() {
    saveAllData();
    const inv = JSON.parse(JSON.stringify(DB.currentInvoice));
    inv.savedAt = new Date().toISOString();

    // update if exists, else push
    const existIdx = DB.invoices.findIndex(i => i.num === inv.num);
    if (existIdx >= 0) {
        DB.invoices[existIdx] = inv;
    } else {
        DB.invoices.unshift(inv);
    }
    saveDB();
    showToast('✅ Invoice saved!');
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!DB.invoices || DB.invoices.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🗂️</div><p>No invoices saved yet</p></div>`;
        return;
    }

    list.innerHTML = DB.invoices.map((inv, i) => {
        const subtotal = (inv.items || []).reduce((s, it) => s + (parseFloat(it.qty)||0)*(parseFloat(it.price)||0), 0);
        const vat = subtotal * ((parseFloat(inv.vatRate)||0)/100);
        const total = subtotal + vat;
        const isCurrent = inv.num === DB.currentInvoice.num;
        const clientName = (inv.client || '').split('\n')[0] || 'No client specified';
        const savedDate = inv.savedAt ? new Date(inv.savedAt).toLocaleDateString('ka-GE') : '';

        return `
        <div class="history-card ${isCurrent ? 'current' : ''}">
            <div>
                <div class="hist-num">${esc(inv.num)}</div>
                <div class="hist-client">${esc(clientName)}</div>
                <div class="hist-meta">📅 ${esc(inv.date)} ${inv.due ? '→ ' + esc(inv.due) : ''}</div>
                <div class="hist-actions">
                    <button class="hist-btn hist-btn-load" onclick="loadInvoiceFromHistory(${i})">📂 Open</button>
                    <button class="hist-btn hist-btn-pdf" onclick="exportHistoryPDF(${i})">📥 PDF</button>
                    <button class="hist-btn hist-btn-del" onclick="deleteInvoice(${i})">🗑️ Delete</button>
                </div>
            </div>
            <div class="hist-right">
                <div class="hist-amount">€${total.toFixed(2)}</div>
                <div class="hist-date">${savedDate ? 'Saved: ' + savedDate : ''}</div>
                <span class="hist-badge ${isCurrent ? 'badge-current' : 'badge-saved'}">${isCurrent ? '● Current' : '✓ Saved'}</span>
            </div>
        </div>`;
    }).join('');
}

function loadInvoiceFromHistory(index) {
    DB.currentInvoice = JSON.parse(JSON.stringify(DB.invoices[index]));
    saveDB();
    renderInvoiceForm();
    showPage('invoice');
    showToast('📂 Invoice loaded');
}

function deleteInvoice(index) {
    confirmAction('Delete Invoice', `Delete invoice #${DB.invoices[index].num}? This cannot be undone.`, () => {
        DB.invoices.splice(index, 1);
        saveDB();
        renderHistory();
        showToast('🗑️ Invoice deleted');
    });
}

// =========================================
// NEW / CLEAR
// =========================================
function newInvoice() {
    confirmAction('New Invoice', 'Create a new invoice? Make sure current invoice is saved.', () => {
        DB.currentInvoice = {
            num: generateInvoiceNumber(),
            date: getCurrentDate(),
            due: '',
            client: '',
            vatRate: 21,
            vatText: '',
            items: [{ desc: '', qty: 1, price: 0 }]
        };
        saveDB();
        renderInvoiceForm();
        showToast('➕ New Invoice');
    });
}

function clearEverything() {
    confirmAction('Reset Everything', 'All data will be cleared. Are you sure?', () => {
        localStorage.removeItem('dbuilder_v2');
        location.reload();
    });
}

// =========================================
// CLIENTS
// =========================================
function saveClient() {
    const name = document.getElementById('new_client_name').value.trim();
    if (!name) { showToast('⚠️ Name is required!'); return; }

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
        const idx = DB.clients.findIndex(c => c.id === editId);
        if (idx >= 0) DB.clients[idx] = client;
    } else {
        DB.clients.push(client);
    }

    saveDB();
    clearClientForm();
    renderClients();
    refreshClientPicker();
    showToast('✅ Client saved!');
}

function editClient(id) {
    const c = DB.clients.find(c => c.id === id);
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
    document.getElementById('client-form-title').innerText = 'New client';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

function deleteClient(id) {
    const c = DB.clients.find(cl => cl.id === id);
    if (!c) return;
    confirmAction('Delete Client', `Delete "${c.name}"?`, () => {
        DB.clients = DB.clients.filter(cl => cl.id !== id);
        saveDB();
        renderClients();
        refreshClientPicker();
        showToast('🗑️ Client deleted');
    });
}

function useClientForInvoice(id) {
    const c = DB.clients.find(cl => cl.id === id);
    if (!c) return;
    let info = c.name;
    if (c.reg) info += '\n' + c.reg;
    if (c.addr) info += '\n' + c.addr;
    if (c.email) info += '\n' + c.email;
    if (c.phone) info += '\n' + c.phone;
    DB.currentInvoice.client = info;
    document.getElementById('client_info').value = info;
    saveDB();
    showPage('invoice');
    showToast('👤 Client added to invoice');
}

function renderClients() {
    const grid = document.getElementById('clients-grid');
    if (!DB.clients || DB.clients.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">👤</div><p>No clients yet</p></div>`;
        return;
    }
    grid.innerHTML = DB.clients.map(c => `
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
    (DB.clients || []).forEach(c => {
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
// PDF EXPORT (jsPDF)
// =========================================
function buildPDFFromInvoice(inv) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297;
    const margin = 15;

    const L = LANG[currentLang] || LANG['en'];

    // Header BG
    doc.setFillColor(13, 61, 122);
    doc.roundedRect(0, 0, W, 48, 0, 0, 'F');

    // Company name
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const co = DB.company;
    doc.text(co.name, margin, 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text([co.reg, co.addr, co.phone, co.email].filter(Boolean).join('  |  '), margin, 22, { maxWidth: 130 });

    // INVOICE title
    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255,255,255);
    doc.text(L.invoiceWord, W - margin, 20, { align: 'right' });

    // Invoice details box
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, 52, W - margin*2, 28, 4, 4, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(L.billedTo.toUpperCase(), margin+4, 59);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30,30,30);
    doc.setFontSize(9);
    const clientLines = (inv.client || '').split('\n').slice(0,4);
    doc.text(clientLines, margin+4, 64);

    // Invoice number, date
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(9);
    doc.text(L.invoiceNum, W/2+10, 59);
    doc.text(L.date, W/2+10, 65);
    if (inv.due) doc.text(L.dueDate, W/2+10, 71);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30,30,30);
    doc.text(inv.num || '', W - margin, 59, { align: 'right' });
    doc.text(inv.date || '', W - margin, 65, { align: 'right' });
    if (inv.due) doc.text(inv.due, W - margin, 71, { align: 'right' });

    // Table header
    let y = 86;
    doc.setFillColor(13, 61, 122);
    doc.rect(margin, y, W - margin*2, 8, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(L.description.toUpperCase(), margin+3, y+5.5);
    doc.text(L.qty.toUpperCase(), 125, y+5.5, { align: 'center' });
    doc.text(L.unitPrice.toUpperCase(), 155, y+5.5, { align: 'center' });
    doc.text(L.amount.toUpperCase(), W-margin-2, y+5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(30,30,30);
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
            doc.rect(margin, y, W - margin*2, 8, 'F');
        }

        doc.setTextColor(30,30,30);
        const descText = doc.splitTextToSize(item.desc || '', 90);
        doc.text(descText[0] || '', margin+3, y+5.5);
        doc.text(q.toString(), 125, y+5.5, { align: 'center' });
        doc.text('€' + p.toFixed(2), 155, y+5.5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 61, 122);
        doc.text('€' + t.toFixed(2), W-margin-2, y+5.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30,30,30);
        y += 8;
    });

    // Summary
    y += 4;
    const vatRate = parseFloat(inv.vatRate) || 0;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    const sW = 80, sX = W - margin - sW;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100,100,100);
    doc.text(L.subtotal, sX, y+5); doc.text('€'+subtotal.toFixed(2), W-margin, y+5, {align:'right'});
    y += 7;
    const vatLabel = L.vatLabel(vatRate) + (inv.vatText ? ' '+inv.vatText : '');
    doc.text(vatLabel, sX, y+5); doc.text('€'+vat.toFixed(2), W-margin, y+5, {align:'right'});
    y += 4;

    // Total box
    doc.setFillColor(255, 193, 7);
    doc.roundedRect(sX-2, y, sW+margin+2, 12, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(L.total, sX+2, y+8.5);
    doc.text('€'+total.toFixed(2), W-margin-2, y+8.5, {align:'right'});

    y += 18;

    // Bank details
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(margin, y, (W-margin*2)/2-5, 32, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(L.bankDetails.toUpperCase(), margin+4, y+6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50,50,50);
    const bankLines = [
        `${L.recipient}: ${co.bankRecip}`,
        `${L.bank}: ${co.bankName}`,
        `IBAN: ${co.bankIban}`,
        `BIC: ${co.bankBic}`
    ];
    doc.text(bankLines, margin+4, y+12, { lineHeightFactor: 1.5 });

    // Terms
    const tX = W/2+2;
    doc.setFillColor(245, 248, 255);
    doc.roundedRect(tX, y, W-margin-tX, 32, 3, 3, 'F');
    doc.setTextColor(13, 61, 122);
    doc.setFont('helvetica', 'bold');
    doc.text(L.terms.toUpperCase(), tX+4, y+6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100,100,100);
    doc.text(L.termsText.replace('\\n','\n'), tX+4, y+12, { lineHeightFactor: 1.6, maxWidth: W-margin-tX-4 });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150,150,150);
    doc.text(co.name + ' | ' + (co.email || '') + ' | ' + (co.phone || ''), W/2, H-8, { align: 'center' });

    return doc;
}

function exportPDF() {
    saveAllData();
    try {
        const doc = buildPDFFromInvoice(DB.currentInvoice);
        doc.save(`invoice-${DB.currentInvoice.num || 'draft'}.pdf`);
        showToast('📥 PDF ready!');
    } catch(e) {
        showToast('❌ PDF error: ' + e.message);
    }
}

function exportHistoryPDF(index) {
    const inv = DB.invoices[index];
    if (!inv) return;
    try {
        const doc = buildPDFFromInvoice(inv);
        doc.save(`invoice-${inv.num || 'draft'}.pdf`);
        showToast('📥 PDF: ' + inv.num);
    } catch(e) {
        showToast('❌ PDF error');
    }
}

// =========================================
// HELPERS
// =========================================
function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const lastNums = (DB.invoices || [])
        .map(i => i.num)
        .filter(n => n && n.startsWith(year+'-'))
        .map(n => parseInt(n.split('-')[1]) || 0);
    const next = lastNums.length ? Math.max(...lastNums) + 1 : 1;
    return `${year}-${next.toString().padStart(3,'0')}`;
}

function getCurrentDate() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

let modalCallback = null;
function confirmAction(title, msg, callback) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    modalCallback = callback;
    document.getElementById('modal-overlay').classList.add('show');
}

document.getElementById('modal-confirm-btn').onclick = function() {
    closeModal();
    if (modalCallback) modalCallback();
};

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
    modalCallback = null;
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

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
            dueDate: 'Due Date',
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
            vatLabel: (r) => `VAT (${r}%)`,
            invoiceNumLabel: 'Invoice #',
            dateLabel: 'Date',
            dueDateLabel: 'Due Date',
        },
        de: {
            invoiceWord: 'RECHNUNG',
            billedTo: 'Rechnungsempfänger',
            invoiceDetails: 'Rechnungsdetails',
            invoiceNum: 'Rechnungs-Nr.',
            date: 'Datum',
            dueDate: 'Fälligkeitsdatum',
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
            vatLabel: (r) => `MwSt. (${r}%)`,
        }
    };

    let currentLang = localStorage.getItem('db_lang') || 'en';

    function toggleLang() {
        currentLang = currentLang === 'en' ? 'de' : 'en';
        localStorage.setItem('db_lang', currentLang);
        applyLang();
    }

    function applyLang() {
        const L = LANG[currentLang];
        const btn = document.getElementById('lang-toggle');

        if (currentLang === 'de') {
            btn.textContent = '🇩🇪 DE';
            btn.title = 'Switch to English';
        } else {
            btn.textContent = '🇬🇧 EN';
            btn.title = 'Switch to German';
        }

        // Invoice word
        const iw = document.querySelector('.invoice-word');
        if (iw) iw.textContent = L.invoiceWord;

        // Meta labels
        setTxt('.meta-left .meta-label', L.billedTo);
        setTxt('.meta-right .meta-label', L.invoiceDetails);

        // Meta rows
        const mRows = document.querySelectorAll('.meta-detail-row label');
        if (mRows[0]) mRows[0].textContent = L.invoiceNum;
        if (mRows[1]) mRows[1].textContent = L.date;
        if (mRows[2]) mRows[2].textContent = L.dueDate;

        // Table headers
        const ths = document.querySelectorAll('.items-table th');
        if (ths[0]) ths[0].textContent = L.description;
        if (ths[1]) ths[1].textContent = L.qty;
        if (ths[2]) ths[2].textContent = L.unitPrice;
        if (ths[3]) ths[3].textContent = L.amount;

        // Summary
        const sumLines = document.querySelectorAll('.summary-line');
        if (sumLines[0]) sumLines[0].querySelector('span:first-child').textContent = L.subtotal;

        // VAT label — rebuild vat-box text nodes
        updateVatLabel();

        // Total
        const totalBox = document.querySelector('.summary-total span:first-child');
        if (totalBox) totalBox.textContent = L.total;

        // Footer titles
        const ftitles = document.querySelectorAll('.footer-title');
        if (ftitles[0]) ftitles[0].textContent = L.bankDetails;
        if (ftitles[1]) ftitles[1].textContent = L.terms;

        // Terms text
        const termsEl = document.querySelector('.terms-text');
        if (termsEl) termsEl.innerHTML = L.termsText.replace('\n', '<br>');

        // Bank row labels
        const bankLabels = document.querySelectorAll('.bank-row strong');
        if (bankLabels[0]) bankLabels[0].textContent = L.recipient;
        if (bankLabels[1]) bankLabels[1].textContent = L.bank;

        // Add row button
        const addBtn = document.querySelector('.add-row-btn');
        if (addBtn) addBtn.innerHTML = L.addRow;

        // Client picker placeholder
        const picker = document.getElementById('client_picker');
        if (picker && picker.options[0]) picker.options[0].text = L.selectClient;
    }

    function updateVatLabel() {
        const vatRate = document.getElementById('vat_rate') ? document.getElementById('vat_rate').value : '21';
        const L = LANG[currentLang];
        // The vat-box contains: "VAT (" + input + "%)" + vat-text-input
        // We keep the inputs, just update surrounding text nodes
        const vatBox = document.querySelector('.vat-box');
        if (!vatBox) return;
        // Remove text nodes, keep input elements
        Array.from(vatBox.childNodes).forEach(n => { if (n.nodeType === 3) n.remove(); });
        const inputs = vatBox.querySelectorAll('input');
        vatBox.innerHTML = '';
        if (currentLang === 'de') {
            vatBox.appendChild(document.createTextNode('MwSt. ('));
        } else {
            vatBox.appendChild(document.createTextNode('VAT ('));
        }
        if (inputs[0]) vatBox.appendChild(inputs[0]);
        vatBox.appendChild(document.createTextNode('%)'));
        if (inputs[1]) vatBox.appendChild(inputs[1]);
    }

    function setTxt(sel, txt) {
        const el = document.querySelector(sel);
        if (el) el.textContent = txt;
    }
