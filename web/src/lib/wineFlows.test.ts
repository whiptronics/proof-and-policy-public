import { describe, expect, it } from "vitest";
import { ELASTICITY, alternativeById, alternativesReport, evaluateFixed } from "./wineAlternatives";
import {
  DEFAULT_FLOWS,
  FLOW_ARRANGEMENTS,
  FLOW_BASE,
  arrangementTerms,
  breakEven,
  checkFlows,
  computeFlows,
  withFlows,
  type FlowInputs,
} from "./wineFlows";
import { marginOfMarkup } from "./wineMargin";

const B = FLOW_BASE;
const H = B.wine.value * B.wine.household;
const t = B.salesTax;
const v = DEFAULT_FLOWS.costs.variable;
const N = DEFAULT_FLOWS.costs.admin;
const quiet: FlowInputs = withFlows(DEFAULT_FLOWS, { migration: 0, costs: { admin: 0 } });
const pres = arrangementTerms("preserved_dabs");
const presMatched = arrangementTerms("preserved_dabs_matched");
const disc = arrangementTerms("dabs_discount_20");
const priv = arrangementTerms("private_tax_20");
const beer = (share: number, extra: Partial<FlowInputs["beer"]> = {}) => withFlows(quiet, { beer: { participation: 1, intensity: share, weight: 1, ...extra } });

describe("the base year agrees with the alternatives it extends", () => {
  it("uses the same wine sales, household share, margin and sales tax", () => {
    const x = evaluateFixed(alternativeById("A_target"))!.built.base;
    expect(B.wine.value).toBeCloseTo(x.wineSales!, 6);
    expect(B.wine.household).toBe(x.eligible);
    expect(B.wine.margin).toBeCloseTo(x.grossMargin!, 12);
    expect(t).toBe(x.salesTax);
  });
});

describe("zero change", () => {
  it("the baseline arrangement reproduces the baseline exactly", () => {
    const r = computeFlows(arrangementTerms("baseline"), withFlows(DEFAULT_FLOWS, { beer: { participation: 0.5, intensity: 0.5 }, additional: { share: 0.1 } }));
    expect(r.change.net).toBe(0);
    expect(r.change.gross).toBe(0);
    expect(r.alcohol.total).toBe(0);
    for (const k of Object.values(r.change.collections)) expect(k).toBe(0);
  });
  it("an arrangement with nothing moving and no new costs changes nothing", () => {
    for (const id of FLOW_ARRANGEMENTS) {
      const r = computeFlows(arrangementTerms(id), quiet);
      expect(r.change.net, id).toBeCloseTo(0, 6);
      expect(r.change.gross, id).toBeCloseTo(0, 6);
    }
  });
});

describe("channel shift with the state's collection preserved", () => {
  it("identical collection and quantity keep gross receipts unchanged; only costs move the net", () => {
    const r = computeFlows(presMatched, withFlows(DEFAULT_FLOWS, {}));
    expect(presMatched.preservesCollection).toBe(true);
    expect(presMatched.consumerRatio).toBeCloseTo(1, 12);
    expect(r.change.gross).toBeCloseTo(0, 4);
    expect(r.change.net).toBeCloseTo(v * 0.3 * H - N, 4);
    expect(r.lines.find((l) => l.id === "migration")!.value).toBeCloseTo(v * 0.3 * H, 4); // no migration loss
  });
  it("a higher grocery price raises percentage-tax receipts by the rate on the higher price, and nothing else", () => {
    const r = computeFlows(pres, DEFAULT_FLOWS);
    const moved = 0.3 * H;
    expect(pres.preservesCollection).toBe(true);
    expect(pres.shelf).toBeCloseTo(1 / 0.72, 12);
    expect(r.change.collections.salesTax).toBeCloseTo(t * (pres.shelf - 1) * moved, 4);
    expect(r.change.collections.dabsWineMarkup).toBeCloseTo(0, 4);
    expect(r.change.gross).toBeCloseTo(t * (pres.shelf - 1) * moved, 4);
  });
});

