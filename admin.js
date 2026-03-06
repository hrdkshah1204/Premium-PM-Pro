// admin.js
import { auth, db } from './db.js';
import { 
    collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- SUB 1: PROJECTS ---
export const saveNewProject = async () => {
    const name = document.getElementById('p-name').value;
    const date = document.getElementById('p-date').value;
    if(!name) return alert("Project name is required.");

    await addDoc(collection(db, "projects"), {
        name,
        endDate: date,
        status: 'active',
        createdBy: auth.currentUser.email, // Security Tag
        createdAt: new Date().toISOString()
    });
    document.getElementById('p-name').value = '';
    loadUserProjects();
};

export const loadUserProjects = async () => {
    const q = query(
        collection(db, "projects"), 
        where("createdBy", "==", auth.currentUser.email), // Privacy Filter
        orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const tbody = document.getElementById('project-table-body');
    tbody.innerHTML = '';
    snap.forEach(d => {
        const p = d.data();
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.endDate || 'N/A'}</td><td>${p.status}</td></tr>`;
    });
};

// --- SUB 3: TEAMS ---
export const saveNewTeam = async () => {
    const name = document.getElementById('team-name').value;
    if(!name) return alert("Team name required.");

    await addDoc(collection(db, "teams"), {
        name,
        createdBy: auth.currentUser.email,
        createdAt: new Date().toISOString()
    });
    document.getElementById('team-name').value = '';
    loadUserTeams();
};

export const loadUserTeams = async () => {
    const q = query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email));
    const snap = await getDocs(q);
    const tbody = document.getElementById('team-table-body');
    tbody.innerHTML = '';
    snap.forEach(d => {
        tbody.innerHTML += `<tr><td>${d.data().name}</td><td><button class="outline" onclick="navTo('sub4')">+ Member</button></td><td>Active</td></tr>`;
    });
};

// --- SUB 6: ANALYTICS ---
export const renderAnalytics = async () => {
    const userEmail = auth.currentUser.email;
    const [pSnap, tSnap, teamSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), where("createdBy", "==", userEmail))),
        getDocs(query(collection(db, "tasks"), where("createdBy", "==", userEmail))),
        getDocs(query(collection(db, "teams"), where("createdBy", "==", userEmail)))
    ]);

    // Render Team Breakdown Table
    const tbody = document.getElementById('analytics-team-body');
    tbody.innerHTML = '';
    teamSnap.forEach(teamDoc => {
        const tasks = tSnap.docs.filter(t => t.data().assignedTeamId === teamDoc.id);
        tbody.innerHTML += `<tr>
            <td>${teamDoc.data().name}</td>
            <td>${tasks.length}</td>
            <td>${tasks.filter(t => t.data().status === 'to-do').length}</td>
            <td>${tasks.filter(t => t.data().status === 'in-progress').length}</td>
            <td>${tasks.filter(t => t.data().status === 'completed').length}</td>
        </tr>`;
    });
};