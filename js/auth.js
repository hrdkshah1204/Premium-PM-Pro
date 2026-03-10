// js/auth.js

// 1. Import connections from your config file
import { auth, db, analytics } from './firebase-config.js';

// 2. Import specific Firebase functions needed just for Auth
import { logEvent, setUserProperties, setUserId } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({prompt: 'select_account'});

// --- GLOBAL GOOGLE SIGN-IN ---
window.signIn = () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Login Successful!", result.user);
        })
        .catch((error) => {
            console.error("Login Failed:", error.code, error.message);
            document.getElementById('auth-status').innerText = "Error: " + error.message;
        });
};
    
// --- UI THEME ---
window.setTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('propm-theme', mode);
};

// --- EMAIL/PASSWORD AUTHENTICATION LOGIC ---
let isRegistrationMode = false;
window.toggleAuthMode = () => {
    isRegistrationMode = !isRegistrationMode;
    document.getElementById('auth-title').innerText = isRegistrationMode ? "Join ProPM" : "ProPM";
    document.getElementById('btn-primary-auth').innerText = isRegistrationMode ? "Register Now" : "Sign In";
    document.getElementById('btn-primary-auth').setAttribute("onclick", isRegistrationMode ? "registerUser()" : "signInWithEmail()");
    document.getElementById('btn-toggle-auth').innerText = isRegistrationMode ? "Back to Login" : "Create Account";
};

window.signInWithEmail = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    if(!email || !pass) return alert("Please enter credentials.");
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
        document.getElementById('auth-status').innerText = "Access Denied: " + err.message;
    });
};

window.registerUser = () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    createUserWithEmailAndPassword(auth, email, pass).then(u => {
        sendEmailVerification(u.user);
        alert("Verification link sent! Please check your email inbox.");
    }).catch(err => alert(err.message));
};

window.forgotPassword = () => {
    const email = document.getElementById('login-email').value;
    if(!email) return alert("Enter email first.");
    sendPasswordResetEmail(auth, email).then(() => alert("Reset email sent!")).catch(err => alert(err.message));
};

window.signOutUser = () => signOut(auth);

// --- ONBOARDING LOGIC ---
window.completeOnboarding = async () => {
    await logEvent(analytics, 'onboarding_complete');
    setUserProperties(analytics, { user_cohort: 'onboarded_only' });
    await setDoc(doc(db, "users", auth.currentUser.email), { 
        name: document.getElementById('ob-name').value, 
        workspaceName: document.getElementById('ob-workspace-name').value,
        company: document.getElementById('ob-company').value, 
        teamSize: document.getElementById('ob-size').value,
        onboardingComplete: true, role: 'admin' 
    }, { merge: true });

    logEvent(analytics, 'org_created', { 
        company_name: document.getElementById('ob-company').value,
        team_size: document.getElementById('ob-size').value 
    });

    location.reload(); 
};

// --- AUTH STATE LISTENER (The Gatekeeper) ---
onAuthStateChanged(auth, async (user) => {
    const helpWidget = document.getElementById('help-widget');

    if (user) {
        if (!user.emailVerified) {
            document.getElementById('auth-status').innerText = "Please verify your email!";
            signOut(auth); return;
        }

        setUserId(analytics, user.uid); // GA4 Tracking

        const userSnap = await getDoc(doc(db, "users", user.email));
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('login-view').classList.add('hidden');
            
            // SHOW HELP BUTTON NOW THAT USER IS LOGGED IN
            if(helpWidget) helpWidget.classList.remove('hidden');
            
            if (data.role === 'admin' && data.onboardingComplete) {
                document.getElementById('admin-view').classList.remove('hidden');
                document.getElementById('display-org-name').innerText = data.company || "Workspace";
                document.querySelectorAll('.user-name').forEach(el => el.innerText = data.name);
                
                // Populate Settings
                document.getElementById('set-name').value = data.name || "";
                document.getElementById('set-email').value = user.email || ""; 
                document.getElementById('set-phone').value = data.phone || "";
                document.getElementById('set-company').value = data.company || "";
                document.getElementById('set-size').value = data.teamSize || "1 - 10";
                document.getElementById('set-address').value = data.companyAddress || "";
                
                // AUTO-WALKTHROUGH TRIGGER
                const hasSeenGuide = localStorage.getItem('propm_guide_done');
                if (!hasSeenGuide) {
                    setTimeout(() => {
                        if(window.toggleWalkthrough) {
                            window.toggleWalkthrough();
                            localStorage.setItem('propm_guide_done', 'true');
                        }
                    }, 2000); 
                }

                window.loadAdminNotifications();
                window.navTo('sub1');
            } else if (data.role === 'member') {
                document.getElementById('member-view').classList.remove('hidden');
                // Ensure initMemberDashboard is defined in member.js
                if(window.initMemberDashboard) window.initMemberDashboard(user.email, data);
            } else {
                document.getElementById('onboarding-view').classList.remove('hidden');
            }
        } else {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('onboarding-view').classList.remove('hidden');
        }
    } else {
        // HIDE EVERYTHING ON LOGOUT
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('admin-view').classList.add('hidden');
        document.getElementById('member-view').classList.add('hidden');
        document.getElementById('onboarding-view').classList.add('hidden');
        if(helpWidget) helpWidget.classList.add('hidden');
    }
});

// NOTE: window.navTo and window.navToMember have been removed from here 
// because they are safely managed inside admin.js and member.js respectively.
