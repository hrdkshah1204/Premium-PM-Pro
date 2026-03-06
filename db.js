import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCo_tMyCAhdUAMp_Mx2popJp2nqurO7SlY",
    authDomain: "pm-pro-80c67.firebaseapp.com",
    projectId: "pm-pro-80c67",
    storageBucket: "pm-pro-80c67.firebasestorage.app",
    messagingSenderId: "553036723851",
    appId: "1:553036723851:web:3167a4def993500c39468e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);