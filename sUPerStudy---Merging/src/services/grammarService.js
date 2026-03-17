import { db } from '../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, query, where, orderBy, getCountFromServer } from 'firebase/firestore';
import { deleteQuestionImages, deleteContextImages } from './examService';
import { deleteContextAudio } from './contextAudioService';

// Collection names: grammar_exercises, grammar_questions, grammar_assignments, grammar_submissions

// Fetch question counts for multiple exercises
export async function getGrammarQuestionCounts(exerciseIds) {
    const counts = {};
    await Promise.all(exerciseIds.map(async (exId) => {
        try {
            const q = query(collection(db, 'grammar_questions'), where('exerciseId', '==', exId));
            const snapshot = await getCountFromServer(q);
            counts[exId] = snapshot.data().count;
        } catch (e) {
            console.error(`Error counting questions for exercise ${exId}:`, e);
            counts[exId] = 0;
        }
    }));
    return counts;
}

/**
 * Recalculate and cache question count into the grammar exercise document.
 */
export async function recalcGrammarQuestionCache(exerciseId) {
    try {
        const q = query(collection(db, 'grammar_questions'), where('exerciseId', '==', exerciseId));
        const snapshot = await getCountFromServer(q);
        await updateDoc(doc(db, 'grammar_exercises', exerciseId), {
            cachedQuestionCount: snapshot.data().count
        });
    } catch (e) {
        console.error(`Error recalculating grammar question cache for ${exerciseId}:`, e);
    }
}

// --- EXERCISES ---

