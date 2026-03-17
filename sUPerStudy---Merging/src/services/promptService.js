import { db } from '../config/firebase';
import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp
} from 'firebase/firestore';

const COLLECTION = 'teacher_prompts';

/**
 * Get ALL prompts (admin use). Returns every prompt across all teachers.
 * @returns {Promise<Array>}
 */
export async function getAllPrompts() {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all prompts created by a specific teacher.
 * @param {string} uid - Teacher's user ID
 * @returns {Promise<Array>} Array of prompt objects
 */
export async function getTeacherPrompts(uid) {
    const q = query(
        collection(db, COLLECTION),
        where('createdBy', '==', uid),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Create a new prompt.
 * @param {{ title: string, content: string, skill: 'writing'|'speaking', createdBy: string }} data
 * @returns {Promise<string>} The new document ID
 */
export async function createPrompt({ title, content, skill, createdBy }) {
    const docRef = await addDoc(collection(db, COLLECTION), {
        title: title.trim(),
        content: content.trim(),
        skill, // 'writing' or 'speaking'
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}

/**
 * Update an existing prompt.
 * @param {string} id - Document ID
 * @param {{ title?: string, content?: string, skill?: string }} data
 */
export async function updatePrompt(id, data) {
    const ref = doc(db, COLLECTION, id);
    const update = { ...data, updatedAt: serverTimestamp() };
    if (update.title) update.title = update.title.trim();
    if (update.content) update.content = update.content.trim();
    await updateDoc(ref, update);
}

/**
 * Delete a prompt.
 * @param {string} id - Document ID
 */
export async function deletePrompt(id) {
    await deleteDoc(doc(db, COLLECTION, id));
}
