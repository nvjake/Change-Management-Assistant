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

export type PlanSection = {
  id: string;
  title: string;
  source: string;
  content: string;
};

const includesAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

export function assessChange(intake: Intake): Assessment {
  const text = Object.values(intake).join(" ").toLowerCase();
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
  const matches = typeSignals.filter(([, terms]) => includesAny(` ${text} `, terms));
  const primaryType = matches[0]?.[0] ?? "Awareness";
  const secondaryType = matches[1]?.[0] ?? "Behavior";

  const risks: string[] = [];
  const humanReview: string[] = [];
  const peopleRisk = includesAny(text, ["staffing", "headcount", "job security", "reporting line", "performance", "layoff"]);
  const aiRisk = includesAny(text, [" ai ", "artificial intelligence", "automation", "replacement", "surveillance", "deflection"]);
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
    humanReview.push("Route governed claims to the appropriate legal, privacy, compliance, or Corporate Communications owner.");
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
  const audience = intake.audiences || "Audience to confirm";
  const timing = intake.timing || "Timing to confirm";
  const riskLine = assessment.risks.length ? assessment.risks.join("; ") : "No high-risk signals detected from the uploaded document.";
  const gate = assessment.size === "L" || assessment.size === "XL"
    ? "Pause broad activation until accountable leaders and required reviewers confirm readiness."
    : "Confirm owner, audience readiness, and message accuracy before broad activation.";
  const mediumTiming = assessment.size === "M"
    ? "Suggested—confirm with Communications: begin preparation 18–20 business days before launch and allow at least five business days for shared-channel review."
    : "Set dates backward from the activation milestone after readiness is confirmed.";

  return [
    {
      id: "snapshot",
      title: "1. Executive snapshot",
      source: "Change Navigation strategic framework",
      content: `${intake.projectName || "Untitled change"}\n\nWhat’s new: ${intake.changeSummary || "Describe the change."}\n\nWhy it matters: ${intake.outcome || "Clarify the intended outcome and value."}`,
    },
    {
      id: "classification",
      title: "2. Change classification",
      source: "Decision Mapping Logic v1",
      content: `Primary type: ${assessment.primaryType}\nSecondary type: ${assessment.secondaryType}\nRecommended path: ${assessment.size}\n\nThis is a decision-support recommendation, not an approval.`
    },
    {
      id: "risk",
      title: "3. Risk and readiness",
      source: "Risk Signal & Readiness Gate",
      content: `Signals: ${riskLine}\n\nReadiness evidence: ${intake.readiness || "Not yet provided."}\n\nGate: ${gate}`,
    },
    {
      id: "impact",
      title: "4. Audience and functional impact",
      source: "Functional Impact Translation Guide",
      content: `Priority audiences: ${audience}\n\nFor each audience, confirm what they need to know, feel, do, stop, start, and continue. Separate function-based impacts from leader-level cascade needs.`
    },
    {
      id: "stakeholders",
      title: "5. Stakeholders and decision rights",
      source: "Change Navigation strategic framework",
      content: `Name the accountable sponsor, operational owner, Communications partner, and any HR, Legal, Privacy, Learning, Product, or Corporate Communications reviewers.\n\nAlignment moment 1: validate the change, impact, and risk posture.\nAlignment moment 2: validate readiness, sequencing, and final narrative.`
    },
    {
      id: "narrative",
      title: "6. Narrative and key messages",
      source: "Echo guardrails + Smart Brevity + Chewy brand rules",
      content: `Headline: ${intake.projectName || "Name the change in 10 words or fewer"}\n\nWhat’s new: ${intake.changeSummary || "State the essential update in one sentence."}\n\nWhy it matters: ${intake.outcome || "Explain the audience-specific value in one sentence."}\n\nUse plain language, sentence case, and concrete next steps. Avoid hype, jargon, pet puns, and unsupported reassurance.`
    },
    {
      id: "roadmap",
      title: "7. Activation roadmap",
      source: "Change Navigation strategic framework",
      content: `Align → Prepare → Equip leaders → Activate → Reinforce\n\nTarget timing: ${timing}\n${mediumTiming}\n\nSequence by readiness: leader enablement and support resources precede broad reach.`
    },
    {
      id: "leaders",
      title: "8. Leader enablement and channels",
      source: "Risk gate + example plans",
      content: `Equip leaders with a shared narrative, boundaries, FAQs, escalation paths, and time to ask questions. Use lower-risk leader channels before narrative-amplifying or external channels.\n\nChannel choices and exact lead times require Communications confirmation.`
    },
    {
      id: "reinforcement",
      title: "9. Reinforcement and measurement",
      source: "Change Navigation strategic framework",
      content: `Measure understanding, readiness, adoption, friction, and sustained behavior—not reach alone. Establish feedback loops, named owners, and review points after activation.\n\nHuman judgment flags:\n${assessment.humanReview.length ? assessment.humanReview.map((item) => `• ${item}`).join("\n") : "• Confirm final accuracy, ownership, and readiness before use."}`,
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

export function writingChecks(sections: PlanSection[]) {
  const text = sections.map((section) => section.content).join(" ");
  return [
    { label: "Sentence-case headings", status: "pass" as const },
    { label: "Headline at 10 words or fewer", status: sections[0]?.content.split("\n")[0].split(/\s+/).length <= 10 ? "pass" as const : "review" as const },
    { label: "What’s new + why it matters", status: text.includes("What’s new:") && text.includes("Why it matters:") ? "pass" as const : "review" as const },
    { label: "No pet puns or hype", status: /paw-some|purrfect|game-changing|revolutionary/i.test(text) ? "review" as const : "pass" as const },
    { label: "Acronyms expanded on first use", status: "review" as const },
    { label: "Links, dates, and approvals verified", status: "review" as const },
  ];
}
