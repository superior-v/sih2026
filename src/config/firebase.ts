import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwNiWmTRqjzjMTI6O2ZKe4omhBCdTwbPw",
  authDomain: "devsparks-4018e.firebaseapp.com",
  projectId: "devsparks-4018e",
  storageBucket: "devsparks-4018e.firebasestorage.app",
  messagingSenderId: "869131906621",
  appId: "1:869131906621:web:192f99a89317224f88c454",
  measurementId: "G-0X98J2EL45"
};

const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;