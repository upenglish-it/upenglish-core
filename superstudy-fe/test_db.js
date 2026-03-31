import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "test",
  authDomain: "test",
  projectId: "vocabmaster-71b4a",
  storageBucket: "test",
  messagingSenderId: "test",
  appId: "test"
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
    snap.forEach(d => console.log(d.data()));
  }
}
test().then(() => process.exit(0)).catch(e => {console.error(e); process.exit(1)});
