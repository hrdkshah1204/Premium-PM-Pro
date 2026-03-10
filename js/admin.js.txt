// js/admin.js

import { auth, db, analytics, secondaryAuth } from './firebase-config.js';
import { logEvent, setUserProperties } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, deleteDoc, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            const countSnap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", user.email)));
            if (countSnap.empty) {
                logEvent(analytics, 'ttv_project_created', { seconds_since_signup: Math.floor((Date.now() - user.metadata.createdAt) / 1000) });
                setUserProperties(analytics, { user_cohort: 'active_builder' });
            }
            if (countSnap.size >= 20) return alert("Limit Reached: Max 20 projects.");
            
            await addDoc(collection(db, "projects"), { name, endDate: date, description: desc, createdBy: user.email, status: 'active', createdAt: new Date().toISOString() });
        } else {
            await updateDoc(doc(db, "projects", editId), { name, endDate: date, description: desc });
        }
        logEvent(analytics, 'project_created');
        window.cancelEdit(); 
        window.loadProjectsTable();
    } catch (e) {
        console.error("Save Error:", e);
        alert("Project save failed.");
    }
};

window.openTaskEntry = (pid) => {
    window.navTo('sub2');
    setTimeout(() => { document.getElementById('t-project-id').value = pid; }, 500);
};

window.loadProjectsTable = async () => {
    try {
        const q = query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email));
        const snap = await getDocs(q);
        const tbody = document.getElementById('project-table-body'); 
        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">No projects found. Create your first one above!</td></tr>';
            return;
        }
        snap.forEach(d => {
            const p = d.data();
            const isCompleted = p.status === 'completed';
            tbody.innerHTML += `<tr style="${isCompleted ? 'opacity: 0.6; background: #f1f5f9;' : ''}">
                <td>${p.name} ${isCompleted ? '✅' : ''}</td><td>${p.endDate}</td><td>${p.description || 'N/A'}</td>
                <td class="action-btns"><button class="outline" onclick="openTaskEntry('${d.id}')">+ Tasks</button><button onclick="editProject('${d.id}')">Edit</button><button class="danger" onclick="deleteProject('${d.id}')">Del</button></td>
            </tr>`;
        });
    } catch (e) { console.error("Load Error:", e); }
};

window.editProject = async (id) => {
    const d = await getDoc(doc(db, "projects", id));
    const p = d.data();
    document.getElementById('p-name').value = p.name; document.getElementById('p-date').value = p.endDate; 
    document.getElementById('p-desc').value = p.description; document.getElementById('edit-project-id').value = id;
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
};
window.cancelEdit = () => { document.getElementById('edit-project-id').value = ''; document.getElementById('btn-cancel-edit').classList.add('hidden'); };
window.deleteProject = async (id) => { if(confirm("Delete Project?")) { await deleteDoc(doc(db,"projects",id)); window.loadProjectsTable(); } };

// --- 2. TASK CREATION ---
window.loadProjectDropdown = async () => {
    const snap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('t-project-id'); dd.innerHTML = '<option value="">Select Project</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
};

window.saveTask = async () => {
    const user = auth.currentUser;
    const pid = document.getElementById('t-project-id').value;
    const tdesc = document.getElementById('t-desc').value.trim();
    const tdetails = document.getElementById('t-details').value.trim();
    if(!pid || !tdesc) return alert("Project selection and Task Name are required.");

    try {
        const taskSnap = await getDocs(query(collection(db, "tasks"), where("adminEmail", "==", user.email)));
        if (taskSnap.empty) {
            logEvent(analytics, 'ttv_task_created', { seconds_since_signup: Math.floor((Date.now() - user.metadata.createdAt) / 1000) });
            setUserProperties(analytics, { user_cohort: 'active_builder' });
        }
        if(taskSnap.size >= 100) return alert("Limit: 100 tasks per workspace.");

        await addDoc(collection(db, "tasks"), { projectId: pid, description: tdesc, taskDetails: tdetails, status: "To Do", adminEmail: user.email });
        logEvent(analytics, 'task_created');
        document.getElementById('t-desc').value = ''; document.getElementById('t-details').value = ''; 
        window.loadTasksTable();
    } catch (e) { alert("Task save failed."); }
};

