export type Intake = {
  projectName: string;
  outcome: string;
  changeSummary: string;
  audiences: string;
  timing: string;
  readiness: string;
  sensitivities: string;
};

export type Assessment = {
  primaryType: string;
  secondaryType: string;
  size: "XS" | "S" | "M" | "L" | "XL";
  risks: string[];
  humanReview: string[];
};

export type PlanField = {
  id: string;
  label: string;
  value: string;
};

export type PlanColumn = {
  key: string;
  label: string;
  width?: "small" | "medium" | "large";
};

export type PlanTable = {
  label: string;
  columns: PlanColumn[];
  rows: Array<Record<string, string>>;
};

export type PlanSection = {
  id: string;
  title: string;
  source: string;
  sourceSupported: PlanField[];
  suggestedActions: PlanField[];
  needsInput: PlanField[];
  table?: PlanTable;
};

export const NEEDS_INPUT = "Needs user input";
export const RECOMMENDED = "Recommended - confirm";

const includesAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

const provided = (value: string, fallback = NEEDS_INPUT) => value.trim() || fallback;

const field = (id: string, label: string, value: string): PlanField => ({ id, label, value });

const splitList = (value: string) =>
  value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);

const audienceList = (value: string) => {
  const audiences = [...new Set(splitList(value))];
  return audiences.length ? audiences : [NEEDS_INPUT];
};

export function assessChange(intake: Intake): Assessment {
  const text = Object.values(intake).join(" ").toLowerCase();
  const padded = ` ${text} `;
  const typeSignals: Array<[string, string[]]> = [
    ["AI / automation", [" ai ", "artificial intelligence", "automation", "chatbot", "chat assistant"]],
    ["Role / org / staffing", ["staffing", "headcount", "job", "role change", "reporting line", "restructure", "performance"]],
    ["Policy / compliance", ["policy", "legal", "compliance", "privacy", "regulatory"]],
    ["Tool / system", ["system", "platform", "tool", "software", "migration", "launch"]],
    ["Workflow / process", ["workflow", "process", "procedure", "handoff", "operating model"]],
    ["Customer / partner experience", ["customer", "partner", "vendor", "external"]],
    ["Data / measurement", ["metric", "dashboard", "data", "reporting"]],
    ["Mindset / narrative", ["mindset", "culture", "narrative", "trust"]],
  ];
  const matches = typeSignals.filter(([, terms]) => includesAny(padded, terms));
  const primaryType = matches[0]?.[0] ?? "Awareness";
  const secondaryType = matches[1]?.[0] ?? "Behavior";

  const risks: string[] = [];
  const humanReview: string[] = [];
  const peopleRisk = includesAny(text, ["staffing", "headcount", "job security", "reporting line", "performance", "layoff"]);
  const aiRisk = includesAny(padded, [" ai ", "artificial intelligence", "automation", "replacement", "surveillance", "deflection"]);
  const governedRisk = includesAny(text, ["legal", "compliance", "privacy", "regulatory", "veterinary", "external", "media"]);
  const customerRisk = includesAny(text, ["customer-facing", "customer facing", "customer experience", "external"]);
  const lowReadiness = includesAny(text, ["not ready", "unknown", "unconfirmed", "low", "tbd"]);

  if (peopleRisk) {
    risks.push("People, role, or job-security sensitivity");
    humanReview.push("HR and accountable leaders must review people-impact language and sequencing.");
  }
  if (aiRisk) {
    risks.push("AI narrative and trust sensitivity");
    humanReview.push("Confirm the human-support boundary and avoid replacement, surveillance, or anthropomorphic framing.");
  }
  if (governedRisk) {
    risks.push("Legal, compliance, privacy, or reputation exposure");
    humanReview.push("Route governed claims to the appropriate Legal, Privacy, Compliance, or Corporate Communications owner.");
  }
  if (customerRisk) risks.push("Customer or external experience impact");
  if (lowReadiness) {
    risks.push("Readiness information is incomplete");
    humanReview.push("Do not broaden reach until leader readiness and narrative control are confirmed.");
  }

  let size: Assessment["size"] = "S";
  if (peopleRisk || aiRisk || governedRisk) size = risks.length >= 3 ? "XL" : "L";
  else if (customerRisk || risks.length >= 2) size = "M";
  else if (text.length < 180 && !includesAny(text, ["behavior", "workflow", "training"])) size = "XS";
  if (risks.length >= 3 && size === "S") size = "M";

  return { primaryType, secondaryType, size, risks, humanReview };
}

