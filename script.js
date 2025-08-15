// ========== 共有・同期機能の設定 ==========

// Firebase設定
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "luxury-aircraft-data.firebaseapp.com",
    databaseURL: "https://luxury-aircraft-data-default-rtdb.firebaseio.com",
    projectId: "luxury-aircraft-data",
    storageBucket: "luxury-aircraft-data.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 共有機能関連の変数
let isOnline = false;
let storeCode = 'LUXURY-AIRCRAFT'; // 固定店舗コード
let onlineUsers = 1;
let firebaseApp = null;
let database = null;
let listeners = {};

// GitHub Gist同期機能の変数
let gistId = null;
let githubToken = null;

// リアルタイム保存用
let saveTimeout = null;

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
            return sortedCustomers.sort((a, b) => {
                const aKey = a.reading || a.name;
                const bKey = b.reading || b.name;
                return aKey.localeCompare(bKey, 'ja', { numeric: true });
            });
        case 'name-desc':
            return sortedCustomers.sort((a, b) => {
                const aKey = a.reading || a.name;
                const bKey = b.reading || b.name;
                return bKey.localeCompare(aKey, 'ja', { numeric: true });
            });
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
    populateInventoryManagementAircraftSelect(); // 在庫管理用の航空機選択肢を生成
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
    
    // 既存顧客データに読み仮名フィールドを追加
    migrateCustomerReadingField();
    
    // 新しい計算方法への自動移行チェック
    if (sales.length > 0) {
        const needsMigration = sales.some(sale => !sale.calculationMigrated);
        if (needsMigration) {
            console.log('新しい計算方法への移行が必要です');
            // 自動移行（サイレント）
            migrateSalesCalculationMethod();
            saveData();
        }
    }
    
    // 給与統計の初期化
    updateSalaryStats();
    renderSalaryDetails();
    
    // 共有・同期機能の初期化
    initializeFirebase();
    setupStoreConnection();
    setupGistSync();
    setupRealTimeSave();
    
    // 保存されたURLの読み込み
    setTimeout(() => {
        loadSavedUrls();
        updateSyncStatus();
    }, 1000);
    
    // デモ用：販売員が存在しない場合はデモ販売員を作成
    if (salespeople.length === 0) {
        const demoSalesperson = {
            id: Date.now(),
            name: 'デモ販売員',
            employmentDate: getJapanDateString(),
            note: 'システム初期化時に自動作成',
            status: 'active'
        };
        salespeople.push(demoSalesperson);
        console.log('デモ販売員を作成しました:', demoSalesperson);
    }
    
    // デモ用：顧客が存在しない場合はデモ顧客を作成
    if (customers.length === 0) {
        const demoCustomer = {
            id: Date.now() + 1,
            name: 'デモ顧客',
            reading: 'でもこきゃく',
            registrationDate: getJapanDateString(),
            note: 'システム初期化時に自動作成'
        };
        customers.push(demoCustomer);
        console.log('デモ顧客を作成しました:', demoCustomer);
    }
    
    // データを保存
    if (salespeople.length > 0 || customers.length > 0) {
        saveData();
    }
    
    // デモ用：テスト給与記録の追加（開発時のみ）
    if (salaryRecords.length === 0 && salespeople.length > 0) {
        console.log('テスト給与記録を作成します');
        addSalaryRecord(salespeople[0].id, 50000, 'テスト販売給与', getJapanISOString());
    }
    
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
    } else {
        // 金庫データがない場合は販売履歴から再構築
        initializeCashboxFromSales();
    }
    if (savedSalaryRecords) {
        salaryRecords = JSON.parse(savedSalaryRecords);
    } else {
        // 給与記録がない場合は販売履歴から再構築
        initializeSalaryFromSales();
    }
}

// 販売履歴から金庫残高を再構築する関数
function initializeCashboxFromSales() {
    console.log('金庫データを販売履歴から再構築しています...');
    
    // 金庫データを初期化
    cashbox = {
        balance: 0,
        history: []
    };
    
    // 販売履歴を日付順にソート
    const sortedSales = [...sales].sort((a, b) => 
        new Date(a.saleDate || a.purchaseDate) - new Date(b.saleDate || b.purchaseDate)
    );
    
    // 各販売から利益を計算して金庫に追加
    sortedSales.forEach(sale => {
        let dealerProfit = 0;
        let description = '';
        
        if (sale.totalDealerProfit !== undefined) {
            // 新しいデータ構造
            dealerProfit = sale.totalDealerProfit;
            const quantity = sale.quantity || 1;
            const quantityText = quantity > 1 ? ` ${quantity}台` : '';
            description = dealerProfit >= 0 
                ? `販売による利益: ${sale.aircraftName}${quantityText}` 
                : `販売による損失: ${sale.aircraftName}${quantityText}`;
        } else {
            // 旧データ構造から計算
            const originalPrice = sale.originalPrice || sale.price;
            const costPrice = originalPrice * 0.5;
            const salesPrice = sale.totalPrice || sale.price;
            const salesCommission = salesPrice * 0.3;
            dealerProfit = salesPrice - costPrice - salesCommission;
            
            const quantity = sale.quantity || 1;
            const quantityText = quantity > 1 ? ` ${quantity}台` : '';
            description = dealerProfit >= 0 
                ? `販売による利益: ${sale.aircraftName || sale.name}${quantityText}` 
                : `販売による損失: ${sale.aircraftName || sale.name}${quantityText}`;
        }
        
        // 金庫に追加（履歴も作成）
        const saleDate = sale.saleDate || sale.purchaseDate;
        addToCashbox(dealerProfit, description, saleDate);
    });
    
    console.log(`金庫再構築完了: 残高 ${formatPrice(cashbox.balance)}, 履歴件数 ${cashbox.history.length}`);
    saveData();
}

// 新しい計算方法で金庫データを再構築する関数
function migrateCashboxWithNewCalculation() {
    console.log('金庫データを新しい利益計算方法で再構築しています...');
    
    // 現在の金庫データをバックアップ
    const backupBalance = cashbox.balance;
    const backupHistory = [...cashbox.history];
    
    // 金庫を初期化
    cashbox = {
        balance: 0,
        history: []
    };
    
    // 販売履歴を日付順にソート
    const sortedSales = [...sales].sort((a, b) => 
        new Date(a.saleDate || a.purchaseDate) - new Date(b.saleDate || b.purchaseDate)
    );

    sortedSales.forEach(sale => {
        const quantity = sale.quantity || 1;
        const quantityText = quantity > 1 ? ` ${quantity}台` : '';
        
        let dealerProfit = 0;
        
        if (sale.totalDealerProfit !== undefined && sale.calculationMigrated) {
            // 既に新しい計算方法で計算済み
            dealerProfit = sale.totalDealerProfit;
        } else {
            // 新しい計算方法で利益を計算
            const originalPrice = sale.originalPrice || sale.unitPrice || (sale.totalPrice / quantity);
            const totalSalePrice = sale.totalPrice || (sale.unitPrice * quantity);
            const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
            const totalSalesCommission = sale.isGift ? 0 : (originalPrice * quantity * 0.3);
            
            dealerProfit = totalSalePrice - totalCostPrice - totalSalesCommission;
        }
        
        // 金庫に利益を追加
        const inventoryText = '';
        const description = sale.isGift 
            ? `プレゼント提供による損失: ${sale.aircraftName}${quantityText}${inventoryText}` 
            : (dealerProfit >= 0 
                ? `販売による利益: ${sale.aircraftName}${quantityText}${inventoryText}` 
                : `販売による損失: ${sale.aircraftName}${quantityText}${inventoryText}`);
        
        const saleDate = sale.saleDate || sale.purchaseDate;
        addToCashbox(dealerProfit, description, saleDate);
    });
    
    console.log(`金庫データ再構築完了: 残高 ${formatPrice(cashbox.balance)}（新計算方法適用）`);
    
    // バックアップとの差分をログ出力
    console.log('金庫データの変更:', {
        oldBalance: formatPrice(backupBalance),
        newBalance: formatPrice(cashbox.balance),
        difference: formatPrice(cashbox.balance - backupBalance),
        oldHistoryCount: backupHistory.length,
        newHistoryCount: cashbox.history.length
    });
    
    return true;
}

// 金庫データを強制的に再構築する関数（手動実行用）
function forceCashboxReconstruction() {
    if (confirm('金庫データを販売履歴から再構築しますか？\n現在の金庫データは削除されます。')) {
        initializeCashboxFromSales();
        updateStats();
        renderCashboxHistory();
        updateCashboxStats();
        alert('金庫データの再構築が完了しました。');
    }
}

// 販売履歴から給与記録を再構築する関数
function initializeSalaryFromSales() {
    console.log('給与記録を販売履歴から再構築しています...');
    
    // 給与記録を初期化
    salaryRecords = [];
    
    // 販売履歴を日付順にソート
    const sortedSales = [...sales].sort((a, b) => 
        new Date(a.saleDate || a.purchaseDate) - new Date(b.saleDate || b.purchaseDate)
    );
    
    // 各販売から販売員給与を計算して給与記録に追加
    sortedSales.forEach(sale => {
        let salesCommission = 0;
        let salespersonId = null;
        let description = '';
        
        // 販売員IDを取得
        if (sale.salespersonId) {
            salespersonId = sale.salespersonId;
        } else if (sale.salesperson) {
            // 販売員名から販売員IDを検索
            const salesperson = salespeople.find(s => s.name === sale.salesperson);
            if (salesperson) {
                salespersonId = salesperson.id;
            }
        }
        
        // 販売員IDがない場合はスキップ
        if (!salespersonId) {
            return;
        }
        
        // 販売員給与を計算
        if (sale.totalSalesCommission !== undefined) {
            // 新しいデータ構造
            salesCommission = sale.totalSalesCommission;
        } else {
            // 旧データ構造から計算
            const salesPrice = sale.totalPrice || sale.price;
            salesCommission = salesPrice * 0.3;
        }
        
        // プレゼントの場合は給与なし
        if (sale.isGift || salesCommission === 0) {
            return;
        }
        
        const quantity = sale.quantity || 1;
        const quantityText = quantity > 1 ? ` ${quantity}台` : '';
        const customerName = sale.customerName || '不明';
        description = `販売給与: ${sale.aircraftName || sale.name}${quantityText} (${customerName})`;
        
        // 給与記録を追加（未払い状態で）
        const saleDate = sale.saleDate || sale.purchaseDate;
        addSalaryRecord(salespersonId, salesCommission, description, saleDate);
    });
    
    console.log(`給与記録再構築完了: ${salaryRecords.length}件の給与記録を作成`);
    saveData();
}

// 新しい計算方法で給与記録を再構築する関数
function migrateSalaryRecordsWithNewCalculation() {
    console.log('給与記録を新しい計算方法で再構築しています...');
    
    // 現在の給与記録をバックアップ
    const backupSalaryRecords = [...salaryRecords];
    
    // 給与記録を初期化
    salaryRecords = [];
    
    // 販売履歴を日付順にソート
    const sortedSales = [...sales].sort((a, b) => 
        new Date(a.saleDate || a.purchaseDate) - new Date(b.saleDate || b.purchaseDate)
    );

    sortedSales.forEach(sale => {
        let salesCommission = 0;
        let salespersonId = null;
        let description = '';
        
        // 販売員IDを取得
        if (sale.salespersonId) {
            salespersonId = sale.salespersonId;
        } else if (sale.salesperson) {
            // 販売員名から販売員IDを検索
            const salesperson = salespeople.find(s => s.name === sale.salesperson);
            if (salesperson) {
                salespersonId = salesperson.id;
            }
        }
        
        // 販売員IDがない場合はスキップ
        if (!salespersonId) {
            return;
        }
        
        // 新しい計算方法で販売員給与を計算
        const quantity = sale.quantity || 1;
        const originalPrice = sale.originalPrice || sale.unitPrice || (sale.totalPrice / quantity);
        
        if (sale.totalSalesCommission !== undefined && sale.calculationMigrated) {
            // 既に新しい計算方法で計算済み
            salesCommission = sale.totalSalesCommission;
        } else {
            // 新しい計算方法で計算（元の定価の30%）
            salesCommission = sale.isGift ? 0 : (originalPrice * quantity * 0.3);
        }
        
        // プレゼントまたは給与が0の場合はスキップ
        if (sale.isGift || salesCommission === 0) {
            return;
        }
        
        const quantityText = quantity > 1 ? ` ${quantity}台` : '';
        const customerName = sale.customerName || '不明';
        description = `販売給与: ${sale.aircraftName || sale.name}${quantityText} (${customerName})`;
        
        // 給与記録を追加（未払い状態で）
        const saleDate = sale.saleDate || sale.purchaseDate;
        addSalaryRecord(salespersonId, salesCommission, description, saleDate);
    });
    
    console.log(`給与記録再構築完了: ${salaryRecords.length}件の給与記録を作成（新計算方法適用）`);
    
    // バックアップとの差分をログ出力
    const oldTotal = backupSalaryRecords.reduce((sum, record) => sum + record.amount, 0);
    const newTotal = salaryRecords.reduce((sum, record) => sum + record.amount, 0);
    
    console.log('給与記録の変更:', {
        oldCount: backupSalaryRecords.length,
        newCount: salaryRecords.length,
        oldTotal: formatPrice(oldTotal),
        newTotal: formatPrice(newTotal),
        difference: formatPrice(newTotal - oldTotal)
    });
    
    return true;
}

