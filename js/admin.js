// js/admin.js

import { auth, db, analytics, secondaryAuth } from './firebase-config.js';
import { logEvent, setUserProperties } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 0. NAVIGATION ---
window.navTo = (id) => {
    document.querySelectorAll('.sub-page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(btn => btn.getAttribute('onclick').includes(id));
    if (activeBtn) activeBtn.classList.add('active');

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
    document.getElementById('p-name').value = '';
    document.getElementById('p-date').value = '';
    document.getElementById('p-desc').value = '';
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
        tbody.innerHTML += `<tr style="background: rgba(37, 99, 235, 0.05);"><td><button class="expand-btn" onclick="toggleTaskRow('${d.id}', event)">▶</button></td><td style="font-weight:bold;">${d.data().name}</td><td>${tasks.length} / 10</td></tr>
        <tr id="details-${d.id}" style="display: none;"> <td colspan="3"><table style="width:100%; margin:0; box-shadow:none;">${tasks.map(t => `<tr><td>${t.data().description}</td><td style="width:60px; text-align:center;"><button class="danger" onclick="deleteTask('${t.id}')">X</button></td></tr>`).join('')}</table></td></tr>`;
    });
};

window.toggleTaskRow = (id, e) => { 
    const row = document.getElementById(`details-${id}`); 
    if (row.style.display === 'none' || row.style.display === '') {
        row.style.display = 'table-row'; e.target.innerText = '▼';
    } else {
        row.style.display = 'none'; e.target.innerText = '▶';
    }
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
    const adminEmail = auth.currentUser.email;
    const [teamsSnap, membersSnap] = await Promise.all([getDocs(query(collection(db, "teams"), where("createdBy", "==", adminEmail))), getDocs(query(collection(db, "users"), where("adminEmail", "==", adminEmail)))]);
    const tbody = document.getElementById('team-table-body'); tbody.innerHTML = '';
    teamsSnap.forEach(d => {
        const memberCount = membersSnap.docs.filter(m => m.data().teamId === d.id).length;
        tbody.innerHTML += `<tr><td>${d.data().name}</td><td>${memberCount} / 10</td><td><button class="outline" onclick="navTo('sub4')">+ Members</button></td><td><button onclick="alert('Team edit coming soon')">Edit</button></td><td><button class="danger" onclick="deleteTeam('${d.id}')">Del</button></td></tr>`;
    });
};

window.deleteTeam = async (id) => { if(confirm("Delete team?")) { await deleteDoc(doc(db, "teams", id)); window.loadTeamsTable(); } };

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
    const editId = document.getElementById('edit-member-id').value;
    
    const teamDropdown = document.getElementById('m-team-id');
    const tname = teamDropdown.selectedIndex > 0 ? teamDropdown.options[teamDropdown.selectedIndex].text : "No Team";

    if (!email || !tid || !name) return alert("Name, Email, and Team are required.");

    try {
        if (!editId) {
            const password = Math.random().toString(36).slice(-8);
            const newCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await sendEmailVerification(newCred.user);
            await signOut(secondaryAuth);
            await setDoc(doc(db, "users", email), { name, email, phone, teamId: tid, teamName: tname, role: 'member', adminEmail, company: document.getElementById('display-org-name').innerText });
            alert(`Member Created!\n\nEmail: ${email}\nPassword: ${password}`);
        } else {
            await updateDoc(doc(db, "users", email), { name, email, phone, teamId: tid, teamName: tname }); 
            alert("Member details updated.");
        }
        window.cancelMemberEdit(); window.loadMembersTable();
    } catch (error) { alert("Error: " + error.message); }
};

window.editMember = async (email) => {
    const d = await getDoc(doc(db, "users", email)); 
    const m = d.data();
    document.getElementById('m-name').value = m.name || ""; 
    document.getElementById('m-email').value = email;
    document.getElementById('m-email').disabled = true; 
    document.getElementById('m-phone').value = m.phone || "";
    document.getElementById('m-team-id').value = m.teamId; 
    document.getElementById('edit-member-id').value = email;
    const cancelBtn = document.getElementById('btn-cancel-member');
    if(cancelBtn) cancelBtn.classList.remove('hidden');
};

