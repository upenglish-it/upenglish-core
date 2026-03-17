import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "dummy",
    authDomain: "dummy",
    projectId: "supervocab-f2e1a", 
    storageBucket: "dummy",
    messagingSenderId: "dummy",
    appId: "dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTotal() {
    const topicsSnap = await getDocs(collection(db, 'topics'));
    console.log("Topics count:", topicsSnap.size);
    topicsSnap.forEach(t => {
        if (t.data().title?.includes('Business')) {
            console.log(t.id, t.data().title);
            getDocs(collection(db, `topics/${t.id}/words`)).then(ws => {
                console.log(`Words for ${t.id}:`, ws.size);
            });
        }
    });
}
checkTotal();
