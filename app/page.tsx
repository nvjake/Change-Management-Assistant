"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  assessChange,
  extractHints,
  Intake,
  makePlan,
  NEEDS_INPUT,
  PlanSection,
  serializePlan,
  writingChecks,
} from "../lib/changeNavigator";

declare global {
  interface Window {
    JSZip?: {
      loadAsync(data: ArrayBuffer): Promise<{
        file(name: string): { async(type: "string"): Promise<string> } | null;
      }>;
    };
  }
}

const emptyIntake: Intake = {
  projectName: "",
  outcome: "",
  changeSummary: "",
  audiences: "",
  timing: "",
  readiness: "",
  sensitivities: "",
};

async function readDocx(file: File) {
  if (!window.JSZip) throw new Error("The local document reader is still loading. Try again in a moment.");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("This file does not contain a readable Word document.");
  const xml = new DOMParser().parseFromString(documentXml, "application/xml");
  return Array.from(xml.getElementsByTagNameNS("*", "p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS("*", "t"))
        .map((node) => node.textContent ?? "")
        .join(""),
    )
    .filter(Boolean)
    .join("\n");
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [fileName, setFileName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [status, setStatus] = useState("Upload a Word document to begin");
  const [plan, setPlan] = useState<PlanSection[]>([]);
  const assessment = useMemo(() => assessChange(intake), [intake]);
  const checks = useMemo(() => writingChecks(plan), [plan]);

  const update = (field: keyof Intake, value: string) =>
    setIntake((current) => ({ ...current, [field]: value }));

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setStatus("Please choose a .docx file for version one");
      return;
    }
    setStatus("Reading locally…");
    try {
      const text = await readDocx(file);
      setSourceText(text);
      setFileName(file.name);
      setIntake((current) => ({ ...current, ...extractHints(text, file.name) }));
      setPlan([]);
      setStatus("Document read. Review the extracted details and fill the gaps");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The document could not be read");
    }
  };

  const generate = () => {
    setPlan(makePlan(intake, assessment));
    setStatus("Draft generated. Edit any section before using it");
    window.setTimeout(() => document.getElementById("plan")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const updatePlanField = (
    sectionIndex: number,
    category: "sourceSupported" | "suggestedActions" | "needsInput",
    fieldIndex: number,
    value: string,
  ) => {
    setPlan((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex) return section;
      return {
        ...section,
        [category]: section[category].map((item, currentFieldIndex) =>
          currentFieldIndex === fieldIndex ? { ...item, value } : item),
      };
    }));
  };

  const updateTableCell = (sectionIndex: number, rowIndex: number, key: string, value: string) => {
    setPlan((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex || !section.table) return section;
      return {
        ...section,
        table: {
          ...section.table,
          rows: section.table.rows.map((row, currentRowIndex) =>
            currentRowIndex === rowIndex ? { ...row, [key]: value } : row),
        },
      };
    }));
  };

  const addTableRow = (sectionIndex: number) => {
    setPlan((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex || !section.table) return section;
      const emptyRow = Object.fromEntries(section.table.columns.map((column) => [column.key, NEEDS_INPUT]));
      return { ...section, table: { ...section.table, rows: [...section.table.rows, emptyRow] } };
    }));
  };

  const removeTableRow = (sectionIndex: number, rowIndex: number) => {
    setPlan((current) => current.map((section, currentSectionIndex) => {
      if (currentSectionIndex !== sectionIndex || !section.table) return section;
      return {
        ...section,
        table: { ...section.table, rows: section.table.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex) },
      };
    }));
  };

  const clear = () => {
    setIntake(emptyIntake);
    setFileName("");
    setSourceText("");
    setPlan([]);
    setStatus("Upload a Word document to begin");
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = () => {
    const body = serializePlan(intake.projectName, plan);
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${intake.projectName || "change-activation-plan"}.txt`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Chewy Change Activation Assistant home">
          <span className="brand-mark">C</span>
          <span>Change Activation Assistant</span>
        </a>
        <div className="privacy"><span /> Local prototype · nothing is stored</div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Decision support for thoughtful change</p>
          <h1>Turn a project document into a right-sized activation plan</h1>
          <p className="lede">Upload one Word document. Review what was found, close the important gaps, and create an editable plan grounded in the Change Navigation framework.</p>
        </div>
        <aside className="principle">
          <span>Core readiness rule</span>
          <strong>Reach never comes before readiness</strong>
        </aside>
      </section>

      <nav className="steps" aria-label="Progress">
        <span className={fileName ? "done" : "active"}><b>1</b> Upload</span>
        <i />
        <span className={fileName && !plan.length ? "active" : fileName ? "done" : ""}><b>2</b> Review</span>
        <i />
        <span className={plan.length ? "active" : ""}><b>3</b> Plan</span>
      </nav>

      <section className="workspace">
        <div className="upload-card">
          <div className="section-heading">
            <div><span className="kicker">Step 1</span><h2>Project document</h2></div>
            {fileName && <button className="text-button" onClick={clear}>Clear</button>}
          </div>
          <button className="dropzone" onClick={() => inputRef.current?.click()}>
            <span className="upload-icon">↑</span>
            <strong>{fileName || "Choose a Word document"}</strong>
            <small>{fileName ? "Choose a different file" : ".docx only · processed in this browser"}</small>
          </button>
          <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} hidden />
          <p className="status" role="status"><span />{status}</p>
          {sourceText && <p className="found">Found {sourceText.split(/\s+/).length.toLocaleString()} words in the uploaded document</p>}
        </div>

        <div className={`review-card ${fileName ? "" : "muted"}`}>
          <div className="section-heading">
            <div><span className="kicker">Step 2</span><h2>Review and complete</h2></div>
            {fileName && <span className={`size size-${assessment.size.toLowerCase()}`}>{assessment.size} path</span>}
          </div>
          <div className="form-grid">
            <label>Project name<input value={intake.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="Name this change" disabled={!fileName} /></label>
            <label>Timing<input value={intake.timing} onChange={(e) => update("timing", e.target.value)} placeholder="Launch date or window" disabled={!fileName} /></label>
            <label className="wide">What’s changing?<textarea value={intake.changeSummary} onChange={(e) => update("changeSummary", e.target.value)} placeholder="Describe the essential change" disabled={!fileName} /></label>
            <label className="wide">Why does it matter?<textarea value={intake.outcome} onChange={(e) => update("outcome", e.target.value)} placeholder="Intended outcome and audience value" disabled={!fileName} /></label>
            <label className="wide">Who is affected?<input value={intake.audiences} onChange={(e) => update("audiences", e.target.value)} placeholder="Functions, roles, leader levels, customers, or partners" disabled={!fileName} /></label>
            <label>Readiness evidence<textarea value={intake.readiness} onChange={(e) => update("readiness", e.target.value)} placeholder="Leader confidence, training, testing, support" disabled={!fileName} /></label>
            <label>Sensitivities and approvals<textarea value={intake.sensitivities} onChange={(e) => update("sensitivities", e.target.value)} placeholder="People, AI, legal, privacy, external" disabled={!fileName} /></label>
          </div>
          {fileName && assessment.risks.length > 0 && (
            <div className="risk-box"><strong>Signals to review</strong><p>{assessment.risks.join(" · ")}</p></div>
          )}
          <button className="primary" onClick={generate} disabled={!fileName || !intake.changeSummary}>Create activation plan <span>→</span></button>
        </div>
      </section>

      {plan.length > 0 && (
        <section className="plan" id="plan">
          <div className="plan-header">
            <div><span className="kicker">Step 3</span><h2>Your activation plan</h2><p>Edit every field and matrix before download. Missing facts are labeled Needs user input.</p></div>
            <div className="actions"><button className="secondary" onClick={download}>Download draft</button><button className="primary compact" onClick={generate}>Refresh draft</button></div>
          </div>
          <div className="plan-layout">
            <div className="plan-sections">
              {plan.map((section, sectionIndex) => (
                <article className="plan-card" key={section.id} data-section-id={section.id}>
                  <div><h3>{section.title}</h3><span className="source">Grounded in: {section.source}</span></div>
                  {([
                    ["sourceSupported", "Source-supported information"],
                    ["suggestedActions", "Suggested plan actions"],
                    ["needsInput", "Information to provide or confirm"],
                  ] as const).map(([category, categoryLabel]) => (
                    <section className={`evidence-band evidence-${category}`} key={category}>
                      <h4>{categoryLabel}</h4>
                      <div className="field-stack">
                        {section[category].map((item, fieldIndex) => (
                          <label key={item.id}>{item.label}
                            <textarea
                              aria-label={`${section.title} - ${categoryLabel} - ${item.label}`}
                              value={item.value}
                              onChange={(event) => updatePlanField(sectionIndex, category, fieldIndex, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}
                  {section.table && (
                    <section className="matrix-block">
                      <div className="matrix-heading">
                        <div><span className="matrix-kicker">Editable matrix</span><h4>{section.table.label}</h4></div>
                        <button className="add-row" onClick={() => addTableRow(sectionIndex)} aria-label={`Add row to ${section.table.label}`}>+ Add row</button>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead><tr>{section.table.columns.map((column) => <th key={column.key} className={`column-${column.width ?? "medium"}`}>{column.label}</th>)}<th className="row-action">Row</th></tr></thead>
                          <tbody>
                            {section.table.rows.map((row, rowIndex) => (
                              <tr key={`${section.id}-${rowIndex}`}>
                                {section.table!.columns.map((column) => (
                                  <td key={column.key}>
                                    <textarea
                                      aria-label={`${section.table!.label} row ${rowIndex + 1} ${column.label}`}
                                      value={row[column.key] ?? ""}
                                      onChange={(event) => updateTableCell(sectionIndex, rowIndex, column.key, event.target.value)}
                                    />
                                  </td>
                                ))}
                                <td className="row-action"><button className="remove-row" onClick={() => removeTableRow(sectionIndex, rowIndex)} aria-label={`Remove row ${rowIndex + 1} from ${section.table!.label}`}>Remove</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {section.table.rows.length === 0 && <p className="empty-matrix">No rows. Add a row to continue planning.</p>}
                    </section>
                  )}
                </article>
              ))}
            </div>
            <aside className="quality-panel">
              <span className="kicker">Writing check</span>
              <h3>Clear, brief, Chewy-aligned</h3>
              {checks.map((check) => <div className="check" key={check.label}><b className={check.status}>{check.status === "pass" ? "✓" : "!"}</b><span>{check.label}<small>{check.status === "review" ? "Confirm before sharing" : "Passed"}</small></span></div>)}
              <div className="human-note"><strong>Human judgment required</strong><p>This draft supports decisions. It does not approve timing, channels, claims, or sensitive people and AI messaging.</p></div>
            </aside>
          </div>
        </section>
      )}

      <footer>Prototype v1 · Rule-based and local · Sources retained in the project for review</footer>
    </main>
  );
}