window.loadTasksTable = async () => { 
    const [pSnap, tSnap] = await Promise.all([getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email))), getDocs(collection(db, "tasks"))]);
    const tbody = document.getElementById('tasks-table-body'); tbody.innerHTML = '';
    
    pSnap.forEach(d => {
        const tasks = tSnap.docs.filter(t => t.data().projectId === d.id);
        let taskRowsHTML = tasks.length === 0 ? `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 15px;">No tasks created for this project yet.</td></tr>` : tasks.map(t => `
            <tr style="background: var(--surface);">
                <td style="padding-left: 20px; border-right: 1px solid var(--border); width: 30%;"><strong>${t.data().description}</strong></td>
                <td style="border-right: 1px solid var(--border); color: #475569; font-size: 13px;">${t.data().taskDetails || ''}</td>
                <td style="width: 60px; text-align: center;"><button class="danger" onclick="deleteTask('${t.id}')" style="padding: 6px 10px;">X</button></td>
            </tr>`).join('');

        tbody.innerHTML += `
        <tr style="background: rgba(37, 99, 235, 0.05); border-bottom: 1px solid var(--border);">
            <td style="text-align: center;"><button class="expand-btn" onclick="toggleTaskRow('${d.id}', event)">▶</button></td>
            <td style="font-weight: 700;">${d.data().name}</td><td style="font-weight: 600; color: #64748b;">${tasks.length} / 10</td>
        </tr>
        <tr id="details-${d.id}" style="display: none; background: var(--bg);">
            <td colspan="3" style="padding: 0; border-bottom: 2px solid var(--primary);">
                <table style="width: 100%; margin: 0; box-shadow: none; border-radius: 0;">
                    <thead style="background: rgba(0,0,0,0.02);"><tr><th style="padding-left: 20px; font-size: 12px; color: #64748b;">Task Name</th><th style="font-size: 12px; color: #64748b;">Task Details</th><th style="font-size: 12px; color: #64748b; text-align: center;">Action</th></tr></thead>
                    <tbody>${taskRowsHTML}</tbody>
                </table>
            </td>
        </tr>`;
    });
};

window.toggleTaskRow = (id, e) => { 
    const row = document.getElementById(`details-${id}`); 
    if (row.style.display === 'none' || row.style.display === '') { row.style.display = 'table-row'; e.target.innerText = '▼'; } 
    else { row.style.display = 'none'; e.target.innerText = '▶'; }
};
window.deleteTask = async (id) => { await deleteDoc(doc(db,"tasks",id)); window.loadTasksTable(); };

// --- 3. TEAM & MEMBER MANAGEMENT ---
window.saveTeam = async () => {
    const user = auth.currentUser; const editId = document.getElementById('edit-team-id').value; const tName = document.getElementById('team-name').value.trim();
    if (!tName) return alert("Please enter a valid Team Name.");

    try {
        if(!editId) {
            const teamSnap = await getDocs(query(collection(db, "teams"), where("createdBy", "==", user.email)));
            if (teamSnap.empty) { await logEvent(analytics, 'ttv_team_created', { seconds_since_signup: Math.floor((Date.now() - user.metadata.createdAt) / 1000) }); }
            if(teamSnap.size >= 5) return alert("Limit: 5 Teams.");
            await addDoc(collection(db, "teams"), { name: tName, createdBy: user.email });
        } else { await updateDoc(doc(db, "teams", editId), { name: tName }); }
        logEvent(analytics, 'team_created'); document.getElementById('team-name').value = ''; window.loadTeamsTable();
    } catch (e) { alert("Team save failed."); }
};

