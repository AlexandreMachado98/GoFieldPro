import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import config from './firebase-applet-config.json';
const app = initializeApp(config);
const auth = getAuth(app);
async function test() {
  console.log("Calling signOut...");
  try {
    await signOut(auth);
    console.log("SignOut resolved.");
  } catch (e) {
    console.error("SignOut rejected:", e);
  }
}
test();
