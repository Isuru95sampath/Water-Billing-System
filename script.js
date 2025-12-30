import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, setDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAgiS8AwDIV8quJ5xK1RhynNvdXp5GTyEw",
    authDomain: "hydrobill-mobile.firebaseapp.com",
    projectId: "hydrobill-mobile",
    storageBucket: "hydrobill-mobile.firebasestorage.app",
    messagingSenderId: "518368679428",
    appId: "1:518368679428:web:8e7af73daaf04f77130751"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRole = '';
let currentBillCustomerId = null;
let currentFineAmount = 0;

// --- UI NAVIGATION ---

function hideAllViews() {
    const views = ['auth-section', 'admin-dashboard', 'customer-dashboard', 'view-role-select', 'view-login', 'view-register'];
    views.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
}

function showAuth() {
    hideAllViews();
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('view-role-select').classList.remove('hidden');
}

window.resetToStart = () => { window.currentRole = ''; showAuth(); };

window.toggleAuthMode = (mode) => {
    hideAllViews();
    document.getElementById('auth-section').classList.remove('hidden');
    if (mode === 'register') {
        document.getElementById('view-register').classList.remove('hidden');
    } else {
        document.getElementById('view-login').classList.remove('hidden');
    }
};

window.selectRole = (role) => {
    window.currentRole = role;
    window.toggleAuthMode('login');
    document.getElementById('login-title').textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
};

// --- UTILS ---

function toggleLoader(show) {
    const loader = document.getElementById('loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check text-green-500 text-xl"></i>' : '<i class="fa-solid fa-circle-exclamation text-red-500 text-xl"></i>';
    toast.innerHTML = `
        <div class="flex items-center gap-3">${icon}<div><h4 class="font-bold text-slate-800 text-sm">${type === 'success' ? 'Success' : 'Error'}</h4><p class="text-slate-500 text-xs">${message}</p></div></div>
        <button onclick="this.parentElement.remove()" class="text-slate-300 hover:text-slate-500"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// --- AUTH LOGIC ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        toggleLoader(true);
        try {
            const q = query(collection(db, "users"), where("uid", "==", user.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                toggleLoader(false);
                hideAllViews();
                if (userData.role === 'admin') initAdminDashboard();
                else initCustomerDashboard(userData);
            } else {
                toggleLoader(false);
                showToast("User record not found", "error");
                signOut(auth);
            }
        } catch (error) {
            toggleLoader(false);
            showToast("Data fetch error", "error");
        }
    } else {
        toggleLoader(false);
        if (!document.getElementById('auth-section').classList.contains('hidden')) { /* Stay */ } 
        else showAuth();
    }
});

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    toggleLoader(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { toggleLoader(false); showToast("Login Failed: " + error.message, "error"); }
};

window.handleRegister = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    toggleLoader(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db, "users", uid), { uid, name, email, role: window.currentRole, createdAt: new Date() });
        await signOut(auth);
        toggleLoader(false);
        showToast("Account created! Please log in.");
        window.toggleAuthMode('login');
        e.target.reset();
    } catch (error) {
        toggleLoader(false);
        showToast("Registration Error: " + error.message, "error");
    }
};

window.logout = async () => { try { await signOut(auth); window.location.reload(); } catch(e){} };

// --- ADMIN FUNCTIONS ---

function initAdminDashboard() {
    document.getElementById('admin-dashboard').classList.remove('hidden');
    renderCustomerTable();
}

window.renderCustomerTable = async () => {
    const tbody = document.getElementById('customer-table-body');
    const search = document.getElementById('admin-search').value.toLowerCase();
    tbody.innerHTML = '';
    try {
        const q = query(collection(db, "users"), where("role", "==", "customer"));
        const querySnapshot = await getDocs(q);
        document.getElementById('total-customers-count').textContent = querySnapshot.size;
        querySnapshot.forEach((docSnap) => {
            const c = docSnap.data();
            if (c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search)) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition";
                tr.innerHTML = `
                    <td class="p-5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">${c.name.charAt(0).toUpperCase()}</div>
                            <div><div class="font-bold text-slate-800">${c.name}</div><div class="text-xs text-slate-500">${c.email}</div></div>
                        </div>
                    </td>
                    <td class="p-5 hidden sm:table-cell"><span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Active</span></td>
                    <td class="p-5 text-right">
                        <button onclick="window.openCustomerDetails('${c.uid}', '${c.name.replace(/'/g, "\\'")}', '${c.email}')" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition">
                            <i class="fa-solid fa-eye mr-1"></i> Manage
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    } catch (error) { console.error(error); showToast("Failed to load customers", "error"); }
};

window.openAddCustomerModal = () => {
    document.getElementById('customer-modal').classList.remove('hidden');
    document.getElementById('customer-modal').classList.add('flex');
};

