import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import vectors from "./publicFunding.vectors.json";
import { PUBLIC_FUNDING as PF } from "./publicFunding.generated";
import {
  COMPARATORS,
  COMPARISON_STATES,
  CONTRARY,
  DEFAULT_INPUTS,
  MAP_MARGINS,
  MAP_PRICES,
  PACKAGE_AGENCY_REMITTANCE,
  PROGRAMS,
  T,
  bottleReceipt,
  lawIsStale,
  compare,
  consolidatedReceipts,
  decodeScenario,
  documentedOnly,
  encodeScenario,
  fundingScenario,
  inFy2024Dollars,
  marginOfMarkup,
  observedCsv,
  openQuestions,
  priceFromMargin,
  priceFromMarkup,
  priceNeutral,
  priceRevenueMap,
  revenueNeutral,
  scenarioJson,
  spendingRanks,
  stateComparison,
  stateTakePerBottle,
  stressTest,
  type FundingInputs,
} from "./publicFunding";
import { defaultDesignsReport, whatIfDesigns, terms } from "./policyDesigns";
import { samePriceCase } from "./samePrice";

const ex = (id: string) => vectors.examples.find((e) => e.id === id) as unknown as Record<string, number | null | boolean | string>;
const at = (over: Partial<FundingInputs>) => fundingScenario({ ...DEFAULT_INPUTS, ...over });

describe("synthetic vectors (the devplan's FISCAL_AND_PRICE_MODEL fixtures)", () => {
  test("F01 markup on cost is not a margin", () => {
    const v = ex("markup");
    expect(priceFromMarkup(v.landed_cost_usd as number, v.markup_on_cost as number)).toBeCloseTo(v.expected_pre_tax_price_usd as number, 9);
    expect(marginOfMarkup(v.markup_on_cost as number)).toBeCloseTo(v.expected_gross_margin as number, 12);
  });
  test("F02/F03 margin on price versus markup on cost", () => {
    expect(priceFromMargin(ex("gross_margin").retail_acquisition_usd as number, ex("gross_margin").retailer_gross_margin as number)).toBeCloseTo(20, 9);
    expect(priceFromMarkup(ex("markup_cost").retail_acquisition_usd as number, ex("markup_cost").retailer_markup_on_cost as number)).toBeCloseTo(18.75, 9);
  });
  test("F11 a dollar short is not revenue neutral, F12 a higher price is not price neutral", () => {
    expect(revenueNeutral(ex("net_revenue_loss").baseline_net_receipts_usd as number, ex("net_revenue_loss").new_net_receipts_usd as number)).toBe("not_satisfied");
    expect(priceNeutral(ex("price_increase").baseline_price_usd as number, ex("price_increase").new_price_usd as number)).toBe("not_satisfied");
  });
  test("F05 an internal transfer nets out; F10 a missing value is undetermined", () => {
    const v = ex("consolidated_transfer");
    expect(consolidatedReceipts([{ amount: v.external_receipt_usd as number, internal: false }, { amount: v.state_internal_transfer_usd as number, internal: true }])).toBe(v.expected_consolidated_external_receipt_usd);
    expect(revenueNeutral(ex("undetermined").baseline_net_receipts_usd as number, ex("undetermined").new_net_receipts_usd as number | null)).toBe("undetermined");
  });
});

