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
  advanced?: boolean;
  reuse?: "audiences" | "stakeholders" | "owners" | "dates";
};
export type PlaybookTable = { id: string; label: string; description?: string; columns: PlaybookColumn[]; rows: Array<Record<string, string>> };
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
  icon?: string;
  color?: "spark" | "prepare" | "activate" | "sustain";
  focusAreas?: Array<{ id: string; title: string; description: string; usage?: string; actionIds?: string[]; tableIds?: string[] }>;
};

export type PrepareGenerationInputs = {
  sourceDocumentText?: string;
  connectorRequest?: string;
  evidencePack?: string;
  connectorSources?: string[];
  searchGuidance?: string;
};

const suggested = "Suggested — confirm with Communications";
const value = (text?: string) => text?.trim() || NEEDS_INPUT;
const list = (text: string) => [...new Set(text.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))];
const sourceLine = /^\s*(?:sources?|references?|links?|urls?)\s*:/i;
const urlPattern = /https?:\/\/[^\s)\]}]+/gi;
const cleanMessageText = (text: string) => text.split(/\r?\n/).filter((line) => !sourceLine.test(line)).join("\n").replace(urlPattern, "").replace(/[ \t]{2,}/g, " ").trim();
const referenceText = (...values: string[]) => {
  const references = values.flatMap((entry) => [
    ...(entry.match(urlPattern) ?? []),
    ...entry.split(/\r?\n/).filter((line) => sourceLine.test(line)).map((line) => line.replace(sourceLine, "").trim()),
  ]).filter(Boolean);
  return [...new Set(references)].join("\n");
};
const sparkSourceLine = /^\s*(?:sources?|references?|links?|urls?|documents?|citations?|evidence)\s*:/i;
export function separateSparkSources(text: string) {
  const references = [
    ...(text.match(urlPattern) ?? []),
    ...text.split(/\r?\n/).filter((line) => sparkSourceLine.test(line)).map((line) => line.replace(sparkSourceLine, "").trim()),
  ].filter(Boolean);
  const content = text
    .split(/\r?\n/)
    .filter((line) => !sparkSourceLine.test(line))
    .join("\n")
    .replace(urlPattern, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { content, references: [...new Set(references)].join("\n") };
}
export function collectProjectContext(intake: Intake, assessment: Assessment, inputs: PrepareGenerationInputs = {}) {
  const sourceDocumentText = inputs.sourceDocumentText?.trim() ?? "";
  const evidencePack = inputs.evidencePack?.trim() || intake.externalEvidence?.trim() || "";
  const connectorRequest = inputs.connectorRequest?.trim() ?? "";
  const connectorSources = inputs.connectorSources?.filter(Boolean) ?? [];
  const searchGuidance = inputs.searchGuidance?.trim() ?? "";
  const signalText = [
    intake.projectName, intake.changeSummary, intake.outcome, intake.audiences, intake.timing,
    intake.readiness, intake.sensitivities, intake.externalEvidence, intake.externalSources,
    sourceDocumentText, evidencePack, connectorRequest, connectorSources.join(", "), searchGuidance,
    assessment.primaryType, assessment.secondaryType, assessment.size, assessment.risks.join("; "),
    assessment.humanReview.join("; "),
  ].filter(Boolean).join("\n");
  return {
    projectName: value(intake.projectName),
    changeSummary: value(intake.changeSummary),
    outcome: value(intake.outcome),
    audiences: list(intake.audiences),
    timing: value(intake.timing),
    readiness: value(intake.readiness),
    sensitivities: value(intake.sensitivities),
    assessment,
    sourceDocumentText,
    evidencePack,
    connectorRequest,
    connectorSources,
    searchGuidance,
    sourceReferences: referenceText(intake.changeSummary, intake.outcome, intake.externalSources ?? "", sourceDocumentText, evidencePack),
    signalText,
  };
}
export const collectPrepareContext = collectProjectContext;
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
    who: fields.who ?? "Relevant Project Role or Audience — confirm",
    use: fields.use ?? "Working session",
    create: fields.create ?? "Decision or completed action",
    when: fields.when ?? "Suggested — confirm: Sequence this before the related launch or communication milestone",
    why: fields.why,
    doneWhen: fields.doneWhen,
    owner: fields.owner ?? "Change Owner — confirm name",
    status: fields.status ?? status,
    confirmation: fields.confirmation ?? "Confirm the recommendation, owner, timing, dependencies, and completion evidence.",
    humanReview: fields.humanReview ?? "No — confirm before use",
    completed: false,
    details: fields.details,
  };
}

