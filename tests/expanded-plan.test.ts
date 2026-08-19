import assert from "node:assert/strict";
import test from "node:test";
import { assessChange, buildConnectorRequest, NEEDS_INPUT, parseEvidencePack, type Intake } from "../lib/changeNavigator.ts";
import { makePlaybook, nextActions, serializePlaybook } from "../lib/playbook.ts";

const intake: Intake = {
  projectName: "Care workflow update",
  outcome: "Reduce avoidable handoffs while preserving human support.",
  changeSummary: "Customer Care Team Members and managers will use a revised case-routing workflow.",
  audiences: "Customer Care, Operations leaders",
  timing: "October 12",
  readiness: "Pilot feedback is available.",
  sensitivities: "Customer experience requires review.",
};

test("playbook follows the required eight-phase guided sequence", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  assert.deepEqual(playbook.map((phase) => phase.title), [
    "Understand the change", "Identify who needs to be involved", "Prepare leaders and managers",
    "Build the communication sequence", "Prepare the materials", "Prepare people for the change",
    "Launch", "Reinforce and measure",
  ]);
  assert.equal(nextActions(playbook).length, 3);
  assert.ok(playbook[0].checklist?.length);
  assert.match(playbook[0].instructions.whereToEnter, /Action or decision required/);
  assert.ok(playbook.find((phase) => phase.id === "people-involved")?.tables?.some((table) => table.id === "audiences"));
});

test("phase instructions and structured controls are defined consistently", () => {
  const playbook = makePlaybook(intake, assessChange(intake));
  assert.ok(playbook.every((phase) => phase.instructions.purpose && phase.instructions.whatToDo && phase.instructions.whereToEnter && phase.instructions.requiredInputs && phase.instructions.completionCriteria && phase.instructions.example));
  const impact = playbook.find((phase) => phase.id === "people-involved")?.tables?.find((table) => table.id === "audiences");
  assert.equal(impact?.columns.find((column) => column.key === "impact")?.control, "select");
  assert.equal(impact?.columns.find((column) => column.key === "impact")?.options?.length, 5);
  assert.equal(impact?.columns.find((column) => column.key === "humanReview")?.control, "yes-no");
  const measures = playbook.find((phase) => phase.id === "reinforce")?.tables?.[0];
  assert.equal(measures?.columns.find((column) => column.key === "reviewDate")?.control, "date");
  assert.equal(measures?.columns.find((column) => column.key === "status")?.control, "status");
  assert.ok(measures?.columns.filter((column) => column.required).length);
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
  assert.ok(largePlaybook.find((phase) => phase.id === "materials")?.tables?.[0].rows.some((row) => row.deliverable === "FAQ"));
  assert.ok(!smallPlaybook.find((phase) => phase.id === "materials")?.tables?.[0].rows.some((row) => row.deliverable === "FAQ"));
});

test("communication sequence is ordered, editable, and clearly labels suggestions", () => {
  const sequence = makePlaybook(intake, assessChange(intake)).find((phase) => phase.id === "communications")?.tables?.[0];
  assert.ok(sequence);
  assert.equal(sequence.columns.length, 14);
  assert.ok(sequence.rows.every((row) => /^\d+$/.test(row.sequence)));
  assert.ok(sequence.rows.some((row) => row.channel.includes("Suggested — confirm with Communications")));
  assert.ok(sequence.rows.every((row) => row.owner === NEEDS_INPUT));
});

test("download mirrors the playbook and includes open decisions", () => {
  const download = serializePlaybook(intake.projectName, makePlaybook(intake, assessChange(intake)));
  assert.match(download, /START HERE — YOUR NEXT 3 ACTIONS/);
  assert.match(download, /PHASE 1 — UNDERSTAND THE CHANGE/);
  assert.match(download, /Ordered communication sequence/);
  assert.match(download, /OPEN DECISIONS \/ NEEDS USER INPUT/);
  assert.match(download, /DONE WHEN:/);
});

test("connector workflow remains read-only and imported evidence grounds the playbook", () => {
  const request = buildConnectorRequest({ projectName: intake.projectName, searchGuidance: "Last 30 days", sources: ["SharePoint", "Outlook email", "Slack"], route: "connected-sources" });
  assert.match(request, /Do not send, edit, post, react, or change/);
  const evidence = parseEvidencePack(`PROJECT NAME: Care routing launch\nTIMING: October 12\nWHAT'S CHANGING: Revised routing workflow.\nWHY IT MATTERS: Reduce handoffs.\nWHO IS AFFECTED: Customer Care\nREADINESS EVIDENCE: Pilot complete.\nSENSITIVITIES AND APPROVALS: Needs user input\nSOURCES: SharePoint | Decision log | September 28 | Project site`);
  const enriched = { ...intake, ...evidence };
  assert.match(makePlaybook(enriched, assessChange(enriched))[0].source, /connected-source evidence/);
});