window.loadTeamsTable = async () => {
    const adminEmail = auth.currentUser.email;
    const [teamsSnap, membersSnap] = await Promise.all([getDocs(query(collection(db, "teams"), where("createdBy", "==", adminEmail))), getDocs(query(collection(db, "users"), where("adminEmail", "==", adminEmail)))]);
    const tbody = document.getElementById('team-table-body'); tbody.innerHTML = '';
    teamsSnap.forEach(d => {
        const memberCount = membersSnap.docs.filter(m => m.data().teamId === d.id).length;
        tbody.innerHTML += `<tr><td style="vertical-align: middle; font-weight: 500;">${d.data().name}</td><td style="text-align: center; vertical-align: middle; font-weight: 600; color: #64748b;">${memberCount} / 10</td><td style="text-align: center; vertical-align: middle;"><button class="outline" onclick="navTo('sub4')" style="width: 100%; padding: 8px;">+ Members</button></td><td style="text-align: center; vertical-align: middle;"><button onclick="editTeam('${d.id}')" style="width: 100%; padding: 8px;">Edit</button></td><td style="text-align: center; vertical-align: middle;"><button class="danger" onclick="deleteTeam('${d.id}')" style="width: 100%; padding: 8px;">Del</button></td></tr>`;
    });
};

window.editTeam = async (id) => { const d = await getDoc(doc(db, "teams", id)); document.getElementById('team-name').value = d.data().name; document.getElementById('edit-team-id').value = id; document.getElementById('btn-cancel-team-edit').classList.remove('hidden'); };
window.cancelTeamEdit = () => { document.getElementById('team-name').value = ''; document.getElementById('edit-team-id').value = ''; document.getElementById('btn-cancel-team-edit').classList.add('hidden'); };
window.deleteTeam = async (id) => { if(confirm("Delete team?")) { await deleteDoc(doc(db, "teams", id)); window.loadTeamsTable(); } };

window.loadTeamDropdownForMembers = async () => {
    const snap = await getDocs(query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('m-team-id'); dd.innerHTML = '<option value="">Select Team</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
};

window.saveMember = async () => {
    const adminEmail = auth.currentUser.email; const email = document.getElementById('m-email').value.toLowerCase().trim();
    const tid = document.getElementById('m-team-id').value; const name = document.getElementById('m-name').value.trim();
    const phone = document.getElementById('m-phone').value.trim(); const tname = document.getElementById('m-team-id').options[document.getElementById('m-team-id').selectedIndex].text;
    const editId = document.getElementById('edit-member-id').value;
    if (!email || !tid || !name) return alert("Name, Email, and Team are required.");

    try {
        if (!editId) {
            const memSnap = await getDocs(query(collection(db, "users"), where("teamId", "==", tid)));
            if (memSnap.size >= 10) return alert("Limit: 10 Members per team.");
            const randomPassword = Math.random().toString(36).slice(-8);
            const newCred = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword);
            await sendEmailVerification(newCred.user);
            await signOut(secondaryAuth);
            await setDoc(doc(db, "users", email), { name, email, phone, teamId: tid, teamName: tname, role: 'member', adminEmail, company: document.getElementById('display-org-name').innerText });
            
            const totalMembersSnap = await getDocs(query(collection(db, "users"), where("adminEmail", "==", adminEmail), where("role", "==", "member")));
            if (totalMembersSnap.size === 1) { 
                logEvent(analytics, 'ttv_first_member_added', { seconds_since_signup: Math.floor((Date.now() - auth.currentUser.metadata.createdAt) / 1000) });
                setUserProperties(analytics, { user_cohort: 'team_manager' });
            }
            logEvent(analytics, 'member_saved');
            alert(`Member created!\n\nEmail: ${email}\nPassword: ${randomPassword}`);
        } else {
            await updateDoc(doc(db, "users", email), { name, email, phone, teamId: tid, teamName: tname }); alert("Member details updated.");
        }
        window.cancelMemberEdit(); window.loadMembersTable();
    } catch (error) { alert("Error saving member: " + error.message); }
};

