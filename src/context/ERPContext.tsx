import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
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
    shopName: 'Bismillah Autos & Spare Parts',
    phone: '0300-1234567',
    address: 'McLeod Road, Lahore, Pakistan',
    currency: 'Rs.',
    footerMessage: 'Thank you for your business! Guarantees only on genuine parts.'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    batch.delete(partRef);
    addAuditLog(batch, 'DELETE_PART', `Deleted spare part: ${deletedName}`);

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
      const custRef = doc(db, 'customers', id);
      await updateDoc(custRef, customerData);
      await addManualAuditLog('UPDATE_CUSTOMER', `Updated customer details/balance for: ${customerData.name || id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `customers/${id}`);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const custRef = doc(db, 'customers', id);
      const deletedName = customers.find(c => c.id === id)?.name || id;
      await deleteDoc(custRef);
      await addManualAuditLog('DELETE_CUSTOMER', `Deleted customer profile: ${deletedName}`);
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
      const suppRef = doc(db, 'suppliers', id);
      await updateDoc(suppRef, supplierData);
      await addManualAuditLog('UPDATE_SUPPLIER', `Updated supplier details/balance for: ${supplierData.name || id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `suppliers/${id}`);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const suppRef = doc(db, 'suppliers', id);
      const deletedName = suppliers.find(s => s.id === id)?.name || id;
      await deleteDoc(suppRef);
      await addManualAuditLog('DELETE_SUPPLIER', `Deleted supplier profile: ${deletedName}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  // 4. SALES (POS) Actions
  const createSale = async (saleData: Omit<Sale, 'id' | 'createdAt' | 'invoiceNumber'>) => {
    const batch = writeBatch(db);
    const saleRef = doc(collection(db, 'sales'));
    const id = saleRef.id;
    const now = new Date().toISOString();
    
    // Generate Invoice Number e.g. INV-2026-1001
    const totalSalesCount = sales.length;
    const invoiceNumber = `INV-MT-${1000 + totalSalesCount + 1}`;

    const newSale: Sale = {
      ...saleData,
      id,
      invoiceNumber,
      createdAt: now
    };

    batch.set(saleRef, newSale);

    // Deduct stock for each item, add inventory adjustment logs
    newSale.items.forEach((item) => {
      const partRef = doc(db, 'parts', item.partId);
      const currentPart = parts.find(p => p.id === item.partId);
      if (currentPart) {
        batch.update(partRef, {
          stock: Math.max(0, currentPart.stock - item.quantity),
          updatedAt: now
        });
      }

      const adjRef = doc(collection(db, 'adjustments'));
      const adjustment: Adjustment = {
        id: adjRef.id,
        partId: item.partId,
        partName: item.name,
        type: 'sale',
        quantity: item.quantity,
        price: item.retailPrice,
        referenceId: invoiceNumber,
        reason: `Sold via POS Invoice ${invoiceNumber}`,
        createdAt: now
      };
      batch.set(adjRef, adjustment);
    });

    // Update customer credit balance if credit purchase/ledger balance occurs
    if (newSale.customerId !== 'CASH-CUSTOMER') {
      const customerRef = doc(db, 'customers', newSale.customerId);
      const currentCust = customers.find(c => c.id === newSale.customerId);
      if (currentCust) {
        let newBalance = Number(currentCust.balance) || 0;
        let newAdvance = Number(currentCust.advance) || 0;

        const netPayable = newSale.totalAmount - newSale.discount;
        const netDifference = netPayable - newSale.paidAmount;

        if (netDifference > 0) {
          const advanceToAdjust = Math.min(newAdvance, netDifference);
          if (advanceToAdjust > 0) {
            newAdvance -= advanceToAdjust;
            const remainingBalanceAmount = netDifference - advanceToAdjust;
            newBalance += remainingBalanceAmount;

            // Add Ledger Entry for Advance Adjustment
            const adjLedgerRef = doc(collection(db, 'ledger_entries'));
            const adjLedgerEntry: LedgerEntry = {
              id: adjLedgerRef.id,
              entityId: newSale.customerId,
              entityType: 'customer',
              date: now,
              transactionType: 'payment_received',
              referenceId: id,
              referenceNumber: invoiceNumber,
              description: `Advance Balance Applied: Rs. ${advanceToAdjust} applied to POS Bill ${invoiceNumber}`,
              debit: 0,
              credit: advanceToAdjust,
              createdAt: now
            };
            batch.set(adjLedgerRef, adjLedgerEntry);
          } else {
            newBalance += netDifference;
          }
        } else if (netDifference < 0) {
          const extraPaid = Math.abs(netDifference);
          if (extraPaid > newBalance) {
            const excessAdvance = extraPaid - newBalance;
            newBalance = 0;
            newAdvance += excessAdvance;

            // Ledger entry for advance created during sale overpayment
            const saleAdvLedgerRef = doc(collection(db, 'ledger_entries'));
            const saleAdvEntry: LedgerEntry = {
              id: saleAdvLedgerRef.id,
              entityId: newSale.customerId,
              entityType: 'customer',
              date: now,
              transactionType: 'payment_received',
              referenceId: id,
              referenceNumber: invoiceNumber,
              description: `Customer Advance Saved: Rs. ${excessAdvance.toLocaleString()} from overpayment on POS Bill ${invoiceNumber}`,
              debit: excessAdvance,
              credit: 0,
              createdAt: now
            };
            batch.set(saleAdvLedgerRef, saleAdvEntry);
          } else {
            newBalance -= extraPaid;
          }
        }

        batch.update(customerRef, {
          balance: newBalance,
          advance: newAdvance
        });
      }

      // Add Ledger Entry
      const ledgerRef = doc(collection(db, 'ledger_entries'));
      const ledgerEntry: LedgerEntry = {
        id: ledgerRef.id,
        entityId: newSale.customerId,
        entityType: 'customer',
        date: now,
        transactionType: 'sale',
        referenceId: id,
        referenceNumber: invoiceNumber,
        description: `POS Bill: ${newSale.items.length} items sold`,
        debit: newSale.totalAmount - newSale.discount,
        credit: newSale.paidAmount,
        createdAt: now
      };
      batch.set(ledgerRef, ledgerEntry);
    }

    addAuditLog(batch, 'CREATE_SALE', `POS Sale generated: ${invoiceNumber}. Total: Rs. ${newSale.totalAmount}, Paid: Rs. ${newSale.paidAmount}, Balance Credit: Rs. ${newSale.balanceAmount} for customer: ${newSale.customerName}`);

    try {
      await batch.commit();
      return newSale;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sales/${id}`);
      throw err;
    }
  };

  // Sales Return
  const returnSale = async (saleId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => {
    const batch = writeBatch(db);
    const saleRef = doc(db, 'sales', saleId);
    const originalSale = sales.find(s => s.id === saleId);
    if (!originalSale) return;

    const now = new Date().toISOString();

    // Revert/increase stock for returned parts, log adjustments
    returnedItems.forEach((retItem) => {
      const partRef = doc(db, 'parts', retItem.partId);
      const currentPart = parts.find(p => p.id === retItem.partId);
      if (currentPart) {
        batch.update(partRef, {
          stock: currentPart.stock + retItem.quantity,
          updatedAt: now
        });
      }

      const adjRef = doc(collection(db, 'adjustments'));
      const adjustment: Adjustment = {
        id: adjRef.id,
        partId: retItem.partId,
        partName: currentPart?.name || 'Returned Part',
        type: 'sales_return',
        quantity: retItem.quantity,
        price: currentPart?.retailPrice || 0,
        referenceId: originalSale.invoiceNumber,
        reason: `Returned from Sales Invoice ${originalSale.invoiceNumber}`,
        createdAt: now
      };
      batch.set(adjRef, adjustment);
    });

    // Update sale status
    batch.update(saleRef, {
      status: 'returned',
      updatedAt: now
    });

    // Revert/deduct customer balance if customer has outstanding balance
    if (originalSale.customerId !== 'CASH-CUSTOMER' && refundAmount > 0) {
      const customerRef = doc(db, 'customers', originalSale.customerId);
      const currentCust = customers.find(c => c.id === originalSale.customerId);
      if (currentCust) {
        const currentBal = Number(currentCust.balance) || 0;
        let newBalance = currentBal;
        let newAdvance = Number(currentCust.advance) || 0;

        if (refundAmount > currentBal) {
          const extraRefund = refundAmount - currentBal;
          newBalance = 0;
          newAdvance += extraRefund;
        } else {
          newBalance -= refundAmount;
        }

        batch.update(customerRef, {
          balance: newBalance,
          advance: newAdvance
        });
      }

      // Add Ledger Entry for Return
      const ledgerRef = doc(collection(db, 'ledger_entries'));
      const ledgerEntry: LedgerEntry = {
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
      };
      batch.set(ledgerRef, ledgerEntry);
    }

    addAuditLog(batch, 'SALE_RETURN', `Returned sale invoice ${originalSale.invoiceNumber}. Returned parts count: ${returnedItems.length}, Balance Adjustment Rs. ${refundAmount}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sales/${saleId}`);
    }
  };

  // 5. PURCHASES Actions
  const createPurchase = async (purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'invoiceNumber'>) => {
    const batch = writeBatch(db);
    const purchaseRef = doc(collection(db, 'purchases'));
    const id = purchaseRef.id;
    const now = new Date().toISOString();
    
    const totalPurchasesCount = purchases.length;
    const invoiceNumber = `PUR-MT-${5000 + totalPurchasesCount + 1}`;

    const newPurchase: Purchase = {
      ...purchaseData,
      id,
      invoiceNumber,
      createdAt: now
    };

    batch.set(purchaseRef, newPurchase);

    // Increase stock for each item, add inventory adjustment logs
    newPurchase.items.forEach((item) => {
      const partRef = doc(db, 'parts', item.partId);
      const currentPart = parts.find(p => p.id === item.partId);
      if (currentPart) {
        batch.update(partRef, {
          stock: currentPart.stock + item.quantity,
          purchasePrice: item.purchasePrice, // Automatically updates purchase price to last purchase price!
          updatedAt: now
        });
      }

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

    // Update supplier ledger balance if credit purchase
    const supplierRef = doc(db, 'suppliers', newPurchase.supplierId);
    const currentSupp = suppliers.find(s => s.id === newPurchase.supplierId);
    if (currentSupp) {
      let newBalance = Number(currentSupp.balance) || 0;
      let newAdvance = Number(currentSupp.advance) || 0;

      const netPayable = newPurchase.totalAmount;
      const netDifference = netPayable - newPurchase.paidAmount;

      if (netDifference > 0) {
        const advanceToAdjust = Math.min(newAdvance, netDifference);
        if (advanceToAdjust > 0) {
          newAdvance -= advanceToAdjust;
          const remainingBalanceAmount = netDifference - advanceToAdjust;
          newBalance += remainingBalanceAmount;

          // Add Ledger Entry for Advance Adjustment
          const adjLedgerRef = doc(collection(db, 'ledger_entries'));
          const adjLedgerEntry: LedgerEntry = {
            id: adjLedgerRef.id,
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
          };
          batch.set(adjLedgerRef, adjLedgerEntry);
        } else {
          newBalance += netDifference;
        }
      } else if (netDifference < 0) {
        const extraPaid = Math.abs(netDifference);
        if (extraPaid > newBalance) {
          const excessAdvance = extraPaid - newBalance;
          newBalance = 0;
          newAdvance += excessAdvance;

          // Ledger entry for supplier advance created during purchase overpayment
          const purAdvLedgerRef = doc(collection(db, 'ledger_entries'));
          const purAdvEntry: LedgerEntry = {
            id: purAdvLedgerRef.id,
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
          };
          batch.set(purAdvLedgerRef, purAdvEntry);
        } else {
          newBalance -= extraPaid;
        }
      }

      batch.update(supplierRef, {
        balance: newBalance,
        advance: newAdvance
      });
    }

    // Add Ledger Entry for Supplier purchase
    const ledgerRef = doc(collection(db, 'ledger_entries'));
    const ledgerEntry: LedgerEntry = {
      id: ledgerRef.id,
      entityId: newPurchase.supplierId,
      entityType: 'supplier',
      date: now,
      transactionType: 'purchase',
      referenceId: id,
      referenceNumber: invoiceNumber,
      description: `Stock Restocked: ${newPurchase.items.length} items received`,
      debit: newPurchase.paidAmount,
      credit: newPurchase.totalAmount,
      createdAt: now
    };
    batch.set(ledgerRef, ledgerEntry);

    addAuditLog(batch, 'CREATE_PURCHASE', `Purchase invoice recorded: ${invoiceNumber}. Total: Rs. ${newPurchase.totalAmount}, Paid: Rs. ${newPurchase.paidAmount}, Credit Balance: Rs. ${newPurchase.balanceAmount} for supplier: ${newPurchase.supplierName}`);

    try {
      await batch.commit();
      return newPurchase;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchases/${id}`);
      throw err;
    }
  };

  // Purchase Return
  const returnPurchase = async (purchaseId: string, returnedItems: { partId: string; quantity: number }[], refundAmount: number) => {
    const batch = writeBatch(db);
    const purchaseRef = doc(db, 'purchases', purchaseId);
    const originalPurchase = purchases.find(p => p.id === purchaseId);
    if (!originalPurchase) return;

    const now = new Date().toISOString();

    // Revert/decrease stock for returned parts, log adjustments
    returnedItems.forEach((retItem) => {
      const partRef = doc(db, 'parts', retItem.partId);
      const currentPart = parts.find(p => p.id === retItem.partId);
      if (currentPart) {
        batch.update(partRef, {
          stock: Math.max(0, currentPart.stock - retItem.quantity),
          updatedAt: now
        });
      }

      const adjRef = doc(collection(db, 'adjustments'));
      const adjustment: Adjustment = {
        id: adjRef.id,
        partId: retItem.partId,
        partName: currentPart?.name || 'Returned Part',
        type: 'purchase_return',
        quantity: retItem.quantity,
        price: currentPart?.purchasePrice || 0,
        referenceId: originalPurchase.invoiceNumber,
        reason: `Returned to Supplier on Purchase Invoice ${originalPurchase.invoiceNumber}`,
        createdAt: now
      };
      batch.set(adjRef, adjustment);
    });

    // Update purchase status
    batch.update(purchaseRef, {
      status: 'returned',
      updatedAt: now
    });

    // Revert/deduct supplier balance
    if (refundAmount > 0) {
      const supplierRef = doc(db, 'suppliers', originalPurchase.supplierId);
      const currentSupp = suppliers.find(s => s.id === originalPurchase.supplierId);
      if (currentSupp) {
        const currentBal = Number(currentSupp.balance) || 0;
        let newBalance = currentBal;
        let newAdvance = Number(currentSupp.advance) || 0;

        if (refundAmount > currentBal) {
          const extraRefund = refundAmount - currentBal;
          newBalance = 0;
          newAdvance += extraRefund;
        } else {
          newBalance -= refundAmount;
        }

        batch.update(supplierRef, {
          balance: newBalance,
          advance: newAdvance
        });
      }

      // Add Ledger Entry for Supplier Return
      const ledgerRef = doc(collection(db, 'ledger_entries'));
      const ledgerEntry: LedgerEntry = {
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
      };
      batch.set(ledgerRef, ledgerEntry);
    }

    addAuditLog(batch, 'PURCHASE_RETURN', `Returned purchase invoice ${originalPurchase.invoiceNumber}. Returned parts count: ${returnedItems.length}, Balance Adjustment Rs. ${refundAmount}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchases/${purchaseId}`);
    }
  };

  const recordCustomerPayment = async (paymentData: Omit<Payment, 'id' | 'voucherNumber' | 'entityType' | 'recordedBy' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const paymentRef = doc(collection(db, 'payments'));
    const id = paymentRef.id;
    const now = new Date().toISOString();
    const userEmail = auth.currentUser?.email || 'Unknown User';

    // Generate Voucher Number: REC-000001
    const paymentsCount = payments.length;
    const voucherNumber = `REC-${String(100000 + paymentsCount + 1).padStart(6, '0')}`;

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
    const batch = writeBatch(db);
    const paymentRef = doc(collection(db, 'payments'));
    const id = paymentRef.id;
    const now = new Date().toISOString();
    const userEmail = auth.currentUser?.email || 'Unknown User';

    // Generate Voucher Number: PAY-000001
    const paymentsCount = payments.length;
    const voucherNumber = `PAY-${String(100000 + paymentsCount + 1).padStart(6, '0')}`;

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
  const addAdjustment = async (adjData: Omit<Adjustment, 'id' | 'createdAt'>) => {
    const batch = writeBatch(db);
    const adjRef = doc(collection(db, 'adjustments'));
    const partRef = doc(db, 'parts', adjData.partId);
    const part = parts.find(p => p.id === adjData.partId);
    
    if (!part) return;

    const now = new Date().toISOString();
    const isAdding = adjData.type === 'adjustment_add';
    const updatedStock = isAdding 
      ? part.stock + adjData.quantity 
      : Math.max(0, part.stock - adjData.quantity);

    // Save adjustment log
    const adjustment: Adjustment = {
      ...adjData,
      id: adjRef.id,
      createdAt: now
    };
    batch.set(adjRef, adjustment);

    // Update part stock
    batch.update(partRef, {
      stock: updatedStock,
      updatedAt: now
    });

    addAuditLog(batch, 'MANUAL_STOCK_ADJUSTMENT', `Manual stock adjustment for ${part.name}: ${isAdding ? '+' : '-'}${adjData.quantity} units. New stock: ${updatedStock}. Reason: ${adjData.reason}`);

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `adjustments/${adjRef.id}`);
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
      shopName: 'Bismillah Autos & Spare Parts',
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
        'ledger_entries'
      ];

      const deletePromises: Promise<void>[] = [];
      for (const colName of collectionsToWipe) {
        const querySnapshot = await getDocs(collection(db, colName));
        querySnapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(docSnap.ref));
        });
      }

      await Promise.all(deletePromises);
      
      // Reset shop settings
      await setDoc(doc(db, 'settings', 'shop'), {
        shopName: 'Bismillah Autos & Spare Parts',
        phone: '0300-1234567',
        address: 'McLeod Road, Lahore, Pakistan',
        currency: 'Rs.',
        footerMessage: 'Thank you for your business! Guarantees only on genuine parts.',
        startingCash: 0,
        startingBank: 0
      });

      await addManualAuditLog('CLEAR_ALL_DATA', 'Cleared all application transactions, stock catalogs, user records, and reset workspace.');
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
