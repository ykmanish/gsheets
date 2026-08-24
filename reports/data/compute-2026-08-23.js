#!/usr/bin/env node
const fs = require("fs");

const RAW_PATH = "C:/Users/my792/.claude/projects/C--Users-my792-Desktop-raga/72e73c96-2032-445d-a900-d5b5620e5c9c/tool-results/mcp-raga-mongo-find-1787477248556.txt";
const TODAY = "2026-08-23";
const TODAY_LABEL = "Sunday 23 August 2026";

const usersMap = {
  "6a3e813fb562f2ddb8481f0e": "Shankar Suthar",
  "6a464ef1b6542a18d0f73fb4": "Chirag Gajjar",
  "6a46514eb6542a18d0f73fbf": "Nishi Mehta",
  "6a3e812db562f2ddb8481f0d": "Arshi Odedra",
  "6a465126b6542a18d0f73fbe": "Nayna Leva",
  "6a3e8107b562f2ddb8481f0b": "Prakash Lohar",
  "6a3e81ecb562f2ddb8481f0f": "Iqbal Patel",
  "6a464d06b6542a18d0f73fac": "Dhwani Singh",
  "6a3e80d3b562f2ddb8481f09": "Jay Panchal",
  "6a464dccb6542a18d0f73faf": "Milind Chaurasiya",
  "6a46518db6542a18d0f73fc0": "Neelam Verma",
  "6a30f59093d1b8cdb26dce38": "Super Admin",
  "6a464d56b6542a18d0f73fad": "Shruti Vaidya",
  "6a464d8eb6542a18d0f73fae": "Dipak Patel",
  "6a4650afb6542a18d0f73fbc": "Kamil Dave",
  "6a464f9db6542a18d0f73fb7": "Rajan Patel",
  "6a44bc5d8f389c1c08feb924": "Miti",
  "6a464e51b6542a18d0f73fb1": "Namrata Pathak",
  "6a464e0cb6542a18d0f73fb0": "Krupali Lathia",
  "6a464f2cb6542a18d0f73fb5": "Sanjay Sharma",
  "6a3e80f0b562f2ddb8481f0a": "Jay Suthar",
  "6a465050b6542a18d0f73fba": "Rhythm Nahar",
  "6a3e811bb562f2ddb8481f0c": "Hitesh Mistry",
  "6a464eb1b6542a18d0f73fb3": "Ayushi Choray",
  "6a465018b6542a18d0f73fb9": "Jash Thakkar",
  "6a4cdb25cd7a1203aa31600c": "Devang Shah",
  "6a33bdfa597e964faac131b6": "SuperAdmin",
  "6a464fe0b6542a18d0f73fb8": "Bhavesh Rathod",
  "6a4650efb6542a18d0f73fbd": "Kanan Soni",
  "6a466516a96004fda93e80b3": "Manish Yadav",
};

function assigneeName(id) {
  if (!id) return "unassigned";
  return usersMap[id] || "unassigned";
}

function daysBetween(dueStr, todayStr) {
  const d1 = new Date(dueStr + "T00:00:00Z");
  const d2 = new Date(todayStr + "T00:00:00Z");
  return Math.round((d2 - d1) / 86400000);
}

const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf8"));
const doc = raw.documents[0];
const projects = doc.config.projects;

const kpi = { startingToday: 0, delayed: 0, pastTarget: 0 };
const totals = { items: 0, done: 0, tasks: 0, tasksDone: 0, subtasks: 0, subtasksDone: 0 };
const projOut = [];
const startingToday = [];
let delayedList = []; // per project, will concat in project order
const assigneeMap = new Map(); // name -> {count, maxDays, projects:Set}
let delayedKeyCounter = 1;

