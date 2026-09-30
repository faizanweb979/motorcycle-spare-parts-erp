# LOCALHOST SETUP GUIDE
## Image Upload اور Firestore کو کام کرنے کے لیے

**تاریخ:** اگست 9، 2026  
**مسئلہ:** localhost پر CORS اور Permission errors  
**حل:** Firebase Console میں سیٹنگ کریں

---

## 🔴 **مسائل:**

1. **CORS Error**: `localhost:3000` کو Storage میں authorize نہیں کیا
2. **Permission 403**: Firestore rules میں مسئلہ
3. **OAuth Domain**: Google Sign-in کے لیے localhost add نہیں کیا

---

## ✅ **حل - 3 Steps:**

### **Step 1: Firebase Console میں Storage authorize کریں**

```
1. https://console.firebase.google.com کھولیں
2. اپنا project select کریں: "gen-lang-client-0201542724"
3. اپنی browser میں localStorage دیکھیں:
   - F12 دبائیں → Application tab
   - localStorage میں دیکھیں
4. یا اپنے projectId پر جائیں
```

**یہ steps کریں:**

```
Firebase Console → Storage → Rules

اگلی ہے موجودہ content دیکھیں
```

**عام طور پر localhost کو CORS سے block کیا جاتا ہے۔**

---

### **Step 2: Firestore Rules کو Development Mode میں رکھیں (Testing کے لیے)**

Console میں یہ rules ہیں (ہم نے شامل کیے):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Development mode: authenticated users with verified email
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.token.email_verified == true;
    }
  }
}
```

**یہ قبول کریں اور publish کریں۔**

---

### **Step 3: Authentication - Authorized Domains**

```
Firebase Console → Authentication → Settings

"Authorized domains" tab میں:
  ✓ localhost (موجود ہونا چاہیے)
  ✓ 127.0.0.1 (موجود ہونا چاہیے)
  ✓ http://localhost:3000 (شامل کریں اگر نہیں ہے)
```

---

## 🔧 **اگر اب بھی کام نہیں کر رہا:**

### **1. Cache صاف کریں:**

```
F12 → Application → Cache Storage → سب کچھ delete کریں
F12 → Storage → localStorage → سب delete کریں
Page refresh کریں (Ctrl+Shift+R)
```

### **2. اپنا Email verified کریں:**

```
Login کریں → Console میں دیکھیں کہ:
  - auth.currentUser?.emailVerified = true ہونا چاہیے
```

اگر false ہے تو:
```
- Gmail جائیں
- Firebase سے verification email دوبارہ بھیجیں
- Email میں link دبائیں
- Refresh کریں
```

### **3. Browser Console دیکھیں (F12):**

ان میں سے کوئی error ہے تو بتائیں:

```
❌ "CORS policy"
❌ "permission-denied"
❌ "emailVerified"
❌ "Unauthorized"
```

---

## 📋 **Full Testing Steps:**

### **1. Login کریں**

```
1. http://localhost:3000 کھولیں
2. Sign in with Google دبائیں
3. اپنا account منتخب کریں
4. Email verify کریں (اگر prompt ہو)
```

### **2. Parts Master کھولیں**

```
1. Sidebar میں "Parts Master" دبائیں
2. کوئی part منتخب کریں
3. Part Detail page کھلے
```

### **3. Image Upload کریں**

```
1. "Upload Image" بٹن دبائیں
2. تصویر منتخب کریں (JPG, PNG, < 5MB)
3. Browser Console میں (F12) اگلے logs دیکھیں:
```

**اگر کامیاب ہو:**
```
✓ تصویر اپ لوڈ شروع ہو رہی ہے...
✓ تصویر Storage میں محفوظ ہو گئی۔
✓ Download URL ملی: https://firebasestorage...
✓ Firestore میں URL محفوظ کیا جا رہا ہے...
✓ Firestore میں کامیابی سے محفوظ ہو گیا۔
✓ تصویر کامیابی سے اپ لوڈ ہو گئی!
```

**اگر error ہو:**
```
❌ CORS error → Step 1 دوبارہ کریں
❌ Permission error → Step 2 دوبارہ کریں
❌ emailVerified false → Step 3 دوبارہ کریں
```

---

## 🛠️ **Firebase Emulator استعمال کریں (بہترین Option)**

Emulator میں CORS issues نہیں ہوتے۔ Install کریں:

```bash
# Firebase CLI install کریں
npm install -g firebase-tools

# Project directory میں جائیں
cd "d:\new project 10 - Copy\motorcycle-spare-parts-erp"

# Emulator شروع کریں
firebase emulators:start

# اب http://localhost:5000 کھولیں (emulator UI)
```

**Emulator کے فوائل:**
- ✅ No CORS issues
- ✅ No permission problems
- ✅ Instant testing
- ✅ Reset data easily

---

## 📝 **Console Logs یہ ہیں:**

جب app load ہو:

```javascript
🔧 Firebase Configuration Loaded:
  Project ID: gen-lang-client-0201542724
  Storage Bucket: gen-lang-client-0201542724.firebasestorage.app
  Auth Domain: gen-lang-client-0201542724.firebaseapp.com
  Current URL: http://localhost:3000

⚠️ LOCALHOST DEVELOPMENT NOTE:
If you see CORS errors:
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to Storage → Rules
4. Update rules to allow localhost
...
```

---

## 🎯 **خلاصہ:**

| Step | کیا | کہاں |
|------|-----|------|
| 1 | Storage CORS allow کریں | Firebase Console → Storage |
| 2 | Firestore rules development mode میں رکھیں | Firebase Console → Firestore |
| 3 | Authorized domains میں localhost add کریں | Firebase Console → Auth |
| 4 | Image upload test کریں | http://localhost:3000 |

---

## ✨ **اگر سب کچھ کام کر رہا ہے:**

```
✅ Image upload ہو رہا ہے
✅ Part detail میں image نظر آ رہی ہے
✅ Firestore میں data save ہو رہا ہے
✅ Console میں success logs نظر آ رہی ہیں

🎉 آپ تیار ہیں deployment کے لیے!
```

---

## 📞 **اگر مسائل ہیں:**

1. **Full error message Screenshot لیں** (F12 → Console)
2. **یہ بتائیں:**
   - کیا exact error ہے؟
   - کون سے step پر fail ہو رہا ہے؟
   - Firebase Console میں کیا نظر آ رہا ہے؟
3. **Email verify شدہ ہے؟**

---

**Happy Testing!** 🚀

