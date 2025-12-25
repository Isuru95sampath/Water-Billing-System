// --- 1. DATA MOCKUP (Simulating Firebase) ---
const state = {
    currentUser: null,
    users: [
        { id: 'u1', name: 'Admin User', email: 'admin@water.com', password: 'admin123', role: 'admin' },
        { id: 'u2', name: 'John Smith', email: 'user@water.com', password: 'user123', role: 'customer', address: '123 Main St' },
        { id: 'u3', name: 'Sarah Connor', email: 'sarah@water.com', password: 'user123', role: 'customer', address: '45 Sky Net Blvd' },
        { id: 'u4', name: 'Mike Ross', email: 'mike@water.com', password: 'user123', role: 'customer', address: '78 Legal Ln' }
    ],
    bills: [
        // History
        { id: 'b1', customerId: 'u2', month: '2023-08', presentUnits: 100, prevUnits: 90, consumed: 10, total: 900 }, // 650+250
        { id: 'b2', customerId: 'u2', month: '2023-09', presentUnits: 1132.1, prevUnits: 100, consumed: 12.1, total: 1146 }, // (650+70+6) + 250
        { id: 'b3', customerId: 'u3', month: '2023-09', presentUnits: 50.5, prevUnits: 45, consumed: 5.5, total: 643 } // (325+30) + 250
    ]
};

let currentAuthRole = 'admin';

// --- 2. AUTHENTICATION LOGIC ---

