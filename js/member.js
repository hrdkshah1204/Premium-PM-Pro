// js/member.js
import { auth, db, analytics } from './firebase-config.js';
import { logEvent } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- MEMBER CORE MODULES ---
window.initMemberDashboard = async function(email, data) {
    document.getElementById('member-view').classList.remove('hidden');
    
    // Sidebar info
    if (document.getElementById('m-side-name')) document.getElementById('m-side-name').innerText = data.name || "";
    if (document.getElementById('m-side-team')) document.getElementById('m-side-team').innerText = data.teamName || "General Team";
    if (document.getElementById('m-side-company')) document.getElementById('m-side-company').innerText = data.company || "Org";
    
    // Profile inputs (Safety checks added)
    if (document.getElementById('mp-name')) document.getElementById('mp-name').value = data.name || ""; 
    if (document.getElementById('mp-email')) document.getElementById('mp-email').value = email || "";
    if (document.getElementById('mp-phone')) document.getElementById('mp-phone').value = data.phone || "";
    if (document.getElementById('mp-company')) document.getElementById('mp-company').value = data.company || ""; 
    if (document.getElementById('mp-team')) document.getElementById('mp-team').value = data.teamName || "";
    if (document.getElementById('mp-address')) document.getElementById('mp-address').value = data.residentialAddress || "";
    if (document.getElementById('mp-em-name')) document.getElementById('mp-em-name').value = data.emergencyName || "";
    if (document.getElementById('mp-em-num')) document.getElementById('mp-em-num').value = data.emergencyPhone || "";
    
    onSnapshot(query(collection(db, "tasks"), where("assignedToEmail", "==", email)), async (snap) => {
        let tasks = snap.docs.map(d => ({id: d.id, ...d.data()}));
        tasks.sort((a, b) => (b.assignedTimestamp || 0) - (a.assignedTimestamp || 0));

        const projs = await getDocs(collection(db, "projects"));
        const pMap = {}; 
        projs.forEach(p => pMap[p.id] = p.data()); 
        
        // Ensure global helper is called
        if (window.checkOverdueAndNotify) await window.checkOverdueAndNotify(tasks);
        renderMemberTasks(tasks, pMap);
    });
    
    loadMemberNotifications(email);
};

function renderMemberTasks(tasks, pMap) {
    const grid = document.getElementById('m-task-grid'); 
    if (grid) grid.innerHTML = '';
    
    const historyGrid = document.getElementById('m-history-grid'); 
    if (historyGrid) historyGrid.innerHTML = '';
    
    let s = { total: tasks.length, done: 0, wip: 0, todo: 0, hold: 0 };
    const activeTasksByProject = {};
    const doneTasksByProject = {};

    tasks.forEach(t => {
        const isDone = (t.status === 'Done' || t.status === 'completed');
        if(isDone) {
            s.done++;
            if(!doneTasksByProject[t.projectId]) doneTasksByProject[t.projectId] = [];
            doneTasksByProject[t.projectId].push(t);
        } else {
            if(t.status==='WIP'||t.status==='in-progress') s.wip++;
            else if(t.status==='To Do'||t.status==='to-do'||t.status==='assigned') s.todo++;
            else if(t.status==='On Hold') s.hold++;
            
            if(!activeTasksByProject[t.projectId]) activeTasksByProject[t.projectId] = [];
            activeTasksByProject[t.projectId].push(t);
        }
    });

    // 1. RENDER ACTIVE TASKS
    for (const [pid, pTasks] of Object.entries(activeTasksByProject)) {
        const projectData = pMap[pid] || { name: 'Unknown Project', description: 'No project details available.' };
        let projectHTML = `<div class="project-card" style="grid-column: 1 / -1;"><div class="project-header" style="flex-direction: column; align-items: flex-start; gap: 5px;"><div style="font-size: 16px;">${projectData.name}</div><div style="font-size: 12px; font-weight: normal; opacity: 0.9;">Project Details: ${projectData.description}</div></div><table class="card-table">`;
        
        pTasks.forEach(t => {
            const overdueFlag = (t.targetDate && t.targetDate < new Date().toISOString().split('T')[0]) ? `<span class="overdue-badge">OVERDUE</span>` : '';
            let historyList = t.commentHistory || (t.memberComment ? [{date: "Note", text: t.memberComment}] : []);
            let historyHTML = historyList.length > 0 ? `<div style="background: var(--bg); padding: 10px; border-radius: 6px; margin-bottom: 10px; max-height: 120px; overflow-y: auto; border: 1px solid var(--border);"><strong style="font-size: 12px; color: #64748b;">UPDATE HISTORY</strong>${historyList.map(c => `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); font-size: 13px;"><b>${c.date}</b><br>${c.text}</div>`).join('')}</div>` : '';
            
            projectHTML += `<tr style="background: rgba(37, 99, 235, 0.05);"><td colspan="2"><strong>Task:</strong> ${t.description} ${overdueFlag}<br><div style="color: #64748b; font-size: 12px; margin-top: 4px;"><strong>Instructions:</strong> ${t.taskDetails || 'None'}</div></td></tr><tr><td style="width: 50%;"><strong>Target:</strong> ${t.targetDate || 'N/A'}</td><td><strong>Status:</strong> <select id="stat-${t.id}"><option value="assigned" ${t.status==='assigned'?'selected':''}>Assigned</option><option value="WIP" ${t.status==='WIP'?'selected':''}>WIP</option><option value="Done" ${t.status==='Done'?'selected':''}>Done</option><option value="On Hold" ${t.status==='On Hold'?'selected':''}>On Hold</option></select></td></tr><tr><td colspan="2">${historyHTML}<textarea id="comm-${t.id}" rows="2" placeholder="Add update note..." style="width: 100%;"></textarea><input type="date" id="cdate-${t.id}" value="${t.completionDate || ''}" style="margin-top: 5px; width: 100%;"></td></tr><tr><td colspan="2"><button onclick="submitTaskUpdate('${t.id}')" style="width: 100%;">Update Task</button></td></tr>`;
        });
        projectHTML += `</table></div>`;
        if (grid) grid.innerHTML += projectHTML;
    }

    // 2. RENDER COMPLETED TASKS (FIXED: This was missing!)
    for (const [pid, pTasks] of Object.entries(doneTasksByProject)) {
        const projectData = pMap[pid] || { name: 'Unknown Project' };
        let historyHTML = `<div class="project-card" style="grid-column: 1 / -1; opacity: 0.8;"><div class="project-header" style="background: #10b981;">${projectData.name} - Completed</div><table class="card-table">`;
        
        pTasks.forEach(t => {
            historyHTML += `<tr><td><strong>Task:</strong> <span style="text-decoration: line-through; color: #64748b;">${t.description}</span><br><div style="color: #10b981; font-size: 12px; margin-top: 4px;"><strong>Completed on:</strong> ${t.completionDate || 'N/A'}</div></td></tr>`;
        });
        historyHTML += `</table></div>`;
        if (historyGrid) historyGrid.innerHTML += historyHTML;
    }

    // 3. Summary Stats
    if (document.getElementById('m-stat-total')) document.getElementById('m-stat-total').innerText = s.total;
    if (document.getElementById('m-stat-done')) document.getElementById('m-stat-done').innerText = s.done;
    if (document.getElementById('m-stat-wip')) document.getElementById('m-stat-wip').innerText = s.wip;
    if (document.getElementById('m-stat-todo')) document.getElementById('m-stat-todo').innerText = s.todo;
    if (document.getElementById('m-stat-hold')) document.getElementById('m-stat-hold').innerText = s.hold;
}