function makeDetailedPlaybook(intake: Intake, assessment: Assessment, generationInputs: PrepareGenerationInputs = {}): PlaybookPhase[] {
  const prepareContext = collectProjectContext(intake, assessment, generationInputs);
  const audiences = list(intake.audiences).length ? list(intake.audiences) : [NEEDS_INPUT];
  const change = value(intake.changeSummary);
  const outcome = value(intake.outcome);
  const timing = value(intake.timing);
  const readiness = value(intake.readiness);
  const sensitivity = value(intake.sensitivities);
  const text = prepareContext.signalText.toLowerCase();
  const isSmall = assessment.size === "XS" || assessment.size === "S";
  const isLarge = assessment.size === "L" || assessment.size === "XL";
  const managerImpact = /manager|leader|supervisor/.test(text);
  const trainingNeeded = /training|learn|skill|workflow|system|tool|platform|process|procedure|migration/.test(text) && assessment.size !== "XS";
  const governed = /legal|privacy|compliance|external|media|customer-facing|customer facing| ai |artificial intelligence|staffing|headcount|job security/.test(` ${text} `);
  const source = prepareContext.evidencePack
    ? "Uploaded document + user-reviewed connected-source evidence"
    : "Uploaded document";
  const prepareChange = cleanMessageText(change) || "Suggested example — confirm: Describe the change in one clear sentence.";
  const prepareOutcome = cleanMessageText(outcome) || "Suggested example — confirm: Explain the business or employee outcome this change is intended to improve.";
  const prepareTiming = timing !== NEEDS_INPUT ? timing : "Suggested — confirm: Work backward from the planned launch or milestone once it is confirmed.";
  const prepareAudiences = audiences[0] === NEEDS_INPUT ? ["Affected Employees or Teams — confirm"] : audiences;
  const leadershipAudience = prepareAudiences.find((audience) => /leader|sponsor|executive/i.test(audience)) || (/leader|sponsor|executive/.test(text) ? "Project Leaders and Sponsors" : "Accountable Leader");
  const managerAudience = prepareAudiences.find((audience) => /manager|supervisor/i.test(audience)) || "People Managers";
  const capturedReferences = prepareContext.sourceReferences;
  const prepareReferences = capturedReferences || (value(intake.externalSources) === NEEDS_INPUT ? source : value(intake.externalSources));
  const riskGuidance = assessment.risks.length ? `\n\nPlanning considerations: ${assessment.risks.join("; ")}.` : "";
  const readinessGuidance = readiness !== NEEDS_INPUT ? `\n\nCurrent readiness evidence: ${cleanMessageText(readiness)}` : "";
  const sparkChange = separateSparkSources(change).content || "Suggested example — confirm: Summarize the change in one clear sentence.";
  const sparkOutcome = separateSparkSources(outcome).content || "Suggested example — confirm: Explain the outcome this change is intended to improve.";
  const sparkTiming = timing !== NEEDS_INPUT ? separateSparkSources(timing).content : "Suggested — confirm: Work backward from the planned launch or milestone.";
  const sparkAudiences = audiences[0] === NEEDS_INPUT ? ["Affected Employees or Teams — confirm"] : audiences;
  const sparkReferences = [prepareReferences, separateSparkSources(prepareContext.signalText).references].filter(Boolean).join("\n");
  const sparkImpact = isLarge ? "High" : isSmall ? "Low" : "Medium";
  const sparkImpactType = /tool|system|platform|software|migration| ai |automation/.test(` ${text} `) ? "Technology" : /policy|compliance/.test(text) ? "Policy" : /role|staffing|organization/.test(text) ? "Role" : /workflow|process|procedure|handoff/.test(text) ? "Process" : "Behavior";
  const audienceRows = sparkAudiences.map((audience) => {
    const isLeaderOrManager = /leader|manager|supervisor|sponsor|executive/i.test(audience);
    const expectedAction = isLeaderOrManager
      ? "Explain the change consistently, reinforce the expected action, and route unresolved questions."
      : trainingNeeded
        ? "Learn and use the new process or tool, complete recommended practice, and use the support path when help is needed."
        : "Follow the new expectation and use the support path when help is needed.";
    return {
      audience,
      effect: `${audience} will need to understand ${sparkChange} and adjust how they complete or support the affected work. Confirm the specific local impact with the audience owner.`,
      impact: sparkImpact,
      impactType: sparkImpactType,
      know: `What is changing: ${sparkChange}\n\nWhy it matters: ${sparkOutcome}\n\nExpected timing: ${sparkTiming}`,
      feel: "Clear about why the change matters, what is expected, and where to get help.",
      do: expectedAction,
      concerns: assessment.risks.length ? `Plan for questions related to: ${assessment.risks.join("; ")}.` : "Likely questions may focus on local impact, timing, workload, and available support.",
      support: trainingNeeded ? "Job Aid, Training" : "FAQ, Team Discussion Guide",
    };
  });
  const stakeholderRows = [
    { stakeholder: leadershipAudience, role: "Accountable Sponsor — confirm name", influence: "High", currentSupport: "Unknown", desiredSupport: "Active", need: "Confirm direction, resolve open decisions, and visibly support the change", approach: `${suggested}: Sponsor Alignment`, owner: "Change Owner — confirm name" },
    ...(!isSmall ? [{ stakeholder: "Operational Owner — confirm name", role: "Operational Owner", influence: "High", currentSupport: "Unknown", desiredSupport: "Active", need: `Confirm operational readiness, audience impact, and support before ${sparkTiming}`, approach: "Readiness Review", owner: "Change Owner — confirm name" }] : []),
    ...(isLarge || governed ? [{ stakeholder: "Required Reviewer — confirm role and name", role: "Required Reviewer", influence: "High", currentSupport: "Unknown", desiredSupport: "Approve or advise", need: "Review sensitive claims, risks, and sequencing within their established authority", approach: "Targeted Review", owner: "Change Owner — confirm name" }] : []),
  ];

  const leaderActions = [
    action("align-leaders", { do: "Align on the change story, intended outcome, risks, and decisions still open", who: leadershipAudience, use: "Leader Alignment Meeting", create: "Leader Brief", owner: "Change Owner — confirm name", when: `Before broader communication; work backward from ${prepareTiming}`, why: `Leaders need a shared explanation of why the change matters before others hear about it. ${prepareOutcome}`, doneWhen: "The accountable leader confirms the change story, intended outcome, boundaries, risks, and open decisions.", confirmation: "Confirm the decisions leaders must make and any risks they need to address." }),
    action("confirm-sender", { do: "Confirm the visible sponsor, sender, and leadership handoff for the change", who: leadershipAudience, use: `${suggested}: Leader-Led Message`, create: "Named Sender and Channel Decision", owner: "Communications Owner — confirm name", when: `After leadership alignment and before materials are finalized; work backward from ${prepareTiming}`, why: "A visible and credible sender builds trust and makes accountability clear.", doneWhen: "The sponsor or sender accepts the role, the channel is confirmed, and the handoff to managers or employees is clear.", confirmation: "Confirm the sender, channel, and handoff to the next communication." }),
    ...(!isSmall || managerImpact ? [
      action("manager-brief", { do: `Prepare managers to explain the change, translate the impact for ${prepareAudiences.join(", ")}, and route questions`, who: managerAudience, use: `${suggested}: Manager Briefing`, create: "Manager Talking Points and Team Discussion Guide", owner: "Change Owner — confirm name", when: `After leadership alignment and before affected employees are informed; work backward from ${prepareTiming}`, why: "Managers need the change story, local impact, expected action, and a safe way to raise concerns before their teams hear the news.", doneWhen: "Managers can explain what is changing, why it matters, what their teams need to do, and where to route questions.", confirmation: "Confirm the questions managers are likely to hear and where they should escalate them." }),
      action("feedback-path", { do: "Set a feedback and escalation path", who: "Managers and Affected Teams", use: "Named Feedback Channel", create: "Issue-Routing Instructions", owner: "Change Owner — confirm name", when: "Before launch", why: "Questions need an owner and a response path.", doneWhen: "An owner, response expectation, and escalation route are published.", confirmation: "Confirm the support contact, response expectation, and escalation route." }),
    ] : []),
  ];
  leaderActions.forEach((item) => {
    item.details = {
      audience: item.who,
      know: `What is changing: ${prepareChange}\n\nWhy it matters: ${prepareOutcome}\n\nExpected timing: ${prepareTiming}${readinessGuidance}${riskGuidance}`,
      leaderDo: item.do,
      why: item.why,
      messages: `What’s changing: ${prepareChange}\nWhy it matters: ${prepareOutcome}\nWhat leaders should do: ${item.do}.`,
      materials: item.create,
      channel: item.use,
      doneWhen: item.doneWhen,
      sources: prepareReferences,
      notes: item.confirmation,
    };
  });

  const coreMessage = `What’s changing: ${prepareChange}\nWhy it matters: ${prepareOutcome}`;
  const communicationRows: Array<Record<string, string>> = isSmall ? [
    { sequence: "1", audience: prepareAudiences.join(", "), purpose: "Announce the change and the action people need to take", message: `${coreMessage}\nWhat to do: Review the change and complete the required action.`, sources: prepareReferences, sender: "Change Owner — confirm name", channel: `${suggested}: Email or Team Meeting`, timing: prepareTiming, frequency: "One Time", cta: "Review the change and ask questions through the support path", material: "Announcement", owner: "Communications Owner — confirm name", status, review: governed ? "Yes" : "No", rationale: "A direct announcement is proportionate to a smaller change." },
    { sequence: "2", audience: prepareAudiences.join(", "), purpose: "Remind people shortly before the change takes effect", message: `Reminder: ${prepareChange}\nTiming: ${prepareTiming}\nPlease complete the required action before launch.`, sources: prepareReferences, sender: "Change Owner — confirm name", channel: `${suggested}: Email or Slack`, timing: `Before launch; target window: ${prepareTiming}`, frequency: "One Time", cta: "Complete the required action before launch", material: "Reminder Message", owner: "Communications Owner — confirm name", status, review: governed ? "Yes" : "No", rationale: "A short reminder keeps the action and timing visible without adding noise." },
  ] : [
    { sequence: "1", audience: leadershipAudience, purpose: "Align leaders before broader communication", message: `${coreMessage}\nLeadership action: Confirm the direction, open decisions, and visible support needed.`, sources: prepareReferences, sender: "Accountable Sponsor — confirm name", channel: `${suggested}: Leader Meeting`, timing: `Before broader communication; work backward from ${prepareTiming}`, frequency: "One Time", cta: "Confirm readiness and resolve open decisions", material: "Leader Brief", owner: "Change Owner — confirm name", status, review: governed ? "Yes" : "No", rationale: "A live discussion gives leaders space to resolve questions before the message expands." },
    { sequence: "2", audience: managerAudience, purpose: "Prepare managers to explain the change and support their teams", message: `${coreMessage}\nManager action: Use the talking points, explain the local impact, and route questions through the support path.`, sources: prepareReferences, sender: "Accountable Leader or Change Owner — confirm name", channel: `${suggested}: Manager Briefing`, timing: `After leadership alignment and before the employee announcement; work backward from ${prepareTiming}`, frequency: "One Time", cta: "Review the talking points and prepare to answer team questions", material: "Manager Talking Points", owner: "Change Owner — confirm name", status, review: governed ? "Yes" : "No", rationale: "Managers should hear the change before they are expected to explain it." },
    { sequence: "3", audience: prepareAudiences.join(", "), purpose: "Explain the change, timing, and expected action", message: `${coreMessage}\nWhat to do: Follow the new expectation and use the support path if you need help.`, sources: prepareReferences, sender: managerImpact ? "People Manager — confirm name" : "Change Owner — confirm name", channel: `${suggested}: ${managerImpact ? "Team Meeting" : "Email or Team Meeting"}`, timing: prepareTiming, frequency: "One Time", cta: "Review what is changing and complete the required action", material: governed || isLarge ? "Announcement and FAQ" : "Announcement", owner: "Communications Owner — confirm name", status, review: governed ? "Yes" : "No", rationale: managerImpact ? "A team discussion lets managers explain the local impact." : "One direct channel keeps the message clear and proportionate." },
  ];

  const deliverableRows: Array<Record<string, string>> = [
    { deliverable: isSmall ? "Announcement" : "Leader Brief", why: isSmall ? "Give affected people the essential change and action." : "Align leaders before activation.", audience: isSmall ? prepareAudiences.join(", ") : leadershipAudience, owner: "Communications Owner — confirm name", due: prepareTiming, status, available: `Change: ${prepareChange}; outcome: ${prepareOutcome}`, missing: "Confirm the sender, channel, and final timing.", draft: `What’s changing: ${prepareChange}\nWhy it matters: ${prepareOutcome}\nWhat to do: Review the change and complete the required action.` },
    ...(!isSmall ? [{ deliverable: "Manager Talking Points", why: "Help managers explain the change consistently.", audience: managerAudience, owner: "Change Owner — confirm name", due: prepareTiming, status, available: `Change: ${prepareChange}; outcome: ${prepareOutcome}; timing: ${prepareTiming}`, missing: "Confirm the local impact and escalation contact.", draft: `1. What is changing: ${prepareChange}\n2. Why it matters: ${prepareOutcome}\n3. What this means for our team: Explain the local impact and expected behavior.\n4. What happens next: ${prepareTiming}` }] : []),
    ...(isLarge || governed ? [{ deliverable: "FAQ", why: "Provide reviewed answers for sensitive or repeated questions.", audience: prepareAudiences.join(", "), owner: "Change Owner — confirm name", due: prepareTiming, status, available: `Known sensitivities: ${sensitivity}`, missing: "Confirm the priority questions, approved answers, and reviewer.", draft: "Suggested outline: What is changing; why now; impact by audience; what is not changing; support; escalation." }] : []),
    ...(trainingNeeded ? [{ deliverable: "Job Aid or Training", why: "Help people perform the new task or behavior.", audience: prepareAudiences.join(", "), owner: "Training Owner — confirm name", due: prepareTiming, status, available: prepareChange, missing: "Confirm the skill gap, delivery method, and completion check.", draft: "Suggested outline: Task goal; steps; example; common errors; where to get help." }] : []),
  ];

  const managerPreparation = leaderActions.find((item) => item.id === "manager-brief");
  const peopleActions = prepareAudiences.slice(0, 3).map((audience, index) => {
    const isLeaderOrManagerAudience = /leader|manager|supervisor|sponsor|executive/i.test(audience);
    const communication = communicationRows.find((row) => row.audience.toLowerCase().includes(audience.toLowerCase()))
      ?? communicationRows.find((row) => isLeaderOrManagerAudience && /leader|manager/i.test(row.audience))
      ?? communicationRows[communicationRows.length - 1];
    const expectedAction = isLeaderOrManagerAudience
      ? managerPreparation?.do || "Explain the change, reinforce the expected action, and route unresolved questions."
      : trainingNeeded
        ? "Learn and use the new process or tool, complete any required practice, and use the support path when help is needed."
        : "Follow the new expectation, complete the required action, and use the support path when help is needed.";
    const impact = `${audience} will need to understand ${prepareChange} and adjust how they complete or support the affected work. Confirm the specific local impact with the audience owner.`;
    const support = isLeaderOrManagerAudience
      ? managerPreparation?.create || "Manager Talking Points and Team Discussion Guide"
      : trainingNeeded
        ? `${communication.material || "Job Aid or Training"}, guided practice, and a named support path`
        : `${communication.material || "Announcement"} and a named support path`;
    const completion = isLeaderOrManagerAudience
      ? managerPreparation?.doneWhen || "The audience can explain the change, expected action, timing, and escalation path."
      : trainingNeeded
        ? `${audience} can explain what is changing, complete the expected task or behavior, and identify where to get help.`
        : `${audience} can explain what is changing, what they need to do, and where to get help.`;
    const item = action(`affected-audience-${index + 1}`, {
      do: `Prepare ${audience} to understand and act on the change`,
      who: audience,
      use: communication.channel || `${suggested}: Email or Team Meeting`,
      create: support,
      owner: "Change Owner or Audience Owner — confirm name",
      when: communication.timing || prepareTiming,
      why: `${prepareOutcome} ${assessment.risks.length ? `The engagement approach should also account for: ${assessment.risks.join("; ")}.` : ""}`.trim(),
      doneWhen: completion,
      confirmation: "Confirm the local impact, support contact, and any questions that must be resolved before launch.",
      humanReview: governed ? "Yes" : "No — confirm before use",
    });
    item.details = {
      audience,
      changing: impact,
      know: `What is changing: ${prepareChange}\n\nWhy it matters: ${prepareOutcome}\n\nExpected timing: ${prepareTiming}${readinessGuidance}${riskGuidance}`,
      audienceDo: expectedAction,
      messages: cleanMessageText(communication.message) || `${coreMessage}\nWhat to do: ${expectedAction}`,
      channel: communication.channel || `${suggested}: Email or Team Meeting`,
      support,
      doneWhen: completion,
      sources: communication.sources || prepareReferences,
      feedback: "Use the named support or feedback path for questions, friction, and unresolved issues. Confirm the contact before launch.",
    };
    return item;
  });

  const launchRows = [
    { period: "Before launch", action: "Confirm audience, owner, timing, sender, materials, support, and required reviews", owner: "Change Owner — confirm name", date: `Before launch; work backward from ${prepareTiming}`, status, dependency: "Leader alignment, communication materials, audience support, and open decisions are ready", evidence: `Readiness decision informed by: ${readiness}` },
    { period: "Launch day / launch period", action: "Deliver the reviewed communication and make support available", owner: "Communications Owner or Change Owner — confirm name", date: prepareTiming, status, dependency: "Reviewed materials, prepared managers, and an active support path", evidence: "Sent message, meeting notes, or published material" },
    ...(!isSmall ? [{ period: "Immediately after launch", action: "Collect questions and resolve urgent friction", owner: "Change Owner or Support Owner — confirm name", date: `Immediately after ${prepareTiming}`, status, dependency: "Feedback and escalation path is active", evidence: "Issue log, response owners, and resolved urgent questions" }] : []),
  ];

  return [
    { id: "understand", number: 1, title: "Understand the change", purpose: "Confirm the facts and close the most important gaps before planning activity.", source, instructions: instruction("Build a reliable foundation for the playbook.", "Identify the specific action or decision required to move this change forward.", "Enter it in Action or decision required, then assign the owner, target date, status, and dependencies.", "A concrete action or decision, owner, target date, and status.", "The action is specific, assigned, dated, and any dependency is recorded.", "Confirm the revised routing workflow and approve the October 12 launch decision."), actions: [
      action("confirm-change", { do: "Review and confirm the change story, expected behavior, timing, dependencies, and constraints", who: "Change Owner and Accountable Leader", use: "Source Review", create: "Confirmed Change Summary", owner: "Change Owner — confirm name", when: "First, before leader and audience preparation", why: "Every later action depends on a clear and accurate change story.", doneWhen: "The change owner confirms the story, expected behavior, timing, dependencies, and any decisions that still require human judgment.", confirmation: `Expected behavior: Affected audiences understand ${sparkChange} and complete the actions relevant to their role.\nPlanning dependencies: Confirm leader alignment, communication materials, audience support, and the issue-response path before activation.\nTiming: ${sparkTiming}\nConstraints and risks: ${sensitivity !== NEEDS_INPUT ? separateSparkSources(sensitivity).content : assessment.risks.length ? assessment.risks.join("; ") : "Suggested — confirm: Validate operational readiness and unresolved dependencies before activation."}`, details: { sources: sparkReferences } }),
    ], checklist: ["The change and business outcome are clear", "Affected groups are named", "Expected employee behavior is defined", "Important dates and constraints are confirmed", "Missing information has an owner"] },
    { id: "people-involved", number: 2, title: "Identify who needs to be involved", purpose: "Name the affected groups and the people needed to make the change work.", source, instructions: instruction("Make the impact and involvement visible.", "Rate each audience’s impact and identify the stakeholders needed to support the change.", "Use the Audience impact entries and Stakeholder plan directly below.", "Impacted groups, impact rating, type and reason, review decision, stakeholders, and owners.", "Every impacted group has a defined rating and reason; required reviewers and stakeholder owners are identified.", "Customer Care — 3 Moderate — Process and Behavior — new routing steps require manager support."), actions: [], tables: [
      { id: "audiences", label: "Audience impact entries", columns: [{ key: "audience", label: "Impacted groups", required: true, control: "multi-select", options: audiences }, { key: "impact", label: "Impact level", width: "small", required: true, control: "select", options: IMPACT_OPTIONS, helper: IMPACT_DEFINITIONS.join("\n") }, { key: "impactType", label: "Type of impact", required: true, control: "multi-select", options: IMPACT_TYPES }, { key: "effect", label: "Reason for rating", width: "large", required: true, control: "textarea" }, { key: "know", label: "What they need to know", width: "large", required: true, control: "textarea" }, { key: "feel", label: "What they need to feel", control: "textarea" }, { key: "do", label: "What they need to do", width: "large", required: true, control: "textarea" }, { key: "concerns", label: "Likely concerns", width: "large", control: "textarea" }, { key: "support", label: "Support required", width: "large", control: "multi-select", options: SUPPORT_MATERIALS }, { key: "humanReview", label: "Human review required", required: true, control: "yes-no" }, { key: "reviewer", label: "Reviewer", control: "person", helper: "Required when Human review required is Yes." }, { key: "reviewDate", label: "Review date", control: "date" }, { key: "status", label: "Status", required: true, control: "status" }], rows: audienceRows.map((row) => ({ ...row, humanReview: governed ? "Yes" : "No", reviewer: governed ? "Required Reviewer — confirm name" : "Not required", reviewDate: timing !== NEEDS_INPUT ? separateSparkSources(timing).content : "Confirm before activation", status })) },
      { id: "stakeholders", label: "Stakeholder plan", columns: [{ key: "stakeholder", label: "Person or group", required: true, control: "person" }, { key: "role", label: "Role", required: true, control: "text" }, { key: "influence", label: "Influence", required: true, control: "select", options: ["Low", "Medium", "High"] }, { key: "currentSupport", label: "Current support", control: "select", options: ["Unknown", "Resistant", "Neutral", "Supportive", "Active"] }, { key: "desiredSupport", label: "Desired support", required: true, control: "select", options: ["Aware", "Supportive", "Active", "Decision maker"] }, { key: "need", label: "What we need", width: "large", required: true, control: "textarea" }, { key: "approach", label: "Engagement approach", width: "large", required: true, control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }], rows: stakeholderRows },
    ] },
    { id: "leaders", number: 3, title: "Prepare leaders and managers", purpose: "Equip the people who will explain, sponsor, and support the change.", source: "Change Navigation framework + source evidence", instructions: instruction("Give leaders the information and tools to lead consistently.", "Create one preparation entry for each leader or manager audience with different needs.", "Use the stacked Leader or manager preparation entries below; add another entry when needed.", "Audience, knowledge, required action, messages, materials, channel, owner, date, review decision, and status.", "The leader audience has an owner, date, usable messages and materials, and any required review is identified.", "People managers — explain the routing change in a team meeting using talking points and an FAQ."), actions: leaderActions },
    { id: "communications", number: 4, title: "Build the communication sequence", purpose: "Put the right messages in the right order without over-communicating.", source: "Source evidence + Echo guardrails + Smart Brevity + Chewy writing guidance", instructions: instruction("Create a clear communication order.", "Confirm each audience, message, sender, channel, timing, and call to action.", "Edit the Ordered communication sequence below.", "Sequence, audience, message, sender, channel, timing, material, owner, review decision, and status.", "Every row has a clear order, owner, date or dependency, and completion status.", "1 — Leaders — align on the change — leader meeting — owner assigned — Complete."), actions: [], tables: [{ id: "communications", label: "Ordered communication sequence", columns: [{ key: "sequence", label: "#", width: "small", required: true, control: "text" }, { key: "audience", label: "Audience", required: true, control: "multi-select", options: audiences }, { key: "purpose", label: "Purpose", width: "large", required: true, control: "textarea" }, { key: "message", label: "Key Message", width: "large", required: true, control: "textarea", helper: "Write only the message intended for this audience. Keep links and supporting documents in Sources / References." }, { key: "sources", label: "Sources / References", width: "large", control: "textarea", helper: "Keep supporting links, documents, and evidence here—not in the message." }, { key: "sender", label: "Recommended Sender", required: true, control: "person" }, { key: "channel", label: "Recommended Channel", required: true, control: "multi-select", options: CHANNELS }, { key: "timing", label: "Timing or Sequence", required: true, control: "text" }, { key: "frequency", label: "Frequency", control: "select", options: ["One Time", "Weekly", "Monthly", "At Milestone", "As Needed"] }, { key: "cta", label: "Call to Action", width: "large", required: true, control: "textarea" }, { key: "material", label: "Material to Create", control: "multi-select", options: SUPPORT_MATERIALS }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "review", label: "Human Review", required: true, control: "yes-no" }, { key: "rationale", label: "Why This Is Recommended", width: "large", control: "textarea" }], rows: communicationRows }] },
    { id: "materials", number: 5, title: "Prepare the materials", purpose: "Create only the items this change needs, using supported facts and clearly marked suggestions.", source, instructions: instruction("Turn the plan into usable materials.", "Confirm which deliverables are needed, assign them, and complete the missing content.", "Use the Deliverables checklist below.", "Deliverable, audience, owner, due date, status, supported content, and missing information.", "Each required deliverable has an owner, due date, status, and enough information to draft or complete it.", "Manager talking points — People managers — owner assigned — due October 5 — In progress."), actions: [], tables: [{ id: "deliverables", label: "Deliverables checklist", columns: [{ key: "deliverable", label: "Deliverable", required: true, control: "select", options: SUPPORT_MATERIALS }, { key: "why", label: "Why needed", width: "large", required: true, control: "textarea" }, { key: "audience", label: "Audience", required: true, control: "multi-select", options: audiences }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "due", label: "Due date", required: true, control: "date" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "available", label: "Source-supported content", width: "large", control: "textarea" }, { key: "missing", label: "Needs user input", width: "large", control: "textarea" }, { key: "draft", label: "Suggested language / outline", width: "large", control: "textarea" }], rows: deliverableRows }] },
    { id: "readiness", number: 6, title: "Prepare people for the change", purpose: "Make sure people can act, get help, and raise issues safely.", source: "Source evidence + Risk Signal & Readiness Gate", instructions: instruction("Prepare each audience to understand and use the change.", "Create one entry for every audience that needs different communication, training, or support.", "Use the stacked Audience preparation entries below; add another entry when needed.", "Audience, change, knowledge, action, support, channel, owner, completion date, review decision, status, and feedback path.", "Each affected audience has a complete, assigned, dated preparation entry.", "Customer Care — learn the new routing steps — job aid and guided practice — owner assigned — due October 10."), actions: peopleActions },
    { id: "launch", number: 7, title: "Launch", purpose: "Move through launch in order and keep proof that each gate is ready.", source, instructions: instruction("Execute the approved plan in order.", "Confirm each launch action, dependency, owner, date, and evidence of completion.", "Use the Chronological launch checklist below.", "Period, action, owner, target date, status, dependency, and evidence.", "Every relevant launch action has an owner, date, status, and proof requirement.", "Before launch — confirm materials and support — owner assigned — October 10 — Complete."), actions: [], tables: [{ id: "launch", label: "Chronological launch checklist", columns: [{ key: "period", label: "Period", required: true, control: "select", options: ["Before launch", "Launch day / launch period", "Immediately after launch"] }, { key: "action", label: "Action", width: "large", required: true, control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "date", label: "Target date", required: true, control: "date" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "dependency", label: "Dependency", width: "large", control: "textarea" }, { key: "evidence", label: "Evidence required", width: "large", required: true, control: "textarea" }], rows: launchRows }] },
    { id: "reinforce", number: 8, title: "Reinforce and measure", purpose: "Use practical evidence to see what is working and decide what to do next.", source: "Source evidence + Change Navigation framework", instructions: instruction("Define how success will be measured and what happens when results fall short.", "Create a measure with a baseline, target, data source, owner, review date, and reinforcement action.", "Use the Measurement and reinforcement entries below.", "Measure, type, baseline, target, data source, frequency, reinforcement, owner, review date, review decision, and status.", "A measure is complete only when baseline, target, data source, owner, and review date are defined.", "Routing accuracy — Quality — baseline 82% — target 95% — weekly dashboard — review November 1."), actions: [], tables: [{ id: "measures", label: "Measurement and reinforcement entries", columns: [{ key: "measure", label: "Measure name", required: true, control: "text" }, { key: "measureType", label: "Measure type", required: true, control: "select", options: ["Adoption", "Usage", "Proficiency", "Sentiment", "Quality", "Risk", "Business outcome", "Other"] }, { key: "baseline", label: "Baseline", required: true, control: "text" }, { key: "target", label: "Target", required: true, control: "text" }, { key: "current", label: "Current result", control: "text" }, { key: "dataSource", label: "Data source", required: true, control: "text" }, { key: "frequency", label: "Measurement frequency", required: true, control: "select", options: ["Weekly", "Monthly", "Quarterly", "At milestone", "One time"] }, { key: "reinforcement", label: "Reinforcement action", width: "large", control: "textarea" }, { key: "owner", label: "Owner", required: true, control: "person" }, { key: "reviewDate", label: "Next review date", required: true, control: "date" }, { key: "humanReview", label: "Human review required", required: true, control: "yes-no" }, { key: "status", label: "Status", required: true, control: "status" }, { key: "findings", label: "Findings and next steps", width: "large", control: "textarea" }], rows: [{ measure: "Adoption of the expected behavior", measureType: "Adoption", baseline: "Suggested — confirm: Establish the current level before or at launch", target: "Suggested — confirm: Define the observable adoption level expected after launch", current: "Not measured yet — update after launch", dataSource: readiness !== NEEDS_INPUT ? `Existing readiness evidence and operational reporting — confirm source: ${cleanMessageText(readiness)}` : "Suggested — confirm: Existing operational reporting, completion records, or manager feedback", frequency: isSmall ? "At milestone" : "Weekly", reinforcement: isSmall ? "Follow up through the manager if adoption is unclear." : "Use feedback and adoption gaps to choose a targeted reminder, FAQ update, or coaching action.", owner: "Change Owner or Business Owner — confirm name", reviewDate: `After launch; review against ${prepareTiming}`, humanReview: governed ? "Yes" : "No", status, findings: "Suggested — update after the first review with findings, decisions, and next actions" }] }] },
  ];
}

export function makePlaybook(intake: Intake, assessment: Assessment, generationInputs: PrepareGenerationInputs = {}): PlaybookPhase[] {
  const detailed = makeDetailedPlaybook(intake, assessment, generationInputs);
  const sparkContext = collectProjectContext(intake, assessment, generationInputs);
  const sparkPlanTiming = sparkContext.timing !== NEEDS_INPUT ? separateSparkSources(sparkContext.timing).content : "Suggested — confirm: Work backward from the planned launch or milestone.";
  const byId = (id: string) => detailed.find((phase) => phase.id === id)!;
  const understand = byId("understand");
  const involved = byId("people-involved");
  const leaders = byId("leaders");
  const communications = byId("communications");
  const materials = byId("materials");
  const readiness = byId("readiness");
  const launch = byId("launch");
  const reinforce = byId("reinforce");

  const limitTable = (table: PlaybookTable, visibleKeys: string[], reuse: Record<string, PlaybookColumn["reuse"]> = {}): PlaybookTable => ({
    ...table,
    columns: table.columns.map((column) => ({ ...column, advanced: !visibleKeys.includes(column.key), reuse: reuse[column.key] })),
    rows: table.rows.slice(0, 3),
  });
  const audienceTable = limitTable(involved.tables![0], ["audience", "impact", "effect", "do", "importantDates"], { audience: "audiences" });
  audienceTable.label = "Audience Impact";
  audienceTable.description = "Use this section to decide who will be affected, how much the change affects them, and what you need them to do differently.";
  audienceTable.columns = [
    ...audienceTable.columns.map((column) => column.key === "impact"
      ? { ...column, label: "Impact rating", options: ["Low", "Medium", "High"], helper: "Choose how much this change affects the audience." }
      : column.key === "effect"
        ? { ...column, label: "Why this rating?", helper: "Explain what makes the impact low, medium, or high." }
        : column.key === "do"
          ? { ...column, label: "Expected behavior", helper: "What should this audience do differently after the change?" }
          : column),
    { key: "importantDates", label: "Important dates", required: true, control: "text", helper: "Add the key dates this audience needs to know.", advanced: false, reuse: "dates" },
  ];
  audienceTable.rows = audienceTable.rows.map((row) => ({ ...row, importantDates: sparkPlanTiming }));
  const stakeholderTable = limitTable(involved.tables![1], ["stakeholder", "role", "need"], { stakeholder: "stakeholders", owner: "owners" });
  stakeholderTable.label = "Key supporters";
  stakeholderTable.columns = stakeholderTable.columns.map((column) => column.key === "role" ? { ...column, label: "Why they matter" } : column);
  const communicationTable = limitTable(communications.tables![0], ["sequence", "audience", "purpose", "message", "sources", "channel", "sender", "timing", "cta", "owner"], { audience: "audiences", sender: "stakeholders", owner: "owners", timing: "dates" });
  communicationTable.label = "Recommended Communication Sequence";
  communicationTable.description = "Start with these recommendations based on the change, audience, scope, manager involvement, and timing already provided. Edit, remove, or add entries to fit the project.";
  communicationTable.columns = communicationTable.columns.map((column) => column.key === "channel"
    ? { ...column, options: ["Leader Meeting", "Manager Briefing", "Team Meeting", "Email", "Slack", "FAQ", "Job Aid", "Training", "Office Hours", "Intranet or Internal Page", "Other"] }
    : column);
  const deliverableTable = limitTable(materials.tables![0], ["deliverable", "why", "audience", "owner", "due"], { audience: "audiences", owner: "owners", due: "dates" });
  deliverableTable.description = "Review the suggested materials, then confirm the owner and timing. The draft uses information already entered and identifies what still needs confirmation.";
  deliverableTable.columns = deliverableTable.columns.map((column) => column.key === "deliverable"
    ? { ...column, options: ["Announcement", "Leader Brief", "Manager Talking Points", "FAQ", "Team Discussion Guide", "Job Aid or Training", "Reminder Message", "Feedback Survey", "Other"] }
    : column);
  const launchTable = limitTable(launch.tables![0], ["action", "owner", "date", "status", "dependency", "evidence"], { owner: "owners", date: "dates" });
  launchTable.label = "Launch Timeline";
  launchTable.description = "Use this timeline to put launch activities in the order they need to happen. Add what needs to happen, who owns it, and when it should happen.";
  launchTable.columns = launchTable.columns.map((column) => column.key === "action" ? { ...column, label: "What needs to happen?" } : column.key === "owner" ? { ...column, label: "Who owns it?" } : column.key === "date" ? { ...column, label: "When?", control: "text" } : column.key === "status" ? { ...column, label: "Is it complete?" } : column.key === "evidence" ? { ...column, label: "Done when" } : column);
  const measuresTable = limitTable(reinforce.tables![0], ["measure", "baseline", "target", "dataSource", "owner", "reviewDate"], { owner: "owners", reviewDate: "dates" });
  measuresTable.columns = measuresTable.columns.map((column) => column.key === "reviewDate" ? { ...column, control: "text", label: "Next review timing" } : column);
  const sustainActions = [
    action("listen-feedback", { do: "Collect and review feedback from affected people and managers", who: value(intake.audiences), use: "Manager check-ins, questions, or a short pulse", create: "Feedback themes and follow-up owners", when: "After launch", why: "Feedback shows where people need more clarity or support.", doneWhen: "The main themes have an owner and next step." }),
    action("reinforce-change", { do: "Reinforce the change where adoption or confidence is low", who: value(intake.audiences), use: `${suggested}: targeted reminder, FAQ update, coaching, or office hours`, create: "One targeted reinforcement action", when: "When feedback or measures show a gap", why: "Focused reinforcement fixes real gaps without adding noise.", doneWhen: "The gap improves or a new action is assigned." }),
  ];

  return [
    {
      id: "spark", number: 1, icon: "✨", color: "spark", title: "Spark", source: understand.source,
      purpose: "Help people understand why the change matters and who needs to be involved.",
      instructions: instruction("Create a clear starting point.", "Review the smart first draft, then confirm why the change matters, who is affected, and who must support it.", "Use the three Spark focus areas below.", "Change reason, audiences, impact, and key supporters.", "The main change story, priority audiences, and key supporters are confirmed or clearly marked for follow-up.", "A revised routing workflow will reduce handoffs for Customer Care; Operations leaders will sponsor it."),
      actions: understand.actions.slice(0, 1), tables: [audienceTable, stakeholderTable], checklist: understand.checklist,
      focusAreas: [
        { id: "why", title: "Why this change", description: "Confirm what is changing, why it matters, and the expected outcome.", usage: "This becomes the shared change story used in leader and employee messages.", actionIds: understand.actions.slice(0, 1).map((item) => item.id) },
        { id: "audiences", title: "Who is affected", description: "Review each audience, its impact, expected behavior, and important dates.", usage: "This guides communications, support, launch timing, and measurement.", tableIds: [audienceTable.id] },
        { id: "supporters", title: "Who needs to support it", description: "Confirm the key stakeholders or sponsors and what you need from them.", usage: "These people will help make decisions, remove barriers, and support the change.", tableIds: [stakeholderTable.id] },
      ],
    },
    {
      id: "prepare", number: 2, icon: "🛠", color: "prepare", title: "Prepare", source: leaders.source,
      purpose: "Make sure leaders, communications, and materials are ready.",
      instructions: instruction("Prepare the people and tools that will carry the change.", "Confirm the most important leader actions, communications, and materials.", "Use the three Prepare focus areas below.", "Leader action, communication sequence, and required materials.", "Every visible recommendation is confirmed, edited, assigned, or marked for follow-up.", "Brief people managers, send one team message, and prepare talking points before launch."),
      actions: leaders.actions.slice(0, 3), tables: [communicationTable, deliverableTable],
      focusAreas: [
        { id: "leaders", title: "Prepare leaders and managers", description: "Review what leaders need to know, do, and share.", usage: "This helps leaders explain the change clearly and support their teams.", actionIds: leaders.actions.slice(0, 3).map((item) => item.id) },
        { id: "communications", title: "Plan communications and channels", description: "Review the recommended communication order, audience messages, senders, channels, and timing.", usage: "The editable sequence is ready to transfer into the appropriate communication channels.", tableIds: [communicationTable.id] },
        { id: "materials", title: "Prepare materials and support", description: "Confirm which materials are needed, who owns them, and when they are due.", usage: "These materials give leaders and employees the information and support they need.", tableIds: [deliverableTable.id] },
      ],
    },
    {
      id: "activate", number: 3, icon: "🚀", color: "activate", title: "Activate", source: launch.source,
      purpose: "Show exactly what needs to happen to launch the change.",
      instructions: instruction("Turn preparation into an ordered launch.", "Confirm the immediate next actions, the launch sequence, and how questions or issues will be handled.", "Use the three Activate focus areas below.", "Owners, timing, dependencies, completion evidence, and issue response.", "The first actions are ordered, assigned, and ready to start.", "Confirm readiness, launch the approved message, and route early questions to the change owner."),
      actions: readiness.actions.slice(0, 3), tables: [launchTable],
      focusAreas: [
        { id: "next", title: "Next actions", description: "Review the most important work that must be finished before launch.", usage: "This keeps the team focused on the work that unlocks launch readiness.", actionIds: readiness.actions.slice(0, 1).map((item) => item.id) },
        { id: "launch", title: "Launch Timeline", description: "Put launch activities in order and confirm their owners and dates.", usage: "This becomes the shared timeline the team follows during launch.", tableIds: [launchTable.id] },
        { id: "support", title: "Support and issue response", description: "Review how questions, resistance, and early issues will be handled.", usage: "This gives employees and managers a clear place to get help.", actionIds: readiness.actions.slice(1, 3).map((item) => item.id) },
      ],
    },
    {
      id: "sustain", number: 4, icon: "🔁", color: "sustain", title: "Sustain", source: reinforce.source,
      purpose: "Help the change continue after launch.",
      instructions: instruction("Use feedback and practical measures to sustain the change.", "Confirm how feedback will be collected, what will be measured, and how gaps will be reinforced.", "Use the three Sustain focus areas below.", "Feedback method, adoption measure, owner, review date, and reinforcement action.", "The measure and feedback route have owners and dates, and a reinforcement action is ready if needed.", "Review weekly routing accuracy and manager feedback; coach teams when the target is missed."),
      actions: sustainActions.slice(0, 3), tables: [measuresTable],
      focusAreas: [
        { id: "listen", title: "Listen for feedback", description: "Review how questions, concerns, and manager feedback will be collected.", usage: "Feedback shows where people need more clarity, support, or follow-up.", actionIds: ["listen-feedback"] },
        { id: "measure", title: "Measure adoption", description: "Confirm a practical measure, target, data source, owner, and review date.", usage: "This shows whether people are adopting the change and where results are falling short.", tableIds: [measuresTable.id] },
        { id: "reinforce", title: "Reinforce the change", description: "Review the follow-up action to use when adoption or confidence is low.", usage: "This turns feedback and results into focused support instead of extra noise.", actionIds: ["reinforce-change"] },
      ],
    },
  ];
}

