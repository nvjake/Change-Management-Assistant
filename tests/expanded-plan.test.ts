import assert from "node:assert/strict";
import test from "node:test";
import { assessChange, buildConnectorRequest, NEEDS_INPUT, parseEvidencePack, type Intake } from "../lib/changeNavigator.ts";
import { changeCoachOverview, collectPrepareContext, focusAreaAttention, focusAreaSignature, makePlaybook, nextActions, phaseSummary, reusablePlanValues, serializePlaybook } from "../lib/playbook.ts";

const intake: Intake = {
  projectName: "Care workflow update",
  outcome: "Reduce avoidable handoffs while preserving human support.",
  changeSummary: "Customer Care Team Members and managers will use a revised case-routing workflow.",
  audiences: "Customer Care, Operations leaders",
  timing: "October 12",
  readiness: "Pilot feedback is available.",
  sensitivities: "Customer experience requires review.",
};

test("playbook follows the required four-phase guided sequence", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  assert.deepEqual(playbook.map((phase) => phase.title), ["Spark", "Prepare", "Activate", "Sustain"]);
  assert.equal(nextActions(playbook).length, 3);
  assert.ok(playbook[0].checklist?.length);
  assert.ok(playbook.every((phase) => phase.focusAreas?.length === 3));
  assert.ok(playbook.find((phase) => phase.id === "spark")?.tables?.some((table) => table.id === "audiences"));
  assert.ok(playbook.flatMap((phase) => phase.tables ?? []).every((table) => table.rows.length <= 3));
});

test("phase instructions and structured controls are defined consistently", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  assert.ok(playbook.every((phase) => phase.instructions.purpose && phase.instructions.whatToDo && phase.instructions.whereToEnter && phase.instructions.requiredInputs && phase.instructions.completionCriteria && phase.instructions.example));
  const impact = playbook.find((phase) => phase.id === "spark")?.tables?.find((table) => table.id === "audiences");
  assert.equal(impact?.columns.find((column) => column.key === "impact")?.control, "select");
  assert.equal(impact?.columns.find((column) => column.key === "impact")?.advanced, false);
  assert.equal(impact?.columns.find((column) => column.key === "effect")?.advanced, false);
  assert.deepEqual(impact?.columns.find((column) => column.key === "impact")?.options, ["Low", "Medium", "High"]);
  assert.equal(impact?.columns.find((column) => column.key === "effect")?.label, "Why this rating?");
  assert.equal(impact?.columns.find((column) => column.key === "do")?.label, "Expected behavior");
  assert.equal(impact?.columns.find((column) => column.key === "importantDates")?.advanced, false);
  assert.equal(impact?.columns.find((column) => column.key === "humanReview")?.control, "yes-no");
  const measures = playbook.find((phase) => phase.id === "sustain")?.tables?.[0];
  assert.equal(measures?.columns.find((column) => column.key === "reviewDate")?.control, "date");
  assert.equal(measures?.columns.find((column) => column.key === "status")?.control, "status");
  assert.ok(measures?.columns.filter((column) => column.required).length);
});

test("section review names missing work and detects edits after confirmation", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  const prepare = playbook.find((phase) => phase.id === "prepare")!;
  const communications = prepare.focusAreas!.find((focus) => focus.id === "communications")!;
  const table = prepare.tables!.find((item) => item.id === "communications")!;
  assert.ok(!focusAreaAttention(prepare, communications).some((item) => item.label.includes("Owner")));
  table.rows[0].owner = NEEDS_INPUT;
  assert.ok(focusAreaAttention(prepare, communications).some((item) => item.label.includes("Owner")));
  table.rows[0].owner = "Communications Owner — confirm name";
  const confirmed = { "prepare:communications": focusAreaSignature(prepare, communications) };
  const before = confirmed["prepare:communications"];
  table.rows[0].owner = "Change lead";
  assert.notEqual(focusAreaSignature(prepare, communications), before);
});