export function makePlan(intake: Intake, assessment: Assessment): PlanSection[] {
  const audiences = audienceList(intake.audiences);
  const timing = provided(intake.timing);
  const change = provided(intake.changeSummary);
  const outcome = provided(intake.outcome);
  const readiness = provided(intake.readiness);
  const sensitivities = provided(intake.sensitivities);
  const riskLine = assessment.risks.length
    ? assessment.risks.join("; ")
    : "No high-risk signals were detected in the information provided. Confirm through human review.";
  const humanReview = assessment.humanReview.length
    ? assessment.humanReview.join("\n")
    : "Confirm final accuracy, ownership, and readiness before activation.";
  const recommendedTiming = assessment.size === "M"
    ? "Recommended - confirm with Communications: begin preparation 18-20 business days before launch and allow at least five business days for shared-channel review."
    : "Recommended - confirm: work backward from the activation milestone after readiness is confirmed.";

  return [
    {
      id: "overview",
      title: "1. Change overview and case for change",
      source: "Uploaded document + Change Navigation strategic framework",
      sourceSupported: [
        field("what-changing", "What is changing", change),
        field("why-changing", "Why it is changing", outcome),
        field("business-outcome", "Intended business outcome", outcome),
      ],
      suggestedActions: [
        field("case-draft", "Working case for change", `What’s new: ${change}\n\nWhy it matters: ${outcome}`),
        field("classification", "Change path", `Primary type: ${assessment.primaryType}; secondary type: ${assessment.secondaryType}; recommended path: ${assessment.size}. Decision support only - not approval.`),
      ],
      needsInput: [
        field("consequence", "What will happen if the change is not made", NEEDS_INPUT),
        field("assumptions", "Key assumptions or missing information", NEEDS_INPUT),
      ],
    },
    {
      id: "objectives",
      title: "2. Objectives and success measures",
      source: "Uploaded document + Change Navigation strategic framework",
      sourceSupported: [
        field("stated-outcome", "Stated outcome", outcome),
        field("stated-timing", "Stated timing", timing),
      ],
      suggestedActions: [
        field("measure-guidance", "Measurement approach", "Recommended - confirm: measure understanding, readiness, adoption, friction, and sustained behavior rather than reach alone."),
      ],
      needsInput: [
        field("adoption-definition", "Definition of adoption", NEEDS_INPUT),
        field("baseline", "Current baseline", NEEDS_INPUT),
      ],
      table: {
        label: "Objectives and measures",
        columns: [
          { key: "objective", label: "Change objective", width: "large" },
          { key: "behavior", label: "Desired employee behavior", width: "large" },
          { key: "goal", label: "Adoption goal", width: "medium" },
          { key: "measure", label: "Success measure", width: "large" },
          { key: "target", label: "Target", width: "medium" },
          { key: "date", label: "Target date", width: "medium" },
          { key: "owner", label: "Owner", width: "medium" },
        ],
        rows: [{
          objective: outcome,
          behavior: NEEDS_INPUT,
          goal: NEEDS_INPUT,
          measure: `${RECOMMENDED}: understanding and adoption pulse`,
          target: NEEDS_INPUT,
          date: timing,
          owner: NEEDS_INPUT,
        }],
      },
    },
    {
      id: "audiences",
      title: "3. Audience and impact analysis",
      source: "Uploaded document + Functional Impact Translation Guide",
      sourceSupported: [
        field("named-audiences", "Audiences named in the intake", provided(intake.audiences)),
      ],
      suggestedActions: [
        field("impact-method", "Impact-analysis method", "Recommended - confirm the know, feel, do, stop, start, and continue impacts for each function and leader level."),
      ],
      needsInput: [
        field("missing-audiences", "Additional employee groups or personas", NEEDS_INPUT),
      ],
      table: {
        label: "Audience and impact matrix",
        columns: [
          { key: "audience", label: "Audience or employee group", width: "medium" },
          { key: "effect", label: "How they are affected", width: "large" },
          { key: "impact", label: "Impact level", width: "small" },
          { key: "know", label: "Need to know", width: "large" },
          { key: "feel", label: "Need to feel", width: "medium" },
          { key: "do", label: "Need to do", width: "large" },
          { key: "concerns", label: "Likely questions or concerns", width: "large" },
          { key: "support", label: "Support needed", width: "large" },
        ],
        rows: audiences.map((audience) => ({
          audience,
          effect: NEEDS_INPUT,
          impact: NEEDS_INPUT,
          know: change,
          feel: NEEDS_INPUT,
          do: NEEDS_INPUT,
          concerns: NEEDS_INPUT,
          support: NEEDS_INPUT,
        })),
      },
    },
    {
      id: "stakeholders",
      title: "4. Stakeholder engagement plan",
      source: "Change Navigation strategic framework",
      sourceSupported: [
        field("readiness-evidence", "Readiness or stakeholder evidence provided", readiness),
      ],
      suggestedActions: [
        field("alignment", "Required alignment moments", "Recommended - confirm: align first on change, impact, and risk; align again on readiness, sequencing, and final narrative."),
      ],
      needsInput: [
        field("named-stakeholders", "Named sponsors, owners, and reviewers", NEEDS_INPUT),
      ],
      table: {
        label: "Stakeholder engagement matrix",
        columns: [
          { key: "stakeholder", label: "Stakeholder or group", width: "medium" },
          { key: "role", label: "Role in the change", width: "medium" },
          { key: "influence", label: "Influence", width: "small" },
          { key: "currentSupport", label: "Current support", width: "small" },
          { key: "desiredSupport", label: "Desired support", width: "small" },
          { key: "action", label: "Engagement action", width: "large" },
          { key: "owner", label: "Owner", width: "medium" },
          { key: "timing", label: "Timing", width: "medium" },
        ],
        rows: [
          { stakeholder: `${NEEDS_INPUT} - accountable sponsor`, role: "Decision and visible sponsorship", influence: "High", currentSupport: NEEDS_INPUT, desiredSupport: "Active", action: `${RECOMMENDED}: sponsor alignment`, owner: NEEDS_INPUT, timing: timing },
          { stakeholder: `${NEEDS_INPUT} - operational owner`, role: "Operational readiness", influence: "High", currentSupport: NEEDS_INPUT, desiredSupport: "Active", action: `${RECOMMENDED}: readiness review`, owner: NEEDS_INPUT, timing: timing },
          { stakeholder: `${NEEDS_INPUT} - Communications partner`, role: "Narrative and channel counsel", influence: "Medium", currentSupport: NEEDS_INPUT, desiredSupport: "Supportive", action: `${RECOMMENDED}: message and channel review`, owner: NEEDS_INPUT, timing: timing },
        ],
      },
    },
    {
      id: "communications",
      title: "5. Communication plan",
      source: "Uploaded document + Echo guardrails + Smart Brevity + Chewy brand rules",
      sourceSupported: [
        field("message-change", "Source-supported change statement", change),
        field("message-outcome", "Source-supported audience value", outcome),
      ],
      suggestedActions: [
        field("writing-approach", "Suggested message structure", `Headline: ${provided(intake.projectName, "Needs user input - concise headline")}\nWhat's new: ${change}\nWhy it matters: ${outcome}\n\nUse plain language, sentence case, concrete next steps, and no hype or pet puns.`),
        field("policy-note", "Writing-guidance status", "Writing and Smart Brevity guidance is applied as a drafting aid. Confirm any rule that is not explicitly stated as company policy."),
      ],
      needsInput: [
        field("approved-channels", "Approved channels and senders", NEEDS_INPUT),
        field("message-approvals", "Message approvers", NEEDS_INPUT),
      ],
      table: {
        label: "Communication matrix",
        columns: [
          { key: "audience", label: "Audience", width: "medium" },
          { key: "objective", label: "Communication objective", width: "large" },
          { key: "message", label: "Key message", width: "large" },
          { key: "sender", label: "Message sender", width: "medium" },
          { key: "channel", label: "Method or channel", width: "medium" },
          { key: "timing", label: "Timing", width: "medium" },
          { key: "frequency", label: "Frequency", width: "small" },
          { key: "owner", label: "Owner", width: "medium" },
          { key: "cta", label: "Call to action", width: "large" },
          { key: "status", label: "Status", width: "small" },
        ],
        rows: audiences.map((audience) => ({
          audience,
          objective: "Build understanding of what is changing and why it matters.",
          message: `What's new: ${change}\nWhy it matters: ${outcome}`,
          sender: NEEDS_INPUT,
          channel: `${RECOMMENDED}: leader-led discussion plus written reference`,
          timing,
          frequency: `${RECOMMENDED}: initial message plus reinforcement`,
          owner: NEEDS_INPUT,
          cta: NEEDS_INPUT,
          status: "Draft",
        })),
      },
    },
    {
      id: "leaders",
      title: "6. Leader and manager activation",
      source: "Uploaded document + Change Navigation strategic framework",
      sourceSupported: [
        field("leader-change", "What leaders need to understand", change),
        field("leader-outcome", "Why it matters", outcome),
        field("leader-readiness", "Readiness evidence", readiness),
      ],
      suggestedActions: [
        field("leader-communicate", "What leaders should communicate", `What's new: ${change}\nWhy it matters: ${outcome}\nWhat Team Members should do: ${NEEDS_INPUT}`),
        field("leader-actions", "Actions leaders should take", "Recommended - confirm: review the narrative and boundaries, ask questions before cascade, hold a team discussion, capture concerns, and use the escalation path."),
        field("talking-points", "Manager talking points", `1. What is changing: ${change}\n2. Why it matters: ${outcome}\n3. What this means for our team: ${NEEDS_INPUT}\n4. What happens next: ${timing}`),
        field("discussion-questions", "Suggested team discussion questions", "What feels clear?\nWhat could make this difficult in your work?\nWhat support or clarification would help?\nWhat should leaders escalate?"),
        field("feedback-process", "Escalation or feedback process", "Recommended - confirm: capture themes after leader discussions, assign an owner, and publish answers in the single source of truth."),
      ],
      needsInput: [
        field("leader-names", "Leader and manager names", NEEDS_INPUT),
        field("escalation-owner", "Escalation owner and response time", NEEDS_INPUT),
      ],
    },
    {
      id: "training",
      title: "7. Training and support plan",
      source: "Uploaded document + Change Navigation strategic framework",
      sourceSupported: [
        field("training-audiences", "Target audiences identified", provided(intake.audiences)),
        field("training-timing", "Timing identified", timing),
      ],
      suggestedActions: [
        field("training-approach", "Support approach", "Recommended - confirm: match the learning method to the real task or behavior change, provide a durable job aid, and verify understanding before activation."),
      ],
      needsInput: [
        field("skill-gap", "Validated skills or knowledge gaps", NEEDS_INPUT),
      ],
      table: {
        label: "Training and support matrix",
        columns: [
          { key: "skill", label: "Skill or knowledge required", width: "large" },
          { key: "activity", label: "Learning or support activity", width: "large" },
          { key: "audience", label: "Target audience", width: "medium" },
          { key: "method", label: "Delivery method", width: "medium" },
          { key: "timing", label: "Timing", width: "medium" },
          { key: "owner", label: "Owner", width: "medium" },
          { key: "materials", label: "Supporting materials", width: "large" },
          { key: "check", label: "Completion or understanding check", width: "large" },
        ],
        rows: audiences.map((audience) => ({
          skill: NEEDS_INPUT,
          activity: `${RECOMMENDED}: role-relevant practice and Q&A`,
          audience,
          method: `${RECOMMENDED}: leader-led session or guided practice`,
          timing,
          owner: NEEDS_INPUT,
          materials: `${RECOMMENDED}: FAQ, job aid, and support path`,
          check: `${RECOMMENDED}: knowledge check or observed practice`,
        })),
      },
    },
    {
      id: "risk",
      title: "8. Readiness, resistance, and risk plan",
      source: "Uploaded document + Risk Signal & Readiness Gate",
      sourceSupported: [
        field("risk-signals", "Risk signals detected", riskLine),
        field("readiness-detail", "Readiness evidence provided", readiness),
        field("sensitivity-detail", "Sensitivities or approvals provided", sensitivities),
      ],
      suggestedActions: [
        field("readiness-gate", "Readiness gate", assessment.size === "L" || assessment.size === "XL"
          ? "Pause broad activation until accountable leaders and required reviewers confirm readiness."
          : "Confirm owner, audience readiness, and message accuracy before broad activation."),
        field("human-review-guidance", "Human review guidance", humanReview),
      ],
      needsInput: [
        field("risk-owners", "Named risk owners and escalation decision makers", NEEDS_INPUT),
      ],
      table: {
        label: "Risk and readiness matrix",
        columns: [
          { key: "risk", label: "Risk, resistance point, or readiness gap", width: "large" },
          { key: "audience", label: "Audience affected", width: "medium" },
          { key: "likelihood", label: "Likelihood", width: "small" },
          { key: "impact", label: "Impact", width: "small" },
          { key: "signs", label: "Warning signs", width: "large" },
          { key: "mitigation", label: "Mitigation action", width: "large" },
          { key: "owner", label: "Owner", width: "medium" },
          { key: "escalation", label: "Escalation needed", width: "medium" },
          { key: "humanReview", label: "Human review required", width: "medium" },
        ],
        rows: (assessment.risks.length ? assessment.risks : ["Readiness and resistance validation incomplete"]).map((risk) => ({
          risk,
          audience: provided(intake.audiences),
          likelihood: NEEDS_INPUT,
          impact: NEEDS_INPUT,
          signs: NEEDS_INPUT,
          mitigation: `${RECOMMENDED}: validate with affected groups and define a response trigger`,
          owner: NEEDS_INPUT,
          escalation: assessment.humanReview.length ? "Yes - confirm route" : NEEDS_INPUT,
          humanReview: assessment.humanReview.length ? "Yes" : "Confirm",
        })),
      },
    },
    {
      id: "timeline",
      title: "9. Activation timeline, ownership, and measurement",
      source: "Uploaded document + Change Navigation strategic framework",
      sourceSupported: [
        field("target-window", "Target timing", timing),
        field("project-outcome", "Outcome to measure", outcome),
      ],
      suggestedActions: [
        field("sequence", "Activation sequence", "Align -> Prepare -> Equip leaders -> Activate -> Reinforce"),
        field("timing-guidance", "Timing guidance", recommendedTiming),
      ],
      needsInput: [
        field("milestone-owners", "Named owners, exact dates, and approval gates", NEEDS_INPUT),
        field("immediate-actions", "Immediate next actions", NEEDS_INPUT),
      ],
      table: {
        label: "Activation timeline",
        columns: [
          { key: "milestone", label: "Major milestone", width: "medium" },
          { key: "action", label: "Action", width: "large" },
          { key: "phase", label: "Launch phase", width: "small" },
          { key: "owner", label: "Owner", width: "medium" },
          { key: "date", label: "Target date", width: "medium" },
          { key: "status", label: "Status", width: "small" },
          { key: "measure", label: "Adoption or effectiveness measure", width: "large" },
          { key: "feedback", label: "Feedback method", width: "large" },
        ],
        rows: [
          { milestone: "Align", action: "Confirm scope, impact, risk, and decision rights", phase: "Before launch", owner: NEEDS_INPUT, date: NEEDS_INPUT, status: "Not started", measure: "Stakeholder alignment confirmed", feedback: "Decision log" },
          { milestone: "Prepare", action: "Complete audience, communication, training, and support plans", phase: "Before launch", owner: NEEDS_INPUT, date: NEEDS_INPUT, status: "Not started", measure: "Required assets ready", feedback: "Readiness review" },
          { milestone: "Equip leaders", action: "Provide narrative, talking points, FAQs, and escalation path", phase: "Before launch", owner: NEEDS_INPUT, date: NEEDS_INPUT, status: "Not started", measure: `${RECOMMENDED}: leader confidence pulse`, feedback: "Leader Q&A and pulse" },
          { milestone: "Activate", action: "Launch approved communication, learning, and support", phase: "During launch", owner: NEEDS_INPUT, date: timing, status: "Not started", measure: `${RECOMMENDED}: initial understanding and adoption`, feedback: "Support themes and pulse" },
          { milestone: "Reinforce", action: "Address friction, repeat critical messages, and adjust support", phase: "After launch", owner: NEEDS_INPUT, date: NEEDS_INPUT, status: "Not started", measure: `${RECOMMENDED}: sustained behavior and effectiveness`, feedback: "Team feedback and operational measures" },
        ],
      },
    },
  ];
}