describe("observed figures", () => {
  test("F06 the six destinations sum to the stated total; the page 30 bridge closes", () => {
    const sum = PF.dabs.destinations.reduce((a, d) => a + d.amount, 0);
    expect(sum).toBe(PF.dabs.destinationsSum);
    expect(Math.round(sum / 1e5) / 10).toBe(204.5);
    const steps = PF.dabs.bridge.filter((b) => b.kind === "step" || b.kind === "unreconciled").reduce((a, b) => a + b.amount, 0);
    expect(PF.dabs.bridge[0].amount + steps).toBeCloseTo(PF.dabs.bridge.at(-1)!.amount, 0);
  });
  test("F07 the unitemized remainder is labeled unreconciled, not an expense", () => {
    const rest = PF.dabs.bridge.find((b) => b.id === "nonop_rest")!;
    expect(rest.kind).toBe("unreconciled");
    expect(rest.label).toMatch(/not itemized/);
  });
  test("F08 the observed baseline is all liquor, never wine", () => {
    expect(PF.dabs.destinations.every((d) => !/wine/i.test(d.label))).toBe(true);
  });
  test("L01-L05 every rule is dated, current law, quoted, and not human-reviewed", () => {
    for (const r of PF.law) {
      expect(r.status).toBe("current_law");
      expect(r.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.quote.length).toBeGreaterThan(20);
      expect(r.human_reviewed).toBe(false);
      expect(r.source.sha16).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(PROGRAMS.reduce((a, p) => a + p.rate, 0)).toBeCloseTo(PACKAGE_AGENCY_REMITTANCE, 12);
  });
  test("L04 S.B. 180 is a bill that did not pass, not law", () => {
    expect(PF.meals.sb180.stage).toBe("not_enacted");
    expect(PF.meals.sb180.timeline.at(-1)!.action).toMatch(/not passed/);
  });
  test("L06 headline figures cite a page and a pinned file; L07 both printings of a conflict are kept", () => {
    for (const d of PF.dabs.destinations) expect(d.locator).toMatch(/page \d+/);
    for (const s of [PF.dabs.source, PF.education.source, PF.districts.source, PF.education.cpi.source, PF.meals.brief, PF.meals.fiscalNote]) expect(s.sha16).toMatch(/^[0-9a-f]{16}$/);
    expect(PF.dabs.conflicts.length).toBeGreaterThan(0);
    for (const c of PF.dabs.conflicts) expect(c.page30).not.toBe(c.page32);
  });
  test("L08 an unknown is never stored as zero", () => {
    const r = fundingScenario(documentedOnly(DEFAULT_INPUTS));
    expect(r.movedDollars).toBeNull();
    expect(r.net).toBeNull();
    for (const p of r.programs) expect([p.baseline, p.after, p.delta]).toEqual([null, null, null]);
    for (const c of COMPARATORS.filter((c) => c.amount === null)) expect(compare(1_000_000, c)).toBeNull();
  });
});

describe("education", () => {
  test("E01 Census FY2024 per pupil current spending", () => {
    const get = (u: string) => PF.education.states.find((s) => s.usps === u)!.ppcs;
    expect(Math.round(PF.education.us.ppcs)).toBe(17619);
    expect([get("UT"), get("ID"), get("AZ")].map(Math.round)).toEqual([11347, 11060, 12003]);
  });
  test("E02/E03 Utah is 49th of 50 states; with D.C. the denominator is 51", () => {
    const s = spendingRanks("states").find((r) => r.usps === "UT")!;
    expect([s.rank, s.of]).toEqual([49, 50]);
    const d = spendingRanks("states_dc").find((r) => r.usps === "UT")!;
    expect([d.rank, d.of]).toEqual([PF.education.censusRankUT.rank, 51]);
  });
  test("E05 NAEP 2024 grade 8 math: Utah 282, national public 272, higher by NCES's test", () => {
    const m = PF.education.naep.math8.byJurisdiction;
    expect([Math.round(m.UT.score), Math.round(m.NP.score)]).toEqual([282, 272]);
    expect(m.UT.vsNation).toBe("higher");
  });
  test("E06/E07 CPI adjustment is reproducible and a missing value stays missing", () => {
    expect(inFy2024Dollars(100, "2024")).toBeCloseTo(100, 9);
    expect(inFy2024Dollars(100, "2019")!).toBeGreaterThan(100);
    expect(inFy2024Dollars(null, "2019")).toBeNull();
    expect(inFy2024Dollars(100, "2010")).toBeNull();
  });
  test("E09 districts keep their own ids; counties are a separate field", () => {
    const d = PF.districts.systems;
    expect(new Set(d.map((x) => x.ncesId)).size).toBe(d.length);
    expect(d.every((x) => x.countyFips.startsWith("49"))).toBe(true);
  });
});

describe("the scenario adapter agrees with the existing engines", () => {
  test("same shelf price: matches the purchase-flow engine's same-price case (independent implementation)", () => {
    for (const m of [0.05, 0.1, 0.2])
      for (const fees of [true, false]) {
        const ours = at({ arrangement: "B", price: 1, grocerMargin: m, savings: "none", fees }).net!;
        expect(Math.abs(ours - samePriceCase(m, "none", fees).net)).toBeLessThan(1_000);
      }
  });
  test("grocer-set price: matches the designs report's B and the what-if panel's C", () => {
    const B = defaultDesignsReport().results.find((r) => r.def.id === "B")!;
    const c = B.cases.find((k) => k.savings === "none" && k.limit === null)!;
    expect(at({ arrangement: "B", price: B.shelf, grocerMargin: B.grocerMargin!, savings: "none", fees: true }).net!).toBeCloseTo(c.netWithFees, -3);
    const w = whatIfDesigns(terms(), { grocerMargin: 0.28, distribution: 0.295, limit: null, savings: "none", admin: terms().admin, feesCoverAdmin: true });
    expect(at({ arrangement: "C", price: 1 + w.C.premium, grocerMargin: 0.28, distribution: 0.295, savings: "none", fees: true }).net!).toBeCloseTo(w.C.net, -2);
  });
  test("F13/F05 programs plus the rest equal the net change, and an aggregate gain can hide a program's loss", () => {
    for (const x of [at({}), at({ arrangement: "C", price: 1.3, grocerMargin: 0.28 }), at({ routing: "retail_value" }), at({ additional: 0.05 })]) {
      const sum = x.programs.reduce((a, p) => a + p.delta!, 0) + x.rest!;
      expect(sum).toBeCloseTo(x.net!, 3);
    }
    const c = at({ arrangement: "C", price: 1.55, grocerMargin: 0.28, routing: "law_as_written" });
    expect(c.conditions.revenue).toBe("satisfied");
    expect(c.programs.find((p) => p.id === "school_meals")!.financiallyProtected).toBe("not_satisfied");
    expect(c.conditions.programs).toBe("not_satisfied");
  });
  test("routing the deposit rates to the grocery sale protects every program at today's price", () => {
    const r = at({ arrangement: "C", price: 1, grocerMargin: 0.1, routing: "retail_value" });
    expect(r.programs.every((p) => p.financiallyProtected === "satisfied" && p.legallySpecified === "satisfied")).toBe(true);
  });
  test("F09/F14 no savings and no new purchases unless chosen; the same wine moves", () => {
    const r = at({ savings: "none", additional: 0 });
    expect(r.additionalDollars).toBe(0);
    expect(r.netPerDollar).toBeCloseTo(-0.1, 9); // the grocer's margin at the same price, nothing else
  });
  test("F10 documented inputs only: annual totals are undetermined; per-dollar signs still decide", () => {
    const r = fundingScenario(documentedOnly(DEFAULT_INPUTS));
    expect(r.net).toBeNull();
    expect(r.conditions.revenue).toBe("not_satisfied");
    expect(r.missing.join(" ")).toMatch(/not measured/);
    const nf = fundingScenario({ ...documentedOnly(DEFAULT_INPUTS), fees: false });
    expect(nf.conditions.revenue).toBe("undetermined");
  });
  test("a grocer margin below the grocery average is undetermined, zero is not viable", () => {
    expect(at({ grocerMargin: 0.1 }).conditions.grocer).toBe("undetermined");
    expect(at({ grocerMargin: 0 }).conditions.grocer).toBe("not_satisfied");
    expect(at({ grocerMargin: 0.3, price: 1 / 0.7 }).conditions.grocer).toBe("satisfied");
  });
  test("F19 invalid inputs are rejected with a defined result", () => {
    for (const bad of [{ grocerMargin: 1 }, { price: Number.NaN }, { share: -0.1 }, { price: Infinity }, { additional: 2 }])
      expect(at(bad as Partial<FundingInputs>).errors.length).toBeGreaterThan(0);
  });
});

describe("map, stress test and link", () => {
  test("F17/F18 every plotted point passes the canonical tests it is colored by; same price has no revenue-neutral margin above zero without savings", () => {
    for (const a of ["B", "C"] as const) {
      const pts = priceRevenueMap(a, "none");
      expect(pts.length).toBe(MAP_PRICES.length * MAP_MARGINS.length);
      for (const p of pts) {
        const r = at({ arrangement: a, price: p.price, grocerMargin: p.grocerMargin, savings: "none", fees: true });
        expect(p.region === "both" || p.region === "revenue_only").toBe(r.conditions.revenue === "satisfied");
        expect(p.region === "both" || p.region === "price_only").toBe(r.conditions.price === "satisfied");
      }
    }
    const samePrice = priceRevenueMap("B", "none").filter((p) => p.price === 1 && p.grocerMargin > 0);
    expect(samePrice.every((p) => p.region === "price_only")).toBe(true);
  });
  test("stress ranges are ordered and finite", () => {
    for (const r of stressTest(DEFAULT_INPUTS)) {
      expect(Number.isFinite(r.min) && Number.isFinite(r.max)).toBe(true);
      expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });
  test("U09 the link round-trips and rejects malformed input", () => {
    const x: FundingInputs = { ...DEFAULT_INPUTS, arrangement: "C", price: 1.25, share: null, routing: "retail_value" };
    expect(decodeScenario(encodeScenario(x))).toEqual({ ...x, price: 1.25, grocerMargin: 0.1, distribution: Number(x.distribution.toFixed(3)) });
    for (const bad of [null, "", "v2_B_1_0.1_0.3_0_0_0.3_0_1", "v1_Z_1.000_0.100_0.300_0.000_0_0.295_0_1", "v1_B_NaN_0.100_0.300_0.000_0_0.295_0_1", "v1_B_9.000_0.100_0.300_0.000_0_0.295_0_1", "v1_B_1.000_1.000_0.300_0.000_0_0.295_0_1", "v1_B_1.000_0.100_0.300_0.000_7_0.295_0_1", "x".repeat(200), "v1_B_1.000_0.100_0.300_0.000_0_0.295_0_1_extra"])
      expect(decodeScenario(bad)).toBeNull();
  });
  test("L09 the scenario export carries versions, link and caveats", () => {
    const j = JSON.parse(scenarioJson(DEFAULT_INPUTS));
    expect(j.model_version).toBe("public-funding@1.0");
    expect(j.engine).toBe("policy-designs@1.0");
    expect(j.link).toBe(encodeScenario(DEFAULT_INPUTS));
    expect(j.notes).toMatch(/not reviewed by a person/);
  });
});

describe("public value and the checklist", () => {
  test("comparators without a sourced unit cost return nothing", () => {
    for (const c of COMPARATORS) {
      if (c.amount === null) expect(compare(1e6, c)).toBeNull();
      else expect(compare(c.amount, c)).toBeCloseTo(1, 12);
    }
    expect(compare(Number.NaN, COMPARATORS[0])).toBeNull();
  });
  test("open questions list everything not specified", () => {
    expect(openQuestions({}).length).toBe(13);
    expect(openQuestions({ scope: "specified", local: "not_applicable", rate: "ambiguous" }).map((q) => q.id)).not.toContain("scope");
    expect(openQuestions({ rate: "ambiguous" }).find((q) => q.id === "rate")!.answer).toBe("ambiguous");
  });
});

describe("devplan rows F04, F15, F16, F20, E04 and E08", () => {
  test("F04 sales tax is charged once, on the shelf price, and the shopper's total shows it", () => {
    // Hand algebra for B with no grocer margin and no savings: DABS keeps P - L, tax is tau*P, today is mu + tau with
    // L + mu = 1, so the change per $ is (P - 1)(1 + tau). A second tax line or a tax on tax would break both cases.
    expect(at({ price: 1.2, grocerMargin: 0 }).netPerDollar).toBeCloseTo(0.2 * (1 + T.salesTax), 12);
    expect(at({ price: 1, grocerMargin: 0 }).netPerDollar).toBeCloseTo(0, 12);
    for (const a of ["A", "B", "C"] as const) {
      const rec = bottleReceipt({ ...DEFAULT_INPUTS, arrangement: a, price: 1.1 });
      const P = a === "A" ? 1 : 1.1;
      const taxes = rec.filter((l) => /tax/i.test(l.who));
      expect(taxes.length).toBe(1);
      expect(taxes[0].v).toBeCloseTo(T.salesTax * P, 12);
      expect(rec.reduce((sum, l) => sum + l.v, 0)).toBeCloseTo(P * (1 + T.salesTax), 12);
    }
  });
  test("F15/F16 the lab has no beer substitution or per-unit charge, and says so when it matters", () => {
    // Both are modeled, with hand-computed fixtures, in the scenario engine: scenario.test.ts "subtracts the beer revenue
    // lost, on the basis chosen" and "never counts recaptured wine as new drinking" (F15), "puts an excise on gallons,
    // not dollars" and "finds the excise per gallon that breaks even" (F16).
    expect(at({ additional: 0.02 }).missing.join(" ")).toMatch(/replace beer.*not subtracted/);
    expect(at({ additional: 0 }).missing.join(" ")).not.toMatch(/beer/);
    expect(Object.keys(DEFAULT_INPUTS).some((k) => /beer|excise|gallon/i.test(k))).toBe(false);
  });
  test("F20 money is whole dollars in the data, unrounded in the model and the export; rounding is display only", () => {
    for (const d of [...PF.dabs.destinations, ...PF.dabs.bridge]) expect(Number.isInteger(d.amount)).toBe(true);
    const r = at({});
    expect(r.net).toBe(r.netPerDollar * r.movedDollars!); // no new purchases, fees cover administration
    expect(Number.isInteger(r.net! / 1000)).toBe(false); // not rounded to thousands
    expect(JSON.parse(scenarioJson(DEFAULT_INPUTS)).result.net).toBe(r.net);
    expect(observedCsv()).toContain(String(PF.dabs.destinations.find((d) => d.id === "school_meals")!.amount));
    expect(fundingScenario(DEFAULT_INPUTS)).toEqual(fundingScenario(DEFAULT_INPUTS));
  });
  test("E04 no copy calls the spending rank a quality rank", () => {
    const lines = readFileSync(join(__dirname, "..", "views", "FundingView.tsx"), "utf8").split("\n");
    lines.forEach((l, i) => {
      if (/quality/i.test(l)) expect(`${lines[i - 1]} ${l}`).toMatch(/\bnot\b/);
    });
    expect(lines.join("\n")).not.toMatch(/\b(terrible|failing|worst|best schools?|underfund)/i);
    // Every rank written on the page sits next to the word "spending".
    lines.forEach((l, i) => {
      if (/\}th of/.test(l)) expect(`${lines[i - 1]} ${l}`).toMatch(/spending/);
    });
  });
  test("E08 measures of different years, definitions or populations stay apart", () => {
    const fy = String(PF.education.fiscalYear);
    for (const s of spendingRanks("states_dc")) expect(s.ppcs).toBe((s.series as Record<string, number | null>)[fy]);
    for (const a of Object.values(PF.education.naep)) {
      expect(a.year).toBe(2024);
      expect(a.universe).toBe("Public school students");
      expect(Object.keys(a.byJurisdiction)).toContain("NP"); // national public, never the national total ("NT")
      expect(Object.keys(a.byJurisdiction)).not.toContain("NT");
    }
    expect(PF.districts.fiscalYear).toBe(PF.education.fiscalYear);
    for (const c of COMPARATORS) expect(c.year).toMatch(/^(FY|SY|FFY)\d{4}|^—$/);
    expect(inFy2024Dollars(100, "2031")).toBeNull(); // no CPI year, no guess
  });
});

describe("adversarial cases (devplan test matrix)", () => {
  test("an unprofitable grocer margin at the same price is never shown as workable", () => {
    for (const a of ["B", "C"] as const)
      for (const s of ["none", "allocated", "longer_run"] as const)
        for (const p of priceRevenueMap(a, s)) {
          expect(p.grocer).toBe(at({ arrangement: a, price: p.price, grocerMargin: p.grocerMargin, savings: s }).conditions.grocer);
          if (p.grocerMargin === 0) expect(p.grocer).toBe("not_satisfied");
        }
    // The one cell that passes both money tests at today's price without savings does so because the grocer earns nothing.
    expect(priceRevenueMap("B", "none").filter((p) => p.price === 1 && p.region === "both")).toEqual([expect.objectContaining({ grocerMargin: 0, grocer: "not_satisfied" })]);
  });
  test("receipts rise overall while the school-meals deposit falls: both are reported", () => {
    const r = at({ savings: "longer_run", additional: 0.02 });
    expect(r.net!).toBeGreaterThan(0);
    expect(r.conditions.revenue).toBe("satisfied");
    expect(r.programs.find((p) => p.id === "school_meals")!.delta!).toBeLessThan(0);
    expect(r.conditions.programs).toBe("not_satisfied");
  });
  test("a new administration cost the fees do not cover is subtracted once", () => {
    expect(at({}).net! - at({ fees: false }).net!).toBeCloseTo(T.admin, 6);
  });
  test("a stale law reading is flagged; the FY2025 deposit rules match the versions then in force", () => {
    expect(lawIsStale("2026-11-20", new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(lawIsStale("2026-11-20", new Date("2027-06-01T00:00:00Z"))).toBe(true);
    for (const id of ["UT-32B-2-304-5", "UT-32B-2-305-4", "UT-32B-2-306-3"]) {
      const v = PF.law.find((l) => l.rule_id === id)!.fy2025!;
      expect(v.same_quote).toBe(true);
      expect(v.effective_from <= "2024-07-01" && (v.superseded === null || v.superseded >= "2025-07-01")).toBe(true);
    }
    expect(PF.law.find((l) => l.rule_id === "UT-32B-2-301-6")!.fy2025).toBeNull(); // not found: shown as unchecked
  });
  test("malformed links and degenerate inputs give a defined result", () => {
    for (const bad of ["v1_B_Infinity_0.100_0.300_0.000_0_0.295_0_1", "v1_B_1.000_10%_0.300_0.000_0_0.295_0_1", "v1_B_-1.000_0.100_0.300_0.000_0_0.295_0_1", "v1_B_1.000_0.100_0.300_0.000_0_0.295_0_1&x=1", "v1_B_1e3_0.100_0.300_0.000_0_0.295_0_1"])
      expect(decodeScenario(bad)).toBeNull();
    const none = at({ share: 0 });
    expect(none.errors).toEqual([]);
    expect(Math.abs(none.net!)).toBe(0);
    for (const bad of [{ price: 0 }, { price: -1 }, { grocerMargin: 1 }, { distribution: 1 }]) {
      const r = at(bad);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.net).toBeNull();
      expect(r.conditions.revenue).toBe("undetermined");
    }
  });
});

describe("comparators from USDA and USBE", () => {
  test("the free-lunch row is the federal reimbursement, labeled as one, for school year 2024-25", () => {
    const c = COMPARATORS.find((x) => x.id === "free_lunch_reimbursement")!;
    const r = PF.meals.freeLunchReimbursement;
    expect(c.amount).toBe(4.43);
    expect(c.amount).toBeCloseTo(r.section11 + r.section4, 10);
    expect(c.year).toBe("SY2024-25");
    expect(c.label).toContain("a reimbursement rate, not a cost");
    expect(c.note).toContain("Not what a lunch costs");
    expect(r.source.asset).toBe("usda_nslp_rates_sy2024_25");
    // The cost row stays empty: no sourced cost per meal exists.
    expect(COMPARATORS.find((x) => x.id === "meal_cost")!.amount).toBeNull();
  });

  test("USBE's per-pupil figure is on every district and agrees with Census's for districts of 1,000 or more", () => {
    const all = PF.districts.systems;
    expect(all.every((d) => "usbePerPupil" in d)).toBe(true);
    for (const d of all.filter((x) => x.enrollment >= 1000)) {
      expect(Math.abs(d.usbePerPupil / d.perPupil - 1)).toBeLessThan(0.1);
    }
    const census = all.reduce((a, d) => a + d.currentSpending, 0) / all.reduce((a, d) => a + d.enrollment, 0);
    expect(Math.abs(PF.districts.usbe.districtTotal / census - 1)).toBeLessThan(0.1);
    expect(PF.districts.usbe.note).toContain("July 2023 to June 2024");
    expect(PF.districts.usbe.note).toContain("neither is a federal fiscal year");
  });
});

describe("evidence that cuts the other way", () => {
  test("every finding says what it cuts against and how it differs, with a source read on a stated date", () => {
    expect(CONTRARY.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CONTRARY.map((c) => c.id)).size).toBe(CONTRARY.length);
    for (const c of CONTRARY) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.read).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const t of [c.finding, c.against, c.differs, c.source]) expect(t.length).toBeGreaterThan(20);
    }
    const page = readFileSync(join(__dirname, "..", "views", "FundingView.tsx"), "utf8");
    expect(page).toContain("Searched for and not found");
    expect(page).toContain("Limits this page states elsewhere");
    expect(page).toContain("none has been reviewed by a person");
  });
});

