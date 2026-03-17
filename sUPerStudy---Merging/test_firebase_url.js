import { initializeApp } from "firebase/app";
import { getStorage, ref } from "firebase/storage";
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

const url = "https://firebasestorage.googleapis.com/v0/b/vocabmaster-71b4a.appspot.com/o/context_audio%2Fgrammar%2FKh0Hyy5slQHr4FAbY36v%2F1772827921445_clpfpx.wav?alt=media&token=123";

try {
    const fileRef = ref(storage, url);
    console.log("Full Path:", fileRef.fullPath);
    console.log("Name:", fileRef.name);
} catch (e) {
    console.error("Error:", e);
}
