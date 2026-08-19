import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("prototype implements the required eight-phase editable playbook", async () => {
  const [page, logic] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/playbook.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\.docx only/);
  assert.match(page, /processed in this browser/);
  assert.match(page, /setPlan\(makePlaybook/);
  assert.match(page, /serializePlaybook\(intake\.projectName, plan\)/);
  assert.match(page, /Your next 3 actions/);
  assert.match(page, /Mark complete/);
  assert.match(page, /addTableRow/);
  assert.match(page, /removeTableRow/);
  assert.equal((logic.match(/number: [1-8], title:/g) ?? []).length, 8);
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