export async function getGrammarExercises(teacherId = null) {
    let q = collection(db, 'grammar_exercises');
    if (teacherId) {
        q = query(q, where('teacherId', '==', teacherId));
    } else {
        q = query(q);
    }
    const snapshot = await getDocs(q);
    const exercises = [];
    snapshot.forEach(docSnap => exercises.push({ id: docSnap.id, ...docSnap.data() }));
    // Client-side sort to avoid requiring a composite index
    return exercises.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

import { documentId } from 'firebase/firestore';

export async function getSharedAndPublicGrammarExercises(grammarAccessIds = []) {
    const exercises = [];
    const addedIds = new Set();

    try {
        // 1. Get all public grammar exercises
        const publicQ = query(collection(db, 'grammar_exercises'), where('isPublic', '==', true));
        const publicSnap = await getDocs(publicQ);
        publicSnap.forEach(docSnap => {
            exercises.push({ id: docSnap.id, ...docSnap.data() });
            addedIds.add(docSnap.id);
        });

        // 2. Get explicitly shared exercises
        if (grammarAccessIds.length > 0) {
            // Firestore 'in' query supports up to 10 elements
            for (let i = 0; i < grammarAccessIds.length; i += 10) {
                const batchIds = grammarAccessIds.slice(i, i + 10);
                const sharedQ = query(collection(db, 'grammar_exercises'), where(documentId(), 'in', batchIds));
                const sharedSnap = await getDocs(sharedQ);
                sharedSnap.forEach(docSnap => {
                    if (!addedIds.has(docSnap.id)) {
                        exercises.push({ id: docSnap.id, ...docSnap.data() });
                        addedIds.add(docSnap.id);
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error fetching shared grammar exercises:", error);
    }

    return exercises.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function getGrammarExercise(id) {
    const docSnap = await getDoc(doc(db, 'grammar_exercises', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function saveGrammarExercise(exerciseData) {
    const { id, ...data } = exerciseData;
    let exerciseRef;
    if (id) {
        exerciseRef = doc(db, 'grammar_exercises', id);
        await updateDoc(exerciseRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        exerciseRef = doc(collection(db, 'grammar_exercises'));
        await setDoc(exerciseRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return exerciseRef.id;
    }
}

export async function deleteGrammarExercise(id) {
    // Delete questions first
    const questions = await getGrammarQuestions(id);
    const batch = writeBatch(db);

    // Delete option images, context audio, and context images for these questions
    await Promise.allSettled([
        ...questions.map(q => deleteQuestionImages(q)),
        ...questions.filter(q => q.contextAudioUrl).map(q => deleteContextAudio(q.contextAudioUrl)),
        ...questions.filter(q => q.context).map(q => deleteContextImages(q.context))
    ]);

    questions.forEach(q => batch.delete(doc(db, 'grammar_questions', q.id)));

    // Delete related assignments
    const assignmentsQ = query(collection(db, 'assignments'), where('topicId', '==', id));
    const asgnsSnap = await getDocs(assignmentsQ);
    asgnsSnap.forEach(asgnDoc => {
        batch.delete(asgnDoc.ref);
    });

    batch.delete(doc(db, 'grammar_exercises', id));
    await batch.commit();
}

// --- QUESTIONS ---

export async function getGrammarQuestions(exerciseId) {
    const q = query(collection(db, 'grammar_questions'), where('exerciseId', '==', exerciseId));
    const snapshot = await getDocs(q);
    const questions = [];
    snapshot.forEach(docSnap => questions.push({ id: docSnap.id, ...docSnap.data() }));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getGrammarQuestionsByIds(questionIds = []) {
    if (!questionIds || questionIds.length === 0) return [];

    const questionsMap = {};
    const batches = [];
    // Firestore "in" query allows max 10 items
    for (let i = 0; i < questionIds.length; i += 10) {
        batches.push(questionIds.slice(i, i + 10));
    }

    try {
        await Promise.all(batches.map(async (batchIds) => {
            const q = query(collection(db, 'grammar_questions'), where(documentId(), 'in', batchIds));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                questionsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
            });
        }));
    } catch (err) {
        console.error("Error fetching grammar questions by IDs:", err);
    }

    // Return in the original order requested (or at least provide the array)
    // We filter just in case some IDs were deleted
    return questionIds.map(id => questionsMap[id]).filter(Boolean);
}

export async function saveGrammarQuestion(questionData) {
    const { id, ...data } = questionData;
    let questionRef;
    if (id) {
        questionRef = doc(db, 'grammar_questions', id);
        await updateDoc(questionRef, { ...data, updatedAt: serverTimestamp() });
    } else {
        // Find current max order for this exercise
        const questionsSnapshot = await getDocs(query(collection(db, 'grammar_questions'), where('exerciseId', '==', data.exerciseId)));
        const numQuestions = questionsSnapshot.size;

        questionRef = doc(collection(db, 'grammar_questions'));
        await setDoc(questionRef, { ...data, order: numQuestions, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }

    // Fire-and-forget: auto-classify errorCategory in background
    import('./aiGrammarService').then(({ classifyErrorCategory }) => {
        classifyErrorCategory({
            targetSkill: data.targetSkill,
            type: data.type,
            purpose: data.purpose,
            questionText: data.variations?.[0]?.text,
            options: data.variations?.[0]?.options
        }).then(category => {
            updateDoc(questionRef, { errorCategory: category }).catch(() => {});
        }).catch(() => {});
    }).catch(() => {});

    // Fire-and-forget: recalc grammar question cache
    recalcGrammarQuestionCache(data.exerciseId).catch(() => {});

    return id || questionRef.id;
}

export async function deleteGrammarQuestion(id) {
    const docRef = doc(db, 'grammar_questions', id);
    const snap = await getDoc(docRef);
    let exerciseId = null;
    if (snap.exists()) {
        const data = snap.data();
        exerciseId = data.exerciseId;
        await deleteQuestionImages(data);
        if (data.contextAudioUrl) {
            await deleteContextAudio(data.contextAudioUrl);
        }
        if (data.context) {
            await deleteContextImages(data.context);
        }
    }
    await deleteDoc(docRef);

    // Fire-and-forget: recalc grammar question cache
    if (exerciseId) recalcGrammarQuestionCache(exerciseId).catch(() => {});
}

// --- ASSIGNMENTS ---

export async function getGrammarAssignmentsForGroup(groupId) {
    const q = query(collection(db, 'grammar_assignments'), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Client-side sort to avoid requiring a composite index
    return assignments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
}

export async function saveGrammarAssignment(assignmentData) {
    const { id, ...data } = assignmentData;
    let assignmentRef;
    if (id) {
        assignmentRef = doc(db, 'grammar_assignments', id);
        await updateDoc(assignmentRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        assignmentRef = doc(collection(db, 'grammar_assignments'));
        await setDoc(assignmentRef, { ...data, createdAt: serverTimestamp() });
        return assignmentRef.id;
    }
}

// --- SUBMISSIONS ---

export async function getGrammarSubmission(assignmentId, studentId) {
    const q = query(collection(db, 'grammar_submissions'),
        where('assignmentId', '==', assignmentId),
        where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
}

export async function getGrammarSubmissionsForAssignment(assignmentId) {
    const q = query(collection(db, 'grammar_submissions'), where('assignmentId', '==', assignmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveGrammarSubmission(submissionData) {
    const { id, ...data } = submissionData;
    let submissionRef;
    if (id) {
        submissionRef = doc(db, 'grammar_submissions', id);
        await updateDoc(submissionRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        submissionRef = doc(collection(db, 'grammar_submissions'));
        await setDoc(submissionRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return submissionRef.id;
    }
}

// ==========================================
// TEACHER GRAMMAR FOLDERS
// ==========================================

export async function getTeacherGrammarFolders(teacherId) {
    const q = query(collection(db, 'teacher_grammar_folders'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    const folders = [];
    snapshot.forEach(docSnap => folders.push({ id: docSnap.id, ...docSnap.data() }));
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function getAllTeacherGrammarFolders() {
    const snapshot = await getDocs(collection(db, 'teacher_grammar_folders'));
    const folders = [];
    snapshot.forEach(docSnap => folders.push({ id: docSnap.id, ...docSnap.data() }));
    return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveTeacherGrammarFolder(teacherId, folderData) {
    const { id, ...data } = folderData;
    if (id) {
        const folderRef = doc(db, 'teacher_grammar_folders', id);
        await updateDoc(folderRef, { ...data, updatedAt: serverTimestamp() });
        return id;
    } else {
        const folderRef = doc(collection(db, 'teacher_grammar_folders'));
        await setDoc(folderRef, { ...data, teacherId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return folderRef.id;
    }
}

export async function deleteTeacherGrammarFolder(folderId) {
    await deleteDoc(doc(db, 'teacher_grammar_folders', folderId));
}