export function reusablePlanValues(phases: PlaybookPhase[]) {
  const tables = phases.flatMap((phase) => phase.tables ?? []);
  const rows = (id: string) => tables.find((table) => table.id === id)?.rows ?? [];
  const unique = (values: string[]) => [...new Set(values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter((item) => item && item !== NEEDS_INPUT && item !== "Not required"))];
  return {
    audiences: unique(rows("audiences").map((row) => row.audience ?? "")),
    stakeholders: unique(rows("stakeholders").map((row) => row.stakeholder ?? "")),
    owners: unique(phases.flatMap((phase) => [...phase.actions.map((item) => item.owner), ...(phase.tables ?? []).flatMap((table) => table.rows.map((row) => row.owner ?? ""))])),
    dates: unique(phases.flatMap((phase) => [...phase.actions.map((item) => item.when), ...(phase.tables ?? []).flatMap((table) => table.rows.map((row) => row.date ?? row.due ?? row.reviewDate ?? row.timing ?? ""))])),
  };
}

export type FocusArea = NonNullable<PlaybookPhase["focusAreas"]>[number];
export type AttentionItem = { focusId: string; label: string };

const readableKey = (key: string) => ({
  do: "Action", owner: "Owner", when: "Date", confirmation: "Confirmation details",
  audience: "Audience", leaderDo: "Leader action", audienceDo: "Expected behavior",
  messages: "Talking points", materials: "Preparation materials", channel: "Channel",
  changing: "What is changing", know: "What people need to know", support: "Support needed",
  feedback: "Feedback or questions", notes: "Notes or dependencies",
} as Record<string, string>)[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

function isMissing(valueToCheck: unknown) {
  return typeof valueToCheck !== "string" || !valueToCheck.trim() || valueToCheck.includes(NEEDS_INPUT);
}

export function focusAreaSignature(phase: PlaybookPhase, focus: FocusArea) {
  const actions = phase.actions.filter((item) => focus.actionIds?.includes(item.id));
  const tables = (phase.tables ?? []).filter((table) => focus.tableIds?.includes(table.id));
  return JSON.stringify({ actions, tables });
}

export function focusAreaAttention(phase: PlaybookPhase, focus: FocusArea): AttentionItem[] {
  const items: AttentionItem[] = [];
  const actions = phase.actions.filter((item) => focus.actionIds?.includes(item.id));
  actions.forEach((item, actionIndex) => {
    (["do", "owner", "when"] as const).forEach((key) => {
      if (isMissing(item[key])) items.push({ focusId: focus.id, label: `${focus.title}: ${readableKey(key)}${actions.length > 1 ? ` ${actionIndex + 1}` : ""}` });
    });
    if (isMissing(item.confirmation)) items.push({ focusId: focus.id, label: `${focus.title}: Confirmation details${actions.length > 1 ? ` ${actionIndex + 1}` : ""}` });
    Object.entries(item.details ?? {}).forEach(([key, detail]) => {
      if (isMissing(detail)) items.push({ focusId: focus.id, label: `${focus.title}: ${readableKey(key)}${actions.length > 1 ? ` ${actionIndex + 1}` : ""}` });
    });
  });
  (phase.tables ?? []).filter((table) => focus.tableIds?.includes(table.id)).forEach((table) => {
    const requiredColumns = table.columns.filter((column) => column.required && !column.advanced);
    table.rows.forEach((row, rowIndex) => requiredColumns.forEach((column) => {
      if (isMissing(row[column.key])) items.push({ focusId: focus.id, label: `${table.label}: ${column.label}${table.rows.length > 1 ? ` (entry ${rowIndex + 1})` : ""}` });
    }));
  });
  return [...new Map(items.map((item) => [item.label, item])).values()];
}

export function phaseAttentionItems(phase: PlaybookPhase, confirmedSections: Record<string, string> = {}) {
  return (phase.focusAreas ?? []).flatMap((focus) => {
    const missing = focusAreaAttention(phase, focus);
    const key = `${phase.id}:${focus.id}`;
    const confirmed = confirmedSections[key] === focusAreaSignature(phase, focus);
    return missing.length ? missing : confirmed ? [] : [{ focusId: focus.id, label: `${focus.title}: Review and confirm this section` }];
  });
}

export function changeCoachOverview(phases: PlaybookPhase[], confirmedSections: Record<string, string> = {}) {
  const phaseProgress = phases.map((phase) => {
    const focuses = phase.focusAreas ?? [];
    const confirmed = focuses.filter((focus) => confirmedSections[`${phase.id}:${focus.id}`] === focusAreaSignature(phase, focus)).length;
    const hasMissingInformation = focuses.some((focus) => focusAreaAttention(phase, focus).length > 0);
    return {
      id: phase.id,
      title: phase.title,
      icon: phase.icon,
      color: phase.color,
      confirmed,
      total: focuses.length,
      status: confirmed === focuses.length ? "Confirmed" : hasMissingInformation ? "Needs attention" : "Needs review",
    };
  });
  const totalSections = phaseProgress.reduce((total, phase) => total + phase.total, 0);
  const confirmedSectionsCount = phaseProgress.reduce((total, phase) => total + phase.confirmed, 0);
  const readinessPercent = totalSections ? Math.round((confirmedSectionsCount / totalSections) * 100) : 0;
  const attentionItems = phases.flatMap((phase) => phaseAttentionItems(phase, confirmedSections).map((item) => ({ ...item, phaseId: phase.id, phaseTitle: phase.title })));
  const audienceRows = phases.flatMap((phase) => phase.tables ?? []).find((table) => table.id === "audiences")?.rows ?? [];
  const highImpactAudiences = [...new Set(audienceRows.filter((row) => row.impact === "High").map((row) => row.audience).filter((audience) => audience && audience !== NEEDS_INPUT))];
  const next = nextActions(phases)[0];
  const nextPhase = next ? phases.find((phase) => phase.title === next.phase) : undefined;
  const nextFocus = nextPhase?.focusAreas?.find((focus) => focus.actionIds?.includes(next.id)) ?? nextPhase?.focusAreas?.[0];
  return {
    readinessPercent,
    confirmedSections: confirmedSectionsCount,
    totalSections,
    phaseProgress,
    topAttention: attentionItems[0] ?? null,
    highImpactAudiences,
    nextBestAction: next ? { label: next.do, phaseId: nextPhase?.id ?? phases[0]?.id ?? "spark", focusId: nextFocus?.id ?? "why" } : null,
  };
}

export function phaseSummary(phase: PlaybookPhase, phases: PlaybookPhase[] = [phase]) {
  const tables = phase.tables ?? [];
  const needsInput = [...phase.actions.flatMap((item) => Object.values(item).filter((itemValue) => itemValue === NEEDS_INPUT)), ...tables.flatMap((table) => table.rows.flatMap((row) => Object.values(row).filter((itemValue) => itemValue === NEEDS_INPUT)))].length;
  const names = (tableId: string, key: string) => tables.find((table) => table.id === tableId)?.rows.map((row) => row[key]).filter((item) => item && item !== NEEDS_INPUT).slice(0, 3) ?? [];
  if (phase.id === "spark") return { title: "Your Spark Plan", items: [{ label: "Why we’re changing", values: [separateSparkSources(phase.actions[0]?.confirmation || phase.actions[0]?.do || NEEDS_INPUT).content] }, { label: "Priority audiences", values: names("audiences", "audience") }, { label: "Key supporters", values: names("stakeholders", "stakeholder") }], needsInput };
  if (phase.id === "prepare") return { title: "Your Prepare Plan", items: [{ label: "Leader and manager actions", values: phase.actions.map((item) => item.do).slice(0, 3) }, { label: "Planned communications", values: names("communications", "purpose") }, { label: "Materials to create", values: names("deliverables", "deliverable") }], needsInput };
  if (phase.id === "activate") {
    const communications = phases.flatMap((item) => item.tables ?? []).find((table) => table.id === "communications");
    const channels = communications?.rows.map((row) => row.channel).filter((item) => item && item !== NEEDS_INPUT).slice(0, 3) ?? [];
    return { title: "Your Activation Plan", items: [{ label: "What happens first", values: names("launch", "action").slice(0, 1) }, { label: "Owners", values: names("launch", "owner") }, { label: "Channels used", values: channels }, { label: "What must be ready", values: names("launch", "dependency") }], needsInput };
  }
  return { title: "Your Sustain Plan", items: [{ label: "What will be measured", values: names("measures", "measure") }, { label: "How feedback will be collected", values: phase.actions.filter((item) => item.id === "listen-feedback").map((item) => item.use) }, { label: "Reinforcement actions", values: phase.actions.filter((item) => item.id === "reinforce-change").map((item) => item.do) }], needsInput };
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

export type DownloadKind = "full" | "communications" | "leaders";

function addExportSource(sources: Map<string, string>, value: string) {
  const entry = value.replace(/^\s*(?:sources?|references?|links?|urls?|documents?|citations?|evidence)\s*:\s*/i, "").replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
  if (!entry || /^(?:none|n\/a|not provided)$/i.test(entry) || /^(?:turn\d+(?:search|fetch|view)\d+|(?:source|retrieval)[-_ ]?id\b)/i.test(entry)) return;
  const key = entry.toLowerCase();
  if (!sources.has(key)) sources.set(key, entry);
}

function collectExportSources(value: string, sources: Map<string, string>, includePlainText = false) {
  const text = value || "";
  for (const match of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)) {
    addExportSource(sources, match[1]);
    addExportSource(sources, match[2]);
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)\]}>,]+/gi)) addExportSource(sources, match[0]);
  for (const match of text.matchAll(/\[([^\]]{2,160})\]/g)) addExportSource(sources, match[1]);
  for (const match of text.matchAll(/\b(?:source|reference|citation|evidence|document)\s*:\s*([^;\n]+?)(?=\s+https?:\/\/|$|[.;])/gi)) addExportSource(sources, match[1]);
  text.split(/\r?\n/).forEach((line) => {
    if (/^\s*(?:sources?|references?|links?|urls?|documents?|citations?|evidence|source ids?|retrieval ids?)\s*:/i.test(line)) {
      line.replace(/^\s*[^:]+:\s*/i, "").split(/\s*[|;]\s*/).forEach((entry) => addExportSource(sources, entry));
    } else if (includePlainText && line.trim()) {
      const withoutUrls = line.replace(/https?:\/\/[^\s)\]}>,]+/gi, "").trim();
      if (withoutUrls) addExportSource(sources, withoutUrls);
    }
  });
}