window.editMember = async (email) => {
    const d = await getDoc(doc(db, "users", email)); const m = d.data();
    document.getElementById('m-name').value = m.name || ""; document.getElementById('m-email').value = email;
    document.getElementById('m-email').disabled = true; document.getElementById('m-phone').value = m.phone || "";
    document.getElementById('m-team-id').value = m.teamId; document.getElementById('edit-member-id').value = email;
    document.getElementById('btn-cancel-member').classList.remove('hidden');
};
window.cancelMemberEdit = () => { document.getElementById('m-name').value = ''; document.getElementById('m-email').value = ''; document.getElementById('m-email').disabled = false; document.getElementById('m-phone').value = ''; document.getElementById('m-team-id').value = ''; document.getElementById('edit-member-id').value = ''; document.getElementById('btn-cancel-member').classList.add('hidden'); };
window.loadMembersTable = async () => {
    const snap = await getDocs(query(collection(db, "users"), where("adminEmail", "==", auth.currentUser.email)));
    const tbody = document.getElementById('member-table-body'); tbody.innerHTML = '';
    snap.forEach(d => { tbody.innerHTML += `<tr><td>${d.data().name}</td><td>${d.data().teamName}</td><td>${d.id}</td><td>${d.data().phone || "N/A"}</td><td class="action-btns"><button onclick="editMember('${d.id}')">Edit</button><button class="danger" onclick="deleteMember('${d.id}')">Del</button></td></tr>`; });
};
window.deleteMember = async (id) => { 
    if(confirm("Delete this member? This will automatically unassign any tasks they were working on.")) {
        await deleteDoc(doc(db, "users", id)); 
        const assignedTasks = await getDocs(query(collection(db, "tasks"), where("assignedToEmail", "==", id)));
        assignedTasks.forEach(async (t) => { await updateDoc(doc(db, "tasks", t.id), { assignedToEmail: "", assignedToName: "", assignedTeamId: "", assignedTeamName: "", status: "To Do" }); });
        window.loadMembersTable(); 
    }
};

// --- 4. TASK ASSIGNMENT ---
window.workspaceTeams = []; window.workspaceMembers = []; window.lastSelectedProjectId = "";

