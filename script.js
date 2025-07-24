// Firebase同期関連
let db = null;
let isFirebaseConnected = false;
let syncListeners = {};
let lastSyncTime = null;
let isSyncing = false;

// Firebase初期化
function initializeFirebase() {
    try {
        // Firebase設定
        const firebaseConfig = {
            apiKey: "AIzaSyDMoR5QCOwzNKOhM_zCSzY5nQWP5gMTNAE",
            authDomain: "aircraft-dealer-v2.firebaseapp.com",
            projectId: "aircraft-dealer-v2",
            storageBucket: "aircraft-dealer-v2.firebasestorage.app",
            messagingSenderId: "160115753362",
            appId: "1:160115753362:web:8f9eb46a680b811a7b414b",
            measurementId: "G-JJJ20PFLR8"
        };
        
        // Firebase初期化
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.firestore();
        console.log('Firebase初期化成功');
        return true;
    } catch (error) {
        console.error('Firebase初期化エラー:', error);
        return false;
    }
}

// Firebase接続テスト
async function testFirebaseConnection() {
    if (!db) {
        if (!initializeFirebase()) {
            showAlert('Firebase設定を先に完了してください', 'warning');
            isFirebaseConnected = false;
            return false;
        }
    }
    
    try {
        // テストドキュメントを作成・削除
        await db.collection('test').doc('connection-test').set({
            timestamp: new Date(),
            test: true
        });
        await db.collection('test').doc('connection-test').delete();
        
        showAlert('Firebase接続テスト成功', 'success');
        isFirebaseConnected = true;
        updateConnectionStatus('接続済み');
        startDataSync();
        return true;
    } catch (error) {
        console.error('Firebase connection test failed:', error);
        showAlert('Firebase接続テスト失敗: ' + error.message, 'danger');
        isFirebaseConnected = false;
        updateConnectionStatus('接続失敗');
        return false;
    }
}

// 接続状態の更新
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
        if (status === '接続済み') {
            statusElement.className = 'badge bg-success ms-2';
        } else if (status === '接続失敗') {
            statusElement.className = 'badge bg-danger ms-2';
        } else {
            statusElement.className = 'badge bg-secondary ms-2';
        }
    }
}

// データ同期開始
function startDataSync() {
    if (!db || !isFirebaseConnected) return;
    
    // 既存のリスナーを停止
    stopDataSync();
    
    // リアルタイムリスナーを設定
    const dataRef = db.collection('aircraft-dealer').doc('data');
    
    syncListeners.data = dataRef.onSnapshot((doc) => {
        if (doc.exists) {
            const sharedData = doc.data();
            mergeSharedData(sharedData);
        }
    }, (error) => {
        console.error('Firebase同期エラー:', error);
        showAlert('Firebase同期エラー: ' + error.message, 'danger');
    });
}

// ローカルデータをFirebaseにアップロード
async function uploadLocalDataToFirebase() {
    if (!db || !isFirebaseConnected) {
        showAlert('Firebaseに接続されていません', 'warning');
        return false;
    }
    
    try {
        // ローカルデータを取得
        const localData = {
            customers: JSON.parse(localStorage.getItem('customers') || '[]'),
            aircraft: JSON.parse(localStorage.getItem('aircraft') || '[]'),
            sales: JSON.parse(localStorage.getItem('sales') || '[]'),
            cashbox: JSON.parse(localStorage.getItem('cashbox') || '[]'),
            salespeople: JSON.parse(localStorage.getItem('salespeople') || '[]'),
            inventory: JSON.parse(localStorage.getItem('inventory') || '[]'),
            salaryRecords: JSON.parse(localStorage.getItem('salaryRecords') || '[]'),
            lastModified: Date.now()
        };
        
        // Firebaseにアップロード
        await db.collection('aircraft-dealer').doc('data').set(localData);
        
        showAlert('ローカルデータをFirebaseにアップロードしました', 'success');
        return true;
    } catch (error) {
        console.error('データアップロードエラー:', error);
        showAlert('データアップロードエラー: ' + error.message, 'danger');
        return false;
    }
}

// Firebaseデータをローカルにダウンロード
async function downloadFirebaseDataToLocal() {
    if (!db || !isFirebaseConnected) {
        showAlert('Firebaseに接続されていません', 'warning');
        return false;
    }
    
    try {
        const doc = await db.collection('aircraft-dealer').doc('data').get();
        
        if (doc.exists) {
            const firebaseData = doc.data();
            
            // ローカルストレージに保存
            localStorage.setItem('customers', JSON.stringify(firebaseData.customers || []));
            localStorage.setItem('aircraft', JSON.stringify(firebaseData.aircraft || []));
            localStorage.setItem('sales', JSON.stringify(firebaseData.sales || []));
            localStorage.setItem('cashbox', JSON.stringify(firebaseData.cashbox || []));
            localStorage.setItem('salespeople', JSON.stringify(firebaseData.salespeople || []));
            localStorage.setItem('inventory', JSON.stringify(firebaseData.inventory || []));
            localStorage.setItem('salaryRecords', JSON.stringify(firebaseData.salaryRecords || []));
            
            // グローバル変数を更新
            customers = JSON.parse(localStorage.getItem('customers') || '[]');
            aircraft = JSON.parse(localStorage.getItem('aircraft') || '[]');
            sales = JSON.parse(localStorage.getItem('sales') || '[]');
            cashbox = JSON.parse(localStorage.getItem('cashbox') || '[]');
            salespeople = JSON.parse(localStorage.getItem('salespeople') || '[]');
            inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
            salaryRecords = JSON.parse(localStorage.getItem('salaryRecords') || '[]');
            
            // 表示を更新
            updateAllDisplays();
            
            showAlert('Firebaseデータをローカルにダウンロードしました', 'success');
            return true;
        } else {
            showAlert('Firebaseにデータがありません', 'info');
            return false;
        }
    } catch (error) {
        console.error('データダウンロードエラー:', error);
        showAlert('データダウンロードエラー: ' + error.message, 'danger');
        return false;
    }
}

// データリセット機能
function resetAllData() {
    if (confirm('本当にすべてのデータをリセットしますか？この操作は取り消せません。')) {
        // ローカルストレージをクリア
        localStorage.removeItem('customers');
        localStorage.removeItem('aircraft');
        localStorage.removeItem('sales');
        localStorage.removeItem('cashbox');
        localStorage.removeItem('salespeople');
        localStorage.removeItem('inventory');
        localStorage.removeItem('salaryRecords');
        
        // グローバル変数をリセット
        customers = [];
        aircraft = [];
        sales = [];
        cashbox = [];
        salespeople = [];
        inventory = [];
        salaryRecords = [];
        
        // 表示を更新
        updateAllDisplays();
        
        showAlert('すべてのデータをリセットしました', 'success');
    }
}

// Firebaseデータリセット
async function resetFirebaseData() {
    if (!db || !isFirebaseConnected) {
        showAlert('Firebaseに接続されていません', 'warning');
        return false;
    }
    
    if (confirm('Firebaseのすべてのデータをリセットしますか？この操作は取り消せません。')) {
        try {
            await db.collection('aircraft-dealer').doc('data').delete();
            showAlert('Firebaseデータをリセットしました', 'success');
            return true;
        } catch (error) {
            console.error('Firebaseデータリセットエラー:', error);
            showAlert('Firebaseデータリセットエラー: ' + error.message, 'danger');
            return false;
        }
    }
    return false;
}

// データ同期停止
function stopDataSync() {
    Object.values(syncListeners).forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    syncListeners = {};
    console.log('Firebase同期停止');
}

// 共有データのマージ
function mergeSharedData(sharedData) {
    if (isSyncing) return;
    
    isSyncing = true;
    
    try {
        // 各データ配列をマージ
        if (sharedData.customers) {
            customers = mergeArrayData(customers, sharedData.customers);
        }
        if (sharedData.aircraft) {
            aircraft = mergeArrayData(aircraft, sharedData.aircraft);
        }
        if (sharedData.sales) {
            sales = mergeArrayData(sales, sharedData.sales);
        }
        if (sharedData.salespeople) {
            salespeople = mergeArrayData(salespeople, sharedData.salespeople);
        }
        if (sharedData.inventory) {
            inventory = mergeArrayData(inventory, sharedData.inventory);
        }
        if (sharedData.cashbox) {
            cashbox = sharedData.cashbox;
        }
        if (sharedData.salaryRecords) {
            salaryRecords = mergeArrayData(salaryRecords, sharedData.salaryRecords);
        }
        
        // ローカルストレージに保存
        saveData();
        
        // 表示を更新
        updateAllDisplays();
        
        lastSyncTime = new Date();
        console.log('データ同期完了:', lastSyncTime);
        
    } catch (error) {
        console.error('データマージエラー:', error);
    } finally {
        isSyncing = false;
    }
}

// 配列データのマージ
function mergeArrayData(localData, sharedData) {
    const merged = [...localData];
    
    sharedData.forEach(sharedItem => {
        const existingIndex = merged.findIndex(item => item.id === sharedItem.id);
        
        if (existingIndex === -1) {
            // 新しいアイテムを追加
            merged.push(sharedItem);
        } else {
            // 既存アイテムを更新（タイムスタンプが新しい場合）
            const localItem = merged[existingIndex];
            if (sharedItem.lastModified > localItem.lastModified) {
                merged[existingIndex] = sharedItem;
            }
        }
    });
    
    return merged;
}

// データをFirebaseにアップロード
async function uploadCurrentData() {
    if (!db || !isFirebaseConnected) return;
    
    try {
        const dataToUpload = {
            customers: customers.map(item => ({...item, lastModified: Date.now()})),
            aircraft: aircraft.map(item => ({...item, lastModified: Date.now()})),
            sales: sales.map(item => ({...item, lastModified: Date.now()})),
            salespeople: salespeople.map(item => ({...item, lastModified: Date.now()})),
            inventory: inventory.map(item => ({...item, lastModified: Date.now()})),
            cashbox: {...cashbox, lastModified: Date.now()},
            salaryRecords: salaryRecords.map(item => ({...item, lastModified: Date.now()})),
            lastSync: new Date()
        };
        
        await db.collection('aircraft-dealer').doc('data').set(dataToUpload);
        console.log('データアップロード完了');
        
    } catch (error) {
        console.error('データアップロードエラー:', error);
        showAlert('データアップロードエラー: ' + error.message, 'danger');
    }
}

// データ保存時にFirebaseにもアップロード
function saveData() {
    localStorage.setItem('luxury-aircraft-customers', JSON.stringify(customers));
    localStorage.setItem('luxury-aircraft-aircraft', JSON.stringify(aircraft));
    localStorage.setItem('luxury-aircraft-sales', JSON.stringify(sales));
    localStorage.setItem('luxury-aircraft-salespeople', JSON.stringify(salespeople));
    localStorage.setItem('luxury-aircraft-inventory', JSON.stringify(inventory));
    localStorage.setItem('luxury-aircraft-cashbox', JSON.stringify(cashbox));
    localStorage.setItem('luxury-aircraft-salary-records', JSON.stringify(salaryRecords));
    
    // Firebaseにアップロード
    if (isFirebaseConnected) {
        uploadCurrentData();
    }
}

// データ読み込み時にFirebaseからも取得
async function loadData() {
    const savedCustomers = localStorage.getItem('luxury-aircraft-customers');
    const savedAircraft = localStorage.getItem('luxury-aircraft-aircraft');
    const savedSales = localStorage.getItem('luxury-aircraft-sales');
    const savedSalespeople = localStorage.getItem('luxury-aircraft-salespeople');
    const savedInventory = localStorage.getItem('luxury-aircraft-inventory');
    const savedCashbox = localStorage.getItem('luxury-aircraft-cashbox');
    const savedSalaryRecords = localStorage.getItem('luxury-aircraft-salary-records');
    
    if (savedCustomers) {
        customers = JSON.parse(savedCustomers);
    }
    if (savedAircraft) {
        aircraft = JSON.parse(savedAircraft);
    }
    if (savedSales) {
        sales = JSON.parse(savedSales);
    }
    if (savedSalespeople) {
        salespeople = JSON.parse(savedSalespeople);
    }
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
    }
    if (savedCashbox) {
        cashbox = JSON.parse(savedCashbox);
    }
    if (savedSalaryRecords) {
        salaryRecords = JSON.parse(savedSalaryRecords);
    }
    
    // Firebaseからデータを取得
    if (db && isFirebaseConnected) {
        try {
            const doc = await db.collection('aircraft-dealer').doc('data').get();
            if (doc.exists) {
                const sharedData = doc.data();
                mergeSharedData(sharedData);
            }
        } catch (error) {
            console.error('Firebaseデータ読み込みエラー:', error);
        }
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // Firebase初期化
    initializeFirebase();
    
    // データ読み込み
    loadData();
    updateStats();
    renderDashboard();
    populateAircraftSelect(); // 航空機選択肢を動的に生成
    updateCustomerSelect(); // 顧客選択肢を動的に生成
    
    // 顧客一覧の航空機フィルター選択肢を生成
    populateAircraftFilterSelect();
    
    // 在庫管理関連の初期化
    populateInventoryAircraftSelect(); // 在庫管理用の航空機選択肢を生成
    updateInventoryStats(); // 在庫統計を更新
    
    // 現在の日時を販売日のデフォルト値に設定（日本標準時）
    const now = new Date();
    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    document.getElementById('sale-date').value = japanTime.toISOString().slice(0, 16);
    
    // 雇用日のデフォルト値を今日に設定
    document.getElementById('employment-date').value = getJapanDateString();
    
    // 在庫日のデフォルト値を現在の日時に設定（日本標準時）
    const inventoryNow = new Date();
    const inventoryJapanTime = new Date(inventoryNow.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    document.getElementById('inventory-date').value = inventoryJapanTime.toISOString().slice(0, 16);
    
    // フォームイベントの設定
    document.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    document.getElementById('aircraft-name').addEventListener('change', handleAircraftChange);
    document.getElementById('home-link').addEventListener('click', () => showSectionAndCloseNav('dashboard'));
    
    // 金庫関連フォーム
    const depositForm = document.getElementById('deposit-form');
    const withdrawalForm = document.getElementById('withdrawal-form');
    const adjustmentForm = document.getElementById('adjustment-form');
    
    if (depositForm) {
        depositForm.addEventListener('submit', handleDepositSubmit);
    }
    
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawalSubmit);
    }
    
    if (adjustmentForm) {
        adjustmentForm.addEventListener('submit', handleAdjustmentSubmit);
    }
    
    // 雇用関連フォーム
    const employmentForm = document.getElementById('employment-form');
    
    if (employmentForm) {
        employmentForm.addEventListener('submit', handleEmploymentSubmit);
    }
    
    // 在庫管理フォーム
    const inventoryForm = document.getElementById('inventory-form');
    
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', handleInventorySubmit);
    }
    
    // 在庫の航空機選択変更
    const inventoryAircraftSelect = document.getElementById('inventory-aircraft-name');
    if (inventoryAircraftSelect) {
        inventoryAircraftSelect.addEventListener('change', handleInventoryAircraftChange);
    }
    
    // 無償在庫チェックボックス
    const freeStockCheckbox = document.getElementById('inventory-free-stock');
    if (freeStockCheckbox) {
        freeStockCheckbox.addEventListener('change', handleFreeStockChange);
    }
    
    // 編集フォーム関連
    const editAircraftSelect = document.getElementById('edit-aircraft-name');
    if (editAircraftSelect) {
        editAircraftSelect.addEventListener('change', handleEditAircraftChange);
    }
    
    // データ整合性チェック
    checkAndFixDataIntegrity();
    
    // 既存データの販売員情報チェック
    checkAndMigrateSalespersonData();
    
    // 給与統計の初期化
    updateSalaryStats();
    renderSalaryDetails();
    
    // デモ用：テスト給与記録の追加（開発時のみ）
    // addSalaryRecord(1, 50000, 'テスト販売給与', '2024-01-15T10:00:00.000Z');
    
    // 初期表示はダッシュボード
    showSection('dashboard');
    
    // Firebase接続テスト
    setTimeout(() => {
        testFirebaseConnection();
    }, 1000);
});

// グローバル変数
let customers = [];
let aircraft = [];
let sales = [];
let salespeople = [];
let inventory = [];
let cashbox = {
    balance: 0,
    history: []
};

// 給与管理用データ
let salaryRecords = [];

// 並び替え状態を保持
let dashboardSortOrder = 'name-asc';
let customersSortOrder = 'name-asc';

// 顧客フィルター状態を保持
let currentAircraftFilter = '';
let currentOwnershipFilter = 'all';

// 顧客データの並び替え関数
function sortCustomers(customersArray, sortOrder) {
    const sortedCustomers = [...customersArray];
    
    switch(sortOrder) {
        case 'name-asc':
            return sortedCustomers.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        case 'name-desc':
            return sortedCustomers.sort((a, b) => b.name.localeCompare(a.name, 'ja'));
        case 'amount-asc':
            return sortedCustomers.sort((a, b) => {
                const aAmount = getCustomerTotalAmount(a.id);
                const bAmount = getCustomerTotalAmount(b.id);
                return aAmount - bAmount;
            });
        case 'amount-desc':
            return sortedCustomers.sort((a, b) => {
                const aAmount = getCustomerTotalAmount(a.id);
                const bAmount = getCustomerTotalAmount(b.id);
                return bAmount - aAmount;
            });
        case 'aircraft-asc':
            return sortedCustomers.sort((a, b) => {
                const aCount = getCustomerAircraftCount(a.id);
                const bCount = getCustomerAircraftCount(b.id);
                return aCount - bCount;
            });
        case 'aircraft-desc':
            return sortedCustomers.sort((a, b) => {
                const aCount = getCustomerAircraftCount(a.id);
                const bCount = getCustomerAircraftCount(b.id);
                return bCount - aCount;
            });
        case 'purchase-asc':
            return sortedCustomers.sort((a, b) => {
                const aLatest = getCustomerLatestPurchaseDate(a.id);
                const bLatest = getCustomerLatestPurchaseDate(b.id);
                if (!aLatest && !bLatest) return 0;
                if (!aLatest) return 1; // 購入履歴なしは後に
                if (!bLatest) return -1;
                return new Date(aLatest) - new Date(bLatest);
            });
        case 'purchase-desc':
            return sortedCustomers.sort((a, b) => {
                const aLatest = getCustomerLatestPurchaseDate(a.id);
                const bLatest = getCustomerLatestPurchaseDate(b.id);
                if (!aLatest && !bLatest) return 0;
                if (!aLatest) return 1; // 購入履歴なしは後に
                if (!bLatest) return -1;
                return new Date(bLatest) - new Date(aLatest);
            });
        default:
            return sortedCustomers;
    }
}

// 顧客の総購入額を取得
function getCustomerTotalAmount(customerId) {
    const customerAircraft = aircraft.filter(a => a.customerId === customerId);
    return customerAircraft.reduce((sum, a) => sum + a.price, 0);
}

// 顧客の所有機数を取得
function getCustomerAircraftCount(customerId) {
    return aircraft.filter(a => a.customerId === customerId).length;
}

// 顧客の最新購入日を取得
function getCustomerLatestPurchaseDate(customerId) {
    const customerAircraft = aircraft.filter(a => a.customerId === customerId);
    if (customerAircraft.length === 0) return null;
    
    const latestPurchase = customerAircraft.sort((a, b) => 
        new Date(b.purchaseDate) - new Date(a.purchaseDate)
    )[0];
    
    return latestPurchase ? latestPurchase.purchaseDate : null;
}



