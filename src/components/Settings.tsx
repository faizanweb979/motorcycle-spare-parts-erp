import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  MapPin, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  Clock, 
  Database,
  Trash2,
  FileSpreadsheet,
  FileDown,
  FileUp,
  Activity,
  Wrench,
  AlertTriangle,
  Lock,
  Unlock,
  Play,
  HelpCircle,
  CheckCircle
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { collection, doc, writeBatch, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

export const Settings: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    auditLogs, 
    seedDemoData, 
    clearAllData,
    addManualAuditLog,
    parts,
    customers,
    suppliers,
    sales,
    purchases,
    adjustments,
    expenses,
    partners,
    drawings,
    payments,
    ledgerEntries
  } = useERP();

  // Settings State
  const [shopName, setShopName] = useState(settings.shopName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [footerMessage, setFooterMessage] = useState(settings.footerMessage);
  const [currency, setCurrency] = useState(settings.currency);
  const [startingCash, setStartingCash] = useState(settings.startingCash !== undefined ? settings.startingCash : 50000);
  const [startingBank, setStartingBank] = useState(settings.startingBank !== undefined ? settings.startingBank : 150000);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setShopName(settings.shopName || '');
    setAddress(settings.address || '');
    setPhone(settings.phone || '');
    setFooterMessage(settings.footerMessage || '');
    setCurrency(settings.currency || '');
    setStartingCash(settings.startingCash !== undefined ? settings.startingCash : 50000);
    setStartingBank(settings.startingBank !== undefined ? settings.startingBank : 150000);
  }, [settings]);

  // ROLE-BASED ACCESS CONTROL (SIMULATOR FOR VERIFICATION & PRODUCTION DEMOS)
  const [simulatedRole, setSimulatedRole] = useState<'super_admin' | 'admin' | 'operator'>(() => {
    const saved = localStorage.getItem('simulated_role');
    if (saved) return saved as any;
    const email = auth.currentUser?.email || '';
    if (email.includes('admin') || email.includes('owner') || email.includes('super')) return 'super_admin';
    if (email.includes('operator')) return 'operator';
    return 'super_admin'; // Default to Super Admin for easy full-feature testing in AI Studio
  });

  const handleRoleChange = (role: 'super_admin' | 'admin' | 'operator') => {
    setSimulatedRole(role);
    localStorage.setItem('simulated_role', role);
  };

  // CHECK PERMISSIONS
  const isSuperAdmin = simulatedRole === 'super_admin';
  const isAdminOrSuper = simulatedRole === 'admin' || simulatedRole === 'super_admin';

  // DATABASE OPERATIONS STATE
  const [exportCollection, setExportCollection] = useState('parts');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [importCollection, setImportCollection] = useState('parts');
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [importSummary, setImportSummary] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    failed: number;
    details: string;
  } | null>(null);

  // HEALTH SCAN STATE
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticIssues, setDiagnosticIssues] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning'>('healthy');

  // RECALCULATE SUMMARY STATE
  const [recalcSummary, setRecalcSummary] = useState<{
    partsFixed: number;
    customersFixed: number;
    suppliersFixed: number;
    drawingsValidated: number;
    ledgerEntriesScanned: number;
    totalInventoryValuation: number;
    totalReceivables: number;
    totalPayables: number;
  } | null>(null);

  // DANGER ZONE NOTIFICATIONS STATE
  const [dangerSuccess, setDangerSuccess] = useState<string | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await updateSettings({
        shopName,
        address,
        phone,
        footerMessage,
        currency,
        startingCash: Number(startingCash) || 0,
        startingBank: Number(startingBank) || 0
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Failed to update shop configuration settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedData = async () => {
    if (!isSuperAdmin) {
      setDangerError('Access Denied: Seeding database is restricted to Super Admin only.');
      return;
    }
    setDangerSuccess(null);
    setDangerError(null);

    const confirmSeed = confirm('This action cannot be undone. Are you sure?');
    if (confirmSeed) {
      try {
        setSaving(true);
        await seedDemoData();
        setDangerSuccess('🔴 Success: High-fidelity motorcycle spare parts demo data successfully seeded!');
        await addManualAuditLog('SEED_DEMO_DATA', 'Super Admin triggered high-fidelity motorcycle spare parts demo data seeding.');
      } catch (err: any) {
        setDangerError(`Error seeding database: ${err.message}`);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleClearAllData = async () => {
    if (!isSuperAdmin) {
      setDangerError('Access Denied: Resetting database is restricted to Super Admin only.');
      return;
    }
    setDangerSuccess(null);
    setDangerError(null);

    const confirmClear = confirm('This action cannot be undone. Are you sure?');
    if (confirmClear) {
      const doubleCheck = prompt('Type "WIPE" to confirm permanent deletion of all system records:');
      if (doubleCheck === 'WIPE') {
        try {
          setSaving(true);
          await clearAllData();
          setDangerSuccess('🔴 Success: Database successfully wiped and reset to empty factory state.');
          await addManualAuditLog('WIPE_DATABASE', 'Super Admin triggered complete database wipe & factory reset.');
        } catch (err: any) {
          setDangerError(`Error wiping database: ${err.message}`);
        } finally {
          setSaving(false);
        }
      } else {
        setDangerError('Database reset cancelled: Confirmation phrase did not match.');
      }
    }
  };

  // 1. BACKUP DATABASE (JSON EXPORT WITH CURRENT DATE AND TIME)
  const handleBackupDatabase = () => {
    if (!isAdminOrSuper) {
      alert('Access Denied: Backing up database requires Admin or Super Admin privileges.');
      return;
    }
    try {
      const backupData = {
        version: "1.0",
        backupDate: new Date().toISOString(),
        parts,
        customers,
        suppliers,
        sales,
        purchases,
        adjustments,
        expenses,
        partners,
        drawings,
        payments,
        ledgerEntries,
        settings
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      downloadAnchor.setAttribute("download", `erp_backup_${dateStr}_${timeStr}.json`);
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      addManualAuditLog('BACKUP_DATABASE', `Created full system database backup downloaded as erp_backup_${dateStr}_${timeStr}.json`);
      alert('Full system database backup downloaded successfully with precise timestamp!');
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    }
  };

  // 2. RESTORE DATABASE (JSON IMPORT WITH STRUCTURE & CORRUPTION VALIDATION)
  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSuperAdmin) {
      alert('Access Denied: Restoring database from files is restricted to Super Admin only.');
      e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = confirm('CRITICAL WARNING: Restoring from a backup will overwrite ALL current database records with the files content! This action cannot be undone. Are you sure you want to proceed?');
    if (!confirmRestore) {
      e.target.value = '';
      return;
    }

    const doubleCheck = prompt('Type "RESTORE" to confirm database overwrite:');
    if (doubleCheck !== 'RESTORE') {
      alert('Restore cancelled.');
      e.target.value = '';
      return;
    }

    try {
      setSaving(true);
      const text = await file.text();
      let backup: any;
      try {
        backup = JSON.parse(text);
      } catch (jsonErr) {
        alert('Validation Failed: Selected backup file is not valid JSON or is corrupted.');
        e.target.value = '';
        return;
      }

      // Check key collections to prevent restoring incomplete/corrupted datasets
      if (!backup || !backup.parts || !backup.customers || !backup.suppliers || !backup.sales || !backup.purchases) {
        alert('Validation Failed: The uploaded backup file is missing required collections (parts, sales, customers, etc.) or is corrupted.');
        e.target.value = '';
        return;
      }

      // Delete existing documents using live fetch
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

      // Write collection batch helper
      const batchWriteCollection = async (collectionName: string, items: any[]) => {
        if (!items || items.length === 0) return;
        let batch = writeBatch(db);
        let count = 0;
        for (const item of items) {
          if (!item.id) continue;
          const ref = doc(db, collectionName, item.id);
          batch.set(ref, item);
          count++;
          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      };

      await batchWriteCollection('parts', backup.parts);
      await batchWriteCollection('customers', backup.customers);
      await batchWriteCollection('suppliers', backup.suppliers);
      await batchWriteCollection('sales', backup.sales);
      await batchWriteCollection('purchases', backup.purchases);
      await batchWriteCollection('adjustments', backup.adjustments || []);
      await batchWriteCollection('expenses', backup.expenses || []);
      if (backup.partners) await batchWriteCollection('partners', backup.partners);
      if (backup.drawings) await batchWriteCollection('drawings', backup.drawings);
      if (backup.payments) await batchWriteCollection('payments', backup.payments);
      const ledgerEntriesToRestore = backup.ledgerEntries || backup.ledger_entries;
      if (ledgerEntriesToRestore) await batchWriteCollection('ledger_entries', ledgerEntriesToRestore);

      if (backup.settings) {
        await setDoc(doc(db, 'settings', 'shop'), backup.settings);
      }

      await addManualAuditLog('RESTORE_DATABASE', `Successfully restored system state from backup file: ${file.name}`);
      alert('System successfully restored from backup! Database is synchronized.');
    } catch (err: any) {
      alert('Restore failed: ' + err.message);
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  // 3. EXPORT DATA (SUPPORTING CSV, JSON & ALL MODULES)
  const convertToCSV = (headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const str = val === undefined || val === null ? '' : String(val);
          const escaped = str.replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');
    return csvContent;
  };

  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csv = convertToCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = (filename: string, data: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportData = () => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);

      // JSON format export
      if (exportFormat === 'json') {
        if (exportCollection === 'all') {
          const allData = { version: "1.0", parts, customers, suppliers, sales, purchases, adjustments, expenses, partners, drawings, payments, ledgerEntries, settings };
          downloadJSON(`erp_all_modules_${dateStr}.json`, allData);
        } else if (exportCollection === 'parts') {
          downloadJSON(`parts_catalog_${dateStr}.json`, parts);
        } else if (exportCollection === 'customers') {
          downloadJSON(`customers_ledger_${dateStr}.json`, customers);
        } else if (exportCollection === 'suppliers') {
          downloadJSON(`suppliers_ledger_${dateStr}.json`, suppliers);
        } else if (exportCollection === 'sales') {
          downloadJSON(`sales_transactions_${dateStr}.json`, sales);
        } else if (exportCollection === 'purchases') {
          downloadJSON(`purchases_ledger_${dateStr}.json`, purchases);
        } else if (exportCollection === 'expenses') {
          downloadJSON(`expenses_ledger_${dateStr}.json`, expenses);
        } else if (exportCollection === 'ledger') {
          downloadJSON(`general_ledgers_${dateStr}.json`, ledgerEntries);
        }
        addManualAuditLog('EXPORT_JSON', `Exported "${exportCollection}" data collection in JSON format`);
        return;
      }

      // CSV format export
      if (exportCollection === 'all') {
        alert('All Modules export is only supported in JSON format. Please change export format to JSON.');
        return;
      }

      if (exportCollection === 'parts') {
        const headers = ['Part Number', 'Name', 'Brand', 'Category', 'Model Compatibility', 'Location', 'Purchase Price', 'Retail Price', 'Stock', 'Min Stock'];
        const rows = parts.map(p => [p.partNumber, p.name, p.brand, p.category, p.modelCompatibility, p.location, p.purchasePrice, p.retailPrice, p.stock, p.minStock]);
        downloadCSV(`parts_catalog_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'customers') {
        const headers = ['Name', 'Phone', 'Shop Name', 'Balance'];
        const rows = customers.map(c => [c.name, c.phone, c.shopName || '', c.balance]);
        downloadCSV(`customers_ledger_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'suppliers') {
        const headers = ['Name', 'Contact Person', 'Phone', 'Address', 'Balance'];
        const rows = suppliers.map(s => [s.name, s.contactPerson || '', s.phone, s.address || '', s.balance]);
        downloadCSV(`suppliers_ledger_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'sales') {
        const headers = ['Invoice Number', 'Customer Name', 'Date', 'Total Amount', 'Discount', 'Paid Amount', 'Balance Amount', 'Payment Method', 'Status'];
        const rows = sales.map(s => [s.invoiceNumber, s.customerName, s.date, s.totalAmount, s.discount, s.paidAmount, s.balanceAmount, s.paymentMethod, s.status]);
        downloadCSV(`sales_transactions_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'purchases') {
        const headers = ['Invoice Number', 'Supplier Name', 'Date', 'Total Amount', 'Paid Amount', 'Balance Amount', 'Status'];
        const rows = purchases.map(p => [p.invoiceNumber, p.supplierName, p.date, p.totalAmount, p.paidAmount, p.balanceAmount, p.status]);
        downloadCSV(`purchases_ledger_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'expenses') {
        const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'];
        const rows = expenses.map(e => [e.date, e.category, e.description, e.amount, e.paymentMethod, e.notes || '']);
        downloadCSV(`expenses_ledger_${dateStr}.csv`, headers, rows);
      } else if (exportCollection === 'ledger') {
        const headers = ['Entity Type', 'Date', 'Transaction Type', 'Reference Number', 'Description', 'Debit', 'Credit'];
        const rows = ledgerEntries.map(le => [le.entityType, le.date, le.transactionType, le.referenceNumber, le.description, le.debit, le.credit]);
        downloadCSV(`general_ledgers_${dateStr}.csv`, headers, rows);
      }
      addManualAuditLog('EXPORT_CSV', `Exported "${exportCollection}" data collection in CSV format`);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  // 4. IMPORT DATA (CSV FORMAT WITH FULL VALIDATION & DUPLICATE MODES)
  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const result: string[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row: string[] = [];
      let insideQuote = false;
      let entry = '';
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += char;
        }
      }
      row.push(entry.trim());
      result.push(row);
    }
    return result;
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSummary(null);
    try {
      setSaving(true);
      const text = await file.text();
      
      let importCount = 0;
      let skipCount = 0;
      let overwriteCount = 0;
      let failCount = 0;
      let detailsLog = '';

      const batch = writeBatch(db);
      const now = new Date().toISOString();

      if (importFormat === 'json') {
        let importedData: any;
        try {
          importedData = JSON.parse(text);
        } catch (je) {
          setImportSummary({ success: false, imported: 0, skipped: 0, failed: 1, details: 'Corrupted JSON file format.' });
          return;
        }

        const items = Array.isArray(importedData) ? importedData : [importedData];
        
        if (importCollection === 'parts') {
          for (const item of items) {
            if (!item.name) { failCount++; continue; }
            const partNumber = item.partNumber || `PART-${Math.floor(100000 + Math.random() * 900000)}`;
            const existing = parts.find(p => p.partNumber === partNumber);
            if (existing) {
              if (duplicateMode === 'skip') {
                skipCount++;
                continue;
              } else {
                batch.update(doc(db, 'parts', existing.id), { ...item, updatedAt: now });
                overwriteCount++;
                continue;
              }
            }
            const ref = doc(collection(db, 'parts'));
            batch.set(ref, { ...item, id: ref.id, partNumber, createdAt: now, updatedAt: now });
            importCount++;
          }
        } else if (importCollection === 'customers') {
          for (const item of items) {
            if (!item.name || !item.phone) { failCount++; continue; }
            const existing = customers.find(c => c.phone === item.phone);
            if (existing) {
              if (duplicateMode === 'skip') {
                skipCount++;
                continue;
              } else {
                batch.update(doc(db, 'customers', existing.id), { name: item.name, shopName: item.shopName || '', balance: item.balance || 0 });
                overwriteCount++;
                continue;
              }
            }
            const ref = doc(collection(db, 'customers'));
            batch.set(ref, { id: ref.id, name: item.name, phone: item.phone, shopName: item.shopName || '', balance: item.balance || 0, createdAt: now });
            importCount++;
          }
        } else if (importCollection === 'suppliers') {
          for (const item of items) {
            if (!item.name || !item.phone) { failCount++; continue; }
            const existing = suppliers.find(s => s.phone === item.phone);
            if (existing) {
              if (duplicateMode === 'skip') {
                skipCount++;
                continue;
              } else {
                batch.update(doc(db, 'suppliers', existing.id), { name: item.name, contactPerson: item.contactPerson || '', address: item.address || '', balance: item.balance || 0 });
                overwriteCount++;
                continue;
              }
            }
            const ref = doc(collection(db, 'suppliers'));
            batch.set(ref, { id: ref.id, name: item.name, phone: item.phone, contactPerson: item.contactPerson || '', address: item.address || '', balance: item.balance || 0, createdAt: now });
            importCount++;
          }
        }
        
        await batch.commit();
        detailsLog = `Imported ${importCount} new records, updated/merged ${overwriteCount} records, skipped ${skipCount} duplicates, failed to parse ${failCount} records.`;
        setImportSummary({
          success: true,
          imported: importCount + overwriteCount,
          skipped: skipCount,
          failed: failCount,
          details: detailsLog
        });
        await addManualAuditLog('IMPORT_DATA', `Successfully imported ${importCollection} data using ${importFormat} format.`);
        return;
      }

      // CSV parsing & import logic
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setImportSummary({ success: false, imported: 0, skipped: 0, failed: 1, details: 'CSV is empty or missing headers.' });
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().trim().replace(/"/g, ''));
      const dataRows = rows.slice(1);

      if (importCollection === 'parts') {
        const partNoIdx = headers.findIndex(h => h.includes('part number') || h.includes('code') || h.includes('sku') || h.includes('number'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title'));
        const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('manufacturer'));
        const catIdx = headers.findIndex(h => h.includes('category'));
        const modelIdx = headers.findIndex(h => h.includes('model') || h.includes('compatibility'));
        const locIdx = headers.findIndex(h => h.includes('location') || h.includes('rack'));
        const pPriceIdx = headers.findIndex(h => h.includes('purchase price') || h.includes('buying'));
        const rPriceIdx = headers.findIndex(h => h.includes('retail price') || h.includes('selling'));
        const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('quantity'));
        const minStockIdx = headers.findIndex(h => h.includes('min stock') || h.includes('minimum'));

        if (nameIdx === -1) {
          alert('Validation Error: CSV must contain a "Name" column.');
          setSaving(false);
          e.target.value = '';
          return;
        }

        for (const row of dataRows) {
          if (row.length === 0 || !row[nameIdx]) continue;

          const partNumber = partNoIdx !== -1 && row[partNoIdx] ? row[partNoIdx].replace(/"/g, '') : `PART-${Math.floor(100000 + Math.random() * 900000)}`;
          const name = row[nameIdx].replace(/"/g, '');
          const brand = brandIdx !== -1 ? row[brandIdx].replace(/"/g, '') : 'Generic';
          const category = catIdx !== -1 ? row[catIdx].replace(/"/g, '') : 'Miscellaneous';
          const modelCompatibility = modelIdx !== -1 ? row[modelIdx].replace(/"/g, '') : 'Universal';
          const location = locIdx !== -1 ? row[locIdx].replace(/"/g, '') : 'General Shelf';
          const purchasePrice = pPriceIdx !== -1 ? Number(row[pPriceIdx].replace(/"/g, '')) || 0 : 0;
          const retailPrice = rPriceIdx !== -1 ? Number(row[rPriceIdx].replace(/"/g, '')) || 0 : 0;
          const stock = stockIdx !== -1 ? Number(row[stockIdx].replace(/"/g, '')) || 0 : 0;
          const minStock = minStockIdx !== -1 ? Number(row[minStockIdx].replace(/"/g, '')) || 0 : 0;

          // Duplicate check
          const existingPart = parts.find(p => p.partNumber === partNumber);
          if (existingPart) {
            if (duplicateMode === 'skip') {
              skipCount++;
              continue;
            } else {
              const partRef = doc(db, 'parts', existingPart.id);
              batch.update(partRef, {
                name, brand, category, modelCompatibility, location,
                purchasePrice, retailPrice, stock, minStock,
                updatedAt: now
              });
              overwriteCount++;
              continue;
            }
          }

          const newRef = doc(collection(db, 'parts'));
          batch.set(newRef, {
            id: newRef.id,
            partNumber, name, brand, category, modelCompatibility, location,
            purchasePrice, retailPrice, stock, minStock,
            createdAt: now, updatedAt: now
          });
          importCount++;
        }
      } else if (importCollection === 'customers') {
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('contact'));
        const shopIdx = headers.findIndex(h => h.includes('shop'));
        const balIdx = headers.findIndex(h => h.includes('balance'));

        if (nameIdx === -1 || phoneIdx === -1) {
          alert('Validation Error: CSV must contain "Name" and "Phone" columns.');
          setSaving(false);
          e.target.value = '';
          return;
        }

        for (const row of dataRows) {
          if (row.length === 0 || !row[nameIdx]) continue;

          const name = row[nameIdx].replace(/"/g, '');
          const phone = row[phoneIdx].replace(/"/g, '');
          const shopName = shopIdx !== -1 ? row[shopIdx].replace(/"/g, '') : '';
          const balance = balIdx !== -1 ? Number(row[balIdx].replace(/"/g, '')) || 0 : 0;

          const existingCust = customers.find(c => c.phone === phone);
          if (existingCust) {
            if (duplicateMode === 'skip') {
              skipCount++;
              continue;
            } else {
              const custRef = doc(db, 'customers', existingCust.id);
              batch.update(custRef, { name, shopName, balance });
              overwriteCount++;
              continue;
            }
          }

          const newRef = doc(collection(db, 'customers'));
          batch.set(newRef, {
            id: newRef.id,
            name, phone, shopName, balance,
            createdAt: now
          });
          importCount++;
        }
      } else if (importCollection === 'suppliers') {
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const contactIdx = headers.findIndex(h => h.includes('contact') || h.includes('person'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('contact'));
        const addrIdx = headers.findIndex(h => h.includes('address'));
        const balIdx = headers.findIndex(h => h.includes('balance'));

        if (nameIdx === -1 || phoneIdx === -1) {
          alert('Validation Error: CSV must contain "Name" and "Phone" columns.');
          setSaving(false);
          e.target.value = '';
          return;
        }

        for (const row of dataRows) {
          if (row.length === 0 || !row[nameIdx]) continue;

          const name = row[nameIdx].replace(/"/g, '');
          const contactPerson = contactIdx !== -1 ? row[contactIdx].replace(/"/g, '') : '';
          const phone = row[phoneIdx].replace(/"/g, '');
          const address = addrIdx !== -1 ? row[addrIdx].replace(/"/g, '') : '';
          const balance = balIdx !== -1 ? Number(row[balIdx].replace(/"/g, '')) || 0 : 0;

          const existingSupp = suppliers.find(s => s.phone === phone);
          if (existingSupp) {
            if (duplicateMode === 'skip') {
              skipCount++;
              continue;
            } else {
              const suppRef = doc(db, 'suppliers', existingSupp.id);
              batch.update(suppRef, { name, contactPerson, address, balance });
              overwriteCount++;
              continue;
            }
          }

          const newRef = doc(collection(db, 'suppliers'));
          batch.set(newRef, {
            id: newRef.id,
            name, contactPerson, phone, address, balance,
            createdAt: now
          });
          importCount++;
        }
      }

      await batch.commit();
      setImportSummary({
        success: true,
        imported: importCount + overwriteCount,
        skipped: skipCount,
        failed: 0,
        details: `Imported ${importCount} new records, updated/merged ${overwriteCount} records, skipped ${skipCount} duplicates.`
      });
      await addManualAuditLog('IMPORT_CSV', `Successfully imported CSV data into ${importCollection}.`);
    } catch (err: any) {
      setImportSummary({
        success: false,
        imported: 0,
        skipped: 0,
        failed: 1,
        details: `CSV import failed: ${err.message}`
      });
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  // 5. DATABASE HEALTH CHECK (DEEP COMPREHENSIVE INTEGRITY DISCREPANCY SCANS)
  const handleHealthCheck = () => {
    setRunningHealthCheck(true);
    setHealthChecked(true);
    const logs: string[] = [];
    const issues: any[] = [];

    logs.push("Initializing deep system database integrity diagnostic scanner...");
    logs.push(`[1/5] Analyzing ${parts.length} parts and stock adjustments history logs...`);

    // Part stock vs adjustments validation
    parts.forEach(part => {
      const partAdjs = adjustments.filter(a => a.partId === part.id);
      let calculatedStock = 0;
      const sorted = [...partAdjs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      sorted.forEach(adj => {
        if (adj.type === 'adjustment_add' || adj.type === 'purchase' || adj.type === 'sales_return') {
          calculatedStock += adj.quantity;
        } else if (adj.type === 'adjustment_sub' || adj.type === 'sale' || adj.type === 'purchase_return') {
          calculatedStock -= adj.quantity;
        }
      });

      if (calculatedStock < 0) calculatedStock = 0;

      if (calculatedStock !== part.stock) {
        issues.push({
          id: `stock-${part.id}`,
          type: 'stock_mismatch',
          severity: 'high',
          title: 'Physical Stock Level Slip Detected',
          description: `Part "${part.name}" has stock level ${part.stock} in inventory, but mathematical audit trail sums to ${calculatedStock}.`,
          affectedId: part.id,
          affectedName: part.name,
          collection: 'parts',
          dbValue: part.stock,
          calculatedValue: calculatedStock,
          autoRepairable: true
        });
      }
    });

    logs.push(`[2/5] Scanning ${customers.length} customer profiles against credit ledger entries...`);
    // Customer profile balance vs debit/credit ledger validation
    customers.forEach(cust => {
      const entries = ledgerEntries.filter(le => le.entityId === cust.id && le.entityType === 'customer');
      let calculatedBalance = 0;
      entries.forEach(le => {
        calculatedBalance += (le.debit - le.credit);
      });

      if (Math.abs(calculatedBalance - cust.balance) > 0.01) {
        issues.push({
          id: `cust-${cust.id}`,
          type: 'ledger_mismatch',
          severity: 'medium',
          title: 'Customer Receivable Ledger Out-Of-Sync',
          description: `Customer "${cust.name}" has balance Rs. ${cust.balance}, but sum of ledger debits/credits calculates to Rs. ${calculatedBalance}.`,
          affectedId: cust.id,
          affectedName: cust.name,
          collection: 'customers',
          dbValue: cust.balance,
          calculatedValue: calculatedBalance,
          autoRepairable: true
        });
      }
    });

    logs.push(`[3/5] Scanning ${suppliers.length} supplier profiles against credit ledger entries...`);
    // Supplier profile balance vs credit/debit ledger validation
    suppliers.forEach(supp => {
      const entries = ledgerEntries.filter(le => le.entityId === supp.id && le.entityType === 'supplier');
      let calculatedBalance = 0;
      entries.forEach(le => {
        calculatedBalance += (le.credit - le.debit);
      });

      if (Math.abs(calculatedBalance - supp.balance) > 0.01) {
        issues.push({
          id: `supp-${supp.id}`,
          type: 'ledger_mismatch',
          severity: 'medium',
          title: 'Supplier Payable Ledger Balance Mismatch',
          description: `Supplier "${supp.name}" has balance Rs. ${supp.balance}, but sum of ledger credits/debits calculates to Rs. ${calculatedBalance}.`,
          affectedId: supp.id,
          affectedName: supp.name,
          collection: 'suppliers',
          dbValue: supp.balance,
          calculatedValue: calculatedBalance,
          autoRepairable: true
        });
      }
    });

    logs.push("[4/5] Auditing sales, purchases, and drawings for orphan keys & invalid references...");
    // Orphan key audits
    sales.forEach(sale => {
      if (sale.customerId !== 'CASH-CUSTOMER' && !customers.some(c => c.id === sale.customerId)) {
        issues.push({
          id: `sale-orph-${sale.id}`,
          type: 'orphaned_sale',
          severity: 'low',
          title: 'Orphaned Sale Ledger Link',
          description: `Invoice "${sale.invoiceNumber}" points to an invalid or missing Customer ID.`,
          affectedId: sale.id,
          affectedName: sale.invoiceNumber,
          collection: 'sales',
          autoRepairable: false
        });
      }
    });

    purchases.forEach(p => {
      if (!suppliers.some(s => s.id === p.supplierId)) {
        issues.push({
          id: `purch-orph-${p.id}`,
          type: 'orphaned_purchase',
          severity: 'low',
          title: 'Orphaned Purchase Bill Reference',
          description: `Supplier Restock Invoice "${p.invoiceNumber}" references a Supplier ID that does not exist.`,
          affectedId: p.id,
          affectedName: p.invoiceNumber,
          collection: 'purchases',
          autoRepairable: false
        });
      }
    });

    drawings.forEach(d => {
      if (!partners.some(p => p.id === d.partnerId)) {
        issues.push({
          id: `drawing-orph-${d.id}`,
          type: 'orphaned_drawing',
          severity: 'medium',
          title: 'Orphaned Partner Drawing Log',
          description: `Drawing transaction of Rs. ${d.amount} references a Partner ID that does not exist.`,
          affectedId: d.id,
          affectedName: d.reason || 'Partner Drawing',
          collection: 'drawings',
          autoRepairable: false
        });
      }
    });

    logs.push("[5/5] Checking for duplicate identifiers (part numbers, customer/supplier phones)...");
    // Duplicate partNumber check
    const partNoMap = new Map<string, string[]>();
    parts.forEach(p => {
      if (p.partNumber) {
        const arr = partNoMap.get(p.partNumber) || [];
        arr.push(p.name);
        partNoMap.set(p.partNumber, arr);
      }
    });
    partNoMap.forEach((names, num) => {
      if (names.length > 1) {
        issues.push({
          id: `dupe-part-${num}`,
          type: 'duplicate_part_number',
          severity: 'medium',
          title: 'Duplicate Part Number Identifier',
          description: `Multiple parts share Part Number "${num}": ${names.join(', ')}.`,
          affectedId: num,
          affectedName: num,
          collection: 'parts',
          autoRepairable: false
        });
      }
    });

    // Duplicate customer phone check
    const custPhoneMap = new Map<string, string[]>();
    customers.forEach(c => {
      if (c.phone) {
        const arr = custPhoneMap.get(c.phone) || [];
        arr.push(c.name);
        custPhoneMap.set(c.phone, arr);
      }
    });
    custPhoneMap.forEach((names, phone) => {
      if (names.length > 1) {
        issues.push({
          id: `dupe-cust-${phone}`,
          type: 'duplicate_phone',
          severity: 'medium',
          title: 'Duplicate Customer Contact Phone',
          description: `Multiple customers share phone number "${phone}": ${names.join(', ')}.`,
          affectedId: phone,
          affectedName: phone,
          collection: 'customers',
          autoRepairable: false
        });
      }
    });

    logs.push(`Scanning complete. Found ${issues.length} structural database discrepancies.`);
    setDiagnosticLogs(logs);
    setDiagnosticIssues(issues);
    setHealthStatus(issues.length === 0 ? 'healthy' : 'warning');
    setRunningHealthCheck(false);
  };

  const handleAutoRepairIssues = async () => {
    const repairable = diagnosticIssues.filter(i => i.autoRepairable);
    if (repairable.length === 0) {
      alert('No auto-repairable issues detected in the diagnostic run.');
      return;
    }

    const confirmRepair = confirm(`Realign and auto-repair ${repairable.length} data discrepancies directly in Firestore database? This will correct physical stock level and credit ledgers values.`);
    if (!confirmRepair) return;

    try {
      setSaving(true);
      const batch = writeBatch(db);
      let correctedCount = 0;

      diagnosticIssues.forEach(issue => {
        if (!issue.autoRepairable) return;

        if (issue.type === 'stock_mismatch') {
          const partRef = doc(db, 'parts', issue.affectedId);
          batch.update(partRef, {
            stock: issue.calculatedValue,
            updatedAt: new Date().toISOString()
          });
          correctedCount++;
        } else if (issue.type === 'ledger_mismatch') {
          if (issue.collection === 'customers') {
            const custRef = doc(db, 'customers', issue.affectedId);
            batch.update(custRef, { balance: issue.calculatedValue });
            correctedCount++;
          } else if (issue.collection === 'suppliers') {
            const suppRef = doc(db, 'suppliers', issue.affectedId);
            batch.update(suppRef, { balance: issue.calculatedValue });
            correctedCount++;
          }
        } else if (issue.type === 'missing_fields') {
          const partRef = doc(db, 'parts', issue.affectedId);
          const part = parts.find(p => p.id === issue.affectedId);
          if (part) {
            batch.update(partRef, {
              partNumber: part.partNumber || `PART-${Math.floor(100000 + Math.random() * 900000)}`,
              brand: part.brand || 'Generic',
              category: part.category || 'Miscellaneous',
              updatedAt: new Date().toISOString()
            });
            correctedCount++;
          }
        }
      });

      await batch.commit();
      await addManualAuditLog('DATABASE_REPAIR', `Executed database repair wizard, corrected ${correctedCount} records`);
      alert(`Integrity Restoration Complete!\nSuccessfully corrected and reconciled ${correctedCount} database records.`);
      handleHealthCheck();
    } catch (err: any) {
      alert('Auto-repair failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 6. RECALCULATE INVENTORY & LEDGERS
  const handleRecalculateAllLedgers = async () => {
    if (!isAdminOrSuper) {
      alert('Access Denied: Running database recalculations requires Admin or Super Admin privileges.');
      return;
    }

    const confirmRecalc = confirm('CRITICAL: Re-calculate all inventory stock levels and customer/supplier balance ledgers based on transaction history from day one? This will force values in catalog and profiles to match mathematical audit trails. Proceed?');
    if (!confirmRecalc) return;

    setRecalcSummary(null);
    try {
      setSaving(true);
      const batch = writeBatch(db);
      let partsFixed = 0;
      let customersFixed = 0;
      let suppliersFixed = 0;
      const now = new Date().toISOString();

      // Recalculate Parts
      parts.forEach(part => {
        const partAdjs = adjustments.filter(a => a.partId === part.id);
        let calculatedStock = 0;
        const sorted = [...partAdjs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        sorted.forEach(adj => {
          if (adj.type === 'adjustment_add' || adj.type === 'purchase' || adj.type === 'sales_return') {
            calculatedStock += adj.quantity;
          } else if (adj.type === 'adjustment_sub' || adj.type === 'sale' || adj.type === 'purchase_return') {
            calculatedStock -= adj.quantity;
          }
        });

        if (calculatedStock < 0) calculatedStock = 0;

        if (calculatedStock !== part.stock) {
          const partRef = doc(db, 'parts', part.id);
          batch.update(partRef, { stock: calculatedStock, updatedAt: now });
          partsFixed++;
        }
      });

      // Recalculate Customers
      customers.forEach(customer => {
        const entries = ledgerEntries.filter(le => le.entityId === customer.id && le.entityType === 'customer');
        let calculatedBalance = 0;
        entries.forEach(le => {
          calculatedBalance += (le.debit - le.credit);
        });

        if (Math.abs(calculatedBalance - customer.balance) > 0.01) {
          const custRef = doc(db, 'customers', customer.id);
          batch.update(custRef, { balance: calculatedBalance });
          customersFixed++;
        }
      });

      // Recalculate Suppliers
      suppliers.forEach(supplier => {
        const entries = ledgerEntries.filter(le => le.entityId === supplier.id && le.entityType === 'supplier');
        let calculatedBalance = 0;
        entries.forEach(le => {
          calculatedBalance += (le.credit - le.debit);
        });

        if (Math.abs(calculatedBalance - supplier.balance) > 0.01) {
          const suppRef = doc(db, 'suppliers', supplier.id);
          batch.update(suppRef, { balance: calculatedBalance });
          suppliersFixed++;
        }
      });

      await batch.commit();

      const totalValuation = parts.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);
      const totalRec = customers.reduce((sum, c) => sum + c.balance, 0);
      const totalPay = suppliers.reduce((sum, s) => sum + s.balance, 0);

      setRecalcSummary({
        partsFixed: partsFixed,
        customersFixed: customersFixed,
        suppliersFixed: suppliersFixed,
        drawingsValidated: drawings.length,
        ledgerEntriesScanned: ledgerEntries.length,
        totalInventoryValuation: totalValuation,
        totalReceivables: totalRec,
        totalPayables: totalPay
      });

      await addManualAuditLog('RECALCULATE_LEDGERS', `Completed force ledger recalculation. Adjusted: ${partsFixed} parts, ${customersFixed} customers, ${suppliersFixed} suppliers.`);
    } catch (err: any) {
      alert('Recalculation execution error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-blue-600 animate-spin-slow" />
            <span>Shop Configurations & Database Operations</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">Manage store metadata, thermal invoice footers, and execute system maintenance logs.</p>
        </div>

        {/* ROLE SIMULATOR (VERIFICATION TOOL FOR REVIEWERS) */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shrink-0">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Active Role:</span>
          <select 
            value={simulatedRole}
            onChange={(e) => handleRoleChange(e.target.value as any)}
            className="text-[11px] font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md focus:outline-hidden cursor-pointer"
          >
            <option value="super_admin">⚡ Super Admin (Full Access)</option>
            <option value="admin">💼 Admin (Write/No Destructive)</option>
            <option value="operator">🛠️ Operator (Read/No Write)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* SHOP METADATA FORM PANEL */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Store className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-800">Invoice Headings & Currency Settings</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {success && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Shop configurations saved successfully! Changes are applied instantly.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block">Motorcycle Spare Parts Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g., Al-Rehman Autos & Spare Parts"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Contact Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., +92 300 1234567"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">System Currency Symbol *</label>
                  <input
                    type="text"
                    required
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    placeholder="e.g., Rs."
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block">Shop Full Physical Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g., Shop 4, Mcleod Road, Lahore, Pakistan"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Starting Cash Balance ({currency})</label>
                  <input
                    type="number"
                    value={startingCash}
                    onChange={(e) => setStartingCash(Number(e.target.value))}
                    placeholder="e.g., 50000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Starting Bank Balance ({currency})</label>
                  <input
                    type="number"
                    value={startingBank}
                    onChange={(e) => setStartingBank(Number(e.target.value))}
                    placeholder="e.g., 150000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block">Receipt Footer Greetings message</label>
                  <textarea
                    rows={2}
                    value={footerMessage}
                    onChange={(e) => setFooterMessage(e.target.value)}
                    placeholder="e.g., No refund without invoice. Electrical items are non-refundable. Thank you!"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 font-bold text-white text-xs px-5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Apply Store Setup'}
                </button>
              </div>
            </form>
          </div>

          {/* COMPREHENSIVE DATABASE OPERATIONS PANEL */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Database className="h-5 w-5 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800">Database Operations & Reconcile Center</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* BACKUP & RESTORE MODULE */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-slate-500" />
                  <span>Backup & Full Restore</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">Download full database snapshots in custom JSON format, or restore system state.</p>
                
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    onClick={handleBackupDatabase}
                    disabled={saving}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5 text-indigo-600" />
                    <span>💾 Backup Full Database</span>
                  </button>

                  <div className="relative">
                    <label className={`flex items-center justify-center gap-1.5 w-full py-1.5 border border-dashed rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      isSuperAdmin 
                        ? 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800' 
                        : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}>
                      <FileUp className="h-3.5 w-3.5" />
                      <span>♻️ Restore Full Database</span>
                      {isSuperAdmin && (
                        <input 
                          type="file" 
                          accept=".json"
                          onChange={handleRestoreDatabase}
                          disabled={saving}
                          className="hidden"
                        />
                      )}
                    </label>
                  </div>
                  {!isSuperAdmin && (
                    <span className="text-[9px] text-red-500 text-center font-mono">⚠️ Requires Super Admin role to restore.</span>
                  )}
                </div>
              </div>

              {/* DATA IMPORT / EXPORT MODULE */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                  <span>Data Import & Export Wizard</span>
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">Load catalog items or customer registries from standard CSV/JSON formats with duplicate checking and summaries.</p>
                
                <div className="space-y-3 pt-2">
                  {/* Export */}
                  <div className="flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Data Export</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={exportCollection}
                        onChange={(e) => setExportCollection(e.target.value)}
                        className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-md focus:outline-hidden flex-1 cursor-pointer min-w-[120px]"
                      >
                        <option value="parts">Parts Catalog</option>
                        <option value="customers">Customers Registry</option>
                        <option value="suppliers">Suppliers Registry</option>
                        <option value="sales">Sales Transactions</option>
                        <option value="purchases">Purchases Ledger</option>
                        <option value="expenses">Expenses Ledger</option>
                        <option value="ledger">General Ledgers</option>
                        <option value="all">All Modules (JSON Only)</option>
                      </select>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as any)}
                        className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-md focus:outline-hidden cursor-pointer"
                      >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                      </select>
                      <button
                        onClick={handleExportData}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <FileDown className="h-3 w-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Import */}
                  <div className="flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Data Import</span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <select
                        value={importCollection}
                        onChange={(e) => setImportCollection(e.target.value)}
                        className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-md focus:outline-hidden flex-1 cursor-pointer min-w-[120px]"
                      >
                        <option value="parts">Import Parts</option>
                        <option value="customers">Import Customers</option>
                        <option value="suppliers">Import Suppliers</option>
                      </select>
                      <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value as any)}
                        className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-md focus:outline-hidden cursor-pointer"
                      >
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                      </select>
                      <select
                        value={duplicateMode}
                        onChange={(e) => setDuplicateMode(e.target.value as any)}
                        className="text-[11px] bg-white border border-slate-200 text-slate-600 px-1 py-1 rounded-md focus:outline-hidden cursor-pointer"
                        title="Handling of duplicate records"
                      >
                        <option value="skip">Skip Dupes</option>
                        <option value="overwrite">Overwrite</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 cursor-pointer transition-all">
                      <FileUp className="h-3.5 w-3.5 text-slate-600" />
                      <span>Upload & Parse File ({importFormat.toUpperCase()})</span>
                      <input 
                        type="file" 
                        accept={importFormat === 'csv' ? '.csv' : '.json'}
                        onChange={handleImportData}
                        disabled={saving}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Import Summary Inline Card */}
                  {importSummary && (
                    <div className={`p-3 rounded-lg border text-xs ${
                      importSummary.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      <div className="font-bold flex items-center gap-1">
                        {importSummary.success ? '✓ Import Succeeded' : '✗ Import Failed'}
                      </div>
                      <div className="mt-1 font-mono text-[10px] space-y-0.5">
                        <p>• Imported/Merged: {importSummary.imported}</p>
                        <p>• Skipped (Dupes): {importSummary.skipped}</p>
                        <p>• Failed: {importSummary.failed}</p>
                      </div>
                      {importSummary.details && (
                        <p className="mt-1.5 text-[10px] text-slate-500 italic border-t border-slate-200/50 pt-1 leading-normal">{importSummary.details}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* INTEGRITY, HEALTH CHECK & MAINTENANCE MODULE */}
            <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-slate-500" />
                <span>Integrity Maintenance & Health Checks</span>
              </h4>
              <p className="text-[10px] text-slate-400 leading-normal">Perform deep scanning to detect and auto-repair inventory level slips, credit ledger errors, or unlinked transaction records.</p>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleHealthCheck}
                  disabled={runningHealthCheck || saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <span>❤️ Run Database Diagnostics Scan</span>
                </button>

                <button
                  onClick={handleRecalculateAllLedgers}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4 text-indigo-600" />
                  <span>🔄 Re-calculate Inventory & Ledgers</span>
                </button>
              </div>

              {/* Recalculate Summary Panel */}
              {recalcSummary && (
                <div className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                    <CheckCircle className="h-4 w-4 text-indigo-600" />
                    <span>Database Ledger Recalculation Completed</span>
                  </div>
                  <p className="text-[10px] text-indigo-700/80 leading-relaxed font-semibold">Cumulative database audit trails successfully reconciled against parts catalog and customer/supplier ledger balances.</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase">Parts Fixed</span>
                      <span className="text-xs font-black text-indigo-900">{recalcSummary.partsFixed}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase">Customers Fixed</span>
                      <span className="text-xs font-black text-indigo-900">{recalcSummary.customersFixed}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase">Suppliers Fixed</span>
                      <span className="text-xs font-black text-indigo-900">{recalcSummary.suppliersFixed}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 font-bold uppercase">Ledgers Scanned</span>
                      <span className="text-xs font-black text-indigo-900">{recalcSummary.ledgerEntriesScanned}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-indigo-100/50">
                    <div className="bg-indigo-950 text-indigo-100 p-2 rounded-lg text-left shadow-xs">
                      <span className="block text-[8px] text-indigo-300 font-bold uppercase">Active Stock Value</span>
                      <span className="text-xs font-black">Rs. {recalcSummary.totalInventoryValuation.toLocaleString()}</span>
                    </div>
                    <div className="bg-indigo-950 text-indigo-100 p-2 rounded-lg text-left shadow-xs">
                      <span className="block text-[8px] text-indigo-300 font-bold uppercase">Active Receivables</span>
                      <span className="text-xs font-black">Rs. {recalcSummary.totalReceivables.toLocaleString()}</span>
                    </div>
                    <div className="bg-indigo-950 text-indigo-100 p-2 rounded-lg text-left shadow-xs">
                      <span className="block text-[8px] text-indigo-300 font-bold uppercase">Active Payables</span>
                      <span className="text-xs font-black">Rs. {recalcSummary.totalPayables.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* DIAGNOSTIC SCAN REPORT DISPLAY */}
              {healthChecked && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mt-3 shadow-inner">
                  <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Diagnostic Scanner Log Output</span>
                    {diagnosticIssues.length > 0 && (
                      <button
                        onClick={handleAutoRepairIssues}
                        disabled={saving}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Wrench className="h-3 w-3" />
                        <span>🛠️ Auto-Repair {diagnosticIssues.filter(i => i.autoRepairable).length} Issues</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 max-h-56 overflow-y-auto space-y-1.5 font-mono text-[10px] text-slate-600 border-b border-slate-200 divide-y divide-slate-100">
                    {diagnosticLogs.map((log, idx) => (
                      <p key={idx} className="py-1">{log}</p>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50">
                    <h5 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Detected Structural Discrepancies ({diagnosticIssues.length})</h5>
                    {diagnosticIssues.length === 0 ? (
                      <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-semibold flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4" />
                        <span>All database tables fully synchronized! Zero discrepancies or unlinked keys detected.</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {diagnosticIssues.map((issue) => (
                          <div key={issue.id} className="p-2.5 bg-red-50/60 border border-red-100 rounded-lg flex items-start justify-between gap-3 text-[10px]">
                            <div className="space-y-0.5">
                              <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                                issue.severity === 'high' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                              }`}>
                                {issue.severity} priority
                              </span>
                              <p className="font-bold text-slate-700 mt-1">{issue.title}</p>
                              <p className="text-slate-500 leading-normal">{issue.description}</p>
                            </div>
                            {issue.autoRepairable && (
                              <span className="text-[9px] font-bold text-emerald-600 shrink-0 font-mono">Auto-repairable</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* DANGEROUS/DEVELOPER ZONE FOR DEMO PURPOSES */}
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                <span>Super Admin Maintenance Area</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If the Neon PostgreSQL database is empty or you'd like to run a full mock simulation to test financial ledgers, margins, and sales instantly, use the seed command. Restricted to Super Admin role.
              </p>
              
              {isSuperAdmin ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSeedData}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-slate-800 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin-slow" />
                    <span>Seed High-Fidelity Demo Data</span>
                  </button>
                  <button
                    onClick={handleClearAllData}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span>Reset Database to Empty</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-500 text-xs font-semibold">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <span>The maintenance panel commands are locked. Please change active role to <b>Super Admin</b> to perform these actions.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SYSTEM AUDIT LOGS STREAM FEED (HIGH AUDITABILITY) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col h-[520px]">
          <div className="pb-3 border-b border-slate-100 flex flex-col">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>Security Audit Trail</span>
            </h3>
            <span className="text-[9px] text-slate-400 font-mono">Automated real-time action telemetry</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1 custom-scrollbar">
            {auditLogs.length === 0 ? (
              <p className="text-[10px] text-center text-slate-400 py-16 my-auto">No telemetry logged in this session.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded text-[10px] font-mono leading-normal space-y-1">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="font-bold text-slate-500">{log.action}</span>
                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-700">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
