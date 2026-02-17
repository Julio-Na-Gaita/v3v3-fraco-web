import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";


// ✅ Config do seu Firebase (V3v3FracoFC)
const firebaseConfig = {
  apiKey: "AIzaSyCBEIiULEmJ9wyDQLHnrA0vy-5N-TkPiGA",
  authDomain: "v3v3fracofc.firebaseapp.com",
  projectId: "v3v3fracofc",
  storageBucket: "v3v3fracofc.firebasestorage.app",
  messagingSenderId: "609109900226",
  appId: "1:609109900226:web:61e049b86ac2b92ba0f45b",
  measurementId: "G-CFRZEPDT8G"
};

// ✅ evita inicializar 2x no Vite (hot reload)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

