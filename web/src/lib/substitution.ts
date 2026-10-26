// Beer-to-wine substitution, an optional what-if beside the arrangement comparison (method SUBSTITUTION_METHOD).
//
// The question (Ethan, 2026-10-07): if drinkers who now buy beer bought wine instead, with no more alcohol drunk in
// total, could the extra wine revenue cover what an arrangement loses? This is a hypothesis to examine, not an
// established effect: no study found measures beer-to-wine switching after grocery wine (docs/review/
// grocery-wine-model-audit.md, section 8), so no Utah substitution rate is entered or implied. The what-if takes the
// amount switched as its lever and reports two things: the state revenue per gallon switched, and the amount that
// would have to switch to offset the arrangement's loss (a threshold, not a forecast).
//
// Rules:
// * Substitution only. Total ethanol is held constant: every gallon of pure alcohol bought as wine is a gallon of pure
//   alcohol no longer bought as beer (beer gallons = wine gallons x wine ABV / beer ABV). It is computed on the
//   arrangement's channel shift alone, so the share moving, the price response, cross-border recapture and easier
//   access (more drinking) are switched off and cannot be counted with it.
// * It reuses the scenario model (lib/scenario.ts, scenario B with every switched gallon replacing beer on a pure-alcohol
//   basis), so the wine is collected on exactly as the arrangement collects on its other wine: at state stores, the
//   gross margin and sales tax less the avoidable cost of selling more; at grocers, the arrangement's replacement tax
//   or DABS's margin on its sales to grocers, and sales tax.
// * The beer given up is taken to be beer bought at grocers and convenience stores (up to 5% ABV since 2019-11-01):
//   the state loses its beer excise and sales tax on it, nothing more. Heavy beer from state stores, which carries a
//   markup, is not modelled; displacing it would cost the state more per gallon than is shown here.
// * The beer price is the reader's: no source in the dataset gives Utah's average beer price per gallon.
import { arrangementInputs, solveLever, withMechanisms, type ArrangementSettings } from "./arrangements";
import { compute, type DepositRates, type ScenarioInputs, type ScenarioResult } from "./scenario";

export const SUBSTITUTION_METHOD = "beer-wine-substitution@1.0";

export interface SubstitutionInputs {
  /** Wine bought instead of beer, as a share of baseline wine gallons (0 or more). The lever. */
  swap: number | null;
  /** Share of that wine bought at grocers (0-1); the rest is bought at state stores and agencies. */
  grocery: number | null;
  /** Beer shelf price before sales tax, $ per gallon. */
  beerPrice: number | null;
  /** Beer excise, $ per 31-gallon barrel. */
  beerTax: number | null;
  /** Alcohol by volume (0-1). */
  wineAbv: number | null;
  beerAbv: number | null;
  /** Beer gallons sold in the state in a year (optional): the bound on how much beer there is to replace. */
  beerGallons?: number | null;
}

export interface PerGallon {
  /** State revenue from one more gallon of wine, net of the avoidable cost of selling it at state stores. */
  wine: number;
  /** State revenue lost on the beer it replaces (excise and sales tax). */
  beer: number;
  /** wine - beer. */
  net: number;
  /** Beer gallons replaced per wine gallon (wine ABV / beer ABV). */
  beerPerWine: number;
}

export interface Threshold {
  status: "found" | "not_needed" | "never" | "beyond_beer" | "unavailable";
  /** Wine bought instead of beer that would offset the arrangement's channel-shift loss: share of baseline wine gallons. */
  swap: number | null;
  wineGallons: number | null;
  beerGallons: number | null;
  ethanolGallons: number | null;
  /** Beer replaced as a share of the beer gallons entered (null without them). */
  beerShare: number | null;
  note: string;
}

export interface SubstitutionResult {
  method: string;
  id: "private" | "wholesale";
  missing: string[];
  invalid: string[];
  /** The arrangement's channel shift alone (net change, $ a year). */
  shiftNet: number | null;
  /** The same plus the substitution entered. */
  withSwapNet: number | null;
  /** The substitution's own contribution (withSwapNet - shiftNet). */
  swapNet: number | null;
  wineGallons: number | null;
  beerGallonsReplaced: number | null;
  /** Ethanol added as wine and removed as beer, gallons of pure alcohol: equal by construction (checked). */
  ethanolAdded: number | null;
  ethanolRemoved: number | null;
  /** Revenue lines of the substitution alone ($ a year): what the extra wine brings and what the beer took. */
  lines: { id: string; label: string; value: number }[];
  perGallon: PerGallon | null;
  /** DABS's added gross receipts from the switched wine (state stores, and in arrangement 2 its sales to grocers): the
   * base of the statutory school-meals deposit if, as today, it is a share of DABS's gross liquor revenue. Whether
   * DABS's sales to grocers would carry the deposit is a legal reading the proposal must settle. */
  dabsGrossAdded: number | null;
  schoolDepositAdded: number | null;
  threshold: Threshold;
}

