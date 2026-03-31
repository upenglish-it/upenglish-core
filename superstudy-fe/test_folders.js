import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "mock-key",
  authDomain: "mock.firebaseapp.com",
  projectId: "supervocab-up",
  storageBucket: "mock.appspot.com",
  messagingSenderId: "mock",
  appId: "mock"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const q = collection(db, "topic_folders");
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(data, null, 2));
}
test().catch(console.error);
