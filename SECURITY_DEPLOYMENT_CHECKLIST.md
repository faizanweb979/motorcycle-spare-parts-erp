# SECURITY & DEPLOYMENT CHECKLIST
## Pre-Production Handoff

**Target Date:** August 9, 2026  
**Prepared For:** Operations & Deployment Team

---

## QUICK REFERENCE: What's Fixed?

| Feature | Status | Why It Matters |
|---------|--------|-----------------|
| ✅ **Stock Transactions** | FIXED | Prevents overselling even with concurrent users |
| ✅ **Image Upload Safety** | FIXED | Prevents orphaned files in Storage |
| ✅ **Security Rules** | FIXED | Validates all data at database level |
| ✅ **URL Routing** | FIXED | Refresh/direct URLs don't lose page state |
| ✅ **Offline Detection** | FIXED | Users get clear error messages offline |

---

## DEPLOYMENT STEPS

### Step 1: Pre-Deployment Verification (5 minutes)

```bash
cd "d:\new project 10 - Copy\motorcycle-spare-parts-erp"

# Verify build passes
npm run lint
# Expected: No errors

npm run build
# Expected: Build successful, no errors
```

**Checklist:**
- [ ] TypeScript lint passes (0 errors)
- [ ] Build succeeds (0 errors)
- [ ] No console warnings about security

### Step 2: Deploy Firestore Security Rules (2 minutes)

```bash
firebase deploy --only firestore:rules
```

**What it does:**
- Deploys hardened Firestore security rules
- Validates all data writes server-side
- Protects against oversized fields
- Enforces role-based access

**Expected output:**
```
✓ firestore:rules deployed successfully
```

**Verification:**
- [ ] Rules deployed successfully
- [ ] No deployment errors in console

### Step 3: Deploy Firebase Storage Rules (1 minute)

```bash
firebase deploy --only storage
```

**What it does:**
- Deploys storage upload restrictions
- Enforces file size limits (5MB)
- Restricts to image types only
- Restricts paths

**Expected output:**
```
✓ storage:rules deployed successfully
```

**Verification:**
- [ ] Rules deployed successfully
- [ ] No deployment errors

### Step 4: Deploy Application (2 minutes)

```bash
firebase deploy --only hosting
```

Or if deploying to Vercel:
```bash
npm run build
# Deploy dist/ folder to your hosting
```

**Verification:**
- [ ] Application deployed
- [ ] Can access login page
- [ ] Firebase connection working

### Step 5: Post-Deployment Smoke Tests (10 minutes)

#### Test 5A: Login & Basic Navigation
1. [ ] Open app in browser
2. [ ] Login with test account
3. [ ] Navigate to Parts Master
4. [ ] Click on a part to view details
5. [ ] Expected: Part detail loads, no errors

#### Test 5B: Create Sale (Stock Transaction Safety)
1. [ ] Navigate to Sales POS
2. [ ] Add part to cart (quantity: 2)
3. [ ] Click "Issue Invoice"
4. [ ] Expected: Sale created, stock deducted

#### Test 5C: Upload Image (Transaction Safety)
1. [ ] Open Part Detail
2. [ ] Click "Upload Image"
3. [ ] Select JPEG file (< 5MB)
4. [ ] Expected: Image uploads, displays, persists

#### Test 5D: Offline Behavior
1. [ ] Open Part Detail (while online)
2. [ ] Disconnect internet (dev tools → Network → Offline)
3. [ ] Try to upload image
4. [ ] Expected: Error message "You are offline..."
5. [ ] Reconnect internet

#### Test 5E: URL Routing
1. [ ] Navigate to part detail
2. [ ] Copy URL from address bar
3. [ ] Refresh page (F5)
4. [ ] Expected: Part detail still shows
5. [ ] Open URL in new tab
6. [ ] Expected: Part loads directly

