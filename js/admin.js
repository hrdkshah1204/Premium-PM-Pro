// js/admin.js

import { auth, db, analytics, secondaryAuth } from './firebase-config.js';
import { logEvent, setUserProperties } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 0. NAVIGATION (MISSING BEFORE) ---
window.navTo = (id) => {
    // Hide all sub-pages
    document.querySelectorAll('.sub-page').forEach(p => p.classList.add('hidden'));
    // Show selected sub-page
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    // Update Sidebar Button Active State
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(btn => btn.getAttribute('onclick').includes(id));
    if (activeBtn) activeBtn.classList.add('active');

    // Load dynamic data based on page
    if (id === 'sub1') window.loadProjectsTable();
    if (id === 'sub2') window.loadProjectDropdown();
    if (id === 'sub3') window.loadTeamsTable();
    if (id === 'sub4') { window.loadTeamDropdownForMembers(); window.loadMembersTable(); }
    if (id === 'sub5') { window.fetchTeamsAndMembers(); window.loadAssignProjectDropdown(); }
    if (id === 'sub6') window.runAnalytics();
    if (id === 'sub8') window.markAllAdminNotificationsRead();
};

// --- 1. PROJECT MANAGEMENT ---
window.saveProject = async () => {
    const user = auth.currentUser;
    const name = document.getElementById('p-name').value.trim();
    const date = document.getElementById('p-date').value;
    const desc = document.getElementById('p-desc').value.trim();
    const editId = document.getElementById('edit-project-id').value;

    if (!name || !date || !desc) return alert("All fields are required!");

    try {
        if (!editId) {
            await addDoc(collection(db, "projects"), { name, endDate: date, description: desc, createdBy: user.email, status: 'active', createdAt: new Date().toISOString() });
        } else {
            await updateDoc(doc(db, "projects", editId), { name, endDate: date, description: desc });
        }
        window.cancelEdit(); 
        window.loadProjectsTable();
    } catch (e) { alert("Project save failed."); }
};

window.openTaskEntry = (pid) => {
    window.navTo('sub2');
    setTimeout(() => { document.getElementById('t-project-id').value = pid; }, 500);
};

