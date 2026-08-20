import assert from "node:assert/strict";
import test from "node:test";
import { assessChange, buildConnectorRequest, NEEDS_INPUT, parseEvidencePack, type Intake } from "../lib/changeNavigator.ts";
import { focusAreaAttention, focusAreaSignature, makePlaybook, nextActions, phaseAttentionItems, phaseSummary, reusablePlanValues, serializePlaybook } from "../lib/playbook.ts";

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
  const missing = focusAreaAttention(prepare, communications);
  assert.ok(missing.some((item) => item.label.includes("Recommended sender")));
  assert.ok(missing.some((item) => item.label.includes("Owner")));
  const confirmed = { "prepare:communications": focusAreaSignature(prepare, communications) };
  assert.ok(phaseAttentionItems(prepare, confirmed).some((item) => item.label.includes("Owner")));
  const before = confirmed["prepare:communications"];
  prepare.tables!.find((table) => table.id === "communications")!.rows[0].owner = "Change lead";
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
  assert.match(leaders, /Align the accountable leader/);
  assert.match(full, /Why this change: NEEDS REVIEW/);
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
  assert.equal(sequence.columns.length, 14);
  assert.ok(sequence.rows.every((row) => /^\d+$/.test(row.sequence)));
  assert.ok(sequence.rows.some((row) => row.channel.includes("Suggested — confirm with Communications")));
  assert.ok(sequence.rows.every((row) => row.owner === NEEDS_INPUT));
});

test("download mirrors the playbook and includes open decisions", () => {
  const download = serializePlaybook(intake.projectName, makePlaybook(intake, assessChange(intake)));
  assert.match(download, /START HERE — YOUR NEXT 3 ACTIONS/);
  assert.match(download, /PHASE 1 — SPARK/);
  assert.match(download, /PHASE 2 — PREPARE/);
  assert.match(download, /PHASE 3 — ACTIVATE/);
  assert.match(download, /PHASE 4 — SUSTAIN/);
  assert.match(download, /Ordered communication sequence/);
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