#### Test 5F: Security Rules (Image Field)
1. [ ] Open Part Detail
2. [ ] Edit notes to 10,000+ characters
3. [ ] Click Save
4. [ ] Expected: Save fails, error shown
5. [ ] Check browser console
6. [ ] Expected: "data.notes.size() > 5000" error

---

## MONITORING AFTER DEPLOYMENT

### First 24 Hours: Active Monitoring

Check these every 1-2 hours:

1. **Firebase Console:**
   - Go to: https://console.firebase.google.com
   - Look at: Cloud Firestore → Logs
   - Watch for: Permission denied errors (should be minimal)
   - Take action: If errors spike, check user roles

2. **Error Logs:**
   - Check application error tracking
   - Look for: Unexpected permission denied
   - Take action: Review user's role in security rules

3. **User Reports:**
   - Ask support: Any issues reported?
   - Watch for: Stock problems, upload failures, etc.
   - Take action: Test affected workflows

### Weekly Monitoring: Routine Health Check

```
EVERY FRIDAY:

1. [ ] Firebase Console → Firestore Logs
   - Scan for permission errors
   - Scan for validation failures (oversized fields)

2. [ ] Firebase Storage
   - Check storage usage (watch for orphaned files)
   - Look for: Unexpected growth in storage
   - Action: Run cleanup if needed

3. [ ] Application Metrics
   - Check average response time
   - Check error rates
   - Compare to baseline

4. [ ] Security Audit
   - Review audit logs (last 7 days)
   - Look for: Unusual patterns
   - Action: Investigate anomalies
```

### Monthly Review: Deep Dive

```
MONTHLY CHECKLIST:

1. [ ] Security Rules Review
   - Are all rules still appropriate?
   - Do we need role additions?
   - Any new vulnerabilities?

2. [ ] Storage Cleanup
   - Delete orphaned image files
   - Review storage growth
   - Optimize large files if needed

3. [ ] Performance Analysis
   - Slow queries? Optimize them
   - Large documents? Optimize schema
   - High costs? Optimize collection structure

4. [ ] Compliance Check
   - Are we logging everything?
   - Are audit logs protected?
   - Do we backup audit logs?
```

---

## EMERGENCY PROCEDURES

### If Something Goes Wrong

#### Symptom: "Permission Denied" Errors for Normal Users

**Likely Cause:** Security rules too restrictive

**Recovery Steps:**
```bash
# 1. Revert to previous rules version
git checkout HEAD~1 firestore.rules

# 2. Deploy previous version
firebase deploy --only firestore:rules

# 3. Investigate in calm state
# Check user roles, rule syntax, etc.
```

**Prevention:** Always test in staging first

#### Symptom: Stock Going Negative / Overselling

**Likely Cause:** Transaction logic failure

**Recovery Steps:**
```bash
# 1. Disable Sales POS temporarily
# (Remove "sales" tab from Sidebar)

# 2. Investigate recent sales
# - Check which sales created negative stock
# - Review transaction logs

# 3. Manual adjustment
# - Create adjustment records to fix stock
# - Document in audit log

# 4. Fix and redeploy code
```

**Prevention:** Test concurrent sales before deploying

#### Symptom: Orphaned Files Accumulating in Storage

**Likely Cause:** Image upload failures (should be rare with fix)

**Recovery Steps:**
```bash
# 1. Identify orphaned files
# - Get all imageUrls from Firestore
# - Compare with files in Storage
# - Find URLs in Storage but not in Firestore

# 2. Delete orphaned files
# - Via Firebase Console (manual)
# - Via cleanup script (automated)

# 3. Review why they existed
# - Check error logs around that time
# - Verify upload transaction is working
```

**Prevention:** The new rollback logic should prevent this

#### Symptom: Long Timeouts on Image Upload

**Likely Cause:** Network issue or very large file