// 給与記録を強制的に再構築する関数（手動実行用）
function forceSalaryReconstruction() {
    if (confirm('給与記録を販売履歴から再構築しますか？\n現在の給与記録は削除されます。')) {
        initializeSalaryFromSales();
        updateSalaryStats();
        renderSalaryDetails();
        renderSalespeopleTable();
        alert('給与記録の再構築が完了しました。');
    }
}

// 全データを強制的に再初期化する関数（デバッグ用）
// 新しい計算方法への完全移行
function migrateToNewCalculationMethod() {
    console.log('=== 新しい計算方法への移行を開始します ===');
    
    let hasChanges = false;
    
    try {
        // 1. 販売履歴の計算方法を移行
        console.log('1. 販売履歴の計算方法を移行...');
        if (migrateSalesCalculationMethod()) {
            hasChanges = true;
        }
        
        // 2. 給与記録を新しい計算方法で再構築
        console.log('2. 給与記録を新しい計算方法で再構築...');
        if (migrateSalaryRecordsWithNewCalculation()) {
            hasChanges = true;
        }
        
        // 3. 金庫データを新しい計算方法で再構築
        console.log('3. 金庫データを新しい計算方法で再構築...');
        if (migrateCashboxWithNewCalculation()) {
            hasChanges = true;
        }
        
        // 4. データを保存
        if (hasChanges) {
            saveData();
            console.log('4. データを保存しました');
        }
        
        // 5. UI を更新
        updateStats();
        renderDashboard();
        renderCustomersTable();
        renderSalesTable();
        renderCashboxHistory();
        updateCashboxStats();
        updateSalaryStats();
        renderSalaryDetails();
        renderSalespeopleTable();
        renderEmploymentHistory();
        updateEmploymentStats();
        renderInventoryTable();
        updateInventoryStats();
        
        console.log('=== 新しい計算方法への移行が完了しました ===');
        
        if (hasChanges) {
            alert('計算方法の移行が完了しました。\n' +
                  '・販売員給与: 元の定価の30%\n' +
                  '・ディーラー利益: 販売価格 - 仕入コスト - 販売員給与\n' +
                  'コンソールで詳細な変更内容を確認できます。');
        } else {
            alert('データは既に新しい計算方法に対応しています。');
        }
        
    } catch (error) {
        console.error('移行中にエラーが発生しました:', error);
        alert('移行中にエラーが発生しました。コンソールを確認してください。');
    }
}

