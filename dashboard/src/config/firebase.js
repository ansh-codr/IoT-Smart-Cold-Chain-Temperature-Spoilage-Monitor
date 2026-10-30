import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyFakeKeyForLocalDevSimulationOnly",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "coldchain-iq.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "coldchain-iq",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "coldchain-iq.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged };

