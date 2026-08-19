import { NEEDS_INPUT } from "./changeNavigator.ts";
import type { Assessment, Intake } from "./changeNavigator.ts";

export type PlaybookAction = {
  id: string;
  do: string;
  who: string;
  use: string;
  create: string;
  when: string;
  why: string;
  doneWhen: string;
  owner: string;
  status: string;
  confirmation: string;
  humanReview: string;
  completed: boolean;
  details?: Record<string, string>;
};

export type ControlType = "text" | "textarea" | "date" | "status" | "yes-no" | "select" | "multi-select" | "person";
export type PlaybookColumn = {
  key: string;
  label: string;
  width?: "small" | "medium" | "large";
  required?: boolean;
  control?: ControlType;
  options?: string[];
  helper?: string;
};
export type PlaybookTable = { id: string; label: string; columns: PlaybookColumn[]; rows: Array<Record<string, string>> };
export type PhaseInstructions = {
  purpose: string;
  whatToDo: string;
  whereToEnter: string;
  requiredInputs: string;
  completionCriteria: string;
  example: string;
};
export type PlaybookPhase = {
  id: string;
  number: number;
  title: string;
  purpose: string;
  source: string;
  actions: PlaybookAction[];
  tables?: PlaybookTable[];
  checklist?: string[];
  instructions: PhaseInstructions;
};

const suggested = "Suggested — confirm with Communications";
const value = (text?: string) => text?.trim() || NEEDS_INPUT;
const list = (text: string) => [...new Set(text.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))];
const status = "Not started";
export const STATUS_OPTIONS = ["Not started", "In progress", "On hold", "Complete"];
export const IMPACT_OPTIONS = [
  "1 – Minimal", "2 – Low", "3 – Moderate", "4 – High", "5 – Critical",
];
export const IMPACT_DEFINITIONS = [
  "1 – Minimal: Limited to a small number of people; little or no process, behavior, or system change.",
  "2 – Low: Affects one team or a narrow process; limited support is required.",
  "3 – Moderate: Affects several teams or requires meaningful changes to process, behavior, or tools.",
  "4 – High: Affects a large employee group, multiple functions, or a critical process; substantial preparation and support are required.",
  "5 – Critical: Enterprise-wide or high-risk change with major operational, compliance, workforce, or leadership implications.",
];
const IMPACT_TYPES = ["Process", "Technology", "Role", "Policy", "Behavior", "Skills", "Organization", "Other"];
const CHANNELS = ["Leader meeting", "Manager cascade", "Team meeting", "Email", "Slack", "FAQ", "Job aid", "Training", "Office hours", "Intranet or internal page", "Other"];
const SUPPORT_MATERIALS = ["Leader brief", "Manager talking points", "FAQ", "Team discussion guide", "Job aid", "Training", "Reminder message", "Feedback survey", "Other"];

const instruction = (purpose: string, whatToDo: string, whereToEnter: string, requiredInputs: string, completionCriteria: string, example: string): PhaseInstructions => ({ purpose, whatToDo, whereToEnter, requiredInputs, completionCriteria, example });

function action(id: string, fields: Partial<PlaybookAction> & Pick<PlaybookAction, "do" | "why" | "doneWhen">): PlaybookAction {
  return {
    id,
    do: fields.do,
    who: fields.who ?? NEEDS_INPUT,
    use: fields.use ?? "Working session",
    create: fields.create ?? "Decision or completed action",
    when: fields.when ?? NEEDS_INPUT,
    why: fields.why,
    doneWhen: fields.doneWhen,
    owner: fields.owner ?? NEEDS_INPUT,
    status: fields.status ?? status,
    confirmation: fields.confirmation ?? NEEDS_INPUT,
    humanReview: fields.humanReview ?? "No — confirm before use",
    completed: false,
    details: fields.details,
  };
}