function forceFullReinitialization() {
    if (confirm('すべてのデータを再初期化しますか？\n金庫・給与記録が販売履歴から再構築されます。')) {
        // 金庫データを再構築
        initializeCashboxFromSales();
        
        // 給与記録を再構築
        initializeSalaryFromSales();
        
        // すべての表示を更新
        updateStats();
        renderDashboard();
        renderCustomersTable();

        renderSalesTable();
        renderCashboxHistory();
        updateCashboxStats();
        updateSalaryStats();
        renderSalaryDetails();
        renderSalespeopleTable();
        renderEmploymentHistory();
        updateEmploymentStats();
        renderInventoryTable();
        updateInventoryStats();
        
        // 選択肢を更新
        populateAircraftSelect();
        updateCustomerSelect();
        updateSalespersonSelect();
        populateAircraftFilterSelect();

        
        alert('全データの再初期化が完了しました。');
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
            break;
        case 'tutorial':
            // チュートリアルセクションは特別な初期化不要
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

// 統計データの更新
function updateStats() {
    const totalCustomers = customers.length;
    const totalAircraft = aircraft.length;
    
    // 削除されていない販売記録のみで統計を計算
    const activeSales = sales.filter(sale => !sale._deleted);
    
    // 新しいデータ構造と旧データ構造の両方に対応
    const totalSales = activeSales.reduce((sum, sale) => {
        return sum + (sale.totalPrice || sale.price || 0);
    }, 0);
    
    // 利益計算（販売員給与30%を差し引いた実際のディーラー利益）
    const totalProfit = activeSales.reduce((sum, sale) => {
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
    
    if (!customersGrid) {
        console.error('customers-grid element not found');
        return;
    }
    
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
                <td colspan="6" class="text-center empty-data">
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
                <td colspan="6" class="text-center empty-data">
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
                    <span class="text-muted small">${customer.reading || ''}</span>
                    ${customer.reading ? '' : '<button class="btn btn-sm btn-outline-secondary" onclick="editCustomerReading(' + customer.id + ')"><i class="fas fa-edit"></i> 読み仮名を追加</button>'}
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

// 販売履歴テーブルの描画
function renderSalesTable() {
    const salesTable = document.getElementById('sales-table');
    
    // 削除されていない販売記録のみを表示
    const activeSales = sales.filter(sale => !sale._deleted);
    
    if (activeSales.length === 0) {
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
    
    const sortedSales = [...activeSales].sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
    
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
        
        // 販売方法の表示
        let saleMethodDisplay = '';
        if (sale.saleMethod === 'new-purchase') {
            saleMethodDisplay = '<span class="badge bg-info"><i class="fas fa-truck"></i> 新規仕入れ</span>';
        } else if (sale.isInventorySale) {
            saleMethodDisplay = '<span class="badge bg-success"><i class="fas fa-warehouse"></i> 在庫販売</span>';
        } else if (sale.isMixedSale) {
            saleMethodDisplay = '<span class="badge bg-warning"><i class="fas fa-exchange-alt"></i> 混合販売</span>';
        } else {
            saleMethodDisplay = '<span class="badge bg-secondary"><i class="fas fa-shopping-cart"></i> 通常販売</span>';
        }
        
        return `
            <tr data-sale-id="${sale.id}">
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
                <td class="text-center">
                    ${saleMethodDisplay}
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
    
    // 新規航空機登録が選択されている場合はエラー
    if (aircraftSelect === 'new-aircraft') {
        showErrorToast('新規航空機を登録してから販売を行ってください。');
        return;
    }
    
    const aircraftName = aircraftSelect;
    const unitPrice = parseInt(document.getElementById('sale-price').value);
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const discountRate = parseInt(document.getElementById('discount-rate').value) || 0;
    const saleDate = document.getElementById('sale-date').value;
    const salespersonId = document.getElementById('salesperson-select').value;
    const isGift = document.getElementById('is-gift').checked;
    
    // 販売方法の判定
    const priceInput = document.getElementById('sale-price');
    const saleMethodSelect = document.getElementById('sale-method');
    const selectedSaleMethod = saleMethodSelect ? saleMethodSelect.value : 'inventory-priority';
    
    // 販売方法選択を最優先で判定
    let isInventorySale = false;
    let isNewPurchase = false;
    
    console.log(`販売方法選択: ${selectedSaleMethod}`);
    
    if (selectedSaleMethod === 'inventory-priority') {
        // 在庫優先の場合のみ在庫販売を許可
        isInventorySale = priceInput.getAttribute('data-is-inventory-sale') === 'true';
        console.log(`在庫優先販売 - isInventorySale: ${isInventorySale}`);
    } else if (selectedSaleMethod === 'new-purchase') {
        // 新規仕入れ選択時は強制的に新規仕入れ
        isInventorySale = false;
        isNewPurchase = false; // 通常の新規仕入れとして処理
        console.log(`新規仕入れ販売 - 在庫を無視して新規仕入れで処理`);
    }
    const inventoryId = priceInput.getAttribute('data-inventory-id');
    const availableInventoryQuantity = parseInt(priceInput.getAttribute('data-inventory-quantity')) || 0;
    const purchaseQuantity = parseInt(priceInput.getAttribute('data-purchase-quantity')) || 0;
    const purchasePrice = parseInt(priceInput.getAttribute('data-purchase-price')) || 0;
    const selectedAircraftName = priceInput.getAttribute('data-aircraft-name');
    const inventoryItemsJson = priceInput.getAttribute('data-inventory-items');
    
    // 販売方法に応じた数量配分の処理
    let fromInventoryQuantity = 0;
    let fromPurchaseQuantity = 0;
    let mixedSaleMode = false;
    
    if (selectedSaleMethod === 'inventory-priority' && isInventorySale) {
        // 在庫優先販売の場合のみ在庫を使用
        if (quantity <= availableInventoryQuantity) {
            // 在庫で足りる場合
            fromInventoryQuantity = quantity;
            fromPurchaseQuantity = 0;
        } else {
            // 在庫で足りない場合は超過分を自動仕入れ
            fromInventoryQuantity = availableInventoryQuantity;
            fromPurchaseQuantity = quantity - availableInventoryQuantity;
            mixedSaleMode = true;
            
            console.log(`在庫数量不足のため超過分を自動仕入れ: 在庫${fromInventoryQuantity}台 + 仕入れ${fromPurchaseQuantity}台`);
        }
    } else if (selectedSaleMethod === 'new-purchase') {
        // 新規仕入れ販売の場合は在庫を使用しない
        fromInventoryQuantity = 0;
        fromPurchaseQuantity = quantity;
        console.log(`新規仕入れ販売: 在庫を使用せず全量${quantity}台を新規仕入れで処理`);
    }
    
    // 新規仕入れ販売の場合の数量チェック
    if (isNewPurchase && quantity > purchaseQuantity) {
        showErrorToast(`販売数量が仕入れ数量を超えています。仕入れ数量: ${purchaseQuantity}台`);
        return;
    }
    
    // デバッグ情報を追加（開発時のみ）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
        console.log('販売フォーム送信データ:', {
            customerName,
            aircraftName,
            unitPrice,
            saleDate,
            quantity,
            salespersonId,
            isGift,
            discountRate
        });
    }
    
    if (!customerName || !aircraftName || !unitPrice || !saleDate || quantity < 1 || !salespersonId) {
        const missingFields = [];
        if (!customerName) missingFields.push('顧客名');
        if (!aircraftName) missingFields.push('航空機名');
        if (!unitPrice) missingFields.push('販売価格');
        if (!saleDate) missingFields.push('販売日');
        if (quantity < 1) missingFields.push('台数');
        if (!salespersonId) missingFields.push('販売員');
        
        showErrorToast(`以下の項目が不足しています: ${missingFields.join(', ')}`);
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
    
    console.log(`販売処理開始: 販売方法=${selectedSaleMethod}, 数量=${quantity}`);
    
    // 新規仕入れ選択時は在庫処理を完全にスキップ
    if (selectedSaleMethod === 'new-purchase') {
        console.log('新規仕入れ販売: 在庫処理をスキップ');
        // 在庫処理を一切行わない
        fromInventory = 0;
        fromPurchase = quantity;
        totalCostPrice = (originalPrice * 0.5) * quantity; // 全量を新規仕入れコスト
        remainingQuantity = 0; // 処理完了
    } else {
        // 在庫優先販売の場合のみ在庫処理を実行
        console.log('在庫優先販売: 在庫処理を実行');
        
        // 該当する航空機の在庫を取得（優先順：無償在庫 → 安い順）
        const availableInventory = inventory.filter(item => 
            item.aircraftName === aircraftName && 
            item.quantity > 0
        ).sort((a, b) => a.purchasePrice - b.purchasePrice); // 安い順（無償在庫は0円なので最初に来る）
        
        if (availableInventory.length > 0) {
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
    }
    
    // 販売方法に応じた処理（新規仕入れの場合はスキップ）
    if (selectedSaleMethod !== 'new-purchase' && isInventorySale && selectedSaleMethod === 'inventory-priority') {
        if (!mixedSaleMode) {
            // 純粋な在庫販売（在庫で足りる場合）
            const inventoryItems = JSON.parse(inventoryItemsJson);
            let remainingToConsume = fromInventoryQuantity;
            
            // 在庫から消費（複数の在庫アイテムから順次消費）
            for (const item of inventoryItems) {
                if (remainingToConsume <= 0) break;
                
                const inventoryItem = inventory.find(inv => inv.id === item.id);
                if (!inventoryItem) continue;
                
                const consumeFromThis = Math.min(remainingToConsume, inventoryItem.quantity);
                inventoryItem.quantity -= consumeFromThis;
                remainingToConsume -= consumeFromThis;
                
                // 在庫が0になった場合は削除
                if (inventoryItem.quantity <= 0) {
                    const index = inventory.findIndex(inv => inv.id === item.id);
                    if (index !== -1) {
                        inventory.splice(index, 1);
                    }
                }
            }
            
            totalCostPrice = 0; // 在庫販売時は仕入れコスト0円
            fromInventory = fromInventoryQuantity;
            fromPurchase = 0;
        } else {
            // 混合販売（在庫 + 自動仕入れ）
            // 在庫分の処理
            if (fromInventoryQuantity > 0) {
                const inventoryItems = JSON.parse(inventoryItemsJson);
                let remainingToConsume = fromInventoryQuantity;
                
                for (const item of inventoryItems) {
                    if (remainingToConsume <= 0) break;
                    
                    const inventoryItem = inventory.find(inv => inv.id === item.id);
                    if (!inventoryItem) continue;
                    
                    const consumeFromThis = Math.min(remainingToConsume, inventoryItem.quantity);
                    inventoryItem.quantity -= consumeFromThis;
                    remainingToConsume -= consumeFromThis;
                    
                    // 在庫が0になった場合は削除
                    if (inventoryItem.quantity <= 0) {
                        const index = inventory.findIndex(inv => inv.id === item.id);
                        if (index !== -1) {
                            inventory.splice(index, 1);
                        }
                    }
                }
            }
            
            // 仕入れ分のコスト計算（定価の50%）
            const purchaseCostPerUnit = originalPrice * 0.5;
            totalCostPrice = purchaseCostPerUnit * fromPurchaseQuantity; // 仕入れ分のみコスト発生
            fromInventory = fromInventoryQuantity;
            fromPurchase = fromPurchaseQuantity;
        }
    } else if (isNewPurchase) {
        // 新規仕入れ販売の場合
        totalCostPrice = purchasePrice * quantity; // 実際の仕入れ価格
        fromInventory = 0;
        fromPurchase = quantity;
        
        // 余剰分を在庫に追加
        const surplusQuantity = purchaseQuantity - quantity;
        if (surplusQuantity > 0) {
            const aircraftData = aircraftDatabase.find(a => a.name === aircraftName);
            const newInventoryItem = {
                id: Date.now().toString() + '_surplus',
                aircraftName: aircraftName,
                category: aircraftData ? aircraftData.category : 'その他',
                quantity: surplusQuantity,
                purchasePrice: purchasePrice,
                isFreeStock: false,
                date: new Date().toISOString().slice(0, 16),
                notes: '新規仕入れ販売の余剰分'
            };
            inventory.push(newInventoryItem);
        }
    } else if (selectedSaleMethod === 'inventory-priority') {
        // 在庫優先の場合（在庫で足りない分は新規仕入れ）
        fromPurchase = remainingQuantity;
        if (fromPurchase > 0) {
            totalCostPrice += (originalPrice * 0.5) * fromPurchase; // 新規仕入れ分のコスト（定価の50%）
        }
    }
    // 新規仕入れの場合は既に上で処理済みなので何もしない
    
    const totalSalesCommission = isGift ? 0 : (originalPrice * quantity * 0.3); // 販売員給与（プレゼント時は0、通常時は元の販売価格の30%）
    const totalGrossProfit = totalSalePrice - totalCostPrice; // 粗利益
    const totalDealerProfit = totalSalePrice - totalCostPrice - totalSalesCommission; // ディーラー実利益（割引後販売価格 - 仕入コスト - 販売員給与）
    
    console.log('給与計算結果:', {
        isGift,
        totalSalePrice,
        totalSalesCommission,
        totalGrossProfit,
        totalDealerProfit
    });
    
    // 顧客を検索または作成
    let customer = customers.find(c => c.name === customerName);
    if (!customer) {
        customer = {
            id: Date.now(),
            name: customerName,
            reading: '', // 読み仮名は後で編集可能
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
        const unitSalesCommission = isGift ? 0 : originalPrice * 0.3; // 元の定価の30%
        const unitGrossProfit = unitSalePrice - unitCostPrice;
        const unitDealerProfit = unitSalePrice - unitCostPrice - unitSalesCommission; // 販売価格 - 仕入コスト - 販売員給与
        
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
        isInventorySale: isInventorySale, // 在庫販売フラグ
        isNewPurchase: isNewPurchase, // 新規仕入れ販売フラグ
        isMixedSale: mixedSaleMode, // 混合販売フラグ（在庫+自動仕入れ）
        purchaseQuantity: isNewPurchase ? purchaseQuantity : 0, // 仕入れ数量
        purchasePrice: isNewPurchase ? purchasePrice : 0, // 仕入れ単価
        saleDate: saleDate,
        batchId: Date.now(),
        fromInventory: fromInventory, // 在庫から使用した台数
        fromPurchase: fromPurchase, // 新規仕入れした台数
        saleMethod: selectedSaleMethod // 販売方法（inventory-priority または new-purchase）
    };
    sales.push(sale);
    
    // 在庫を消費
    console.log(`在庫消費チェック: fromInventory=${fromInventory}, selectedSaleMethod=${selectedSaleMethod}`);
    if (fromInventory > 0 && selectedSaleMethod !== 'new-purchase') {
        console.log(`在庫消費実行: ${inventoryUsed.length}個のアイテムから消費`);
        for (const usedStock of inventoryUsed) {
            const itemIndex = inventory.findIndex(item => item.id === usedStock.inventoryId);
            if (itemIndex !== -1) {
                console.log(`在庫消費: ${usedStock.aircraftName} ${usedStock.quantity}台 (ID: ${usedStock.inventoryId})`);
                inventory[itemIndex].quantity -= usedStock.quantity;
                
                // 在庫が0になったら削除
                if (inventory[itemIndex].quantity <= 0) {
                    inventory.splice(itemIndex, 1);
                }
            }
        }
    } else if (selectedSaleMethod === 'new-purchase') {
        console.log('新規仕入れ販売: 在庫消費をスキップしました');
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
    
    // 給与記録を追加（プレゼントでない場合のみ）
    console.log('給与記録作成チェック:', {
        isGift,
        totalSalesCommission,
        salespersonId,
        condition: !isGift && totalSalesCommission > 0
    });
    
    if (!isGift && totalSalesCommission > 0) {
        console.log('給与記録を作成します');
        addSalaryRecord(
            parseInt(salespersonId), 
            totalSalesCommission, 
            `販売給与: ${aircraftName} ${quantity}台 (${customerName})`, 
            saleDate
        );
    } else {
        console.log('給与記録作成条件に合致しません');
    }
    
    // データを保存
    saveData();
    
    // 統計を更新
    updateStats();
    
    // 顧客プルダウンを更新
    updateCustomerSelect();
    
    // 航空機フィルター選択肢を更新
    populateAircraftFilterSelect();
    
    // 在庫選択肢を更新

    
    // フォームをクリア
    clearForm();
    
    // 成功メッセージを表示
    let saleTypeText = '';
    if (mixedSaleMode) {
        saleTypeText = `（在庫${fromInventory}台 + 自動仕入れ${fromPurchase}台）`;
    }
    
    showAlert(`${aircraftName}${quantityText}の${isGift ? 'プレゼント' : '販売'}が正常に登録されました${discountText}${giftText}${inventoryText}${saleTypeText}。${profitText}`, 'success');
    
    // 販売員統計を更新
    updateEmploymentStats();
    
    // 販売員テーブルが表示されている場合は更新
    if (document.getElementById('salespeople-section').classList.contains('active')) {
        renderSalespeopleTable();
    }
    
    // 給与管理の統計と詳細を常に更新
    updateSalaryStats();
    renderSalaryDetails();
    
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
    
    // 既存顧客を50音順でソートして追加
    const sortedCustomers = sortCustomersByReading(customers);
    
    sortedCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.name;
        option.className = 'customer-select-option';
        
        // 読み仮名がある場合は名前と読み仮名を分けて表示
        if (customer.reading && customer.reading.trim()) {
            // 読み仮名を括弧内に薄く表示（視覚的に区別）
            option.textContent = `${customer.name}　(${customer.reading})`;
            option.setAttribute('data-customer-name', customer.name);
            option.setAttribute('data-customer-reading', customer.reading);
            option.title = `${customer.name} - 読み: ${customer.reading}`;
        } else {
            option.textContent = customer.name;
            option.setAttribute('data-customer-name', customer.name);
            option.title = customer.name;
        }
        
        customerSelect.appendChild(option);
    });
    
    // 以前の選択値を復元
    if (currentValue && currentValue !== 'new') {
        customerSelect.value = currentValue;
    }
}

// 販売方法選択の処理
function handleSaleMethodChange(e) {
    const selectedMethod = e.target.value;
    const saleMethodInfo = document.getElementById('sale-method-info');
    const aircraftSelect = document.getElementById('aircraft-name');
    const aircraftInfo = document.getElementById('aircraft-info');
    
    // 航空機選択をクリア
    if (aircraftSelect) aircraftSelect.value = '';
    clearPriceInfo();
    
    if (selectedMethod === 'inventory-priority') {
        // 在庫優先販売
        if (saleMethodInfo) {
            saleMethodInfo.innerHTML = '在庫がある場合は仕入れコスト0円で販売';
            saleMethodInfo.className = 'text-success small';
        }
        if (aircraftInfo) {
            aircraftInfo.innerHTML = '航空機を選択してください（在庫優先）';
            aircraftInfo.className = 'text-muted small mt-1';
        }
    } else if (selectedMethod === 'new-purchase') {
        // 新規仕入れ販売
        if (saleMethodInfo) {
            saleMethodInfo.innerHTML = '新規仕入れで販売（定価の50%が仕入れコスト）';
            saleMethodInfo.className = 'text-warning small';
        }
        if (aircraftInfo) {
            aircraftInfo.innerHTML = '航空機を選択してください（新規仕入れ）';
            aircraftInfo.className = 'text-muted small mt-1';
        }
    }
    
    console.log(`販売方法変更: ${selectedMethod}`);
}



// 価格情報を更新する共通関数
function updatePriceInfo(originalPrice, costPrice, isInventorySale = false, inventoryId = null, inventoryQuantity = 0, isNewPurchase = false, purchaseQuantity = 0, purchasePrice = 0, aircraftName = null, inventoryItemsJson = null) {
    const priceInput = document.getElementById('sale-price');
    const priceInfo = document.getElementById('price-info');
    
    if (priceInput) {
        priceInput.value = originalPrice;
        // 販売情報を保存
        priceInput.setAttribute('data-original-price', originalPrice);
        priceInput.setAttribute('data-cost-price', costPrice);
        priceInput.setAttribute('data-is-inventory-sale', isInventorySale);
        priceInput.setAttribute('data-is-new-purchase', isNewPurchase);
        
        if (isInventorySale) {
            priceInput.setAttribute('data-inventory-quantity', inventoryQuantity);
            priceInput.setAttribute('data-aircraft-name', aircraftName);
            priceInput.setAttribute('data-inventory-items', inventoryItemsJson);
            // 旧形式との互換性のため
            if (inventoryId) {
                priceInput.setAttribute('data-inventory-id', inventoryId);
            }
        } else {
            priceInput.removeAttribute('data-inventory-id');
            priceInput.removeAttribute('data-inventory-quantity');
            priceInput.removeAttribute('data-aircraft-name');
            priceInput.removeAttribute('data-inventory-items');
        }
        
        if (isNewPurchase) {
            priceInput.setAttribute('data-purchase-quantity', purchaseQuantity);
            priceInput.setAttribute('data-purchase-price', purchasePrice);
        } else {
            priceInput.removeAttribute('data-purchase-quantity');
            priceInput.removeAttribute('data-purchase-price');
        }
    }
    
    if (priceInfo) {
        let saleType, costText, badgeClass;
        
        if (isInventorySale) {
            saleType = '在庫販売';
            costText = '¥0（在庫販売）';
            badgeClass = 'bg-success';
        } else if (isNewPurchase) {
            saleType = '新規仕入れ販売';
            costText = `${formatPrice(costPrice)}（新規仕入れ）`;
            badgeClass = 'bg-info';
        } else {
            saleType = '通常販売';
            costText = formatPrice(costPrice);
            badgeClass = 'bg-secondary';
        }
        
        let additionalInfo = '';
        if (isNewPurchase) {
            const totalPurchase = purchaseQuantity * purchasePrice;
            additionalInfo = `<div class="col-12 mt-1 small text-muted">仕入れ: ${purchaseQuantity}台 × ${formatPrice(purchasePrice)} = ${formatPrice(totalPurchase)}</div>`;
        }
        
        priceInfo.innerHTML = `
            <div class="row text-small">
                <div class="col-6">定価: ${formatPrice(originalPrice)}</div>
                <div class="col-6">仕入コスト: ${costText}</div>
                <div class="col-12 mt-1"><span class="badge ${badgeClass}">${saleType}</span></div>
                ${additionalInfo}
            </div>
        `;
    }
}

// 新規仕入れフォーム用の航空機選択肢を生成
function populatePurchaseAircraftSelect() {
    const select = document.getElementById('purchase-aircraft-name');
    if (!select) return;
    
    select.innerHTML = '<option value="">航空機を選択してください</option>';
    
    // カテゴリ別に航空機をグループ化
    const categories = {};
    aircraftDatabase.forEach(aircraft => {
        if (!categories[aircraft.category]) {
            categories[aircraft.category] = [];
        }
        categories[aircraft.category].push(aircraft);
    });
    
    // カテゴリごとにオプショングループを作成
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
}

// 新規仕入れの航空機選択時の処理
function handlePurchaseAircraftChange(e) {
    const selectedOption = e.target.selectedOptions[0];
    if (!selectedOption || !selectedOption.dataset.price) {
        clearPurchaseCalculation();
        return;
    }
    
    const aircraftPrice = parseInt(selectedOption.dataset.price);
    const suggestedPurchasePrice = Math.floor(aircraftPrice * 0.5); // 定価の50%を推奨
    
    const purchasePriceInput = document.getElementById('purchase-price-per-unit');
    const suggestionElement = document.getElementById('purchase-price-suggestion');
    
    if (purchasePriceInput) {
        purchasePriceInput.value = suggestedPurchasePrice;
    }
    
    if (suggestionElement) {
        suggestionElement.innerHTML = `推奨: ${formatPrice(suggestedPurchasePrice)} (定価の50%)`;
        suggestionElement.className = 'text-success small';
    }
    
    updatePurchaseCalculation();
}

// 新規仕入れの計算を更新
function updatePurchaseCalculation() {
    const quantityInput = document.getElementById('purchase-quantity');
    const priceInput = document.getElementById('purchase-price-per-unit');
    const totalDisplay = document.getElementById('purchase-total-display');
    
    if (!quantityInput || !priceInput || !totalDisplay) return;
    
    const quantity = parseInt(quantityInput.value) || 0;
    const pricePerUnit = parseInt(priceInput.value) || 0;
    const total = quantity * pricePerUnit;
    
    totalDisplay.textContent = formatPrice(total);
    totalDisplay.className = total > 0 ? 'form-control-plaintext fw-bold text-success' : 'form-control-plaintext fw-bold';
}

// 新規仕入れの計算をクリア
function clearPurchaseCalculation() {
    const purchasePriceInput = document.getElementById('purchase-price-per-unit');
    const suggestionElement = document.getElementById('purchase-price-suggestion');
    const totalDisplay = document.getElementById('purchase-total-display');
    
    if (purchasePriceInput) purchasePriceInput.value = '';
    if (suggestionElement) {
        suggestionElement.innerHTML = '推奨仕入れ価格が表示されます';
        suggestionElement.className = 'text-muted small';
    }
    if (totalDisplay) {
        totalDisplay.textContent = '¥0';
        totalDisplay.className = 'form-control-plaintext fw-bold';
    }
}

// 新規仕入れ情報を確定
function confirmNewPurchase() {
    const aircraftSelect = document.getElementById('purchase-aircraft-name');
    const quantityInput = document.getElementById('purchase-quantity');
    const priceInput = document.getElementById('purchase-price-per-unit');
    
    if (!aircraftSelect.value) {
        showErrorToast('航空機を選択してください。');
        return;
    }
    
    const quantity = parseInt(quantityInput.value) || 0;
    const pricePerUnit = parseInt(priceInput.value) || 0;
    
    if (quantity <= 0) {
        showErrorToast('仕入れ数量を正しく入力してください。');
        return;
    }
    
    if (pricePerUnit <= 0) {
        showErrorToast('仕入れ単価を正しく入力してください。');
        return;
    }
    
    // 仕入れ情報を販売フォームに反映
    const aircraftName = aircraftSelect.value;
    const selectedOption = aircraftSelect.selectedOptions[0];
    const originalPrice = parseInt(selectedOption.dataset.price);
    
    // 通常の航空機選択にも反映
    const mainAircraftSelect = document.getElementById('aircraft-name');
    if (mainAircraftSelect) {
        mainAircraftSelect.value = aircraftName;
    }
    
    // 価格情報を更新（新規仕入れフラグ付き）
    updatePriceInfo(originalPrice, pricePerUnit, false, null, 0, true, quantity, pricePerUnit);
    
    // 新規仕入れフォームを非表示
    const newPurchaseContainer = document.getElementById('new-purchase-container');
    if (newPurchaseContainer) newPurchaseContainer.style.display = 'none';
    
    // 航空機情報を更新
    const aircraftInfo = document.getElementById('aircraft-info');
    if (aircraftInfo) {
        const total = quantity * pricePerUnit;
        aircraftInfo.innerHTML = `
            <div class="alert alert-success p-2 mb-0">
                <i class="fas fa-truck"></i> <strong>新規仕入れ確定</strong><br>
                <small>航空機: ${aircraftName}</small><br>
                <small>仕入れ: ${quantity}台 × ${formatPrice(pricePerUnit)} = ${formatPrice(total)}</small>
            </div>
        `;
        aircraftInfo.className = 'mt-1';
    }
    
    showInfoToast('新規仕入れ情報を確定しました。');
}

// 新規仕入れをキャンセル
function cancelNewPurchase() {
    const newPurchaseContainer = document.getElementById('new-purchase-container');
    const inventorySelect = document.getElementById('inventory-aircraft-select');
    const aircraftInfo = document.getElementById('aircraft-info');
    
    if (newPurchaseContainer) newPurchaseContainer.style.display = 'none';
    if (inventorySelect) inventorySelect.value = '';
    
    if (aircraftInfo) {
        aircraftInfo.innerHTML = '全ての航空機から選択（通常の仕入れコストが発生）';
        aircraftInfo.className = 'text-muted small mt-1';
    }
    
    clearPurchaseForm();
    clearPriceInfo();
}

// チュートリアル機能
function showTutorial(tutorialType) {
    const tutorialContent = document.getElementById('tutorial-content');
    if (!tutorialContent) return;
    
    const tutorials = {
        overview: {
            title: 'システム概要',
            icon: 'fas fa-info-circle',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-info-circle text-primary"></i> 航空機ディーラー管理システムとは</h4>
                        <p class="lead">このシステムは航空機販売業務を包括的に管理するためのWebアプリケーションです。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-primary h-100">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-line text-success"></i> 主な機能</h5>
                                        <ul class="list-unstyled">
                                            <li><i class="fas fa-check text-success"></i> 顧客情報管理</li>
                                            <li><i class="fas fa-check text-success"></i> 販売履歴管理</li>
                                            <li><i class="fas fa-check text-success"></i> 在庫管理</li>
                                            <li><i class="fas fa-check text-success"></i> 給与・雇用管理</li>
                                            <li><i class="fas fa-check text-success"></i> 金庫・財務管理</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-info h-100">
                                    <div class="card-body">
                                        <h5><i class="fas fa-calculator text-info"></i> 自動計算機能</h5>
                                        <ul class="list-unstyled">
                                            <li><i class="fas fa-check text-info"></i> 販売員給与（定価の30%）</li>
                                            <li><i class="fas fa-check text-info"></i> 仕入れコスト（定価の50%）</li>
                                            <li><i class="fas fa-check text-info"></i> ディーラー利益</li>
                                            <li><i class="fas fa-check text-info"></i> 割引計算</li>
                                            <li><i class="fas fa-check text-info"></i> 在庫管理</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <h6><i class="fas fa-lightbulb"></i> 使い方のコツ</h6>
                            <p class="mb-0">各機能は左側のナビゲーションメニューからアクセスできます。データはブラウザに自動保存されるため、ページを閉じても情報が保持されます。</p>
                        </div>
                    </div>
                </div>
            `
        },
        dashboard: {
            title: 'ダッシュボード',
            icon: 'fas fa-tachometer-alt',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-tachometer-alt text-success"></i> ダッシュボードの使い方</h4>
                        <p class="lead">ビジネスの全体像を一目で把握できる統計画面です。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-bar text-success"></i> 統計カード</h5>
                                        <ul>
                                            <li><strong>金庫残高</strong>: 現在の金庫の残高</li>
                                            <li><strong>総販売額</strong>: 累計の販売金額</li>
                                            <li><strong>総顧客数</strong>: 登録されている顧客数</li>
                                            <li><strong>総利益</strong>: ディーラーの累計利益</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-users text-info"></i> 顧客カード</h5>
                                        <p>登録された顧客の情報が表示されます：</p>
                                        <ul>
                                            <li>顧客名と読み仮名</li>
                                            <li>所有航空機数</li>
                                            <li>総購入額</li>
                                            <li>最後の購入日</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-success mt-3">
                            <h6><i class="fas fa-tips"></i> 便利な機能</h6>
                            <ul class="mb-0">
                                <li><strong>並び替え</strong>: 右上のドロップダウンで顧客の表示順を変更できます</li>
                                <li><strong>詳細表示</strong>: 顧客カードをクリックすると詳細情報が表示されます</li>
                                <li><strong>リアルタイム更新</strong>: 販売や登録を行うと自動的に統計が更新されます</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `
        },
        customers: {
            title: '顧客管理',
            icon: 'fas fa-users',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-users text-info"></i> 顧客管理の使い方</h4>
                        <p class="lead">顧客情報の閲覧、検索、編集ができます。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-search text-info"></i> 検索・フィルター機能</h5>
                                        <ul>
                                            <li><strong>顧客名検索</strong>: 名前で顧客を検索</li>
                                            <li><strong>航空機フィルター</strong>: 特定の航空機を持つ顧客を表示</li>
                                            <li><strong>所有状況フィルター</strong>: 所有者/非所有者で絞り込み</li>
                                            <li><strong>並び替え</strong>: 名前、購入額、購入日で並び替え</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-warning">
                                    <div class="card-body">
                                        <h5><i class="fas fa-edit text-warning"></i> 顧客情報編集</h5>
                                        <ul>
                                            <li><strong>読み仮名追加</strong>: 「読み仮名を追加」ボタンで追加</li>
                                            <li><strong>詳細表示</strong>: 「詳細」ボタンで購入履歴を確認</li>
                                            <li><strong>50音順表示</strong>: 読み仮名に基づく並び替え</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <h6><i class="fas fa-info-circle"></i> 顧客登録について</h6>
                            <p class="mb-0">新規顧客は「販売追加」画面で販売時に自動的に登録されます。直接顧客だけを登録することはできません。</p>
                        </div>
                    </div>
                </div>
            `
        },
        sales: {
            title: '販売管理',
            icon: 'fas fa-chart-line',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-chart-line text-warning"></i> 販売履歴管理</h4>
                        <p class="lead">全ての販売記録を確認・編集・削除できます。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-warning">
                                    <div class="card-body">
                                        <h5><i class="fas fa-list text-warning"></i> 販売履歴の見方</h5>
                                        <ul>
                                            <li><strong>顧客名</strong>: 購入者の名前</li>
                                            <li><strong>航空機</strong>: 販売した航空機名</li>
                                            <li><strong>数量</strong>: 販売台数</li>
                                            <li><strong>販売価格</strong>: 実際の販売金額</li>
                                            <li><strong>割引率</strong>: 適用された割引</li>
                                            <li><strong>担当販売員</strong>: 担当した販売員</li>
                                            <li><strong>販売日時</strong>: 販売が行われた日時</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-danger">
                                    <div class="card-body">
                                        <h5><i class="fas fa-tools text-danger"></i> 操作機能</h5>
                                        <ul>
                                            <li><strong>編集</strong>: 販売記録の内容を修正</li>
                                            <li><strong>削除</strong>: 販売記録を完全に削除</li>
                                            <li><strong>詳細表示</strong>: 利益計算の詳細を確認</li>
                                            <li><strong>データ再構築</strong>: 計算方法の更新</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-warning mt-3">
                            <h6><i class="fas fa-exclamation-triangle"></i> 注意事項</h6>
                            <ul class="mb-0">
                                <li>販売記録を削除すると、金庫残高と給与記録も自動的に調整されます</li>
                                <li>編集時は利益計算が自動的に再計算されます</li>
                                <li>「新計算方法に移行」ボタンで過去のデータも新しい計算方法に更新できます</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `
        },
        cashbox: {
            title: '金庫管理',
            icon: 'fas fa-vault',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-vault text-secondary"></i> 金庫管理システム</h4>
                        <p class="lead">会社の資金を管理し、入出金履歴を記録します。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-plus-circle text-success"></i> 入金機能</h5>
                                        <ul>
                                            <li><strong>販売利益</strong>: 自動的に入金される</li>
                                            <li><strong>手動入金</strong>: 任意の金額を入金</li>
                                            <li><strong>説明記録</strong>: 入金理由を記録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-danger">
                                    <div class="card-body">
                                        <h5><i class="fas fa-minus-circle text-danger"></i> 出金機能</h5>
                                        <ul>
                                            <li><strong>経費支払い</strong>: 各種経費の支払い</li>
                                            <li><strong>給与支払い</strong>: 販売員への給与支払い</li>
                                            <li><strong>その他支出</strong>: 任意の支出記録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-history text-info"></i> 履歴機能</h5>
                                        <p>全ての入出金履歴が自動的に記録されます：</p>
                                        <ul>
                                            <li><strong>日時記録</strong>: 正確な取引日時</li>
                                            <li><strong>金額</strong>: 入金・出金の金額</li>
                                            <li><strong>残高</strong>: 取引後の残高</li>
                                            <li><strong>説明</strong>: 取引の詳細説明</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <h6><i class="fas fa-info-circle"></i> 自動連携機能</h6>
                            <p class="mb-0">販売が完了すると、ディーラー利益が自動的に金庫に入金されます。プレゼント販売の場合は損失として記録されます。</p>
                        </div>
                    </div>
                </div>
            `
        },
        salary: {
            title: '給与管理',
            icon: 'fas fa-money-bill-wave',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-money-bill-wave text-primary"></i> 給与管理システム</h4>
                        <p class="lead">販売員の給与を自動計算し、支払い状況を管理します。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-primary">
                                    <div class="card-body">
                                        <h5><i class="fas fa-calculator text-primary"></i> 給与計算</h5>
                                        <ul>
                                            <li><strong>基本給与</strong>: 定価の30%が自動計算</li>
                                            <li><strong>割引無関係</strong>: 割引に関わらず定価ベース</li>
                                            <li><strong>プレゼント除外</strong>: プレゼント販売は給与対象外</li>
                                            <li><strong>自動記録</strong>: 販売と同時に給与記録作成</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-money-check text-success"></i> 支払い管理</h5>
                                        <ul>
                                            <li><strong>未払い表示</strong>: 支払い待ちの給与一覧</li>
                                            <li><strong>支払い実行</strong>: 個別または一括支払い</li>
                                            <li><strong>支払い履歴</strong>: 過去の支払い記録</li>
                                            <li><strong>金庫連携</strong>: 支払い時に金庫から自動出金</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-bar text-info"></i> 統計機能</h5>
                                        <p>各販売員の給与統計を確認できます：</p>
                                        <ul>
                                            <li><strong>未払い給与</strong>: 各販売員の未払い金額</li>
                                            <li><strong>詳細表示</strong>: 販売別の給与明細</li>
                                            <li><strong>販売履歴連携</strong>: 給与の元となった販売記録へのリンク</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-success mt-3">
                            <h6><i class="fas fa-lightbulb"></i> 給与計算例</h6>
                            <p class="mb-0">定価1億円の航空機を20%割引で販売した場合：<br>
                            販売価格：8,000万円、<strong>給与：3,000万円</strong>（定価1億円の30%）</p>
                        </div>
                    </div>
                </div>
            `
        },
        employment: {
            title: '雇用管理',
            icon: 'fas fa-user-tie',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-user-tie text-danger"></i> 雇用管理システム</h4>
                        <p class="lead">販売員の雇用状況を管理し、人事記録を保持します。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-user-plus text-success"></i> 新規雇用</h5>
                                        <ul>
                                            <li><strong>基本情報</strong>: 名前、雇用日を登録</li>
                                            <li><strong>自動ID</strong>: 販売員IDを自動生成</li>
                                            <li><strong>初期状態</strong>: 「在籍」として登録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-warning">
                                    <div class="card-body">
                                        <h5><i class="fas fa-user-edit text-warning"></i> 状態管理</h5>
                                        <ul>
                                            <li><strong>在籍</strong>: 通常勤務状態</li>
                                            <li><strong>休職</strong>: 一時的な休職状態</li>
                                            <li><strong>退職</strong>: 完全削除（給与記録も削除）</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-pie text-info"></i> 雇用統計</h5>
                                        <p>雇用状況の統計を確認できます：</p>
                                        <ul>
                                            <li><strong>在籍販売員数</strong>: 現在働いている販売員</li>
                                            <li><strong>休職販売員数</strong>: 休職中の販売員</li>
                                            <li><strong>雇用履歴</strong>: 過去の雇用・退職記録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-warning mt-3">
                            <h6><i class="fas fa-exclamation-triangle"></i> 重要な注意</h6>
                            <ul class="mb-0">
                                <li><strong>休職中の販売員</strong>は販売追加画面で選択できません</li>
                                <li><strong>退職処理</strong>を行うと、その販売員の給与記録も全て削除されます</li>
                                <li>退職後は復元できないため、慎重に操作してください</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `
        },
        inventory: {
            title: '在庫管理',
            icon: 'fas fa-warehouse',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-warehouse text-dark"></i> 在庫管理システム</h4>
                        <p class="lead">航空機の在庫を効率的に管理し、仕入れと販売を最適化します。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-primary">
                                    <div class="card-body">
                                        <h5><i class="fas fa-plus-square text-primary"></i> 在庫追加</h5>
                                        <ul>
                                            <li><strong>航空機選択</strong>: 既存の航空機から選択</li>
                                            <li><strong>数量設定</strong>: 仕入れる台数</li>
                                            <li><strong>仕入れ価格</strong>: 実際の仕入れ価格</li>
                                            <li><strong>無償在庫</strong>: 仕入れ価格0円の特別在庫</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-chart-bar text-success"></i> 在庫統計</h5>
                                        <ul>
                                            <li><strong>総在庫数</strong>: 全ての在庫台数</li>
                                            <li><strong>総在庫価値</strong>: 販売価格ベースの価値</li>
                                            <li><strong>仕入れコスト</strong>: 実際の仕入れ金額</li>
                                            <li><strong>予想利益</strong>: 全て売却した場合の利益</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="card border-warning">
                                    <div class="card-body">
                                        <h5><i class="fas fa-sync-alt text-warning"></i> 自動在庫管理</h5>
                                        <p>販売時の在庫処理：</p>
                                        <ul>
                                            <li><strong>在庫優先販売</strong>: 在庫がある場合は仕入れコスト0円</li>
                                            <li><strong>自動仕入れ</strong>: 在庫不足時は超過分を自動仕入れ</li>
                                            <li><strong>混合販売</strong>: 在庫分 + 仕入れ分の組み合わせ</li>
                                            <li><strong>在庫更新</strong>: 販売完了と同時に在庫数量を自動更新</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <h6><i class="fas fa-lightbulb"></i> 利益最大化のコツ</h6>
                            <p class="mb-0">在庫がある航空機を優先的に販売することで、仕入れコストを0円にして利益を最大化できます。「販売追加」画面の「在庫車両選択」を活用しましょう。</p>
                        </div>
                    </div>
                </div>
            `
        },
        'add-sale': {
            title: '販売追加',
            icon: 'fas fa-plus',
            content: `
                <div class="row">
                    <div class="col-md-12">
                        <h4><i class="fas fa-plus text-success"></i> 販売追加システム</h4>
                        <p class="lead">新しい販売を登録し、顧客・在庫・給与・金庫を自動更新します。</p>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <div class="card border-info">
                                    <div class="card-body">
                                        <h5><i class="fas fa-user text-info"></i> 顧客選択</h5>
                                        <ul>
                                            <li><strong>既存顧客</strong>: 登録済み顧客から選択</li>
                                            <li><strong>新規顧客</strong>: 新しい顧客を自動登録</li>
                                            <li><strong>50音順表示</strong>: 読み仮名順で並び替え</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-success">
                                    <div class="card-body">
                                        <h5><i class="fas fa-warehouse text-success"></i> 在庫車両選択</h5>
                                        <ul>
                                            <li><strong>在庫優先</strong>: 仕入れコスト0円で販売</li>
                                            <li><strong>自動仕入れ</strong>: 在庫不足時は自動で補充</li>
                                            <li><strong>数量表示</strong>: 各航空機の在庫数を確認</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <div class="card border-warning">
                                    <div class="card-body">
                                        <h5><i class="fas fa-plane text-warning"></i> 航空機選択</h5>
                                        <ul>
                                            <li><strong>カテゴリ別表示</strong>: 航空機をカテゴリごとに整理</li>
                                            <li><strong>価格表示</strong>: 定価と推奨価格を表示</li>
                                            <li><strong>新規航空機</strong>: その場で新しい航空機を登録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="card border-danger">
                                    <div class="card-body">
                                        <h5><i class="fas fa-calculator text-danger"></i> 価格・割引</h5>
                                        <ul>
                                            <li><strong>販売価格</strong>: 定価から変更可能</li>
                                            <li><strong>割引率</strong>: パーセンテージで割引設定</li>
                                            <li><strong>利益計算</strong>: リアルタイムで利益を表示</li>
                                            <li><strong>プレゼント</strong>: 無料提供として記録</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-12">
                                <div class="card border-primary">
                                    <div class="card-body">
                                        <h5><i class="fas fa-cogs text-primary"></i> 自動処理機能</h5>
                                        <p>販売登録時に以下が自動実行されます：</p>
                                        <ul>
                                            <li><strong>顧客登録</strong>: 新規顧客の場合は自動で顧客リストに追加</li>
                                            <li><strong>在庫更新</strong>: 在庫数量を自動で減算</li>
                                            <li><strong>給与記録</strong>: 販売員の給与を自動計算・記録</li>
                                            <li><strong>金庫入金</strong>: ディーラー利益を金庫に自動入金</li>
                                            <li><strong>統計更新</strong>: 全ての統計情報を即座に更新</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-success mt-3">
                            <h6><i class="fas fa-rocket"></i> 効率的な販売のコツ</h6>
                            <ol class="mb-0">
                                <li>まず「在庫車両選択」で在庫があるかチェック</li>
                                <li>在庫があれば仕入れコスト0円で最大利益</li>
                                <li>割引は「割引率」で設定すると計算が楽</li>
                                <li>プレゼントの場合は必ずチェックボックスを有効に</li>
                            </ol>
                        </div>
                    </div>
                </div>
            `
        }
    };
    
    const tutorial = tutorials[tutorialType];
    if (!tutorial) return;
    
    tutorialContent.innerHTML = `
        <div class="tutorial-content">
            <div class="d-flex align-items-center mb-4">
                <i class="${tutorial.icon} fa-2x text-primary me-3"></i>
                <h3 class="mb-0">${tutorial.title}</h3>
            </div>
            ${tutorial.content}
            <div class="text-center mt-4">
                <button class="btn btn-outline-secondary" onclick="showTutorial('overview')">
                    <i class="fas fa-arrow-left"></i> システム概要に戻る
                </button>
            </div>
        </div>
    `;
    
    // ボタンのアクティブ状態を更新
    const buttons = document.querySelectorAll('#tutorial-section button[onclick^="showTutorial"]');
    buttons.forEach(btn => btn.classList.remove('btn-primary', 'btn-outline-primary'));
    buttons.forEach(btn => {
        if (btn.onclick.toString().includes(`'${tutorialType}'`)) {
            btn.classList.remove('btn-outline-primary', 'btn-outline-success', 'btn-outline-info', 'btn-outline-warning', 'btn-outline-secondary', 'btn-outline-danger', 'btn-outline-dark');
            btn.classList.add('btn-primary');
        } else {
            const originalClass = btn.className.replace('btn-primary', '').replace('btn-outline-primary', '');
            btn.className = originalClass;
            if (!btn.classList.contains('btn-outline-primary') && !btn.classList.contains('btn-outline-success') && 
                !btn.classList.contains('btn-outline-info') && !btn.classList.contains('btn-outline-warning') &&
                !btn.classList.contains('btn-outline-secondary') && !btn.classList.contains('btn-outline-danger') &&
                !btn.classList.contains('btn-outline-dark')) {
                btn.classList.add('btn-outline-primary');
            }
        }
    });
}

// 新規仕入れフォームをクリア
function clearPurchaseForm() {
    const aircraftSelect = document.getElementById('purchase-aircraft-name');
    const quantityInput = document.getElementById('purchase-quantity');
    const priceInput = document.getElementById('purchase-price-per-unit');
    
    if (aircraftSelect) aircraftSelect.value = '';
    if (quantityInput) quantityInput.value = '1';
    if (priceInput) priceInput.value = '';
    
    clearPurchaseCalculation();
}

// 価格情報をクリアする関数
function clearPriceInfo() {
    const priceInput = document.getElementById('sale-price');
    const priceInfo = document.getElementById('price-info');
    
    if (priceInput) {
        priceInput.value = '';
        priceInput.removeAttribute('data-original-price');
        priceInput.removeAttribute('data-cost-price');
        priceInput.removeAttribute('data-is-inventory-sale');
        priceInput.removeAttribute('data-inventory-id');
        priceInput.removeAttribute('data-inventory-quantity');
    }
    
    if (priceInfo) {
        priceInfo.innerHTML = '';
    }
}

function handleAircraftChange(e) {
    const newAircraftContainer = document.getElementById('new-aircraft-container');
    const saleMethodSelect = document.getElementById('sale-method');
    const aircraftInfo = document.getElementById('aircraft-info');
    const priceInput = document.getElementById('sale-price');
    const priceInfo = document.getElementById('price-info');
    
    if (e.target.value === 'new-aircraft') {
        // 新規航空機登録フォームを表示
        if (newAircraftContainer) newAircraftContainer.style.display = 'block';
        // 価格情報をクリア
        if (priceInfo) {
            priceInfo.innerHTML = '<div class="text-info"><i class="fas fa-info-circle"></i> 新規航空機を登録してください</div>';
        }
        // 価格入力をクリア
        if (priceInput) priceInput.value = '';
        return;
    } else {
        // 新規航空機登録フォームを非表示
        if (newAircraftContainer) newAircraftContainer.style.display = 'none';
    }
    
    // 選択された航空機の情報を取得
    const selectedOption = e.target.selectedOptions[0];
    if (!selectedOption || !selectedOption.dataset.price) {
        clearPriceInfo();
        return;
    }
    
    const aircraftName = selectedOption.value;
    const originalPrice = parseInt(selectedOption.dataset.price);
    const saleMethod = saleMethodSelect ? saleMethodSelect.value : 'inventory-priority';
    
    if (saleMethod === 'inventory-priority') {
        // 在庫優先販売の場合
        handleInventoryPrioritySale(aircraftName, originalPrice);
    } else if (saleMethod === 'new-purchase') {
        // 新規仕入れ販売の場合（在庫を無視）
        handleNewPurchaseSale(aircraftName, originalPrice);
    }
    
    // 割引計算を更新
    updateDiscountCalculation();
}

// 在庫優先販売の処理
function handleInventoryPrioritySale(aircraftName, originalPrice) {
    const aircraftInfo = document.getElementById('aircraft-info');
    
    // 在庫を確認
    const availableInventory = inventory.filter(item => 
        item.aircraftName === aircraftName && item.quantity > 0
    );
    
    if (availableInventory.length > 0) {
        // 在庫がある場合
        const totalInventoryQuantity = availableInventory.reduce((sum, item) => sum + item.quantity, 0);
        
        // 在庫販売として価格情報を更新
        updatePriceInfo(
            originalPrice, // originalPrice
            0, // costPrice (在庫販売は0円)
            true, // isInventorySale
            null, // inventoryId
            totalInventoryQuantity, // inventoryQuantity
            false, // isNewPurchase
            0, // purchaseQuantity
            0, // purchasePrice
            aircraftName, // aircraftName
            JSON.stringify(availableInventory) // inventoryItemsJson
        );
        
        if (aircraftInfo) {
            aircraftInfo.innerHTML = `
                <div class="alert alert-success p-2 mb-0">
                    <i class="fas fa-warehouse"></i> <strong>在庫販売</strong><br>
                    <small>定価: ${formatPrice(originalPrice)}</small><br>
                    <small class="text-success"><strong>仕入れコスト: ¥0（在庫販売）</strong></small><br>
                    <small>在庫数: ${totalInventoryQuantity}台</small>
                </div>
            `;
            aircraftInfo.className = 'mt-1';
        }
    } else {
        // 在庫がない場合は自動で新規仕入れに切り替え
        handleNewPurchaseSale(aircraftName, originalPrice);
        
        if (aircraftInfo) {
            aircraftInfo.innerHTML = `
                <div class="alert alert-warning p-2 mb-0">
                    <i class="fas fa-exclamation-triangle"></i> <strong>在庫なし - 新規仕入れ販売</strong><br>
                    <small>定価: ${formatPrice(originalPrice)}</small><br>
                    <small class="text-warning">仕入れコスト: ${formatPrice(originalPrice * 0.5)}（定価の50%）</small>
                </div>
            `;
            aircraftInfo.className = 'mt-1';
        }
    }
}

// 新規仕入れ販売の処理
function handleNewPurchaseSale(aircraftName, originalPrice) {
    const aircraftInfo = document.getElementById('aircraft-info');
    const costPrice = originalPrice * 0.5;
    
    // 新規仕入れ販売として価格情報を更新
    updatePriceInfo(
        originalPrice, // originalPrice
        costPrice, // costPrice
        false, // isInventorySale
        null, // inventoryId
        0, // inventoryQuantity
        false, // isNewPurchase (通常の新規仕入れ)
        0, // purchaseQuantity
        0, // purchasePrice
        aircraftName, // aircraftName
        null // inventoryItemsJson
    );
    
    if (aircraftInfo) {
        aircraftInfo.innerHTML = `
            <div class="alert alert-info p-2 mb-0">
                <i class="fas fa-truck"></i> <strong>新規仕入れ販売</strong><br>
                <small>定価: ${formatPrice(originalPrice)}</small><br>
                <small class="text-info">仕入れコスト: ${formatPrice(costPrice)}（定価の50%）</small>
            </div>
        `;
        aircraftInfo.className = 'mt-1';
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
        const totalSalesCommission = unitPrice * quantity * 0.3; // 販売員給与（元の定価の30%）
        const totalGrossProfit = totalSalePrice - totalCostPrice; // 粗利益
        const totalDealerProfit = totalSalePrice - totalCostPrice - totalSalesCommission; // ディーラー実利益（販売価格 - 仕入コスト - 販売員給与）
        
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
        
        infoText += `<br>販売員給与: ${formatPrice(totalSalesCommission)} (定価の30%)`;
        infoText += `<br><strong>ディーラー利益: ${formatPrice(totalDealerProfit)}</strong></div>`;
        
        discountInfo.innerHTML = infoText;
    } else {
        discountInfo.textContent = '';
    }
}

// フォームクリア
function clearForm() {
    document.getElementById('sale-form').reset();
    
    // 販売方法選択をデフォルトに戻す
    const saleMethodSelect = document.getElementById('sale-method');
    if (saleMethodSelect) {
        saleMethodSelect.value = 'inventory-priority';
    }
    
    // 販売方法情報を更新
    const saleMethodInfo = document.getElementById('sale-method-info');
    if (saleMethodInfo) {
        saleMethodInfo.innerHTML = '在庫がある場合は仕入れコスト0円で販売';
        saleMethodInfo.className = 'text-success small';
    }
    
    // 新規航空機登録コンテナを非表示
    const newAircraftContainer = document.getElementById('new-aircraft-container');
    if (newAircraftContainer) {
        newAircraftContainer.style.display = 'none';
    }
    
    // 新規仕入れコンテナを非表示
    const newPurchaseContainer = document.getElementById('new-purchase-container');
    if (newPurchaseContainer) {
        newPurchaseContainer.style.display = 'none';
    }
    
    // 新規航空機登録フォームをクリア
    clearNewAircraftForm();
    
    // 新規仕入れフォームをクリア
    clearPurchaseForm();
    
    // 顧客選択フィールドのクリア
    const customerSelectElement = document.getElementById('customer-select');
    if (customerSelectElement) customerSelectElement.value = '';
    
    const newCustomerContainer = document.getElementById('new-customer-container');
    if (newCustomerContainer) newCustomerContainer.style.display = 'none';
    
    const customerNameElement = document.getElementById('customer-name');
    if (customerNameElement) {
        customerNameElement.required = false;
        customerNameElement.value = '';
    }
    
    // 追加フィールドのクリア
    const quantityElement = document.getElementById('quantity');
    if (quantityElement) quantityElement.value = '1';
    
    const discountRateElement = document.getElementById('discount-rate');
    if (discountRateElement) discountRateElement.value = '0';
    
    const priceInfoElement = document.getElementById('price-info');
    if (priceInfoElement) priceInfoElement.textContent = '';
    
    const discountInfoElement = document.getElementById('discount-info');
    if (discountInfoElement) discountInfoElement.textContent = '';
    
    // プレゼントチェックボックスのクリア
    const isGiftElement = document.getElementById('is-gift');
    if (isGiftElement) isGiftElement.checked = false;
    
    const salePriceElement = document.getElementById('sale-price');
    if (salePriceElement) salePriceElement.disabled = false;
    
    if (discountRateElement) discountRateElement.disabled = false;
    
    // 販売員選択をクリア
    const salespersonSelectElement = document.getElementById('salesperson-select');
    if (salespersonSelectElement) salespersonSelectElement.value = '';
    
    // 現在の日時を設定
    const saleDateElement = document.getElementById('sale-date');
    if (saleDateElement) saleDateElement.value = getJapanDateTimeString();
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
                ${customer.reading ? `<p class="text-center text-muted small">${customer.reading}</p>` : ''}
                <div class="text-center mb-3">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editCustomerReading(${customer.id})">
                        <i class="fas fa-edit"></i> 読み仮名を${customer.reading ? '編集' : '追加'}
                    </button>
                </div>
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
    
    // 共有機能が有効な場合は即座に同期
    if (gistId && githubToken) {
        uploadToGist();
    }
    
    updateStats();
    renderCustomersTable();
    renderDashboard(); // ダッシュボードも更新
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

// 既存販売履歴の給与・利益計算を新しい方法で再計算
function migrateSalesCalculationMethod() {
    console.log('販売履歴の計算方法を新しい方式に移行しています...');
    
    let migrated = false;
    
    sales.forEach(sale => {
        // 既に新しい計算方法で計算済みかチェック
        if (sale.calculationMigrated) {
            return;
        }
        
        // 必要なデータを取得
        const quantity = sale.quantity || 1;
        const originalPrice = sale.originalPrice || sale.unitPrice || (sale.totalPrice / quantity);
        const totalSalePrice = sale.totalPrice || (sale.unitPrice * quantity);
        const discountRate = sale.discountRate || 0;
        
        // 新しい計算方法で販売員給与を計算
        const newTotalSalesCommission = sale.isGift ? 0 : (originalPrice * quantity * 0.3);
        
        // 仕入コストを計算
        const totalCostPrice = sale.totalCostPrice || ((originalPrice * 0.5) * quantity);
        
        // 新しい計算方法でディーラー利益を計算
        const newTotalDealerProfit = totalSalePrice - totalCostPrice - newTotalSalesCommission;
        
        // 古い値を保存（デバッグ用）
        const oldTotalSalesCommission = sale.totalSalesCommission || sale.salespersonCommission;
        const oldTotalDealerProfit = sale.totalDealerProfit;
        
        // 新しい値で更新
        sale.totalSalesCommission = newTotalSalesCommission;
        sale.salespersonCommission = newTotalSalesCommission; // 互換性のため
        sale.totalDealerProfit = newTotalDealerProfit;
        sale.calculationMigrated = true; // 移行済みフラグ
        
        // 変更があった場合のみログ出力
        if (Math.abs(oldTotalSalesCommission - newTotalSalesCommission) > 1 || 
            Math.abs(oldTotalDealerProfit - newTotalDealerProfit) > 1) {
            console.log(`販売記録 ${sale.id} を更新:`, {
                aircraftName: sale.aircraftName,
                customerName: sale.customerName,
                oldSalesCommission: formatPrice(oldTotalSalesCommission),
                newSalesCommission: formatPrice(newTotalSalesCommission),
                oldDealerProfit: formatPrice(oldTotalDealerProfit),
                newDealerProfit: formatPrice(newTotalDealerProfit)
            });
            migrated = true;
        }
    });
    
    if (migrated) {
        console.log('販売履歴の計算方法移行が完了しました');
        return true;
    } else {
        console.log('販売履歴は既に新しい計算方法です');
        return false;
    }
}

// 既存顧客データに読み仮名フィールドを追加する移行処理
function migrateCustomerReadingField() {
    let migrated = false;
    customers.forEach(customer => {
        if (!customer.hasOwnProperty('reading')) {
            customer.reading = '';
            migrated = true;
        }
    });
    
    if (migrated) {
        saveData();
        console.log('顧客データに読み仮名フィールドを追加しました');
    }
}

// 50音順ソート用の関数
function sortCustomersByReading(customers) {
    return [...customers].sort((a, b) => {
        // 読み仮名がある場合は読み仮名でソート、ない場合は名前でソート
        const aKey = a.reading || a.name;
        const bKey = b.reading || b.name;
        return aKey.localeCompare(bKey, 'ja', { numeric: true });
    });
}

// 顧客読み仮名編集機能
function editCustomerReading(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const newReading = prompt(`${customer.name}さんの読み仮名を入力してください（ひらがなで入力）:`, customer.reading || '');
    
    if (newReading !== null) { // キャンセルされていない場合
        customer.reading = newReading.trim();
        saveData();
        renderCustomersTable();
        updateCustomerSelect(); // 顧客選択肢も更新
        showInfoToast(`${customer.name}さんの読み仮名を${customer.reading ? '「' + customer.reading + '」に' : ''}更新しました。`);
    }
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
        
        // 販売記録を削除（削除マーカー付きで同期用に保持）
        const saleIndex = sales.findIndex(s => s.id === saleId);
        if (saleIndex !== -1) {
            sales[saleIndex]._deleted = true;
            sales[saleIndex].deletedAt = new Date().toISOString();
        }
        
        // 実際の削除は同期後に行う
        setTimeout(() => {
            sales = sales.filter(s => s.id !== saleId);
            saveData();
        }, 2000);
        
        // データ保存と表示更新
        saveData();
        
        // 共有機能が有効な場合は即座に同期
        if (gistId && githubToken) {
            uploadToGist();
        }
        
        updateStats();
        renderSalesTable();
        renderDashboard(); // ダッシュボードも更新

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
// 販売追加用の在庫車両選択肢を更新する関数
function populateInventoryAircraftSelect() {
    const inventorySelect = document.getElementById('inventory-aircraft-select');
    if (!inventorySelect) return;
    
    // 基本オプションを設定
    inventorySelect.innerHTML = '<option value="">在庫から選択（推奨・仕入れ0円）</option>';
    
    // 在庫がある車両のみを抽出（在庫数が1以上）
    const availableInventory = inventory.filter(item => item.quantity > 0);
    
    if (availableInventory.length === 0) {
        const noInventoryOption = document.createElement('option');
        noInventoryOption.value = '';
        noInventoryOption.textContent = '在庫車両がありません';
        noInventoryOption.disabled = true;
        inventorySelect.appendChild(noInventoryOption);
        return;
    }
    
    // 同じ航空機名の在庫をまとめて合計数量を計算
    const consolidatedInventory = {};
    availableInventory.forEach(item => {
        if (!consolidatedInventory[item.aircraftName]) {
            consolidatedInventory[item.aircraftName] = {
                aircraftName: item.aircraftName,
                totalQuantity: 0,
                items: []
            };
        }
        consolidatedInventory[item.aircraftName].totalQuantity += item.quantity;
        consolidatedInventory[item.aircraftName].items.push(item);
    });
    
    // 在庫車両を航空機名でソート
    const sortedInventory = Object.values(consolidatedInventory)
        .sort((a, b) => a.aircraftName.localeCompare(b.aircraftName, 'ja'));
    
    sortedInventory.forEach(consolidated => {
        const option = document.createElement('option');
        option.value = consolidated.aircraftName;
        option.textContent = `${consolidated.aircraftName} (在庫: ${consolidated.totalQuantity}台)`;
        option.setAttribute('data-aircraft-name', consolidated.aircraftName);
        option.setAttribute('data-total-quantity', consolidated.totalQuantity);
        option.setAttribute('data-inventory-items', JSON.stringify(consolidated.items));
        inventorySelect.appendChild(option);
    });
}

function populateAircraftSelect() {
    const select = document.getElementById('aircraft-name');
    
    if (!select) {
        console.error('航空機選択要素が見つかりません');
        return;
    }
    
    // 既存のオプションをクリア（最初のオプションは残す）
    select.innerHTML = '<option value="">選択してください</option>';
    
    console.log('航空機データベース:', aircraftDatabase.length, '件');
    
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
    
    // 新規航空機登録オプションを追加
    const newAircraftOption = document.createElement('option');
    newAircraftOption.value = 'new-aircraft';
    newAircraftOption.textContent = '+ 新規航空機を登録';
    select.appendChild(newAircraftOption);
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
                
                saveData();
                updateStats();
                renderDashboard();
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
    if (!salespersonSelect) {
        console.error('販売員選択要素が見つかりません');
        return;
    }
    
    const activeSalespeople = salespeople.filter(person => person.status === 'active');
    console.log('在籍販売員:', activeSalespeople.length, '人');
    
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
        const statusText = person.status === 'active' ? '在籍' : person.status === 'leave' ? '休職' : '退職';
        const statusClass = person.status === 'active' ? 'bg-success' : person.status === 'leave' ? 'bg-warning' : 'bg-danger';
        
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
                    <span class="badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info me-1" onclick="showSalespersonDetail(${person.id})">
                        <i class="fas fa-eye"></i> 詳細
                    </button>
                    ${person.status === 'active' ? `
                        <button class="btn btn-sm btn-outline-warning me-1" onclick="changeSalespersonStatus(${person.id}, 'leave')">
                            <i class="fas fa-pause"></i> 休職
                        </button>
                    ` : person.status === 'leave' ? `
                        <button class="btn btn-sm btn-outline-success me-1" onclick="changeSalespersonStatus(${person.id}, 'active')">
                            <i class="fas fa-play"></i> 復職
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSalesperson(${person.id})">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 販売員統計データの取得
function getSalespersonStatistics(salespersonId) {
    // 削除されていない販売記録のみで統計を計算
    const activeSales = sales.filter(sale => !sale._deleted);
    const salespersonSales = activeSales.filter(sale => 
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
        const statusText = person.status === 'active' ? '在籍' : person.status === 'leave' ? '休職' : '退職';
        const statusClass = person.status === 'active' ? 'text-success' : person.status === 'leave' ? 'text-warning' : 'text-danger';
        
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
    const leaveSalespeopleCount = document.getElementById('leave-salespeople-count');
    const totalSalesCount = document.getElementById('total-sales-count');
    const totalCommissionPaid = document.getElementById('total-commission-paid');
    
    if (activeSalespeopleCount) {
        const activeCount = salespeople.filter(person => person.status === 'active').length;
        activeSalespeopleCount.textContent = activeCount;
    }
    
    if (leaveSalespeopleCount) {
        const leaveCount = salespeople.filter(person => person.status === 'leave').length;
        leaveSalespeopleCount.textContent = leaveCount;
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

// 販売員の雇用状態を変更
function changeSalespersonStatus(salespersonId, newStatus) {
    const person = salespeople.find(p => p.id === salespersonId);
    if (!person) return;
    
    const statusText = newStatus === 'active' ? '在籍' : '休職';
    
    if (confirm(`${person.name}さんの雇用状態を「${statusText}」に変更しますか？`)) {
        person.status = newStatus;
        
        if (newStatus === 'leave') {
            person.leaveDate = getJapanDateString();
        } else if (newStatus === 'active' && person.leaveDate) {
            person.returnDate = getJapanDateString();
        }
        
        saveData();
        
        // 選択肢を更新
        updateSalespersonSelect();
        
        // 表示を更新
        renderSalespeopleTable();
        renderEmploymentHistory();
        updateEmploymentStats();
        
        showInfoToast(`${person.name}さんの雇用状態を「${statusText}」に変更しました。`);
    }
}

// 販売員の削除
function deleteSalesperson(salespersonId) {
    const person = salespeople.find(p => p.id === salespersonId);
    if (!person) return;
    
    if (confirm(`${person.name}さんを完全に削除しますか？\n※この操作は元に戻せません。関連する給与記録も削除されます。`)) {
        // 販売員を配列から削除
        const index = salespeople.findIndex(p => p.id === salespersonId);
        if (index !== -1) {
            salespeople.splice(index, 1);
        }
        
        // 関連する給与記録も削除
        salaryRecords = salaryRecords.filter(record => record.salespersonId !== salespersonId);
        
        saveData();
        
        // 選択肢を更新
        updateSalespersonSelect();
        
        // 表示を更新
        renderSalespeopleTable();
        renderEmploymentHistory();
        updateEmploymentStats();
        updateSalaryStats();
        renderSalaryDetails();
        
        showInfoToast(`${person.name}さんを削除しました。`);
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
    const totalSalesCommission = originalPrice * quantity * 0.3; // 元の定価の30%
    const totalGrossProfit = totalSalePrice - totalCostPrice;
    const totalDealerProfit = totalSalePrice - totalCostPrice - totalSalesCommission; // 販売価格 - 仕入コスト - 販売員給与
    
    // 計算結果表示
    calculationDetails.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div><strong>総販売価格:</strong> ${formatPrice(totalSalePrice)}</div>
                <div><strong>仕入れ価格:</strong> ${formatPrice(totalCostPrice)}</div>
                <div><strong>販売員給与:</strong> ${formatPrice(totalSalesCommission)} <small class="text-muted">(定価の30%)</small></div>
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
    const totalSalesCommission = originalPrice * quantity * 0.3; // 元の定価の30%
    const totalGrossProfit = totalSalePrice - totalCostPrice;
    const totalDealerProfit = totalSalePrice - totalCostPrice - totalSalesCommission; // 販売価格 - 仕入コスト - 販売員給与
    
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
        
        // 共有機能が有効な場合は即座に同期
        if (gistId && githubToken) {
            uploadToGist();
        }
        
        renderInventoryTable();
        updateInventoryStats();
        updateStats();
        renderDashboard(); // ダッシュボードも更新
        
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
function populateInventoryManagementAircraftSelect() {
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
    // デバッグ情報を追加（開発時のみ）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
        console.log('給与記録追加:', {
            salespersonId,
            amount,
            description,
            date: date || getJapanISOString()
        });
    }
    
    const record = {
        id: Date.now() + Math.random(),
        salespersonId: salespersonId,
        amount: amount,
        description: description,
        date: date || getJapanISOString(),
        paid: false // 未払い状態
    };
    
    salaryRecords.push(record);
    console.log('給与記録配列に追加後:', salaryRecords.length, '件');
    
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
                                <th>台数</th>
                                <th>売上額</th>
                                <th>給与額</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salespersonSales.map(sale => {
                                const commission = sale.salespersonCommission || sale.totalSalesCommission || ((sale.totalPrice || sale.price || 0) * 0.3);
                                const quantity = sale.quantity || 1;
                                const saleDate = sale.saleDate || sale.date;
                                return `
                                    <tr>
                                        <td>
                                            <button class="btn btn-sm btn-outline-primary" onclick="jumpToSalesHistory('${sale.id}')">
                                                <i class="fas fa-external-link-alt"></i>
                                                ${formatDate(saleDate)}
                                            </button>
                                        </td>
                                        <td>${sale.customerName}</td>
                                        <td>${sale.aircraftName}</td>
                                        <td><span class="badge bg-secondary">${quantity}台</span></td>
                                        <td class="price-tag">${formatPrice(sale.totalPrice || sale.price || 0)}</td>
                                        <td class="price-tag text-success">${formatPrice(commission)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-info" onclick="showSaleDetail(${sale.id})" title="販売詳細">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </td>
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

// 新規航空機登録処理
function registerNewAircraft() {
    const name = document.getElementById('new-aircraft-name').value.trim();
    const category = document.getElementById('new-aircraft-category').value;
    const price = parseInt(document.getElementById('new-aircraft-price').value);
    const english = document.getElementById('new-aircraft-english').value.trim();
    
    // バリデーション
    if (!name) {
        showErrorToast('航空機名を入力してください。');
        return;
    }
    
    if (!category) {
        showErrorToast('カテゴリを選択してください。');
        return;
    }
    
    if (!price || price <= 0) {
        showErrorToast('正しい定価を入力してください。');
        return;
    }
    
    // 重複チェック
    const existingAircraft = aircraftDatabase.find(a => a.name === name);
    if (existingAircraft) {
        showErrorToast('同じ名前の航空機が既に登録されています。');
        return;
    }
    
    // 新規航空機をデータベースに追加
    const newAircraft = {
        name: name,
        price: price,
        category: category,
        english: english || name
    };
    
    aircraftDatabase.push(newAircraft);
    
    // 航空機選択肢を更新
    populateAircraftSelect();

    
    // 新規登録した航空機を選択状態にする
    const aircraftSelect = document.getElementById('aircraft-name');
    aircraftSelect.value = name;
    
    // 価格情報を更新
    const priceInput = document.getElementById('sale-price');
    const priceInfo = document.getElementById('price-info');
    
    priceInput.value = price;
    
    if (priceInfo) {
        const costPrice = price * 0.5;
        const salesCommission = price * 0.3;
        const grossProfit = price - costPrice;
        const dealerProfit = grossProfit - salesCommission;
        priceInfo.innerHTML = `
            <div><i class="fas fa-info-circle"></i> 定価: ${formatPrice(price)} (1台あたり)</div>
            <div class="text-muted">仕入れ価格: ${formatPrice(costPrice)} | 販売員給与: ${formatPrice(salesCommission)}</div>
            <div class="text-success"><strong>ディーラー利益: ${formatPrice(dealerProfit)}</strong></div>
        `;
        priceInfo.className = 'text-info small mt-1';
    }
    
    // 新規航空機登録フォームを非表示
    document.getElementById('new-aircraft-container').style.display = 'none';
    
    // フォームをクリア
    clearNewAircraftForm();
    
    // 割引計算を更新
    updateDiscountCalculation();
    
    showInfoToast(`新規航空機「${name}」を登録しました。`);
}

// 新規航空機登録をキャンセル
function cancelNewAircraft() {
    // 航空機選択を元に戻す
    const aircraftSelect = document.getElementById('aircraft-name');
    aircraftSelect.value = '';
    
    // 新規航空機登録フォームを非表示
    document.getElementById('new-aircraft-container').style.display = 'none';
    
    // 価格情報をクリア
    const priceInfo = document.getElementById('price-info');
    if (priceInfo) {
        priceInfo.textContent = '';
    }
    
    // 価格入力をクリア
    document.getElementById('sale-price').value = '';
    
    // フォームをクリア
    clearNewAircraftForm();
}

// 新規航空機登録フォームをクリア
function clearNewAircraftForm() {
    document.getElementById('new-aircraft-name').value = '';
    document.getElementById('new-aircraft-category').value = '';
    document.getElementById('new-aircraft-price').value = '';
    document.getElementById('new-aircraft-english').value = '';
}

// 販売履歴にジャンプする関数
function jumpToSalesHistory(saleId) {
    // 現在のモーダルを閉じる
    const currentModal = bootstrap.Modal.getInstance(document.getElementById('customerModal'));
    if (currentModal) {
        currentModal.hide();
    }
    
    // 販売履歴セクションに移動
    showSection('sales');
    
    // 少し遅延してから該当の販売記録をハイライト
    setTimeout(() => {
        const saleRow = document.querySelector(`tr[data-sale-id="${saleId}"]`);
        if (saleRow) {
            // ハイライト効果
            saleRow.classList.add('table-warning');
            saleRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 3秒後にハイライトを解除
            setTimeout(() => {
                saleRow.classList.remove('table-warning');
            }, 3000);
        }
    }, 500);
}

// ========== 共有・同期機能の実装 ==========

// Firebase初期化
function initializeFirebase() {
    // 実際のFirebase初期化はここに実装
    // 現在はデモ用の接続状態管理のみ
    console.log('Firebase初期化をシミュレート中...');
    
    // 接続状態をシミュレート
    setTimeout(() => {
        updateConnectionStatus('connecting');
    }, 1000);
    
    setTimeout(() => {
        updateConnectionStatus('online');
        isOnline = true;
    }, 3000);
}

// ストア接続の設定
function setupStoreConnection() {
    // 接続状態の初期表示
    updateConnectionStatus('offline');
    updateOnlineUserCount(1);
    
    // 定期的な接続確認（30秒ごと）
    setInterval(() => {
        if (isOnline) {
            // オンライン状態の確認
            checkConnectionStatus();
        }
    }, 30000);
}

// 接続状態の更新
function updateConnectionStatus(status) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    
    if (!indicator || !text) return;
    
    // 既存のクラスを削除
    indicator.className = 'indicator';
    
    switch(status) {
        case 'online':
            indicator.classList.add('online');
            text.textContent = '同期中';
            break;
        case 'connecting':
            indicator.classList.add('connecting');
            text.textContent = '接続中...';
            break;
        case 'offline':
        default:
            indicator.classList.add('offline');
            text.textContent = '接続中...';
            break;
    }
}

// オンラインユーザー数の更新
function updateOnlineUserCount(count) {
    const element = document.getElementById('online-users');
    if (element) {
        element.textContent = `接続中: ${count}人`;
    }
    onlineUsers = count;
}

// 接続状態の確認
function checkConnectionStatus() {
    // 実際のFirebase接続確認はここに実装
    // 現在は常にオンラインとして扱う
    return true;
}

// GitHub Gist同期機能の設定
async function setupGistSync() {
    gistId = localStorage.getItem('luxuryAircraftGistId') || null;
    githubToken = localStorage.getItem('luxuryAircraftGithubToken') || null;
    
    if (gistId && githubToken) {
        console.log('Gist同期機能を開始します');
        startGistSync();
    }
}

// GitHub Gistでデータ同期を作成
async function createDataGist() {
    const token = prompt('GitHub Personal Access Token を入力してください:\n(Settings > Developer settings > Personal access tokens)');
    if (!token) return;

    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'LUXURY-AIRCRAFT 管理システム データ同期',
                public: false,
                files: {
                    'luxury-aircraft-data.json': {
                        content: JSON.stringify({
                            customers,
                            aircraft,
                            sales,
                            salespeople,
                            inventory,
                            cashbox,
                            salaryRecords
                        }, null, 2)
                    }
                }
            })
        });

        const gist = await response.json();
        
        if (gist.id) {
            gistId = gist.id;
            githubToken = token;
            
            localStorage.setItem('luxuryAircraftGistId', gistId);
            localStorage.setItem('luxuryAircraftGithubToken', githubToken);
            
            alert(`Gist同期が設定されました！\nGist ID: ${gistId}\n他のメンバーとこのIDを共有してください`);
            startGistSync();
            updateSyncStatus();
        } else {
            alert('Gist作成に失敗しました');
        }
    } catch (error) {
        console.error('Gist作成エラー:', error);
        alert('Gist作成に失敗しました');
    }
}

// GitHub Gist同期に参加
async function joinGistSync() {
    const gistIdInput = prompt('Gist ID を入力してください:');
    const token = prompt('GitHub Personal Access Token を入力してください:');
    
    if (!gistIdInput || !token) return;

    try {
        // Gistからデータを取得
        const response = await fetch(`https://api.github.com/gists/${gistIdInput}`, {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        
        const gist = await response.json();
        
        if (gist.files && gist.files['luxury-aircraft-data.json']) {
            const remoteData = JSON.parse(gist.files['luxury-aircraft-data.json'].content);
            
            // データをマージ
            mergeSharedData(remoteData);
            
            gistId = gistIdInput;
            githubToken = token;
            
            localStorage.setItem('luxuryAircraftGistId', gistId);
            localStorage.setItem('luxuryAircraftGithubToken', githubToken);
            
            alert('Gist同期に参加しました！');
            startGistSync();
            updateSyncStatus();
        } else {
            alert('Gistデータが見つかりません');
        }
    } catch (error) {
        console.error('Gist参加エラー:', error);
        alert('Gist同期への参加に失敗しました');
    }
}

// Gist同期開始
async function startGistSync() {
    if (!gistId || !githubToken) return;

    // 30秒ごとに同期
    setInterval(async () => {
        await syncWithGist();
    }, 30000);

    // 初回同期
    await syncWithGist();
}

// Gistとの同期
async function syncWithGist() {
    if (!gistId || !githubToken) return;

    try {
        // リモートデータを取得
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });
        
        const gist = await response.json();
        
        if (gist.files && gist.files['luxury-aircraft-data.json']) {
            const remoteData = JSON.parse(gist.files['luxury-aircraft-data.json'].content);
            
            // データをマージ
            mergeSharedData(remoteData);
            
            // ローカルデータをアップロード
            await uploadToGist();
        }
    } catch (error) {
        console.error('Gist同期エラー:', error);
    }
}

// Gistにデータをアップロード
async function uploadToGist() {
    if (!gistId || !githubToken) return;

    try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'luxury-aircraft-data.json': {
                        content: JSON.stringify({
                            customers,
                            aircraft,
                            sales,
                            salespeople,
                            inventory,
                            cashbox,
                            salaryRecords,
                            lastUpdate: new Date().toISOString()
                        }, null, 2)
                    }
                }
            })
        });
    } catch (error) {
        console.error('Gistアップロードエラー:', error);
    }
}

// 共有データのマージ
function mergeSharedData(remoteData) {
    console.log('リモートデータをマージしています...');
    
    // タイムスタンプベースでのマージ（簡単な実装）
    if (remoteData.customers) {
        customers = mergeArrays(customers, remoteData.customers, 'id');
    }
    if (remoteData.aircraft) {
        aircraft = mergeArrays(aircraft, remoteData.aircraft, 'id');
    }
    if (remoteData.sales) {
        sales = mergeArrays(sales, remoteData.sales, 'id');
    }
    if (remoteData.salespeople) {
        salespeople = mergeArrays(salespeople, remoteData.salespeople, 'id');
    }
    if (remoteData.inventory) {
        inventory = mergeArrays(inventory, remoteData.inventory, 'id');
    }
    if (remoteData.salaryRecords) {
        salaryRecords = mergeArrays(salaryRecords, remoteData.salaryRecords, 'id');
    }
    if (remoteData.cashbox) {
        cashbox = remoteData.cashbox;
    }
    
    // データを保存してUI更新
    saveData();
    updateStats();
    renderDashboard();
    updateSalaryStats();
    renderSalaryDetails();
}

// 配列のマージ（重複除去）
function mergeArrays(localArray, remoteArray, idField) {
    const merged = [...localArray];
    
    remoteArray.forEach(remoteItem => {
        const existingIndex = merged.findIndex(item => item[idField] === remoteItem[idField]);
        if (existingIndex === -1) {
            // 削除マーカーがある場合は追加しない
            if (!remoteItem._deleted) {
                merged.push(remoteItem);
            }
        } else {
            // より新しいタイムスタンプのデータを使用
            const localTimestamp = new Date(merged[existingIndex].timestamp || merged[existingIndex].registrationDate || merged[existingIndex].saleDate || 0).getTime();
            const remoteTimestamp = new Date(remoteItem.timestamp || remoteItem.registrationDate || remoteItem.saleDate || 0).getTime();
            
            if (remoteTimestamp > localTimestamp) {
                if (remoteItem._deleted) {
                    // リモートで削除されている場合はローカルからも削除
                    merged.splice(existingIndex, 1);
                } else {
                    merged[existingIndex] = remoteItem;
                }
            }
        }
    });
    
    return merged;
}

// Gist同期を無効化
function disconnectGistSync() {
    localStorage.removeItem('luxuryAircraftGistId');
    localStorage.removeItem('luxuryAircraftGithubToken');
    gistId = null;
    githubToken = null;
    alert('Gist同期を無効化しました');
    updateSyncStatus();
}

// リアルタイム保存機能の設定
function setupRealTimeSave() {
    // 全ての入力フィールドにリアルタイム保存を追加
    const inputSelectors = [
        'input[type="text"]',
        'input[type="number"]',
        'input[type="date"]',
        'input[type="datetime-local"]',
        'select',
        'textarea'
    ];

    inputSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            // すでにリスナーが設定されている場合はスキップ
            if (element.hasAttribute('data-realtime-save')) return;
            
            element.setAttribute('data-realtime-save', 'true');
            
            // 変更時に自動保存
            element.addEventListener('change', () => {
                debouncedSave();
            });
            
            // 入力時にも自動保存（デバウンス付き）
            element.addEventListener('input', () => {
                debouncedSave();
            });
        });
    });
}

