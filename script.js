
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAgiS8AwDIV8quJ5xK1RhynNvdXp5GTyEw",
    authDomain: "hydrobill-mobile.firebaseapp.com",
    projectId: "hydrobill-mobile",
    storageBucket: "hydrobill-mobile.firebasestorage.app",
    messagingSenderId: "518368679428",
    appId: "1:518368679428:web:8e7af73daaf04f77130751"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- GLOBAL STATE ---
let currentUser = null;
let currentRole = '';
let currentBillCustomerId = null;
let currentFineAmount = 0;

// --- UI UTILITIES ---

function toggleLoader(show) {
    const loader = document.getElementById('loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check text-green-500 text-xl"></i>' : '<i class="fa-solid fa-circle-exclamation text-red-500 text-xl"></i>';
    
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            ${icon}
            <div>
                <h4 class="font-bold text-slate-800 text-sm">${type === 'success' ? 'Success' : 'Error'}</h4>
                <p class="text-slate-500 text-xs">${message}</p>
            </div>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-300 hover:text-slate-500"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- NAVIGATION & VIEW MANAGEMENT ---

function hideAllViews() {
    ['auth-section', 'admin-dashboard', 'customer-dashboard'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    ['view-role-select', 'view-login', 'view-register'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

function showAuth() {
    hideAllViews();
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('view-role-select').classList.remove('hidden');
}

window.resetToStart = () => {
    currentRole = '';
    showAuth();
};

window.selectRole = (role) => {
    currentRole = role;
    hideAllViews();
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('view-login').classList.remove('hidden');
    
    // Update text based on role
    document.getElementById('login-title').textContent = role === 'admin' ? 'Admin Login' : 'Customer Login';
    document.getElementById('login-subtitle').textContent = role === 'admin' ? 'Manage system access' : 'View your water bills';
    document.getElementById('register-subtitle').textContent = role === 'admin' ? 'Create admin account' : 'Create customer account';
};

window.toggleAuthMode = (mode) => {
    if (mode === 'register') {
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-register').classList.remove('hidden');
    } else {
        document.getElementById('view-register').classList.add('hidden');
        document.getElementById('view-login').classList.remove('hidden');
    }
};

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
                if (userData.role === 'admin') {
                    initAdminDashboard();
                } else {
                    initCustomerDashboard(userData);
                }
            } else {
                toggleLoader(false);
                showToast("User record not found in database", "error");
                signOut(auth);
            }
        } catch (error) {
            toggleLoader(false);
            console.error(error);
            showToast("Data fetch error", "error");
        }
    } else {
        // User is logged out
        toggleLoader(false);
        if (!document.getElementById('auth-section').classList.contains('hidden')) {
            // Already in auth section, do nothing
        } else {
            // If dashboards are visible, go to auth
            showAuth();
        }
    }
});

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    toggleLoader(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Listener handles redirect
    } catch (error) {
        toggleLoader(false);
        showToast("Login Failed: " + error.message, "error");
    }
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

        await setDoc(doc(db, "users", uid), {
            uid: uid,
            name: name,
            email: email,
            role: currentRole,
            createdAt: new Date()
        });

        // Force logout to ensure clean session
        await signOut(auth);
        toggleLoader(false);

        showToast("Account created! Please log in.");
        
        // Reset form and show Login screen automatically
        document.getElementById('view-register').classList.add('hidden');
        document.getElementById('view-login').classList.remove('hidden');
        e.target.reset();

    } catch (error) {
        toggleLoader(false);
        showToast("Registration Error: " + error.message, "error");
    }
};

window.logout = async () => {
    try {
        await signOut(auth);
        window.location.reload(); // Clean reload
    } catch (error) {
        console.error(error);
    }
};

// --- ADMIN FUNCTIONS ---

function initAdminDashboard() {
    document.getElementById('admin-dashboard').classList.remove('hidden');
    renderCustomerTable();
}