export function makePlaybook(intake: Intake, assessment: Assessment): PlaybookPhase[] {
  const audiences = list(intake.audiences).length ? list(intake.audiences) : [NEEDS_INPUT];
  const change = value(intake.changeSummary);
  const outcome = value(intake.outcome);
  const timing = value(intake.timing);
  const readiness = value(intake.readiness);
  const sensitivity = value(intake.sensitivities);
  const text = Object.values(intake).join(" ").toLowerCase();
  const isSmall = assessment.size === "XS" || assessment.size === "S";
  const isLarge = assessment.size === "L" || assessment.size === "XL";
  const managerImpact = /manager|leader|supervisor/.test(text);
  const trainingNeeded = /training|learn|skill|workflow|system|tool|platform|process|procedure|migration/.test(text) && assessment.size !== "XS";
  const governed = /legal|privacy|compliance|external|media|customer-facing|customer facing| ai |artificial intelligence|staffing|headcount|job security/.test(` ${text} `);
  const source = intake.externalEvidence
    ? "Uploaded document + user-reviewed connected-source evidence"
    : "Uploaded document";
  const audienceRows = audiences.map((audience) => ({
    audience, effect: NEEDS_INPUT, impact: NEEDS_INPUT, know: change, feel: NEEDS_INPUT,
    do: NEEDS_INPUT, concerns: NEEDS_INPUT, support: NEEDS_INPUT,
  }));
  const stakeholderRows = [
    { stakeholder: NEEDS_INPUT, role: "Accountable sponsor", influence: "High", currentSupport: NEEDS_INPUT, desiredSupport: "Active", need: "Confirm direction and visibly support the change", approach: `${suggested}: sponsor alignment`, owner: NEEDS_INPUT },
    ...(!isSmall ? [{ stakeholder: NEEDS_INPUT, role: "Operational owner", influence: "High", currentSupport: NEEDS_INPUT, desiredSupport: "Active", need: "Confirm operational readiness", approach: "Readiness review", owner: NEEDS_INPUT }] : []),
    ...(isLarge || governed ? [{ stakeholder: NEEDS_INPUT, role: "Required reviewer", influence: "High", currentSupport: NEEDS_INPUT, desiredSupport: "Approve or advise", need: "Review sensitive claims and sequencing", approach: "Targeted review", owner: NEEDS_INPUT }] : []),
  ];

  const leaderActions = [
    action("align-leaders", { do: "Align the accountable leader on the change, outcome, and risks", who: "Accountable leader", use: "Leader alignment meeting", create: "Leader brief", when: `Before the first communication; target window: ${timing}`, why: "Leaders need one clear story before others hear about the change.", doneWhen: "The leader confirms the change, boundaries, and decisions still open." }),
    action("confirm-sender", { do: "Confirm who will introduce the change", who: audiences.join(", "), use: `${suggested}: leader-led message`, create: "Named sender and channel decision", when: "Before communication materials are finalized", why: "The right sender builds trust and makes accountability clear.", doneWhen: "The sender accepts the role and the channel is confirmed." }),
    ...(!isSmall || managerImpact ? [
      action("manager-brief", { do: "Prepare managers before they speak with their teams", who: "People managers", use: `${suggested}: manager briefing`, create: "Manager talking points and team discussion guide", when: "Before the manager cascade", why: "Managers need answers and a safe way to raise concerns.", doneWhen: "Managers have the talking points, discussion questions, and escalation path." }),
      action("feedback-path", { do: "Set a feedback and escalation path", who: "Managers and affected teams", use: "Named feedback channel", create: "Issue-routing instructions", when: "Before launch", why: "Questions need an owner and a response path.", doneWhen: "An owner, response expectation, and escalation route are published." }),
    ] : []),
  ];
  leaderActions.forEach((item) => {
    item.details = {
      audience: item.who,
      know: `${change}\n\nWhy it matters: ${outcome}`,
      leaderDo: item.do,
      messages: item.create.includes("talking points") ? `What’s new: ${change}\nWhy it matters: ${outcome}\nWhat this means for the team: ${NEEDS_INPUT}` : NEEDS_INPUT,
      materials: item.create,
      channel: item.use,
      notes: item.confirmation,
    };
  });

  const communicationRows: Array<Record<string, string>> = [
    ...(!isSmall ? [{ sequence: "1", audience: "Leaders and key stakeholders", purpose: "Align before broader communication", message: `What’s changing: ${change}\nWhy it matters: ${outcome}`, sender: NEEDS_INPUT, channel: `${suggested}: leader meeting`, timing: "Before broader communication", frequency: "Once, with follow-up as needed", cta: "Confirm readiness and open decisions", material: "Leader brief", owner: NEEDS_INPUT, status, review: governed ? "Yes" : "Confirm", rationale: "A live discussion allows questions before the message expands." }] : []),
    ...audiences.map((audience, index) => ({ sequence: String(index + (isSmall ? 1 : 2)), audience, purpose: "Explain the change and the expected action", message: `What’s new: ${change}\nWhy it matters: ${outcome}`, sender: NEEDS_INPUT, channel: `${suggested}: ${managerImpact ? "team meeting" : "email or team meeting"}`, timing, frequency: "Initial message", cta: NEEDS_INPUT, material: isSmall ? "Short announcement" : "Announcement and FAQ", owner: NEEDS_INPUT, status, review: governed ? "Yes" : "Confirm", rationale: managerImpact ? "A team discussion lets managers explain local impact." : "Use one direct channel proportionate to the change." })),
    ...(!isSmall ? [{ sequence: String(audiences.length + 2), audience: audiences.join(", "), purpose: "Reinforce action and answer common questions", message: "Repeat the required action and address the questions people are asking.", sender: NEEDS_INPUT, channel: `${suggested}: follow-up message or office hours`, timing: "After the initial communication", frequency: "As evidence shows it is needed", cta: "Use the support path or complete the required action", material: "FAQ update or reminder", owner: NEEDS_INPUT, status, review: "Confirm", rationale: "Reinforcement should respond to real questions, not add noise." }] : []),
  ];

  const deliverableRows: Array<Record<string, string>> = [
    { deliverable: isSmall ? "Short announcement" : "Leader brief", why: isSmall ? "Give affected people the essential change and action." : "Align leaders before activation.", audience: isSmall ? audiences.join(", ") : "Leaders and key stakeholders", owner: NEEDS_INPUT, due: NEEDS_INPUT, status, available: `Change: ${change}; outcome: ${outcome}`, missing: "Approved sender, channel, and final timing", draft: `What’s new: ${change}\nWhy it matters: ${outcome}\nWhat to do: ${NEEDS_INPUT}` },
    ...(!isSmall ? [{ deliverable: "Manager talking points", why: "Help managers explain the change consistently.", audience: "People managers", owner: NEEDS_INPUT, due: NEEDS_INPUT, status, available: `Change: ${change}; outcome: ${outcome}; timing: ${timing}`, missing: "Local impact, expected action, escalation owner", draft: `1. What is changing: ${change}\n2. Why it matters: ${outcome}\n3. What this means for our team: ${NEEDS_INPUT}\n4. What happens next: ${timing}` }] : []),
    ...(isLarge || governed ? [{ deliverable: "FAQ", why: "Provide reviewed answers for sensitive or repeated questions.", audience: audiences.join(", "), owner: NEEDS_INPUT, due: NEEDS_INPUT, status, available: `Known sensitivities: ${sensitivity}`, missing: "Confirmed questions, approved answers, reviewer", draft: "Suggested outline: what is changing; why now; impact by audience; what is not changing; support; escalation." }] : []),
    ...(trainingNeeded ? [{ deliverable: "Job aid or training", why: "Help people perform the new task or behavior.", audience: audiences.join(", "), owner: NEEDS_INPUT, due: NEEDS_INPUT, status, available: change, missing: "Validated skill gap, delivery method, completion check", draft: "Suggested outline: task goal; steps; example; common errors; where to get help." }] : []),
  ];

  const peopleActions = [
    ...(trainingNeeded ? [action("prepare-training", { do: "Prepare role-relevant practice and support", who: audiences.join(", "), use: `${suggested}: guided practice or job aid`, create: "Training or job aid", when: "Before launch", why: "People need to be able to perform the new task, not only hear about it.", doneWhen: "Affected people can complete the task or pass a simple understanding check." })] : []),
    action("readiness-check", { do: "Check readiness before broad activation", who: "Leaders, managers, and affected groups", use: "Readiness review", create: "Readiness decision and open-issue list", when: "Before launch", why: "Reach should not expand until the change is ready to support.", doneWhen: `Owners confirm materials, support, and unresolved risks. Current evidence: ${readiness}` }),
    action("resistance-plan", { do: "Prepare for questions, friction, and resistance", who: audiences.join(", "), use: "Feedback and escalation path", create: "Issue log and response owner", when: "Before launch and during reinforcement", why: "Early signals help the team adjust before problems grow.", doneWhen: "Warning signs, response triggers, and an owner are documented.", humanReview: assessment.humanReview.length ? "Yes" : "Confirm" }),
    ...(!isSmall ? [action("manager-coaching", { do: "Coach managers on difficult questions", who: "People managers", use: "Manager Q&A or office hours", create: "Q&A notes and escalation reminders", when: "Before and immediately after launch", why: "Managers often hear concerns first.", doneWhen: "Managers know what they can answer and what they must escalate." })] : []),
  ];
  peopleActions.forEach((item) => {
    item.details = {
      audience: item.who,
      changing: change,
      know: outcome,
      audienceDo: item.do,
      support: item.create,
      channel: item.use,
      feedback: item.confirmation,
    };
  });

  const launchRows = [
    { period: "Before launch", action: "Confirm audience, owner, timing, sender, materials, support, and required reviews", owner: NEEDS_INPUT, date: NEEDS_INPUT, status, dependency: "Open decisions resolved", evidence: "Readiness decision" },
    { period: "Launch day / launch period", action: "Deliver the approved communication and make support available", owner: NEEDS_INPUT, date: timing, status, dependency: "Approved materials and ready support", evidence: "Sent message, meeting notes, or published material" },
    ...(!isSmall ? [{ period: "Immediately after launch", action: "Collect questions and resolve urgent friction", owner: NEEDS_INPUT, date: NEEDS_INPUT, status, dependency: "Feedback path active", evidence: "Issue log and owner responses" }] : []),
  ];

  return [
    { id: "understand", number: 1, title: "Understand the change", purpose: "Confirm the facts and close the most important gaps before planning activity.", source, instructions: instruction("Build a reliable foundation for the playbook.", "Identify the specific action or decision required to move this change forward.", "Enter it in Action or decision required, then assign the owner, target date, status, and dependencies.", "A concrete action or decision, owner, target date, and status.", "The action is specific, assigned, dated, and any dependency is recorded.", "Confirm the revised routing workflow and approve the October 12 launch decision."), actions: [
      action("confirm-change", { do: "Confirm the change, reason, outcome, behavior, dates, and constraints", who: "Change owner and accountable leader", use: "Source review", create: "Confirmed change summary", when: "First", why: "Every later action depends on a clear and accurate change story.", doneWhen: "The change owner confirms the summary and marks missing information for follow-up.", confirmation: `Change: ${change}\nWhy: ${outcome}\nExpected behavior: ${NEEDS_INPUT}\nDates: ${timing}\nConstraints: ${sensitivity}` }),
    ], checklist: ["The change and business outcome are clear", "Affected groups are named", "Expected employee behavior is defined", "Important dates and constraints are confirmed", "Missing information has an owner"] },
    { id: "people-involved", number: 2, title: "Identify who needs to be involved", purpose: "Name the affected groups and the people needed to make the change work.", source, instructions: instruction("Make the impact and involvement visible.", "Rate each audience’s impact and identify the stakeholders needed to support the change.", "Use the Audience impact entries and Stakeholder plan directly below.", "Impacted groups, impact rating, type and reason, review decision, stakeholders, and owners.", "Every impacted group has a defined rating and reason; required reviewers and stakeholder owners are identified.", "Customer Care — 3 Moderate — Process and Behavior — new routing steps require manager support."), actions: [], tables: [
      { id: "audiences", label: "Audience impact entries", columns: [{ key: "audience", label: "Impacted groups", required: true, control: "multi-select", options: audiences }, { key: "impact", label: "Impact level", width: "small", required: true, control: "select", options: IMPACT_OPTIONS, helper: IMPACT_DEFINITIONS.join("\n") }, { key: "impactType", label: "Type of impact", required: true, control: "multi-select", options: IMPACT_TYPES }, { key: "effect", label: "Reason for rating", width: "large", required: true, control: "textarea" }, { key: "know", label: "What they need to know", width: "large", required: true, control: "textarea" }, { key: "feel", label: "What they need to feel", control: "textarea" }, { key: "do", label: "What they need to do", width: "large", required: true, control: "textarea" }, { key: "concerns", label: "Likely concerns", width: "large", control: "textarea" }, { key: "support", label: "Support required", width: "large", control: "multi-select", options: SUPPORT_MATERIALS }, { key: "humanReview", label: "Human review required", required: true, control: "yes-no" }, { key: "reviewer", label: "Reviewer", control: "person", helper: "Required when Human review required is Yes." }, { key: "reviewDate", label: "Review date", control: "date" }, { key: "status", label: "Status", required: true, control: "status" }], rows: audienceRows.map((row) => ({ ...row, impactType: NEEDS_INPUT, humanReview: governed ? "Yes" : "No", reviewer: governed ? NEEDS_INPUT : "Not required", reviewDate: NEEDS_INPUT, status })) },
      { id: "stakeholders", label: "Stakeholder plan", columns: [{ key: "stakeholder", label: "Person or group", required: true, control: "person" }, { key: "role", label: "Role", required: true, control: "text" }, { key: "influence", label: "Influence", required: true, control: "select", options: ["Low", "Medium", "High"] }, { key: "currentSupport", label: "Current support", control: "select", options: ["Unknown", "Resistant", "Neutral", "Supportive", "Active"] }, { key: "desiredSupport", label: "Desired support", required: true, control: "select", options: ["Aware", "Supportive", "Active", "Decision maker"] }, { key: "need", label: "What we need", width: "large", required: true, control: "textarea" }, { key: "approach", label: "Engagement approach", width: "large", required: true, control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }], rows: stakeholderRows },
    ] },
    { id: "leaders", number: 3, title: "Prepare leaders and managers", purpose: "Equip the people who will explain, sponsor, and support the change.", source: "Change Navigation framework + source evidence", instructions: instruction("Give leaders the information and tools to lead consistently.", "Create one preparation entry for each leader or manager audience with different needs.", "Use the stacked Leader or manager preparation entries below; add another entry when needed.", "Audience, knowledge, required action, messages, materials, channel, owner, date, review decision, and status.", "The leader audience has an owner, date, usable messages and materials, and any required review is identified.", "People managers — explain the routing change in a team meeting using talking points and an FAQ."), actions: leaderActions },
    { id: "communications", number: 4, title: "Build the communication sequence", purpose: "Put the right messages in the right order without over-communicating.", source: "Source evidence + Echo guardrails + Smart Brevity + Chewy writing guidance", instructions: instruction("Create a clear communication order.", "Confirm each audience, message, sender, channel, timing, and call to action.", "Edit the Ordered communication sequence below.", "Sequence, audience, message, sender, channel, timing, material, owner, review decision, and status.", "Every row has a clear order, owner, date or dependency, and completion status.", "1 — Leaders — align on the change — leader meeting — owner assigned — Complete."), actions: [], tables: [{ id: "communications", label: "Ordered communication sequence", columns: [{ key: "sequence", label: "#", width: "small", required: true, control: "text" }, { key: "audience", label: "Audience", required: true, control: "multi-select", options: audiences }, { key: "purpose", label: "Purpose", width: "large", required: true, control: "textarea" }, { key: "message", label: "Key message", width: "large", required: true, control: "textarea" }, { key: "sender", label: "Recommended sender", required: true, control: "person" }, { key: "channel", label: "Recommended channel", required: true, control: "multi-select", options: CHANNELS }, { key: "timing", label: "Target date", required: true, control: "date" }, { key: "frequency", label: "Frequency", control: "select", options: ["One time", "Weekly", "Monthly", "At milestone", "As needed"] }, { key: "cta", label: "Call to action", width: "large", required: true, control: "textarea" }, { key: "material", label: "Material to create", control: "multi-select", options: SUPPORT_MATERIALS }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "review", label: "Human review", required: true, control: "yes-no" }, { key: "rationale", label: "Why recommended", width: "large", control: "textarea" }], rows: communicationRows }] },
    { id: "materials", number: 5, title: "Prepare the materials", purpose: "Create only the items this change needs, using supported facts and clearly marked suggestions.", source, instructions: instruction("Turn the plan into usable materials.", "Confirm which deliverables are needed, assign them, and complete the missing content.", "Use the Deliverables checklist below.", "Deliverable, audience, owner, due date, status, supported content, and missing information.", "Each required deliverable has an owner, due date, status, and enough information to draft or complete it.", "Manager talking points — People managers — owner assigned — due October 5 — In progress."), actions: [], tables: [{ id: "deliverables", label: "Deliverables checklist", columns: [{ key: "deliverable", label: "Deliverable", required: true, control: "select", options: SUPPORT_MATERIALS }, { key: "why", label: "Why needed", width: "large", required: true, control: "textarea" }, { key: "audience", label: "Audience", required: true, control: "multi-select", options: audiences }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "due", label: "Due date", required: true, control: "date" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "available", label: "Source-supported content", width: "large", control: "textarea" }, { key: "missing", label: "Needs user input", width: "large", control: "textarea" }, { key: "draft", label: "Suggested language / outline", width: "large", control: "textarea" }], rows: deliverableRows }] },
    { id: "readiness", number: 6, title: "Prepare people for the change", purpose: "Make sure people can act, get help, and raise issues safely.", source: "Source evidence + Risk Signal & Readiness Gate", instructions: instruction("Prepare each audience to understand and use the change.", "Create one entry for every audience that needs different communication, training, or support.", "Use the stacked Audience preparation entries below; add another entry when needed.", "Audience, change, knowledge, action, support, channel, owner, completion date, review decision, status, and feedback path.", "Each affected audience has a complete, assigned, dated preparation entry.", "Customer Care — learn the new routing steps — job aid and guided practice — owner assigned — due October 10."), actions: peopleActions },
    { id: "launch", number: 7, title: "Launch", purpose: "Move through launch in order and keep proof that each gate is ready.", source, instructions: instruction("Execute the approved plan in order.", "Confirm each launch action, dependency, owner, date, and evidence of completion.", "Use the Chronological launch checklist below.", "Period, action, owner, target date, status, dependency, and evidence.", "Every relevant launch action has an owner, date, status, and proof requirement.", "Before launch — confirm materials and support — owner assigned — October 10 — Complete."), actions: [], tables: [{ id: "launch", label: "Chronological launch checklist", columns: [{ key: "period", label: "Period", required: true, control: "select", options: ["Before launch", "Launch day / launch period", "Immediately after launch"] }, { key: "action", label: "Action", width: "large", required: true, control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "date", label: "Target date", required: true, control: "date" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "dependency", label: "Dependency", width: "large", control: "textarea" }, { key: "evidence", label: "Evidence required", width: "large", required: true, control: "textarea" }], rows: launchRows }] },
    { id: "reinforce", number: 8, title: "Reinforce and measure", purpose: "Use practical evidence to see what is working and decide what to do next.", source: "Source evidence + Change Navigation framework", instructions: instruction("Define how success will be measured and what happens when results fall short.", "Create a measure with a baseline, target, data source, owner, review date, and reinforcement action.", "Use the Measurement and reinforcement entries below.", "Measure, type, baseline, target, data source, frequency, reinforcement, owner, review date, review decision, and status.", "A measure is complete only when baseline, target, data source, owner, and review date are defined.", "Routing accuracy — Quality — baseline 82% — target 95% — weekly dashboard — review November 1."), actions: [], tables: [{ id: "measures", label: "Measurement and reinforcement entries", columns: [{ key: "measure", label: "Measure name", required: true, control: "text" }, { key: "measureType", label: "Measure type", required: true, control: "select", options: ["Adoption", "Usage", "Proficiency", "Sentiment", "Quality", "Risk", "Business outcome", "Other"] }, { key: "baseline", label: "Baseline", required: true, control: "text" }, { key: "target", label: "Target", required: true, control: "text" }, { key: "current", label: "Current result", control: "text" }, { key: "dataSource", label: "Data source", required: true, control: "text" }, { key: "frequency", label: "Measurement frequency", required: true, control: "select", options: ["Weekly", "Monthly", "Quarterly", "At milestone", "One time"] }, { key: "reinforcement", label: "Reinforcement action", width: "large", control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "reviewDate", label: "Next review date", required: true, control: "date" }, { key: "humanReview", label: "Human review required", required: true, control: "yes-no" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "findings", label: "Findings and next steps", width: "large", control: "textarea" }], rows: [{ measure: "Adoption of the expected behavior", measureType: "Adoption", baseline: NEEDS_INPUT, target: NEEDS_INPUT, current: NEEDS_INPUT, dataSource: NEEDS_INPUT, frequency: isSmall ? "At milestone" : "Weekly", reinforcement: isSmall ? "Follow up through the manager if adoption is unclear." : "Use feedback and adoption gaps to choose a targeted reminder, FAQ update, or coaching action.", owner: NEEDS_INPUT, reviewDate: NEEDS_INPUT, humanReview: governed ? "Yes" : "No", status, findings: NEEDS_INPUT }] }] },
  ];
}

