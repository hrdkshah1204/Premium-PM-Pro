// auth.js
import { auth, db } from './db.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Toggle the UI text between Login and Register
export const toggleAuthUI = () => {
    const title = document.getElementById('auth-title');
    const primaryBtn = document.getElementById('btn-primary-auth');
    const toggleBtn = document.getElementById('btn-toggle-auth');
    
    const isLoggingIn = title.innerText === "ProPM";
    
    title.innerText = isLoggingIn ? "Join ProPM" : "ProPM";
    primaryBtn.innerText = isLoggingIn ? "Register Now" : "Sign In";
    toggleBtn.innerText = isLoggingIn ? "Back to Login" : "Create Account";
};

// Handle Registration
export const handleRegistration = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await sendEmailVerification(cred.user);
        alert("Account created! A verification link has been sent to your inbox. Please verify to log in.");
    } catch (error) {
        alert("Registration Error: " + error.message);
    }
};

// Handle Login
export const handleEmailSignIn = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        document.getElementById('auth-status').innerText = "Login Failed: Check credentials.";
    }
};

// Handle Google Login
export const handleGoogleLogin = () => signInWithPopup(auth, googleProvider).catch(e => alert(e.message));

// Handle Forgot Password
export const handlePasswordReset = () => {
    const email = document.getElementById('login-email').value;
    if(!email) return alert("Enter email address first.");
    sendPasswordResetEmail(auth, email).then(() => alert("Reset email sent!")).catch(e => alert(e.message));
};