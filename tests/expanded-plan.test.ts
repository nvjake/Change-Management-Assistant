import assert from "node:assert/strict";
import test from "node:test";
import {
  assessChange,
  makePlan,
  NEEDS_INPUT,
  serializePlan,
  type Intake,
} from "../lib/changeNavigator.ts";

const intake: Intake = {
  projectName: "Care workflow update",
  outcome: "Reduce avoidable handoffs while preserving human support.",
  changeSummary: "Customer Care Team Members will use a revised case-routing workflow.",
  audiences: "Customer Care, Operations leaders",
  timing: "October 12",
  readiness: "Pilot feedback is available.",
  sensitivities: "Customer experience requires review.",
};

test("expanded generation creates nine evidence-separated working sections", () => {
  const plan = makePlan(intake, assessChange(intake));
  assert.equal(plan.length, 9);
  for (const section of plan) {
    assert.ok(section.sourceSupported.length > 0, `${section.id} has source-supported content`);
    assert.ok(section.suggestedActions.length > 0, `${section.id} has suggested actions`);
    assert.ok(section.needsInput.length > 0, `${section.id} identifies missing input`);
  }
  assert.equal(plan.find((section) => section.id === "audiences")?.table?.rows.length, 2);
  assert.equal(plan.find((section) => section.id === "communications")?.table?.columns.length, 10);
  assert.equal(plan.find((section) => section.id === "risk")?.table?.columns.length, 9);
});

test("missing facts are labeled and edited matrix data survives download", () => {
  const plan = makePlan(intake, assessChange(intake));
  const stakeholderPlan = plan.find((section) => section.id === "stakeholders");
  assert.ok(stakeholderPlan?.table?.rows.some((row) => row.owner === NEEDS_INPUT));

  const communicationPlan = plan.find((section) => section.id === "communications");
  assert.ok(communicationPlan?.table);
  communicationPlan.table.rows[0].owner = "Change lead";
  communicationPlan.table.rows[0].channel = "Leader huddle";
  communicationPlan.table.rows[0].timing = "October 5";

  const download = serializePlan(intake.projectName, plan);
  assert.match(download, /1\. Change overview and case for change/);
  assert.match(download, /Source-supported information/);
  assert.match(download, /Suggested plan actions/);
  assert.match(download, /Information to provide or confirm/);
  assert.match(download, /Communication matrix/);
  assert.match(download, /Change lead/);
  assert.match(download, /Leader huddle/);
  assert.match(download, /October 5/);
});
