import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (parent of scripts directory)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug: Log environment variables
console.log('🔍 Debug - Environment Variables:');
console.log('  FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET');
console.log('  FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET');
console.log('  FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'SET (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'NOT SET');
console.log('  ADMIN_EMAIL:', process.env.ADMIN_EMAIL || 'muslimbrothersadmin@gmail.com');
console.log('  ADMIN_ROLE:', process.env.ADMIN_ROLE || 'admin');

/**
 * Set Custom Claims for Admin User
 * 
 * This script sets the 'role' custom claim for a specific user email.
 * Run this script after the user has signed up and verified their email.
 * 
 * Usage: npx tsx scripts/set-admin-claims.ts
 * 
 * Environment Variables Required:
 * - FIREBASE_PROJECT_ID: Your Firebase project ID
 * - FIREBASE_CLIENT_EMAIL: Service account client email
 * - FIREBASE_PRIVATE_KEY: Service account private key
 * - ADMIN_EMAIL: The email address to grant admin role
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'muslimbrothersadmin@gmail.com';
const ROLE = process.env.ADMIN_ROLE || 'admin'; // Can be 'admin' or 'super_admin'

async function setAdminClaims() {
  try {
    console.log('🔐 Setting custom claims for admin user...');
    console.log(`📧 Target email: ${ADMIN_EMAIL}`);
    console.log(`🎭 Role to assign: ${ROLE}`);

    // Initialize Firebase Admin SDK
    // You need to download a service account key from Firebase Console
    // Project Settings > Service Accounts > Generate New Private Key
    // Save it as service-account-key.json in the project root
    // Or set environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
    
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0201542724',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error(
        'Firebase Admin credentials not found. Please set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables, ' +
        'or place service-account-key.json in the project root.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const auth = admin.auth();

    // Get user by email
    const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`✅ Found user: ${userRecord.uid}`);

    // Check if email is verified
    if (!userRecord.emailVerified) {
      console.warn('⚠️  Warning: User email is not verified. Please verify the email first.');
    }

    // Set custom claims
    const claims = {
      role: ROLE,
    };

    await auth.setCustomUserClaims(userRecord.uid, claims);
    console.log(`✅ Successfully set custom claim 'role: ${ROLE}' for user ${ADMIN_EMAIL}`);
    console.log(`📋 User UID: ${userRecord.uid}`);

    // Verify the claims were set
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log(`🔍 Current custom claims:`, updatedUser.customClaims);

    console.log('\n✨ Done! The user will need to sign out and sign in again for the new claims to take effect.');
    console.log('📝 Note: Custom claims are included in the ID token, which is refreshed on sign-in.');

  } catch (error: any) {
    console.error('❌ Error setting custom claims:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\n💡 User with email '${ADMIN_EMAIL}' not found.`);
      console.error('   Please ensure the user has signed up in the application first.');
    }
    
    process.exit(1);
  }
}

// Run the script
setAdminClaims().then(() => {
  process.exit(0);
});