window.submitTaskUpdate = async (tid) => {
    try {
        const stat = document.getElementById(`stat-${tid}`).value;
        const comm = document.getElementById(`comm-${tid}`).value.trim();
        const cdate = document.getElementById(`cdate-${tid}`).value;
        
        if (stat === 'Done' && !cdate) return alert("Please provide a Completion Date.");
        
        const userSnap = await getDoc(doc(db, "users", auth.currentUser.email));
        const memberData = userSnap.data();
        
        const tDoc = await getDoc(doc(db, "tasks", tid));
        const t = tDoc.data();
        
        let payload = { status: stat, completionDate: cdate };
        
        if (comm) {
            const note = { date: new Date().toLocaleString(), text: comm };
            payload.commentHistory = t.commentHistory ? [...t.commentHistory, note] : [note];
        }
        
        await updateDoc(doc(db, "tasks", tid), payload);
        
        // Notify Admin
        await addDoc(collection(db, "notifications"), { 
            forEmail: memberData.adminEmail, 
            fromEmail: auth.currentUser.email, 
            message: `${memberData.name} updated task "${t.description}" to ${stat}`, 
            timestamp: Date.now(), 
            read: false 
        });
        
        alert("Task updated successfully!");
    } catch (e) { 
        alert("Error: " + e.message); 
    }
};

window.updateMemberProfile = async () => {
    try {
        await updateDoc(doc(db, "users", auth.currentUser.email), { 
            phone: document.getElementById('mp-phone').value, 
            residentialAddress: document.getElementById('mp-address').value,
            emergencyName: document.getElementById('mp-em-name').value,
            emergencyPhone: document.getElementById('mp-em-num').value 
        });
        alert("Profile Updated!");
    } catch (e) {
        alert("Error updating profile: " + e.message);
    }
};

// --- NOTIFICATIONS & BOOKMARKS ---

// FIXED: Added missing toggleBookmark function for members
window.toggleBookmark = (id, cur) => {
    updateDoc(doc(db, "notifications", id), { bookmarked: !cur });
};

function loadMemberNotifications(email) {
    onSnapshot(query(collection(db, "notifications"), where("forEmail", "==", email)), (snap) => {
        const tb = document.getElementById('member-notif-table-body'); 
        if (!tb) return;
        
        tb.innerHTML = '';
        let docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
        docs.sort((a, b) => b.timestamp - a.timestamp);
        
        const hasUnread = docs.some(n => !n.read);
        const dot = document.getElementById('member-notif-dot');
        if(dot) hasUnread ? dot.classList.remove('hidden') : dot.classList.add('hidden');
        
        docs.forEach(n => {
            tb.innerHTML += `<tr style="background:${n.read?'transparent':'rgba(37,99,235,0.05)'}"><td>${n.message}<br><small>${new Date(n.timestamp).toLocaleString()}</small></td><td><button onclick="toggleBookmark('${n.id}', ${n.bookmarked})">${n.bookmarked ? '⭐' : '☆'}</button></td></tr>`;
        });
    });
}

window.markAllMemberNotificationsRead = async () => {
    const snap = await getDocs(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email), where("read", "==", false)));
    snap.forEach(d => updateDoc(doc(db, "notifications", d.id), { read: true }));
};

window.deleteMemberNotifications = async () => {
    if(confirm("Delete all alerts?")) {
        const snap = await getDocs(query(collection(db, "notifications"), where("forEmail", "==", auth.currentUser.email), where("bookmarked", "==", false)));
        snap.forEach(d => deleteDoc(doc(db, "notifications", d.id)));
    }
};
