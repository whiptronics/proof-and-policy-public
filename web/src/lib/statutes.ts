// The statutory change matrix for grocery wine: each provision that matters, what it does today, what a bill would
// change, and which designs need the change. One source for the framework page, the export, the briefing and criterion
// 10 of the design comparison (policyDesigns.ts counts amendments from here). Every "current effect" was read from the
// official text named in LAW_SOURCES; nothing here is legal advice or attorney-reviewed.
import type { DesignId } from "./policyDesigns";

export const STATUTES_METHOD = "statute-matrix@1.0";

/** current_law: no change needed. amendment: the bill must change or decide it. unresolved: a legal question not
 * answered by the text read. */
export type RowKind = "current_law" | "amendment" | "unresolved";

export interface LawSource {
  id: string;
  title: string;
  url: string;
  /** The version read, as the publisher labels it. */
  version: string;
  read: string;
  /** First 16 hex digits of the SHA-256 of the file read; null for a page read through a fetch tool. */
  sha16: string | null;
}

export const LAW_SOURCES: LawSource[] = [
  { id: "ut_32b7", title: "Utah Code Title 32B, Chapter 7, Off-Premise Beer Retailer Act (XML)", url: "https://le.utah.gov/xcode/Title32B/Chapter7/C32B-7_1800010118000101.xml", version: "current version on 2026-11-19; 32B-7-202 as amended by 2026 ch. 362, 32B-7-305 by 2026 ch. 396", read: "2026-11-19", sha16: "7a23095d498b7c72" },
  { id: "ut_32b1p7", title: "Utah Code 32B-1, Part 7, Alcohol Training and Education Act (XML)", url: "https://le.utah.gov/xcode/Title32B/Chapter1/C32B-1-P7_2019051420190514.xml", version: "current version on 2026-11-19 (32B-1-704 as amended by 2025 ch. 471)", read: "2026-11-19", sha16: "b4e10f86593061bd" },
  { id: "ut_32b1_407", title: "Utah Code 32B-1-407, Verification of proof of age by applicable licensees (XML)", url: "https://le.utah.gov/xcode/Title32B/Chapter1/C32B-1-S407_2026050620260506.xml", version: "effective 5/6/2026 (2026 ch. 46)", read: "2026-11-19", sha16: "2cc2fb7f3e81d40c" },
  { id: "ut_32b4_403", title: "Utah Code 32B-4-403, Unlawful sale, offer for sale, or furnishing to minor (XML)", url: "https://le.utah.gov/xcode/Title32B/Chapter4/C32B-4-S403_2022050420220601.xml", version: "effective 6/1/2022 (2022 ch. 447)", read: "2026-11-19", sha16: "78ad91d195f66455" },
  { id: "ut_pinned", title: "Utah Code 32B-1-102, 32B-2-304/-305, 32B-2-501/-601/-603, 32B-4-401/-402, 32B-11-208/-608, 59-15-101", url: "https://le.utah.gov/UtahCode/historical.jsp", version: "pinned versions in config/sources/utah_code_history.yaml and the saved sources cited by wineAlternatives.ts", read: "pinned earlier", sha16: null },
  { id: "us_27_203", title: "27 U.S.C. § 203, Unlawful businesses without permit (LII)", url: "https://www.law.cornell.edu/uscode/text/27/203", version: "LII current text", read: "2026-11-19", sha16: null },
  { id: "us_27_205", title: "27 U.S.C. § 205, Unfair competition and unlawful practices (LII)", url: "https://www.law.cornell.edu/uscode/text/27/205", version: "LII current text", read: "2026-11-19", sha16: null },
  { id: "cfr_27_6", title: "27 CFR part 6, sections 6.3, 6.21, 6.41 (LII mirror; eCFR redirected)", url: "https://www.law.cornell.edu/cfr/text/27/part-6", version: "LII; 6.21 notes T.D. TTB-196, 89 FR 87935 (Nov. 6, 2024)", read: "2026-11-19", sha16: null },
];

export interface StatuteRow {
  id: string;
  provision: string;
  cite: string;
  /** What the provision does today, from the text read. */
  effect: string;
  change: string;
  purpose: string;
  dependencies: string;
  /** Designs the row bears on, and how. A design left out is not affected. */
  by: Partial<Record<Exclude<DesignId, "A">, RowKind>>;
  source: string;
}

const ALL = (k: RowKind) => ({ B: k, C: k, D: k, E: k });