// ダッシュボードの並び替えハンドラー
function handleDashboardSort() {
    const sortSelect = document.getElementById('dashboard-sort');
    dashboardSortOrder = sortSelect.value;
    renderDashboard();
}

// 顧客一覧の並び替えハンドラー
function handleCustomersSort() {
    const sortSelect = document.getElementById('customers-sort');
    customersSortOrder = sortSelect.value;
    renderCustomersTable();
}

// 航空機データベース
const aircraftDatabase = [
    // ヘリコプター (Vanila)
    { name: "カーゴボブ", price: 54000000, category: "ヘリコプター (Vanila)", english: "Cargobob" },
    { name: "コナダ", price: 35000000, category: "ヘリコプター (Vanila)", english: "Conada" },
    { name: "フロガー", price: 50000000, category: "ヘリコプター (Vanila)", english: "Frogger" },
    { name: "ハボック", price: 20000000, category: "ヘリコプター (Vanila)", english: "Havok" },
    { name: "マーベリック", price: 36000000, category: "ヘリコプター (Vanila)", english: "Maverick" },
    { name: "シースパ", price: 28000000, category: "ヘリコプター (Vanila)", english: "Sea Sparrow" },
    { name: "スパロー", price: 25000000, category: "ヘリコプター (Vanila)", english: "Sparrow" },
    { name: "スーパーヴォリト", price: 40000000, category: "ヘリコプター (Vanila)", english: "Super Volito" },
    { name: "スーパーヴォリトカーボン", price: 45000000, category: "ヘリコプター (Vanila)", english: "Super Volito Carbon" },
    { name: "スウィフト", price: 39000000, category: "ヘリコプター (Vanila)", english: "Swift" },
    { name: "ヴォラタス", price: 38000000, category: "ヘリコプター (Vanila)", english: "Volatus" },
    
    // MOD機体
    { name: "Acura 2018 (タコスのわがまま号)", price: 150000000, category: "海外実車", english: "Acura 2018" },
    { name: "Batwing", price: 250000000, category: "MOD", english: "Batwing" },
    { name: "TB2", price: 150000000, category: "MOD", english: "TB2" },
    { name: "Duster", price: 30000000, category: "MOD", english: "Duster" },
    { name: "FH1 Hunter", price: 60000000, category: "MOD", english: "FH1 Hunter" },
    { name: "リトルバード", price: 80000000, category: "MOD", english: "Little Bird" },
    
    // 軍事車両
    { name: "スラスター", price: 200000000, category: "軍事車両", english: "Thruster" },
    
    // 飛行機 (Plane)
    { name: "RO-86 Alkonost", price: 500000000, category: "飛行機", english: "RO-86 Alkonost" },
    { name: "Buckingham Alpha-Z1", price: 100000000, category: "飛行機", english: "Alpha-Z1" },
    { name: "Mammoth Avenger", price: 1000000000, category: "飛行機", english: "Avenger" },
    { name: "Western Company Besra", price: 150000000, category: "飛行機", english: "Besra" },
    { name: "Western Company Cuban 800", price: 100000000, category: "飛行機", english: "Cuban 800" },
    { name: "Mammoth Dodo", price: 100000000, category: "飛行機", english: "Dodo" },
    { name: "Western Company Seabreeze", price: 100000000, category: "飛行機", english: "Seabreeze" },
    { name: "Western Company Duster", price: 100000000, category: "飛行機", english: "Duster" },
    { name: "Buckingham Shamal", price: 300000000, category: "飛行機", english: "Shamal" },
    { name: "Buckingham Luxor", price: 300000000, category: "飛行機", english: "Luxor" },
    { name: "JoBuilt Velum", price: 100000000, category: "飛行機", english: "Velum" },
    { name: "Buckingham Luxor Deluxe", price: 300000000, category: "飛行機", english: "Luxor Deluxe" },
    { name: "JoBuilt Velum 5-seater", price: 100000000, category: "飛行機", english: "Velum 5-seater" },
    { name: "Buckingham Vestra", price: 100000000, category: "飛行機", english: "Vestra" },
    { name: "Jpbuilt Mammatus", price: 100000000, category: "飛行機", english: "Mammatus" },
    { name: "Ultralight", price: 10000000, category: "飛行機", english: "Ultralight" },
    { name: "Buckingham Miljet", price: 500000000, category: "飛行機", english: "Miljet" },
    { name: "Buckingham Nimbus", price: 300000000, category: "飛行機", english: "Nimbus" },
    { name: "Western Company Mallard", price: 100000000, category: "飛行機", english: "Mallard" }
];

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateStats();
    renderDashboard();
    populateAircraftSelect(); // 航空機選択肢を動的に生成
    updateCustomerSelect(); // 顧客選択肢を動的に生成
    updateSalespersonSelect(); // 販売員選択肢を動的に生成
    
    // 顧客一覧の航空機フィルター選択肢を生成
    populateAircraftFilterSelect();
    
    // 在庫管理関連の初期化
    populateInventoryAircraftSelect(); // 在庫管理用の航空機選択肢を生成
    updateInventoryStats(); // 在庫統計を更新
    
    // 現在の日時を販売日のデフォルト値に設定（日本標準時）
    const now = new Date();
    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    document.getElementById('sale-date').value = japanTime.toISOString().slice(0, 16);
    
    // 雇用日のデフォルト値を今日に設定
    document.getElementById('employment-date').value = getJapanDateString();
    
    // 在庫日のデフォルト値を現在の日時に設定（日本標準時）
    const inventoryNow = new Date();
    const inventoryJapanTime = new Date(inventoryNow.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    document.getElementById('inventory-date').value = inventoryJapanTime.toISOString().slice(0, 16);
    
    // フォームイベントの設定
    document.getElementById('sale-form').addEventListener('submit', handleSaleSubmit);
    document.getElementById('aircraft-name').addEventListener('change', handleAircraftChange);
    document.getElementById('home-link').addEventListener('click', () => showSectionAndCloseNav('dashboard'));
    
    // 金庫関連フォーム
    const depositForm = document.getElementById('deposit-form');
    const withdrawalForm = document.getElementById('withdrawal-form');
    const adjustmentForm = document.getElementById('adjustment-form');
    
    if (depositForm) {
        depositForm.addEventListener('submit', handleDepositSubmit);
    }
    
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawalSubmit);
    }
    
    if (adjustmentForm) {
        adjustmentForm.addEventListener('submit', handleAdjustmentSubmit);
    }
    
    // 雇用関連フォーム
    const employmentForm = document.getElementById('employment-form');
    
    if (employmentForm) {
        employmentForm.addEventListener('submit', handleEmploymentSubmit);
    }
    
    // 在庫管理フォーム
    const inventoryForm = document.getElementById('inventory-form');
    
    if (inventoryForm) {
        inventoryForm.addEventListener('submit', handleInventorySubmit);
    }
    
    // 在庫の航空機選択変更
    const inventoryAircraftSelect = document.getElementById('inventory-aircraft-name');
    if (inventoryAircraftSelect) {
        inventoryAircraftSelect.addEventListener('change', handleInventoryAircraftChange);
    }
    
    // 無償在庫チェックボックス
    const freeStockCheckbox = document.getElementById('inventory-free-stock');
    if (freeStockCheckbox) {
        freeStockCheckbox.addEventListener('change', handleFreeStockChange);
    }
    
    // 編集フォーム関連
    const editAircraftSelect = document.getElementById('edit-aircraft-name');
    if (editAircraftSelect) {
        editAircraftSelect.addEventListener('change', handleEditAircraftChange);
    }
    
    // データ整合性チェック
    checkAndFixDataIntegrity();
    
    // 既存データの販売員情報チェック
    checkAndMigrateSalespersonData();
    
    // 給与統計の初期化
    updateSalaryStats();
    renderSalaryDetails();
    
    // デモ用：テスト給与記録の追加（開発時のみ）
    // addSalaryRecord(1, 50000, 'テスト販売給与', '2024-01-15T10:00:00.000Z');
    
    // 初期表示はダッシュボード
    showSection('dashboard');
});

// データの読み込み
function loadData() {
    const savedCustomers = localStorage.getItem('luxury-aircraft-customers');
    const savedAircraft = localStorage.getItem('luxury-aircraft-aircraft');
    const savedSales = localStorage.getItem('luxury-aircraft-sales');
    const savedSalespeople = localStorage.getItem('luxury-aircraft-salespeople');
    const savedInventory = localStorage.getItem('luxury-aircraft-inventory');
    const savedCashbox = localStorage.getItem('luxury-aircraft-cashbox');
    const savedSalaryRecords = localStorage.getItem('luxury-aircraft-salary-records');
    
    if (savedCustomers) {
        customers = JSON.parse(savedCustomers);
    }
    if (savedAircraft) {
        aircraft = JSON.parse(savedAircraft);
    }
    if (savedSales) {
        sales = JSON.parse(savedSales);
    }
    if (savedSalespeople) {
        salespeople = JSON.parse(savedSalespeople);
    }
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
    }
    if (savedCashbox) {
        cashbox = JSON.parse(savedCashbox);
    }
    if (savedSalaryRecords) {
        salaryRecords = JSON.parse(savedSalaryRecords);
    }
}

// データの保存
function saveData() {
    localStorage.setItem('luxury-aircraft-customers', JSON.stringify(customers));
    localStorage.setItem('luxury-aircraft-aircraft', JSON.stringify(aircraft));
    localStorage.setItem('luxury-aircraft-sales', JSON.stringify(sales));
    localStorage.setItem('luxury-aircraft-salespeople', JSON.stringify(salespeople));
    localStorage.setItem('luxury-aircraft-inventory', JSON.stringify(inventory));
    localStorage.setItem('luxury-aircraft-cashbox', JSON.stringify(cashbox));
    localStorage.setItem('luxury-aircraft-salary-records', JSON.stringify(salaryRecords));
}

// 金庫への入金処理（利益・損失の自動記録）
function addToCashbox(amount, description, date = null) {
    const historyEntry = {
        id: Date.now() + Math.random(),
        type: amount >= 0 ? 'deposit' : 'withdrawal',
        amount: Math.abs(amount), // 絶対値で記録
        description: description,
        date: date || getJapanISOString(),
        balanceAfter: cashbox.balance + amount // 実際の増減
    };
    
    cashbox.balance += amount; // 負の値の場合は残高が減る
    cashbox.history.unshift(historyEntry); // 最新順に追加
    
    saveData();
}

// 金庫への手動入金処理
function depositToCashbox(amount, description) {
    const historyEntry = {
        id: Date.now() + Math.random(),
        type: 'deposit',
        amount: amount,
        description: description,
        date: getJapanISOString(),
        balanceAfter: cashbox.balance + amount
    };
    
    cashbox.balance += amount;
    cashbox.history.unshift(historyEntry); // 最新順に追加
    
    saveData();
    updateStats();
    
    return true;
}

// 金庫からの出金処理
function withdrawFromCashbox(amount, description) {
    if (amount > cashbox.balance) {
        showErrorToast('出金額が残高を超えています。');
        return false;
    }
    
    const historyEntry = {
        id: Date.now() + Math.random(),
        type: 'withdrawal',
        amount: amount,
        description: description,
        date: getJapanISOString(),
        balanceAfter: cashbox.balance - amount
    };
    
    cashbox.balance -= amount;
    cashbox.history.unshift(historyEntry); // 最新順に追加
    
    saveData();
    updateStats();
    
    return true;
}

// 金庫から販売利益の取り消し処理
function removeCashboxAmount(amount, description) {
    const historyEntry = {
        id: Date.now() + Math.random(),
        type: amount > 0 ? 'withdrawal' : 'deposit', // 利益取り消しは出金、損失取り消しは入金
        amount: Math.abs(amount),
        description: description,
        date: getJapanISOString(),
        balanceAfter: cashbox.balance - amount // 利益分を差し引く（損失の場合は戻す）
    };
    
    cashbox.balance -= amount; // 利益分を減額、損失分を増額
    cashbox.history.unshift(historyEntry);
    
    saveData();
    updateStats();
}

// 金庫への直接調整（残高修正）
function adjustCashboxBalance(newBalance, description) {
    const difference = newBalance - cashbox.balance;
    
    const historyEntry = {
        id: Date.now() + Math.random(),
        type: difference >= 0 ? 'adjustment_deposit' : 'adjustment_withdrawal',
        amount: Math.abs(difference),
        description: description + ` (残高調整: ${formatPrice(cashbox.balance)} → ${formatPrice(newBalance)})`,
        date: getJapanISOString(),
        balanceAfter: newBalance
    };
    
    cashbox.balance = newBalance;
    cashbox.history.unshift(historyEntry);
    
    saveData();
    updateStats();
    renderCashboxHistory();
}

// 金庫履歴の描画
function renderCashboxHistory() {
    const historyTable = document.getElementById('cashbox-history-table');
    
    if (!historyTable) return;
    
    if (cashbox.history.length === 0) {
        historyTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-data">
                    <i class="fas fa-history"></i>
                    <h6>金庫履歴がありません</h6>
                    <p>取引または手動操作を行うと履歴が表示されます。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    historyTable.innerHTML = cashbox.history.map(entry => {
        let typeIcon, typeText, typeClass;
        
        switch(entry.type) {
            case 'deposit':
                typeIcon = 'fas fa-plus-circle';
                typeText = '入金';
                typeClass = 'text-success';
                break;
            case 'withdrawal':
                typeIcon = 'fas fa-minus-circle';
                typeText = '出金';
                typeClass = 'text-danger';
                break;
            case 'adjustment_deposit':
                typeIcon = 'fas fa-edit';
                typeText = '調整(+)';
                typeClass = 'text-info';
                break;
            case 'adjustment_withdrawal':
                typeIcon = 'fas fa-edit';
                typeText = '調整(-)';
                typeClass = 'text-warning';
                break;
            default:
                typeIcon = 'fas fa-question-circle';
                typeText = '不明';
                typeClass = 'text-muted';
        }
        
        return `
            <tr>
                <td>${formatDate(entry.date)}</td>
                <td>
                    <i class="${typeIcon} ${typeClass}"></i>
                    <span class="${typeClass}">${typeText}</span>
                </td>
                <td class="${typeClass}">${formatPrice(entry.amount)}</td>
                <td>${entry.description}</td>
                <td class="price-tag">${formatPrice(entry.balanceAfter)}</td>
            </tr>
        `;
    }).join('');
}

// 金庫統計の更新
function updateCashboxStats() {
    const depositCount = document.getElementById('deposit-count');
    const withdrawalCount = document.getElementById('withdrawal-count');
    
    if (depositCount && withdrawalCount) {
        const deposits = cashbox.history.filter(entry => 
            entry.type === 'deposit' || entry.type === 'adjustment_deposit'
        ).length;
        
        const withdrawals = cashbox.history.filter(entry => 
            entry.type === 'withdrawal' || entry.type === 'adjustment_withdrawal'
        ).length;
        
        depositCount.textContent = deposits + '回';
        withdrawalCount.textContent = withdrawals + '回';
    }
}

// 手動入金フォームの処理
function handleDepositSubmit(e) {
    e.preventDefault();
    
    const amount = parseInt(document.getElementById('deposit-amount').value);
    const description = document.getElementById('deposit-description').value.trim();
    
    if (!amount || amount <= 0 || !description) {
        showErrorToast('入金額と内容を正しく入力してください。');
        return;
    }
    
    const success = depositToCashbox(amount, description);
    
    if (success) {
        // フォームをクリア
        document.getElementById('deposit-form').reset();
        
        // 成功メッセージ
        showInfoToast(`${formatPrice(amount)}の入金が完了しました。残高: ${formatPrice(cashbox.balance)}`);
        
        // 履歴を更新
        renderCashboxHistory();
    }
}

// 出金フォームの処理
function handleWithdrawalSubmit(e) {
    e.preventDefault();
    
    const amount = parseInt(document.getElementById('withdrawal-amount').value);
    const description = document.getElementById('withdrawal-description').value.trim();
    
    if (!amount || amount <= 0 || !description) {
        showErrorToast('出金額と内容を正しく入力してください。');
        return;
    }
    
    const success = withdrawFromCashbox(amount, description);
    
    if (success) {
        // フォームをクリア
        document.getElementById('withdrawal-form').reset();
        
        // 成功メッセージ
        showInfoToast(`${formatPrice(amount)}の出金が完了しました。残高: ${formatPrice(cashbox.balance)}`);
        
        // 履歴を更新
        renderCashboxHistory();
    }
}

// 残高調整フォームの処理
function handleAdjustmentSubmit(e) {
    e.preventDefault();
    
    const newBalance = parseInt(document.getElementById('adjustment-balance').value);
    const description = document.getElementById('adjustment-description').value.trim();
    
    if (newBalance < 0 || !description) {
        showErrorToast('新しい残高と調整理由を正しく入力してください。');
        return;
    }
    
    const oldBalance = cashbox.balance;
    adjustCashboxBalance(newBalance, description);
    
    // フォームをクリア
    document.getElementById('adjustment-form').reset();
    
    // 成功メッセージ
    showInfoToast(`残高を${formatPrice(oldBalance)}から${formatPrice(newBalance)}に調整しました。`);
}

// セクション表示の切り替え
function showSection(sectionName) {
    // すべてのセクションを非表示
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 指定されたセクションを表示
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // ナビゲーションのアクティブ状態を更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // データを更新
    switch(sectionName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'customers':
            renderCustomersTable();
            break;
        case 'aircraft':
            renderAircraftTable();
            break;
        case 'sales':
            renderSalesTable();
            break;
        case 'salespeople':
            renderSalespeopleTable();
            break;
        case 'salary':
            updateSalaryStats();
            renderSalaryDetails();
            break;
        case 'employment':
            renderEmploymentHistory();
            updateEmploymentStats();
            break;
        case 'cashbox':
            renderCashboxHistory();
            updateCashboxStats();
            break;
        case 'inventory':
            renderInventoryTable();
            updateInventoryStats();
            break;
        case 'add-sale':
            populateAircraftSelect();
            updateCustomerSelect();
            updateSalespersonSelect();
            populateInventoryAircraftSelect();
            break;
        default:
            renderDashboard();
            break;
    }
    
    // 統計を更新
    updateStats();
}

// セクション表示とナビゲーション閉じの組み合わせ
function showSectionAndCloseNav(sectionName) {
    showSection(sectionName);
    
    // モバイルナビゲーションを閉じる
    const navbarCollapse = document.getElementById('navbarNav');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
        const bsCollapse = new bootstrap.Collapse(navbarCollapse);
        bsCollapse.hide();
    }
}

// データ管理モーダルを表示
function showDataManagement() {
    const modal = new bootstrap.Modal(document.getElementById('dataManagementModal'));
    modal.show();
}