// デバウンス付き保存（500ms後に実行）
function debouncedSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        saveData();
        // Gist同期が有効な場合は自動アップロード
        if (gistId && githubToken) {
            uploadToGist();
        }
    }, 500);
}

// 同期状態の更新
function updateSyncStatus() {
    const statusElement = document.getElementById('sync-status');
    if (!statusElement) return;
    
    if (gistId && githubToken) {
        statusElement.innerHTML = `
            <div class="sync-status active">
                <i class="fas fa-check-circle"></i> GitHub Gist同期: 有効
                <small class="d-block">Gist ID: ${gistId.substring(0, 8)}...</small>
            </div>
        `;
    } else {
        statusElement.innerHTML = `
            <div class="sync-status inactive">
                <i class="fas fa-exclamation-circle"></i> GitHub Gist同期: 無効
            </div>
        `;
    }
}

// ========== データ管理機能 ==========

// 全データのエクスポート
function exportAllData() {
    const allData = {
        customers,
        aircraft,
        sales,
        salespeople,
        inventory,
        cashbox,
        salaryRecords,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `luxury-aircraft-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    alert('データをエクスポートしました');
}

// ファイルからデータをインポート
function importDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (confirm('既存のデータを上書きしますか？この操作は元に戻せません。')) {
                    // データを上書き
                    if (importedData.customers) customers = importedData.customers;
                    if (importedData.aircraft) aircraft = importedData.aircraft;
                    if (importedData.sales) sales = importedData.sales;
                    if (importedData.salespeople) salespeople = importedData.salespeople;
                    if (importedData.inventory) inventory = importedData.inventory;
                    if (importedData.cashbox) cashbox = importedData.cashbox;
                    if (importedData.salaryRecords) salaryRecords = importedData.salaryRecords;
                    
                    // データを保存してUI更新
                    saveData();
                    updateStats();
                    renderDashboard();
                    updateSalaryStats();
                    renderSalaryDetails();
                    
                    alert('データをインポートしました');
                }
            } catch (error) {
                alert('ファイルの読み込みに失敗しました: ' + error.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// 全データのリセット
function resetAllData() {
    if (!confirm('全てのデータを削除しますか？この操作は元に戻せません。')) {
        return;
    }
    
    if (!confirm('最終確認: 本当に全データを削除しますか？')) {
        return;
    }
    
    // 全データを初期化
    customers = [];
    aircraft = [];
    sales = [];
    salespeople = [];
    inventory = [];
    cashbox = { balance: 0, history: [] };
    salaryRecords = [];
    
    // ローカルストレージをクリア
    localStorage.removeItem('aircraftDealerData');
    
    // UI更新
    updateStats();
    renderDashboard();
    updateSalaryStats();
    renderSalaryDetails();
    
    alert('全データを削除しました');
}

// 全ファイルのダウンロード（GitHub Pages用）
function downloadAllFiles() {
    // HTML、CSS、JSファイルの内容を取得してダウンロード
    const htmlContent = document.documentElement.outerHTML;
    
    // HTMLファイルのダウンロード
    const htmlBlob = new Blob([htmlContent], {type: 'text/html'});
    const htmlLink = document.createElement('a');
    htmlLink.href = URL.createObjectURL(htmlBlob);
    htmlLink.download = 'index.html';
    htmlLink.click();
    
    // README.mdの生成とダウンロード
    const readmeContent = generateReadmeContent();
    const readmeBlob = new Blob([readmeContent], {type: 'text/markdown'});
    const readmeLink = document.createElement('a');
    readmeLink.href = URL.createObjectURL(readmeBlob);
    readmeLink.download = 'README.md';
    
    setTimeout(() => {
        readmeLink.click();
    }, 500);
    
    alert('ファイルのダウンロードを開始しました。script.jsとstyle.cssは手動でダウンロードしてください。');
}

// README.mdの内容生成
function generateReadmeContent() {
    const customerCount = customers.length;
    const aircraftCount = aircraft.length;
    const salesCount = sales.length;
    const totalSales = sales.reduce((sum, sale) => sum + (sale.totalPrice || 0), 0);
    
    return `# LUXURY-AIRCRAFT 管理システム

## 📋 システム概要
GTA5 FiveM サーバー「LUXURY-AIRCRAFT」航空機ディーラー管理システム

## 🏢 ディーラー情報
- **登録顧客数**: ${customerCount}名
- **販売機数**: ${aircraftCount}機
- **総販売件数**: ${salesCount}件
- **総売上**: ¥${totalSales.toLocaleString()}

## 🚀 利用方法
1. ブラウザでindex.htmlを開く
2. 各タブで業務管理を実施
3. データは自動的にGitHub Gistで共有されます

## 📊 機能一覧
- 📈 ダッシュボード（統計表示）
- 👥 顧客管理（読み仮名対応）
- ✈️ 航空機販売管理
- 💰 金庫・収支管理
- 👨‍💼 販売員・給与管理
- 📦 在庫車両管理
- 🔄 データ同期機能
- 📤 データエクスポート・インポート

## 🔄 データ同期
- GitHub Gist による自動同期
- 30秒ごとのリアルタイム更新
- 複数人同時作業対応
- データ競合の自動解決

## 🎯 販売管理
- 在庫優先販売（仕入れコスト0円）
- 新規仕入れ販売対応
- 自動利益計算（販売員給与30%、ディーラー利益）
- 割引機能（1台分のみ適用）

## 📱 対応ブラウザ
- Chrome（推奨）
- Firefox
- Safari
- Edge

## 🔧 技術仕様
- フロントエンド: HTML5, CSS3, JavaScript (ES6+)
- UI Framework: Bootstrap 5
- アイコン: Font Awesome 6
- データ保存: LocalStorage + GitHub Gist
- 同期: GitHub API

## 🔄 最終更新
${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}

---
© 2024 LUXURY-AIRCRAFT Management System
`;
}

// GitHub関連の関数
function saveGitHubUrl() {
    const url = document.getElementById('github-repo-url').value.trim();
    if (!url) {
        alert('GitHubリポジトリURLを入力してください');
        return;
    }
    
    if (!url.includes('github.com')) {
        alert('有効なGitHubのURLを入力してください');
        return;
    }
    
    localStorage.setItem('luxuryAircraft_githubUrl', url);
    alert('GitHubリポジトリURLを保存しました');
}

function savePublicUrl() {
    const url = document.getElementById('github-pages-url').value.trim();
    if (!url) {
        alert('GitHub Pages URLを入力してください');
        return;
    }
    
    if (!url.includes('github.io')) {
        alert('有効なGitHub PagesのURLを入力してください');
        return;
    }
    
    localStorage.setItem('luxuryAircraft_publicUrl', url);
    alert('公開URLを保存しました');
}

function openGitHubRepo() {
    const url = document.getElementById('github-repo-url').value.trim();
    if (!url) {
        alert('GitHubリポジトリURLを入力してください');
        return;
    }
    window.open(url, '_blank');
}

function openPublicPage() {
    const url = document.getElementById('github-pages-url').value.trim();
    if (!url) {
        alert('GitHub Pages URLを入力してください');
        return;
    }
    window.open(url, '_blank');
}

function copyPublicUrl() {
    const url = document.getElementById('github-pages-url').value.trim();
    if (!url) {
        alert('GitHub Pages URLを入力してください');
        return;
    }
    
    navigator.clipboard.writeText(url).then(() => {
        alert('URLをクリップボードにコピーしました！');
    }).catch(() => {
        // フォールバック
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('URLをクリップボードにコピーしました！');
    });
}

// 保存されたURLの読み込み
function loadSavedUrls() {
    const githubUrl = localStorage.getItem('luxuryAircraft_githubUrl');
    const publicUrl = localStorage.getItem('luxuryAircraft_publicUrl');
    
    if (githubUrl) {
        const githubInput = document.getElementById('github-repo-url');
        if (githubInput) githubInput.value = githubUrl;
    }
    
    if (publicUrl) {
        const publicInput = document.getElementById('github-pages-url');
        if (publicInput) publicInput.value = publicUrl;
    }
}