test("Activate uses plain launch timeline wording and nearby guidance", () => {
  const activate = makePlaybook(intake, assessChange(intake)).find((phase) => phase.id === "activate")!;
  const launch = activate.tables!.find((table) => table.id === "launch")!;
  assert.equal(launch.label, "Launch Timeline");
  assert.match(launch.description ?? "", /put launch activities in the order/i);
  assert.equal(launch.columns.find((column) => column.key === "action")?.label, "What needs to happen?");
  assert.equal(launch.columns.find((column) => column.key === "status")?.advanced, false);
});

test("full and breakout downloads reuse plan information and flag unconfirmed content", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  const communications = serializePlaybook(intake.projectName, playbook, { kind: "communications" });
  const leaders = serializePlaybook(intake.projectName, playbook, { kind: "leaders" });
  const full = serializePlaybook(intake.projectName, playbook, { kind: "full" });
  assert.match(communications, /COMMUNICATIONS BRIEF/);
  assert.match(communications, /Customer Care/);
  assert.match(communications, /NEEDS REVIEW/);
  assert.match(leaders, /LEADER PREPARATION BRIEF/);
  assert.match(leaders, /Align on the change story/);
  assert.match(full, /Why this change: NEEDS REVIEW/);
});

test("Change Coach overview uses transparent readiness and existing plan data", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  const initial = changeCoachOverview(playbook);
  assert.equal(initial.totalSections, 12);
  assert.equal(initial.confirmedSections, 0);
  assert.equal(initial.readinessPercent, 0);
  assert.equal(initial.phaseProgress.length, 4);
  assert.equal(initial.topAttention?.phaseId, "spark");
  assert.equal(initial.nextBestAction?.label, nextActions(playbook)[0].do);

  const spark = playbook.find((phase) => phase.id === "spark")!;
  const why = spark.focusAreas!.find((focus) => focus.id === "why")!;
  spark.tables!.find((table) => table.id === "audiences")!.rows[0].impact = "High";
  const updated = changeCoachOverview(playbook, { "spark:why": focusAreaSignature(spark, why) });
  assert.equal(updated.confirmedSections, 1);
  assert.equal(updated.readinessPercent, 8);
  assert.ok(updated.highImpactAudiences.includes("Customer Care"));
});

test("next actions update when an action is completed", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  const before = nextActions(playbook);
  playbook[0].actions[0].completed = true;
  const after = nextActions(playbook);
  assert.notEqual(before[0].id, after[0].id);
  assert.ok(after.every((item) => item.id !== before[0].id));
});

test("small changes receive a proportionate plan and larger changes receive added support", () => {
  const small: Intake = { ...intake, changeSummary: "Update one internal reference label.", audiences: "One operations team", readiness: "Ready", sensitivities: "None" };
  const large: Intake = { ...intake, changeSummary: "AI automation changes manager workflows and customer-facing decisions.", sensitivities: "Privacy, legal, staffing, and external review required." };
  const smallPlaybook = makePlaybook(small, { ...assessChange(small), size: "XS" });
  const largePlaybook = makePlaybook(large, { ...assessChange(large), size: "XL" });
  assert.ok(largePlaybook.flatMap((phase) => phase.actions).length > smallPlaybook.flatMap((phase) => phase.actions).length);
  const largeDeliverables = largePlaybook.find((phase) => phase.id === "prepare")?.tables?.find((table) => table.id === "deliverables");
  const smallDeliverables = smallPlaybook.find((phase) => phase.id === "prepare")?.tables?.find((table) => table.id === "deliverables");
  assert.ok(largeDeliverables?.rows.some((row) => row.deliverable === "FAQ"));
  assert.ok(!smallDeliverables?.rows.some((row) => row.deliverable === "FAQ"));
});