export function extractHints(text: string, fileName: string): Partial<Intake> {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const dateMatches = clean.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/gi) ?? [];
  const audienceTerms = ["Team Members", "leaders", "managers", "customers", "Customer Care", "Operations", "Product", "HR", "Communications"];
  const foundAudiences = audienceTerms.filter((term) => clean.toLowerCase().includes(term.toLowerCase()));
  return {
    projectName: fileName.replace(/\.docx$/i, "").replace(/[_-]+/g, " "),
    changeSummary: sentences.slice(0, 2).join(" ").slice(0, 520),
    audiences: [...new Set(foundAudiences)].join(", "),
    timing: [...new Set(dateMatches)].slice(0, 4).join("; "),
  };
}

function allPlanText(sections: PlanSection[]) {
  return sections.flatMap((section) => [
    ...section.sourceSupported.map((item) => item.value),
    ...section.suggestedActions.map((item) => item.value),
    ...section.needsInput.map((item) => item.value),
    ...(section.table?.rows.flatMap((row) => Object.values(row)) ?? []),
  ]).join(" ");
}

export function writingChecks(sections: PlanSection[]) {
  const text = allPlanText(sections);
  const headline = sections.find((section) => section.id === "communications")
    ?.suggestedActions.find((item) => item.id === "writing-approach")?.value.split("\n")[0] ?? "";
  return [
    { label: "Sentence-case headings", status: "pass" as const },
    { label: "Headline at 10 words or fewer", status: headline.split(/\s+/).length <= 11 ? "pass" as const : "review" as const },
    { label: "What's new + why it matters", status: text.includes("What's new:") && text.includes("Why it matters:") ? "pass" as const : "review" as const },
    { label: "No pet puns or hype", status: /paw-some|purrfect|game-changing|revolutionary/i.test(text) ? "review" as const : "pass" as const },
    { label: "Acronyms expanded on first use", status: "review" as const },
    { label: "Links, dates, and approvals verified", status: "review" as const },
  ];
}

export function serializePlan(projectName: string, sections: PlanSection[]) {
  const lines = [
    `${projectName || "Change activation plan"}`,
    "Working draft - human review required",
    "",
  ];

  for (const section of sections) {
    lines.push(section.title, `Grounded in: ${section.source}`, "");
    const categories: Array<[string, PlanField[]]> = [
      ["Source-supported information", section.sourceSupported],
      ["Suggested plan actions", section.suggestedActions],
      ["Information to provide or confirm", section.needsInput],
    ];
    for (const [label, fields] of categories) {
      lines.push(label);
      for (const item of fields) lines.push(`${item.label}:`, item.value, "");
    }
    if (section.table) {
      lines.push(section.table.label);
      lines.push(section.table.columns.map((column) => column.label).join("\t"));
      for (const row of section.table.rows) {
        lines.push(section.table.columns.map((column) => row[column.key] ?? "").join("\t"));
      }
      lines.push("");
    }
    lines.push("----------------------------------------", "");
  }
  return lines.join("\n");
}
