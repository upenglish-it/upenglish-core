import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Cấu hình Firebase - Lấy từ file .env hoặc hardcode trực tiếp vào đây
const firebaseConfig = {
  apiKey: "AIzaSyBuXAjB6jCOfzI7YAPkAQ8cVcWFT2-9qh8",
  authDomain: "vocabmaster-71b4a.firebaseapp.com",
  projectId: "vocabmaster-71b4a",
  storageBucket: "vocabmaster-71b4a.firebasestorage.app",
  messagingSenderId: "310596631914",
  appId: "1:310596631914:web:6a0806d53c820a5c98b913",
};

let app, auth, db, functions, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  functions = getFunctions(app);
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase initialization failed:', error.message);
}

const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');

export { auth, db, functions, storage, googleProvider, microsoftProvider };
export default app;