window.cancelMemberEdit = () => {
    document.getElementById('m-name').value = ''; 
    document.getElementById('m-email').value = '';
    document.getElementById('m-email').disabled = false;
    document.getElementById('m-phone').value = '';
    document.getElementById('m-team-id').value = '';
    document.getElementById('edit-member-id').value = '';
    const btn = document.getElementById('btn-cancel-member');
    if(btn) btn.classList.add('hidden'); 
};

window.loadMembersTable = async () => {
    const snap = await getDocs(query(collection(db, "users"), where("adminEmail", "==", auth.currentUser.email)));
    const tbody = document.getElementById('member-table-body'); tbody.innerHTML = '';
    snap.forEach(d => { 
        tbody.innerHTML += `<tr><td>${d.data().name}</td><td>${d.data().teamName}</td><td>${d.id}</td><td class="action-btns"><button onclick="editMember('${d.id}')">Edit</button><button class="danger" onclick="deleteMember('${d.id}')">Del</button></td></tr>`; 
    });
};

window.deleteMember = async (id) => { 
    if(confirm("Delete this member? This will automatically unassign any tasks they were working on.")) {
        await deleteDoc(doc(db, "users", id)); 
        const assignedTasks = await getDocs(query(collection(db, "tasks"), where("assignedToEmail", "==", id)));
        assignedTasks.forEach(async (t) => { 
            await updateDoc(doc(db, "tasks", t.id), { assignedToEmail: "", assignedToName: "", assignedTeamId: "", assignedTeamName: "", status: "To Do" }); 
        });
        window.loadMembersTable(); 
    }
};

// --- 4. TASK ASSIGNMENT & STATUS ---
window.workspaceTeams = []; 
window.workspaceMembers = []; 
window.lastSelectedProjectId = "";

window.manualStatusUpdate = async (taskId, newStatus) => {
    try {
        // 1. Get task details so we know what it's called and who has it
        const tDoc = await getDoc(doc(db, "tasks", taskId));
        if (!tDoc.exists()) return;
        const t = tDoc.data();

        // 2. Update the task status
        await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
        
        // 3. Send notification to the assigned member (if someone is assigned)
        if (t.assignedToEmail) {
            await addDoc(collection(db, "notifications"), {
                forEmail: t.assignedToEmail,
                fromEmail: auth.currentUser.email,
                message: `Status Changed: Admin updated your task "${t.description}" to [${newStatus}]`,
                timestamp: Date.now(),
                read: false,
                bookmarked: false
            });
            console.log(`Notification sent to ${t.assignedToEmail}`);
        }

        alert(`Status updated to ${newStatus} and user notified!`);
        window.loadAssignmentTable();
    } catch (e) { 
        console.error("Status Update Error:", e); 
        alert("Failed to update status.");
    }
};

