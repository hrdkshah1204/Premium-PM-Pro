// js/auth.js

// 1. Import connections from your config file
import { auth, db, analytics } from './firebase-config.js';

// 2. Import specific Firebase functions needed just for Auth
import { logEvent, setUserProperties, setUserId } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({prompt: 'select_account'});
window.signIn = () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Login Successful!", result.user);
        })
        .catch((error) => {
            console.error("Login Failed:", error.code, error.message);
            // If you still see 'auth/unauthorized-domain', Step 1 didn't save yet!
            document.getElementById('auth-status').innerText = "Error: " + error.message;
        });
};
	
// --- UI THEME ---
window.setTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('propm-theme', mode);
};

// --- AUTHENTICATION LOGIC ---
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

window.signIn = () => signInWithPopup(auth, provider);
window.signOutUser = () => signOut(auth);

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
// js/auth.js

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // ... (existing email verification check) ...

        const userSnap = await getDoc(doc(db, "users", user.email));
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            document.getElementById('login-view').classList.add('hidden');
            
            if (data.role === 'admin' && data.onboardingComplete) {
                document.getElementById('admin-view').classList.remove('hidden');
                document.getElementById('display-org-name').innerText = data.company || "Workspace";
                document.querySelectorAll('.user-name').forEach(el => el.innerText = data.name);
                
                // --- AUTO-WALKTHROUGH TRIGGER ---
                const hasSeenGuide = localStorage.getItem('propm-walkthrough-seen');
                if (!hasSeenGuide) {
                    setTimeout(() => {
                        window.toggleWalkthrough(); // Start the guide automatically
                        localStorage.setItem('propm-walkthrough-seen', 'true');
                    }, 1500); // Small delay so the dashboard loads first
                }

                window.loadAdminNotifications();
                window.navTo('sub1');
            } else if (data.role === 'member') {
                window.initMemberDashboard(user.email, data);

                // --- MEMBER AUTO-WALKTHROUGH ---
                const hasSeenMemberGuide = localStorage.getItem('propm-member-guide-seen');
                if (!hasSeenMemberGuide) {
                    setTimeout(() => {
                        window.toggleWalkthrough();
                        localStorage.setItem('propm-member-guide-seen', 'true');
                    }, 1500);
                }
            } else {
                document.getElementById('onboarding-view').classList.remove('hidden');
            }
        } else {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('onboarding-view').classList.remove('hidden');
        }
    } else {
        // ... (existing logout UI logic) ...
    }
});

// --- NAVIGATION LOGIC ---
window.navTo = (id) => {
    document.querySelectorAll('.sub-page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('#admin-view .sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    const sideBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.getAttribute('onclick')?.includes(id));
    if(sideBtn) sideBtn.classList.add('active');
    
    // Call load functions based on page
    if(id === 'sub1') window.loadProjectsTable();
    if(id === 'sub2') { window.loadProjectDropdown(); window.loadTasksTable(); }
    if(id === 'sub3') window.loadTeamsTable();
    if(id === 'sub4') { window.loadTeamDropdownForMembers(); window.loadMembersTable(); }
    if(id === 'sub5') { window.loadAssignProjectDropdown(); window.fetchTeamsAndMembers(); }
    if(id === 'sub6') { window.runAnalytics(); logEvent(analytics, 'view_analytics_dashboard'); }
};

window.navToMember = (id) => {
    document.querySelectorAll('.m-page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
};