**Recovery Steps:**
```
1. Check user's network connection
2. Verify file size < 5MB
3. Check Firebase Storage quota
4. Try again after reconnecting

Note: The app now detects offline and shows immediate error
```

---

## QUICK COMMANDS REFERENCE

```bash
# ───── DEPLOYMENT ─────
firebase deploy --only firestore:rules          # Deploy Firestore rules
firebase deploy --only storage                  # Deploy Storage rules
firebase deploy --only hosting                  # Deploy app to Firebase Hosting

# ───── MONITORING ─────
firebase functions:log                          # View function logs
firebase database:get /audit_logs               # View audit logs (Realtime DB only)

# ───── ROLLBACK ─────
git revert HEAD                                 # Revert last commit
firebase deploy --only firestore:rules          # Redeploy old version

# ───── TESTING ─────
npm run lint                                    # Check for TypeScript errors
npm run build                                   # Build the application
```

---

## KEY FILES FOR REFERENCE

| File | Purpose | Last Updated |
|------|---------|--------------|
| `firestore.rules` | Firestore security rules | Aug 9, 2026 |
| `storage.rules` | Storage security rules | Aug 9, 2026 |
| `src/context/ERPContext.tsx` | Stock transaction logic | Aug 9, 2026 |
| `src/components/PartDetail.tsx` | Image upload logic | Aug 9, 2026 |
| `src/App.tsx` | URL routing | Aug 9, 2026 |

---

## ESCALATION CONTACTS

| Role | Contact | When to Escalate |
|------|---------|-----------------|
| **Security Lead** | [Name] | Permission errors, rule changes |
| **Database Admin** | [Name] | Stock issues, data integrity |
| **DevOps** | [Name] | Deployment failures, rollbacks |
| **Product Owner** | [Name] | Feature-related issues |

---

## ROLLBACK DECISION TREE

```
Is production working?
├─ YES → Continue monitoring
└─ NO → Is it a permission error?
    ├─ YES → Likely rules issue → Rollback firestore:rules
    └─ NO → Is it a stock/data issue?
        ├─ YES → Likely code issue → Rollback hosting
        └─ NO → Is Storage broken?
            ├─ YES → Rollback storage:rules
            └─ NO → Manual investigation required
```

---

## SUCCESS METRICS

Track these metrics after deployment:

```
BASELINE (Before Deployment):
- Stock oversell incidents: [Count]
- Image upload failures: [Count]
- Permission denied errors: [Count]

POST-DEPLOYMENT TARGET:
- Stock oversell incidents: 0
- Image upload failures: < 1% (from network issues only)
- Permission denied errors: < 5 per day (from misconfigured roles)
```

---

## SIGN-OFF & APPROVAL

**Checklist Before Going Live:**

- [ ] Build passes without errors
- [ ] Firebase rules deployed
- [ ] All 5 smoke tests passing
- [ ] No console errors
- [ ] Database not showing permission errors
- [ ] At least one successful sale created
- [ ] At least one successful image upload
- [ ] Operations team trained
- [ ] Escalation contacts briefed
- [ ] Rollback procedure tested

**Approvals:**

- [ ] **Development Lead:** _______________  Date: _____
- [ ] **Security Lead:** _______________  Date: _____
- [ ] **Operations Lead:** _______________  Date: _____
- [ ] **Product Owner:** _______________  Date: _____

**Deployment Time:** __________________  
**Deployed By:** __________________  
**Verified By:** __________________  

---

## POST-DEPLOYMENT SIGN-OFF

After 24 hours of production monitoring:

**Status:** ✅ STABLE / ⚠️ ISSUES / ❌ ROLLBACK REQUIRED

**Issues Encountered:** [None / List any issues]

**Resolution:** [Describe any actions taken]

**Signed Off By:** _______________  
**Date/Time:** _______________  

---

**Questions?** Refer to PRODUCTION_DEPLOYMENT_PLAN.md or IMPLEMENTATION_VERIFICATION_REPORT.md