describe("Tennessee and Colorado beside Utah (devplan PPF-407)", () => {
  const S = PF.states;
  test("Tennessee's wine tax and its 2014 act are read from the pinned files", () => {
    expect(S.tennessee.winePerGallon).toBe(1.21);
    expect(S.tennessee.taxSource.asset).toBe("tn_dor_alcohol_tax_manual_2025_06");
    expect(S.tennessee.licensesFrom).toBe("2016-07-01");
    expect(S.tennessee.actSource.asset).toBe("tn_public_chapter_2014_554");
  });

  test("account 11002 keeps its two printed labels apart and the FY2017 ratio is recomputable", () => {
    const a = S.tennessee.account11002;
    expect(a.map((x) => x.fy)).toEqual(Array.from({ length: 14 }, (_, i) => 2012 + i));
    expect(a.filter((x) => x.fy <= 2017).every((x) => x.label === "Wine Tax")).toBe(true);
    expect(a.filter((x) => x.fy >= 2018).every((x) => x.label === "Wine Tax & High Alcohol Beer")).toBe(true);
    for (const x of a) expect(x.source.asset).toBe(`tn_dor_collections_june_${x.fy}`);
    const avg = a.filter((x) => x.fy <= 2016).reduce((s, x) => s + x.amount, 0) / 5;
    expect(S.tennessee.fy2012to2016Average).toBeCloseTo(avg, 1);
    expect(S.tennessee.fy2017OverAverage).toBeCloseTo(a.find((x) => x.fy === 2017)!.amount / avg - 1, 4);
  });

  test("Colorado's rates and allocation come from C.R.S. 44-3-502 and -503", () => {
    expect(S.colorado.winePerLiter).toBe(0.0733);
    expect(S.colorado.wineDevelopmentFeePerLiter).toBe(0.01);
    expect(S.colorado.pensionShare).toBe(0.85);
    expect(S.colorado.source.locator).toContain("44-3-502(1)(a)");
  });

  test("per-bottle takes are the rates times 0.75 liter, and Utah's is a share of the price", () => {
    const b = stateTakePerBottle();
    expect(b.TN).toBeCloseTo((1.21 * 0.75) / 3.785411784, 6);
    expect(b.CO).toBeCloseTo(0.054975, 6);
    expect(b.utPerDollar).toBe(T.margin);
    // A per-volume tax of a few cents against a margin of a large share of the price: the structures differ in kind.
    expect(b.TN).toBeLessThan(0.3);
    expect(b.utPerDollar).toBeGreaterThan(0.3);
  });

  test("consumption covers every place and year, and every comparison row has a value for each state", () => {
    for (const k of ["UT", "TN", "CO", "US"] as const)
      for (const y of S.consumption.years) {
        expect(S.consumption.byState[k][y].wine).toBeGreaterThan(0);
        expect(S.consumption.byState[k][y].all).toBeGreaterThan(S.consumption.byState[k][y].wine);
      }
    const rows = stateComparison();
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows) for (const k of COMPARISON_STATES) expect(r.values[k].length).toBeGreaterThan(4);
    expect(rows.find((r) => r.id === "where")!.values.TN).toMatch(/^Not read/);
    expect(rows.find((r) => r.id === "take")!.values.UT).toContain("88.5%");
  });

  test("the section states its limits and attributes nothing to either change", () => {
    const page = readFileSync(join(__dirname, "..", "views", "FundingView.tsx"), "utf8");
    const at = page.indexOf('id="pf-states"');
    const section = page.slice(at, page.indexOf('aria-labelledby="pf-against"'));
    expect(at).toBeGreaterThan(0);
    expect(section).toContain("Nothing here estimates an effect of either change");
    expect(section).toContain("What these comparisons cannot show");
    expect(section).toContain("Whether either change caused anything");
    expect(section).not.toMatch(/\b(led to|resulted in|because of the (law|change)|caused by|thanks to)\b/i);
  });
});
