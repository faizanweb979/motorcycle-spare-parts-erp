export interface Part {
  id: string;
  partNumber: string; // Barcode or code
  name: string;
  brand: string;
  category: string;
  modelCompatibility: string; // e.g., CD70, CG125
  location: string; // Rack reference
  purchasePrice: number;
  retailPrice: number;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  shopName?: string;
  balance: number; // positive = owes us (credit customer), negative = advanced/deposit
  advance?: number; // Advance deposit balance (Rs.)
  lastPaymentDate?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  address?: string;
  balance: number; // positive = we owe them (credit supplier), negative = advanced
  advance?: number; // Advance balance (Rs.)
  lastPaymentDate?: string;
  createdAt: string;
}

export interface SaleItem {
  partId: string;
  partNumber: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  totalAmount: number;
  discount: number;
  paidAmount: number;
  balanceAmount: number; // total - discount - paid. If > 0, it increases customer balance.
  paymentMethod: 'cash' | 'credit' | 'bank_transfer';
  status: 'completed' | 'returned' | 'partial_return';
  items: SaleItem[];
  createdAt: string;
}

export interface PurchaseItem {
  partId: string;
  partNumber: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  total: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number; // total - paid. If > 0, increases supplier balance.
  status: 'completed' | 'returned';
  items: PurchaseItem[];
  createdAt: string;
}

export interface Adjustment {
  id: string;
  partId: string;
  partName: string;
  type: 'purchase' | 'sale' | 'adjustment_add' | 'adjustment_sub' | 'sales_return' | 'purchase_return';
  quantity: number;
  price: number;
  referenceId: string; // invoice number or adj ID
  reason: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  currency: string;
  footerMessage: string;
  startingCash?: number;
  startingBank?: number;
}

export interface Payment {
  id: string;
  voucherNumber: string; // REC-000001, PAY-000001
  date: string;
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'other';
  referenceNumber?: string;
  remarks?: string;
  recordedBy: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  entityId: string;
  entityType: 'customer' | 'supplier';
  date: string;
  transactionType: 'sale' | 'purchase' | 'payment_received' | 'payment_sent' | 'sales_return' | 'purchase_return' | 'starting_balance';
  referenceId: string; // Sale/Purchase ID, Payment ID, or 'STARTING_BALANCE'
  referenceNumber: string; // INV-MT-1001, PUR-MT-5001, REC-000001, etc.
  description: string;
  debit: number;
  credit: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: 'Rent' | 'Electricity' | 'Salaries' | 'Transport' | 'Internet' | 'Office Expenses' | 'Maintenance' | 'Miscellaneous';
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'other';
  notes?: string;
  createdAt: string;
}

export interface Partner {
  id: string;
  name: string;
  contact: string;
  investment: number;
  ownershipPercentage: number;
  joiningDate: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface Drawing {
  id: string;
  partnerId: string;
  partnerName: string;
  date: string;
  amount: number;
  reason: string;
  notes?: string;
  createdAt: string;
}