describe("the existing alternatives reproduce where their assumptions are unchanged", () => {
  it("at 30% moving whatever the price, each arrangement's change equals the alternative's fixed-volume ledger", () => {
    for (const id of FLOW_ARRANGEMENTS) {
      const a = arrangementTerms(id);
      const ledger = evaluateFixed(alternativeById(a.altId!))!.ledger.net;
      expect(computeFlows(a, DEFAULT_FLOWS).change.net, id).toBeCloseTo(ledger, 4);
    }
  });
  it("the old price response is the exploratory 'movers buy less' case", () => {
    const rep = alternativesReport();
    for (const id of ["preserved_dabs", "preserved_private"] as const) {
      const a = arrangementTerms(id);
      const old = rep.results.find((r) => r.def.id === a.altId)!.demand.find((d) => d.id === "price_constant")!.net;
      expect(computeFlows(a, withFlows(DEFAULT_FLOWS, { migrantResponse: ELASTICITY })).change.net, id).toBeCloseTo(old, 4);
    }
  });
});

describe("substitution", () => {
  it("subtracts the revenue of the beverage replaced and adds the wine's", () => {
    const r = computeFlows(disc, beer(0.05));
    const beerL = 0.05 * B.beer.litres * B.beer.household;
    expect(r.displaced.beerLitres).toBeCloseTo(beerL, 6);
    expect(r.change.collections.beerExcise).toBeCloseTo(-B.beer.excisePerLitre * beerL, 6);
    const wine$ = ((beerL * B.beer.abv) / B.wine.abv) * B.wine.price; // constant pure alcohol, at state-store prices
    expect(r.origins.find((o) => o.id === "B")!.grocery.storeEquivalent).toBeCloseTo(wine$, 4);
    const ln = r.lines.find((l) => l.id === "beer_to_wine")!;
    expect(ln.displacedLost).toBeCloseTo(beerL * (B.beer.excisePerLitre + t * B.beer.price), 4);
    expect(ln.wineGained).toBeCloseTo(wine$ * (disc.stateCollection + t * disc.salesTaxBase), 4);
    expect(r.change.net).toBeCloseTo(ln.value, 4);
  });
  it("at constant pure alcohol, total alcohol is conserved; wine sales rise without more drinking", () => {
    const x = withFlows(beer(0.08), { spirits: { participation: 0.4, intensity: 0.1, weight: 1.2 } });
    for (const id of FLOW_ARRANGEMENTS) {
      const r = computeFlows(arrangementTerms(id), withFlows(x, { migration: 0.3 }));
      expect(Math.abs(r.alcohol.total), id).toBeLessThan(1e-6);
      expect(r.origins.find((o) => o.id === "B")!.grocery.litres).toBeGreaterThan(0);
    }
  });
  it("spirits replaced by wine lose the DABS spirits markup, net of the store cost that falls with it", () => {
    const r = computeFlows(priv, withFlows(quiet, { spirits: { participation: 1, intensity: 0.02, weight: 1 } }));
    const sL = 0.02 * B.spirits.litres * B.spirits.household;
    expect(r.change.collections.dabsSpiritsMarkup).toBeCloseTo(-B.spirits.margin * sL * B.spirits.price, 4);
    expect(r.lines.find((l) => l.id === "spirits_to_wine")!.displacedLost).toBeCloseTo(sL * B.spirits.price * (B.spirits.margin + t - v), 4);
  });
  it("heavy beer replaced loses DABS's markup and the beer excise, which covers heavy beer since 2024", () => {
    const r = computeFlows(disc, beer(0.001, { heavyShare: 1 }));
    const hL = (0.001 * B.beer.litres * B.beer.household * B.beer.abv) / B.heavyBeer.abv;
    expect(r.displaced.heavyBeerLitres).toBeCloseTo(hL, 6);
    expect(r.displaced.beerLitres).toBe(0);
    expect(r.change.collections.beerExcise).toBeCloseTo(-B.beer.excisePerLitre * hL, 6);
    expect(r.change.collections.dabsHeavyBeerMarkup).toBeCloseTo(-B.heavyBeer.margin * hL * B.heavyBeer.price, 4);
    expect(r.reconciles).toBe(true);
  });
  it("participation, intensity and weight translate customers into market shares", () => {
    const a = computeFlows(disc, withFlows(quiet, { beer: { participation: 0.25, intensity: 0.2, weight: 1.5 } }));
    const b = computeFlows(disc, beer(0.25 * 0.2 * 1.5));
    expect(a.displaced.beerLitres).toBeCloseTo(b.displaced.beerLitres, 6);
  });
  it("the equal-spending basis buys wine worth what the beer cost, at the price paid", () => {
    const r = computeFlows(pres, beer(0.05, { basis: "spending" }));
    const beer$ = r.displaced.beerLitres * B.beer.price;
    expect(r.origins.find((o) => o.id === "B")!.grocery.spending).toBeCloseTo(beer$, 4);
  });
});

