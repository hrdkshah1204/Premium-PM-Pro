// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3xwQj1TXXBhE1UyH4LJaKV3a-qU5sU64",
  authDomain: "pmpro-4507b.firebaseapp.com",
  projectId: "pmpro-4507b",
  storageBucket: "pmpro-4507b.firebasestorage.app",
  messagingSenderId: "508717628741",
  appId: "1:508717628741:web:484a4d8efdca8fa55c122c",
  measurementId: "G-VCNZMQ71LF"
};


// Initialize Primary App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// Initialize Secondary App (Used for Admin creating Members safely)
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");

export const secondaryAuth = getAuth(secondaryApp);