function cleanExportNarrative(value: string | undefined, sources: Map<string, string>) {
  const text = value || "";
  collectExportSources(text, sources);
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:sources?|references?|links?|urls?|documents?|citations?|evidence|source ids?|retrieval ids?)\s*:/i.test(line))
    .join("\n")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, "")
    .replace(/\b(?:source|reference|citation|evidence|document)\s*:\s*([^;\n]+?)(?=\s+https?:\/\/|$|[.;])/gi, "")
    .replace(/https?:\/\/[^\s)\]}>,]+/gi, "")
    .replace(/\[([^\]]{2,160})\]/g, "")
    .replace(/\b(?:turn\d+(?:search|fetch|view)\d+|(?:source|retrieval)[-_ ]?id\s*[:=]?\s*[^\s,;]+)/gi, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function appendExportSources(lines: string[], sources: Map<string, string>) {
  if (!sources.size) return;
  lines.push("", "Sources / References", ...Array.from(sources.values()).map((source) => `- ${source}`));
}

export function serializePlaybook(projectName: string, phases: PlaybookPhase[], options: { kind?: DownloadKind; confirmedSections?: Record<string, string> } = {}) {
  const kind = options.kind ?? "full";
  const confirmedSections = options.confirmedSections ?? {};
  const prepare = phases.find((phase) => phase.id === "prepare");
  if (kind === "communications") {
    const table = prepare?.tables?.find((item) => item.id === "communications");
    const focus = prepare?.focusAreas?.find((item) => item.id === "communications");
    const confirmed = Boolean(prepare && focus && confirmedSections[`${prepare.id}:${focus.id}`] === focusAreaSignature(prepare, focus));
    const sources = new Map<string, string>();
    const fields = [
      ["audience", "Audience"], ["purpose", "Purpose"], ["message", "Key Message"], ["sender", "Recommended Sender"],
      ["channel", "Recommended Channel"], ["timing", "Timing / Sequence"], ["cta", "Call to Action"],
      ["material", "Material to Create"], ["owner", "Owner"],
    ];
    const lines = [projectName || "Change activation playbook", "COMMUNICATIONS BRIEF", confirmed ? "Review status: Confirmed" : "Review status: NEEDS REVIEW — content may include unconfirmed AI-generated recommendations", ""];
    if (table?.rows.length) {
      table.rows.forEach((row, index) => {
        collectExportSources(row.sources || "", sources, true);
        lines.push(`COMMUNICATION ${index + 1}`);
        fields.forEach(([key, label]) => lines.push(`${label}: ${cleanExportNarrative(row[key], sources)}`));
        lines.push("");
      });
    } else lines.push("No communication actions are available.");
    appendExportSources(lines, sources);
    return lines.join("\n").trim();
  }
  if (kind === "leaders") {
    const focus = prepare?.focusAreas?.find((item) => item.id === "leaders");
    const confirmed = Boolean(prepare && focus && confirmedSections[`${prepare.id}:${focus.id}`] === focusAreaSignature(prepare, focus));
    const actions = prepare?.actions.filter((item) => focus?.actionIds?.includes(item.id)) ?? [];
    const sources = new Map<string, string>();
    const lines = [projectName || "Change activation playbook", "LEADER PREPARATION BRIEF", confirmed ? "Review status: Confirmed" : "Review status: NEEDS REVIEW — content may include unconfirmed AI-generated recommendations", ""];
    actions.forEach((item, index) => {
      collectExportSources(item.details?.sources || "", sources, true);
      lines.push(`ACTION ${index + 1}: ${cleanExportNarrative(item.do, sources)}`, `AUDIENCE: ${cleanExportNarrative(item.details?.audience || item.who, sources)}`, `WHAT THEY NEED TO KNOW: ${cleanExportNarrative(item.details?.know || NEEDS_INPUT, sources)}`, `WHAT THEY NEED TO DO: ${cleanExportNarrative(item.details?.leaderDo || item.do, sources)}`, `WHY IT MATTERS: ${cleanExportNarrative(item.details?.why || item.why, sources)}`, `KEY MESSAGE OR TALKING POINTS: ${cleanExportNarrative(item.details?.messages || NEEDS_INPUT, sources)}`, `COMMUNICATION APPROACH: ${cleanExportNarrative(item.details?.channel || item.use, sources)}`, `PREPARATION NEEDED: ${cleanExportNarrative(item.details?.materials || item.create, sources)}`, `TIMING OR SEQUENCE: ${cleanExportNarrative(item.when, sources)}`, `DONE WHEN: ${cleanExportNarrative(item.doneWhen, sources)}`, `OWNER: ${cleanExportNarrative(item.owner, sources)}`, "");
    });
    if (!actions.length) lines.push("No leader preparation actions are available.");
    appendExportSources(lines, sources);
    return lines.join("\n").trim();
  }
  const sources = new Map<string, string>();
  const lines = [projectName || "Change activation playbook", "Working implementation guide — human review required", "", "START HERE — YOUR NEXT 3 ACTIONS"];
  nextActions(phases).forEach((item, index) => lines.push(`${index + 1}. ${cleanExportNarrative(item.do, sources)} (${item.phase})`));
  lines.push("");
  for (const phase of phases) {
    lines.push(`PHASE ${phase.number} — ${phase.title.toUpperCase()}`, cleanExportNarrative(phase.purpose, sources), "");
    for (const focus of phase.focusAreas ?? []) {
      const confirmed = confirmedSections[`${phase.id}:${focus.id}`] === focusAreaSignature(phase, focus);
      lines.push(`${focus.title}: ${confirmed ? "CONFIRMED" : "NEEDS REVIEW"}`);
    }
    lines.push("");
    lines.push("INSTRUCTIONS", `Purpose: ${cleanExportNarrative(phase.instructions.purpose, sources)}`, `What to do: ${cleanExportNarrative(phase.instructions.whatToDo, sources)}`, `Where to enter it: ${cleanExportNarrative(phase.instructions.whereToEnter, sources)}`, `Required inputs: ${cleanExportNarrative(phase.instructions.requiredInputs, sources)}`, `Completion criteria: ${cleanExportNarrative(phase.instructions.completionCriteria, sources)}`, `Example: ${cleanExportNarrative(phase.instructions.example, sources)}`, "");
    for (const item of phase.actions) {
      lines.push(`[${item.completed ? "x" : " "}] ${cleanExportNarrative(item.do, sources)}`, `WHO: ${cleanExportNarrative(item.who, sources)}`, `USE: ${cleanExportNarrative(item.use, sources)}`, `CREATE: ${cleanExportNarrative(item.create, sources)}`, `OWNER: ${cleanExportNarrative(item.owner, sources)}`, `WHEN: ${cleanExportNarrative(item.when, sources)}`, `WHY: ${cleanExportNarrative(item.why, sources)}`, `DONE WHEN: ${cleanExportNarrative(item.doneWhen, sources)}`, `STATUS: ${cleanExportNarrative(item.status, sources)}`, `CONFIRM: ${cleanExportNarrative(item.confirmation, sources)}`, `HUMAN REVIEW: ${cleanExportNarrative(item.humanReview, sources)}`, "");
      if (item.details) Object.entries(item.details).forEach(([key, detail]) => key === "sources" || key === "references" ? collectExportSources(detail, sources, true) : lines.push(`${key}: ${cleanExportNarrative(detail, sources)}`));
      if (item.details) lines.push("");
    }
    for (const table of phase.tables ?? []) {
      const conciseColumns = table.columns.filter((column) => !column.advanced && !["sources", "references", "evidence"].includes(column.key));
      lines.push(table.label, conciseColumns.map((column) => column.label).join("\t"));
      table.rows.forEach((row) => {
        ["sources", "references", "evidence"].forEach((key) => collectExportSources(row[key] || "", sources, true));
        lines.push(conciseColumns.map((column) => cleanExportNarrative(row[column.key], sources)).join("\t"));
      });
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
  appendExportSources(lines, sources);
  return lines.join("\n").trim();
}