window.loadAssignProjectDropdown = async () => {
    const snap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('assign-project-select'); dd.innerHTML = '<option value="">-- Select Project --</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
    if(window.lastSelectedProjectId) {
        dd.value = window.lastSelectedProjectId;
        window.loadAssignmentTable();
    }
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
    window.lastSelectedProjectId = pid;
    const tb = document.getElementById('assign-table-body'); 
    const sb = document.getElementById('allocation-summary-body');
    if(!pid) return;
    tb.innerHTML = ''; sb.innerHTML = '';
    
    const tSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", pid)));
    const tasksData = tSnap.docs.map(d => ({id: d.id, ...d.data()}));
    
    if(window.checkOverdueAndNotify) await window.checkOverdueAndNotify(tasksData);

    tasksData.forEach(t => {
        const isDone = (t.status === 'Done' || t.status === 'completed');
        
        if(!isDone) {
            tb.innerHTML += `<tr><td>${t.description}</td><td><select id="t-${t.id}" onchange="updateRowMembers('${t.id}')"><option value="">-- Team --</option>${window.workspaceTeams.map(wt => `<option value="${wt.id}">${wt.name}</option>`).join('')}</select></td><td><select id="m-${t.id}"><option value="">-- Member --</option></select></td><td><input type="date" id="date-${t.id}" value="${t.targetDate || ''}"></td><td><button onclick="assignSpecificTask('${t.id}')">Assign</button></td></tr>`;
        }
        sb.innerHTML += `<tr><td>${t.description}</td><td>${t.assignedTeamName || 'N/A'}</td><td>${t.assignedToName || 'Unassigned'}</td><td><select onchange="manualStatusUpdate('${t.id}', this.value)" style="padding:4px;"><option value="To Do" ${t.status==='To Do'?'selected':''}>To Do</option><option value="assigned" ${t.status==='assigned'?'selected':''}>Assigned</option><option value="WIP" ${t.status==='WIP'?'selected':''}>WIP</option><option value="On Hold" ${t.status==='On Hold'?'selected':''}>On Hold</option><option value="Done" ${t.status==='Done'?'selected':''}>Done</option></select></td></tr>`;
    });
};

window.updateRowMembers = (tid) => {
    const teamId = document.getElementById(`t-${tid}`).value;
    document.getElementById(`m-${tid}`).innerHTML = '<option value="">-- Member --</option>' + window.workspaceMembers.filter(m => m.teamId === teamId).map(m => `<option value="${m.email}">${m.name}</option>`).join('');
};

window.assignSpecificTask = async (tid) => {
    const email = document.getElementById(`m-${tid}`).value;
    const date = document.getElementById(`date-${tid}`).value;
    const teamId = document.getElementById(`t-${tid}`).value;
    
    if(!email || !date || !teamId) return alert("Select team, member, and date.");
    
    const member = window.workspaceMembers.find(m => m.email === email);
    const teamName = window.workspaceTeams.find(t => t.id === teamId)?.name || "Unknown";
    
    // 1. Update the Task
    await updateDoc(doc(db, "tasks", tid), { 
        assignedToEmail: email, 
        assignedToName: member.name, 
        assignedTeamId: teamId,
        assignedTeamName: teamName,
        status: 'assigned', 
        targetDate: date 
    });

    // 2. BUG FIX: Send the Notification to the Member
    try {
        await addDoc(collection(db, "notifications"), { 
            forEmail: email, 
            fromEmail: auth.currentUser.email, 
            message: `New task assigned. Target Date: ${date}.`, 
            timestamp: Date.now(), 
            read: false, 
            bookmarked: false 
        });
    } catch (notifErr) {
        console.error("Notification failed to send:", notifErr);
    }

    alert("Task Assigned & User Notified!"); 
    window.loadAssignmentTable();
};

// --- 5. ANALYTICS ---
window.runAnalytics = async () => {
    const user = auth.currentUser;
    const [pSnap, tSnap, teamSnap, mSnap] = await Promise.all([ 
        getDocs(query(collection(db, "projects"), where("createdBy", "==", user.email))), 
        getDocs(collection(db, "tasks")), 
        getDocs(query(collection(db, "teams"), where("createdBy", "==", user.email))), 
        getDocs(query(collection(db, "users"), where("role", "==", "member"), where("adminEmail", "==", user.email))) 
    ]);
    
    document.getElementById('stat-projects').innerText = pSnap.size; 
    document.getElementById('stat-teams').innerText = teamSnap.size; 
    document.getElementById('stat-members').innerText = mSnap.size;
    
    const container = document.getElementById('project-progress-container'); container.innerHTML = '';
    pSnap.forEach(d => {
        const tasks = tSnap.docs.filter(t => t.data().projectId === d.id);
        const done = tasks.filter(t => t.data().status === 'Done' || t.data().status === 'completed').length;
        const perc = tasks.length > 0 ? Math.round((done/tasks.length)*100) : 0;
        container.innerHTML += `<div style="background:var(--surface); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:10px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${d.data().name}</strong><span>${perc}% Complete</span></div><div style="width:100%; background:var(--bg); height:10px; border-radius:5px; overflow:hidden;"><div style="width:${perc}%; background:var(--primary); height:10px; transition: width 0.5s ease;"></div></div></div>`;
    });
    
    const tBody = document.getElementById('analytics-team-body'); tBody.innerHTML = '';
    teamSnap.forEach(teamDoc => {
        const teamTasks = tSnap.docs.filter(t => t.data().assignedTeamId === teamDoc.id);
        tBody.innerHTML += `<tr><td>${teamDoc.data().name}</td><td><strong>${teamTasks.length}</strong></td><td style="color:#64748b">${teamTasks.filter(t => t.data().status==='To Do'||t.data().status==='assigned').length}</td><td style="color:#2563eb">${teamTasks.filter(t => t.data().status==='WIP').length}</td><td style="color:#10b981">${teamTasks.filter(t => t.data().status==='Done'||t.data().status==='completed').length}</td></tr>`;
    });
};