window.closeAddCustomerModal = () => {
    document.getElementById('customer-modal').classList.add('hidden');
    document.getElementById('customer-modal').classList.remove('flex');
    ['new-name','new-email','new-pass'].forEach(id=>document.getElementById(id).value='');
};

window.handleAddCustomer = async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const email = document.getElementById('new-email').value;
    const password = document.getElementById('new-pass').value;
    toggleLoader(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db, "users", uid), { uid, name, email, role: 'customer', createdAt: new Date() });
        await signOut(auth);
        toggleLoader(false);
        closeAddCustomerModal();
        showToast("Customer Added. Reloading...");
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        toggleLoader(false);
        showToast(error.message, "error");
    }
};

// --- CUSTOMER DETAILS & BILLING LOGIC ---

let currentManageCustomerId = null;

window.openCustomerDetails = async (uid, name, email) => {
    currentManageCustomerId = uid;
    document.getElementById('detail-customer-name').textContent = name;
    document.getElementById('detail-customer-email').textContent = email;
    
    // Fetch History
    const q = query(collection(db, "bills"), where("customerId", "==", uid));
    const querySnapshot = await getDocs(q);
    let bills = [];
    querySnapshot.forEach(d => bills.push({id: d.id, ...d.data()}));
    bills.sort((a, b) => b.month.localeCompare(a.month));

    // Determine Last Unit
    let lastUnits = 0;
    if (bills.length > 0) lastUnits = bills[0].presentUnits;
    document.getElementById('detail-last-units').textContent = lastUnits;

    // Render History
    const tbody = document.getElementById('detail-history-body');
    const noHist = document.getElementById('detail-no-history');
    tbody.innerHTML = '';
    
    if (bills.length === 0) noHist.classList.remove('hidden');
    else {
        noHist.classList.add('hidden');
        bills.forEach(bill => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50";
            const statusClass = bill.status === 'Paid' ? 'status-paid' : 'status-unpaid';
            const actionBtn = bill.status === 'Unpaid' 
                ? `<button onclick="window.toggleBillStatus('${bill.id}', 'Paid')" class="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold">Mark Paid</button>`
                : `<button onclick="window.toggleBillStatus('${bill.id}', 'Unpaid')" class="text-slate-400 hover:text-slate-600 px-2 py-1 rounded text-xs">Unpay</button>`;

            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${bill.month}</td>
                <td class="p-3">Rs ${bill.total.toFixed(2)}</td>
                <td class="p-3 text-center"><span class="status-badge ${statusClass}">${bill.status}</span></td>
                <td class="p-3 text-right">${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('customer-details-modal').classList.remove('hidden');
    document.getElementById('customer-details-modal').classList.add('flex');
};

window.closeCustomerDetailsModal = () => {
    document.getElementById('customer-details-modal').classList.add('hidden');
    document.getElementById('customer-details-modal').classList.remove('flex');
    currentManageCustomerId = null;
};

window.toggleBillStatus = async (billId, newStatus) => {
    if(!confirm(`Mark bill as ${newStatus}?`)) return;
    try {
        const billRef = doc(db, "bills", billId);
        await updateDoc(billRef, { status: newStatus });
        showToast(`Bill marked as ${newStatus}`);
        // Re-render details
        const name = document.getElementById('detail-customer-name').textContent;
        const email = document.getElementById('detail-customer-email').textContent;
        // Note: We need UID, which is in currentManageCustomerId
        openCustomerDetails(currentManageCustomerId, name, email);
    } catch(e) {
        showToast("Error updating status", "error");
    }
};

window.openBillingModal = async () => {
    currentBillCustomerId = currentManageCustomerId; // Use the ID from details modal
    document.getElementById('modal-prev-units').value = document.getElementById('detail-last-units').textContent;
    document.getElementById('modal-month').value = new Date().toISOString().slice(0, 7);
    document.getElementById('modal-present-units').value = '';
    currentFineAmount = 0;
    document.getElementById('billing-modal').classList.remove('hidden');
    document.getElementById('billing-modal').classList.add('flex');
    window.previewCalculation();
};

window.closeBillingModal = () => {
    document.getElementById('billing-modal').classList.add('hidden');
    document.getElementById('billing-modal').classList.remove('flex');
};

// Updated Logic: Integers (65/70), Decimals (6)
window.previewCalculation = () => {
    const prev = parseFloat(document.getElementById('modal-prev-units').value) || 0;
    const pres = parseFloat(document.getElementById('modal-present-units').value) || 0;
    const breakdown = document.getElementById('calc-breakdown');
    const fineContainer = document.getElementById('fine-buttons');

    if (pres < prev) {
        breakdown.innerHTML = `<div class="text-red-500 font-bold text-center">Invalid Reading!</div>`;
        document.getElementById('preview-total').textContent = "---";
        return;
    }

    const consumed = parseFloat((pres - prev).toFixed(2));
    const intUnits = Math.floor(consumed);
    const decUnits = parseFloat((consumed - intUnits).toFixed(2));
    
    // Calc Integer
    let costInt = 0;
    costInt += Math.min(intUnits, 10) * 65;
    if (intUnits > 10) costInt += (intUnits - 10) * 70;

    // Calc Decimal (Rate = 6)
    const costDec = decUnits * 6;

    const waterCharge = costInt + costDec;
    const maintain = 250;
    const total = waterCharge + maintain + currentFineAmount;

    breakdown.innerHTML = `
        <div class="flex justify-between text-slate-600"><span>Consumed Units:</span> <span class="font-bold">${consumed}</span></div>
        <div class="flex justify-between text-slate-600 text-xs"><span>Integer Units (${intUnits}):</span> <span>Rs ${costInt.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-600 text-xs"><span>Decimal Units (${decUnits}):</span> <span>Rs ${costDec.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-600"><span>Water Charge:</span> <span>Rs ${waterCharge.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-600"><span>Maintenance:</span> <span>Rs ${maintain}.00</span></div>
        <div class="flex justify-between text-red-500 font-bold border-t border-slate-200 pt-2 mt-1"><span>Fine:</span> <span>Rs ${currentFineAmount.toFixed(2)}</span></div>
    `;

    fineContainer.innerHTML = '';
    [0, 50, 200, 500].forEach(f => {
        const btn = document.createElement('button');
        const isActive = currentFineAmount === f;
        btn.className = `flex-1 py-2 text-xs font-bold rounded-lg border transition ${isActive ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`;
        btn.textContent = `Rs ${f}`;
        btn.onclick = () => { currentFineAmount = f; window.previewCalculation(); };
        fineContainer.appendChild(btn);
    });

    document.getElementById('preview-total').textContent = "Rs " + total.toFixed(2);
};

window.handleBillingSubmit = async (e) => {
    e.preventDefault();
    const prev = parseFloat(document.getElementById('modal-prev-units').value);
    const pres = parseFloat(document.getElementById('modal-present-units').value);
    if (pres < prev) { showToast("Invalid reading", "error"); return; }

    toggleLoader(true);
    const consumed = parseFloat((pres - prev).toFixed(2));
    const intUnits = Math.floor(consumed);
    const decUnits = parseFloat((consumed - intUnits).toFixed(2));
    let costInt = Math.min(intUnits, 10) * 65;
    if (intUnits > 10) costInt += (intUnits - 10) * 70;
    const costDec = decUnits * 6;
    const waterCost = costInt + costDec;
    const month = document.getElementById('modal-month').value;
    const total = waterCost + 250 + currentFineAmount;

    try {
        await addDoc(collection(db, "bills"), {
            customerId: currentBillCustomerId,
            month: month,
            prevUnits: prev,
            presentUnits: pres,
            consumed: consumed,
            waterCost: waterCost,
            maintenance: 250,
            fineAmount: currentFineAmount,
            total: total,
            status: 'Unpaid', // Default status
            createdAt: new Date()
        });
        toggleLoader(false);
        showToast("Bill generated successfully!");
        closeBillingModal();
        // Refresh Details View
        const name = document.getElementById('detail-customer-name').textContent;
        const email = document.getElementById('detail-customer-email').textContent;
        openCustomerDetails(currentBillCustomerId, name, email);
    } catch (error) {
        toggleLoader(false);
        showToast("Error saving bill: " + error.message, "error");
    }
};

// --- CUSTOMER DASHBOARD ---

function initCustomerDashboard(userData) {
    document.getElementById('customer-dashboard').classList.remove('hidden');
    document.getElementById('customer-name-display').textContent = userData.name;
    document.getElementById('c-name-display').textContent = userData.name;
    document.getElementById('c-email-display').textContent = userData.email;
    loadCustomerBills();
}

async function loadCustomerBills() {
    const q = query(collection(db, "bills"), where("customerId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    const tbody = document.getElementById('bill-history-body');
    const noData = document.getElementById('no-bills-msg');
    tbody.innerHTML = '';
    
    let bills = [];
    querySnapshot.forEach(doc => bills.push(doc.data()));
    bills.sort((a, b) => b.month.localeCompare(a.month));

    if (bills.length > 0) {
        document.getElementById('current-bill-amount').textContent = "Rs " + bills[0].total.toFixed(2);
        
        bills.forEach(bill => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition";
            const statusClass = bill.status === 'Paid' ? 'status-paid' : 'status-unpaid';
            tr.innerHTML = `
                <td class="p-4 font-medium text-slate-800">${bill.month}</td>
                <td class="p-4 text-slate-600">${bill.consumed} Units</td>
                <td class="p-4 text-right font-bold text-slate-800">Rs ${bill.total.toFixed(2)}</td>
                <td class="p-4 text-center"><span class="status-badge ${statusClass}">${bill.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
        noData.classList.add('hidden');
    } else {
        document.getElementById('current-bill-amount').textContent = "Rs 0.00";
        noData.classList.remove('hidden');
    }
}