export const STATUTE_ROWS: StatuteRow[] = [
  {
    id: "M01",
    provision: "Definitions: wine is liquor",
    cite: "Utah Code 32B-1-102(68), (143)",
    effect: "Wine is liquor under Title 32B; a beer license gives no authority to sell it.",
    change: "Define a grocery wine retailer and the product it may sell: sealed wine only, no spirits.",
    purpose: "Names the new license and keeps spirits out of it.",
    dependencies: "M02",
    by: ALL("amendment"),
    source: "ut_pinned",
  },
  {
    id: "M02",
    provision: "A grocery wine license",
    cite: "Utah Code 32B-7-401 to -409 (the off-premise beer state license)",
    effect: "Since July 1, 2018, the commission issues off-premise beer retailer state licenses; an applicant files the local authority's written consent, a business license, a floor plan showing each beer display and consent to inspection, and pays a $75 application fee and $250 initial fee ($175 renewal). The license covers beer only.",
    change: "Add a grocery wine license on the same pattern: issued by the commission after a department investigation, with local consent, a floor plan of the wine display, and fees set to cover the new administration.",
    purpose: "Uses DABS's existing off-premise licensing process instead of building a new one.",
    dependencies: "M01, M10; fee level (see business impacts)",
    by: ALL("amendment"),
    source: "ut_32b7",
  },
  {
    id: "M03",
    provision: "DABS as supplier to grocers",
    cite: "Utah Code Title 32B, Chapter 2 (32B-2-501, -601, -603)",
    effect: "DABS sells to the public through state stores and package agencies. How DABS supplies retail licensees today was not read for this matrix.",
    change: "Authorize DABS to sell wine to grocery wine licensees, and set the price rule (today's shelf price in the comparison's main case, below it in the framework's) and delivery terms.",
    purpose: "Keeps the state's take inside the wholesale price, as today.",
    dependencies: "M04",
    by: { B: "amendment", E: "amendment" },
    source: "ut_pinned",
  },
  {
    id: "M04",
    provision: "DABS's markup floor",
    cite: "Utah Code 32B-2-304(2)(b)",
    effect: "DABS must mark wine up at least 88.5% over landed case cost. A price to grocers at today's shelf price meets the floor; one below about 99.5% of the shelf price would not.",
    change: "None at today's shelf price, the comparison's main case. The framework's same shelf price, with DABS's price to grocers below its shelf price, needs the bill to set that price apart from the floor (framework point 5).",
    purpose: "Shows that B's main case is lawful under the current markup.",
    dependencies: "M03",
    by: { B: "current_law", E: "current_law" },
    source: "ut_pinned",
  },
  {
    id: "M05",
    provision: "Private wholesale of wine",
    cite: "Utah Code 32B-11-208; 32B-4-401(2)",
    effect: "Manufacturers may sell liquor in Utah only to the department or military installations, and out-of-state sellers may ship liquor into Utah only to the department.",
    change: "License private wine wholesalers to buy from suppliers and sell to grocery wine licensees, with records and audits.",
    purpose: "The supply route for design C.",
    dependencies: "M07, M09",
    by: { C: "amendment", E: "amendment" },
    source: "ut_pinned",
  },
  {
    id: "M06",
    provision: "Producers supplying grocers directly",
    cite: "Utah Code 32B-11-208; 32B-4-401(2)",
    effect: "As M05: producers may sell only to the department or military installations.",
    change: "Authorize producers, importers or qualifying wineries to sell to grocery wine licensees, with a registration for each and delivery rules.",
    purpose: "The supply route for design D.",
    dependencies: "M07, M09, M16",
    by: { D: "amendment", E: "amendment" },
    source: "ut_pinned",
  },
  {
    id: "M07",
    provision: "A state charge on grocery wine",
    cite: "Utah Code 59-15-101 (beer only)",
    effect: "Utah collects on wine through the department's markup; no wine excise was found in the saved sources.",
    change: "Create a charge: its base, rate, collection point and administrator.",
    purpose: "Collects the state's take when DABS does not sell the wine.",
    dependencies: "M08, M09",
    by: { C: "amendment", D: "amendment", E: "amendment" },
    source: "ut_pinned",
  },
  {
    id: "M08",
    provision: "Sales-tax base",
    cite: "Utah Code Title 59, Chapter 12 (not read)",
    effect: "Not read: whether a charge is part of the price subject to sales tax.",
    change: "Decide it in the bill; both treatments are modeled.",
    purpose: "Changes the sales tax the state keeps on the moved wine.",
    dependencies: "M07",
    by: { C: "unresolved", D: "unresolved", E: "unresolved" },
    source: "ut_pinned",
  },
  {
    id: "M09",
    provision: "Deposits to dedicated funds",
    cite: "Utah Code 32B-2-304(5), 32B-2-305(4)",
    effect: "Deposits are figured on DABS's gross revenue from sales of liquor. Wine that DABS no longer sells carries none.",
    change: "B: decide whether DABS's sales to grocers count. C, D, E: allocate part of the charge explicitly if the funds are to stay whole.",
    purpose: "Keeps school-lunch and other dedicated deposits from falling with DABS's sales.",
    dependencies: "M07",
    by: { B: "unresolved", C: "amendment", D: "amendment", E: "amendment" },
    source: "ut_pinned",
  },
  {
    id: "M10",
    provision: "Local authority",
    cite: "Utah Code 32B-7-201",
    effect: "For beer, a local authority may tax or prohibit retail sale, issue, suspend and revoke local licenses, and set proximity rules near community locations; it may not license a minor.",
    change: "Decide whether local authorities may prohibit, limit or set distance rules for grocery wine, as they may for beer.",
    purpose: "Local control and outlet density (see Safeguards).",
    dependencies: "M02",
    by: ALL("amendment"),
    source: "ut_32b7",
  },
  {
    id: "M11",
    provision: "Operating rules",
    cite: "Utah Code 32B-7-202",
    effect: "For beer: buy only from a licensed beer wholesaler or small brewer; no container over 2 liters; staff may not drink on duty; a minor may sell only at 16 or older under supervision of someone 21 or older; no sale to a minor, an intoxicated or interdicted person; beer shown in no more than two places, apart from soft drinks, with a set warning sign; staff ID badges and records; proof of age before every sale, and an interdiction check on Utah licenses.",
    change: "Apply the rules to wine and decide: the seller's minimum age, the lawful supply source, a wine display rule and container limit, and whether curbside pickup extends to wine.",
    purpose: "The day-to-day safeguards at the register.",
    dependencies: "M02, M03 or M05 or M06",
    by: ALL("amendment"),
    source: "ut_32b7",
  },
  {
    id: "M12",
    provision: "Training",
    cite: "Utah Code 32B-1-701, -703, -704",
    effect: "Off-premise beer managers and staff must complete an alcohol training seminar before starting work; managers complete the department's program within 30 days; a second violation for sales to a minor or an intoxicated person within 36 months requires retraining.",
    change: "Extend the definitions to grocery wine licensees' managers and staff.",
    purpose: "Training before anyone sells wine.",
    dependencies: "M02",
    by: ALL("amendment"),
    source: "ut_32b1p7",
  },
  {
    id: "M13",
    provision: "Electronic ID checks",
    cite: "Utah Code 32B-1-407",
    effect: "Electronic verification of ID is required at bars, taverns and restaurants, and at off-premise beer retailers only for designated-stall pickup.",
    change: "Decide whether grocery wine sales need electronic verification at the register.",
    purpose: "Harder to pass a fake or borrowed ID.",
    dependencies: "M11",
    by: ALL("amendment"),
    source: "ut_32b1_407",
  },
  {
    id: "M14",
    provision: "Sales to minors",
    cite: "Utah Code 32B-4-403",
    effect: "No person may sell or furnish an alcoholic product to a minor: a class B misdemeanor if negligent or reckless, class A if knowing.",
    change: "None: it already covers anyone selling wine.",
    purpose: "The criminal penalty is already in place.",
    dependencies: "—",
    by: ALL("current_law"),
    source: "ut_32b4_403",
  },
  {
    id: "M15",
    provision: "Compliance checks and violation records",
    cite: "Utah Code 32B-7-305; 32B-1-705",
    effect: "The Department of Public Safety reimburses local police for alcohol compliance checks at off-premise beer retailers and reports on them each October 1; the commission records each sale to a minor by staff of retail licensees and off-premise beer retailers.",
    change: "Extend both to grocery wine licensees, and fund the added checks.",
    purpose: "Measured enforcement, and the monitoring indicators.",
    dependencies: "M02; fees",
    by: ALL("amendment"),
    source: "ut_32b7",
  },
  {
    id: "M16",
    provision: "Federal permits and trade practices",
    cite: "27 U.S.C. 203, 205; 27 CFR part 6",
    effect: "Importers, producers and those buying for resale at wholesale need a federal basic permit; retailers are not among the permit categories, and state agencies need none. Section 205 bars exclusive outlets, tied-house inducements (things of value, paying for display, credit beyond usual terms, quotas), commercial bribery and consignment sales by industry members dealing with retailers in interstate commerce. The text read does not require three tiers.",
    change: "None for B or C. For D and E: whether a producer selling to grocers needs a wholesaler's basic permit (27 CFR part 1 was not read) and how part 6's exceptions apply.",
    purpose: "Federal limits on producers' dealings with grocers.",
    dependencies: "M06",
    by: { B: "current_law", C: "current_law", D: "unresolved", E: "unresolved" },
    source: "us_27_205",
  },
  {
    id: "M17",
    provision: "Local sales tax",
    cite: "Tax Commission (question for staff)",
    effect: "Not read: whether state-store sales carry local sales tax as grocery sales would.",
    change: "Ask the Tax Commission; not modeled.",
    purpose: "Local governments' share of the moved wine.",
    dependencies: "—",
    by: ALL("unresolved"),
    source: "ut_pinned",
  },
];

export const amendmentsFor = (d: DesignId): StatuteRow[] => (d === "A" ? [] : STATUTE_ROWS.filter((r) => r.by[d] === "amendment"));
export const openQuestionsFor = (d: DesignId): StatuteRow[] => (d === "A" ? [] : STATUTE_ROWS.filter((r) => r.by[d] === "unresolved"));
