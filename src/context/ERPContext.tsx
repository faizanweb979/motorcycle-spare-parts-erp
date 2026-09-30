import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, writeBatch, setDoc, deleteDoc, getDocs, query, where, orderBy, limit, onSnapshot, runTransaction, serverTimestamp, increment, clearIndexedDbPersistence, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  Part,
  Customer,
  Supplier,
  Sale,
  Purchase,
  Adjustment,
  AuditLog,
  ShopSettings,
  Payment,
  LedgerEntry,
  Expense,
  Partner,
  Drawing
} from '../types';

interface ERPContextType {
  parts: Part[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  adjustments: Adjustment[];
  auditLogs: AuditLog[];
  settings: ShopSettings;
  payments: Payment[];
  ledgerEntries: LedgerEntry[];
  expenses: Expense[];
  partners: Partner[];
  drawings: Drawing[];
  loading: boolean;
  error: string | null;
  
  // Actions
  addPart: (part: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePart: (id: string, part: Partial<Part>) => Promise<void>;
  deletePart: (id: string) => Promise<void>;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  
  createSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'invoiceNumber'>) => Promise<Sale>;
  returnSale: (saleId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => Promise<void>;
  
  createPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt' | 'invoiceNumber'>) => Promise<Purchase>;
  returnPurchase: (purchaseId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => Promise<void>;
  
  recordCustomerPayment: (paymentData: Omit<Payment, 'id' | 'voucherNumber' | 'entityType' | 'recordedBy' | 'createdAt'>) => Promise<void>;
  recordSupplierPayment: (paymentData: Omit<Payment, 'id' | 'voucherNumber' | 'entityType' | 'recordedBy' | 'createdAt'>) => Promise<void>;
  
  addAdjustment: (adjustment: Omit<Adjustment, 'id' | 'createdAt'>) => Promise<void>;
  updateSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  addManualAuditLog: (action: string, details: string) => Promise<void>;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addPartner: (partner: Omit<Partner, 'id' | 'createdAt'>) => Promise<void>;
  updatePartner: (id: string, partner: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;

  addDrawing: (drawing: Omit<Drawing, 'id' | 'createdAt'>) => Promise<void>;
  updateDrawing: (id: string, drawing: Partial<Drawing>) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;

  // Syncing & Offline states
  syncStatus: 'online' | 'syncing' | 'offline';
  lastSyncTime: string | null;
  pendingSyncCount: number;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) throw new Error('useERP must be used within an ERPProvider');
  return context;
};

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [settings, setSettings] = useState<ShopSettings>({
    shopName: 'BIN ADAM TRADERS',
    phone: '0300-1234567',
    address: 'McLeod Road, Lahore, Pakistan',
    currency: 'Rs.',
    footerMessage: 'Thank you for your business! Guarantees only on genuine parts.'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipCache, setSkipCache] = useState(false);

  // Firestore Offline Sync Tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeWritesCount, setActiveWritesCount] = useState(0);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('erp_last_sync_time') || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const totalPendingDocs = Object.values(pendingCounts).reduce((a: number, b: number) => a + b, 0);
  const pendingSyncCount = totalPendingDocs + activeWritesCount;

  const syncStatus = !isOnline 
    ? 'offline' 
    : pendingSyncCount > 0 
      ? 'syncing' 
      : 'online';

  useEffect(() => {
    if (syncStatus === 'online') {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);
      localStorage.setItem('erp_last_sync_time', now);
    }
  }, [syncStatus]);

  // Helper to wrap manual triggers
  const trackWrite = async <T,>(operation: () => Promise<T>): Promise<T> => {
    setActiveWritesCount(prev => prev + 1);
    try {
      const result = await operation();
      return result;
    } finally {
      setActiveWritesCount(prev => Math.max(0, prev - 1));
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // ── Seed counters above existing data on first use ───────────────────
    // Runs silently in background; does not block UI load.
    // Uses a transaction so two tabs seeding simultaneously cannot race.
    const seedCountersIfNeeded = async () => {
      try {
        // Determine the highest existing number for each counter type
        // by scanning existing documents.
        const [salesSnap, purchasesSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'purchases')),
          getDocs(collection(db, 'payments'))
        ]);

        // Extract max invoice numbers from existing sales (format: INV-MT-NNNN)
        let maxSalesSeq = 1000; // default: next will be 1001
        salesSnap.forEach(d => {
          const inv: string = d.data().invoiceNumber || '';
          const match = inv.match(/^INV-MT-(\d+)$/);
          if (match) maxSalesSeq = Math.max(maxSalesSeq, parseInt(match[1], 10));
        });

        // Extract max from purchases (format: PUR-MT-NNNN)
        let maxPurchaseSeq = 5000; // default: next will be 5001
        purchasesSnap.forEach(d => {
          const inv: string = d.data().invoiceNumber || '';
          const match = inv.match(/^PUR-MT-(\d+)$/);
          if (match) maxPurchaseSeq = Math.max(maxPurchaseSeq, parseInt(match[1], 10));
        });

        // Extract max from payments — split by REC- and PAY-
        let maxRecSeq = 100000;  // next: REC-100001
        let maxPaySeq = 100000;  // next: PAY-100001
        paymentsSnap.forEach(d => {
          const vn: string = d.data().voucherNumber || '';
          const recMatch = vn.match(/^REC-(\d+)$/);
          const payMatch = vn.match(/^PAY-(\d+)$/);
          if (recMatch) maxRecSeq = Math.max(maxRecSeq, parseInt(recMatch[1], 10));
          if (payMatch) maxPaySeq = Math.max(maxPaySeq, parseInt(payMatch[1], 10));
        });

        // For each counter, set it to the current max if the counter document
        // doesn't already exist or is lower than the data max.
        const counterUpdates = [
          { name: 'salesInvoice',    floor: maxSalesSeq },
          { name: 'purchaseInvoice', floor: maxPurchaseSeq },
          { name: 'customerReceipt', floor: maxRecSeq },
          { name: 'supplierPayment', floor: maxPaySeq }
        ];

        for (const { name, floor } of counterUpdates) {
          await runTransaction(db, async (txn) => {
            const ref = doc(db, 'counters', name);
            const snap = await txn.get(ref);
            if (!snap.exists() || (snap.data().seq as number) < floor) {
              txn.set(ref, { seq: floor });
            }
          });
        }
      } catch (e) {
        // Non-fatal: counters will self-correct on first allocation
        console.warn('Counter seeding failed (non-fatal):', e);
      }
    };

    seedCountersIfNeeded();

    // Set up real-time observers with error handlers mapped exactly to standard
    const unsubParts = onSnapshot(collection(db, 'parts'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Part[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Part));
      setParts(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, parts: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'parts');
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Customer[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, customers: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'customers');
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Supplier[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, suppliers: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'suppliers');
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Sale[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Sale));
      // Sort sales by date desc
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSales(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, sales: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sales');
    });

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Purchase[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Purchase));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPurchases(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, purchases: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'purchases');
    });

    const unsubAdjustments = onSnapshot(collection(db, 'adjustments'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Adjustment[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Adjustment));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAdjustments(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, adjustments: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'adjustments');
    });

    const unsubAuditLogs = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(150)),
      { includeMetadataChanges: true },
      (snapshot) => {
        const items: AuditLog[] = [];
        snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as AuditLog));
        setAuditLogs(items);
        setLoading(false);
        const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
        setPendingCounts(prev => ({ ...prev, auditLogs: pendingCount }));
      },
      (err) => {
        // Fallback without ordering if index is not ready yet
        const unsubFallback = onSnapshot(collection(db, 'audit_logs'), { includeMetadataChanges: true }, (snap) => {
          const fallbackItems: AuditLog[] = [];
          snap.forEach((d) => fallbackItems.push({ id: d.id, ...d.data() } as AuditLog));
          fallbackItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAuditLogs(fallbackItems.slice(0, 150));
          setLoading(false);
          const pendingCount = snap.docs.filter(d => d.metadata.hasPendingWrites).length;
          setPendingCounts(prev => ({ ...prev, auditLogs: pendingCount }));
        });
        return () => unsubFallback();
      }
    );

    // Shop settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'shop'), { includeMetadataChanges: true }, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as ShopSettings);
      }
      const pendingCount = doc.metadata.hasPendingWrites ? 1 : 0;
      setPendingCounts(prev => ({ ...prev, settings: pendingCount }));
    });

    const unsubPayments = onSnapshot(collection(db, 'payments'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Payment[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Payment));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, payments: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'payments');
    });

    const unsubLedgerEntries = onSnapshot(collection(db, 'ledger_entries'), { includeMetadataChanges: true }, (snapshot) => {
      const items: LedgerEntry[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as LedgerEntry));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLedgerEntries(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, ledgerEntries: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'ledger_entries');
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Expense[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Expense));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, expenses: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
    });

    const unsubPartners = onSnapshot(collection(db, 'partners'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Partner[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Partner));
      items.sort((a, b) => b.investment - a.investment);
      setPartners(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, partners: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'partners');
    });

    const unsubDrawings = onSnapshot(collection(db, 'drawings'), { includeMetadataChanges: true }, (snapshot) => {
      const items: Drawing[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Drawing));
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDrawings(items);
      const pendingCount = snapshot.docs.filter(d => d.metadata.hasPendingWrites).length;
      setPendingCounts(prev => ({ ...prev, drawings: pendingCount }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'drawings');
    });

    return () => {
      unsubParts();
      unsubCustomers();
      unsubSuppliers();
      unsubSales();
      unsubPurchases();
      unsubAdjustments();
      unsubAuditLogs();
      unsubSettings();
      unsubPayments();
      unsubLedgerEntries();
      unsubExpenses();
      unsubPartners();
      unsubDrawings();
    };
  }, [auth.currentUser]);

  // Log action
  const addAuditLog = async (batch: any, action: string, details: string) => {
    const userEmail = auth.currentUser?.email || 'Unknown User';
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, {
      userEmail,
      action,
      details,
      createdAt: new Date().toISOString()
    });
  };

  const addManualAuditLog = async (action: string, details: string) => {
    try {
      const userEmail = auth.currentUser?.email || 'Unknown User';
      const logRef = doc(collection(db, 'audit_logs'));
      await setDoc(logRef, {
        userEmail,
        action,
        details,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
    }
  };

  // 1. PARTS MASTER Actions
  const addPart = async (partData: Omit<Part, 'id' | 'createdAt' | 'updatedAt'>) => {
    const batch = writeBatch(db);
    const newPartRef = doc(collection(db, 'parts'));
    const id = newPartRef.id;
    const now = new Date().toISOString();
    
    const part: Part = {
      ...partData,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    batch.set(newPartRef, part);
    
    // Add initial adjustment record for stock
    if (part.stock > 0) {
      const adjRef = doc(collection(db, 'adjustments'));
      const adjustment: Adjustment = {
        id: adjRef.id,
        partId: id,
        partName: part.name,
        type: 'adjustment_add',
        quantity: part.stock,
        price: part.purchasePrice,
        referenceId: 'INITIAL_STOCK',
        reason: 'Initial setup of part stock',
        createdAt: now
      };
      batch.set(adjRef, adjustment);
    }

    addAuditLog(batch, 'ADD_PART', `Added new spare part: ${part.name} (${part.brand}, Comp: ${part.modelCompatibility}) with initial stock ${part.stock}`);
    
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `parts/${id}`);
    }
  };

  const updatePart = async (id: string, partData: Partial<Part>) => {
    const batch = writeBatch(db);
    const partRef = doc(db, 'parts', id);
    const now = new Date().toISOString();

    const updatePayload = {
      ...partData,
      updatedAt: now
    };

    batch.update(partRef, updatePayload);
    addAuditLog(batch, 'UPDATE_PART', `Updated part details for: ${partData.name || id}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `parts/${id}`);
    }
  };

  const deletePart = async (id: string) => {
    const batch = writeBatch(db);
    const partRef = doc(db, 'parts', id);
    const deletedName = parts.find(p => p.id === id)?.name || id;

    // Check transaction history references across sales, purchases, and adjustments
    const isReferencedInSales = sales.some(s => s.items.some(item => item.partId === id));
    const isReferencedInPurchases = purchases.some(p => p.items.some(item => item.partId === id));
    const isReferencedInAdjustments = adjustments.some(a => a.partId === id);

    const hasHistory = isReferencedInSales || isReferencedInPurchases || isReferencedInAdjustments;

    if (hasHistory) {
      // Soft-delete (archive) to preserve full transaction history
      batch.update(partRef, {
        isArchived: true,
        updatedAt: new Date().toISOString()
      });
      addAuditLog(batch, 'ARCHIVE_PART', `Archived spare part with transaction history: ${deletedName}`);
    } else {
      // Unused record: hard delete allowed
      batch.delete(partRef);
      addAuditLog(batch, 'DELETE_PART', `Permanently deleted unused spare part: ${deletedName}`);
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `parts/${id}`);
    }
  };

  // 2. CUSTOMERS Actions
  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const custRef = doc(collection(db, 'customers'));
    const id = custRef.id;
    const now = new Date().toISOString();

    const newCustomer: Customer = {
      ...customerData,
      balance: Number(customerData.balance) || 0,
      id,
      createdAt: now
    };

    batch.set(custRef, newCustomer);

    if (newCustomer.balance !== 0) {
      const ledgerRef = doc(collection(db, 'ledger_entries'));
      const isDebit = newCustomer.balance > 0;
      const ledgerEntry: LedgerEntry = {
        id: ledgerRef.id,
        entityId: id,
        entityType: 'customer',
        date: now,
        transactionType: 'starting_balance',
        referenceId: 'STARTING_BALANCE',
        referenceNumber: 'OB-START',
        description: 'Starting Balance (Opening Balance)',
        debit: isDebit ? newCustomer.balance : 0,
        credit: !isDebit ? Math.abs(newCustomer.balance) : 0,
        createdAt: now
      };
      batch.set(ledgerRef, ledgerEntry);
    }

    addAuditLog(batch, 'ADD_CUSTOMER', `Registered customer: ${newCustomer.name} (Phone: ${newCustomer.phone}) with starting ledger balance Rs. ${newCustomer.balance}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    }
  };

  const updateCustomer = async (id: string, customerData: Partial<Customer>) => {
    try {
      // Find existing starting_balance ledger entries for this customer
      const ledgerQuery = query(
        collection(db, 'ledger_entries'),
        where('entityId', '==', id),
        where('entityType', '==', 'customer')
      );
      const ledgerSnap = await getDocs(ledgerQuery);
      const openingDocs = ledgerSnap.docs.filter(
        d => d.data().transactionType === 'starting_balance' || d.data().referenceId === 'STARTING_BALANCE'
      );

      await runTransaction(db, async (txn) => {
        // ── Phase 1: Read all data first ───────────────────────────────────────
        const custRef = doc(db, 'customers', id);
        const custSnap = await txn.get(custRef);
        if (!custSnap.exists()) {
          throw new Error(`Customer ${id} not found.`);
        }

        const existingCust = custSnap.data() as Customer;
        const now = new Date().toISOString();

        if (customerData.balance !== undefined) {
          const newOB = Number(customerData.balance) || 0;
          let oldOB = 0;
          const primaryOpeningDoc = openingDocs.length > 0 ? openingDocs[0] : null;

          // ── Phase 1: Read all data first (no writes yet) ─────────────────────
          let primarySnap = null;
          if (primaryOpeningDoc) {
            primarySnap = await txn.get(primaryOpeningDoc.ref);
            if (primarySnap.exists()) {
              const entryData = primarySnap.data() as LedgerEntry;
              oldOB = (entryData.debit || 0) - (entryData.credit || 0);
            }
          }

          // ── Phase 2: All writes after reads ───────────────────────────────────
          const deltaOB = newOB - oldOB;
          const currentProfileBalance = Number(existingCust.balance) || 0;
          const updatedProfileBalance = currentProfileBalance + deltaOB;

          const isDebit = newOB > 0;
          const newDebit = isDebit ? newOB : 0;
          const newCredit = !isDebit ? Math.abs(newOB) : 0;

          if (primaryOpeningDoc) {
            txn.update(primaryOpeningDoc.ref, {
              debit: newDebit,
              credit: newCredit,
              description: 'Starting Balance (Opening Balance)'
            });

            // Delete any duplicate opening entries if found
            for (let i = 1; i < openingDocs.length; i++) {
              txn.delete(openingDocs[i].ref);
            }
          } else {
            // Create opening ledger entry if not present
            const newLedgerRef = doc(collection(db, 'ledger_entries'));
            const ledgerEntry: LedgerEntry = {
              id: newLedgerRef.id,
              entityId: id,
              entityType: 'customer',
              date: now,
              transactionType: 'starting_balance',
              referenceId: 'STARTING_BALANCE',
              referenceNumber: 'OPENING',
              description: 'Starting Balance (Opening Balance)',
              debit: newDebit,
              credit: newCredit,
              createdAt: now
            };
            txn.set(newLedgerRef, ledgerEntry);
          }

          txn.update(custRef, { balance: updatedProfileBalance });
        }

        txn.update(custRef, customerData);
      });

      await addManualAuditLog('UPDATE_CUSTOMER', `Updated customer details/opening balance for: ${customerData.name || id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `customers/${id}`);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const custRef = doc(db, 'customers', id);
      const deletedName = customers.find(c => c.id === id)?.name || id;

      // Check transaction history references across sales, payments, and ledger entries
      const isReferencedInSales = sales.some(s => s.customerId === id);
      const isReferencedInPayments = payments.some(p => p.entityId === id && p.entityType === 'customer');
      const isReferencedInLedger = ledgerEntries.some(l => l.entityId === id && l.entityType === 'customer');

      const hasHistory = isReferencedInSales || isReferencedInPayments || isReferencedInLedger;

      if (hasHistory) {
        await updateDoc(custRef, { isArchived: true });
        await addManualAuditLog('ARCHIVE_CUSTOMER', `Archived customer profile with transaction history: ${deletedName}`);
      } else {
        await deleteDoc(custRef);
        await addManualAuditLog('DELETE_CUSTOMER', `Permanently deleted unused customer profile: ${deletedName}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
    }
  };

  // 3. SUPPLIERS Actions
  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const suppRef = doc(collection(db, 'suppliers'));
    const id = suppRef.id;
    const now = new Date().toISOString();

    const newSupplier: Supplier = {
      ...supplierData,
      balance: Number(supplierData.balance) || 0,
      id,
      createdAt: now
    };

    batch.set(suppRef, newSupplier);

    if (newSupplier.balance !== 0) {
      const ledgerRef = doc(collection(db, 'ledger_entries'));
      const isCredit = newSupplier.balance > 0;
      const ledgerEntry: LedgerEntry = {
        id: ledgerRef.id,
        entityId: id,
        entityType: 'supplier',
        date: now,
        transactionType: 'starting_balance',
        referenceId: 'STARTING_BALANCE',
        referenceNumber: 'OB-START',
        description: 'Starting Balance (Opening Balance)',
        debit: !isCredit ? Math.abs(newSupplier.balance) : 0,
        credit: isCredit ? newSupplier.balance : 0,
        createdAt: now
      };
      batch.set(ledgerRef, ledgerEntry);
    }

    addAuditLog(batch, 'ADD_SUPPLIER', `Registered supplier: ${newSupplier.name} (Phone: ${newSupplier.phone}) with starting credit balance Rs. ${newSupplier.balance}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'suppliers');
    }
  };

  const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    try {
      // Find existing starting_balance ledger entries for this supplier
      const ledgerQuery = query(
        collection(db, 'ledger_entries'),
        where('entityId', '==', id),
        where('entityType', '==', 'supplier')
      );
      const ledgerSnap = await getDocs(ledgerQuery);
      const openingDocs = ledgerSnap.docs.filter(
        d => d.data().transactionType === 'starting_balance' || d.data().referenceId === 'STARTING_BALANCE'
      );

      await runTransaction(db, async (txn) => {
        const suppRef = doc(db, 'suppliers', id);
        const suppSnap = await txn.get(suppRef);
        if (!suppSnap.exists()) {
          throw new Error(`Supplier ${id} not found.`);
        }

        const existingSupp = suppSnap.data() as Supplier;
        const now = new Date().toISOString();

        if (supplierData.balance !== undefined) {
          const newOB = Number(supplierData.balance) || 0;
          let oldOB = 0;
          const primaryOpeningDoc = openingDocs.length > 0 ? openingDocs[0] : null;

          if (primaryOpeningDoc) {
            // ── Phase 1 continued: Read all data first (no writes yet) ───────────
            const primarySnap = await txn.get(primaryOpeningDoc.ref);
            if (primarySnap.exists()) {
              const entryData = primarySnap.data() as LedgerEntry;
              oldOB = (entryData.credit || 0) - (entryData.debit || 0);
            }
          }

          // ── Phase 2: All writes after reads ───────────────────────────────────

          const deltaOB = newOB - oldOB;
          const currentProfileBalance = Number(existingSupp.balance) || 0;
          const updatedProfileBalance = currentProfileBalance + deltaOB;

          const isCredit = newOB > 0;
          const newCredit = isCredit ? newOB : 0;
          const newDebit = !isCredit ? Math.abs(newOB) : 0;

          if (primaryOpeningDoc) {
            txn.update(primaryOpeningDoc.ref, {
              debit: newDebit,
              credit: newCredit,
              description: 'Starting Balance (Opening Balance)'
            });

            // Delete any duplicate opening entries if found
            for (let i = 1; i < openingDocs.length; i++) {
              txn.delete(openingDocs[i].ref);
            }
          } else {
            // Create opening ledger entry if not present
            const newLedgerRef = doc(collection(db, 'ledger_entries'));
            const ledgerEntry: LedgerEntry = {
              id: newLedgerRef.id,
              entityId: id,
              entityType: 'supplier',
              date: existingSupp.createdAt || now,
              transactionType: 'starting_balance',
              referenceId: 'STARTING_BALANCE',
              referenceNumber: 'OB-START',
              description: 'Starting Balance (Opening Balance)',
              debit: newDebit,
              credit: newCredit,
              createdAt: existingSupp.createdAt || now
            };
            txn.set(newLedgerRef, ledgerEntry);
          }

          supplierData.balance = updatedProfileBalance;
        }

        txn.update(suppRef, supplierData);
      });

      await addManualAuditLog('UPDATE_SUPPLIER', `Updated supplier details/opening balance for: ${supplierData.name || id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `suppliers/${id}`);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const suppRef = doc(db, 'suppliers', id);
      const deletedName = suppliers.find(s => s.id === id)?.name || id;

      // Check transaction history references across purchases, payments, and ledger entries
      const isReferencedInPurchases = purchases.some(p => p.supplierId === id);
      const isReferencedInPayments = payments.some(p => p.entityId === id && p.entityType === 'supplier');
      const isReferencedInLedger = ledgerEntries.some(l => l.entityId === id && l.entityType === 'supplier');

      const hasHistory = isReferencedInPurchases || isReferencedInPayments || isReferencedInLedger;

      if (hasHistory) {
        await updateDoc(suppRef, { isArchived: true });
        await addManualAuditLog('ARCHIVE_SUPPLIER', `Archived supplier profile with transaction history: ${deletedName}`);
      } else {
        await deleteDoc(suppRef);
        await addManualAuditLog('DELETE_SUPPLIER', `Permanently deleted unused supplier profile: ${deletedName}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  // ── ATOMIC SEQUENCE COUNTER SYSTEM ───────────────────────────────────────
  //
  // Counter documents live at: counters/{counterName}  →  { seq: number }
  //
  // allocateSequence(txn, counterName, minValue)
  //   Must be called INSIDE an existing runTransaction() callback.
  //   Reads the counter, ensures it is at least minValue, increments by 1,
  //   writes the new value back, and returns the new sequence number.
  //   Two concurrent transactions on the same counter will contend and retry,
  //   guaranteeing uniqueness.
  //
  // ensureCounterExists(counterName, minValue)
  //   Called once at startup and before each sequence allocation.
  //   If the counter document does not exist, creates it at minValue - 1
  //   so the first allocation returns minValue.
  //   Safe to call concurrently (uses setDoc merge: false only if absent).

  const allocateSequence = (txn: any, counterName: string, minValue: number): Promise<number> => {
    // This is a synchronous helper used INSIDE a runTransaction callback.
    // It reads via txn.get, increments, txn.set, and returns the new seq.
    // (Must be awaited by the caller.)
    const counterRef = doc(db, 'counters', counterName);
    return txn.get(counterRef).then((snap: any) => {
      const current = snap.exists() ? (snap.data().seq as number) : minValue - 1;
      const next = Math.max(current, minValue - 1) + 1;
      txn.set(counterRef, { seq: next });
      return next;
    });
  };

  // Ensures counter exists and is seeded above existing data.
  // Called inside the transaction (via allocateSequence) so no separate call needed.
  // However, we expose this for use in createSale's existing transaction.

  // 4. SALES (POS) Actions
  const createSale = async (saleData: Omit<Sale, 'id' | 'createdAt' | 'invoiceNumber'>): Promise<Sale> => {
    // ── Debug auth state ──────────────────────────────────────────────────────
    console.log('createSale - Auth check:', auth.currentUser);
    console.log('createSale - Auth email:', auth.currentUser?.email);
    console.log('createSale - Auth UID:', auth.currentUser?.uid);
    
    // ── Offline guard ────────────────────────────────────────────────────────
    // runTransaction requires a live server round-trip for stock validation.
    // Firestore's offline persistence would queue the write without ever
    // executing the read-validate logic, defeating the concurrency protection.
    if (!navigator.onLine) {
      throw new Error('You are offline. Please reconnect to complete the sale. Stock cannot be validated without a server connection.');
    }

    const now = new Date().toISOString();

    // Pre-allocate doc refs outside the transaction so IDs are stable
    const saleRef = doc(collection(db, 'sales'));
    const id = saleRef.id;
    const adjRefs = saleData.items.map(() => doc(collection(db, 'adjustments')));
    const auditRef = doc(collection(db, 'audit_logs'));

    // Customer ledger refs (allocated outside transaction for stable IDs)
    const ledgerRef = doc(collection(db, 'ledger_entries'));
    const adjLedgerRef = doc(collection(db, 'ledger_entries'));
    const saleAdvLedgerRef = doc(collection(db, 'ledger_entries'));

    // invoiceNumber is allocated atomically inside the transaction below
    let completedSale: Sale;

    try {
      await runTransaction(db, async (txn) => {
        // ── Phase 1: Read latest server stock for every item ─────────────────
        const partDocs = await Promise.all(
          saleData.items.map(item => txn.get(doc(db, 'parts', item.partId)))
        );

        // ── Phase 2: Read customer doc if needed ─────────────────────────────
        let custSnap = null;
        if (saleData.customerId !== 'CASH-CUSTOMER') {
          custSnap = await txn.get(doc(db, 'customers', saleData.customerId));
        }

        // ── Phase 3: Allocate atomic invoice number (after all reads) ─────────
        const seqNum = await allocateSequence(txn, 'salesInvoice', 1001);
        const invoiceNumber = `INV-MT-${seqNum}`;

        // ── Phase 4: Validate stock server-side ──────────────────────────────
        const insufficientItems: string[] = [];
        for (let i = 0; i < saleData.items.length; i++) {
          const item = saleData.items[i];
          const snap = partDocs[i];
          if (!snap.exists()) {
            insufficientItems.push(`${item.name} (part not found in database)`);
            continue;
          }
          const serverStock = (snap.data() as Part).stock ?? 0;
          if (item.quantity <= 0) {
            insufficientItems.push(`${item.name} (invalid quantity: ${item.quantity})`);
          } else if (serverStock < item.quantity) {
            insufficientItems.push(`${item.name} (requested: ${item.quantity}, available: ${serverStock})`);
          }
        }

        if (insufficientItems.length > 0) {
          throw new Error(`Insufficient stock for:\n• ${insufficientItems.join('\n• ')}\n\nSale rejected. No changes were made.`);
        }

        // ── Phase 5: Build and write sale document ────────────────────────────
        const newSale: Sale = {
          ...saleData,
          id,
          invoiceNumber,
          createdAt: now
        };
        txn.set(saleRef, newSale);
        completedSale = newSale;

        // ── Phase 6: Deduct stock atomically using server-validated values ────
        for (let i = 0; i < saleData.items.length; i++) {
          const item = saleData.items[i];
          const snap = partDocs[i];
          const serverStock = (snap.data() as Part).stock;
          const partRef = doc(db, 'parts', item.partId);

          // Use the server-read stock value, not client cache
          txn.update(partRef, {
            stock: serverStock - item.quantity,
            updatedAt: now
          });

          // Adjustment log
          txn.set(adjRefs[i], {
            id: adjRefs[i].id,
            partId: item.partId,
            partName: item.name,
            type: 'sale',
            quantity: item.quantity,
            price: item.retailPrice,
            referenceId: invoiceNumber,
            reason: `Sold via POS Invoice ${invoiceNumber}`,
            createdAt: now
          } as Adjustment);
        }

        // ── Phase 7: Customer balance & ledger ───────────────────────────────
        if (saleData.customerId !== 'CASH-CUSTOMER' && custSnap && custSnap.exists()) {
          const custData = custSnap.data() as Customer;
          let newBalance = Number(custData.balance) || 0;
          let newAdvance = Number(custData.advance) || 0;
          const customerRef = doc(db, 'customers', saleData.customerId);

          const netPayable = newSale.totalAmount - newSale.discount;
          const netDifference = netPayable - newSale.paidAmount;

          if (netDifference > 0) {
            const advanceToAdjust = Math.min(newAdvance, netDifference);
            if (advanceToAdjust > 0) {
              newAdvance -= advanceToAdjust;
              newBalance += netDifference - advanceToAdjust;
              txn.set(adjLedgerRef, {
                id: adjLedgerRef.id,
                entityId: saleData.customerId,
                entityType: 'customer',
                date: now,
                transactionType: 'payment_received',
                referenceId: id,
                referenceNumber: invoiceNumber,
                description: `Advance Balance Applied: Rs. ${advanceToAdjust} applied to POS Bill ${invoiceNumber}`,
                debit: 0,
                credit: advanceToAdjust,
                createdAt: now
              } as LedgerEntry);
            } else {
              newBalance += netDifference;
            }
          } else if (netDifference < 0) {
            const extraPaid = Math.abs(netDifference);
            if (extraPaid > newBalance) {
              const excessAdvance = extraPaid - newBalance;
              newBalance = 0;
              newAdvance += excessAdvance;
              txn.set(saleAdvLedgerRef, {
                id: saleAdvLedgerRef.id,
                entityId: saleData.customerId,
                entityType: 'customer',
                date: now,
                transactionType: 'payment_received',
                referenceId: id,
                referenceNumber: invoiceNumber,
                description: `Customer Advance Saved: Rs. ${excessAdvance.toLocaleString()} from overpayment on POS Bill ${invoiceNumber}`,
                debit: excessAdvance,
                credit: 0,
                createdAt: now
              } as LedgerEntry);
            } else {
              newBalance -= extraPaid;
            }
          }

          txn.update(customerRef, { balance: newBalance, advance: newAdvance });

          txn.set(ledgerRef, {
            id: ledgerRef.id,
            entityId: saleData.customerId,
            entityType: 'customer',
            date: now,
            transactionType: 'sale',
            referenceId: id,
            referenceNumber: invoiceNumber,
            description: `POS Bill: ${newSale.items.length} items sold`,
            debit: newSale.totalAmount - newSale.discount,
            credit: newSale.paidAmount,
            createdAt: now
          } as LedgerEntry);
        }

        // ── Phase 8: Audit log ────────────────────────────────────────────────
        const userEmail = auth.currentUser?.email || 'Unknown User';
        txn.set(auditRef, {
          id: auditRef.id,
          userEmail,
          action: 'CREATE_SALE',
          details: `POS Sale generated: ${invoiceNumber}. Total: Rs. ${newSale.totalAmount}, Paid: Rs. ${newSale.paidAmount}, Balance Credit: Rs. ${newSale.balanceAmount} for customer: ${newSale.customerName}`,
          createdAt: now
        } as AuditLog);
      });
    } catch (err: any) {
      // Re-throw with the original message (stock validation errors have user-friendly text)
      console.error('createSale transaction failed:', err);
      throw err;
    }

    return completedSale!;
  };

  // Sales Return — uses atomic increment() for stock restoration so concurrent ops accumulate correctly.
  // Customer balance adjustment uses a runTransaction to read the latest balance server-side.
  const returnSale = async (saleId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => {
    // Offline guard: server reads required for customer balance transaction
    if (!navigator.onLine) {
      throw new Error('You are offline. Please reconnect to process the sales return.');
    }

    const originalSale = sales.find(s => s.id === saleId);
    if (!originalSale) return;

    const now = new Date().toISOString();

    // Pre-allocate doc refs outside transaction for stable IDs
    const saleRef = doc(db, 'sales', saleId);
    const adjRefs = returnedItems.map(() => doc(collection(db, 'adjustments')));
    const auditRef = doc(collection(db, 'audit_logs'));
    const ledgerRef = doc(collection(db, 'ledger_entries'));

    // Use a batch for the parts stock increments + adjustment logs + sale status
    // (increment() is safe without a transaction for stock addition — it accumulates atomically)
    const batch = writeBatch(db);

    // Atomically increment stock for each returned part
    returnedItems.forEach((retItem, i) => {
      const partRef = doc(db, 'parts', retItem.partId);
      // increment() uses server-side arithmetic — safe under concurrent writes
      batch.update(partRef, {
        stock: increment(retItem.quantity),
        updatedAt: now
      });

      const currentPart = parts.find(p => p.id === retItem.partId);
      batch.set(adjRefs[i], {
        id: adjRefs[i].id,
        partId: retItem.partId,
        partName: currentPart?.name || 'Returned Part',
        type: 'sales_return',
        quantity: retItem.quantity,
        price: currentPart?.retailPrice || 0,
        referenceId: originalSale.invoiceNumber,
        reason: `Returned from Sales Invoice ${originalSale.invoiceNumber}`,
        createdAt: now
      } as Adjustment);
    });

    // Update sale status
    batch.update(saleRef, {
      status: 'returned',
      updatedAt: now
    });

    // Customer balance: use runTransaction to read latest server balance
    if (originalSale.customerId !== 'CASH-CUSTOMER' && refundAmount > 0) {
      await runTransaction(db, async (txn) => {
        const custSnap = await txn.get(doc(db, 'customers', originalSale.customerId));
        if (!custSnap.exists()) return;

        const custData = custSnap.data() as Customer;
        const currentBal = Number(custData.balance) || 0;
        let newBalance = currentBal;
        let newAdvance = Number(custData.advance) || 0;

        if (refundAmount > currentBal) {
          const extraRefund = refundAmount - currentBal;
          newBalance = 0;
          newAdvance += extraRefund;
        } else {
          newBalance -= refundAmount;
        }

        txn.update(doc(db, 'customers', originalSale.customerId), {
          balance: newBalance,
          advance: newAdvance
        });

        txn.set(ledgerRef, {
          id: ledgerRef.id,
          entityId: originalSale.customerId,
          entityType: 'customer',
          date: now,
          transactionType: 'sales_return',
          referenceId: saleId,
          referenceNumber: originalSale.invoiceNumber,
          description: `Sales Return: Returned ${returnedItems.length} items`,
          debit: 0,
          credit: refundAmount,
          createdAt: now
        } as LedgerEntry);

        const userEmail = auth.currentUser?.email || 'Unknown User';
        txn.set(auditRef, {
          id: auditRef.id,
          userEmail,
          action: 'SALE_RETURN',
          details: `Returned sale invoice ${originalSale.invoiceNumber}. Returned parts count: ${returnedItems.length}, Balance Adjustment Rs. ${refundAmount}`,
          createdAt: now
        } as AuditLog);
      });
    } else {
      // No customer balance to update — write audit log in the batch
      const userEmail = auth.currentUser?.email || 'Unknown User';
      batch.set(auditRef, {
        id: auditRef.id,
        userEmail,
        action: 'SALE_RETURN',
        details: `Returned sale invoice ${originalSale.invoiceNumber}. Returned parts count: ${returnedItems.length}, Balance Adjustment Rs. ${refundAmount}`,
        createdAt: now
      } as AuditLog);
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sales/${saleId}`);
      throw err;
    }
  };

  // 5. PURCHASES Actions
  const createPurchase = async (purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'invoiceNumber'>) => {
    // Offline guard: supplier balance uses server-read values
    if (!navigator.onLine) {
      throw new Error('You are offline. Please reconnect to record the purchase. Stock cannot be updated without a server connection.');
    }

    const purchaseRef = doc(collection(db, 'purchases'));
    const id = purchaseRef.id;
    const now = new Date().toISOString();

    // invoiceNumber is allocated atomically inside the transaction below
    // minValue 5001 preserves the existing PUR-MT-5001 starting point
    let invoiceNumber = '';
    let newPurchase: Purchase;

    // Run supplier-balance + invoice-number allocation together in one transaction
    await runTransaction(db, async (txn) => {
      // ── Step 1: Read supplier data first ─────────────────────────────────────
      const suppRef = doc(db, 'suppliers', purchaseData.supplierId);
      const snap = await txn.get(suppRef);
      if (!snap.exists()) return;

      const suppData = snap.data() as Supplier;
      let newBalance = Number(suppData.balance) || 0;
      let newAdvance = Number(suppData.advance) || 0;

      // ── Step 2: Allocate atomic purchase invoice number (after reads) ─────────
      const seqNum = await allocateSequence(txn, 'purchaseInvoice', 5001);
      invoiceNumber = `PUR-MT-${seqNum}`;

      newPurchase = {
        ...purchaseData,
        id,
        invoiceNumber,
        createdAt: now
      };

      // ── Step 3: Supplier balance calculations ────────────────────────────────
      const netPayable = newPurchase.totalAmount;
      const netDifference = netPayable - newPurchase.paidAmount;

      const extraLedgerRef = doc(collection(db, 'ledger_entries'));

      if (netDifference > 0) {
        const advanceToAdjust = Math.min(newAdvance, netDifference);
        if (advanceToAdjust > 0) {
          newAdvance -= advanceToAdjust;
          newBalance += netDifference - advanceToAdjust;
          txn.set(extraLedgerRef, {
            id: extraLedgerRef.id,
            entityId: newPurchase.supplierId,
            entityType: 'supplier',
            date: now,
            transactionType: 'payment_sent',
            referenceId: id,
            referenceNumber: invoiceNumber,
            description: `Advance Balance Applied: Rs. ${advanceToAdjust} applied to Supplier Invoice ${invoiceNumber}`,
            debit: advanceToAdjust,
            credit: 0,
            createdAt: now
          } as LedgerEntry);
        } else {
          newBalance += netDifference;
        }
      } else if (netDifference < 0) {
        const extraPaid = Math.abs(netDifference);
        if (extraPaid > newBalance) {
          const excessAdvance = extraPaid - newBalance;
          newBalance = 0;
          newAdvance += excessAdvance;
          txn.set(extraLedgerRef, {
            id: extraLedgerRef.id,
            entityId: newPurchase.supplierId,
            entityType: 'supplier',
            date: now,
            transactionType: 'payment_sent',
            referenceId: id,
            referenceNumber: invoiceNumber,
            description: `Supplier Advance Saved: Rs. ${excessAdvance.toLocaleString()} from overpayment on Invoice ${invoiceNumber}`,
            debit: 0,
            credit: excessAdvance,
            createdAt: now
          } as LedgerEntry);
        } else {
          newBalance -= extraPaid;
        }
      }

      txn.update(suppRef, { balance: newBalance, advance: newAdvance });
    });

    // After transaction committed: write the rest of the purchase in a batch
    const batch = writeBatch(db);

    batch.set(purchaseRef, newPurchase!);

    // Atomically increment stock for each item using server-side increment()
    // This accumulates correctly under concurrent purchases — no stale-read overwrite risk.
    newPurchase!.items.forEach((item) => {
      const partRef = doc(db, 'parts', item.partId);
      batch.update(partRef, {
        stock: increment(item.quantity),       // atomic server-side addition
        purchasePrice: item.purchasePrice,     // updates purchase price to latest
        updatedAt: now
      });

      const adjRef = doc(collection(db, 'adjustments'));
      const adjustment: Adjustment = {
        id: adjRef.id,
        partId: item.partId,
        partName: item.name,
        type: 'purchase',
        quantity: item.quantity,
        price: item.purchasePrice,
        referenceId: invoiceNumber,
        reason: `Stock purchased on Supplier Invoice ${invoiceNumber}`,
        createdAt: now
      };
      batch.set(adjRef, adjustment);
    });

    // Add main Ledger Entry for Supplier purchase (outside inner transaction, in batch)
    const ledgerRef = doc(collection(db, 'ledger_entries'));
    const ledgerEntry: LedgerEntry = {
      id: ledgerRef.id,
      entityId: newPurchase!.supplierId,
      entityType: 'supplier',
      date: now,
      transactionType: 'purchase',
      referenceId: id,
      referenceNumber: invoiceNumber,
      description: `Stock Restocked: ${newPurchase!.items.length} items received`,
      debit: newPurchase!.paidAmount,
      credit: newPurchase!.totalAmount,
      createdAt: now
    };
    batch.set(ledgerRef, ledgerEntry);

    addAuditLog(batch, 'CREATE_PURCHASE', `Purchase invoice recorded: ${invoiceNumber}. Total: Rs. ${newPurchase!.totalAmount}, Paid: Rs. ${newPurchase!.paidAmount}, Credit Balance: Rs. ${newPurchase!.balanceAmount} for supplier: ${newPurchase!.supplierName}`);

    try {
      await batch.commit();
      return newPurchase!;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchases/${id}`);
      throw err;
    }
  };

  // Purchase Return — uses runTransaction to validate server stock before deduction.
  // Prevents stock going negative if concurrent writes already consumed the stock.
  const returnPurchase = async (purchaseId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => {
    // Offline guard
    if (!navigator.onLine) {
      throw new Error('You are offline. Please reconnect to process the purchase return. Stock cannot be validated without a server connection.');
    }

    const originalPurchase = purchases.find(p => p.id === purchaseId);
    if (!originalPurchase) return;

    const now = new Date().toISOString();

    // Pre-allocate refs outside the transaction for stable IDs
    const purchaseRef = doc(db, 'purchases', purchaseId);
    const adjRefs = returnedItems.map(() => doc(collection(db, 'adjustments')));
    const auditRef = doc(collection(db, 'audit_logs'));
    const ledgerRef = doc(collection(db, 'ledger_entries'));

    try {
      await runTransaction(db, async (txn) => {
        // ── Phase 1: Read latest server stock for every returned item ────────
        const partDocs = await Promise.all(
          returnedItems.map(ri => txn.get(doc(db, 'parts', ri.partId)))
        );

        // ── Phase 2: Validate — server stock must be >= qty to return ────────
        const insufficientItems: string[] = [];
        for (let i = 0; i < returnedItems.length; i++) {
          const ri = returnedItems[i];
          const snap = partDocs[i];
          if (!snap.exists()) {
            insufficientItems.push(`Part ID ${ri.partId} not found in database`);
            continue;
          }
          const serverStock = (snap.data() as Part).stock ?? 0;
          if (serverStock < ri.quantity) {
            const partName = (snap.data() as Part).name || ri.partId;
            insufficientItems.push(`${partName} (trying to return ${ri.quantity}, but only ${serverStock} in stock — already sold/adjusted?)`);
          }
        }

        if (insufficientItems.length > 0) {
          throw new Error(`Cannot complete purchase return — insufficient stock:\n• ${insufficientItems.join('\n• ')}\n\nReturn rejected. No changes were made.`);
        }

        // ── Phase 3: Deduct stock atomically ─────────────────────────────────
        for (let i = 0; i < returnedItems.length; i++) {
          const ri = returnedItems[i];
          const snap = partDocs[i];
          const serverStock = (snap.data() as Part).stock;
          const currentPart = snap.data() as Part;

          txn.update(doc(db, 'parts', ri.partId), {
            stock: serverStock - ri.quantity,
            updatedAt: now
          });

          txn.set(adjRefs[i], {
            id: adjRefs[i].id,
            partId: ri.partId,
            partName: currentPart.name || 'Returned Part',
            type: 'purchase_return',
            quantity: ri.quantity,
            price: currentPart.purchasePrice || 0,
            referenceId: originalPurchase.invoiceNumber,
            reason: `Returned to Supplier on Purchase Invoice ${originalPurchase.invoiceNumber}`,
            createdAt: now
          } as Adjustment);
        }

        // ── Phase 4: Update purchase status ──────────────────────────────────
        txn.update(purchaseRef, { status: 'returned', updatedAt: now });

        // ── Phase 5: Supplier balance ─────────────────────────────────────────
        if (refundAmount > 0) {
          const suppSnap = await txn.get(doc(db, 'suppliers', originalPurchase.supplierId));
          if (suppSnap.exists()) {
            const suppData = suppSnap.data() as Supplier;
            const currentBal = Number(suppData.balance) || 0;
            let newBalance = currentBal;
            let newAdvance = Number(suppData.advance) || 0;

            if (refundAmount > currentBal) {
              const extraRefund = refundAmount - currentBal;
              newBalance = 0;
              newAdvance += extraRefund;
            } else {
              newBalance -= refundAmount;
            }

            txn.update(doc(db, 'suppliers', originalPurchase.supplierId), {
              balance: newBalance,
              advance: newAdvance
            });
          }

          txn.set(ledgerRef, {
            id: ledgerRef.id,
            entityId: originalPurchase.supplierId,
            entityType: 'supplier',
            date: now,
            transactionType: 'purchase_return',
            referenceId: purchaseId,
            referenceNumber: originalPurchase.invoiceNumber,
            description: `Purchase Return: Returned ${returnedItems.length} items`,
            debit: refundAmount,
            credit: 0,
            createdAt: now
          } as LedgerEntry);
        }

        // ── Phase 6: Audit log ────────────────────────────────────────────────
        const userEmail = auth.currentUser?.email || 'Unknown User';
        txn.set(auditRef, {
          id: auditRef.id,
          userEmail,
          action: 'PURCHASE_RETURN',
          details: `Returned purchase invoice ${originalPurchase.invoiceNumber}. Returned parts count: ${returnedItems.length}, Balance Adjustment Rs. ${refundAmount}`,
          createdAt: now
        } as AuditLog);
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchases/${purchaseId}`);
      throw err;
    }
  };

  const recordCustomerPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber' | 'entityType' | 'recordedBy' | 'createdAt'>) => {
    const paymentRef = doc(collection(db, 'payments'));
    const id = paymentRef.id;
    const now = new Date().toISOString();
    const userEmail = auth.currentUser?.email || 'Unknown User';

    // Allocate atomic voucher number: REC-100001, REC-100002, ...
    // minValue 100001 preserves the existing format; counter seeded above existing max on first use.
    const seqNum = await runTransaction(db, async (txn) => allocateSequence(txn, 'customerReceipt', 100001));
    const voucherNumber = `REC-${String(seqNum).padStart(6, '0')}`;

    const batch = writeBatch(db);

    const newPayment: Payment = {
      ...paymentData,
      id,
      voucherNumber,
      entityType: 'customer',
      recordedBy: userEmail,
      createdAt: now
    };

    batch.set(paymentRef, newPayment);

    // Update customer balance and lastPaymentDate
    const customerRef = doc(db, 'customers', paymentData.entityId);
    const currentCust = customers.find(c => c.id === paymentData.entityId);
    let custAdvanceCreated = 0;
    if (currentCust) {
      const currentBal = Number(currentCust.balance) || 0;
      let newBalance = currentBal;
      let newAdvance = Number(currentCust.advance) || 0;

      if (paymentData.amount > currentBal) {
        custAdvanceCreated = paymentData.amount - currentBal;
        newBalance = 0;
        newAdvance += custAdvanceCreated;
      } else {
        newBalance -= paymentData.amount;
      }

      batch.update(customerRef, {
        balance: newBalance,
        advance: newAdvance,
        lastPaymentDate: now
      });
    }

    // Add main Ledger Entry for payment received
    const ledgerRef = doc(collection(db, 'ledger_entries'));
    const ledgerEntry: LedgerEntry = {
      id: ledgerRef.id,
      entityId: paymentData.entityId,
      entityType: 'customer',
      date: paymentData.date || now,
      transactionType: 'payment_received',
      referenceId: id,
      referenceNumber: voucherNumber,
      description: `Payment Received: ${paymentData.remarks || 'N/A'}${paymentData.referenceNumber ? ` (Ref: ${paymentData.referenceNumber})` : ''}`,
      debit: 0,
      credit: paymentData.amount,
      createdAt: now
    };
    batch.set(ledgerRef, ledgerEntry);

    // If overpayment: create advance ledger entry for full audit trail
    if (custAdvanceCreated > 0) {
      const advLedgerRef = doc(collection(db, 'ledger_entries'));
      batch.set(advLedgerRef, {
        id: advLedgerRef.id,
        entityId: paymentData.entityId,
        entityType: 'customer',
        date: paymentData.date || now,
        transactionType: 'payment_received',
        referenceId: id,
        referenceNumber: voucherNumber,
        description: `Customer Advance Saved: Rs. ${custAdvanceCreated.toLocaleString()} recorded as advance balance`,
        debit: custAdvanceCreated,
        credit: 0,
        createdAt: now
      } as LedgerEntry);
    }

    addAuditLog(batch, 'CUSTOMER_PAYMENT', `Received payment Rs. ${paymentData.amount} from customer: ${paymentData.entityName}. Voucher: ${voucherNumber}, Method: ${paymentData.paymentMethod}${custAdvanceCreated > 0 ? `. Advance saved: Rs. ${custAdvanceCreated}` : ''}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `payments/${id}`);
      throw err;
    }
  };

  const recordSupplierPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber' | 'entityType' | 'recordedBy' | 'createdAt'>) => {
    const paymentRef = doc(collection(db, 'payments'));
    const id = paymentRef.id;
    const now = new Date().toISOString();
    const userEmail = auth.currentUser?.email || 'Unknown User';

    // Allocate atomic voucher number: PAY-100001, PAY-100002, ...
    // minValue 100001 preserves the existing format; counter seeded above existing max on first use.
    const seqNum = await runTransaction(db, async (txn) => allocateSequence(txn, 'supplierPayment', 100001));
    const voucherNumber = `PAY-${String(seqNum).padStart(6, '0')}`;

    const batch = writeBatch(db);

    const newPayment: Payment = {
      ...paymentData,
      id,
      voucherNumber,
      entityType: 'supplier',
      recordedBy: userEmail,
      createdAt: now
    };

    batch.set(paymentRef, newPayment);

    // Update supplier balance and lastPaymentDate
    const supplierRef = doc(db, 'suppliers', paymentData.entityId);
    const currentSupp = suppliers.find(s => s.id === paymentData.entityId);
    let suppAdvanceCreated = 0;
    if (currentSupp) {
      const currentBal = Number(currentSupp.balance) || 0;
      let newBalance = currentBal;
      let newAdvance = Number(currentSupp.advance) || 0;

      if (paymentData.amount > currentBal) {
        suppAdvanceCreated = paymentData.amount - currentBal;
        newBalance = 0;
        newAdvance += suppAdvanceCreated;
      } else {
        newBalance -= paymentData.amount;
      }

      batch.update(supplierRef, {
        balance: newBalance,
        advance: newAdvance,
        lastPaymentDate: now
      });
    }

    // Add main Ledger Entry for payment sent
    const ledgerRef = doc(collection(db, 'ledger_entries'));
    const ledgerEntry: LedgerEntry = {
      id: ledgerRef.id,
      entityId: paymentData.entityId,
      entityType: 'supplier',
      date: paymentData.date || now,
      transactionType: 'payment_sent',
      referenceId: id,
      referenceNumber: voucherNumber,
      description: `Payment Sent: ${paymentData.remarks || 'N/A'}${paymentData.referenceNumber ? ` (Ref: ${paymentData.referenceNumber})` : ''}`,
      debit: paymentData.amount,
      credit: 0,
      createdAt: now
    };
    batch.set(ledgerRef, ledgerEntry);

    // If overpayment: create advance ledger entry for full audit trail
    if (suppAdvanceCreated > 0) {
      const advLedgerRef = doc(collection(db, 'ledger_entries'));
      batch.set(advLedgerRef, {
        id: advLedgerRef.id,
        entityId: paymentData.entityId,
        entityType: 'supplier',
        date: paymentData.date || now,
        transactionType: 'payment_sent',
        referenceId: id,
        referenceNumber: voucherNumber,
        description: `Supplier Advance Saved: Rs. ${suppAdvanceCreated.toLocaleString()} recorded as advance balance`,
        debit: 0,
        credit: suppAdvanceCreated,
        createdAt: now
      } as LedgerEntry);
    }

    addAuditLog(batch, 'SUPPLIER_PAYMENT', `Sent payment Rs. ${paymentData.amount} to supplier: ${paymentData.entityName}. Voucher: ${voucherNumber}, Method: ${paymentData.paymentMethod}${suppAdvanceCreated > 0 ? `. Advance saved: Rs. ${suppAdvanceCreated}` : ''}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `payments/${id}`);
      throw err;
    }
  };

  // 6. INVENTORY MANUAL ADJUSTMENT Action
  // Positive (add): uses atomic increment() — safe under concurrent writes.
  // Negative (subtract): uses runTransaction() to read server stock, reject if it would go negative.
  const addAdjustment = async (adjData: Omit<Adjustment, 'id' | 'createdAt'>) => {
    // Offline guard for negative adjustments (require server validation)
    const isAdding = adjData.type === 'adjustment_add';
    if (!isAdding && !navigator.onLine) {
      throw new Error('You are offline. Please reconnect to perform a stock deduction. Stock cannot be validated without a server connection.');
    }

    const now = new Date().toISOString();
    const adjRef = doc(collection(db, 'adjustments'));
    const partRef = doc(db, 'parts', adjData.partId);
    const auditRef = doc(collection(db, 'audit_logs'));
    const userEmail = auth.currentUser?.email || 'Unknown User';

    const adjustment: Adjustment = {
      ...adjData,
      id: adjRef.id,
      createdAt: now
    };

    if (isAdding) {
      // ── Positive adjustment: batch with atomic increment ─────────────────
      const batch = writeBatch(db);
      batch.set(adjRef, adjustment);
      batch.update(partRef, {
        stock: increment(adjData.quantity),
        updatedAt: now
      });
      batch.set(auditRef, {
        id: auditRef.id,
        userEmail,
        action: 'MANUAL_STOCK_ADJUSTMENT',
        details: `Manual stock adjustment for ${adjData.partName}: +${adjData.quantity} units. Reason: ${adjData.reason}`,
        createdAt: now
      } as AuditLog);
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `adjustments/${adjRef.id}`);
        throw err;
      }
    } else {
      // ── Negative adjustment: runTransaction to validate server stock ─────
      try {
        await runTransaction(db, async (txn) => {
          const partSnap = await txn.get(partRef);
          if (!partSnap.exists()) {
            throw new Error(`Part not found in database.`);
          }
          const serverStock = (partSnap.data() as Part).stock ?? 0;
          if (serverStock < adjData.quantity) {
            throw new Error(`Insufficient stock. Requested deduction: ${adjData.quantity}, Available: ${serverStock}. Adjustment rejected.`);
          }

          txn.set(adjRef, adjustment);
          txn.update(partRef, {
            stock: serverStock - adjData.quantity,
            updatedAt: now
          });
          txn.set(auditRef, {
            id: auditRef.id,
            userEmail,
            action: 'MANUAL_STOCK_ADJUSTMENT',
            details: `Manual stock adjustment for ${adjData.partName}: -${adjData.quantity} units (server stock was ${serverStock}). Reason: ${adjData.reason}`,
            createdAt: now
          } as AuditLog);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `adjustments/${adjRef.id}`);
        throw err;
      }
    }
  };

  // 7. SHOP SETTINGS Action
  const updateSettings = async (settingsData: Partial<ShopSettings>) => {
    try {
      const settingsRef = doc(db, 'settings', 'shop');
      await setDoc(settingsRef, settingsData, { merge: true });
      await addManualAuditLog('UPDATE_SETTINGS', `Updated shop settings: ${JSON.stringify(settingsData)}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/shop');
    }
  };

  // 7b. EXPENSE Actions
  const addExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const expenseRef = doc(collection(db, 'expenses'));
    const now = new Date().toISOString();
    const expense: Expense = {
      ...expenseData,
      id: expenseRef.id,
      createdAt: now
    };
    batch.set(expenseRef, expense);
    await addAuditLog(batch, 'ADD_EXPENSE', `Logged operational expense: ${expense.category} - Rs. ${expense.amount}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `expenses/${expenseRef.id}`);
    }
  };

  const updateExpense = async (id: string, expenseData: Partial<Expense>) => {
    const batch = writeBatch(db);
    const expenseRef = doc(db, 'expenses', id);
    batch.update(expenseRef, expenseData);
    await addAuditLog(batch, 'UPDATE_EXPENSE', `Updated expense log: ${id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `expenses/${id}`);
    }
  };

  const deleteExpense = async (id: string) => {
    const batch = writeBatch(db);
    const expenseRef = doc(db, 'expenses', id);
    batch.delete(expenseRef);
    await addAuditLog(batch, 'DELETE_EXPENSE', `Deleted expense log: ${id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `expenses/${id}`);
    }
  };

  // 7c. PARTNER Actions
  const addPartner = async (partnerData: Omit<Partner, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const partnerRef = doc(collection(db, 'partners'));
    const now = new Date().toISOString();
    const partner: Partner = {
      ...partnerData,
      id: partnerRef.id,
      createdAt: now
    };
    batch.set(partnerRef, partner);
    await addAuditLog(batch, 'ADD_PARTNER', `Registered partner: ${partner.name} with ownership ${partner.ownershipPercentage}%`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `partners/${partnerRef.id}`);
    }
  };

  const updatePartner = async (id: string, partnerData: Partial<Partner>) => {
    const batch = writeBatch(db);
    const partnerRef = doc(db, 'partners', id);
    batch.update(partnerRef, partnerData);
    await addAuditLog(batch, 'UPDATE_PARTNER', `Updated partner information: ${partnerData.name || id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `partners/${id}`);
    }
  };

  const deletePartner = async (id: string) => {
    const batch = writeBatch(db);
    const partnerRef = doc(db, 'partners', id);
    batch.delete(partnerRef);
    await addAuditLog(batch, 'DELETE_PARTNER', `Removed partner: ${id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `partners/${id}`);
    }
  };

  // 7d. DRAWING Actions
  const addDrawing = async (drawingData: Omit<Drawing, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const drawingRef = doc(collection(db, 'drawings'));
    const now = new Date().toISOString();
    const drawing: Drawing = {
      ...drawingData,
      id: drawingRef.id,
      createdAt: now
    };
    batch.set(drawingRef, drawing);
    await addAuditLog(batch, 'ADD_DRAWING', `Logged partner withdrawal: ${drawing.partnerName} - Rs. ${drawing.amount}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `drawings/${drawingRef.id}`);
    }
  };

  const updateDrawing = async (id: string, drawingData: Partial<Drawing>) => {
    const batch = writeBatch(db);
    const drawingRef = doc(db, 'drawings', id);
    batch.update(drawingRef, drawingData);
    await addAuditLog(batch, 'UPDATE_DRAWING', `Updated partner withdrawal: ${id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `drawings/${id}`);
    }
  };

  const deleteDrawing = async (id: string) => {
    const batch = writeBatch(db);
    const drawingRef = doc(db, 'drawings', id);
    batch.delete(drawingRef);
    await addAuditLog(batch, 'DELETE_DRAWING', `Deleted partner withdrawal: ${id}`);
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `drawings/${id}`);
    }
  };

  // 8. DATA SEEDING & UTILITIES
  const seedDemoData = async () => {
    setLoading(true);
    const batch = writeBatch(db);
    
    const now = new Date().toISOString();

    // 1. Seeds Parts
    const sampleParts = [
      { partNumber: 'H70-CYL-CROWN', name: '70cc Cylinder Block Assembly', brand: 'Crown Lifan', category: 'Engine Parts', modelCompatibility: 'CD70 / CD70 Dream', location: 'Rack A-1', purchasePrice: 2800, retailPrice: 3400, stock: 15, minStock: 5 },
      { partNumber: 'H125-CARB-GEN', name: 'CG125 Carburetor Assembly (Japan)', brand: 'Honda Genuine', category: 'Engine Parts', modelCompatibility: 'CG125', location: 'Rack B-3', purchasePrice: 6500, retailPrice: 7800, stock: 8, minStock: 3 },
      { partNumber: 'CD70-CLT-FCC', name: 'Clutch Plate & Pressure Plate Set', brand: 'FCC Japan', category: 'Clutch & Gear', modelCompatibility: 'CD70', location: 'Rack A-5', purchasePrice: 1200, retailPrice: 1650, stock: 25, minStock: 8 },
      { partNumber: 'CD70-CH-CRN', name: 'Chain Sprocket Kit 36T-14T', brand: 'Crown Lifan', category: 'Chains & Gears', modelCompatibility: 'CD70', location: 'Rack C-1', purchasePrice: 1850, retailPrice: 2450, stock: 12, minStock: 4 },
      { partNumber: 'CG125-BRK-SHO', name: 'Front & Rear Brake Shoe Set', brand: 'Crown Lifan', category: 'Brakes', modelCompatibility: 'CG125', location: 'Rack D-2', purchasePrice: 350, retailPrice: 480, stock: 40, minStock: 10 },
      { partNumber: 'NGK-PLG-C7HSA', name: 'NGK Spark Plug C7HSA', brand: 'NGK Japan', category: 'Electrical', modelCompatibility: 'CD70 / Pridor', location: 'Rack E-1', purchasePrice: 180, retailPrice: 250, stock: 100, minStock: 15 },
      { partNumber: 'HAV-OIL-CD70', name: 'Caltex Havoline 4T 20W-50 (0.7L)', brand: 'Chevron Havoline', category: 'Lubricants & Oils', modelCompatibility: 'CD70 / CD70 Dream', location: 'Rack Oil-1', purchasePrice: 620, retailPrice: 720, stock: 48, minStock: 12 },
      { partNumber: 'SHL-ADV-CG125', name: 'Shell Advance AX7 10W-30 (1L)', brand: 'Shell Advance', category: 'Lubricants & Oils', modelCompatibility: 'CG125 / GS150', location: 'Rack Oil-2', purchasePrice: 950, retailPrice: 1100, stock: 36, minStock: 10 },
      { partNumber: 'CG125-FLT-AIR', name: 'CG125 Foam Air Filter Element', brand: 'SOGO Pakistan', category: 'Filters', modelCompatibility: 'CG125', location: 'Rack F-3', purchasePrice: 120, retailPrice: 190, stock: 50, minStock: 10 },
      { partNumber: 'YBR-CBL-ACC', name: 'YBR125 Accelerator Cable Assembly', brand: 'Yamaha Genuine', category: 'Cables & Hoses', modelCompatibility: 'YBR125 / YB125Z', location: 'Rack G-1', purchasePrice: 850, retailPrice: 1150, stock: 4, minStock: 5 },
    ];

    const partRefs: string[] = [];
    sampleParts.forEach((sp) => {
      const ref = doc(collection(db, 'parts'));
      const id = ref.id;
      partRefs.push(id);
      batch.set(ref, {
        id,
        ...sp,
        createdAt: now,
        updatedAt: now
      });

      // Add corresponding stock adjustments
      const adjRef = doc(collection(db, 'adjustments'));
      batch.set(adjRef, {
        id: adjRef.id,
        partId: id,
        partName: sp.name,
        type: 'adjustment_add',
        quantity: sp.stock,
        price: sp.purchasePrice,
        referenceId: 'INITIAL_STOCK',
        reason: 'Demo data initial seed',
        createdAt: now
      });
    });

    // 2. Seeds Customers
    const sampleCustomers = [
      { name: 'Kashif Autos Shop', phone: '0312-4455667', shopName: 'Kashif Motorcycle Repairs', balance: 14500 },
      { name: 'Multan Autos Lahore', phone: '0321-9988776', shopName: 'Multan Autos Wholesale', balance: 0 },
      { name: 'Sajid Mehmood Mechanic', phone: '0345-5566778', shopName: 'Sajid 70 Workshop', balance: 3400 },
      { name: 'Zahid Khan Autos', phone: '0333-1122334', shopName: 'Zahid Parts Dealer', balance: -5000 }, // Credit balance / Advanced payment
    ];

    const customerRefs: string[] = [];
    sampleCustomers.forEach((sc) => {
      const ref = doc(collection(db, 'customers'));
      const id = ref.id;
      customerRefs.push(id);
      batch.set(ref, {
        id,
        ...sc,
        createdAt: now
      });
    });

    // 3. Seeds Suppliers
    const sampleSuppliers = [
      { name: 'Crown Lifan Pakistan Head Office', contactPerson: 'Mian Rafiq', phone: '042-37234567', address: 'Badami Bagh, Lahore', balance: 45000 },
      { name: 'Universal Genuine Spares Ltd', contactPerson: 'Zulqarnain Shah', phone: '021-34567890', address: 'Plaza Quarter, Karachi', balance: 12000 },
      { name: 'Haseeb Lubricants Distributor', contactPerson: 'Haseeb Butt', phone: '0300-8889991', address: 'Faisalabad, Pakistan', balance: 0 },
    ];

    const supplierRefs: string[] = [];
    sampleSuppliers.forEach((ss) => {
      const ref = doc(collection(db, 'suppliers'));
      const id = ref.id;
      supplierRefs.push(id);
      batch.set(ref, {
        id,
        ...ss,
        createdAt: now
      });
    });

    // 4. Seeds 1-2 Sample Sales and Purchases
    // Sale 1
    const sale1Ref = doc(collection(db, 'sales'));
    batch.set(sale1Ref, {
      id: sale1Ref.id,
      invoiceNumber: 'INV-MT-1001',
      customerId: customerRefs[0], // Kashif Autos Shop
      customerName: 'Kashif Autos Shop',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      totalAmount: 12250,
      discount: 250,
      paidAmount: 5000,
      balanceAmount: 7000, // Part of Kashif's balance
      paymentMethod: 'credit',
      status: 'completed',
      items: [
        { partId: partRefs[0], partNumber: 'H70-CYL-CROWN', name: '70cc Cylinder Block Assembly', quantity: 2, purchasePrice: 2800, retailPrice: 3400, total: 6800 },
        { partId: partRefs[2], partNumber: 'CD70-CLT-FCC', name: 'Clutch Plate & Pressure Plate Set', quantity: 3, purchasePrice: 1200, retailPrice: 1650, total: 4950 },
        { partId: partRefs[5], partNumber: 'NGK-PLG-C7HSA', name: 'NGK Spark Plug C7HSA', quantity: 2, purchasePrice: 180, retailPrice: 250, total: 500 },
      ],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    });

    // Purchase 1
    const purchase1Ref = doc(collection(db, 'purchases'));
    batch.set(purchase1Ref, {
      id: purchase1Ref.id,
      invoiceNumber: 'PUR-MT-5001',
      supplierId: supplierRefs[0], // Crown Lifan
      supplierName: 'Crown Lifan Pakistan Head Office',
      date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      totalAmount: 37000,
      paidAmount: 20000,
      balanceAmount: 17000, // Part of Crown's balance
      status: 'completed',
      items: [
        { partId: partRefs[0], partNumber: 'H70-CYL-CROWN', name: '70cc Cylinder Block Assembly', quantity: 10, purchasePrice: 2800, total: 28000 },
        { partId: partRefs[3], partNumber: 'CD70-CH-CRN', name: 'Chain Sprocket Kit 36T-14T', quantity: 5, purchasePrice: 1800, total: 9000 },
      ],
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    });

    // Set settings
    const settingsRef = doc(db, 'settings', 'shop');
    batch.set(settingsRef, {
      shopName: 'BIN ADAM TRADERS',
      phone: '0300-1234567',
      address: 'McLeod Road, Lahore, Pakistan',
      currency: 'Rs.',
      footerMessage: 'Thank you for your business! Guarantees only on genuine parts.'
    });

    // Seed initial Audit logs
    addAuditLog(batch, 'SEED_DEMO_DATA', 'Database successfully seeded with Pakistani motorcycle spare parts demo data, customer logs, and vendor registries.');

    try {
      await batch.commit();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.WRITE, 'seed-data');
    }
  };

  const clearAllData = async () => {
    setLoading(true);
    try {
      const collectionsToWipe = [
        'parts',
        'customers',
        'suppliers',
        'sales',
        'purchases',
        'adjustments',
        'audit_logs',
        'expenses',
        'partners',
        'drawings',
        'payments',
        'ledger_entries',
        'counters'
      ];

      console.log('🗑️ Starting database wipe...');
      
      // Use batched deletion for better performance (max 500 operations per batch)
      for (const colName of collectionsToWipe) {
        const querySnapshot = await getDocs(collection(db, colName));
        const docs = querySnapshot.docs;
        console.log(`📊 Collection '${colName}': Found ${docs.length} documents to delete`);
        
        // Process in batches of 500
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          console.log(`  ✅ Deleted batch ${Math.floor(i/500) + 1} (${chunk.length} docs)`);
        }
        
        // Verify deletion
        const verifySnapshot = await getDocs(collection(db, colName));
        console.log(`  🔍 Verification: ${verifySnapshot.docs.length} documents remaining in '${colName}'`);
      }
      
      // Reset shop settings to defaults
      await setDoc(doc(db, 'settings', 'shop'), {
        shopName: 'BIN ADAM TRADERS',
        phone: '0300-1234567',
        address: 'McLeod Road, Lahore, Pakistan',
        currency: 'Rs.',
        footerMessage: 'Thank you for your business! Guarantees only on genuine parts.',
        startingCash: 0,
        startingBank: 0
      });

      // Reinitialize counters to starting values
      await setDoc(doc(db, 'counters', 'saleInvoice'), { seq: 1000 });
      await setDoc(doc(db, 'counters', 'purchaseInvoice'), { seq: 5000 });
      await setDoc(doc(db, 'counters', 'paymentVoucher'), { seq: 100000 });
      await setDoc(doc(db, 'counters', 'receiptVoucher'), { seq: 100000 });

      await addManualAuditLog('CLEAR_ALL_DATA', 'Cleared all application transactions, stock catalogs, user records, counters, and reset workspace to factory state.');
      
      // Clear Firestore offline persistence to prevent old data from reappearing
      try {
        await clearIndexedDbPersistence(db);
        console.log('✅ Firestore offline persistence cleared successfully');
      } catch (err: any) {
        // If persistence is not enabled or already cleared, ignore error
        if (err.code !== 'failed-precondition') {
          console.warn('⚠️ Warning clearing offline persistence:', err.message);
        }
      }

      // Set timestamp BEFORE clearing to force server fetch on next load
      localStorage.setItem('database_reset_timestamp', Date.now().toString());
      
      // Clear ALL local storage and session storage (except the timestamp)
      const resetTimestamp = localStorage.getItem('database_reset_timestamp');
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore the timestamp
      if (resetTimestamp) {
        localStorage.setItem('database_reset_timestamp', resetTimestamp);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.DELETE, 'clear-data');
    }
  };

  return (
    <ERPContext.Provider value={{
      parts,
      customers,
      suppliers,
      sales,
      purchases,
      adjustments,
      auditLogs,
      payments,
      ledgerEntries,
      settings,
      expenses,
      partners,
      drawings,
      loading,
      error,
      syncStatus,
      lastSyncTime,
      pendingSyncCount,
      addPart: (data) => trackWrite(() => addPart(data)),
      updatePart: (id, data) => trackWrite(() => updatePart(id, data)),
      deletePart: (id) => trackWrite(() => deletePart(id)),
      addCustomer: (data) => trackWrite(() => addCustomer(data)),
      updateCustomer: (id, data) => trackWrite(() => updateCustomer(id, data)),
      deleteCustomer: (id) => trackWrite(() => deleteCustomer(id)),
      addSupplier: (data) => trackWrite(() => addSupplier(data)),
      updateSupplier: (id, data) => trackWrite(() => updateSupplier(id, data)),
      deleteSupplier: (id) => trackWrite(() => deleteSupplier(id)),
      createSale: (data) => trackWrite(() => createSale(data)),
      returnSale: (id, returnedItems, refundAmount) => trackWrite(() => returnSale(id, returnedItems, refundAmount)),
      createPurchase: (data) => trackWrite(() => createPurchase(data)),
      returnPurchase: (id, returnedItems, refundAmount) => trackWrite(() => returnPurchase(id, returnedItems, refundAmount)),
      recordCustomerPayment: (data) => trackWrite(() => recordCustomerPayment(data)),
      recordSupplierPayment: (data) => trackWrite(() => recordSupplierPayment(data)),
      addAdjustment: (data) => trackWrite(() => addAdjustment(data)),
      updateSettings: (data) => trackWrite(() => updateSettings(data)),
      seedDemoData,
      clearAllData,
      addManualAuditLog: (act, det) => trackWrite(() => addManualAuditLog(act, det)),
      addExpense: (data) => trackWrite(() => addExpense(data)),
      updateExpense: (id, data) => trackWrite(() => updateExpense(id, data)),
      deleteExpense: (id) => trackWrite(() => deleteExpense(id)),
      addPartner: (data) => trackWrite(() => addPartner(data)),
      updatePartner: (id, data) => trackWrite(() => updatePartner(id, data)),
      deletePartner: (id) => trackWrite(() => deletePartner(id)),
      addDrawing: (data) => trackWrite(() => addDrawing(data)),
      updateDrawing: (id, data) => trackWrite(() => updateDrawing(id, data)),
      deleteDrawing: (id) => trackWrite(() => deleteDrawing(id))
    }}>
      {children}
    </ERPContext.Provider>
  );
};