window.renderCustomerTable = async () => {
    const tbody = document.getElementById('customer-table-body');
    const search = document.getElementById('admin-search').value.toLowerCase();
    const noData = document.getElementById('no-customers-msg');
    tbody.innerHTML = '';

    try {
        const q = query(collection(db, "users"), where("role", "==", "customer"));
        const querySnapshot = await getDocs(q);
        
        document.getElementById('total-customers-count').textContent = querySnapshot.size;
        
        let count = 0;
        querySnapshot.forEach((docSnap) => {
            const c = docSnap.data();
            if (c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search)) {
                count++;
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition";
                const safeName = c.name.replace(/'/g, "\\'");
                tr.innerHTML = `
                    <td class="p-5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                ${c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="font-bold text-slate-800">${c.name}</div>
                                <div class="text-xs text-slate-500">${c.email}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-5 hidden sm:table-cell">
                        <span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Active</span>
                    </td>
                    <td class="p-5 text-right">
                        <button onclick="window.openBillingModal('${c.uid}', '${safeName}')" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition">
                            <i class="fa-solid fa-file-invoice mr-1"></i> Bill
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });

        if (count === 0) noData.classList.remove('hidden');
        else noData.classList.add('hidden');

    } catch (error) {
        console.error(error);
        showToast("Failed to load customers", "error");
    }
};

window.openAddCustomerModal = () => {
    document.getElementById('customer-modal').classList.remove('hidden');
    document.getElementById('customer-modal').classList.add('flex');
};

window.closeAddCustomerModal = () => {
    document.getElementById('customer-modal').classList.add('hidden');
    document.getElementById('customer-modal').classList.remove('flex');
    document.getElementById('new-name').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-pass').value = '';
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
        
        await setDoc(doc(db, "users", uid), {
            uid: uid,
            name: name,
            email: email,
            role: 'customer',
            createdAt: new Date()
        });
        
        // Logout the admin from the newly created user session immediately
        await signOut(auth);
        // Re-login admin? No, simple approach: Just close modal and refresh table
        // Since we created user, we are logged in as that user now. We need to force login admin back.
        // For simplicity in this snippet, we alert success and reload page to force login.
        
        toggleLoader(false);
        closeAddCustomerModal();
        showToast("Customer Added. System reloading to secure session...");
        setTimeout(() => window.location.reload(), 2000);
        
    } catch (error) {
        toggleLoader(false);
        showToast(error.message, "error");
    }
};

// --- BILLING LOGIC ---

function calculateBill(units) {
    if (units <= 0) return 0;
    const intUnits = Math.floor(units);
    const decUnits = parseFloat((units - intUnits).toFixed(2));
    let total = 0;
    
    // First 10 units: 65
    total += Math.min(intUnits, 10) * 65;
    
    // Above 10 units: 70
    if (intUnits > 10) total += (intUnits - 10) * 70;
    
    // Decimals: 60
    if (decUnits > 0) total += decUnits * 60;
    
    return parseFloat(total.toFixed(2));
}

window.openBillingModal = async (customerId, customerName) => {
    currentBillCustomerId = customerId;
    document.getElementById('modal-customer-id').value = customerId;
    document.getElementById('modal-customer-name').textContent = customerName;
    
    // Fetch last reading
    const q = query(collection(db, "bills"), where("customerId", "==", customerId));
    const querySnapshot = await getDocs(q);
    let lastUnits = 0;
    let bills = [];
    
    querySnapshot.forEach(d => bills.push(d.data()));
    // Sort by month descending
    bills.sort((a, b) => b.month.localeCompare(a.month));
    
    if (bills.length > 0) {
        lastUnits = bills[0].presentUnits;
    }

    document.getElementById('modal-prev-units').value = lastUnits;
    document.getElementById('modal-month').value = new Date().toISOString().slice(0, 7);
    document.getElementById('modal-present-units').value = '';
    
    // Set Fine
    currentFineAmount = 0;
    
    document.getElementById('billing-modal').classList.remove('hidden');
    document.getElementById('billing-modal').classList.add('flex');
    
    window.previewCalculation();
};

window.closeBillingModal = () => {
    document.getElementById('billing-modal').classList.add('hidden');
    document.getElementById('billing-modal').classList.remove('flex');
    document.getElementById('billing-form').reset();
};

window.setFine = (amount) => {
    currentFineAmount = amount;
    window.previewCalculation();
};

window.previewCalculation = () => {
    const prev = parseFloat(document.getElementById('modal-prev-units').value) || 0;
    const pres = parseFloat(document.getElementById('modal-present-units').value) || 0;
    const breakdown = document.getElementById('calc-breakdown');
    const fineContainer = document.getElementById('fine-buttons');

    if (pres < prev) {
        breakdown.innerHTML = `<div class="text-red-500 font-bold text-center">New reading cannot be less than previous!</div>`;
        document.getElementById('preview-total').textContent = "---";
        return;
    }

    const consumed = parseFloat((pres - prev).toFixed(2));
    const waterCost = calculateBill(consumed);
    const maintain = 250;
    const total = waterCost + maintain + currentFineAmount;

    breakdown.innerHTML = `
        <div class="flex justify-between text-slate-600"><span>Consumed Units:</span> <span class="font-bold">${consumed}</span></div>
        <div class="flex justify-between text-slate-600"><span>Water Charge:</span> <span>Rs ${waterCost.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-600"><span>Maintenance:</span> <span>Rs ${maintain}.00</span></div>
        <div class="flex justify-between text-red-500 font-bold border-t border-slate-200 pt-2 mt-1"><span>Fine:</span> <span>Rs ${currentFineAmount.toFixed(2)}</span></div>
    `;

    // Generate Fine Buttons
    fineContainer.innerHTML = '';
    [0, 50, 200, 500].forEach(f => {
        const btn = document.createElement('button');
        const isActive = currentFineAmount === f;
        btn.className = `flex-1 py-2 text-xs font-bold rounded-lg border transition ${isActive ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`;
        btn.textContent = `Rs ${f}`;
        btn.onclick = () => window.setFine(f);
        fineContainer.appendChild(btn);
    });

    document.getElementById('preview-total').textContent = "Rs " + total.toFixed(2);
};

window.handleBillingSubmit = async (e) => {
    e.preventDefault();
    const prev = parseFloat(document.getElementById('modal-prev-units').value);
    const pres = parseFloat(document.getElementById('modal-present-units').value);
    
    if (pres < prev) {
        showToast("Invalid reading", "error");
        return;
    }

    toggleLoader(true);
    const consumed = parseFloat((pres - prev).toFixed(2));
    const waterCost = calculateBill(consumed);
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
            fineAmount: currentFineAmount,
            total: total,
            createdAt: new Date()
        });
        
        toggleLoader(false);
        showToast("Bill generated successfully!");
        closeBillingModal();
        // Refresh table if needed (though not strictly required for admin view)
    } catch (error) {
        toggleLoader(false);
        showToast("Error saving bill: " + error.message, "error");
    }
};

// --- CUSTOMER FUNCTIONS ---

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
    
    // Sort by month desc
    bills.sort((a, b) => b.month.localeCompare(a.month));

    if (bills.length > 0) {
        document.getElementById('current-bill-amount').textContent = "Rs " + bills[0].total.toFixed(2);
        
        bills.forEach(bill => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition";
            tr.innerHTML = `
                <td class="p-4 font-medium text-slate-800">${bill.month}</td>
                <td class="p-4 text-slate-600">${bill.consumed} Units</td>
                <td class="p-4 text-center">
                    ${bill.fineAmount > 0 ? `<span class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">Rs ${bill.fineAmount}</span>` : '<span class="text-slate-300">-</span>'}
                </td>
                <td class="p-4 text-right font-bold text-slate-800">Rs ${bill.total.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
        noData.classList.add('hidden');
    } else {
        document.getElementById('current-bill-amount').textContent = "Rs 0.00";
        noData.classList.remove('hidden');
    }
}