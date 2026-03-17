require('firebase/database');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
    projectId: "vocabmaster-71b4a"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', 'ngheuac@gmail.com'));
    const snap = await getDocs(q);
    if (snap.empty) {
        console.log("No user found");
    } else {
        snap.forEach(d => console.log('USER DOC:', d.id, d.data()));
    }
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