/** The arrangement's channel shift, with only the substitution added (every other purchase change off). */
export function substitutionInputs(base: ScenarioInputs, set: ArrangementSettings, id: "private" | "wholesale", s: SubstitutionInputs, swap = s.swap ?? 0): ScenarioInputs {
  const x0 = withMechanisms(arrangementInputs(base, set, id), {});
  return {
    ...x0,
    extra: true,
    growth: swap,
    extraGrocery: s.grocery,
    elasticity: null,
    recapture: null,
    substitution: true,
    replaces: 1,
    basis: "ethanol",
    beerPrice: s.beerPrice,
    beerTax: s.beerTax,
    wineAbv: s.wineAbv,
    beerAbv: s.beerAbv,
  };
}

function check(base: ScenarioInputs, s: SubstitutionInputs): { missing: string[]; invalid: string[] } {
  const missing: string[] = [];
  const invalid: string[] = [];
  const need: [unknown, string][] = [
    [s.swap, "wine bought instead of beer (share of wine gallons)"],
    [s.grocery, "share of that wine bought at grocers"],
    [s.beerPrice, "beer price per gallon"],
    [s.beerTax, "beer excise per barrel"],
    [s.wineAbv, "wine alcohol content"],
    [s.beerAbv, "beer alcohol content"],
    [base.wineGallons, "wine gallons"],
  ];
  for (const [v, label] of need) if (v === null || v === undefined) missing.push(label);
  if (typeof s.swap === "number" && s.swap < 0) invalid.push("The wine bought instead of beer cannot be negative");
  if (typeof s.grocery === "number" && (s.grocery < 0 || s.grocery > 1)) invalid.push("The share bought at grocers must be between 0% and 100%");
  for (const [v, label] of [[s.wineAbv, "Wine alcohol content"], [s.beerAbv, "Beer alcohol content"]] as [number | null, string][])
    if (typeof v === "number" && (v <= 0 || v >= 1)) invalid.push(`${label} must be between 0% and 100%`);
  for (const [v, label] of [[s.beerPrice, "The beer price"], [s.beerTax, "The beer excise"]] as [number | null, string][])
    if (typeof v === "number" && v < 0) invalid.push(`${label} cannot be negative`);
  return { missing, invalid };
}

const LINE_LABEL: Record<string, string> = {
  extra_store_margin: "State-store gross margin on the wine bought there",
  extra_retained: "State share of the grocery wine",
  extra_excise: "Replacement excise on the grocery wine",
  extra_ad_valorem: "Replacement tax on the grocery wine",
  extra_wholesale: "DABS's margin on the wine it sells to grocers",
  extra_sales_tax: "State sales tax on the wine",
  extra_cost: "State-store operating cost of selling more (avoidable-cost rate)",
  beer_excise_lost: "Beer excise lost",
  beer_sales_tax_lost: "Sales tax lost on the beer",
};

function linesOf(r: ScenarioResult): SubstitutionResult["lines"] {
  return (r.b ?? []).map((c) => ({ id: c.id, label: LINE_LABEL[c.id] ?? c.label, value: c.kind === "revenue" ? c.value : -c.value }));
}