describe("purchase flows", () => {
  const all = withFlows(DEFAULT_FLOWS, {
    convenienceLimit: 0.6,
    declined: { dabs: 0.5, beer: 0.2, outOfState: 0.2, none: 0.1 },
    beer: { participation: 0.3, intensity: 0.2, weight: 1, grocery: 0.9, heavyShare: 0.05 },
    spirits: { participation: 0.2, intensity: 0.1, weight: 1, grocery: 0.8 },
    recapture: { share: 0.02, grocery: 0.7 },
    additional: { share: 0.03, grocery: 0.6 },
    costs: { licenseReceipts: 100_000, restructuring: 0.02 },
  });
  it("reconcile: origins add up to grocery wine and the decomposition adds back to the before-and-after change", () => {
    for (const id of FLOW_ARRANGEMENTS) {
      const r = computeFlows(arrangementTerms(id), all);
      expect(r.reconciles, id).toBe(true);
      const grocery = r.proposed.cells.find((c) => c.beverage === "wine" && c.channel === "grocery")!.storeEquivalent!;
      expect(r.origins.reduce((s, o) => s + o.grocery.storeEquivalent, 0)).toBeCloseTo(grocery, 4);
      expect(r.lines.reduce((s, l) => s + l.value, 0)).toBeCloseTo(r.change.net, 4);
      expect(r.change.net).toBeCloseTo(r.change.gross - r.change.costs, 4);
    }
  });
  it("only household purchases move: licensees' wine stays at DABS", () => {
    const r = computeFlows(disc, withFlows(DEFAULT_FLOWS, { migration: 1 }));
    const store = r.proposed.cells.find((c) => c.beverage === "wine" && c.channel === "dabs_store")!.storeEquivalent!;
    expect(store).toBeCloseTo(B.wine.value * (1 - B.wine.household), 4);
    expect(r.origins[0].grocery.storeEquivalent).toBeCloseTo(H, 4);
  });
  it("purchases that do not move at a higher price go back to DABS, not out of the market", () => {
    const x = withFlows(DEFAULT_FLOWS, { convenienceLimit: 0.3 }); // the 39% premium is past the limit: nobody moves
    const r = computeFlows(pres, x);
    expect(r.migrationUsed).toBe(0);
    expect(r.change.net).toBeCloseTo(-N, 4);
    expect(Math.abs(r.alcohol.total)).toBeLessThan(1e-6);
    const gone = computeFlows(pres, withFlows(x, { declined: { dabs: 0, none: 1 } }));
    expect(gone.alcohol.total).toBeLessThan(0);
    expect(gone.change.net).toBeCloseTo(-N - 0.3 * H * (B.wine.margin + t - v), 4);
  });
  it("migration falls in a straight line with the premium up to the convenience limit", () => {
    const r = computeFlows(pres, withFlows(DEFAULT_FLOWS, { convenienceLimit: 0.6 }));
    expect(r.migrationUsed).toBeCloseTo(0.3 * (1 - (pres.consumerRatio - 1) / 0.6), 12);
  });
  it("recapture and additional purchases may be bought at DABS, carrying its markup and store cost", () => {
    const r = computeFlows(priv, withFlows(quiet, { additional: { share: 0.1, grocery: 0 } }));
    expect(r.origins.find((o) => o.id === "E")!.dabs.storeEquivalent).toBeCloseTo(0.1 * H, 4);
    expect(r.change.net).toBeCloseTo(0.1 * H * (B.wine.margin + t - v), 4);
  });
  it("recaptured wine moves alcohol from outside Utah into Utah without changing the total", () => {
    const r = computeFlows(disc, withFlows(quiet, { recapture: { share: 0.05 } }));
    expect(r.alcohol.inUtah).toBeGreaterThan(0);
    expect(r.alcohol.outsideUtah).toBeCloseTo(-r.alcohol.inUtah, 6);
    expect(Math.abs(r.alcohol.total)).toBeLessThan(1e-6);
  });
});