for (const proj of projects) {
  const pName = proj.name;
  const pTarget = proj.targetDate || "";
  const pPastTarget = proj.status === "active" && pTarget !== "" && pTarget < TODAY;
  if (pPastTarget) kpi.pastTarget++;

  let pTasksTotal = 0, pTasksDone = 0, pSubTotal = 0, pSubDone = 0, pDelayed = 0;
  const pDelayedItems = [];

  for (const phase of proj.phases || []) {
    for (const task of phase.tasks || []) {
      pTasksTotal++;
      totals.tasks++;
      totals.items++;
      const taskDone = task.status === "done";
      if (taskDone) { pTasksDone++; totals.tasksDone++; totals.done++; }

      // starting today (task level)
      if (task.startDate === TODAY) {
        startingToday.push({
          project: pName,
          phase: phase.name,
          parent: "",
          title: task.title,
          description: task.description || "",
          start: task.startDate,
          due: task.dueDate || "",
          assignee: (task.assigneeIds && task.assigneeIds[0]) ? assigneeName(task.assigneeIds[0]) : "unassigned",
        });
      }

      // delayed (task level)
      const taskDue = task.dueDate || "";
      if (!taskDone && taskDue !== "" && taskDue < TODAY) {
        pDelayed++;
        const assignee = (task.assigneeIds && task.assigneeIds[0]) ? assigneeName(task.assigneeIds[0]) : "unassigned";
        const dl = daysBetween(taskDue, TODAY);
        const item = {
          key: "d" + (delayedKeyCounter++),
          project: pName,
          phase: phase.name,
          parent: "",
          title: task.title,
          due: taskDue,
          daysLate: dl,
          assignee,
          status: task.status,
          priority: task.priority || "",
          note: task.description || "",
        };
        pDelayedItems.push(item);
        const rec = assigneeMap.get(assignee) || { name: assignee, count: 0, maxDays: 0, projects: new Set() };
        rec.count++;
        rec.maxDays = Math.max(rec.maxDays, dl);
        rec.projects.add(pName);
        assigneeMap.set(assignee, rec);
      }

      for (const sub of task.subtasks || []) {
        pSubTotal++;
        totals.subtasks++;
        totals.items++;
        const subDone = sub.done === true;
        if (subDone) { pSubDone++; totals.subtasksDone++; totals.done++; }

        if (sub.startDate === TODAY) {
          startingToday.push({
            project: pName,
            phase: phase.name,
            parent: task.title,
            title: sub.title,
            description: sub.description || "",
            start: sub.startDate,
            due: sub.dueDate || "",
            assignee: assigneeName(sub.assigneeId),
          });
        }

        const subDue = sub.dueDate || "";
        if (!subDone && subDue !== "" && subDue < TODAY) {
          pDelayed++;
          const assignee = assigneeName(sub.assigneeId);
          const dl = daysBetween(subDue, TODAY);
          const item = {
            key: "d" + (delayedKeyCounter++),
            project: pName,
            phase: phase.name,
            parent: task.title,
            title: sub.title,
            due: subDue,
            daysLate: dl,
            assignee,
            status: "subtask, not done",
            priority: "",
            note: sub.description || "",
          };
          pDelayedItems.push(item);
          const rec = assigneeMap.get(assignee) || { name: assignee, count: 0, maxDays: 0, projects: new Set() };
          rec.count++;
          rec.maxDays = Math.max(rec.maxDays, dl);
          rec.projects.add(pName);
          assigneeMap.set(assignee, rec);
        }
      }
    }
  }

  kpi.delayed += pDelayed;
  // sort this project's delayed items by daysLate desc, keep contiguous per project
  pDelayedItems.sort((a, b) => b.daysLate - a.daysLate);
  delayedList.push(...pDelayedItems);

  projOut.push({
    name: pName,
    code: proj.code || "",
    manager: proj.manager || "",
    health: proj.health || "",
    target: pTarget,
    pastTarget: pPastTarget,
    phases: (proj.phases || []).length,
    tasks: { total: pTasksTotal, done: pTasksDone },
    subtasks: { total: pSubTotal, done: pSubDone },
    delayed: pDelayed,
  });
}

kpi.startingToday = startingToday.length;

// re-number delayed keys sequentially now that they're grouped by project (already sorted per-project then concatenated in project order)
delayedList = delayedList.map((it, i) => ({ ...it, key: "d" + (i + 1) }));

// re-sort project order: keep original project order as given (already project-contiguous by construction)

const assigneeLoad = Array.from(assigneeMap.values())
  .map((r) => ({ name: r.name, count: r.count, maxDays: r.maxDays, projects: Array.from(r.projects) }))
  .sort((a, b) => (b.count - a.count) || (b.maxDays - a.maxDays));

// starting-today numbering with keys k1..
const startingTodayOut = startingToday.map((it, i) => ({ key: "k" + (i + 1), ...it }));

const worst = delayedList[0];
const pastTargetProjects = projOut.filter((p) => p.pastTarget).map((p) => p.name);

const kpiOut = {
  startingToday: kpi.startingToday,
  startingTodayFoot: kpi.startingToday === 0 ? "nothing scheduled to start today" : `${kpi.startingToday} item(s) scheduled to start today`,
  delayed: kpi.delayed,
  delayedFoot: kpi.delayed === 0 ? "no overdue items" : `${kpi.delayed} overdue item(s), worst ${worst.daysLate} days late (${worst.project})`,
  pastTarget: pastTargetProjects.length,
  pastTargetFoot: pastTargetProjects.length === 0 ? "no active project past its target date" : pastTargetProjects.join(", "),
};

