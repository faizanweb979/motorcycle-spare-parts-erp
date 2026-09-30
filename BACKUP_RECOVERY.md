# Firebase Backup & Disaster Recovery Guide

This document provides instructions for setting up automated backups and disaster recovery procedures for the Motorcycle Spare Parts ERP.

---

## Automated Backups Configuration

### Firestore Database Scheduled Exports

Firebase provides automated scheduled exports for Firestore databases. Follow these steps to enable:

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com
   - Select project: `gen-lang-client-0201542724`

2. **Access Firestore Database**
   - Go to **Firestore Database** section
   - Click the **Export/Import** tab

3. **Create Scheduled Export**
   - Click **Create Export**
   - Configure the following:
     - **Export frequency:** Daily (recommended)
     - **Export time:** 2:00 AM (low-traffic period)
     - **Export location:** Select a Google Cloud Storage bucket
     - **Collections:** Select all collections (parts, customers, suppliers, sales, purchases, adjustments, audit_logs, payments, ledger_entries, settings, expenses, partners, drawings, counters)
     - **Retention:** 30 days (recommended)

4. **Save the Schedule**
   - Click **Create** to activate the scheduled export

### Cloud Storage Backups

For Firebase Storage (images), use Google Cloud Storage versioning or lifecycle policies:

1. **Enable Object Versioning**
   - Go to Google Cloud Console: https://console.cloud.google.com
   - Navigate to Storage > Browser
   - Select your bucket: `gen-lang-client-0201542724.firebasestorage.app`
   - Click **Configuration** > **Versioning**
   - Enable **Keep object versions**

2. **Set Lifecycle Policy**
   - Go to **Lifecycle** tab
   - Add rule to delete old versions after 90 days
   - This prevents storage costs from growing indefinitely

---

## Manual Backup Procedure

### Full Database Export

For immediate backup before major changes:

```bash
# Using Firebase CLI
firebase firestore:export --backup-path ./backups/firestore-$(date +%Y%m%d)

# Export specific collections
gcloud firestore export gs://your-bucket/backups --collection-ids=parts,customers,suppliers
```

### Storage Backup

```bash
# Using gsutil
gsutil -m cp -r gs://gen-lang-client-0201542724.firebasestorage.app ./backups/storage-$(date +%Y%m%d)
```

---

## Disaster Recovery Procedure

### Scenario 1: Accidental Data Deletion

**Severity:** High
**Recovery Time:** 15-30 minutes

**Steps:**
1. Identify the deleted data (check audit_logs for deletion events)
2. Go to Firebase Console > Firestore Database > Import/Export
3. Select the most recent export before the deletion
4. Click **Import** to restore data
5. Verify data integrity in the application
6. Document the incident in audit logs

### Scenario 2: Data Corruption

**Severity:** Critical
**Recovery Time:** 30-60 minutes

**Steps:**
1. Immediately stop all write operations (disable app temporarily)
2. Identify the corruption point via audit logs
3. Restore from the last known good backup
4. Replay transactions that occurred after the backup (if any)
5. Verify data integrity
6. Resume operations
7. Investigate root cause of corruption

### Scenario 3: Complete Data Loss

**Severity:** Critical
**Recovery Time:** 1-2 hours

**Steps:**
1. Declare incident and notify stakeholders
2. Restore from the most recent full backup
3. Verify all collections are restored correctly
4. Check ledger entries and audit logs for completeness
5. Reconcile financial data (sales, purchases, payments)
6. Test critical functionality (POS, inventory)
7. Resume operations with monitoring
8. Conduct post-incident review

---

## Backup Verification

### Weekly Verification Checklist

- [ ] Verify scheduled export ran successfully (check Firebase Console)
- [ ] Test restore process with a non-production backup
- [ ] Verify backup file integrity (check file sizes)
- [ ] Confirm retention policy is working (old backups deleted)
- [ ] Document any backup failures or issues

### Monthly Verification Checklist

- [ ] Perform full restore test to a test environment
- [ ] Verify all collections restore correctly
- [ ] Check audit logs are intact
- [ ] Verify ledger entries balance
- [ ] Test application functionality with restored data

---

## Recovery Point Objective (RPO) & Recovery Time Objective (RTO)

| Metric | Target | Current Status |
|--------|--------|----------------|
| **RPO** (Maximum data loss) | 24 hours | Daily exports = 24 hours RPO |
| **RTO** (Recovery time) | 1 hour | Depends on data size, typically 30-60 min |

---

## Emergency Contacts

- **Firebase Support:** https://firebase.google.com/support
- **Google Cloud Support:** https://cloud.google.com/support
- **Project Owner:** muslimbrothersadmin@gmail.com

---

## Important Notes

1. **Never delete backup files** manually unless they exceed retention policy
2. **Test restores regularly** - don't wait for an actual disaster
3. **Monitor backup storage costs** - large databases can be expensive
4. **Keep backup keys secure** - anyone with access can restore data
5. **Document all recovery operations** for post-incident analysis

---

## Firebase CLI Installation (if not already installed)

```bash
npm install -g firebase-tools
firebase login
```

---

## Quick Reference Commands

```bash
# Check scheduled exports status
firebase firestore:scheduledExports:list

# Trigger immediate export
firebase firestore:export --backup-path ./backups/emergency-$(date +%Y%m%d)

# Import from backup
firebase firestore:import --backup-path ./backups/firestore-20240101
```
