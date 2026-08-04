import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("prototype implements the required nine editable plan sections", async () => {
  const [page, logic] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/changeNavigator.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\.docx only/);
  assert.match(page, /processed in this browser/);
  assert.match(page, /setPlan\(makePlan/);
  assert.equal((logic.match(/title: "\d\./g) ?? []).length, 9);
});

test("governance and writing guardrails are visible in the implementation", async () => {
  const [page, logic, readme] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/changeNavigator.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Reach never comes before readiness/);
  assert.match(logic, /Suggested—confirm with Communications/);
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
