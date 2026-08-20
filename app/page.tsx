"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  assessChange,
  buildConnectorRequest,
  ConnectorSource,
  EvidenceRoute,
  extractHints,
  Intake,
  NEEDS_INPUT,
  parseEvidencePack,
} from "../lib/changeNavigator";
import {
  makePlaybook,
  nextActions,
  DownloadKind,
  FocusArea,
  focusAreaAttention,
  focusAreaSignature,
  PlaybookPhase,
  phaseAttentionItems,
  playbookWritingChecks,
  phaseSummary,
  reusablePlanValues,
  serializePlaybook,
  STATUS_OPTIONS,
} from "../lib/playbook";

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
  externalEvidence: "",
  externalSources: "",
};

const allConnectorSources: ConnectorSource[] = ["SharePoint", "Outlook email", "Slack"];

function addTableLabel(tableId: string) {
  return ({ audiences: "audience", stakeholders: "stakeholder", communications: "communication", deliverables: "deliverable", launch: "launch action", measures: "measure" } as Record<string, string>)[tableId] ?? "entry";
}

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
  const [plan, setPlan] = useState<PlaybookPhase[]>([]);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [editingActionId, setEditingActionId] = useState("");
  const [detailRows, setDetailRows] = useState<Record<string, boolean>>({});
  const [confirmedSections, setConfirmedSections] = useState<Record<string, string>>({});
  const [evidenceRoute, setEvidenceRoute] = useState<EvidenceRoute>("connected-sources");
  const [connectorSources, setConnectorSources] = useState<ConnectorSource[]>(allConnectorSources);
  const [searchGuidance, setSearchGuidance] = useState("");
  const [connectorRequest, setConnectorRequest] = useState("");
  const [evidencePack, setEvidencePack] = useState("");
  const [connectorStatus, setConnectorStatus] = useState("Optional - no connected content has been imported");
  const assessment = useMemo(() => assessChange(intake), [intake]);
  const checks = useMemo(() => playbookWritingChecks(plan), [plan]);
  const startHere = useMemo(() => nextActions(plan), [plan]);
  const sharedValues = useMemo(() => reusablePlanValues(plan), [plan]);
  const currentPhase = plan[currentPhaseIndex];
  const currentSummary = useMemo(() => currentPhase ? phaseSummary(currentPhase, plan) : null, [currentPhase, plan]);
  const currentAttention = useMemo(() => currentPhase ? phaseAttentionItems(currentPhase, confirmedSections) : [], [currentPhase, confirmedSections]);
  const currentConfirmedCount = currentPhase?.focusAreas?.filter((focus) => confirmedSections[`${currentPhase.id}:${focus.id}`] === focusAreaSignature(currentPhase, focus)).length ?? 0;

  const update = (field: keyof Intake, value: string) =>
    setIntake((current) => ({ ...current, [field]: value }));

  const toggleConnectorSource = (source: ConnectorSource) => {
    setConnectorSources((current) => current.includes(source)
      ? current.filter((item) => item !== source)
      : [...current, source]);
  };

  const createConnectorRequest = () => {
    const request = buildConnectorRequest({
      projectName: intake.projectName,
      searchGuidance,
      sources: connectorSources,
      route: evidenceRoute,
    });
    setConnectorRequest(request);
    setConnectorStatus(evidenceRoute === "chief-of-staff"
      ? "Request ready for the Chief of Staff Agent in ChatGPT web"
      : "Request ready for a connector-assisted Codex or ChatGPT Work task");
  };

  const copyConnectorRequest = async () => {
    if (!connectorRequest) return;
    try {
      await navigator.clipboard.writeText(connectorRequest);
      setConnectorStatus("Connector request copied. Run it in Codex or ChatGPT Work, then paste the returned evidence pack below");
    } catch {
      setConnectorStatus("Copy was unavailable. Select the request text and copy it manually");
    }
  };

  const applyEvidencePack = () => {
    const parsed = parseEvidencePack(evidencePack);
    const answeredFields = Object.entries(parsed).filter(([key, value]) =>
      key !== "externalEvidence" && key !== "externalSources" && Boolean(value));
    setIntake((current) => ({ ...current, ...parsed }));
    setPlan([]);
    setCurrentPhaseIndex(0);
    setEditingActionId("");
    setDetailRows({});
    setConfirmedSections({});
    setConnectorStatus(`Imported connected evidence into ${answeredFields.length} review field${answeredFields.length === 1 ? "" : "s"}. Review every answer before generating the plan`);
  };

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
      setCurrentPhaseIndex(0);
      setEditingActionId("");
      setDetailRows({});
      setConfirmedSections({});
      setStatus("Document read. Review the extracted details and fill the gaps");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The document could not be read");
    }
  };

  const generate = () => {
    const generated = makePlaybook(intake, assessment);
    setPlan(generated);
    setCurrentPhaseIndex(0);
    setEditingActionId(generated[0]?.actions[0]?.id ?? "");
    setDetailRows({});
    setConfirmedSections({});
    setStatus("Playbook generated. Start with the next three actions, then work through each phase");
    window.setTimeout(() => document.getElementById("plan")?.scrollIntoView({ behavior: "smooth" }), 0);
  };

  const updateAction = (phaseIndex: number, actionIndex: number, key: string, value: string | boolean) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      actions: phase.actions.map((item, currentActionIndex) => currentActionIndex === actionIndex ? { ...item, [key]: value } : item),
    }));
  };

  const updateActionDetail = (phaseIndex: number, actionIndex: number, key: string, value: string) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      actions: phase.actions.map((item, currentActionIndex) => currentActionIndex !== actionIndex ? item : {
        ...item,
        details: { ...item.details, [key]: value },
      }),
    }));
  };

  const addPhaseAction = (phaseIndex: number) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => {
      if (currentPhaseIndex !== phaseIndex || !phase.actions.length) return phase;
      const template = phase.actions[phase.actions.length - 1];
      return { ...phase, actions: [...phase.actions, {
        ...template,
        id: `${phase.id}-${Date.now()}`,
        do: NEEDS_INPUT,
        who: NEEDS_INPUT,
        owner: NEEDS_INPUT,
        when: NEEDS_INPUT,
        status: "Not started",
        confirmation: NEEDS_INPUT,
        humanReview: "No",
        completed: false,
        details: Object.fromEntries(Object.keys(template.details ?? {}).map((key) => [key, NEEDS_INPUT])),
      }] };
    }));
  };

  const removePhaseAction = (phaseIndex: number, actionIndex: number) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      actions: phase.actions.filter((_, currentActionIndex) => currentActionIndex !== actionIndex),
    }));
  };

  const growTextArea = (event: FormEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const updateTableCell = (phaseIndex: number, tableIndex: number, rowIndex: number, key: string, value: string) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      tables: phase.tables?.map((table, currentTableIndex) => currentTableIndex !== tableIndex ? table : {
        ...table,
        rows: table.rows.map((row, currentRowIndex) => currentRowIndex === rowIndex ? { ...row, [key]: value } : row),
      }),
    }));
  };

  const addTableRow = (phaseIndex: number, tableIndex: number) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      tables: phase.tables?.map((table, currentTableIndex) => currentTableIndex !== tableIndex ? table : {
        ...table,
        rows: [...table.rows, Object.fromEntries(table.columns.map((column) => [column.key, NEEDS_INPUT]))],
      }),
    }));
  };

  const removeTableRow = (phaseIndex: number, tableIndex: number, rowIndex: number) => {
    setPlan((current) => current.map((phase, currentPhaseIndex) => currentPhaseIndex !== phaseIndex ? phase : {
      ...phase,
      tables: phase.tables?.map((table, currentTableIndex) => currentTableIndex !== tableIndex ? table : {
        ...table,
        rows: table.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex),
      }),
    }));
  };

  const clear = () => {
    setIntake(emptyIntake);
    setFileName("");
    setSourceText("");
    setPlan([]);
    setEvidenceRoute("connected-sources");
    setConnectorSources(allConnectorSources);
    setSearchGuidance("");
    setConnectorRequest("");
    setEvidencePack("");
    setCurrentPhaseIndex(0);
    setEditingActionId("");
    setDetailRows({});
    setConfirmedSections({});
    setConnectorStatus("Optional - no connected content has been imported");
    setStatus("Upload a Word document to begin");
    if (inputRef.current) inputRef.current.value = "";
  };

  const download = (kind: DownloadKind = "full") => {
    const body = serializePlaybook(intake.projectName, plan, { kind, confirmedSections });
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const suffix = kind === "communications" ? "communications-brief" : kind === "leaders" ? "leader-preparation-brief" : "activation-plan";
    anchor.download = `${intake.projectName || "change-activation"}-${suffix}.txt`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const isFocusConfirmed = (phase: PlaybookPhase, focus: FocusArea) =>
    confirmedSections[`${phase.id}:${focus.id}`] === focusAreaSignature(phase, focus);

  const setFocusConfirmed = (phase: PlaybookPhase, focus: FocusArea, confirmed: boolean) => {
    const key = `${phase.id}:${focus.id}`;
    setConfirmedSections((current) => {
      if (confirmed) return { ...current, [key]: focusAreaSignature(phase, focus) };
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const reviewControl = (phase: PlaybookPhase, focus: FocusArea) => {
    const missing = focusAreaAttention(phase, focus);
    const confirmed = isFocusConfirmed(phase, focus);
    return <div className={`section-review ${confirmed ? "confirmed" : missing.length ? "needs-attention" : "needs-review"}`}>
      <div><span className="review-status">{confirmed ? "Confirmed" : missing.length ? "Needs attention" : "Needs review"}</span><p>{confirmed ? "This section is confirmed. Editing its information will return it to Needs review." : missing.length ? `${missing.length} required item${missing.length === 1 ? "" : "s"} need attention before confirmation.` : "Review the recommendation, make any edits, then confirm this section."}</p></div>
      <button className={confirmed ? "edit-entry" : "primary compact"} disabled={!confirmed && missing.length > 0} onClick={() => setFocusConfirmed(phase, focus, !confirmed)}>{confirmed ? "Edit this section" : "Confirm this section"}</button>
    </div>;
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
          {fileName && (
            <section className="connector-workflow" aria-labelledby="connector-heading">
              <div className="connector-heading">
                <div><span className="kicker">Optional context</span><h3 id="connector-heading">Bring in connected project evidence</h3></div>
                <span className="read-only-badge">Read only</span>
              </div>
              <p className="connector-intro">Create a bounded research request, run it with your approved connectors, then paste the source-linked evidence pack back here. This browser does not access your accounts directly.</p>

              <fieldset className="route-choice">
                <legend>Research route</legend>
                <label className={evidenceRoute === "connected-sources" ? "selected" : ""}>
                  <input type="radio" name="evidence-route" checked={evidenceRoute === "connected-sources"} onChange={() => setEvidenceRoute("connected-sources")} />
                  <span><strong>Connected sources</strong><small>Use SharePoint, Outlook email, and/or Slack through Codex or ChatGPT Work.</small></span>
                </label>
                <label className={evidenceRoute === "chief-of-staff" ? "selected" : ""}>
                  <input type="radio" name="evidence-route" checked={evidenceRoute === "chief-of-staff"} onChange={() => setEvidenceRoute("chief-of-staff")} />
                  <span><strong>Chief of Staff Agent backup</strong><small>Personal web fallback for Outlook email and Slack. SharePoint is not currently attached to this agent.</small></span>
                </label>
              </fieldset>

              {evidenceRoute === "connected-sources" && (
                <fieldset className="source-choice">
                  <legend>Sources to search</legend>
                  {allConnectorSources.map((source) => (
                    <label key={source}>
                      <input type="checkbox" checked={connectorSources.includes(source)} onChange={() => toggleConnectorSource(source)} />
                      <span>{source}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <label className="connector-guidance">Search boundaries
                <textarea value={searchGuidance} onChange={(event) => setSearchGuidance(event.target.value)} placeholder="Example: Search the ServiceNow project folder, emails from the last 60 days, and #project-servicenow. Exclude unrelated personal messages." />
              </label>
              <button className="secondary connector-button" type="button" onClick={createConnectorRequest}>Create connector request</button>

              {connectorRequest && (
                <div className="handoff-panel">
                  <label>Request to run
                    <textarea value={connectorRequest} readOnly aria-label="Connector request to run" />
                  </label>
                  <button className="text-button" type="button" onClick={copyConnectorRequest}>Copy request</button>
                </div>
              )}

              <label className="evidence-import">Returned evidence pack
                <textarea value={evidencePack} onChange={(event) => setEvidencePack(event.target.value)} placeholder="Paste the connector or Chief of Staff Agent response here, preserving the required headings and source references." />
              </label>
              <button className="secondary connector-button" type="button" onClick={applyEvidencePack} disabled={!evidencePack.trim()}>Apply evidence to review fields</button>
              <p className="connector-status" role="status">{connectorStatus}</p>
            </section>
          )}
          {fileName && assessment.risks.length > 0 && (
            <div className="risk-box"><strong>Signals to review</strong><p>{assessment.risks.join(" · ")}</p></div>
          )}
          <button className="primary" onClick={generate} disabled={!fileName || !intake.changeSummary}>Create activation plan <span>→</span></button>
        </div>
      </section>

      {plan.length > 0 && (
        <section className="plan" id="plan">
          <div className="plan-header">
            <div><span className="kicker">Step 3</span><h2>Your change activation playbook</h2><p>Start with the next three actions, then follow the phases in order. Every recommendation remains editable.</p></div>
            <div className="actions"><button className="secondary" onClick={() => download("full")}>Download full plan</button><button className="primary compact" onClick={generate}>Refresh playbook</button></div>
          </div>
          <section className="start-here" aria-labelledby="start-here-title">
            <div><span className="kicker">Start here</span><h3 id="start-here-title">Your next 3 actions</h3></div>
            <ol>
              {startHere.map((item) => <li key={item.id}><strong>{item.do}</strong><span>{item.phase} · Owner: {item.owner}</span></li>)}
              {startHere.length === 0 && <li><strong>All action cards are complete</strong><span>Review tables and open decisions before closing the playbook.</span></li>}
            </ol>
          </section>
          <nav className="journey-nav" aria-label="Activation phases">
            {plan.map((phase, phaseIndex) => { const confirmed = phase.focusAreas?.filter((focus) => isFocusConfirmed(phase, focus)).length ?? 0; const complete = confirmed === (phase.focusAreas?.length ?? 0); return <button key={phase.id} className={phaseIndex === currentPhaseIndex ? `current phase-${phase.color}` : complete ? "phase-complete" : ""} onClick={() => { setCurrentPhaseIndex(phaseIndex); setEditingActionId(phase.actions[0]?.id ?? ""); }}><span>{phase.icon}</span><b>{phase.title}</b><small>{phaseIndex === currentPhaseIndex ? `Phase ${phaseIndex + 1} of 4 · ${confirmed}/3 confirmed` : complete ? "Complete" : "Needs review"}</small></button>; })}
          </nav>
          <div className="phase-progress"><span style={{ width: `${((currentPhaseIndex + 1) / 4) * 100}%` }} /><b>Phase {currentPhaseIndex + 1} of 4</b></div>
          <div className="plan-layout">
            <div className="plan-sections">
              {plan.map((phase, phaseIndex) => phaseIndex === currentPhaseIndex ? (
                <article className="plan-card phase-card" key={phase.id} data-phase-id={phase.id}>
                  <div className="phase-heading"><span className="phase-number">{phase.number}</span><div><span className="matrix-kicker">Phase {phase.number}</span><h3>{phase.title}</h3><p>{phase.purpose}</p></div><span className="source">Grounded in: {phase.source}</span></div>
                  <div className="focus-strip">{phase.focusAreas?.map((focus, index) => { const missing = focusAreaAttention(phase, focus); const confirmed = isFocusConfirmed(phase, focus); return <a href={`#focus-${phase.id}-${focus.id}`} className={confirmed ? "focus-confirmed" : missing.length ? "focus-attention" : "focus-review"} key={focus.id}><span>{index + 1}</span><strong>{focus.title}</strong><small>{confirmed ? "Confirmed" : missing.length ? "Needs attention" : "Needs review"}</small></a>; })}</div>
                  <section className="phase-instructions compact-instructions">
                    <div><b>Purpose</b><p>{phase.instructions.purpose}</p></div>
                    <div className="instruction-primary"><b>What to do</b><p>{phase.instructions.whatToDo}</p></div>
                    <div><b>Where to enter it</b><p>{phase.instructions.whereToEnter}</p></div>
                    <div><b>Required inputs</b><p>{phase.instructions.requiredInputs}</p></div>
                    <div><b>Completion criteria</b><p>{phase.instructions.completionCriteria}</p></div>
                    <div className="instruction-example"><b>Example</b><p>{phase.instructions.example}</p></div>
                  </section>
                  {(phase.focusAreas ?? []).some((focus) => focus.actionIds?.length) && <div className="focus-guidance-list">{(phase.focusAreas ?? []).filter((focus) => focus.actionIds?.length).map((focus) => <section id={`focus-${phase.id}-${focus.id}`} className={focusAreaAttention(phase, focus).length ? "focus-guidance needs-attention" : "focus-guidance"} key={focus.id}><div><span className="matrix-kicker">{isFocusConfirmed(phase, focus) ? "Confirmed" : focusAreaAttention(phase, focus).length ? "Needs attention" : "Needs review"}</span><h4>{focus.title}</h4></div><p><strong>Why this matters:</strong> {focus.description} {focus.usage}</p></section>)}</div>}
                  <div className="action-list">
                    {phase.actions.map((item, actionIndex) => {
                      const isLeaderEntry = Boolean(item.details?.leaderDo);
                      const isAudienceEntry = Boolean(item.details?.audienceDo);
                      const isStructuredEntry = isLeaderEntry || isAudienceEntry;
                      const isEditing = editingActionId === item.id;
                      return (
                      <section className={`action-card guided-entry ${item.completed ? "action-complete" : ""}`} key={item.id}>
                        <div className="action-top"><label className="complete-control"><input type="checkbox" checked={item.completed} onChange={(event) => updateAction(phaseIndex, actionIndex, "completed", event.target.checked)} /><span>{item.completed ? "Complete" : "Mark complete"}</span></label>{isStructuredEntry && phase.actions.length > 1 && <button className="remove-row" onClick={() => removePhaseAction(phaseIndex, actionIndex)}>Remove entry</button>}</div>
                        {!isEditing ? <div className="action-preview"><div><b>Do</b><p>{item.do}</p></div><div><b>Who</b><p>{item.details?.audience || item.owner || item.who}</p></div><div><b>When</b><p>{item.when}</p></div><div><b>Done when</b><p>{item.confirmation || item.doneWhen}</p></div><button className="edit-entry" onClick={() => setEditingActionId(item.id)}>Review or edit</button></div> : <>
                        {item.id === "confirm-change" ? <>
                          <label className="full-field"><span>Action or decision required <em>Required</em></span><small>Enter the concrete action, decision, or deliverable needed. Be specific about what must happen.</small><textarea className="expanding-textarea" value={item.do} onInput={growTextArea} onChange={(event) => updateAction(phaseIndex, actionIndex, "do", event.target.value)} /></label>
                          <div className="structured-grid">
                            <label><span>Owner <em>Required</em></span><small>Type the person or role responsible.</small><input type="search" value={item.owner} onChange={(event) => updateAction(phaseIndex, actionIndex, "owner", event.target.value)} /></label>
                            <label><span>Target date <em>Required</em></span><small>{item.when && item.when !== NEEDS_INPUT ? `Current guidance: ${item.when}` : "Choose the completion date."}</small><input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(item.when) ? item.when : ""} onChange={(event) => updateAction(phaseIndex, actionIndex, "when", event.target.value)} /></label>
                            <label><span>Status <em>Required</em></span><select value={STATUS_OPTIONS.includes(item.status) ? item.status : "Not started"} onChange={(event) => updateAction(phaseIndex, actionIndex, "status", event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                            <label className="wide-field"><span>Notes or dependencies <i>Optional</i></span><small>Record decisions, blockers, or work that must happen first.</small><textarea className="expanding-textarea" value={item.confirmation} onInput={growTextArea} onChange={(event) => updateAction(phaseIndex, actionIndex, "confirmation", event.target.value)} /></label>
                          </div>
                        </> : <>
                          <div className="structured-grid">
                            {(isLeaderEntry ? [
                              ["audience", "Leader or manager audience", "Search or enter the leader groups that need the same preparation.", "person"], ["know", "What leaders need to know", "Include the change, reason, boundaries, and known impact.", "textarea"], ["leaderDo", "What leaders need to do", "State the visible action or decision expected from leaders.", "textarea"], ["messages", "Talking points or key messages", "Use plain language leaders can say directly.", "textarea"], ["materials", "Support materials needed", "Choose or enter the materials leaders need.", "multi"], ["channel", "Communication channel", "Choose how leaders will be prepared.", "multi"],
                            ] : [
                              ["audience", "Affected audience", "Search or enter groups with the same preparation needs.", "person"], ["changing", "What is changing", "Describe the specific change for this audience.", "textarea"], ["know", "What the audience needs to know", "Include the reason, impact, and key boundaries.", "textarea"], ["audienceDo", "What the audience needs to do", "State the behavior or task expected.", "textarea"], ["support", "Training or support required", "Choose or enter only the support this audience needs.", "multi"], ["channel", "Communication channel", "Choose how this audience should receive the information.", "multi"],
                            ]).map(([key, label, helper, control]) => {
                              const detailValue = item.details?.[key] ?? "";
                              const multiOptions = key === "channel" ? ["Leader meeting", "Manager cascade", "Team meeting", "Email", "Slack", "FAQ", "Job aid", "Training", "Office hours", "Intranet or internal page", "Other"] : ["Leader brief", "Manager talking points", "FAQ", "Team discussion guide", "Job aid", "Training", "Reminder message", "Feedback survey", "Office hours", "Other"];
                              const listId = `action-audiences-${phaseIndex}-${actionIndex}`;
                              return <label className={control === "textarea" ? "wide-field" : ""} key={key}><span>{label} <em>Required</em></span><small>{helper}</small>{control === "textarea" ? <textarea className="expanding-textarea" value={detailValue} onInput={growTextArea} onChange={(event) => updateActionDetail(phaseIndex, actionIndex, key, event.target.value)} /> : control === "multi" ? <select multiple value={detailValue === NEEDS_INPUT ? [] : detailValue.split(",").map((entry) => entry.trim())} onChange={(event) => updateActionDetail(phaseIndex, actionIndex, key, Array.from(event.currentTarget.selectedOptions).map((option) => option.value).join(", "))}>{[...new Set([...multiOptions, ...detailValue.split(",").map((entry) => entry.trim()).filter((entry) => entry && entry !== NEEDS_INPUT)])].map((option) => <option key={option}>{option}</option>)}</select> : <><input type="search" list={key === "audience" && sharedValues.audiences.length ? listId : undefined} value={detailValue} onChange={(event) => updateActionDetail(phaseIndex, actionIndex, key, event.target.value)} />{key === "audience" && sharedValues.audiences.length > 0 && <datalist id={listId}>{sharedValues.audiences.map((option) => <option key={option} value={option} />)}</datalist>}</>}</label>;
                            })}
                            <label><span>Owner <em>Required</em></span><small>Type the responsible person or role.</small><input type="search" value={item.owner} onChange={(event) => updateAction(phaseIndex, actionIndex, "owner", event.target.value)} /></label>
                            <label><span>{isAudienceEntry ? "Delivery or completion date" : "When"} <em>Required</em></span><small>{item.when !== NEEDS_INPUT ? `Current guidance: ${item.when}` : "Choose a date."}</small><input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(item.when) ? item.when : ""} onChange={(event) => updateAction(phaseIndex, actionIndex, "when", event.target.value)} /></label>
                            <label><span>Human review required <em>Required</em></span><select value={item.humanReview.startsWith("Yes") ? "Yes" : "No"} onChange={(event) => updateAction(phaseIndex, actionIndex, "humanReview", event.target.value)}><option>Yes</option><option>No</option></select></label>
                            <label><span>Status <em>Required</em></span><select value={STATUS_OPTIONS.includes(item.status) ? item.status : "Not started"} onChange={(event) => updateAction(phaseIndex, actionIndex, "status", event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                            <label className="wide-field"><span>{isAudienceEntry ? "Feedback or questions" : "Notes or dependencies"} <i>Optional</i></span><textarea className="expanding-textarea" value={isAudienceEntry ? item.details?.feedback ?? "" : item.details?.notes ?? ""} onInput={growTextArea} onChange={(event) => updateActionDetail(phaseIndex, actionIndex, isAudienceEntry ? "feedback" : "notes", event.target.value)} /></label>
                          </div>
                        </>}
                        <button className="edit-entry done-editing" onClick={() => setEditingActionId("")}>Done editing</button>
                        </>}
                      </section>
                    )})}
                    {(phase.actions.some((item) => item.details?.leaderDo || item.details?.audienceDo) || phase.id === "sustain") && phase.actions.length > 0 && <button className="add-entry" onClick={() => addPhaseAction(phaseIndex)}>+ Add another {phase.actions.some((item) => item.details?.leaderDo) ? "leader or manager" : phase.actions.some((item) => item.details?.audienceDo) ? "audience" : "reinforcement action"}</button>}
                  </div>
                  <div className="section-review-list">{(phase.focusAreas ?? []).filter((focus) => focus.actionIds?.length).map((focus) => <div key={focus.id}>{reviewControl(phase, focus)}</div>)}</div>
                  {(phase.tables ?? []).map((table, tableIndex) => {
                    const tableFocus = phase.focusAreas?.find((focus) => focus.tableIds?.includes(table.id));
                    const needsAttention = tableFocus ? focusAreaAttention(phase, tableFocus).length > 0 : false;
                    return (
                    <section id={tableFocus ? `focus-${phase.id}-${tableFocus.id}` : undefined} className={`matrix-block focus-work ${needsAttention ? "needs-attention" : ""}`} key={table.id}>
                      <div className="matrix-heading"><div><span className="matrix-kicker">{tableFocus && isFocusConfirmed(phase, tableFocus) ? "Confirmed" : needsAttention ? "Needs attention" : "Needs review"}</span><h4>{table.label}</h4></div><button className="add-row" onClick={() => addTableRow(phaseIndex, tableIndex)} aria-label={`Add row to ${table.label}`}>+ Add {addTableLabel(table.id)}</button></div>
                      {(table.description || tableFocus) && <p className="section-purpose"><strong>Why this matters:</strong> {table.description || tableFocus?.description} {tableFocus?.usage}</p>}
                      <div className="record-list">
                        {table.rows.map((row, rowIndex) => {
                          const rowKey = `${phase.id}-${table.id}-${rowIndex}`;
                          const hasMoreDetail = table.columns.some((column) => column.advanced);
                          return <section className="record-card" key={`${table.id}-${rowIndex}`}>
                          <div className="record-heading"><strong>{table.label} entry {rowIndex + 1}</strong><div className="record-actions">{hasMoreDetail && <button className="edit-entry" onClick={() => setDetailRows((current) => ({ ...current, [rowKey]: !current[rowKey] }))}>{detailRows[rowKey] ? "Hide details" : "More detail"}</button>}<button className="remove-row" onClick={() => removeTableRow(phaseIndex, tableIndex, rowIndex)} aria-label={`Remove row ${rowIndex + 1} from ${table.label}`}>Remove entry</button></div></div>
                          <div className="structured-grid">{table.columns.filter((column) => (!column.advanced || detailRows[rowKey]) && (column.key !== "reviewer" || row.humanReview?.startsWith("Yes"))).map((column) => {
                            const currentValue = row[column.key] ?? "";
                            const reusedOptions = column.reuse ? sharedValues[column.reuse] : [];
                            const options = [...new Set([...(column.options ?? []), ...reusedOptions, ...currentValue.split(",").map((item) => item.trim()).filter((item) => item && item !== NEEDS_INPUT)])];
                            const label = <span>{column.label} {column.required ? <em>Required</em> : <i>Optional</i>}</span>;
                            const helper = column.helper && column.key !== "impact" ? <small>{column.helper}</small> : null;
                            const updateValue = (newValue: string) => updateTableCell(phaseIndex, tableIndex, rowIndex, column.key, newValue);
                            let control;
                            if (column.control === "date") control = <><input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(currentValue) ? currentValue : ""} onChange={(event) => updateValue(event.target.value)} />{currentValue && currentValue !== NEEDS_INPUT && !/^\d{4}-\d{2}-\d{2}$/.test(currentValue) && <small>Current guidance: {currentValue}</small>}</>;
                            else if (column.control === "status") control = <select value={STATUS_OPTIONS.includes(currentValue) ? currentValue : "Not started"} onChange={(event) => updateValue(event.target.value)}>{STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select>;
                            else if (column.control === "yes-no") control = <select value={currentValue.startsWith("Yes") ? "Yes" : "No"} onChange={(event) => updateValue(event.target.value)}><option>Yes</option><option>No</option></select>;
                            else if (column.control === "select") control = <select value={options.includes(currentValue) ? currentValue : ""} onChange={(event) => updateValue(event.target.value)}><option value="" disabled>Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</select>;
                            else if (column.control === "multi-select") control = <select multiple value={currentValue === NEEDS_INPUT ? [] : currentValue.split(",").map((item) => item.trim())} onChange={(event) => updateValue(Array.from(event.currentTarget.selectedOptions).map((option) => option.value).join(", "))}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
                            else if (column.control === "person") { const listId = `reuse-${phaseIndex}-${tableIndex}-${rowIndex}-${column.key}`; control = <><input type="search" list={reusedOptions.length ? listId : undefined} value={currentValue} placeholder="Type a person or role" onChange={(event) => updateValue(event.target.value)} />{reusedOptions.length > 0 && <datalist id={listId}>{reusedOptions.map((option) => <option key={option} value={option} />)}</datalist>}</>; }
                            else if (column.control === "textarea") control = <textarea className="expanding-textarea" aria-label={`${table.label} entry ${rowIndex + 1} ${column.label}`} value={currentValue} onInput={growTextArea} onChange={(event) => updateValue(event.target.value)} />;
                            else control = <input type="text" value={currentValue} onChange={(event) => updateValue(event.target.value)} />;
                            return <label className={column.width === "large" || column.control === "textarea" ? "wide-field" : ""} key={column.key}>{label}{helper}{control}</label>;
                          })}</div>
                        </section>})}
                      </div>
                      {table.rows.length === 0 && <p className="empty-matrix">No rows. Add a row when this work is relevant.</p>}
                      {tableFocus && reviewControl(phase, tableFocus)}
                    </section>
                  )})}
                  {currentSummary && <section className={`phase-summary summary-${phase.color}`}><span className="matrix-kicker">Your outcome</span><h3>{currentSummary.title}</h3><div className="phase-completion-line"><strong>{currentConfirmedCount} of {phase.focusAreas?.length ?? 3} sections confirmed</strong><span>{currentAttention.length ? "This phase still needs attention" : "This phase is complete"}</span></div><div className="summary-grid">{currentSummary.items.map((item) => <div key={item.label}><strong>{item.label}</strong>{item.values.length ? <ul>{item.values.map((summaryItem) => <li key={summaryItem}>{summaryItem}</li>)}</ul> : <p>{NEEDS_INPUT}</p>}</div>)}</div><div className={`still-needed ${currentAttention.length ? "has-attention" : "complete"}`}><strong>{currentAttention.length ? `${currentAttention.length} item${currentAttention.length === 1 ? "" : "s"} need your attention:` : "Everything is confirmed"}</strong>{currentAttention.length ? <ul>{currentAttention.map((item) => <li key={`${item.focusId}-${item.label}`}><a href={`#focus-${phase.id}-${item.focusId}`}>{item.label}</a></li>)}</ul> : <p>You have reviewed and confirmed every section in this phase.</p>}</div></section>}
                  <section className="next-phase"><strong>{currentPhaseIndex < 3 ? `Next: ${plan[currentPhaseIndex + 1].title}` : "Create and use your plan"}</strong><p>{currentPhaseIndex === 0 ? "Now that we know what matters and who is involved, prepare leaders, communications, and materials." : currentPhaseIndex === 1 ? "With preparation in place, confirm the launch timeline and issue response." : currentPhaseIndex === 2 ? "After launch, listen, measure adoption, and reinforce where needed." : currentAttention.length ? "You can download now, but unconfirmed sections will be clearly marked as Needs review." : "Your four phases are ready to compile into a working activation plan."}</p>{currentPhaseIndex < 3 ? <button className="primary compact" onClick={() => { setCurrentPhaseIndex(currentPhaseIndex + 1); setEditingActionId(plan[currentPhaseIndex + 1].actions[0]?.id ?? ""); document.getElementById("plan")?.scrollIntoView({ behavior: "smooth" }); }}>Continue to {plan[currentPhaseIndex + 1].title} →</button> : <div className="download-actions"><button className="primary compact" onClick={() => download("full")}>Create &amp; Download My Activation Plan</button><button className="secondary" onClick={() => download("communications")}>Download Communications Brief</button><button className="secondary" onClick={() => download("leaders")}>Download Leader Preparation Brief</button></div>}</section>
                </article>
              ) : null)}
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
