// js/walkthrough.js

let currentStep = 0;

const adminSteps = [
    {
        title: "1. Create a Team",
        text: "Start by creating a Team (e.g., 'Marketing' or 'Dev'). Teams help organize your members.",
        action: () => navTo('sub3')
    },
    {
        title: "2. Add Members",
        text: "<b>CRITICAL:</b> Use real email IDs. Members will receive an <b>activation link</b>. You MUST copy and save the <b>temporary password</b> shown in the popup to give to them.",
        action: () => navTo('sub4')
    },
    {
        title: "3. Create Project",
        text: "Define your Project and set the final deadline. This is the master container for all your sprints.",
        action: () => navTo('sub1')
    },
    {
        title: "4. Create Tasks",
        text: "Break your project down into specific tasks. Add clear instructions for your team.",
        action: () => navTo('sub2')
    },
    {
        title: "5. Allocate Tasks",
        text: "Assign tasks to specific members and set their individual deadlines. Deadlines are tracked automatically.",
        action: () => navTo('sub5')
    },
    {
        title: "6. Track Analytics",
        text: "Monitor progress bars and team workloads here to ensure the project stays on schedule.",
        action: () => navTo('sub6')
    },
    {
        title: "7. Notifications & Profile",
        text: "Use the top bar to check alerts or update your workspace settings (Company name, theme, etc.).",
        action: () => navTo('sub8')
    }
];

const memberSteps = [
    {
        title: "1. Your Dashboard",
        text: "View all tasks assigned to you. Click the status dropdown to move tasks to WIP or Done.",
        action: () => navToMember('m-sub1')
    },
    {
        title: "2. Task Updates",
        text: "When marking a task as 'Done', you must provide a completion date for accurate tracking.",
        action: () => navToMember('m-sub1')
    },
    {
        title: "3. Notifications",
        text: "Check the 🔔 Alerts for new assignments or overdue reminders sent by your admin.",
        action: () => navToMember('m-sub3')
    },
    {
        title: "4. Task History",
        text: "Completed tasks are safely archived here for your records.",
        action: () => navToMember('m-sub4')
    },
    {
        title: "5. My Profile",
        text: "Keep your contact info and emergency details up to date here.",
        action: () => navToMember('m-sub2')
    }
];

window.toggleWalkthrough = () => {
    const modal = document.getElementById('walkthrough-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) renderStep();
};

window.nextStep = () => {
    const steps = document.getElementById('admin-view').classList.contains('hidden') ? memberSteps : adminSteps;
    currentStep = (currentStep + 1) % steps.length;
    renderStep();
};

function renderStep() {
    const isAdmin = !document.getElementById('admin-view').classList.contains('hidden');
    const steps = isAdmin ? adminSteps : memberSteps;
    const step = steps[currentStep];

    document.getElementById('wt-title').innerText = step.title;
    document.getElementById('wt-text').innerHTML = step.text;
    document.getElementById('wt-progress').innerText = `Step ${currentStep + 1} of ${steps.length}`;
    
    // Auto-navigate the user to the correct page
    step.action();
}