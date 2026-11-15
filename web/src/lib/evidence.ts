// One vocabulary for what a value rests on, shared by the briefing, the initiative page and Definitions & methods.
// Origin and review are separate questions: a figure can come from an official report and still await a person's check
// of the transcription. Nothing here marks a value as independently verified; that needs a recorded review, and as of
// this release there is none.

export type EvidenceClass = "source" | "calculated" | "proxy" | "illustrative" | "policy" | "unmeasured";

export const EVIDENCE: Record<EvidenceClass, { label: string; symbol: string; help: string }> = {
  source: { label: "Published source", symbol: "S", help: "Read from an official report, statute or dataset, as published." },
  calculated: { label: "Calculated", symbol: "C", help: "Computed from published values (by the model or a documented script); scripts recompute the arithmetic." },
  proxy: { label: "Proxy", symbol: "P", help: "A published figure for something broader, used in place of the wine-specific value nobody publishes." },
  illustrative: { label: "Illustrative", symbol: "I", help: "A value chosen to show how the result moves; no source measures it." },
  policy: { label: "Policy choice", symbol: "L", help: "Set by whoever writes the bill, not measured." },
  unmeasured: { label: "Unmeasured", symbol: "?", help: "No source gives it; the model leaves it out or sets a placeholder." },
};

export const EVIDENCE_ORDER: EvidenceClass[] = ["source", "calculated", "proxy", "illustrative", "policy", "unmeasured"];

/** The review status of this release's hand-entered values: none has been reviewed by a person. */
export const REVIEW_STATUS = "Not yet reviewed by a person. An AI assistant compared the value with the cited document.";