// 統計データの更新
function updateStats() {
    const totalCustomers = customers.length;
    const totalAircraft = aircraft.length;
    
    // 新しいデータ構造と旧データ構造の両方に対応
    const totalSales = sales.reduce((sum, sale) => {
        return sum + (sale.totalPrice || sale.price || 0);
    }, 0);
    
    // 利益計算（販売員給与30%を差し引いた実際のディーラー利益）
    const totalProfit = sales.reduce((sum, sale) => {
        if (sale.totalDealerProfit !== undefined) {
            // 新しいデータ構造（販売員給与考慮）
            return sum + sale.totalDealerProfit;
        } else if (sale.totalProfit !== undefined) {
            // 旧データ構造（複数台対応だが販売員給与未考慮）
            const salesCommission = (sale.totalPrice || sale.price) * 0.3;
            return sum + (sale.totalProfit - salesCommission);
        } else {
            // 最旧データ構造（互換性のため）
            const originalPrice = sale.originalPrice || sale.price;
            const costPrice = originalPrice * 0.5;
            const salesPrice = sale.price;
            const salesCommission = salesPrice * 0.3;
            const dealerProfit = salesPrice - costPrice - salesCommission;
            return sum + dealerProfit;
        }
    }, 0);
    
    // 顧客数カウント（ダッシュボードヘッダー用）
    const customerCountElement = document.getElementById('customer-count');
    if (customerCountElement) {
        customerCountElement.textContent = totalCustomers + '名';
    }
    
    // 金庫残高の更新
    const cashboxBalance = document.getElementById('cashbox-balance');
    const cashboxCurrentBalance = document.getElementById('cashbox-current-balance');
    
    if (cashboxBalance) {
        cashboxBalance.textContent = formatPrice(cashbox.balance);
    }
    
    if (cashboxCurrentBalance) {
        cashboxCurrentBalance.textContent = formatPrice(cashbox.balance);
    }
    
    // 金庫の統計を更新
    updateCashboxStats();
}