/** The substitution what-if for arrangement 1 or 2 on the comparison's inputs. */
export function substitution(base: ScenarioInputs, set: ArrangementSettings, id: "private" | "wholesale", s: SubstitutionInputs, rates: DepositRates | null = null): SubstitutionResult {
  const own = check(base, s);
  const empty: SubstitutionResult = {
    method: SUBSTITUTION_METHOD,
    id,
    missing: own.missing,
    invalid: own.invalid,
    shiftNet: null,
    withSwapNet: null,
    swapNet: null,
    wineGallons: null,
    beerGallonsReplaced: null,
    ethanolAdded: null,
    ethanolRemoved: null,
    lines: [],
    perGallon: null,
    dabsGrossAdded: null,
    schoolDepositAdded: null,
    threshold: { status: "unavailable", swap: null, wineGallons: null, beerGallons: null, ethanolGallons: null, beerShare: null, note: "Needs the inputs listed." },
  };
  if (own.missing.length || own.invalid.length) return empty;
  const x = substitutionInputs(base, set, id, s);
  const r = compute(x);
  if (r.missing.length || r.invalid.length) return { ...empty, missing: [...own.missing, ...r.missing], invalid: [...own.invalid, ...r.invalid] };
  const G = base.wineGallons!;
  const W = base.wineSales!;
  const wineGallons = s.swap! * G;
  const beerGallons = r.beer?.gallons ?? 0;
  const swapNet = (r.netB ?? 0) - r.netA;
  // Per gallon of wine switched: the model is linear in the amount switched, so one gallon's worth is exact.
  const unit = compute(substitutionInputs(base, set, id, s, 1 / G));
  const wineUnit = linesOf(unit).filter((l) => !l.id.startsWith("beer_")).reduce((a, l) => a + l.value, 0);
  const beerUnit = -linesOf(unit).filter((l) => l.id.startsWith("beer_")).reduce((a, l) => a + l.value, 0);
  const perGallon: PerGallon = { wine: wineUnit, beer: beerUnit, net: wineUnit - beerUnit, beerPerWine: s.wineAbv! / s.beerAbv! };
  // DABS's gross receipts from the switched wine: what state stores sell, and in arrangement 2 what it sells to grocers.
  const dollars = s.swap! * W;
  const q = s.grocery!;
  const dabsGrossAdded = (1 - q) * dollars + (id === "wholesale" ? q * (1 - (x.discount ?? 0)) * dollars : 0);
  // The threshold: the amount switched at which the channel shift's loss is offset. Linear, so solved directly, and
  // checked with the general solver over every beer gallon there is to replace when beer gallons are entered.
  const shiftNet = r.netA;
  let threshold: Threshold;
  const bound = s.beerGallons ? (s.beerGallons * s.beerAbv!) / (G * s.wineAbv!) : null;
  const toThreshold = (v: number, status: Threshold["status"], note: string): Threshold => ({
    status,
    swap: v,
    wineGallons: v * G,
    beerGallons: v * G * perGallon.beerPerWine,
    ethanolGallons: v * G * s.wineAbv!,
    beerShare: s.beerGallons ? (v * G * perGallon.beerPerWine) / s.beerGallons : null,
    note,
  });
  if (shiftNet >= 0) threshold = toThreshold(0, "not_needed", "The arrangement does not lose revenue on its channel shift, so nothing needs to be offset.");
  else if (perGallon.net <= 0)
    threshold = { status: "never", swap: null, wineGallons: null, beerGallons: null, ethanolGallons: null, beerShare: null, note: "Each gallon switched loses the state money (the beer it replaces paid more than the wine brings), so no amount offsets the loss." };
  else {
    const need = -shiftNet / (perGallon.net * G);
    const f = (v: number) => {
      const z = compute(substitutionInputs(base, set, id, s, v));
      return (z.netB ?? NaN);
    };
    const hi = bound ?? Math.max(1, 2 * need);
    const sol = solveLever(f, 0, hi);
    if (sol.root === null) threshold = { ...toThreshold(need, "beyond_beer", `Offsetting the loss would take more wine than there is beer to replace: all of the beer entered is ${(100 * (bound ?? 0)).toFixed(1)}% of wine gallons in pure alcohol.`) };
    else threshold = toThreshold(sol.root, "found", "The wine bought instead of beer, with total alcohol unchanged, at which the arrangement's state revenue equals today's.");
  }
  return {
    method: SUBSTITUTION_METHOD,
    id,
    missing: [],
    invalid: [],
    shiftNet,
    withSwapNet: r.netB,
    swapNet,
    wineGallons,
    beerGallonsReplaced: beerGallons,
    ethanolAdded: wineGallons * s.wineAbv!,
    ethanolRemoved: beerGallons * s.beerAbv!,
    lines: linesOf(r),
    perGallon,
    dabsGrossAdded,
    schoolDepositAdded: rates ? rates.school * dabsGrossAdded : null,
    threshold,
  };
}
