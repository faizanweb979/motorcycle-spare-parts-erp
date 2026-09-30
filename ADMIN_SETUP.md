# Firebase Admin Account Setup Guide

This document explains how to configure the production Admin account for the Motorcycle Spare Parts ERP using Firebase Custom Claims.

## Target Admin Account

- **Email:** `muslimbrothersadmin@gmail.com`
- **Role:** `admin`
- **Requirements:** Email verification required

## Overview of Changes

The application has been updated to use **Firebase Auth Custom Claims** for production-grade role-based access control instead of email-pattern simulation.

### What Changed:
1. **Firestore Security Rules** (`firestore.rules`): Now reads `request.auth.token.role` custom claim instead of email patterns
2. **Frontend Role Detection** (`Settings.tsx`): Now reads role from ID token custom claims via `getIdTokenResult()`
3. **Admin Script** (`scripts/set-admin-claims.ts`): Server-side script to set custom claims using Firebase Admin SDK

---

## MANUAL STEPS REQUIRED

### Step 1: Install Dependencies

The `firebase-admin` package has been added to `package.json`. Install it:

```bash
npm install
```

### Step 2: Download Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `gen-lang-client-0201542724`
3. Navigate to **Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file as `service-account-key.json` in the project root
   - **IMPORTANT:** Never commit this file to version control
   - Add `service-account-key.json` to `.gitignore`

### Step 3: Configure Environment Variables

Create a `.env` file in the project root (or update existing one) with:

```env
# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=gen-lang-client-0201542724
FIREBASE_CLIENT_EMAIL=<from service-account-key.json>
FIREBASE_PRIVATE_KEY=<from service-account-key.json>

# Admin email to grant custom claims
ADMIN_EMAIL=muslimbrothersadmin@gmail.com
```

**Alternative:** If you place `service-account-key.json` in the project root, the script will automatically read from it without needing individual environment variables.

### Step 4: Create the Admin User Account

1. Run the application: `npm run dev`
2. Sign up with email: `muslimbrothersadmin@gmail.com`
3. **IMPORTANT:** Verify the email address via the verification link sent to the email
4. Sign in to confirm the account is working

### Step 5: Set Custom Claims

Run the admin claims script:

```bash
npm run set-admin-claims
```

This will:
- Find the user by email `muslimbrothersadmin@gmail.com`
- Set the custom claim `role: "admin"`
- Verify the claim was set successfully

**Expected Output:**
```
🔐 Setting custom claims for admin user...
📧 Target email: muslimbrothersadmin@gmail.com
🎭 Role to assign: admin
✅ Found user: [USER_UID]
✅ Successfully set custom claim 'role: admin' for user muslimbrothersadmin@gmail.com
📋 User UID: [USER_UID]
🔍 Current custom claims: { role: 'admin' }

✨ Done! The user will need to sign out and sign in again for the new claims to take effect.
```

### Step 6: Deploy Updated Firestore Security Rules

The `firestore.rules` file has been updated to use custom claims. Deploy the new rules:

```bash
firebase deploy --only firestore:rules
```

Or via Firebase Console:
1. Go to **Firestore Database** > **Rules** tab
2. Copy the contents of `firestore.rules`
3. Paste into the console editor
4. Click **Publish**

### Step 7: Verify Setup

1. Sign out of the application
2. Sign in again with `muslimbrothersadmin@gmail.com`
3. Navigate to **Settings** page
4. Verify the role display shows "💼 Admin"
5. Test admin-only features (e.g., Settings modifications, data operations)

---

## Granting Additional Roles

To grant roles to other users, modify the `ADMIN_EMAIL` environment variable and run the script again:

```bash
ADMIN_EMAIL=another-user@example.com npm run set-admin-claims
```

To assign different roles, edit `scripts/set-admin-claims.ts` and change the `ROLE` constant:

```typescript
const ROLE = 'super_admin'; // or 'operator'
```

---

## Role Hierarchy

- **super_admin**: Full access including destructive operations (delete data, reset database)
- **admin**: Write access but no destructive operations (create/update records, view reports)
- **operator**: Read-only access (view data, no write operations)

---

## Troubleshooting

### Error: "User not found"
- The user must sign up in the application first before you can set custom claims
- Verify the email address is correct

### Error: "Firebase Admin credentials not found"
- Ensure `service-account-key.json` exists in project root OR
- Ensure `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set in `.env`

### Role not showing in UI
- Custom claims require the user to sign out and sign in again
- The ID token is only refreshed on sign-in
- Check browser console for errors in `Settings.tsx`

### Firestore rules denying access
- Ensure the new rules have been deployed
- Check Firebase Console > Firestore > Rules for the deployed version
- Verify the custom claim is actually set (use Firebase Console > Authentication > User > Custom Claims)

---

## Security Notes

1. **Never commit service account keys** to version control
2. **Never hardcode passwords** in the codebase
3. **Custom claims are server-side only** - clients cannot modify them
4. **Email verification is enforced** in both Firestore rules and frontend
5. **Role changes require sign-out/sign-in** to take effect

---

## Verification Checklist

- [ ] `firebase-admin` package installed
- [ ] Service account key downloaded and secured
- [ ] `.env` configured with Firebase Admin credentials
- [ ] Admin user account created and email verified
- [ ] Custom claims set via `npm run set-admin-claims`
- [ ]Firestore security rules deployed
- [ ] User signed out and signed in again
- [ ] Role displays correctly in Settings page
- [ ] Admin permissions verified (can access admin features)
- [ ] `service-account-key.json` added to `.gitignore`

---

## Need Help?

If you encounter issues:

1. Check Firebase Console > Authentication > Users to verify the user exists
2. Check Firebase Console > Authentication > Users > [User] > Custom Claims to verify claims
3. Check Firebase Console > Firestore > Rules to verify rules are deployed
4. Check browser console for frontend errors
5. Check terminal output for script errors