window.loadAssignProjectDropdown = async () => {
    const snap = await getDocs(query(collection(db, "projects"), where("createdBy", "==", auth.currentUser.email)));
    const dd = document.getElementById('assign-project-select'); dd.innerHTML = '<option value="">-- Select Project --</option>';
    snap.forEach(d => dd.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
    if (window.lastSelectedProjectId) { dd.value = window.lastSelectedProjectId; window.loadAssignmentTable(); } 
    else { document.getElementById('assign-table-body').innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Please select a project above to assign tasks.</td></tr>'; document.getElementById('allocation-summary-body').innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">Please select a project above to view summary.</td></tr>'; }
};

window.fetchTeamsAndMembers = async () => {
    const [tSnap, mSnap] = await Promise.all([ getDocs(query(collection(db, "teams"), where("createdBy", "==", auth.currentUser.email))), getDocs(query(collection(db, "users"), where("role", "==", "member"), where("adminEmail", "==", auth.currentUser.email))) ]);
    window.workspaceTeams = tSnap.docs.map(d => ({id: d.id, ...d.data()})); window.workspaceMembers = mSnap.docs.map(d => ({id: d.id, email: d.id, ...d.data()}));
};

window.loadAssignmentTable = async () => {
    const pid = document.getElementById('assign-project-select').value; window.lastSelectedProjectId = pid;
    const tb = document.getElementById('assign-table-body'); const sb = document.getElementById('allocation-summary-body');
    if(!pid) { tb.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">Please select a project above to assign tasks.</td></tr>'; sb.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">Please select a project above to view summary.</td></tr>'; return; }
    tb.innerHTML = ''; sb.innerHTML = '';
    const tSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", pid)));
    
    // Calls a function still residing in index.html (for now)
    if(window.checkOverdueAndNotify) await window.checkOverdueAndNotify(tSnap.docs.map(d => ({id: d.id, ...d.data()})));

    tSnap.forEach(d => {
        const t = d.data(); let assigneeDisplay = t.assignedToName || 'Unassigned';
        if (t.assignedToEmail && !window.workspaceMembers.some(m => m.email === t.assignedToEmail)) { assigneeDisplay = `<span style="color: #ef4444; font-weight: bold;">${t.assignedToName} (Deleted)</span>`; }
        const isDone = (t.status === 'Done' || t.status === 'completed');

        if (!isDone) {
            tb.innerHTML += `<tr><td>${t.description}</td><td><select id="t-${d.id}" onchange="updateRowMembers('${d.id}')"><option value="">-- Select Team --</option>${window.workspaceTeams.map(wt => `<option value="${wt.id}">${wt.name}</option>`).join('')}</select></td><td><select id="m-${d.id}"><option value="">-- Member --</option></select></td><td><input type="date" id="date-${d.id}" value="${t.targetDate || ''}"></td><td><button onclick="assignSpecificTask('${d.id}')">Assign</button></td></tr>`;
        }
        sb.innerHTML += `<tr><td>${t.description}</td><td>${t.assignedTeamName || 'N/A'}</td><td>${assigneeDisplay}</td><td><select onchange="manualStatusUpdate('${d.id}', this.value)" style="padding:4px; font-size:12px;"><option value="To Do" ${t.status==='To Do'||t.status==='to-do'?'selected':''}>To Do</option><option value="assigned" ${t.status==='assigned'?'selected':''}>Assigned</option><option value="WIP" ${t.status==='WIP'||t.status==='in-progress'?'selected':''}>WIP</option><option value="On Hold" ${t.status==='On Hold'?'selected':''}>On Hold</option><option value="Done" ${t.status==='Done'||t.status==='completed'?'selected':''}>Done</option></select></td></tr>`;
    });
    if (tb.innerHTML === '') { tb.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">🎉 All pending tasks have been assigned and completed!</td></tr>'; }
    if (sb.innerHTML === '') { sb.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">No tasks exist for this project yet.</td></tr>'; }
};

window.updateRowMembers = (tid) => document.getElementById(`m-${tid}`).innerHTML = '<option value="">-- Select Member --</option>' + window.workspaceMembers.filter(m => m.teamId === document.getElementById(`t-${tid}`).value).map(m => `<option value="${m.email}">${m.name}</option>`).join('');

window.assignSpecificTask = async (tid) => {
    try {
        const email = document.getElementById(`m-${tid}`).value; const tId = document.getElementById(`t-${tid}`).value; const targetDate = document.getElementById(`date-${tid}`).value;
        if (!tId) return alert("Please select a Team first."); if (!email || email === "undefined") return alert("Please select a Member."); if (!targetDate) return alert("Please set a Target Date.");
        const member = window.workspaceMembers.find(m => m.email === email || m.id === email);
        if (!member) return alert("System Error: Member data mapping failed.");

        await updateDoc(doc(db, "tasks", tid), { assignedToEmail: email, assignedToName: member.name, status: 'assigned', targetDate: targetDate, assignedTimestamp: Date.now() });

        try { await addDoc(collection(db, "notifications"), { forEmail: email, fromEmail: auth.currentUser.email, message: `New task assigned. Target Date: ${targetDate}.`, timestamp: Date.now(), read: false, bookmarked: false }); } catch (notifErr) {}

        const assignedSnap = await getDocs(query(collection(db, "tasks"), where("adminEmail", "==", auth.currentUser.email), where("status", "==", "assigned")));
        if (assignedSnap.size === 1) { logEvent(analytics, 'ttv_first_assignment', { seconds_since_signup: Math.floor((Date.now() - auth.currentUser.metadata.createdAt) / 1000) }); setUserProperties(analytics, { user_cohort: 'power_user' }); }
        logEvent(analytics, 'task_assigned');
        alert("Task assigned with Target Date!!"); window.loadAssignmentTable();
    } catch (error) { alert("Assignment failed: " + error.message); }
};

// --- 5. ANALYTICS & SETTINGS ---
window.runAnalytics = async () => {
    const user = auth.currentUser;
    const [pSnap, tSnap, teamSnap, mSnap] = await Promise.all([ getDocs(query(collection(db, "projects"), where("createdBy", "==", user.email))), getDocs(collection(db, "tasks")), getDocs(query(collection(db, "teams"), where("createdBy", "==", user.email))), getDocs(query(collection(db, "users"), where("role", "==", "member"), where("adminEmail", "==", user.email))) ]);
    
    document.getElementById('stat-projects').innerText = pSnap.size; document.getElementById('stat-teams').innerText = teamSnap.size; document.getElementById('stat-members').innerText = mSnap.size;
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
        tBody.innerHTML += `<tr><td>${teamDoc.data().name}</td><td><strong>${teamTasks.length}</strong></td><td style="color:#64748b">${teamTasks.filter(t => t.data().status==='To Do'||t.data().status==='to-do'||t.data().status==='assigned').length}</td><td style="color:#2563eb">${teamTasks.filter(t => t.data().status==='WIP'||t.data().status==='in-progress').length}</td><td style="color:#10b981">${teamTasks.filter(t => t.data().status==='Done'||t.data().status==='completed').length}</td></tr>`;
    });
};

window.toggleAdminEdit = async () => {
    const btn = document.getElementById('btn-edit-admin');
    const fieldsToToggle = ['set-name', 'set-phone', 'set-company', 'set-size', 'set-address'];
    if (btn.innerText === "Edit Details") { fieldsToToggle.forEach(id => document.getElementById(id).disabled = false); btn.innerText = "Update Details"; } 
    else {
        const newName = document.getElementById('set-name').value.trim(); const newPhone = document.getElementById('set-phone').value.trim(); const newCompany = document.getElementById('set-company').value.trim(); const newSize = document.getElementById('set-size').value; const newAddress = document.getElementById('set-address').value.trim();
        try {
            await updateDoc(doc(db, "users", auth.currentUser.email), { name: newName, phone: newPhone, company: newCompany, teamSize: newSize, companyAddress: newAddress });
            document.getElementById('display-org-name').innerText = newCompany || "Workspace"; document.querySelectorAll('.user-name').forEach(el => el.innerText = newName);
            alert("Workspace Details Updated Successfully!");
            fieldsToToggle.forEach(id => document.getElementById(id).disabled = true); btn.innerText = "Edit Details";
        } catch (e) { alert("Failed to update profile: " + e.message); }
    }
};

// --- 6. ADMIN NOTIFICATIONS ---
window.toggleBookmark = (id, cur) => updateDoc(doc(db, "notifications", id), { bookmarked: !cur });

window.loadAdminNotifications = () => {
    onSnapshot(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email)), (snap) => {
        const tb = document.getElementById('admin-notif-table-body'); tb.innerHTML = '';
        let docs = snap.docs.map(d => ({id: d.id, ...d.data()})); docs.sort((a, b) => b.timestamp - a.timestamp);
        const hasUnread = docs.some(n => !n.read); const dot = document.getElementById('admin-notif-dot');
        if(dot) hasUnread ? dot.classList.remove('hidden') : dot.classList.add('hidden');
        docs.slice(0, 100).forEach(n => { tb.innerHTML += `<tr style="background:${n.read?'transparent':'rgba(37,99,235,0.05)'}"><td>${n.message}<br><small style="color:#64748b">${new Date(n.timestamp).toLocaleString()}</small></td><td><button onclick="toggleBookmark('${n.id}', ${n.bookmarked})">${n.bookmarked ? '⭐' : '☆'}</button></td></tr>`; });
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