describe("funds and margins", () => {
  it("deposits are allocations: the net does not depend on the reading and no deposit enters it", () => {
    const r = computeFlows(disc, DEFAULT_FLOWS);
    expect(r.change.net).toBeCloseTo(r.change.gross - r.change.costs, 6);
    const moved = 0.3 * H;
    const rate = B.rates.school + B.rates.enforcement;
    expect(r.change.deposits.countsGrocerSales).toBeCloseTo(-rate * 0.2 * moved, 4); // DABS still sells it, at 80%
    expect(r.change.deposits.excludesGrocerSales).toBeCloseTo(-rate * moved, 4);
    expect(computeFlows(priv, DEFAULT_FLOWS).change.deposits.countsGrocerSales).toBeCloseTo(-rate * moved, 4);
  });
  it("converts margin and markup correctly and keeps each seller's share of the price", () => {
    expect(marginOfMarkup(0.885)).toBeCloseTo(0.4695, 4);
    const m = B.wine.margin;
    expect(m / (1 - m)).toBeCloseTo(0.8943, 4); // DABS's all-product margin as a markup on landed cost
    expect(pres.grocerMarginShare).toBeCloseTo(0.28, 12);
    expect(disc.acquisition + disc.stateCollection).toBeCloseTo(0.8, 12); // DABS sells at 80% of today's price
    for (const id of FLOW_ARRANGEMENTS) {
      const a = arrangementTerms(id);
      expect(a.acquisition + a.stateCollection + a.wholesalerKeeps + a.grocerKeeps, id).toBeCloseTo(a.shelf, 9);
    }
  });
});

describe("bounds", () => {
  it("rejects shares outside 0-1, splits that do not add up and replacing more than exists", () => {
    expect(checkFlows(withFlows(DEFAULT_FLOWS, { migration: 1.2 }))).not.toEqual([]);
    expect(checkFlows(withFlows(DEFAULT_FLOWS, { declined: { dabs: 0.5 } }))).not.toEqual([]);
    expect(checkFlows(withFlows(DEFAULT_FLOWS, { beer: { participation: 1, intensity: 1, weight: 1.5 } }))).not.toEqual([]);
    expect(checkFlows(withFlows(DEFAULT_FLOWS, { beer: { participation: 1, intensity: 0.5, heavyShare: 1 } }))).not.toEqual([]);
    expect(checkFlows(withFlows(DEFAULT_FLOWS, { additional: { share: -0.1 } }))).not.toEqual([]);
    expect(() => computeFlows(disc, withFlows(DEFAULT_FLOWS, { migration: -0.1 }))).toThrow();
  });
  it("never produces a negative quantity, even when every household purchase switches", () => {
    const x = withFlows(DEFAULT_FLOWS, { migration: 1, beer: { participation: 1, intensity: 1, weight: 1 }, spirits: { participation: 1, intensity: 1, weight: 1 } });
    for (const id of FLOW_ARRANGEMENTS) {
      const r = computeFlows(arrangementTerms(id), x);
      for (const c of r.proposed.cells) {
        expect(c.litres, `${id} ${c.beverage} ${c.channel}`).toBeGreaterThanOrEqual(-1e-6);
        expect(c.spending).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
});

describe("break-even", () => {
  it("each solution reproduces a net change of about zero, and the statuses are right", () => {
    for (const id of FLOW_ARRANGEMENTS) {
      const a = arrangementTerms(id);
      for (const lever of ["additional", "beer", "spirits", "recapture", "migration"] as const) {
        const be = breakEven(a, DEFAULT_FLOWS, lever);
        if (be.status === "found") {
          expect(Math.abs(be.check!), `${id} ${lever}`).toBeLessThan(1);
          expect(be.value!).toBeGreaterThan(0);
          expect(be.value!).toBeLessThanOrEqual(1);
        }
        if (be.status === "already_above") expect(be.atLow).toBeGreaterThanOrEqual(-0.005);
      }
    }
    expect(breakEven(pres, DEFAULT_FLOWS, "additional").status).toBe("already_above");
    expect(breakEven(disc, DEFAULT_FLOWS, "additional").status).toBe("found");
  });
  it("finds the beer share that offsets a discount's loss at constant alcohol", () => {
    const be = breakEven(disc, DEFAULT_FLOWS, "beer");
    expect(be.status).toBe("found");
    const r = computeFlows(disc, withFlows(DEFAULT_FLOWS, { beer: { participation: 1, intensity: be.value!, weight: 1 } }));
    expect(Math.abs(r.change.net)).toBeLessThan(1);
    expect(Math.abs(r.alcohol.total)).toBeLessThan(1e-6);
  });
});