function switchAuthTab(role) {
    currentAuthRole = role;
    const adminTab = document.getElementById('tab-admin');
    const custTab = document.getElementById('tab-customer');
    const title = document.getElementById('auth-title');

    if (role === 'admin') {
        adminTab.className = "flex-1 py-4 text-center font-semibold text-blue-600 border-b-2 border-blue-600 bg-blue-50 transition";
        custTab.className = "flex-1 py-4 text-center font-semibold text-gray-500 hover:text-blue-500 transition";
        title.textContent = "Admin Login";
    } else {
        custTab.className = "flex-1 py-4 text-center font-semibold text-blue-600 border-b-2 border-blue-600 bg-blue-50 transition";
        adminTab.className = "flex-1 py-4 text-center font-semibold text-gray-500 hover:text-blue-500 transition";
        title.textContent = "Customer Login";
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const user = state.users.find(u => u.email === email && u.password === password);

    if (user) {
        if (user.role !== currentAuthRole) {
            showToast(`Please use the ${user.role} sign-in tab.`, 'error');
            return;
        }
        state.currentUser = user;
        showToast(`Welcome back, ${user.name}!`, 'success');
        
        document.getElementById('login-view').classList.add('hidden');
        if (user.role === 'admin') {
            initAdminDashboard();
        } else {
            initCustomerDashboard();
        }
    } else {
        showToast("Invalid email or password.", 'error');
    }
}

function logout() {
    state.currentUser = null;
    document.getElementById('login-form').reset();
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    showToast("Logged out successfully.", 'info');
}

// --- 3. BILLING LOGIC ---

/**
 * Calculates the water usage cost only.
 * Input units expected to be rounded to 1 decimal.
 */
function calculateBill(units) {
    if (units <= 0) {
        return { 
            total: 0, 
            breakdown: [] 
        };
    }

    const intUnits = Math.floor(units);
    const decUnits = parseFloat((units - intUnits).toFixed(2));

    let total = 0;
    let breakdown = [];

    // 1. First 10 units
    if (intUnits > 0) {
        const slab1Units = Math.min(intUnits, 10);
        const slab1Cost = slab1Units * 65;
        total += slab1Cost;
        breakdown.push(`Slab 1 (${slab1Units}): ${slab1Cost}`);
    }

    // 2. Remaining units (> 10)
    if (intUnits > 10) {
        const slab2Units = intUnits - 10;
        const slab2Cost = slab2Units * 70;
        total += slab2Cost;
        breakdown.push(`Slab 2 (${slab2Units}): ${slab2Cost}`);
    }

    // 3. Decimal units
    if (decUnits > 0) {
        const decRate = 60; 
        const decCost = decUnits * decRate;
        total += decCost;
        breakdown.push(`Decimal (${decUnits}): ${decCost.toFixed(2)}`);
    }

    return { 
        total: parseFloat(total.toFixed(2)), 
        breakdown: breakdown 
    };
}

// Fine State Variable
let currentFineAmount = 0; 

// Function to set the fine amount and recalculate
function setFine(amount) {
    currentFineAmount = amount;
    previewCalculation();
}

// --- 4. ADMIN DASHBOARD ---

function initAdminDashboard() {
    document.getElementById('admin-view').classList.remove('hidden');
    renderCustomerTable();
}

function renderCustomerTable() {
    const tbody = document.getElementById('customer-table-body');
    const searchTerm = document.getElementById('admin-search').value.toLowerCase();
    tbody.innerHTML = '';

    const customers = state.users.filter(u => u.role === 'customer' && u.name.toLowerCase().includes(searchTerm));
    document.getElementById('total-customers-count').textContent = customers.length;

    customers.forEach(customer => {
        const customerBills = state.bills.filter(b => b.customerId === customer.id);
        customerBills.sort((a, b) => b.month.localeCompare(a.month));
        const lastBill = customerBills[0];
        const lastReading = lastBill ? lastBill.presentUnits : 0;
        const status = lastBill ? 'Active' : 'New';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b border-gray-100 transition";
        tr.innerHTML = `
            <td class="p-4"><div class="font-medium text-gray-800">${customer.name}</div><div class="text-xs text-gray-500">ID: ${customer.id}</div></td>
            <td class="p-4 text-gray-600">${customer.email}</td>
            <td class="p-4 font-mono text-blue-600">${lastReading}</td>
            <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-semibold ${status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${status}</span></td>
            <td class="p-4 text-right"><button onclick="openBillingModal('${customer.id}')" class="text-blue-600 hover:text-blue-800 font-medium text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition"><i class="fa-solid fa-file-invoice mr-1"></i> Add Bill</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 5. MODAL & BILLING SUBMIT ---

function openBillingModal(customerId) {
    const customer = state.users.find(u => u.id === customerId);
    if (!customer) return;

    document.getElementById('modal-customer-id').value = customer.id;
    document.getElementById('modal-customer-name').textContent = customer.name;
    
    const bills = state.bills.filter(b => b.customerId === customerId);
    bills.sort((a, b) => b.month.localeCompare(a.month));
    const prevBill = bills[0];
    
    const prevUnits = prevBill ? prevBill.presentUnits : 0;
    document.getElementById('modal-prev-units').value = prevUnits;
    
    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7); 
    document.getElementById('modal-month').value = monthStr;
    document.getElementById('modal-present-units').value = '';
    
    // Reset Fine State
    currentFineAmount = 0;

    // Reset preview
    document.getElementById('preview-total').textContent = "Rs 0.00";
    document.getElementById('calc-breakdown').innerHTML = '<p class="text-gray-400 italic">Enter units to preview...</p>';

    document.getElementById('billing-modal').classList.remove('hidden');
    document.getElementById('billing-modal').classList.add('flex');
    document.getElementById('modal-present-units').focus();
}

function closeModal() {
    document.getElementById('billing-modal').classList.add('hidden');
    document.getElementById('billing-modal').classList.remove('flex');
}

function previewCalculation() {
    const prevUnits = parseFloat(document.getElementById('modal-prev-units').value) || 0;
    const presentUnits = parseFloat(document.getElementById('modal-present-units').value) || 0;

    if (presentUnits < prevUnits) {
        document.getElementById('preview-total').textContent = "Error: Present < Prev";
        document.getElementById('preview-total').classList.add('text-red-500');
        document.getElementById('calc-breakdown').innerHTML = '<span class="text-red-500">Present reading must be higher.</span>';
        return;
    } else {
        document.getElementById('preview-total').classList.remove('text-red-500');
    }

    // Calculate consumed units and force exactly 1 decimal place
    let consumed = presentUnits - prevUnits;
    consumed = parseFloat(consumed.toFixed(1));
    
    // 1. Calculate Monthly Use (Water Bill)
    const waterBillResult = calculateBill(consumed);
    
    // 2. Maintain Cost (Fixed)
    const maintainCost = 250;
    
    // 3. Fine Amount (Now variable: 0, 0.5, or 200)
    const fineCost = currentFineAmount;

    // 4. Total Calculation
    const grandTotal = waterBillResult.total + maintainCost + fineCost;

    // Construct Breakdown HTML
    let html = `<div class="text-xs text-gray-500 mb-2 border-b border-blue-100 pb-1">Consumed: <b class="text-blue-700">${consumed} units</b></div>`;
    
    // Show breakdown details (compact)
    if(waterBillResult.breakdown.length > 0) {
        html += `<div class="text-xs text-gray-400 mb-2">(${waterBillResult.breakdown.join(', ')})</div>`;
    }

    html += `<div class="flex justify-between text-sm mb-1 items-center"><span>Monthly Use:</span> <span class="font-medium">Rs ${waterBillResult.total.toFixed(2)}</span></div>`;
    html += `<div class="flex justify-between text-sm mb-1 items-center"><span>Maintain Cost:</span> <span class="font-medium">Rs ${maintainCost.toFixed(2)}</span></div>`;

    // Fine Buttons Section
    // Define available fine options
    const fineOptions = [
        { val: 0, label: "No Fine" },
        { val: 50, label: "Rs 50.0" },
        { val: 200, label: "Rs 200.00" }
    ];

    html += `<div class="mt-3 pt-2 border-t border-blue-200">
        <div class="text-sm text-gray-700 font-semibold mb-2">Fine Amount:</div>
        <div class="flex gap-2">`;
    
    fineOptions.forEach(opt => {
        // Style logic: If this option is selected, make it Red. If not, Gray.
        const isActive = (currentFineAmount === opt.val);
        const btnClass = isActive 
            ? "bg-red-500 text-white shadow-md scale-105" 
            : "bg-gray-100 text-gray-600 hover:bg-gray-200";
        
        html += `<button onclick="setFine(${opt.val})" class="${btnClass} px-3 py-1 rounded text-xs font-bold transition-all duration-200 border border-transparent">
            ${opt.label}
        </button>`;
    });

    html += `</div>`;

    // Show added fine if any
    if (fineCost > 0) {
        html += `<div class="flex justify-between text-sm text-red-600 mt-2 pl-2 font-medium"><span>Added Fine:</span> <span>+ Rs ${fineCost.toFixed(2)}</span></div>`;
    }

    html += `</div>`; // End fine section

    // Update UI
    document.getElementById('calc-breakdown').innerHTML = html;
    document.getElementById('preview-total').textContent = `Rs ${grandTotal.toFixed(2)}`;
}

function handleBillingSubmit(e) {
    e.preventDefault();
    const customerId = document.getElementById('modal-customer-id').value;
    const prevUnits = parseFloat(document.getElementById('modal-prev-units').value);
    const presentUnits = parseFloat(document.getElementById('modal-present-units').value);
    const month = document.getElementById('modal-month').value;

    if (presentUnits < prevUnits) {
        showToast("Present reading cannot be less than previous reading.", "error");
        return;
    }

    // Recalculate exactly as previewed
    let consumed = presentUnits - prevUnits;
    consumed = parseFloat(consumed.toFixed(1));
    
    const waterBill = calculateBill(consumed).total;
    const maintainCost = 250;
    const fineCost = currentFineAmount; // Uses current selected fine
    const finalTotal = waterBill + maintainCost + fineCost;

    // Save Bill
    const newBill = {
        id: 'b' + Date.now(),
        customerId,
        month,
        presentUnits,
        prevUnits,
        consumed,
        total: finalTotal
    };

    state.bills.push(newBill);
    showToast("Bill saved successfully!", "success");
    closeModal();
    renderCustomerTable();
}

// --- 6. CUSTOMER DASHBOARD ---

function initCustomerDashboard() {
    document.getElementById('customer-view').classList.remove('hidden');
    const user = state.currentUser;
    document.getElementById('customer-name-display').textContent = user.name;
    document.getElementById('c-id').textContent = user.id;
    document.getElementById('c-email').textContent = user.email;
    renderCustomerHistory(user.id);
}

function renderCustomerHistory(customerId) {
    let bills = state.bills.filter(b => b.customerId === customerId);
    bills.sort((a, b) => b.month.localeCompare(a.month));

    const tbody = document.getElementById('bill-history-body');
    tbody.innerHTML = '';

    if (bills.length === 0) {
        document.getElementById('no-bills-msg').classList.remove('hidden');
        document.getElementById('current-bill-amount').textContent = "Rs 0.00";
        document.getElementById('current-units-consumed').textContent = "0";
        return;
    }

    document.getElementById('no-bills-msg').classList.add('hidden');

    const currentBill = bills[0];
    document.getElementById('current-bill-amount').textContent = `Rs ${currentBill.total.toFixed(2)}`;
    document.getElementById('current-units-consumed').textContent = currentBill.consumed;

    bills.forEach((bill, index) => {
        const tr = document.createElement('tr');
        if(index === 0) tr.className = "bg-blue-50/50";
        
        const dateObj = new Date(bill.month + "-01");
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        tr.innerHTML = `
            <td class="p-4 font-medium text-gray-800">${monthName}</td>
            <td class="p-4 text-gray-600">${bill.prevUnits}</td>
            <td class="p-4 text-gray-600">${bill.presentUnits}</td>
            <td class="p-4"><span class="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-bold">${bill.consumed}</span></td>
            <td class="p-4 text-right font-bold text-blue-600">Rs ${bill.total.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- UTILS ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let bgClass, icon;
    if (type === 'success') { bgClass = 'bg-green-500'; icon = '<i class="fa-solid fa-check-circle"></i>'; }
    else if (type === 'error') { bgClass = 'bg-red-500'; icon = '<i class="fa-solid fa-circle-exclamation"></i>'; }
    else { bgClass = 'bg-gray-800'; icon = '<i class="fa-solid fa-info-circle"></i>'; }

    toast.className = `${bgClass} text-white ${type}`;
    toast.innerHTML = `${icon} <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-in reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}