export function nextActions(phases: PlaybookPhase[]) {
  return phases.flatMap((phase) => phase.actions.map((item) => ({ phase: phase.title, ...item })))
    .filter((item) => !item.completed && item.status.toLowerCase() !== "complete")
    .slice(0, 3);
}

export function playbookWritingChecks(phases: PlaybookPhase[]) {
  const text = JSON.stringify(phases);
  return [
    { label: "Suggestions clearly labeled", status: text.includes("Suggested — confirm with Communications") ? "pass" as const : "review" as const },
    { label: "Missing facts labeled", status: text.includes(NEEDS_INPUT) ? "pass" as const : "review" as const },
    { label: "No pet puns or hype", status: /paw-some|purrfect|game-changing|revolutionary/i.test(text) ? "review" as const : "pass" as const },
    { label: "Human-review gates retained", status: phases.some((phase) => phase.actions.some((item) => item.humanReview === "Yes")) ? "pass" as const : "review" as const },
    { label: "Names, dates, channels, and approvals verified", status: "review" as const },
  ];
}

export function serializePlaybook(projectName: string, phases: PlaybookPhase[]) {
  const lines = [projectName || "Change activation playbook", "Working implementation guide — human review required", "", "START HERE — YOUR NEXT 3 ACTIONS"];
  nextActions(phases).forEach((item, index) => lines.push(`${index + 1}. ${item.do} (${item.phase})`));
  lines.push("");
  for (const phase of phases) {
    lines.push(`PHASE ${phase.number} — ${phase.title.toUpperCase()}`, phase.purpose, `Grounded in: ${phase.source}`, "");
    lines.push("INSTRUCTIONS", `Purpose: ${phase.instructions.purpose}`, `What to do: ${phase.instructions.whatToDo}`, `Where to enter it: ${phase.instructions.whereToEnter}`, `Required inputs: ${phase.instructions.requiredInputs}`, `Completion criteria: ${phase.instructions.completionCriteria}`, `Example: ${phase.instructions.example}`, "");
    for (const item of phase.actions) {
      lines.push(`[${item.completed ? "x" : " "}] ${item.do}`, `WHO: ${item.who}`, `USE: ${item.use}`, `CREATE: ${item.create}`, `OWNER: ${item.owner}`, `WHEN: ${item.when}`, `WHY: ${item.why}`, `DONE WHEN: ${item.doneWhen}`, `STATUS: ${item.status}`, `CONFIRM: ${item.confirmation}`, `HUMAN REVIEW: ${item.humanReview}`, "");
      if (item.details) Object.entries(item.details).forEach(([key, detail]) => lines.push(`${key}: ${detail}`));
      if (item.details) lines.push("");
    }
    for (const table of phase.tables ?? []) {
      lines.push(table.label, table.columns.map((column) => column.label).join("\t"));
      table.rows.forEach((row) => lines.push(table.columns.map((column) => row[column.key] ?? "").join("\t")));
      lines.push("");
    }
    if (phase.checklist?.length) {
      lines.push("BEFORE YOU MOVE ON");
      phase.checklist.forEach((item) => lines.push(`[ ] ${item}`));
      lines.push("");
    }
    lines.push("----------------------------------------", "");
  }
  const open = phases.flatMap((phase) => [
    ...phase.actions.flatMap((item) => Object.entries(item).filter(([, itemValue]) => itemValue === NEEDS_INPUT).map(([key]) => `${phase.title}: ${item.do} — ${key}`)),
    ...(phase.tables ?? []).flatMap((table) => table.rows.flatMap((row, rowIndex) => Object.entries(row).filter(([, itemValue]) => itemValue === NEEDS_INPUT).map(([key]) => `${phase.title}: ${table.label} row ${rowIndex + 1} — ${key}`))),
  ]);
  lines.push("OPEN DECISIONS / NEEDS USER INPUT", ...open.map((item) => `- ${item}`));
  return lines.join("\n");
}