// ---- notes ----
const notes = [];

// note: heaviest overdue project
const worstProj = [...projOut].sort((a, b) => b.delayed - a.delayed)[0];
if (worstProj && worstProj.delayed > 0) {
  notes.push(`<b>${worstProj.name}</b> carries the heaviest overdue load with ${worstProj.delayed} item(s) behind schedule.`);
}

// note: health color contradicting dates (green/yellow but past target or heavily delayed)
for (const p of projOut) {
  if ((p.health === "green" || p.health === "yellow") && p.pastTarget) {
    notes.push(`${p.name} is marked health <b>${p.health}</b> yet is ${daysBetween(p.target, TODAY)} days past its ${p.target} target — the colour doesn't reflect the schedule.`);
  }
}

// note: in_progress but weeks late
const inProgressLate = delayedList.filter((d) => d.status === "in_progress" && d.daysLate >= 14);
if (inProgressLate.length) {
  const top = inProgressLate[0];
  notes.push(`${inProgressLate.length} item(s) are still marked <code>in_progress</code> despite being 2+ weeks late — worst is <code>${top.title}</code> on ${top.project}, ${top.daysLate} days late.`);
}

// note: assignee most exposed
if (assigneeLoad.length && assigneeLoad[0].name !== "unassigned") {
  const top = assigneeLoad[0];
  notes.push(`${top.name} is the most exposed assignee with ${top.count} overdue item(s) across ${top.projects.join(", ")}, up to ${top.maxDays} days late.`);
} else if (assigneeLoad.length) {
  notes.push(`${assigneeLoad[0].count} overdue item(s) are unassigned, up to ${assigneeLoad[0].maxDays} days late.`);
}

// note: projects past target still active
if (pastTargetProjects.length) {
  notes.push(`${pastTargetProjects.join(" and ")} ${pastTargetProjects.length > 1 ? "are" : "is"} past target date and still marked <b>active</b>.`);
}

// note: no due date items (can never be flagged)
let noDueTaskCount = 0, noDueSubCount = 0;
for (const proj of projects) {
  for (const phase of proj.phases || []) {
    for (const task of phase.tasks || []) {
      if (task.status !== "done" && (!task.dueDate || task.dueDate === "")) noDueTaskCount++;
      for (const sub of task.subtasks || []) {
        if (sub.done !== true && (!sub.dueDate || sub.dueDate === "")) noDueSubCount++;
      }
    }
  }
}
if (noDueTaskCount + noDueSubCount > 0) {
  notes.push(`${noDueTaskCount + noDueSubCount} open item(s) (${noDueTaskCount} tasks, ${noDueSubCount} subtasks) carry no due date and therefore can never be flagged as delayed.`);
}

// note: phases with zero completions (project-level, has tasks but 0 done)
const zeroCompletionProjects = projOut.filter((p) => (p.tasks.total + p.subtasks.total) > 0 && p.tasks.done === 0 && p.subtasks.done === 0);
if (zeroCompletionProjects.length) {
  notes.push(`${zeroCompletionProjects.map((p) => p.name).join(", ")} ${zeroCompletionProjects.length > 1 ? "have" : "has"} zero completed tasks or subtasks so far.`);
}

// note: no target date set at all (can never be past-target)
const noTargetProjects = projOut.filter((p) => p.target === "" && p.delayed > 0);
if (noTargetProjects.length) {
  notes.push(`${noTargetProjects.map((p) => p.name).join(", ")} ${noTargetProjects.length > 1 ? "have" : "has"} no project target date set at all, so ${noTargetProjects.length > 1 ? "they" : "it"} can never be flagged past-target even with overdue items.`);
}

const output = {
  reportDate: TODAY,
  reportDateLabel: TODAY_LABEL,
  generatedAt: TODAY + " 00:00 IST",
  kpi: kpiOut,
  totals,
  projects: projOut,
  startingToday: startingTodayOut,
  delayed: delayedList,
  assigneeLoad,
  notes: notes.slice(0, 7),
};

fs.writeFileSync("C:/Users/my792/Desktop/raga/reports/data/project-data-2026-08-23.json", JSON.stringify(output, null, 2), "utf8");
console.log("wrote project-data-2026-08-23.json");
console.log(JSON.stringify(kpiOut, null, 2));
console.log("totals:", JSON.stringify(totals));
