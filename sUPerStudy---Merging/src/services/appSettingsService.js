import { db } from '../config/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const APP_SETTINGS_PATH = 'settings/app';

// Fetch the current app settings
export async function getAppSettings() {
    const docRef = doc(db, APP_SETTINGS_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data();
    }
    return { devBypassEnabled: false };
}

// Update app settings
export async function updateAppSettings(newSettings) {
    const docRef = doc(db, APP_SETTINGS_PATH);
    await setDoc(docRef, newSettings, { merge: true });
}

// Subscribe to app settings (real-time listener)
export function subscribeToAppSettings(callback) {
    const docRef = doc(db, APP_SETTINGS_PATH);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            callback({ devBypassEnabled: false });
        }
    });
}