// ダッシュボードの描画
function renderDashboard() {
    updateStats();
    
    // 並び替えドロップダウンの値を設定
    const dashboardSortSelect = document.getElementById('dashboard-sort');
    if (dashboardSortSelect) {
        dashboardSortSelect.value = dashboardSortOrder;
    }
    
    const customersGrid = document.getElementById('customers-grid');
    if (customers.length === 0) {
        customersGrid.innerHTML = `
            <div class="col-12 empty-data">
                <i class="fas fa-users"></i>
                <h5>顧客データがありません</h5>
                <p>新規販売を登録して顧客データを作成してください。</p>
                <button class="btn btn-primary" onclick="showSection('add-sale')">
                    <i class="fas fa-plus"></i> 販売追加
                </button>
            </div>
        `;
        return;
    }
    
    // 顧客データを並び替え
    const sortedCustomers = sortCustomers(customers, dashboardSortOrder);
    
    customersGrid.innerHTML = sortedCustomers.map(customer => {
        const customerAircraft = aircraft.filter(a => a.customerId === customer.id);
        const totalSpent = customerAircraft.reduce((sum, a) => sum + a.price, 0);
        
        // 機種別にグループ化
        const aircraftByType = {};
        customerAircraft.forEach(a => {
            if (!aircraftByType[a.name]) {
                aircraftByType[a.name] = {
                    count: 0,
                    totalPrice: 0
                };
            }
            aircraftByType[a.name].count++;
            aircraftByType[a.name].totalPrice += a.price;
        });
        
        const aircraftTypes = Object.keys(aircraftByType);
        
        return `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card customer-card">
                    <div class="card-body">
                        <div class="customer-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <h6 class="card-title">${customer.name}</h6>
                        <p class="card-text">
                            <small class="text-muted">
                                登録日: ${formatDate(customer.createdAt)}
                            </small>
                        </p>
                        <div class="mb-2">
                            <span class="badge bg-info">
                                ${customerAircraft.length}機 所有
                            </span>
                            <span class="badge bg-secondary">
                                ${aircraftTypes.length}機種
                            </span>
                        </div>
                        <div class="price-tag">
                            総購入額: ${formatPrice(totalSpent)}
                        </div>
                        <hr>
                        <h6>機種別所有状況:</h6>
                        ${aircraftTypes.length > 0 ? aircraftTypes.slice(0, 3).map(name => `
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <small><i class="fas fa-plane aircraft-icon"></i>${name}</small>
                                <div>
                                    <span class="badge bg-primary">${aircraftByType[name].count}台</span>
                                    <small class="price-tag">${formatPrice(aircraftByType[name].totalPrice)}</small>
                                </div>
                            </div>
                        `).join('') : '<small class="text-muted">航空機なし</small>'}
                        ${aircraftTypes.length > 3 ? `
                            <div class="text-center mt-2">
                                <small class="text-muted">他${aircraftTypes.length - 3}機種...</small>
                            </div>
                        ` : ''}
                        <div class="mt-3">
                            <button class="btn btn-sm btn-outline-primary" onclick="showCustomerDetail(${customer.id})">
                                詳細を見る
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 顧客テーブルの描画
function renderCustomersTable() {
    // 並び替えドロップダウンの値を設定
    const customersSortSelect = document.getElementById('customers-sort');
    if (customersSortSelect) {
        customersSortSelect.value = customersSortOrder;
    }
    
    const customersTable = document.getElementById('customers-table');
    
    if (customers.length === 0) {
        customersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-data">
                    <i class="fas fa-users"></i>
                    <h5>顧客データがありません</h5>
                    <p>新規販売を登録して顧客データを作成してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // 顧客データを並び替え
    const sortedCustomers = sortCustomers(customers, customersSortOrder);
    
    // フィルター条件を適用
    const filteredCustomers = filterCustomers(sortedCustomers);
    
    if (filteredCustomers.length === 0) {
        const filterMessage = currentAircraftFilter 
            ? `「${currentAircraftFilter}」${currentOwnershipFilter === 'owner' ? 'を所有する' : currentOwnershipFilter === 'non-owner' ? 'を所有しない' : 'に関連する'}顧客が見つかりません`
            : '条件に一致する顧客が見つかりません';
            
        customersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-data">
                    <i class="fas fa-search"></i>
                    <h6>${filterMessage}</h6>
                    <p>検索条件を変更してお試しください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    customersTable.innerHTML = filteredCustomers.map(customer => {
        const customerAircraft = aircraft.filter(a => a.customerId === customer.id);
        const totalSpent = customerAircraft.reduce((sum, a) => sum + a.price, 0);
        const latestPurchase = customerAircraft.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))[0];
        
        // 航空機所有状況を判定
        let ownershipStatus = '';
        let rowClass = '';
        if (currentAircraftFilter) {
            const ownsSelectedAircraft = customerOwnsAircraft(customer.id, currentAircraftFilter);
            if (ownsSelectedAircraft) {
                ownershipStatus = `<span class="badge bg-success ms-2"><i class="fas fa-check"></i> 所有</span>`;
                rowClass = 'table-success';
            } else {
                ownershipStatus = `<span class="badge bg-secondary ms-2"><i class="fas fa-times"></i> 非所有</span>`;
                rowClass = 'table-light';
            }
        }
        
        return `
            <tr class="${rowClass}">
                <td>
                    <i class="fas fa-user"></i>
                    ${customer.name}
                    ${ownershipStatus}
                </td>
                <td>
                    <span class="badge bg-info">${customerAircraft.length}機</span>
                    ${currentAircraftFilter && customerOwnsAircraft(customer.id, currentAircraftFilter) 
                        ? `<div class="small text-success mt-1"><i class="fas fa-plane"></i> ${currentAircraftFilter} 所有中</div>` 
                        : ''}
                </td>
                <td class="price-tag">${formatPrice(totalSpent)}</td>
                <td>${latestPurchase ? formatDate(latestPurchase.purchaseDate) : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="showCustomerDetail(${customer.id})">
                        詳細
                    </button>
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteCustomer(${customer.id})">
                        削除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 航空機テーブルの描画
function renderAircraftTable() {
    const aircraftTable = document.getElementById('aircraft-table');
    
    if (aircraft.length === 0) {
        aircraftTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-data">
                    <i class="fas fa-plane"></i>
                    <h5>航空機データがありません</h5>
                    <p>新規販売を登録して航空機データを作成してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    aircraftTable.innerHTML = aircraft.map(item => {
        const customer = customers.find(c => c.id === item.customerId);
        
        return `
            <tr>
                <td>
                    <i class="fas fa-plane aircraft-icon"></i>
                    ${item.name}
                </td>
                <td>
                    <i class="fas fa-user"></i>
                    ${customer ? customer.name : '不明'}
                </td>
                <td class="price-tag">${formatPrice(item.price)}</td>
                <td>${formatDate(item.purchaseDate)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAircraft(${item.id})">
                        削除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 販売履歴テーブルの描画
function renderSalesTable() {
    const salesTable = document.getElementById('sales-table');
    
    if (sales.length === 0) {
        salesTable.innerHTML = `
            <tr>
                <td colspan="9" class="text-center empty-data">
                    <i class="fas fa-chart-line"></i>
                    <h5>販売データがありません</h5>
                    <p>新規販売を登録して販売履歴を作成してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const sortedSales = [...sales].sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
    
    salesTable.innerHTML = sortedSales.map(sale => {
        // 新しいデータ構造と旧データ構造の両方に対応
        const quantity = sale.quantity || 1;
        const totalPrice = sale.totalPrice || sale.price;
        const originalPrice = sale.originalPrice || sale.price;
        const discountRate = sale.discountRate || 0;
        
        // 販売員給与とディーラー利益の計算
        let totalSalesCommission, totalDealerProfit;
        
        if (sale.totalDealerProfit !== undefined) {
            // 新しいデータ構造（販売員給与考慮）
            totalSalesCommission = sale.totalSalesCommission;
            totalDealerProfit = sale.totalDealerProfit;
        } else {
            // 旧データ構造の場合は計算
            const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
            totalSalesCommission = totalPrice * 0.3;
            const totalGrossProfit = totalPrice - totalCostPrice;
            totalDealerProfit = totalGrossProfit - totalSalesCommission;
        }
        
        // 販売員情報の取得
        const salespersonName = sale.salespersonName || '不明';
        
        return `
            <tr>
                <td>${formatDate(sale.saleDate)}</td>
                <td>
                    <i class="fas fa-user"></i>
                    ${sale.customerName}
                </td>
                <td>
                    <i class="fas fa-plane aircraft-icon"></i>
                    ${sale.aircraftName}
                    ${sale.isGift ? ' <span class="badge bg-warning text-dark"><i class="fas fa-gift"></i> プレゼント</span>' : ''}
                </td>
                <td class="text-center">
                    <span class="badge bg-secondary">${quantity}台</span>
                </td>
                <td>
                    <div class="price-tag">${sale.isGift ? '<span class="text-warning">無料</span>' : formatPrice(totalPrice)}</div>
                    ${!sale.isGift && quantity > 1 && discountRate > 0 ? 
                        `<small class="text-muted">1台分${discountRate}%OFF適用</small>` : 
                        !sale.isGift && discountRate > 0 ? `<small class="text-muted">${discountRate}%OFF適用</small>` : ''
                    }
                </td>
                <td>
                    <i class="fas fa-user-tie"></i>
                    ${salespersonName}
                </td>
                <td class="text-warning">${formatPrice(totalSalesCommission)}</td>
                <td class="${totalDealerProfit >= 0 ? 'text-success' : 'text-danger'}">
                    ${sale.isGift ? 
                        `<span class="text-warning">損失: ${formatPrice(Math.abs(totalDealerProfit))}</span>` : 
                        formatPrice(totalDealerProfit)
                    }
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editSale(${sale.id})">
                        <i class="fas fa-edit"></i> 編集
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSale(${sale.id})">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 販売フォームの送信処理
function handleSaleSubmit(e) {
    e.preventDefault();
    
    // 顧客名を取得（プルダウンまたは新規入力）
    const customerSelect = document.getElementById('customer-select').value;
    let customerName = '';
    
    if (customerSelect === 'new') {
        customerName = document.getElementById('customer-name').value.trim();
    } else {
        customerName = customerSelect;
    }
    
    const aircraftSelect = document.getElementById('aircraft-name').value;
    const customAircraft = document.getElementById('custom-aircraft').value.trim();
    const aircraftName = aircraftSelect === 'その他' ? customAircraft : aircraftSelect;
    const unitPrice = parseInt(document.getElementById('sale-price').value);
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const discountRate = parseInt(document.getElementById('discount-rate').value) || 0;
    const saleDate = document.getElementById('sale-date').value;
    const salespersonId = document.getElementById('salesperson-select').value;
    const isGift = document.getElementById('is-gift').checked;
    
    if (!customerName || !aircraftName || !unitPrice || !saleDate || quantity < 1 || !salespersonId) {
        showErrorToast('すべての項目を正しく入力してください。');
        return;
    }
    
    // 割引率の検証（プレゼントでない場合のみ）
    if (!isGift && (discountRate < 0 || discountRate > 70)) {
        showErrorToast('割引率は0%から70%の間で入力してください。');
        return;
    }
    
    // 定価を取得（データベースから、または入力価格をベースに計算）
    const aircraftData = getAircraftPrice(aircraftName);
    let originalPrice = aircraftData;
    
    // カスタム機体の場合、または価格が定価より高い場合は入力価格を定価とする
    if (!originalPrice || unitPrice > originalPrice) {
        if (discountRate > 0) {
            // 割引が適用されている場合、定価を逆算
            originalPrice = Math.round(unitPrice / (1 - discountRate / 100));
        } else {
            originalPrice = unitPrice;
        }
    }
    
    // 複数台購入時の計算（割引は1台分のみ）
    let totalSalePrice;
    let discountedPrice;
    
    if (isGift) {
        // プレゼントの場合は販売価格0円
        totalSalePrice = 0;
        discountedPrice = 0;
    } else if (discountRate > 0) {
        // 1台目に割引適用、残りは定価
        discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        totalSalePrice = discountedPrice + (originalPrice * (quantity - 1));
    } else {
        // 割引なしの場合は単価 × 台数
        totalSalePrice = unitPrice * quantity;
        discountedPrice = unitPrice;
    }
    
    // 在庫チェックと仕入れ価格計算
    let totalCostPrice = 0;
    let fromInventory = 0;
    let fromPurchase = 0;
    let inventoryUsed = []; // 使用した在庫情報
    let remainingQuantity = quantity;
    
    // 在庫優先販売の選択肢を取得
    const inventoryPriority = document.getElementById('inventory-priority').value;
    
    // 該当する航空機の在庫を取得（優先順：無償在庫 → 安い順）
    const availableInventory = inventory.filter(item => 
        item.aircraftName === aircraftName && 
        item.quantity > 0
    ).sort((a, b) => a.purchasePrice - b.purchasePrice); // 安い順（無償在庫は0円なので最初に来る）
    
    if (availableInventory.length > 0 && inventoryPriority !== 'purchase-only') {
        // 在庫から使用する場合
        if (inventoryPriority === 'inventory-only') {
            // 在庫のみ使用の場合、在庫が足りるかチェック
            const totalAvailableInventory = availableInventory.reduce((sum, item) => sum + item.quantity, 0);
            if (totalAvailableInventory < quantity) {
                showErrorToast(`在庫が不足しています。在庫: ${totalAvailableInventory}台、必要: ${quantity}台`);
                return;
            }
        }
        
        // 在庫から優先的に使用
        for (const inventoryItem of availableInventory) {
            if (remainingQuantity <= 0) break;
            
            const useFromThisStock = Math.min(inventoryItem.quantity, remainingQuantity);
            fromInventory += useFromThisStock;
            
            // 在庫分のコスト（在庫の仕入れ価格）
            totalCostPrice += inventoryItem.purchasePrice * useFromThisStock;
            
            // 在庫消費記録
            inventoryUsed.push({
                inventoryId: inventoryItem.id,
                aircraftName: aircraftName,
                quantity: useFromThisStock,
                purchasePrice: inventoryItem.purchasePrice,
                isFreeStock: inventoryItem.isFreeStock || inventoryItem.purchasePrice === 0
            });
            
            remainingQuantity -= useFromThisStock;
        }
    }
    
    // 在庫で足りない分、または新規仕入れのみの場合
    fromPurchase = remainingQuantity;
    if (fromPurchase > 0) {
        totalCostPrice += (originalPrice * 0.5) * fromPurchase; // 新規仕入れ分のコスト（定価の50%）
    }
    
    const totalSalesCommission = isGift ? 0 : totalSalePrice * 0.3; // 販売員給与（プレゼント時は0、通常時は販売価格の30%）
    const totalGrossProfit = totalSalePrice - totalCostPrice; // 粗利益
    const totalDealerProfit = totalGrossProfit - totalSalesCommission; // ディーラー実利益
    
    // 顧客を検索または作成
    let customer = customers.find(c => c.name === customerName);
    if (!customer) {
        customer = {
            id: Date.now(),
            name: customerName,
            createdAt: getJapanISOString()
        };
        customers.push(customer);
    }
    
    // 販売員を検索
    const salesperson = salespeople.find(s => s.id == salespersonId);
    if (!salesperson) {
        showErrorToast('選択された販売員が見つかりません。');
        return;
    }
    
    // 複数台の航空機を個別に登録
    for (let i = 0; i < quantity; i++) {
        const unitSalePrice = isGift ? 0 : (i === 0 && discountRate > 0 ? discountedPrice : originalPrice);
        const unitCostPrice = originalPrice * 0.5;
        const unitSalesCommission = isGift ? 0 : unitSalePrice * 0.3;
        const unitGrossProfit = unitSalePrice - unitCostPrice;
        const unitDealerProfit = unitGrossProfit - unitSalesCommission;
        
        const aircraftItem = {
            id: Date.now() + Math.random() + i,
            name: aircraftName,
            price: unitSalePrice, // 販売価格
            originalPrice: originalPrice,
            discountRate: isGift ? 0 : (i === 0 ? discountRate : 0), // プレゼント時は0、通常時は1台目のみ割引率
            costPrice: unitCostPrice,
            salesCommission: unitSalesCommission, // 販売員給与
            grossProfit: unitGrossProfit, // 粗利益
            dealerProfit: unitDealerProfit, // ディーラー実利益
            isGift: isGift, // プレゼント判定フラグ
            customerId: customer.id,
            purchaseDate: saleDate,
            quantity: 1, // 個別航空機は1台
            batchId: Date.now() // 同一購入のバッチID
        };
        aircraft.push(aircraftItem);
    }
    
    // 販売記録を作成（まとめて1件）
    const sale = {
        id: Date.now() + Math.random() * 3,
        customerName: customerName,
        aircraftName: aircraftName,
        unitPrice: unitPrice,
        quantity: quantity,
        totalPrice: totalSalePrice,
        originalPrice: originalPrice,
        discountRate: isGift ? 0 : discountRate,
        totalCostPrice: totalCostPrice,
        totalSalesCommission: totalSalesCommission, // 販売員給与合計
        totalGrossProfit: totalGrossProfit, // 粗利益合計
        totalDealerProfit: totalDealerProfit, // ディーラー実利益合計
        salespersonId: parseInt(salespersonId), // 販売員ID（数値）
        salespersonName: salesperson.name, // 販売員名
        salespersonCommission: totalSalesCommission, // 販売員給与
        isGift: isGift, // プレゼント判定フラグ
        saleDate: saleDate,
        batchId: Date.now(),
        fromInventory: fromInventory, // 在庫から使用した台数
        fromPurchase: fromPurchase // 新規仕入れした台数
    };
    sales.push(sale);
    
    // 在庫を消費
    if (fromInventory > 0) {
        for (const usedStock of inventoryUsed) {
            const itemIndex = inventory.findIndex(item => item.id === usedStock.inventoryId);
            if (itemIndex !== -1) {
                inventory[itemIndex].quantity -= usedStock.quantity;
                
                // 在庫が0になったら削除
                if (inventory[itemIndex].quantity <= 0) {
                    inventory.splice(itemIndex, 1);
                }
            }
        }
    }
    
    // 成功メッセージ用のテキスト準備
    const quantityText = quantity > 1 ? ` ${quantity}台` : '';
    const discountText = !isGift && discountRate > 0 ? ` (1台分${discountRate}%OFF適用)` : '';
    const giftText = isGift ? ' (プレゼント)' : '';
    const profitText = isGift ? `ディーラー損失: ${formatPrice(Math.abs(totalDealerProfit))}` : `ディーラー実利益: ${formatPrice(totalDealerProfit)}`;
    
    // 在庫使用情報
    let inventoryText = '';
    if (fromInventory > 0 && fromPurchase > 0) {
        const freeStockCount = inventoryUsed.filter(item => item.isFreeStock).reduce((sum, item) => sum + item.quantity, 0);
        const paidStockCount = fromInventory - freeStockCount;
        
        let inventoryDetail = '';
        if (freeStockCount > 0 && paidStockCount > 0) {
            inventoryDetail = `在庫${fromInventory}台（無償${freeStockCount}台+有償${paidStockCount}台）`;
        } else if (freeStockCount > 0) {
            inventoryDetail = `在庫${fromInventory}台（無償）`;
        } else {
            inventoryDetail = `在庫${fromInventory}台`;
        }
        
        inventoryText = ` (${inventoryDetail} + 新規仕入れ${fromPurchase}台)`;
    } else if (fromInventory > 0) {
        const freeStockCount = inventoryUsed.filter(item => item.isFreeStock).reduce((sum, item) => sum + item.quantity, 0);
        const paidStockCount = fromInventory - freeStockCount;
        
        if (freeStockCount > 0 && paidStockCount > 0) {
            inventoryText = ` (在庫${fromInventory}台使用: 無償${freeStockCount}台+有償${paidStockCount}台)`;
        } else if (freeStockCount === fromInventory) {
            inventoryText = ` (無償在庫${fromInventory}台使用)`;
        } else {
            inventoryText = ` (在庫${fromInventory}台使用)`;
        }
    } else {
        inventoryText = ` (新規仕入れ${fromPurchase}台)`;
    }
    
    // 金庫に売上を追加（利益がマイナスでも記録する）
    const cashboxDescription = isGift 
        ? `プレゼント提供による損失: ${aircraftName}${quantityText}${inventoryText}` 
        : (totalDealerProfit >= 0 
            ? `販売による利益: ${aircraftName}${quantityText}${inventoryText}` 
            : `販売による損失: ${aircraftName}${quantityText}${inventoryText}`);
    addToCashbox(totalDealerProfit, cashboxDescription, saleDate);
    
    // データを保存
    saveData();
    
    // フォームをクリア
    clearForm();
    
    // 成功メッセージを表示
    showAlert(`${aircraftName}${quantityText}の${isGift ? 'プレゼント' : '販売'}が正常に登録されました${discountText}${giftText}${inventoryText}。${profitText}`, 'success');
    
    // 統計を更新
    updateStats();
    
    // 顧客プルダウンを更新
    updateCustomerSelect();
    
    // 航空機フィルター選択肢を更新
    populateAircraftFilterSelect();
    
    // 給与記録を追加（プレゼントでない場合のみ）
    if (!isGift && totalSalesCommission > 0) {
        addSalaryRecord(
            parseInt(salespersonId), 
            totalSalesCommission, 
            `販売給与: ${aircraftName} ${quantity}台 (${customerName})`, 
            saleDate
        );
    }
    
    // 販売員統計を更新
    updateEmploymentStats();
    
    // 販売員テーブルが表示されている場合は更新
    if (document.getElementById('salespeople-section').classList.contains('active')) {
        renderSalespeopleTable();
        updateSalaryStats();
        renderSalaryDetails();
    }
    
    // 雇用管理が表示されている場合は更新
    if (document.getElementById('employment-section').classList.contains('active')) {
        renderEmploymentHistory();
    }
    
    // 在庫管理が表示されている場合は更新
    if (document.getElementById('inventory-section').classList.contains('active')) {
        renderInventoryTable();
        updateInventoryStats();
    }
}

// 顧客選択の変更処理
function handleCustomerChange(select) {
    const newCustomerContainer = document.getElementById('new-customer-container');
    const customerNameInput = document.getElementById('customer-name');
    
    if (select.value === 'new') {
        newCustomerContainer.style.display = 'block';
        customerNameInput.required = true;
        customerNameInput.focus();
    } else {
        newCustomerContainer.style.display = 'none';
        customerNameInput.required = false;
        customerNameInput.value = '';
    }
}

// 顧客プルダウンの更新
function updateCustomerSelect() {
    const customerSelect = document.getElementById('customer-select');
    const currentValue = customerSelect.value;
    
    // 既存のオプションをクリア（基本オプションは残す）
    customerSelect.innerHTML = `
        <option value="">選択してください</option>
        <option value="new">新規顧客</option>
    `;
    
    // 既存顧客をソートして追加
    const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.name;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
    });
    
    // 以前の選択値を復元
    if (currentValue && currentValue !== 'new') {
        customerSelect.value = currentValue;
    }
}

// 航空機選択の変更処理
function handleAircraftChange(e) {
    const aircraftSelect = e.target;
    const customAircraftContainer = document.getElementById('custom-aircraft-container');
    const customAircraftInput = document.getElementById('custom-aircraft');
    const priceInfo = document.getElementById('price-info');
    
    if (aircraftSelect.value === 'その他') {
        customAircraftContainer.style.display = 'block';
        customAircraftInput.required = true;
        priceInfo.textContent = 'カスタム機体の価格を入力してください';
    } else {
        customAircraftContainer.style.display = 'none';
        customAircraftInput.required = false;
        
        if (aircraftSelect.value) {
            const price = getAircraftPrice(aircraftSelect.value);
            if (price) {
                priceInfo.textContent = `定価: ${formatPrice(price)}`;
                document.getElementById('sale-price').value = price;
            } else {
                priceInfo.textContent = '価格情報がありません';
            }
        } else {
            priceInfo.textContent = '';
        }
    }
    
    // 在庫状況を更新
    updateInventoryStatus();
}

// 在庫優先販売の選択肢変更処理
function handleInventoryPriorityChange() {
    updateInventoryStatus();
}

// 在庫状況を更新
function updateInventoryStatus() {
    const aircraftSelect = document.getElementById('aircraft-name');
    const inventoryStatus = document.getElementById('inventory-status');
    const inventoryStatusText = document.getElementById('inventory-status-text');
    const inventoryPriority = document.getElementById('inventory-priority');
    
    if (!aircraftSelect.value || aircraftSelect.value === 'その他') {
        inventoryStatus.style.display = 'none';
        return;
    }
    
    const aircraftName = aircraftSelect.value;
    const availableInventory = inventory.filter(item => 
        item.aircraftName === aircraftName && 
        item.quantity > 0
    );
    
    if (availableInventory.length === 0) {
        inventoryStatus.className = 'alert alert-warning';
        inventoryStatus.style.display = 'block';
        inventoryStatusText.textContent = `在庫に ${aircraftName} がありません。新規仕入れで対応します。`;
        inventoryPriority.value = 'purchase-only';
    } else {
        const totalInventory = availableInventory.reduce((sum, item) => sum + item.quantity, 0);
        const freeStockCount = availableInventory.filter(item => item.isFreeStock || item.purchasePrice === 0).reduce((sum, item) => sum + item.quantity, 0);
        const paidStockCount = totalInventory - freeStockCount;
        
        inventoryStatus.className = 'alert alert-info';
        inventoryStatus.style.display = 'block';
        
        if (freeStockCount > 0 && paidStockCount > 0) {
            inventoryStatusText.textContent = `在庫: ${totalInventory}台 (無償${freeStockCount}台 + 有償${paidStockCount}台)`;
        } else if (freeStockCount === totalInventory) {
            inventoryStatusText.textContent = `在庫: ${totalInventory}台 (無償)`;
        } else {
            inventoryStatusText.textContent = `在庫: ${totalInventory}台 (有償)`;
        }
        
        // 在庫がある場合は自動選択をデフォルトに
        if (inventoryPriority.value === 'purchase-only') {
            inventoryPriority.value = 'auto';
        }
    }
}

// プレゼントチェックボックスの処理
function handleGiftChange() {
    const isGift = document.getElementById('is-gift').checked;
    const priceInput = document.getElementById('sale-price');
    const discountInput = document.getElementById('discount-rate');
    const discountInfo = document.getElementById('discount-info');
    
    if (isGift) {
        // プレゼントモードの場合
        priceInput.disabled = true;
        discountInput.disabled = true;
        discountInput.value = '0';
        
        // 価格情報をプレゼント用に更新
        if (discountInfo) {
            discountInfo.innerHTML = `
                <div class="text-warning">
                    <i class="fas fa-gift"></i> プレゼントモード
                    <br>販売価格: 無料
                    <br>仕入れ価格: 半額（赤字）
                </div>
            `;
        }
    } else {
        // 通常モードの場合
        priceInput.disabled = false;
        discountInput.disabled = false;
        
        // 計算を再更新
        updateDiscountCalculation();
    }
}

// 割引計算の更新
function updateDiscountCalculation() {
    const priceInput = document.getElementById('sale-price');
    const quantityInput = document.getElementById('quantity');
    const discountInput = document.getElementById('discount-rate');
    const discountInfo = document.getElementById('discount-info');
    const isGiftCheckbox = document.getElementById('is-gift');
    
    if (!priceInput || !quantityInput || !discountInput || !discountInfo || !isGiftCheckbox) return;
    
    const unitPrice = parseInt(priceInput.value) || 0;
    const quantity = parseInt(quantityInput.value) || 1;
    const discountRate = parseInt(discountInput.value) || 0;
    const isGift = isGiftCheckbox.checked;
    
    // プレゼントモードの場合は専用表示
    if (isGift) {
        const totalCostPrice = (unitPrice * 0.5) * quantity;
        const totalDealerLoss = -totalCostPrice; // 仕入れ価格分の損失
        
        let infoText = `<div class="text-warning"><i class="fas fa-gift"></i> プレゼントモード`;
        infoText += `<br>販売価格: 無料`;
        infoText += `<br>仕入れ価格: ${formatPrice(totalCostPrice)}`;
        infoText += `<br>販売員給与: 0円`;
        infoText += `<br><strong>ディーラー損失: ${formatPrice(Math.abs(totalDealerLoss))}</strong></div>`;
        
        discountInfo.innerHTML = infoText;
        return;
    }
    
    if (unitPrice > 0 && quantity > 0 && discountRate >= 0 && discountRate <= 70) {
        let totalSalePrice;
        let totalCostPrice;
        let discountAmount = 0;
        
        if (discountRate > 0) {
            // 1台目に割引適用、残りは定価
            const discountedPrice = Math.round(unitPrice * (1 - discountRate / 100));
            totalSalePrice = discountedPrice + (unitPrice * (quantity - 1));
            discountAmount = unitPrice - discountedPrice;
        } else {
            // 割引なしの場合
            totalSalePrice = unitPrice * quantity;
        }
        
        totalCostPrice = (unitPrice * 0.5) * quantity; // 仕入れ価格
        const totalSalesCommission = totalSalePrice * 0.3; // 販売員給与
        const totalGrossProfit = totalSalePrice - totalCostPrice; // 粗利益
        const totalDealerProfit = totalGrossProfit - totalSalesCommission; // ディーラー実利益
        
        let infoText = `<div class="text-success"><i class="fas fa-calculator"></i> `;
        
        if (quantity > 1) {
            infoText += `総販売価格: ${formatPrice(totalSalePrice)} (${quantity}台分)`;
            if (discountRate > 0) {
                infoText += `<br>割引額: ${formatPrice(discountAmount)} (1台分のみ)`;
            }
        } else {
            if (discountRate > 0) {
                infoText += `割引額: ${formatPrice(discountAmount)}`;
            } else {
                infoText += `販売価格: ${formatPrice(totalSalePrice)}`;
            }
        }
        
        infoText += `<br>販売員給与: ${formatPrice(totalSalesCommission)} (30%)`;
        infoText += `<br><strong>ディーラー利益: ${formatPrice(totalDealerProfit)}</strong></div>`;
        
        discountInfo.innerHTML = infoText;
    } else {
        discountInfo.textContent = '';
    }
}

// フォームクリア
function clearForm() {
    document.getElementById('sale-form').reset();
    document.getElementById('new-customer-container').style.display = 'none';
    document.getElementById('custom-aircraft-container').style.display = 'none';
    document.getElementById('inventory-status').style.display = 'none';
    document.getElementById('quantity').value = '1';
    document.getElementById('discount-rate').value = '0';
    document.getElementById('is-gift').checked = false;
    document.getElementById('inventory-priority').value = 'auto';
    
    // 航空機選択肢を再読み込み
    populateAircraftSelect();
    
    // 販売員選択肢を再読み込み
    updateSalespersonSelect();
    
    // 顧客選択肢を再読み込み
    updateCustomerSelect();
    
    // 日付を現在時刻に設定
    const now = new Date();
    const japanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // JSTに変換
    document.getElementById('sale-date').value = japanTime.toISOString().slice(0, 16);
    
    // 割引計算を更新
    updateDiscountCalculation();
    
    // 在庫状況を更新
    updateInventoryStatus();
}

// 顧客詳細表示
function showCustomerDetail(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const customerAircraft = aircraft.filter(a => a.customerId === customerId);
    const totalSpent = customerAircraft.reduce((sum, a) => sum + a.price, 0);
    
    // 機種別にグループ化
    const aircraftByType = {};
    customerAircraft.forEach(a => {
        if (!aircraftByType[a.name]) {
            aircraftByType[a.name] = {
                count: 0,
                totalPrice: 0,
                latestPurchase: null,
                aircraft: []
            };
        }
        aircraftByType[a.name].count++;
        aircraftByType[a.name].totalPrice += a.price;
        aircraftByType[a.name].aircraft.push(a);
        
        if (!aircraftByType[a.name].latestPurchase || 
            new Date(a.purchaseDate) > new Date(aircraftByType[a.name].latestPurchase)) {
            aircraftByType[a.name].latestPurchase = a.purchaseDate;
        }
    });
    
    const modalContent = document.getElementById('customer-modal-content');
    modalContent.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <div class="customer-avatar mx-auto" style="width: 80px; height: 80px; font-size: 2rem;">
                    <i class="fas fa-user"></i>
                </div>
                <h4 class="text-center mt-3">${customer.name}</h4>
                <hr>
                <dl class="row">
                    <dt class="col-sm-6">登録日:</dt>
                    <dd class="col-sm-6">${formatDate(customer.createdAt)}</dd>
                    <dt class="col-sm-6">所有航空機:</dt>
                    <dd class="col-sm-6"><span class="badge bg-info">${customerAircraft.length}機</span></dd>
                    <dt class="col-sm-6">機種数:</dt>
                    <dd class="col-sm-6"><span class="badge bg-secondary">${Object.keys(aircraftByType).length}機種</span></dd>
                    <dt class="col-sm-6">総購入額:</dt>
                    <dd class="col-sm-6"><span class="price-tag">${formatPrice(totalSpent)}</span></dd>
                </dl>
            </div>
            <div class="col-md-8">
                <h5><i class="fas fa-plane"></i> 機種別所有状況</h5>
                ${Object.keys(aircraftByType).length > 0 ? `
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>航空機名</th>
                                    <th>所有台数</th>
                                    <th>合計価格</th>
                                    <th>最新購入日</th>
                                    <th>詳細</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(aircraftByType).map(([name, data]) => `
                                    <tr>
                                        <td><i class="fas fa-plane aircraft-icon"></i>${name}</td>
                                        <td><span class="badge bg-primary">${data.count}台</span></td>
                                        <td class="price-tag">${formatPrice(data.totalPrice)}</td>
                                        <td>${formatDate(data.latestPurchase)}</td>
                                        <td>
                                            <small class="text-muted">詳細は下部履歴で確認</small>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-4">
                        <h6><i class="fas fa-list"></i> 個別航空機履歴</h6>
                        <div class="accordion" id="aircraftAccordion">
                            ${Object.entries(aircraftByType).map(([name, data], index) => `
                                <div class="accordion-item">
                                    <h2 class="accordion-header" id="heading${index}">
                                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                                            ${name} (${data.count}台)
                                        </button>
                                    </h2>
                                    <div id="collapse${index}" class="accordion-collapse collapse" data-bs-parent="#aircraftAccordion">
                                        <div class="accordion-body">
                                            <div class="table-responsive">
                                                <table class="table table-sm">
                                                    <thead>
                                                        <tr>
                                                            <th>購入日</th>
                                                            <th>購入価格</th>
                                                            <th>割引</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${data.aircraft.map(a => `
                                                            <tr>
                                                                <td>${formatDate(a.purchaseDate)}</td>
                                                                <td class="price-tag">${formatPrice(a.price)}</td>
                                                                <td>
                                                                    ${a.discountRate && a.discountRate > 0 ? 
                                                                        `<span class="badge bg-success">${a.discountRate}%OFF</span>` : 
                                                                        `<span class="text-muted">なし</span>`
                                                                    }
                                                                </td>
                                                            </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="text-center py-4">
                        <i class="fas fa-plane fa-2x text-muted mb-2"></i>
                        <p class="text-muted">この顧客はまだ航空機を所有していません。</p>
                    </div>
                `}
            </div>
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('customerModal'));
    modal.show();
}

// 顧客削除
function deleteCustomer(customerId) {
    if (!confirm('この顧客を削除しますか？関連する航空機データと販売記録も削除され、金庫残高も調整されます。')) {
        return;
    }
    
    // 顧客情報を取得
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
        showErrorToast('顧客が見つかりません。');
        return;
    }
    
    // 該当顧客の販売記録を取得して金庫調整額を計算
    const customerSales = sales.filter(s => s.customerName === customer.name);
    let totalDealerProfitAdjustment = 0;
    
    customerSales.forEach(sale => {
        let dealerProfit = 0;
        
        if (sale.totalDealerProfit !== undefined) {
            dealerProfit = sale.totalDealerProfit;
        } else {
            // 旧データ構造の場合は計算
            const quantity = sale.quantity || 1;
            const totalPrice = sale.totalPrice || sale.price;
            const originalPrice = sale.originalPrice || sale.price;
            const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
            const totalSalesCommission = totalPrice * 0.3;
            const totalGrossProfit = totalPrice - totalCostPrice;
            dealerProfit = totalGrossProfit - totalSalesCommission;
        }
        
        totalDealerProfitAdjustment += dealerProfit;
    });
    
    // 金庫から利益を取り消し
    if (totalDealerProfitAdjustment !== 0) {
        const cashboxDescription = totalDealerProfitAdjustment >= 0 
            ? `顧客削除による利益取り消し: ${customer.name}（${customerSales.length}件の販売）`
            : `顧客削除による損失取り消し: ${customer.name}（${customerSales.length}件の販売）`;
        
        removeCashboxAmount(totalDealerProfitAdjustment, cashboxDescription);
    }
    
    // 顧客を削除
    customers = customers.filter(c => c.id !== customerId);
    
    // 関連する航空機を削除
    aircraft = aircraft.filter(a => a.customerId !== customerId);
    
    // 関連する販売記録を削除
    sales = sales.filter(s => s.customerName !== customer.name);
    
    // データ保存と表示更新
    saveData();
    updateStats();
    renderCustomersTable();
    populateAircraftFilterSelect(); // 航空機フィルター選択肢を更新
    renderCashboxHistory(); // 金庫履歴も更新
    
    // 成功メッセージ
    let message = `顧客「${customer.name}」が削除されました。`;
    if (totalDealerProfitAdjustment !== 0) {
        const profitText = totalDealerProfitAdjustment >= 0 
            ? `利益${formatPrice(totalDealerProfitAdjustment)}を金庫から取り消しました`
            : `損失${formatPrice(Math.abs(totalDealerProfitAdjustment))}を金庫に戻しました`;
        message += profitText + '。';
    }
    
    showInfoToast(message);
}

// 航空機削除
function deleteAircraft(aircraftId) {
    if (!confirm('この航空機を削除しますか？関連する販売記録も削除され、金庫残高も調整されます。')) {
        return;
    }
    
    const aircraftItem = aircraft.find(a => a.id === aircraftId);
    if (aircraftItem) {
        // 関連する販売記録を特定
        let relatedSales = [];
        
        if (aircraftItem.batchId) {
            // 新しいデータ構造：同じbatchIdの販売記録を検索
            relatedSales = sales.filter(s => s.batchId === aircraftItem.batchId);
        } else {
            // 旧データ構造：顧客名と航空機名で検索
            const customer = customers.find(c => c.id === aircraftItem.customerId);
            if (customer) {
                relatedSales = sales.filter(s => 
                    s.customerName === customer.name && s.aircraftName === aircraftItem.name
                );
            }
        }
        
        // 関連する販売記録の利益を計算して金庫調整
        let totalDealerProfitAdjustment = 0;
        
        relatedSales.forEach(sale => {
            let dealerProfit = 0;
            
            if (sale.totalDealerProfit !== undefined) {
                dealerProfit = sale.totalDealerProfit;
            } else {
                // 旧データ構造の場合は計算
                const quantity = sale.quantity || 1;
                const totalPrice = sale.totalPrice || sale.price;
                const originalPrice = sale.originalPrice || sale.price;
                const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
                const totalSalesCommission = totalPrice * 0.3;
                const totalGrossProfit = totalPrice - totalCostPrice;
                dealerProfit = totalGrossProfit - totalSalesCommission;
            }
            
            totalDealerProfitAdjustment += dealerProfit;
        });
        
        // 金庫から利益を取り消し
        if (totalDealerProfitAdjustment !== 0) {
            const cashboxDescription = totalDealerProfitAdjustment >= 0 
                ? `航空機削除による利益取り消し: ${aircraftItem.name}`
                : `航空機削除による損失取り消し: ${aircraftItem.name}`;
            
            removeCashboxAmount(totalDealerProfitAdjustment, cashboxDescription);
        }
        
        // 航空機を削除
        aircraft = aircraft.filter(a => a.id !== aircraftId);
        
        // 関連する販売記録を削除
        if (aircraftItem.batchId) {
            sales = sales.filter(s => s.batchId !== aircraftItem.batchId);
        } else {
            const customer = customers.find(c => c.id === aircraftItem.customerId);
            if (customer) {
                sales = sales.filter(s => !(s.customerName === customer.name && s.aircraftName === aircraftItem.name));
            }
        }
        
        // データ保存と表示更新
        saveData();
        updateStats();
        renderAircraftTable();
        renderSalesTable(); // 販売履歴も更新
        renderCashboxHistory(); // 金庫履歴も更新
        populateAircraftFilterSelect(); // 航空機フィルター選択肢を更新
        
        // 成功メッセージ
        let message = `航空機「${aircraftItem.name}」が削除されました。`;
        if (totalDealerProfitAdjustment !== 0) {
            const profitText = totalDealerProfitAdjustment >= 0 
                ? `利益${formatPrice(totalDealerProfitAdjustment)}を金庫から取り消しました`
                : `損失${formatPrice(Math.abs(totalDealerProfitAdjustment))}を金庫に戻しました`;
            message += profitText + '。';
        }
        
        showInfoToast(message);
    }
}

// 販売記録削除
function deleteSale(saleId) {
    if (!confirm('この販売記録を削除しますか？関連する航空機データも削除され、金庫残高も調整されます。')) {
        return;
    }
    
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
        // ディーラー利益額を計算（金庫調整用）
        let dealerProfit = 0;
        
        if (sale.totalDealerProfit !== undefined) {
            // 新しいデータ構造（販売員給与考慮済み）
            dealerProfit = sale.totalDealerProfit;
        } else {
            // 旧データ構造の場合は計算
            const quantity = sale.quantity || 1;
            const totalPrice = sale.totalPrice || sale.price;
            const originalPrice = sale.originalPrice || sale.price;
            const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
            const totalSalesCommission = totalPrice * 0.3;
            const totalGrossProfit = totalPrice - totalCostPrice;
            dealerProfit = totalGrossProfit - totalSalesCommission;
        }
        
        // 金庫から利益を取り消し（損失の場合は戻す）
        const quantityText = (sale.quantity && sale.quantity > 1) ? ` ${sale.quantity}台` : '';
        const cashboxDescription = dealerProfit >= 0 
            ? `販売記録削除による利益取り消し: ${sale.aircraftName}${quantityText}`
            : `販売記録削除による損失取り消し: ${sale.aircraftName}${quantityText}`;
        
        removeCashboxAmount(dealerProfit, cashboxDescription);
        
        // 航空機データの削除
        if (sale.batchId) {
            // 新しいデータ構造（batchId）
            aircraft = aircraft.filter(a => a.batchId !== sale.batchId);
        } else {
            // 旧データ構造の場合、顧客名と航空機名で検索して削除
            aircraft = aircraft.filter(a => !(
                a.customerId && 
                customers.find(c => c.id === a.customerId && c.name === sale.customerName) &&
                a.name === sale.aircraftName
            ));
        }
        
        // 関連する給与記録を削除
        const unpaidSalaryRecords = deleteSalaryRecordsForSale(sale);
        
        // 販売記録を削除
        sales = sales.filter(s => s.id !== saleId);
        
        // データ保存と表示更新
        saveData();
        updateStats();
        renderSalesTable();
        renderAircraftTable();
        renderCashboxHistory(); // 金庫履歴も更新
        populateAircraftFilterSelect(); // 航空機フィルター選択肢を更新
        
        // 給与管理セクションの更新
        updateSalaryStats();
        renderSalaryDetails();
        renderSalespeopleTable();
        updateEmploymentStats();
        
        // 成功メッセージ
        const profitText = dealerProfit >= 0 
            ? `利益${formatPrice(dealerProfit)}を金庫から取り消しました`
            : `損失${formatPrice(Math.abs(dealerProfit))}を金庫に戻しました`;
        
        const salaryText = unpaidSalaryRecords.length > 0 
            ? ` 関連する未払い給与${formatPrice(unpaidSalaryRecords.reduce((sum, record) => sum + record.amount, 0))}も削除されました。`
            : '';
        
        showInfoToast(`販売記録が削除されました。${profitText}。${salaryText}`);
    }
}

// アラート表示（ポップアップ形式）
function showAlert(message, type = 'info') {
    if (type === 'success') {
        showSuccessPopup(message);
    } else if (type === 'danger') {
        showErrorToast(message);
    } else {
        showInfoToast(message);
    }
}

// 成功時のポップアップモーダル表示
function showSuccessPopup(message) {
    const modal = document.getElementById('notificationModal');
    const title = document.getElementById('notification-title');
    const body = document.getElementById('notification-body');
    const header = document.getElementById('notification-header');
    
    // アイコンと色を設定
    title.innerHTML = '<i class="fas fa-check-circle text-success"></i> 販売登録完了';
    header.className = 'modal-header bg-success text-white';
    
    // メッセージを解析して美しく表示
    const parsedContent = parseSaleSuccessMessage(message);
    
    body.innerHTML = `
        <div class="mb-4">
            <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
            <h4 class="text-success mb-4">${parsedContent.title}</h4>
            
            ${parsedContent.details ? `
                <div class="card border-success">
                    <div class="card-body">
                        <h6 class="card-title text-success">
                            <i class="fas fa-info-circle"></i> 取引詳細
                        </h6>
                        ${parsedContent.details}
                    </div>
                </div>
            ` : ''}
            
            ${parsedContent.profit ? `
                <div class="alert alert-success mt-3 profit-display">
                    <div class="d-flex align-items-center justify-content-center">
                        <i class="fas fa-chart-line fa-2x me-3 text-success"></i>
                        <div>
                            <h6 class="mb-0 text-success">ディーラー実利益</h6>
                            <h4 class="mb-0 fw-bold">${parsedContent.profit}</h4>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="alert alert-warning mt-3 mb-0">
                <div class="d-flex align-items-center justify-content-center">
                    <i class="fas fa-safe fa-2x me-3 text-warning"></i>
                    <div>
                        <h6 class="mb-0 text-warning">金庫に自動入金されました</h6>
                        <small class="text-muted">金庫管理ページで履歴を確認できます</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // モーダルを表示
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // 4秒後に自動で閉じる
    setTimeout(() => {
        bootstrapModal.hide();
    }, 4000);
}

// 販売成功メッセージの解析
function parseSaleSuccessMessage(message) {
    const result = {
        title: '販売が正常に登録されました',
        details: '',
        profit: ''
    };
    
    // メッセージから情報を抽出
    if (message.includes('ディーラー実利益:')) {
        const profitMatch = message.match(/ディーラー実利益:\s*(¥[^。]+)/);
        if (profitMatch) {
            result.profit = profitMatch[1];
        }
    }
    
    // 機種名と台数を抽出
    const aircraftMatch = message.match(/^([^0-9]+?)(?:(\d+)台)?の販売が/);
    if (aircraftMatch) {
        const aircraftName = aircraftMatch[1].trim();
        const quantity = aircraftMatch[2] || '1';
        
        result.details = `
            <div class="row text-start">
                <div class="col-6"><strong>航空機:</strong></div>
                <div class="col-6">${aircraftName}</div>
                <div class="col-6"><strong>台数:</strong></div>
                <div class="col-6">${quantity}台</div>
            </div>
        `;
    }
    
    // 割引情報を抽出
    if (message.includes('%OFF適用')) {
        const discountMatch = message.match(/((?:1台分)?(\d+)%OFF適用)/);
        if (discountMatch) {
            result.details += `
                <div class="row text-start mt-2">
                    <div class="col-6"><strong>割引:</strong></div>
                    <div class="col-6">
                        <span class="badge bg-warning">${discountMatch[1]}</span>
                    </div>
                </div>
            `;
        }
    }
    
    return result;
}

// エラー時のトースト表示
function showErrorToast(message) {
    const toast = document.getElementById('errorToast');
    const messageElement = document.getElementById('error-toast-message');
    
    messageElement.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${message}`;
    
    // アニメーションクラスを追加
    toast.classList.add('showing');
    
    const bootstrapToast = new bootstrap.Toast(toast, {
        animation: true,
        autohide: true,
        delay: 5000
    });
    
    bootstrapToast.show();
    
    // アニメーションクラスを削除
    setTimeout(() => {
        toast.classList.remove('showing');
    }, 300);
}

// 情報表示用のトースト
function showInfoToast(message) {
    const toast = document.getElementById('successToast');
    const messageElement = document.getElementById('toast-message');
    
    messageElement.innerHTML = `<i class="fas fa-info-circle me-2"></i>${message}`;
    
    // アニメーションクラスを追加
    toast.classList.add('showing');
    
    const bootstrapToast = new bootstrap.Toast(toast, {
        animation: true,
        autohide: true,
        delay: 4000
    });
    
    bootstrapToast.show();
    
    // アニメーションクラスを削除
    setTimeout(() => {
        toast.classList.remove('showing');
    }, 300);
}

// 価格フォーマット（億・万表示）
function formatPrice(price) {
    if (price >= 100000000) { // 1億円以上
        const oku = Math.floor(price / 100000000);
        const man = Math.floor((price % 100000000) / 10000);
        if (man > 0) {
            return `¥${oku}億${man}万円`;
        } else {
            return `¥${oku}億円`;
        }
    } else if (price >= 10000) { // 1万円以上
        const man = Math.floor(price / 10000);
        const remainder = price % 10000;
        if (remainder > 0) {
            return `¥${man}万${remainder}円`;
        } else {
            return `¥${man}万円`;
        }
    } else { // 1万円未満
        return `¥${price.toLocaleString()}円`;
    }
}

// 日本標準時の日付文字列を取得（YYYY-MM-DD形式）
function getJapanDateString() {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    return japanTime.toISOString().slice(0, 10);
}

// 日本標準時の日付時刻文字列を取得（YYYY-MM-DDTHH:MM形式）
function getJapanDateTimeString() {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    return japanTime.toISOString().slice(0, 16);
}

// 日本標準時のISO文字列を取得（データ保存用）
function getJapanISOString() {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    return japanTime.toISOString();
}

// 日付フォーマット（日本標準時で年月日のみ表示）
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Tokyo'
    });
}

// データエクスポート
function exportData() {
    const data = {
        customers: customers,
        aircraft: aircraft,
        sales: sales,
        cashbox: cashbox,
        salespeople: salespeople,
        inventory: inventory,
        salaryRecords: salaryRecords,
        exportDate: getJapanISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'luxury-aircraft-data.json';
    link.click();
    
    URL.revokeObjectURL(url);
    showInfoToast('データがエクスポートされました。');
}

// 航空機選択肢を動的に生成
function populateAircraftSelect() {
    const select = document.getElementById('aircraft-name');
    
    // 既存のオプションをクリア（最初のオプションは残す）
    select.innerHTML = '<option value="">選択してください</option>';
    
    // カテゴリ別に航空機を分類
    const categories = {};
    aircraftDatabase.forEach(aircraft => {
        if (!categories[aircraft.category]) {
            categories[aircraft.category] = [];
        }
        categories[aircraft.category].push(aircraft);
    });
    
    // カテゴリ別にオプションを追加
    Object.keys(categories).sort().forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categories[category].forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft.name;
            option.textContent = `${aircraft.name} (${formatPrice(aircraft.price)})`;
            option.dataset.price = aircraft.price;
            option.dataset.category = aircraft.category;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
    
    // カスタムオプションを追加
    const customOption = document.createElement('option');
    customOption.value = 'その他';
    customOption.textContent = 'その他（カスタム）';
    select.appendChild(customOption);
}

// 航空機の参考価格を取得
function getAircraftPrice(aircraftName) {
    const aircraft = aircraftDatabase.find(a => a.name === aircraftName);
    return aircraft ? aircraft.price : null;
}

// データインポート
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.customers && data.aircraft && data.sales) {
                customers = data.customers;
                aircraft = data.aircraft;
                sales = data.sales;
                
                // 追加データのインポート（存在する場合）
                if (data.cashbox) cashbox = data.cashbox;
                if (data.salespeople) salespeople = data.salespeople;
                if (data.inventory) inventory = data.inventory;
                if (data.salaryRecords) salaryRecords = data.salaryRecords;
                
                saveData();
                updateStats();
                renderDashboard();
                renderCustomersTable();
                renderAircraftTable();
                renderSalesTable();
                renderCashboxHistory();
                updateCashboxStats();
                renderSalespeopleTable();
                renderInventoryTable();
                updateInventoryStats();
                showInfoToast('データがインポートされました。');
            } else {
                showErrorToast('無効なデータファイルです。');
            }
        } catch (error) {
            showErrorToast('データファイルの読み込みに失敗しました。');
        }
    };
    
    reader.readAsText(file);
}

// 販売員選択肢の更新
function updateSalespersonSelect() {
    const salespersonSelect = document.getElementById('salesperson-select');
    if (!salespersonSelect) return;
    
    const activeSalespeople = salespeople.filter(person => person.status === 'active');
    
    // 既存の選択肢をクリア（最初の選択肢は残す）
    salespersonSelect.innerHTML = '<option value="">選択してください</option>';
    
    // 在籍販売員の選択肢を追加
    activeSalespeople.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        salespersonSelect.appendChild(option);
    });
}

// 販売員テーブルの描画
function renderSalespeopleTable() {
    const salespeopleTable = document.getElementById('salespeople-table');
    
    if (!salespeopleTable) return;
    
    if (salespeople.length === 0) {
        salespeopleTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center empty-data">
                    <i class="fas fa-user-tie"></i>
                    <h6>販売員がいません</h6>
                    <p>雇用管理から新しい販売員を雇用してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    salespeopleTable.innerHTML = salespeople.map(person => {
        const salesData = getSalespersonStatistics(person.id);
        const pendingSalary = getPendingSalary(person.id);
        const statusClass = person.status === 'active' ? 'text-success' : 'text-danger';
        const statusText = person.status === 'active' ? '在籍' : '退職';
        
        return `
            <tr>
                <td>${person.name}</td>
                <td>${formatDate(person.employmentDate)}</td>
                <td>
                    <span class="badge bg-primary">${salesData.totalSales}件</span>
                    <div class="small text-muted">${formatPrice(salesData.totalRevenue)}</div>
                </td>
                <td class="price-tag text-warning">
                    ${formatPrice(pendingSalary)}
                    ${pendingSalary > 0 ? '<i class="fas fa-exclamation-triangle text-warning ms-1"></i>' : ''}
                </td>
                <td class="price-tag">${formatPrice(salesData.totalCommission)}</td>
                <td>
                    <span class="badge ${person.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="showSalespersonDetail(${person.id})">
                        <i class="fas fa-eye"></i> 詳細
                    </button>
                    ${person.status === 'active' ? `
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="fireSalesperson(${person.id})">
                            <i class="fas fa-user-times"></i> 解雇
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// 販売員統計データの取得
function getSalespersonStatistics(salespersonId) {
    const salespersonSales = sales.filter(sale => 
        sale.salespersonId == salespersonId || 
        (sale.salespersonId && sale.salespersonId.toString() === salespersonId.toString())
    );
    
    let totalRevenue = 0;
    let totalCommission = 0;
    
    salespersonSales.forEach(sale => {
        // 売上金額の計算
        const revenue = sale.totalPrice || sale.price || 0;
        totalRevenue += revenue;
        
        // 販売員給与の計算（複数のフィールドを確認）
        let commission = 0;
        if (sale.salespersonCommission) {
            commission = sale.salespersonCommission;
        } else if (sale.totalSalesCommission) {
            commission = sale.totalSalesCommission;
        } else {
            // 給与情報がない場合は販売価格の30%で計算
            commission = revenue * 0.3;
        }
        totalCommission += commission;
    });
    
    return {
        totalSales: salespersonSales.length,
        totalRevenue: totalRevenue,
        totalCommission: totalCommission
    };
}

// 雇用履歴の描画
function renderEmploymentHistory() {
    const employmentHistoryTable = document.getElementById('employment-history-table');
    
    if (!employmentHistoryTable) return;
    
    if (salespeople.length === 0) {
        employmentHistoryTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center empty-data">
                    <i class="fas fa-history"></i>
                    <h6>雇用履歴がありません</h6>
                    <p>販売員を雇用すると履歴が表示されます。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // 雇用日でソート（新しい順）
    const sortedSalespeople = [...salespeople].sort((a, b) => new Date(b.employmentDate) - new Date(a.employmentDate));
    
    employmentHistoryTable.innerHTML = sortedSalespeople.map(person => {
        const statusClass = person.status === 'active' ? 'text-success' : 'text-danger';
        const statusText = person.status === 'active' ? '在籍' : '退職';
        
        return `
            <tr>
                <td>${formatDate(person.employmentDate)}</td>
                <td>${person.name}</td>
                <td>${person.note || '-'}</td>
                <td>
                    <span class="badge ${person.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="showSalespersonDetail(${person.id})">
                        <i class="fas fa-eye"></i> 詳細
                    </button>
                    ${person.status === 'active' ? `
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="fireSalesperson(${person.id})">
                            <i class="fas fa-user-times"></i> 解雇
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// 雇用統計の更新
function updateEmploymentStats() {
    const activeSalespeopleCount = document.getElementById('active-salespeople-count');
    const totalSalesCount = document.getElementById('total-sales-count');
    const totalCommissionPaid = document.getElementById('total-commission-paid');
    
    if (activeSalespeopleCount) {
        const activeCount = salespeople.filter(person => person.status === 'active').length;
        activeSalespeopleCount.textContent = activeCount;
    }
    
    if (totalSalesCount) {
        // 販売員が割り当てられた販売記録のみカウント
        const salesWithSalesperson = sales.filter(sale => sale.salespersonId);
        totalSalesCount.textContent = salesWithSalesperson.length;
    }
    
    if (totalCommissionPaid) {
        // 支払済み給与の合計を計算
        const paidSalaryTotal = salaryRecords
            .filter(record => record.paid)
            .reduce((sum, record) => sum + record.amount, 0);
        totalCommissionPaid.textContent = formatPrice(paidSalaryTotal);
    }
}

// 雇用フォームの処理
function handleEmploymentSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('salesperson-name').value.trim();
    const employmentDate = document.getElementById('employment-date').value;
    const note = document.getElementById('employment-note').value.trim();
    
    if (!name || !employmentDate) {
        showErrorToast('販売員名と雇用日を入力してください。');
        return;
    }
    
    // 重複チェック
    const existingSalesperson = salespeople.find(person => 
        person.name === name && person.status === 'active'
    );
    
    if (existingSalesperson) {
        showErrorToast('同じ名前の販売員が既に在籍しています。');
        return;
    }
    
    // 新規販売員の作成
    const newSalesperson = {
        id: Date.now(),
        name: name,
        employmentDate: employmentDate,
        note: note,
        status: 'active'
    };
    
    salespeople.push(newSalesperson);
    saveData();
    
    // フォームをクリア
    document.getElementById('employment-form').reset();
    document.getElementById('employment-date').value = getJapanDateString();
    
    // 選択肢を更新
    updateSalespersonSelect();
    
    // 表示を更新
    renderEmploymentHistory();
    updateEmploymentStats();
    
    showInfoToast(`${name}さんを販売員として雇用しました。`);
}

// 販売員の解雇
function fireSalesperson(salespersonId) {
    const person = salespeople.find(p => p.id === salespersonId);
    if (!person) return;
    
    if (confirm(`${person.name}さんを解雇しますか？\n\n解雇後は新規販売の担当者として選択できなくなります。`)) {
        person.status = 'inactive';
        person.fireDate = getJapanDateString();
        
        saveData();
        
        // 選択肢を更新
        updateSalespersonSelect();
        
        // 表示を更新
        renderSalespeopleTable();
        renderEmploymentHistory();
        updateEmploymentStats();
        
        showInfoToast(`${person.name}さんを解雇しました。`);
    }
}

// 販売員詳細の表示
function showSalespersonDetail(salespersonId) {
    const person = salespeople.find(p => p.id === salespersonId);
    if (!person) return;
    
    const salesData = getSalespersonStatistics(salespersonId);
    const pendingSalary = getPendingSalary(salespersonId);
    const paidSalary = salaryRecords
        .filter(record => record.salespersonId == salespersonId && record.paid)
        .reduce((sum, record) => sum + record.amount, 0);
    
    const salespersonSales = sales.filter(sale => 
        sale.salespersonId == salespersonId || 
        (sale.salespersonId && sale.salespersonId.toString() === salespersonId.toString())
    );
    
    const modalContent = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-user-tie"></i> 基本情報</h6>
                <table class="table table-sm">
                    <tr>
                        <td>販売員名</td>
                        <td><strong>${person.name}</strong></td>
                    </tr>
                    <tr>
                        <td>雇用日</td>
                        <td>${formatDate(person.employmentDate)}</td>
                    </tr>
                    <tr>
                        <td>雇用状態</td>
                        <td>
                            <span class="badge ${person.status === 'active' ? 'bg-success' : 'bg-danger'}">
                                ${person.status === 'active' ? '在籍' : '退職'}
                            </span>
                        </td>
                    </tr>
                    ${person.fireDate ? `
                        <tr>
                            <td>退職日</td>
                            <td>${formatDate(person.fireDate)}</td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td>雇用メモ</td>
                        <td>${person.note || '-'}</td>
                    </tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-chart-line"></i> 売上・給与統計</h6>
                <table class="table table-sm">
                    <tr>
                        <td>売上件数</td>
                        <td><strong>${salesData.totalSales}件</strong></td>
                    </tr>
                    <tr>
                        <td>売上金額</td>
                        <td><strong>${formatPrice(salesData.totalRevenue)}</strong></td>
                    </tr>
                    <tr>
                        <td>総給与額</td>
                        <td><strong>${formatPrice(salesData.totalCommission)}</strong></td>
                    </tr>
                    <tr>
                        <td>未払い給与</td>
                        <td><strong class="text-warning">${formatPrice(pendingSalary)}</strong></td>
                    </tr>
                    <tr>
                        <td>支払済み給与</td>
                        <td><strong class="text-success">${formatPrice(paidSalary)}</strong></td>
                    </tr>
                </table>
            </div>
        </div>
        
        ${salespersonSales.length > 0 ? `
            <hr>
            <h6><i class="fas fa-list"></i> 販売履歴</h6>
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>販売日</th>
                            <th>顧客名</th>
                            <th>航空機名</th>
                            <th>販売価格</th>
                            <th>給与額</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salespersonSales.map(sale => {
                            const revenue = sale.totalPrice || sale.price || 0;
                            const commission = sale.salespersonCommission || sale.totalSalesCommission || (revenue * 0.3);
                            
                            return `
                                <tr>
                                    <td>${formatDate(sale.saleDate || sale.date)}</td>
                                    <td>${sale.customerName}</td>
                                    <td>${sale.aircraftName}</td>
                                    <td class="price-tag">${formatPrice(revenue)}</td>
                                    <td class="price-tag">${formatPrice(commission)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <hr>
            <div class="text-center text-muted">
                <i class="fas fa-info-circle"></i>
                <p>まだ販売実績がありません。</p>
            </div>
        `}
    `;
    
    document.getElementById('customer-modal-content').innerHTML = modalContent;
    document.querySelector('#customerModal .modal-title').innerHTML = `<i class="fas fa-user-tie"></i> ${person.name}さんの詳細`;
    
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

// 販売記録の編集
function editSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        showErrorToast('販売記録が見つかりません。');
        return;
    }
    
    // 編集モーダルのフォームを初期化
    document.getElementById('edit-sale-id').value = sale.id;
    document.getElementById('edit-customer-name-display').textContent = sale.customerName;
    document.getElementById('edit-original-price-display').textContent = formatPrice(sale.totalPrice || sale.price);
    
    // 航空機選択肢を生成
    populateEditAircraftSelect();
    
    // 販売員選択肢を生成
    populateEditSalespersonSelect();
    
    // フォームに既存の値を設定
    document.getElementById('edit-aircraft-name').value = sale.aircraftName === 'その他' ? 'その他' : sale.aircraftName;
    document.getElementById('edit-salesperson-select').value = sale.salespersonId || '';
    document.getElementById('edit-quantity').value = sale.quantity || 1;
    document.getElementById('edit-sale-price').value = sale.unitPrice || sale.price || sale.totalPrice;
    document.getElementById('edit-discount-rate').value = sale.discountRate || 0;
    document.getElementById('edit-sale-date').value = sale.saleDate ? sale.saleDate.slice(0, 16) : '';
    
    // カスタム航空機の処理
    if (!aircraftDatabase.find(a => a.name === sale.aircraftName)) {
        document.getElementById('edit-aircraft-name').value = 'その他';
        document.getElementById('edit-custom-aircraft').value = sale.aircraftName;
        document.getElementById('edit-custom-aircraft-container').style.display = 'block';
    } else {
        document.getElementById('edit-custom-aircraft-container').style.display = 'none';
    }
    
    // 航空機選択の変更を処理
    handleEditAircraftChange({ target: document.getElementById('edit-aircraft-name') });
    
    // 計算結果を更新
    updateEditDiscountCalculation();
    
    // モーダルを表示
    new bootstrap.Modal(document.getElementById('editSaleModal')).show();
}

// 編集用航空機選択肢の生成
function populateEditAircraftSelect() {
    const select = document.getElementById('edit-aircraft-name');
    
    // 既存のオプションをクリア
    select.innerHTML = '<option value="">選択してください</option>';
    
    // カテゴリ別に航空機を分類
    const categories = {};
    aircraftDatabase.forEach(aircraft => {
        if (!categories[aircraft.category]) {
            categories[aircraft.category] = [];
        }
        categories[aircraft.category].push(aircraft);
    });
    
    // カテゴリ別にオプションを追加
    Object.keys(categories).sort().forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categories[category].forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft.name;
            option.textContent = `${aircraft.name} (${formatPrice(aircraft.price)})`;
            option.dataset.price = aircraft.price;
            option.dataset.category = aircraft.category;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
    
    // カスタムオプションを追加
    const customOption = document.createElement('option');
    customOption.value = 'その他';
    customOption.textContent = 'その他（カスタム）';
    select.appendChild(customOption);
}

// 編集用販売員選択肢の生成
function populateEditSalespersonSelect() {
    const select = document.getElementById('edit-salesperson-select');
    
    // 既存の選択肢をクリア
    select.innerHTML = '<option value="">選択してください</option>';
    
    // 全ての販売員の選択肢を追加（退職者も含む）
    salespeople.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.status === 'active' ? person.name : `${person.name} (退職済み)`;
        if (person.status !== 'active') {
            option.className = 'text-muted';
        }
        select.appendChild(option);
    });
}

// 編集フォームでの航空機選択変更処理
function handleEditAircraftChange(e) {
    const customContainer = document.getElementById('edit-custom-aircraft-container');
    const customInput = document.getElementById('edit-custom-aircraft');
    const priceInput = document.getElementById('edit-sale-price');
    const priceInfo = document.getElementById('edit-price-info');
    
    if (e.target.value === 'その他') {
        customContainer.style.display = 'block';
        customInput.required = true;
        if (priceInfo) {
            priceInfo.textContent = '';
        }
    } else {
        customContainer.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
        
        // 選択された航空機の参考価格を表示
        const selectedOption = e.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.price) {
            const referencePrice = parseInt(selectedOption.dataset.price);
            priceInput.value = referencePrice;
            
            if (priceInfo) {
                const costPrice = referencePrice * 0.5;
                const salesCommission = referencePrice * 0.3;
                const grossProfit = referencePrice - costPrice;
                const dealerProfit = grossProfit - salesCommission;
                priceInfo.innerHTML = `
                    <div><i class="fas fa-info-circle"></i> 定価: ${formatPrice(referencePrice)} (1台あたり)</div>
                    <div class="text-muted">仕入れ価格: ${formatPrice(costPrice)} | 販売員給与: ${formatPrice(salesCommission)}</div>
                    <div class="text-success"><strong>ディーラー利益: ${formatPrice(dealerProfit)}</strong></div>
                `;
                priceInfo.className = 'text-info small mt-1';
            }
            
            // 割引計算を更新
            updateEditDiscountCalculation();
        } else if (priceInfo) {
            priceInfo.textContent = '';
        }
    }
}

// 編集フォームでの割引計算
function updateEditDiscountCalculation() {
    const aircraftSelect = document.getElementById('edit-aircraft-name').value;
    const customAircraft = document.getElementById('edit-custom-aircraft').value;
    const aircraftName = aircraftSelect === 'その他' ? customAircraft : aircraftSelect;
    const unitPrice = parseInt(document.getElementById('edit-sale-price').value) || 0;
    const quantity = parseInt(document.getElementById('edit-quantity').value) || 1;
    const discountRate = parseInt(document.getElementById('edit-discount-rate').value) || 0;
    
    const discountInfo = document.getElementById('edit-discount-info');
    const calculationDetails = document.getElementById('edit-calculation-details');
    
    if (!unitPrice || !quantity) {
        discountInfo.textContent = '';
        calculationDetails.innerHTML = '<small class="text-muted">価格と台数を入力してください</small>';
        return;
    }
    
    // 定価を取得または計算
    const aircraftData = getAircraftPrice(aircraftName);
    let originalPrice = aircraftData;
    
    if (!originalPrice || unitPrice > originalPrice) {
        if (discountRate > 0) {
            originalPrice = Math.round(unitPrice / (1 - discountRate / 100));
        } else {
            originalPrice = unitPrice;
        }
    }
    
    // 複数台購入時の計算
    let totalSalePrice, discountedPrice;
    
    if (discountRate > 0) {
        discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        totalSalePrice = discountedPrice + (originalPrice * (quantity - 1));
        
        const discountAmount = originalPrice - discountedPrice;
        discountInfo.innerHTML = `
            <div class="text-success">
                <i class="fas fa-percentage"></i>
                1台目: ${formatPrice(originalPrice)} → ${formatPrice(discountedPrice)} 
                (${formatPrice(discountAmount)}引き)
            </div>
            ${quantity > 1 ? `<div class="text-muted small">残り${quantity - 1}台は定価</div>` : ''}
        `;
    } else {
        totalSalePrice = unitPrice * quantity;
        discountInfo.textContent = '';
    }
    
    // 利益計算
    const totalCostPrice = (originalPrice * 0.5) * quantity;
    const totalSalesCommission = totalSalePrice * 0.3;
    const totalGrossProfit = totalSalePrice - totalCostPrice;
    const totalDealerProfit = totalGrossProfit - totalSalesCommission;
    
    // 計算結果表示
    calculationDetails.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div><strong>総販売価格:</strong> ${formatPrice(totalSalePrice)}</div>
                <div><strong>仕入れ価格:</strong> ${formatPrice(totalCostPrice)}</div>
                <div><strong>販売員給与:</strong> ${formatPrice(totalSalesCommission)}</div>
            </div>
            <div class="col-md-6">
                <div><strong>粗利益:</strong> ${formatPrice(totalGrossProfit)}</div>
                <div><strong>ディーラー実利益:</strong> 
                    <span class="${totalDealerProfit >= 0 ? 'text-success' : 'text-danger'}">
                        ${formatPrice(totalDealerProfit)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// 編集内容の保存
function saveSaleEdit() {
    const saleId = document.getElementById('edit-sale-id').value;
    const sale = sales.find(s => s.id == saleId);
    
    if (!sale) {
        showErrorToast('販売記録が見つかりません。');
        return;
    }
    
    // フォームから値を取得
    const aircraftSelect = document.getElementById('edit-aircraft-name').value;
    const customAircraft = document.getElementById('edit-custom-aircraft').value;
    const aircraftName = aircraftSelect === 'その他' ? customAircraft : aircraftSelect;
    const unitPrice = parseInt(document.getElementById('edit-sale-price').value);
    const quantity = parseInt(document.getElementById('edit-quantity').value) || 1;
    const discountRate = parseInt(document.getElementById('edit-discount-rate').value) || 0;
    const saleDate = document.getElementById('edit-sale-date').value;
    const salespersonId = document.getElementById('edit-salesperson-select').value;
    
    // バリデーション
    if (!aircraftName || !unitPrice || !saleDate || quantity < 1 || !salespersonId) {
        showErrorToast('すべての項目を正しく入力してください。');
        return;
    }
    
    if (discountRate < 0 || discountRate > 70) {
        showErrorToast('割引率は0%から70%の間で入力してください。');
        return;
    }
    
    // 販売員を検索
    const salesperson = salespeople.find(s => s.id == salespersonId);
    if (!salesperson) {
        showErrorToast('選択された販売員が見つかりません。');
        return;
    }
    
    // 古い利益を金庫から取り消し
    let oldDealerProfit = 0;
    if (sale.totalDealerProfit !== undefined) {
        oldDealerProfit = sale.totalDealerProfit;
    } else {
        // 旧データ構造の場合は計算
        const oldQuantity = sale.quantity || 1;
        const oldTotalPrice = sale.totalPrice || sale.price;
        const oldOriginalPrice = sale.originalPrice || sale.price;
        const oldTotalCostPrice = sale.totalCostPrice || ((oldOriginalPrice * 0.5) * oldQuantity);
        const oldTotalSalesCommission = oldTotalPrice * 0.3;
        const oldTotalGrossProfit = oldTotalPrice - oldTotalCostPrice;
        oldDealerProfit = oldTotalGrossProfit - oldTotalSalesCommission;
    }
    
    // 古い給与記録を削除
    const oldUnpaidSalaryRecords = deleteSalaryRecordsForSale(sale);
    
    // 新しい価格計算
    const aircraftData = getAircraftPrice(aircraftName);
    let originalPrice = aircraftData;
    
    if (!originalPrice || unitPrice > originalPrice) {
        if (discountRate > 0) {
            originalPrice = Math.round(unitPrice / (1 - discountRate / 100));
        } else {
            originalPrice = unitPrice;
        }
    }
    
    // 複数台購入時の計算
    let totalSalePrice, discountedPrice;
    
    if (discountRate > 0) {
        discountedPrice = Math.round(originalPrice * (1 - discountRate / 100));
        totalSalePrice = discountedPrice + (originalPrice * (quantity - 1));
    } else {
        totalSalePrice = unitPrice * quantity;
        discountedPrice = unitPrice;
    }
    
    const totalCostPrice = (originalPrice * 0.5) * quantity;
    const totalSalesCommission = totalSalePrice * 0.3;
    const totalGrossProfit = totalSalePrice - totalCostPrice;
    const totalDealerProfit = totalGrossProfit - totalSalesCommission;
    
    // 金庫から古い利益を取り消し
    const oldQuantityText = (sale.quantity && sale.quantity > 1) ? ` ${sale.quantity}台` : '';
    const oldCashboxDescription = oldDealerProfit >= 0 
        ? `販売記録編集による旧利益取り消し: ${sale.aircraftName}${oldQuantityText}`
        : `販売記録編集による旧損失取り消し: ${sale.aircraftName}${oldQuantityText}`;
    
    removeCashboxAmount(oldDealerProfit, oldCashboxDescription);
    
    // 新しい利益を金庫に追加
    const newQuantityText = quantity > 1 ? ` ${quantity}台` : '';
    const newCashboxDescription = totalDealerProfit >= 0 
        ? `販売記録編集による新利益: ${aircraftName}${newQuantityText}` 
        : `販売記録編集による新損失: ${aircraftName}${newQuantityText}`;
    addToCashbox(totalDealerProfit, newCashboxDescription, saleDate);
    
    // 関連する航空機データを削除
    if (sale.batchId) {
        aircraft = aircraft.filter(a => a.batchId !== sale.batchId);
    } else {
        // 旧データ構造の場合、顧客名と航空機名で検索して削除
        const customer = customers.find(c => c.name === sale.customerName);
        if (customer) {
            aircraft = aircraft.filter(a => !(
                a.customerId === customer.id &&
                a.name === sale.aircraftName
            ));
        }
    }
    
    // 新しい航空機データを作成
    const customer = customers.find(c => c.name === sale.customerName);
    if (customer) {
        for (let i = 0; i < quantity; i++) {
            const unitSalePrice = i === 0 && discountRate > 0 ? discountedPrice : originalPrice;
            const unitCostPrice = originalPrice * 0.5;
            const unitSalesCommission = unitSalePrice * 0.3;
            const unitGrossProfit = unitSalePrice - unitCostPrice;
            const unitDealerProfit = unitGrossProfit - unitSalesCommission;
            
            const aircraftItem = {
                id: Date.now() + Math.random() + i,
                name: aircraftName,
                price: unitSalePrice,
                originalPrice: originalPrice,
                discountRate: i === 0 ? discountRate : 0,
                costPrice: unitCostPrice,
                salesCommission: unitSalesCommission,
                grossProfit: unitGrossProfit,
                dealerProfit: unitDealerProfit,
                customerId: customer.id,
                purchaseDate: saleDate,
                quantity: 1,
                batchId: sale.batchId || Date.now()
            };
            aircraft.push(aircraftItem);
        }
    }
    
    // 販売記録を更新
    sale.aircraftName = aircraftName;
    sale.unitPrice = unitPrice;
    sale.quantity = quantity;
    sale.totalPrice = totalSalePrice;
    sale.originalPrice = originalPrice;
    sale.discountRate = discountRate;
    sale.totalCostPrice = totalCostPrice;
    sale.totalSalesCommission = totalSalesCommission;
    sale.totalGrossProfit = totalGrossProfit;
    sale.totalDealerProfit = totalDealerProfit;
    sale.salespersonId = parseInt(salespersonId); // 数値として保存
    sale.salespersonName = salesperson.name;
    sale.salespersonCommission = totalSalesCommission;
    sale.saleDate = saleDate;
    
    // 新しい給与記録を追加
    if (totalSalesCommission > 0) {
        addSalaryRecord(
            parseInt(salespersonId), 
            totalSalesCommission, 
            `販売給与: ${aircraftName} ${quantity}台 (${sale.customerName})`, 
            saleDate
        );
    }
    
    // データを保存
    saveData();
    
    // 表示を更新
    updateStats();
    renderSalesTable();
    renderAircraftTable();
    renderCashboxHistory();
    updateSalespersonSelect();
    renderSalespeopleTable();
    updateEmploymentStats();
    updateSalaryStats();
    renderSalaryDetails();
    populateAircraftFilterSelect(); // 航空機フィルター選択肢を更新
    
    // 雇用管理が表示されている場合は更新
    if (document.getElementById('employment-section').classList.contains('active')) {
        renderEmploymentHistory();
    }
    
    // モーダルを閉じる
    bootstrap.Modal.getInstance(document.getElementById('editSaleModal')).hide();
    
    // 成功メッセージ
    const quantityText = quantity > 1 ? ` ${quantity}台` : '';
    const discountText = discountRate > 0 ? ` (1台分${discountRate}%OFF適用)` : '';
    const profitText = `新ディーラー実利益: ${formatPrice(totalDealerProfit)}`;
    const salaryText = oldUnpaidSalaryRecords.length > 0 
        ? ` 古い給与記録${formatPrice(oldUnpaidSalaryRecords.reduce((sum, record) => sum + record.amount, 0))}を削除し、新しい給与記録${formatPrice(totalSalesCommission)}を追加しました。`
        : ` 新しい給与記録${formatPrice(totalSalesCommission)}を追加しました。`;
    
    showInfoToast(`${aircraftName}${quantityText}の販売記録が更新されました${discountText}。${profitText}${salaryText}`);
}

// 既存データの販売員情報チェック
function checkAndMigrateSalespersonData() {
    // 販売員が存在しない場合は移行不要
    if (salespeople.length === 0) {
        return;
    }
    
    // 販売員情報が不足している販売記録を検索
    const recordsNeedingMigration = sales.filter(sale => 
        !sale.salespersonId || !sale.salespersonName
    );
    
    if (recordsNeedingMigration.length > 0) {
        // 以前にスキップしたかチェック
        const migrationSkipped = localStorage.getItem('luxury-aircraft-migration-skipped');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000; // 1日のミリ秒
        
        // スキップしていない、または24時間以上経過している場合にモーダルを表示
        if (!migrationSkipped || (now - parseInt(migrationSkipped)) > oneDay) {
            // 少し遅延してモーダルを表示（画面読み込み完了後）
            setTimeout(() => {
                showDataMigrationModal(recordsNeedingMigration);
            }, 1000);
        }
    }
}

// データ移行モーダルの表示
function showDataMigrationModal(recordsNeedingMigration) {
    const container = document.getElementById('migration-records-container');
    
    container.innerHTML = `
        <h6><i class="fas fa-list"></i> 販売員情報が不足している販売記録 (${recordsNeedingMigration.length}件)</h6>
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>販売日</th>
                        <th>顧客名</th>
                        <th>航空機名</th>
                        <th>販売価格</th>
                        <th>担当販売員を選択</th>
                    </tr>
                </thead>
                <tbody>
                    ${recordsNeedingMigration.map(sale => `
                        <tr>
                            <td>${formatDate(sale.saleDate)}</td>
                            <td>${sale.customerName}</td>
                            <td>${sale.aircraftName}</td>
                            <td class="price-tag">${formatPrice(sale.totalPrice || sale.price)}</td>
                            <td>
                                <select class="form-select form-select-sm" id="salesperson-${sale.id}" required>
                                    <option value="">選択してください</option>
                                    ${salespeople.map(person => `
                                        <option value="${person.id}">
                                            ${person.name}${person.status === 'active' ? '' : ' (退職済み)'}
                                        </option>
                                    `).join('')}
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="mt-3">
            <div class="row">
                <div class="col-md-6">
                    <label for="bulk-salesperson-select" class="form-label">一括割り当て:</label>
                    <select class="form-select" id="bulk-salesperson-select">
                        <option value="">販売員を選択...</option>
                        ${salespeople.map(person => `
                            <option value="${person.id}">
                                ${person.name}${person.status === 'active' ? '' : ' (退職済み)'}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="col-md-6">
                    <label class="form-label">&nbsp;</label>
                    <button type="button" class="btn btn-outline-primary d-block" onclick="bulkAssignSalesperson()">
                        <i class="fas fa-users"></i> 全件に一括適用
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // モーダルを表示
    new bootstrap.Modal(document.getElementById('dataMigrationModal')).show();
}

// 一括販売員割り当て
function bulkAssignSalesperson() {
    const bulkSalespersonId = document.getElementById('bulk-salesperson-select').value;
    
    if (!bulkSalespersonId) {
        showErrorToast('販売員を選択してください。');
        return;
    }
    
    // 全ての販売員選択ドロップダウンに適用
    const selects = document.querySelectorAll('[id^="salesperson-"]');
    selects.forEach(select => {
        select.value = bulkSalespersonId;
    });
    
    showInfoToast('全ての販売記録に販売員が割り当てられました。');
}

// データ移行の実行
function executeDataMigration() {
    const recordsNeedingMigration = sales.filter(sale => 
        !sale.salespersonId || !sale.salespersonName
    );
    
    let migrationSuccess = true;
    let totalAdjustment = 0; // 金庫調整額の合計
    
    for (const sale of recordsNeedingMigration) {
        const salespersonSelect = document.getElementById(`salesperson-${sale.id}`);
        const salespersonId = salespersonSelect.value;
        
        if (!salespersonId) {
            showErrorToast(`販売記録「${sale.customerName} - ${sale.aircraftName}」の販売員が選択されていません。`);
            migrationSuccess = false;
            break;
        }
        
        const salesperson = salespeople.find(p => p.id == salespersonId);
        if (!salesperson) {
            showErrorToast('選択された販売員が見つかりません。');
            migrationSuccess = false;
            break;
        }
        
        // 既存の給与計算を修正
        const totalPrice = sale.totalPrice || sale.price;
        const quantity = sale.quantity || 1;
        const originalPrice = sale.originalPrice || sale.price || totalPrice;
        
        // 現在の販売員給与（もしあれば）
        const currentCommission = sale.salespersonCommission || sale.totalSalesCommission || 0;
        
        // 正しい販売員給与を計算
        const correctCommission = totalPrice * 0.3;
        
        // 給与差額を計算
        const commissionDifference = correctCommission - currentCommission;
        
        // ディーラー利益の再計算
        const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
        const totalGrossProfit = totalPrice - totalCostPrice;
        const correctDealerProfit = totalGrossProfit - correctCommission;
        
        // 現在のディーラー利益
        const currentDealerProfit = sale.totalDealerProfit || (totalGrossProfit - currentCommission);
        
        // ディーラー利益の差額
        const profitDifference = correctDealerProfit - currentDealerProfit;
        
        // 販売記録を更新
        sale.salespersonId = parseInt(salespersonId); // 数値として保存
        sale.salespersonName = salesperson.name;
        sale.salespersonCommission = correctCommission;
        sale.totalSalesCommission = correctCommission;
        sale.totalDealerProfit = correctDealerProfit;
        
        // 互換性のため、追加フィールドも設定
        if (!sale.totalPrice && sale.price) {
            sale.totalPrice = sale.price;
        }
        
        // 金庫調整額を累積
        totalAdjustment += profitDifference;
    }
    
    if (!migrationSuccess) {
        return;
    }
    
    // 金庫残高を調整
    if (totalAdjustment !== 0) {
        const adjustmentDescription = totalAdjustment < 0 
            ? `既存データ移行による利益減額: 販売員給与適用 (${recordsNeedingMigration.length}件)`
            : `既存データ移行による利益増額: 販売員給与適用 (${recordsNeedingMigration.length}件)`;
        
        addToCashbox(totalAdjustment, adjustmentDescription);
    }
    
    // データを保存
    saveData();
    
    // 表示を更新
    updateStats();
    renderSalesTable();
    renderSalespeopleTable();
    updateEmploymentStats();
    renderCashboxHistory();
    populateAircraftFilterSelect(); // 航空機フィルター選択肢を更新
    
    // ダッシュボードも更新
    if (document.getElementById('dashboard-section').classList.contains('active')) {
        renderDashboard();
    }
    
    // モーダルを閉じる
    bootstrap.Modal.getInstance(document.getElementById('dataMigrationModal')).hide();
    
    // スキップフラグをクリア
    localStorage.removeItem('luxury-aircraft-migration-skipped');
    
    // 成功メッセージ
    const adjustmentText = totalAdjustment !== 0 
        ? ` 金庫残高を${formatPrice(Math.abs(totalAdjustment))}${totalAdjustment > 0 ? '増額' : '減額'}しました。`
        : '';
    
    showInfoToast(`${recordsNeedingMigration.length}件の販売記録に販売員情報を適用しました。${adjustmentText}`);
}

// データ移行のスキップ
function skipDataMigration() {
    // 移行を後で行うことをローカルストレージに記録
    localStorage.setItem('luxury-aircraft-migration-skipped', Date.now().toString());
    
    // モーダルを閉じる
    bootstrap.Modal.getInstance(document.getElementById('dataMigrationModal')).hide();
    
    showInfoToast('データ移行をスキップしました。販売履歴画面で「データ移行」ボタンから後で実行できます。');
}

// 手動でデータ移行を開始
function startManualDataMigration() {
    // 販売員が存在しない場合
    if (salespeople.length === 0) {
        showErrorToast('先に販売員を雇用してください。');
        return;
    }
    
    // データ整合性をチェック
    const fixedCount = checkAndFixDataIntegrity();
    
    // 販売員情報が不足している販売記録を検索
    const recordsNeedingMigration = sales.filter(sale => 
        !sale.salespersonId || !sale.salespersonName
    );
    
    if (recordsNeedingMigration.length === 0) {
        if (fixedCount > 0) {
            showInfoToast(`データ整合性を修正しました (${fixedCount}件)。すべての販売記録に販売員情報が設定済みです。`);
            // 表示を更新
            renderSalespeopleTable();
            updateEmploymentStats();
        } else {
            showInfoToast('すべての販売記録に販売員情報が設定済みです。');
        }
        return;
    }
    
    // データ移行モーダルを表示
    showDataMigrationModal(recordsNeedingMigration);
}

// データ整合性をチェックして修正
function checkAndFixDataIntegrity() {
    let fixedCount = 0;
    
    sales.forEach(sale => {
        let modified = false;
        
        // 販売員IDが文字列の場合は数値に変換
        if (sale.salespersonId && typeof sale.salespersonId === 'string') {
            sale.salespersonId = parseInt(sale.salespersonId);
            modified = true;
        }
        
        // 販売員給与が設定されていない場合は計算
        if (sale.salespersonId && !sale.salespersonCommission && !sale.totalSalesCommission) {
            const revenue = sale.totalPrice || sale.price || 0;
            sale.salespersonCommission = revenue * 0.3;
            sale.totalSalesCommission = revenue * 0.3;
            modified = true;
        }
        
        // totalPriceが設定されていない場合はpriceから設定
        if (!sale.totalPrice && sale.price) {
            sale.totalPrice = sale.price;
            modified = true;
        }
        
        // 販売員名が設定されていない場合は設定
        if (sale.salespersonId && !sale.salespersonName) {
            const salesperson = salespeople.find(p => p.id == sale.salespersonId);
            if (salesperson) {
                sale.salespersonName = salesperson.name;
                modified = true;
            }
        }
        
        if (modified) {
            fixedCount++;
        }
    });
    
    if (fixedCount > 0) {
        saveData();
        console.log(`${fixedCount}件の販売記録のデータ整合性を修正しました。`);
        
        // 統計を更新
        updateStats();
        updateEmploymentStats();
        
        // 販売員テーブルが表示されている場合は更新
        if (document.getElementById('salespeople-section').classList.contains('active')) {
            renderSalespeopleTable();
        }
        
        // 雇用管理が表示されている場合は更新
        if (document.getElementById('employment-section').classList.contains('active')) {
            renderEmploymentHistory();
        }
    }
    
    return fixedCount;
}

// 顧客一覧用の航空機フィルター選択肢を生成
function populateAircraftFilterSelect() {
    const select = document.getElementById('aircraft-filter');
    if (!select) return;
    
    // 既存のオプションをクリア（最初のオプションは残す）
    select.innerHTML = '<option value="">すべての顧客</option>';
    
    // 実際に所有されている航空機のリストを取得
    const ownedAircraftNames = [...new Set(aircraft.map(a => a.name))].sort();
    
    if (ownedAircraftNames.length > 0) {
        ownedAircraftNames.forEach(aircraftName => {
            const option = document.createElement('option');
            option.value = aircraftName;
            option.textContent = aircraftName;
            select.appendChild(option);
        });
    }
}

// 航空機フィルターの変更処理
function handleAircraftFilter() {
    const select = document.getElementById('aircraft-filter');
    currentAircraftFilter = select.value;
    
    // 所有状況フィルターを有効化/無効化
    const ownershipSelect = document.getElementById('ownership-filter');
    if (currentAircraftFilter) {
        ownershipSelect.disabled = false;
    } else {
        ownershipSelect.disabled = false;
        ownershipSelect.value = 'all';
        currentOwnershipFilter = 'all';
    }
    
    // 顧客テーブルを再描画
    renderCustomersTable();
    
    // 検索結果を表示
    updateAircraftSearchResult();
}

// 所有状況フィルターの変更処理
function handleOwnershipFilter() {
    const select = document.getElementById('ownership-filter');
    currentOwnershipFilter = select.value;
    
    // 顧客テーブルを再描画
    renderCustomersTable();
    
    // 検索結果を表示
    updateAircraftSearchResult();
}

// 航空機検索結果の表示を更新
function updateAircraftSearchResult() {
    const resultDiv = document.getElementById('aircraft-search-result');
    
    if (!currentAircraftFilter) {
        resultDiv.style.display = 'none';
        return;
    }
    
    // 該当する顧客を検索
    const owners = customers.filter(customer => {
        const customerAircraft = aircraft.filter(a => a.customerId === customer.id);
        return customerAircraft.some(a => a.name === currentAircraftFilter);
    });
    
    const nonOwners = customers.filter(customer => {
        const customerAircraft = aircraft.filter(a => a.customerId === customer.id);
        return !customerAircraft.some(a => a.name === currentAircraftFilter);
    });
    
    let resultText = `<i class="fas fa-search"></i> 「${currentAircraftFilter}」の検索結果: `;
    
    if (currentOwnershipFilter === 'all') {
        resultText += `所有者 ${owners.length}名、非所有者 ${nonOwners.length}名`;
    } else if (currentOwnershipFilter === 'owner') {
        resultText += `所有者 ${owners.length}名を表示中`;
    } else if (currentOwnershipFilter === 'non-owner') {
        resultText += `非所有者 ${nonOwners.length}名を表示中`;
    }
    
    resultDiv.innerHTML = resultText;
    resultDiv.style.display = 'block';
}

// 顧客が特定の航空機を所有しているかチェック
function customerOwnsAircraft(customerId, aircraftName) {
    const customerAircraft = aircraft.filter(a => a.customerId === customerId);
    return customerAircraft.some(a => a.name === aircraftName);
}

// フィルター条件に基づいて顧客をフィルタリング
function filterCustomers(customersArray) {
    let filteredCustomers = [...customersArray];
    
    // 航空機フィルターが設定されている場合
    if (currentAircraftFilter) {
        if (currentOwnershipFilter === 'owner') {
            // 所有者のみ
            filteredCustomers = filteredCustomers.filter(customer => 
                customerOwnsAircraft(customer.id, currentAircraftFilter)
            );
        } else if (currentOwnershipFilter === 'non-owner') {
            // 非所有者のみ
            filteredCustomers = filteredCustomers.filter(customer => 
                !customerOwnsAircraft(customer.id, currentAircraftFilter)
            );
        }
        // 'all'の場合はフィルタリングしない
    }
    
    return filteredCustomers;
}

// 在庫管理関連の関数

// 在庫一覧の表示
function renderInventoryTable() {
    const inventoryTable = document.getElementById('inventory-table');
    
    if (!inventoryTable) return;
    
    if (inventory.length === 0) {
        inventoryTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center empty-data">
                    <i class="fas fa-warehouse"></i>
                    <h6>在庫がありません</h6>
                    <p>在庫車両を追加してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    inventoryTable.innerHTML = inventory.map(item => {
        const isFreeStock = item.isFreeStock || item.purchasePrice === 0;
        const rowClass = isFreeStock ? 'table-warning' : '';
        
        // 販売価格（定価）を取得
        const aircraftData = aircraftDatabase.find(a => a.name === item.aircraftName);
        const salePrice = aircraftData ? aircraftData.price : 0;
        
        // 価格表示（無償在庫の場合は仕入価格無償 + 販売価格を表示）
        let priceDisplay;
        if (isFreeStock) {
            priceDisplay = `
                <span class="text-warning">無償</span>
                <small class="text-muted d-block">販売価格: ${formatPrice(salePrice)}</small>
            `;
        } else {
            priceDisplay = `
                ${formatPrice(item.purchasePrice)}
                <small class="text-muted d-block">販売価格: ${formatPrice(salePrice)}</small>
            `;
        }
        
        return `
            <tr class="${rowClass}">
                <td>
                    <strong>${item.aircraftName}</strong>
                    <small class="text-muted d-block">${item.category || 'その他'}</small>
                </td>
                <td>
                    <span class="badge bg-primary">${item.quantity}台</span>
                </td>
                <td class="price-tag">${priceDisplay}</td>
                <td>${formatDate(item.date)}</td>
                <td>
                    ${isFreeStock ? '<span class="badge bg-warning text-dark"><i class="fas fa-gift"></i> 無償在庫</span>' : '<span class="badge bg-info">通常在庫</span>'}
                </td>
                <td>
                    <span class="text-muted">${item.notes || 'メモなし'}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteInventoryItem('${item.id}')">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 在庫統計の更新
function updateInventoryStats() {
    const inventoryCountElement = document.getElementById('inventory-count');
    const inventoryValueElement = document.getElementById('inventory-value');
    const inventoryCostElement = document.getElementById('inventory-cost');
    
    if (!inventoryCountElement || !inventoryValueElement) return;
    
    const totalCount = inventory.reduce((sum, item) => sum + item.quantity, 0);
    
    // 在庫価値は販売価格（定価）ベースで計算
    const totalValue = inventory.reduce((sum, item) => {
        const aircraftData = aircraftDatabase.find(a => a.name === item.aircraftName);
        const salePrice = aircraftData ? aircraftData.price : 0;
        return sum + (salePrice * item.quantity);
    }, 0);
    
    // 仕入コストは実際の仕入価格で計算
    const totalCost = inventory.reduce((sum, item) => {
        return sum + (item.purchasePrice * item.quantity);
    }, 0);
    
    inventoryCountElement.textContent = totalCount + '台';
    inventoryValueElement.textContent = formatPrice(totalValue);
    
    if (inventoryCostElement) {
        inventoryCostElement.textContent = formatPrice(totalCost);
    }
}

// 在庫追加フォームの処理
function handleInventorySubmit(e) {
    e.preventDefault();
    
    const aircraftName = document.getElementById('inventory-aircraft-name').value;
    const quantity = parseInt(document.getElementById('inventory-quantity').value);
    const purchasePrice = parseInt(document.getElementById('inventory-purchase-price').value);
    const date = document.getElementById('inventory-date').value;
    const notes = document.getElementById('inventory-notes').value.trim();
    const isFreeStock = document.getElementById('inventory-free-stock').checked;
    
    if (!aircraftName || !quantity || (!isFreeStock && !purchasePrice) || !date) {
        showErrorToast('必須項目を入力してください。');
        return;
    }
    
    if (quantity <= 0 || purchasePrice < 0) {
        showErrorToast('数量と価格は正の数値で入力してください。');
        return;
    }
    
    // 無償在庫の場合は仕入価格を0にする
    const actualPurchasePrice = isFreeStock ? 0 : purchasePrice;
    
    // 既存の在庫アイテムをチェック
    const existingItem = inventory.find(item => 
        item.aircraftName === aircraftName && 
        item.purchasePrice === actualPurchasePrice &&
        item.notes === notes &&
        item.isFreeStock === isFreeStock
    );
    
    if (existingItem) {
        // 既存のアイテムがある場合は数量を追加
        existingItem.quantity += quantity;
    } else {
        // 新しいアイテムとして追加
        const aircraftData = aircraftDatabase.find(a => a.name === aircraftName);
        
        const newInventoryItem = {
            id: Date.now().toString(),
            aircraftName: aircraftName,
            category: aircraftData ? aircraftData.category : 'その他',
            quantity: quantity,
            purchasePrice: actualPurchasePrice,
            isFreeStock: isFreeStock,
            date: date,
            notes: notes
        };
        
        inventory.push(newInventoryItem);
    }
    
    // 無償在庫でない場合のみ金庫から仕入れ費用を出金
    if (!isFreeStock) {
        const totalCost = actualPurchasePrice * quantity;
        addToCashbox(-totalCost, `在庫仕入れ: ${aircraftName} ${quantity}台`, date);
    }
    
    saveData();
    renderInventoryTable();
    updateInventoryStats();
    updateStats();
    
    // フォームをクリア
    clearInventoryForm();
    
    const stockTypeText = isFreeStock ? '（無償在庫）' : '';
    showInfoToast(`${aircraftName} ${quantity}台を在庫に追加しました${stockTypeText}。`);
}

// 在庫削除
function deleteInventoryItem(itemId) {
    const itemIndex = inventory.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    const item = inventory[itemIndex];
    const isFreeStock = item.isFreeStock || item.purchasePrice === 0;
    const stockTypeText = isFreeStock ? '（無償在庫）' : '';
    
    if (confirm(`${item.aircraftName} ${item.quantity}台${stockTypeText}を在庫から削除しますか？`)) {
        // 無償在庫でない場合のみ金庫に仕入れ費用を戻す
        if (!isFreeStock) {
            const totalCost = item.purchasePrice * item.quantity;
            addToCashbox(totalCost, `在庫削除: ${item.aircraftName} ${item.quantity}台`);
        }
        
        inventory.splice(itemIndex, 1);
        
        saveData();
        renderInventoryTable();
        updateInventoryStats();
        updateStats();
        
        showInfoToast(`${item.aircraftName} ${item.quantity}台${stockTypeText}を在庫から削除しました。`);
    }
}

// 在庫フォームをクリア
function clearInventoryForm() {
    document.getElementById('inventory-form').reset();
    document.getElementById('inventory-aircraft-info').textContent = '航空機を選択してください';
    document.getElementById('inventory-price-info').textContent = '';
    
    // 無償在庫チェックボックスのリセット
    document.getElementById('inventory-free-stock').checked = false;
    document.getElementById('inventory-purchase-price').disabled = false;
    
    // 現在の日時を仕入日のデフォルト値に設定
    const now = new Date();
    document.getElementById('inventory-date').value = now.toISOString().slice(0, 16);
}

// 在庫から特定の航空機を取得
function getInventoryItem(aircraftName) {
    return inventory.find(item => 
        item.aircraftName === aircraftName && 
        item.quantity > 0
    );
}

// 在庫から航空機を消費
function consumeInventoryItem(aircraftName, quantity = 1) {
    const item = getInventoryItem(aircraftName);
    if (!item) return false;
    
    if (item.quantity < quantity) return false;
    
    item.quantity -= quantity;
    
    // 在庫が0になったら削除
    if (item.quantity <= 0) {
        const itemIndex = inventory.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            inventory.splice(itemIndex, 1);
        }
    }
    
    saveData();
    renderInventoryTable();
    updateInventoryStats();
    
    return true;
}

// 在庫の航空機選択肢を生成
function populateInventoryAircraftSelect() {
    const select = document.getElementById('inventory-aircraft-name');
    
    if (!select) return;
    
    // 既存の選択肢をクリア（デフォルトオプション以外）
    select.innerHTML = '<option value="">選択してください</option>';
    
    // カテゴリー別にグループ化
    const categories = {};
    aircraftDatabase.forEach(aircraft => {
        if (!categories[aircraft.category]) {
            categories[aircraft.category] = [];
        }
        categories[aircraft.category].push(aircraft);
    });
    
    // カテゴリー別にオプションを追加
    Object.keys(categories).forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categories[category].forEach(aircraft => {
            const option = document.createElement('option');
            option.value = aircraft.name;
            option.textContent = aircraft.name;
            optgroup.appendChild(option);
        });
        
        select.appendChild(optgroup);
    });
}

// 在庫の航空機変更時の処理
function handleInventoryAircraftChange(e) {
    const aircraftName = e.target.value;
    const aircraftInfoElement = document.getElementById('inventory-aircraft-info');
    const priceInfoElement = document.getElementById('inventory-price-info');
    const purchasePriceElement = document.getElementById('inventory-purchase-price');
    const freeStockCheckbox = document.getElementById('inventory-free-stock');
    
    if (!aircraftName) {
        aircraftInfoElement.textContent = '航空機を選択してください';
        priceInfoElement.textContent = '';
        purchasePriceElement.value = '';
        return;
    }
    
    const aircraftData = aircraftDatabase.find(a => a.name === aircraftName);
    
    if (aircraftData) {
        const suggestedPrice = Math.floor(aircraftData.price * 0.5); // 定価の50%を推奨
        aircraftInfoElement.innerHTML = `
            <strong>カテゴリ:</strong> ${aircraftData.category}<br>
            <strong>定価:</strong> ${formatPrice(aircraftData.price)}
        `;
        
        // 無償在庫がチェックされていない場合のみ価格を設定
        if (!freeStockCheckbox.checked) {
            priceInfoElement.innerHTML = `推奨仕入価格: ${formatPrice(suggestedPrice)} (定価の50%)`;
            purchasePriceElement.value = suggestedPrice;
        }
    } else {
        aircraftInfoElement.textContent = '航空機情報が見つかりません';
        if (!freeStockCheckbox.checked) {
            priceInfoElement.textContent = '';
            purchasePriceElement.value = '';
        }
    }
}

// 無償在庫チェックボックスの処理
function handleFreeStockChange() {
    const freeStockCheckbox = document.getElementById('inventory-free-stock');
    const purchasePriceElement = document.getElementById('inventory-purchase-price');
    const priceInfoElement = document.getElementById('inventory-price-info');
    
    if (freeStockCheckbox.checked) {
        // 無償在庫の場合
        purchasePriceElement.value = '0';
        purchasePriceElement.disabled = true;
        priceInfoElement.innerHTML = `<span class="text-warning"><i class="fas fa-gift"></i> 無償在庫: 仕入価格0円</span>`;
    } else {
        // 通常在庫の場合
        purchasePriceElement.disabled = false;
        
        // 航空機が選択されている場合は推奨価格を再設定
        const aircraftSelect = document.getElementById('inventory-aircraft-name');
        if (aircraftSelect.value) {
            const aircraftData = aircraftDatabase.find(a => a.name === aircraftSelect.value);
            if (aircraftData) {
                const suggestedPrice = Math.floor(aircraftData.price * 0.5);
                purchasePriceElement.value = suggestedPrice;
                priceInfoElement.innerHTML = `推奨仕入価格: ${formatPrice(suggestedPrice)} (定価の50%)`;
            }
        } else {
            purchasePriceElement.value = '';
            priceInfoElement.textContent = '';
        }
    }
}

// ==================== 給与管理機能 ====================

// 給与記録を追加（Discordのリアクションに対応）
function addSalaryRecord(salespersonId, amount, description, date = null) {
    const record = {
        id: Date.now() + Math.random(),
        salespersonId: salespersonId,
        amount: amount,
        description: description,
        date: date || getJapanISOString(),
        paid: false // 未払い状態
    };
    
    salaryRecords.push(record);
    saveData();
    updateSalaryStats();
    renderSalaryDetails();
    
    return record.id;
}

// 給与統計の更新
function updateSalaryStats() {
    const totalPendingSalaryElement = document.getElementById('total-pending-salary');
    const payAllSalariesBtn = document.getElementById('pay-all-salaries-btn');
    
    if (totalPendingSalaryElement) {
        const totalPending = salaryRecords
            .filter(record => !record.paid)
            .reduce((sum, record) => sum + record.amount, 0);
        
        totalPendingSalaryElement.textContent = formatPrice(totalPending);
        
        // 未払い給与がある場合のみボタンを有効化
        if (payAllSalariesBtn) {
            payAllSalariesBtn.disabled = totalPending === 0;
            payAllSalariesBtn.className = totalPending === 0 ? 
                'btn btn-secondary btn-sm' : 'btn btn-success btn-sm';
        }
    }
}

// 給与詳細の描画
function renderSalaryDetails() {
    const salaryDetailsElement = document.getElementById('salary-details');
    
    if (!salaryDetailsElement) return;
    
    const pendingRecords = salaryRecords.filter(record => !record.paid);
    
    if (pendingRecords.length === 0) {
        salaryDetailsElement.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-check-circle fa-2x mb-2"></i>
                <p class="mb-0">未払い給与はありません</p>
            </div>
        `;
        return;
    }
    
    // 販売員別にグループ化
    const recordsBySalesperson = {};
    pendingRecords.forEach(record => {
        const salesperson = salespeople.find(s => s.id == record.salespersonId);
        if (salesperson) {
            if (!recordsBySalesperson[salesperson.name]) {
                recordsBySalesperson[salesperson.name] = [];
            }
            recordsBySalesperson[salesperson.name].push(record);
        }
    });
    
    let html = '<div class="small">';
    Object.keys(recordsBySalesperson).forEach(salespersonName => {
        const records = recordsBySalesperson[salespersonName];
        const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
        
        html += `
            <div class="mb-2 p-2 border rounded">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${salespersonName}</strong>
                    <span class="badge bg-warning">${formatPrice(totalAmount)}</span>
                </div>
                <div class="small text-muted">
                    ${records.length}件の給与記録
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    salaryDetailsElement.innerHTML = html;
}

// 全員の給与を一括支払い
function payAllSalaries() {
    const pendingRecords = salaryRecords.filter(record => !record.paid);
    
    if (pendingRecords.length === 0) {
        showInfoToast('支払うべき給与がありません。');
        return;
    }
    
    const totalAmount = pendingRecords.reduce((sum, record) => sum + record.amount, 0);
    
    if (confirm(`全員の未払い給与 ${formatPrice(totalAmount)} を支払済みとして記録しますか？\n\n※販売追加時に既に給与分は金庫から差し引かれているため、金庫からの支払いは行われません。`)) {
        // すべての未払い給与を支払済みに変更（金庫からは差し引かない）
        pendingRecords.forEach(record => {
            record.paid = true;
            record.paidDate = getJapanISOString();
        });
        
        saveData();
        updateSalaryStats();
        renderSalaryDetails();
        renderSalespeopleTable();
        updateEmploymentStats();
        
        showSuccessToast(`全員の給与 ${formatPrice(totalAmount)} を支払済みとして記録しました。`);
    }
}

// 販売員テーブルの描画を更新（未払い給与を追加）
function renderSalespeopleTable() {
    const salespeopleTable = document.getElementById('salespeople-table');
    
    if (!salespeopleTable) return;
    
    if (salespeople.length === 0) {
        salespeopleTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center empty-data">
                    <i class="fas fa-user-tie"></i>
                    <h6>販売員がいません</h6>
                    <p>雇用管理から新しい販売員を雇用してください。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    salespeopleTable.innerHTML = salespeople.map(person => {
        const salesData = getSalespersonStatistics(person.id);
        const pendingSalary = getPendingSalary(person.id);
        const statusClass = person.status === 'active' ? 'text-success' : 'text-danger';
        const statusText = person.status === 'active' ? '在籍' : '退職';
        
        return `
            <tr>
                <td>${person.name}</td>
                <td>${formatDate(person.employmentDate)}</td>
                <td>
                    <span class="badge bg-primary">${salesData.totalSales}件</span>
                    <div class="small text-muted">${formatPrice(salesData.totalRevenue)}</div>
                </td>
                <td class="price-tag text-warning">
                    ${formatPrice(pendingSalary)}
                    ${pendingSalary > 0 ? '<i class="fas fa-exclamation-triangle text-warning ms-1"></i>' : ''}
                </td>
                <td class="price-tag">${formatPrice(salesData.totalCommission)}</td>
                <td>
                    <span class="badge ${person.status === 'active' ? 'bg-success' : 'bg-danger'}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="showSalespersonDetail(${person.id})">
                        <i class="fas fa-eye"></i> 詳細
                    </button>
                    ${person.status === 'active' ? `
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="fireSalesperson(${person.id})">
                            <i class="fas fa-user-times"></i> 解雇
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// 販売員の未払い給与を取得
function getPendingSalary(salespersonId) {
    return salaryRecords
        .filter(record => record.salespersonId == salespersonId && !record.paid)
        .reduce((sum, record) => sum + record.amount, 0);
}

// 販売記録に関連する給与記録を削除
function deleteSalaryRecordsForSale(sale) {
    const relatedSalaryRecords = salaryRecords.filter(record => {
        // 販売記録の情報と一致する給与記録を検索
        const saleInfo = `${sale.aircraftName} ${sale.quantity || 1}台 (${sale.customerName})`;
        return record.salespersonId == sale.salespersonId && 
               record.description.includes(sale.aircraftName) &&
               record.description.includes(sale.customerName);
    });
    
    // 未払いの給与記録のみ削除（支払済みは残す）
    const unpaidSalaryRecords = relatedSalaryRecords.filter(record => !record.paid);
    salaryRecords = salaryRecords.filter(record => !unpaidSalaryRecords.includes(record));
    
    return unpaidSalaryRecords;
}

// 販売員詳細表示を更新（給与情報を追加）
function showSalespersonDetail(salespersonId) {
    const person = salespeople.find(p => p.id === salespersonId);
    if (!person) return;
    
    const salesData = getSalespersonStatistics(salespersonId);
    const pendingSalary = getPendingSalary(salespersonId);
    const paidSalary = salaryRecords
        .filter(record => record.salespersonId == salespersonId && record.paid)
        .reduce((sum, record) => sum + record.amount, 0);
    
    const salespersonSales = sales.filter(sale => 
        sale.salespersonId == salespersonId || 
        (sale.salespersonId && sale.salespersonId.toString() === salespersonId.toString())
    );
    
    let detailHtml = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-user"></i> 基本情報</h6>
                <table class="table table-sm">
                    <tr><td>名前</td><td>${person.name}</td></tr>
                    <tr><td>雇用日</td><td>${formatDate(person.employmentDate)}</td></tr>
                    <tr><td>雇用状態</td><td>
                        <span class="badge ${person.status === 'active' ? 'bg-success' : 'bg-danger'}">
                            ${person.status === 'active' ? '在籍' : '退職'}
                        </span>
                    </td></tr>
                    ${person.note ? `<tr><td>メモ</td><td>${person.note}</td></tr>` : ''}
                </table>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-chart-line"></i> 売上統計</h6>
                <table class="table table-sm">
                    <tr><td>総売上件数</td><td><span class="badge bg-primary">${salesData.totalSales}件</span></td></tr>
                    <tr><td>総売上額</td><td class="price-tag">${formatPrice(salesData.totalRevenue)}</td></tr>
                    <tr><td>総給与額</td><td class="price-tag">${formatPrice(salesData.totalCommission)}</td></tr>
                    <tr><td>未払い給与</td><td class="price-tag text-warning">${formatPrice(pendingSalary)}</td></tr>
                    <tr><td>支払済み給与</td><td class="price-tag text-success">${formatPrice(paidSalary)}</td></tr>
                </table>
            </div>
        </div>
    `;
    
    if (salespersonSales.length > 0) {
        detailHtml += `
            <div class="mt-3">
                <h6><i class="fas fa-history"></i> 販売履歴</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>日付</th>
                                <th>顧客</th>
                                <th>航空機</th>
                                <th>売上額</th>
                                <th>給与額</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salespersonSales.map(sale => {
                                const commission = sale.salespersonCommission || sale.totalSalesCommission || ((sale.totalPrice || sale.price || 0) * 0.3);
                                return `
                                    <tr>
                                        <td>${formatDate(sale.date)}</td>
                                        <td>${sale.customerName}</td>
                                        <td>${sale.aircraftName}</td>
                                        <td class="price-tag">${formatPrice(sale.totalPrice || sale.price || 0)}</td>
                                        <td class="price-tag">${formatPrice(commission)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // モーダルを表示
    const modal = new bootstrap.Modal(document.getElementById('customerModal'));
    document.getElementById('customer-modal-content').innerHTML = detailHtml;
    modal.show();
}