test("communication sequence is ordered, editable, and clearly labels suggestions", () => {
  const sequence = makePlaybook(intake, assessChange(intake)).find((phase) => phase.id === "prepare")?.tables?.find((table) => table.id === "communications");
  assert.ok(sequence);
  assert.equal(sequence.label, "Recommended Communication Sequence");
  assert.equal(sequence.columns.length, 15);
  assert.ok(sequence.rows.every((row) => /^\d+$/.test(row.sequence)));
  assert.ok(sequence.rows.some((row) => row.channel.includes("Suggested — confirm with Communications")));
  assert.ok(sequence.rows.every((row) => row.owner !== NEEDS_INPUT));
  assert.ok(sequence.rows.some((row) => /align leaders/i.test(row.purpose)));
  assert.ok(sequence.rows.some((row) => /prepare managers/i.test(row.purpose)));
  assert.deepEqual(sequence.columns.find((column) => column.key === "channel")?.options, ["Leader Meeting", "Manager Briefing", "Team Meeting", "Email", "Slack", "FAQ", "Job Aid", "Training", "Office Hours", "Intranet or Internal Page", "Other"]);
});

test("Prepare reuses known information and keeps sources out of audience messages", () => {
  const linkedIntake: Intake = {
    ...intake,
    changeSummary: "Customer Care will use a revised routing workflow. https://example.com/change-brief",
    externalSources: "Sources: Decision log\nhttps://example.com/decision-log",
  };
  const prepare = makePlaybook(linkedIntake, assessChange(linkedIntake)).find((phase) => phase.id === "prepare")!;
  const leaders = prepare.actions.filter((item) => item.details?.leaderDo);
  const communications = prepare.tables!.find((table) => table.id === "communications")!;
  assert.ok(leaders.every((item) => item.owner !== NEEDS_INPUT && item.details?.messages && item.details.messages !== NEEDS_INPUT));
  assert.ok(leaders.every((item) => !/https?:\/\//.test(item.details?.messages ?? "")));
  assert.ok(leaders.some((item) => /example\.com/.test(item.details?.sources ?? "")));
  assert.ok(communications.rows.every((row) => !/https?:\/\//.test(row.message)));
  assert.ok(communications.rows.some((row) => /example\.com/.test(row.sources)));
  assert.equal(communications.columns.find((column) => column.key === "sources")?.label, "Sources / References");
  const brief = serializePlaybook(linkedIntake.projectName, [prepare], { kind: "communications" });
  assert.match(brief, /Sources \/ References/);
});

test("Prepare generation receives document, connector, evidence, and prior app context", () => {
  const contextualIntake: Intake = { ...intake, audiences: "Customer Care", timing: "" };
  const assessment = assessChange(contextualIntake);
  const generationInputs = {
    sourceDocumentText: "Supervisors will explain the revised workflow to Customer Care and support guided practice.",
    connectorRequest: "Review the Care workflow project in SharePoint and Outlook.",
    evidencePack: "READINESS EVIDENCE: Pilot testing identified manager questions.\nSOURCES:\nhttps://example.com/pilot-notes",
    connectorSources: ["SharePoint", "Outlook email"],
    searchGuidance: "Use the latest pilot evidence.",
  };
  const context = collectPrepareContext(contextualIntake, assessment, generationInputs);
  assert.match(context.signalText, /Supervisors will explain/);
  assert.match(context.signalText, /latest pilot evidence/);
  assert.deepEqual(context.connectorSources, ["SharePoint", "Outlook email"]);
  const prepare = makePlaybook(contextualIntake, assessment, generationInputs).find((phase) => phase.id === "prepare")!;
  const leaders = prepare.actions.filter((item) => item.details?.leaderDo);
  assert.ok(leaders.some((item) => /manager|supervisor/i.test(item.details?.audience ?? "")));
  assert.ok(leaders.every((item) => item.when !== NEEDS_INPUT));
  assert.ok(leaders.every((item) => item.details?.know && item.details?.why && item.details?.messages && item.details?.doneWhen));
  assert.ok(leaders.every((item) => !/https?:\/\//.test(item.details?.messages ?? "")));
  assert.ok(leaders.some((item) => /example\.com\/pilot-notes/.test(item.details?.sources ?? "")));
});

test("Activate affected audiences reuse earlier context as full first drafts", () => {
  const linkedIntake: Intake = {
    ...intake,
    externalEvidence: "Managers will brief Customer Care before launch.",
    externalSources: "https://example.com/activation-evidence",
  };
  const playbook = makePlaybook(linkedIntake, assessChange(linkedIntake));
  const prepare = playbook.find((phase) => phase.id === "prepare")!;
  const activate = playbook.find((phase) => phase.id === "activate")!;
  const prepareCommunications = prepare.tables!.find((table) => table.id === "communications")!.rows;
  assert.equal(activate.actions.length, 2);
  assert.deepEqual(activate.actions.map((item) => item.details?.audience), ["Customer Care", "Operations leaders"]);
  assert.ok(activate.actions.every((item) => item.owner !== NEEDS_INPUT && item.when !== NEEDS_INPUT && item.doneWhen !== NEEDS_INPUT));
  assert.ok(activate.actions.every((item) => item.details?.changing && item.details?.know && item.details?.audienceDo && item.details?.messages && item.details?.channel && item.details?.support && item.details?.sources));
  assert.ok(activate.actions.every((item) => !/https?:\/\//.test(item.details?.messages ?? "")));
  assert.ok(activate.actions.every((item) => /example\.com\/activation-evidence/.test(item.details?.sources ?? "")));
  assert.ok(activate.actions.some((item) => prepareCommunications.some((row) => row.channel === item.details?.channel)));
});

test("download mirrors the playbook and includes open decisions", () => {
  const download = serializePlaybook(intake.projectName, makePlaybook(intake, assessChange(intake)));
  assert.match(download, /START HERE — YOUR NEXT 3 ACTIONS/);
  assert.match(download, /PHASE 1 — SPARK/);
  assert.match(download, /PHASE 2 — PREPARE/);
  assert.match(download, /PHASE 3 — ACTIVATE/);
  assert.match(download, /PHASE 4 — SUSTAIN/);
  assert.match(download, /Recommended Communication Sequence/);
  assert.match(download, /OPEN DECISIONS \/ NEEDS USER INPUT/);
  assert.match(download, /DONE WHEN:/);
});

test("Spark information is reusable and summaries update with edits", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  const spark = playbook.find((phase) => phase.id === "spark")!;
  const audience = spark.tables!.find((table) => table.id === "audiences")!;
  audience.rows[0].audience = "Pharmacy Operations";
  assert.ok(reusablePlanValues(playbook).audiences.includes("Pharmacy Operations"));
  assert.ok(playbook.find((phase) => phase.id === "prepare")?.tables?.find((table) => table.id === "communications")?.columns.find((column) => column.key === "audience")?.reuse === "audiences");
  assert.ok(phaseSummary(spark).items.find((item) => item.label === "Priority audiences")?.values.includes("Pharmacy Operations"));
});

test("connector workflow remains read-only and imported evidence grounds the playbook", () => {
  const request = buildConnectorRequest({ projectName: intake.projectName, searchGuidance: "Last 30 days", sources: ["SharePoint", "Outlook email", "Slack"], route: "connected-sources" });
  assert.match(request, /Do not send, edit, post, react, or change/);
  const evidence = parseEvidencePack(`PROJECT NAME: Care routing launch\nTIMING: October 12\nWHAT'S CHANGING: Revised routing workflow.\nWHY IT MATTERS: Reduce handoffs.\nWHO IS AFFECTED: Customer Care\nREADINESS EVIDENCE: Pilot complete.\nSENSITIVITIES AND APPROVALS: Needs user input\nSOURCES: SharePoint | Decision log | September 28 | Project site`);
  const enriched = { ...intake, ...evidence };
  assert.match(makePlaybook(enriched, assessChange(enriched))[0].source, /connected-source evidence/);
});
