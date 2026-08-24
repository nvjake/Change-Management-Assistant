import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prototype implements the required four-phase guided playbook", async () => {
  const [page, logic, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/playbook.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\.docx only/);
  assert.match(page, /processed in this browser/);
  assert.match(page, /const generated = makePlaybook/);
  assert.match(page, /setCurrentPhaseIndex/);
  assert.match(page, /phaseSummary/);
  assert.match(page, /serializePlaybook\(intake\.projectName, plan, \{ kind, confirmedSections \}\)/);
  assert.match(page, /Your next 3 actions/);
  assert.match(page, /Mark complete/);
  assert.match(page, /addTableRow/);
  assert.match(page, /addPhaseAction/);
  assert.match(page, /removeTableRow/);
  assert.match(logic, /title: "Spark"/);
  assert.match(logic, /title: "Prepare"/);
  assert.match(logic, /title: "Activate"/);
  assert.match(logic, /title: "Sustain"/);
  assert.match(page, /\+ Add another/);
  assert.match(page, /Confirm this section/);
  assert.match(page, /Needs attention/);
  assert.match(page, /Create &amp; Download My Activation Plan/);
  assert.match(page, /Download Communications Brief/);
  assert.match(page, /Download Leader Preparation Brief/);
  assert.match(page, /Change Coach/);
  assert.match(page, /Here’s where your change stands/);
  assert.match(page, /High-impact audiences/);
  assert.match(page, /Next best action/);
  assert.match(page, /goToFocus/);
  assert.match(page, /Leader \/ Manager Preparation/);
  assert.match(page, /Sources \/ Evidence/);
  assert.match(page, /Timing or Sequence/);
  assert.match(page, /leader-manager-flow/);
  assert.match(page, /Sources \/ Evidence/);
  assert.match(page, /isLeaderEntry \|\| isAudienceEntry \|\| editingActionId === item\.id/);
  assert.match(page, /sourceDocumentText: sourceText/);
  assert.match(styles, /\[data-phase-id="prepare"\] > \.action-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.action-list > \.leader-manager-card,[\s\S]*\.action-list > \.add-entry \{ grid-column: 1 \/ -1; width: 100%/);
  assert.match(page, /Affected Audience Preparation — Entry/);
  assert.match(page, /audience-preparation-flow/);
  assert.match(page, /\+ Add another.*affected audience/);
  assert.match(styles, /\[data-phase-id="activate"\] > \.action-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.action-list > \.audience-preparation-card,[\s\S]*\.action-list > \.add-entry \{ grid-column: 1 \/ -1; width: 100%/);
  assert.match(page, /updateSparkNotes/);
  assert.match(page, /Sources \/ References/);
  assert.match(page, /spark-plan-flow/);
  assert.match(styles, /\[data-phase-id="spark"\] > \.action-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\[data-phase-id="spark"\] \.summary-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\[data-phase-id="spark"\][\s\S]*overflow-wrap: anywhere/);
});

test("governance and writing guardrails are visible in the implementation", async () => {
  const [page, logic, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/changeNavigator.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Reach never comes before readiness/);
  assert.match(logic, /Recommended - confirm with Communications/);
  assert.match(logic, /human-support boundary/);
  assert.match(logic, /What’s new:/);
  assert.match(readme, /nothing is uploaded or retained/i);
});

test("the Windows-safe launcher serves client assets before proxying the app", async () => {
  const launcher = await readFile(new URL("../scripts/serve-local.mjs", import.meta.url), "utf8");
  assert.match(launcher, /dist", "client/);
  assert.match(launcher, /createReadStream\(staticFile\.candidate\)\.pipe/);
  assert.match(launcher, /requestHttp/);
});
