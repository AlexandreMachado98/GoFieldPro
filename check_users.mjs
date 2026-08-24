import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function check() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    console.log("USERS FOUND:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (e) {
    console.error("ERROR:", e);
  }
  process.exit(0);
}
check();