// --- 6. PROFILE SETTINGS ---
window.toggleAdminEdit = async () => {
    const btn = document.getElementById('btn-edit-admin');
    const fieldsToToggle = ['set-name', 'set-phone', 'set-company', 'set-size', 'set-address'];
    if (btn.innerText === "Edit Details") { 
        fieldsToToggle.forEach(id => document.getElementById(id).disabled = false); 
        btn.innerText = "Update Details"; 
    } else {
        const newName = document.getElementById('set-name').value.trim(); 
        const newPhone = document.getElementById('set-phone').value.trim(); 
        const newCompany = document.getElementById('set-company').value.trim(); 
        const newSize = document.getElementById('set-size').value; 
        const newAddress = document.getElementById('set-address').value.trim();
        try {
            await updateDoc(doc(db, "users", auth.currentUser.email), { name: newName, phone: newPhone, company: newCompany, teamSize: newSize, companyAddress: newAddress });
            document.getElementById('display-org-name').innerText = newCompany || "Workspace"; 
            document.querySelectorAll('.user-name').forEach(el => el.innerText = newName);
            alert("Workspace Details Updated Successfully!");
            fieldsToToggle.forEach(id => document.getElementById(id).disabled = true); 
            btn.innerText = "Edit Details";
        } catch (e) { alert("Failed to update profile: " + e.message); }
    }
};

// --- 7. NOTIFICATIONS ---
window.toggleBookmark = (id, cur) => updateDoc(doc(db, "notifications", id), { bookmarked: !cur });

window.loadAdminNotifications = () => {
    onSnapshot(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email)), (snap) => {
        const tb = document.getElementById('admin-notif-table-body'); 
        if(tb) tb.innerHTML = '';
        let docs = snap.docs.map(d => ({id: d.id, ...d.data()})); 
        docs.sort((a, b) => b.timestamp - a.timestamp);
        
        const hasUnread = docs.some(n => !n.read); 
        const dot = document.getElementById('admin-notif-dot');
        if(dot) hasUnread ? dot.classList.remove('hidden') : dot.classList.add('hidden');
        
        docs.slice(0, 100).forEach(n => { 
            if(tb) tb.innerHTML += `<tr style="background:${n.read?'transparent':'rgba(37,99,235,0.05)'}"><td>${n.message}<br><small style="color:#64748b">${new Date(n.timestamp).toLocaleString()}</small></td><td><button onclick="toggleBookmark('${n.id}', ${n.bookmarked})">${n.bookmarked ? '⭐' : '☆'}</button></td></tr>`; 
        });
    });
};

window.markAllAdminNotificationsRead = async () => {
    const snap = await getDocs(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email), where("read", "==", false)));
    snap.forEach(d => updateDoc(doc(db, "notifications", d.id), { read: true }));
};

window.deleteAdminNotifications = async () => {
    if(confirm("Delete all alerts except pins?")) {
        const snap = await getDocs(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email), where("bookmarked", "==", false)));
        snap.forEach(d => deleteDoc(doc(db, "notifications", d.id)));
    }
};