window.loadProjectsTable = async () => {
    const q = query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email));
    const snap = await getDocs(q);
    const tbody = document.getElementById('project-table-body'); 
    tbody.innerHTML = '';
    snap.forEach(d => {
        const p = d.data();
        tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.endDate}</td><td>${p.description}</td><td class="action-btns"><button class="outline" onclick="openTaskEntry('${d.id}')">+ Tasks</button><button onclick="editProject('${d.id}')">Edit</button><button class="danger" onclick="deleteProject('${d.id}')">Del</button></td></tr>`;
    });
};

window.editProject = async (id) => {
    const d = await getDoc(doc(db, "projects", id));
    const p = d.data();
    document.getElementById('p-name').value = p.name; document.getElementById('p-date').value = p.endDate; 
    document.getElementById('p-desc').value = p.description; document.getElementById('edit-project-id').value = id;
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
};
window.cancelEdit = () => { 
    document.getElementById('edit-project-id').value = ''; 
    const btn = document.getElementById('btn-cancel-edit');
    if(btn) btn.classList.add('hidden'); 
};
window.deleteProject = async (id) => { if(confirm("Delete Project?")) { await deleteDoc(doc(db,"projects",id)); window.loadProjectsTable(); } };

// --- 2. TASK CREATION ---
window.loadProjectDropdown = async () => {
    const snap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('t-project-id'); dd.innerHTML = '<option value="">Select Project</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
};

window.saveTask = async () => {
    const pid = document.getElementById('t-project-id').value;
    const tdesc = document.getElementById('t-desc').value.trim();
    const tdetails = document.getElementById('t-details').value.trim();
    if(!pid || !tdesc) return alert("Select Project and Name.");
    await addDoc(collection(db, "tasks"), { projectId: pid, description: tdesc, taskDetails: tdetails, status: "To Do", adminEmail: auth.currentUser.email });
    document.getElementById('t-desc').value = ''; document.getElementById('t-details').value = ''; 
    window.loadTasksTable();
};

window.loadTasksTable = async () => { 
    const [pSnap, tSnap] = await Promise.all([getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email))), getDocs(collection(db, "tasks"))]);
    const tbody = document.getElementById('tasks-table-body'); tbody.innerHTML = '';
    pSnap.forEach(d => {
        const tasks = tSnap.docs.filter(t => t.data().projectId === d.id);
        tbody.innerHTML += `<tr style="background: rgba(37, 99, 235, 0.05);"><td><button onclick="toggleTaskRow('${d.id}', event)">▶</button></td><td>${d.data().name}</td><td>${tasks.length} / 10</td></tr>
        <tr id="details-${d.id}" style="display: none;"> <td colspan="3"><table style="width:100%">${tasks.map(t => `<tr><td>${t.data().description}</td><td><button class="danger" onclick="deleteTask('${t.id}')">X</button></td></tr>`).join('')}</table></td></tr>`;
    });
};

window.toggleTaskRow = (id, e) => { 
    const row = document.getElementById(`details-${id}`); 
    row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
};
window.deleteTask = async (id) => { await deleteDoc(doc(db,"tasks",id)); window.loadTasksTable(); };

// --- 3. TEAM & MEMBER MANAGEMENT ---
window.saveTeam = async () => {
    const tName = document.getElementById('team-name').value.trim();
    if (!tName) return alert("Enter Team Name.");
    await addDoc(collection(db, "teams"), { name: tName, createdBy: auth.currentUser.email });
    document.getElementById('team-name').value = ''; window.loadTeamsTable();
};

window.loadTeamsTable = async () => {
    const snap = await getDocs(query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email)));
    const tbody = document.getElementById('team-table-body'); tbody.innerHTML = '';
    snap.forEach(d => {
        tbody.innerHTML += `<tr><td>${d.data().name}</td><td>-</td><td><button onclick="navTo('sub4')">+ Members</button></td><td>Edit</td><td><button class="danger" onclick="deleteTeam('${d.id}')">Del</button></td></tr>`;
    });
};
window.deleteTeam = async (id) => { if(confirm("Delete?")) { await deleteDoc(doc(db, "teams", id)); window.loadTeamsTable(); } };

window.loadTeamDropdownForMembers = async () => {
    const snap = await getDocs(query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('m-team-id'); dd.innerHTML = '<option value="">Select Team</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
};

window.saveMember = async () => {
    const adminEmail = auth.currentUser.email; 
    const email = document.getElementById('m-email').value.toLowerCase().trim();
    const tid = document.getElementById('m-team-id').value; 
    const name = document.getElementById('m-name').value.trim();
    const phone = document.getElementById('m-phone').value.trim();
    
    // Safety check for dropdown selection
    const teamDropdown = document.getElementById('m-team-id');
    const tname = teamDropdown.selectedIndex >= 0 ? teamDropdown.options[teamDropdown.selectedIndex].text : "No Team";

    if (!email || !tid || !name) return alert("Missing fields.");

    try {
        const password = Math.random().toString(36).slice(-8);
        const newCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await sendEmailVerification(newCred.user);
        await signOut(secondaryAuth);
        await setDoc(doc(db, "users", email), { name, email, phone, teamId: tid, teamName: tname, role: 'member', adminEmail, company: document.getElementById('display-org-name').innerText });
        alert(`Member Created! Password: ${password}`);
        window.cancelMemberEdit(); window.loadMembersTable();
    } catch (error) { alert("Error: " + error.message); }
};

window.cancelMemberEdit = () => {
    document.getElementById('m-name').value = ''; 
    document.getElementById('m-email').value = '';
    const btn = document.getElementById('btn-cancel-member');
    if(btn) btn.classList.add('hidden'); 
};
window.loadMembersTable = async () => {
    const snap = await getDocs(query(collection(db, "users"), where("adminEmail", "==", auth.currentUser.email)));
    const tbody = document.getElementById('member-table-body'); tbody.innerHTML = '';
    snap.forEach(d => { tbody.innerHTML += `<tr><td>${d.data().name}</td><td>${d.data().teamName}</td><td>${d.id}</td><td><button class="danger" onclick="deleteMember('${d.id}')">Del</button></td></tr>`; });
};

// --- 4. TASK ASSIGNMENT & STATUS (MISSING BEFORE) ---
window.manualStatusUpdate = async (taskId, newStatus) => {
    try {
        await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
        alert("Status updated to " + newStatus);
        window.loadAssignmentTable();
    } catch (e) { console.error(e); }
};

window.loadAssignProjectDropdown = async () => {
    const snap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('assign-project-select'); dd.innerHTML = '<option value="">-- Select Project --</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
};

window.fetchTeamsAndMembers = async () => {
    const [tSnap, mSnap] = await Promise.all([ 
        getDocs(query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email))), 
        getDocs(query(collection(db, "users"), where("role", "==", "member"), where("adminEmail", "==", auth.currentUser.email))) 
    ]);
    window.workspaceTeams = tSnap.docs.map(d => ({id: d.id, ...d.data()})); 
    window.workspaceMembers = mSnap.docs.map(d => ({id: d.id, email: d.id, ...d.data()}));
};

window.loadAssignmentTable = async () => {
    const pid = document.getElementById('assign-project-select').value;
    const tb = document.getElementById('assign-table-body'); 
    const sb = document.getElementById('allocation-summary-body');
    if(!pid) return;
    tb.innerHTML = ''; sb.innerHTML = '';
    const tSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", pid)));
    tSnap.forEach(d => {
        const t = d.data();
        tb.innerHTML += `<tr><td>${t.description}</td><td><select id="t-${d.id}" onchange="updateRowMembers('${d.id}')"><option value="">-- Team --</option>${window.workspaceTeams.map(wt => `<option value="${wt.id}">${wt.name}</option>`).join('')}</select></td><td><select id="m-${d.id}"><option value="">-- Member --</option></select></td><td><input type="date" id="date-${d.id}"></td><td><button onclick="assignSpecificTask('${d.id}')">Assign</button></td></tr>`;
        sb.innerHTML += `<tr><td>${t.description}</td><td>${t.assignedTeamName || 'N/A'}</td><td>${t.assignedToName || 'Unassigned'}</td><td><select onchange="manualStatusUpdate('${d.id}', this.value)"><option value="To Do" ${t.status==='To Do'?'selected':''}>To Do</option><option value="WIP" ${t.status==='WIP'?'selected':''}>WIP</option><option value="Done" ${t.status==='Done'?'selected':''}>Done</option></select></td></tr>`;
    });
};

window.updateRowMembers = (tid) => {
    const teamId = document.getElementById(`t-${tid}`).value;
    document.getElementById(`m-${tid}`).innerHTML = '<option value="">-- Member --</option>' + window.workspaceMembers.filter(m => m.teamId === teamId).map(m => `<option value="${m.email}">${m.name}</option>`).join('');
};

window.assignSpecificTask = async (tid) => {
    const email = document.getElementById(`m-${tid}`).value;
    const date = document.getElementById(`date-${tid}`).value;
    if(!email || !date) return alert("Select member and date.");
    const member = window.workspaceMembers.find(m => m.email === email);
    await updateDoc(doc(db, "tasks", tid), { assignedToEmail: email, assignedToName: member.name, status: 'assigned', targetDate: date });
    alert("Assigned!"); window.loadAssignmentTable();
};

// --- 5. ANALYTICS & NOTIFICATIONS ---
window.runAnalytics = async () => {
    const pSnap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    document.getElementById('stat-projects').innerText = pSnap.size;
    // (Other stats code...)
};

window.loadAdminNotifications = () => {
    onSnapshot(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email)), (snap) => {
        const dot = document.getElementById('admin-notif-dot');
        const hasUnread = snap.docs.some(n => !n.data().read);
        if(dot) hasUnread ? dot.classList.remove('hidden') : dot.classList.add('hidden');
    });
};
