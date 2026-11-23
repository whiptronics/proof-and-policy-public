// Producer-direct supply (the November 2026 plan's scenario D; method PRODUCER_DIRECT_METHOD): grocers buy wine from
// producers, with no wholesaler and no DABS. Not a new model and not one of the 13 alternatives, whose results are
// unchanged: it is the private design with a charge equal to DABS's margin per bottle (C_take), with the wholesaler's
// margin replaced by what delivering to grocers costs the producer and what producers charge grocers
// (wineAlternatives.ts distributorMargin).
//
// Removing the wholesaler removes its margin, not its work. So the main case assumes the work costs producers what it
// earns a wholesaler today (no saving), and the grid shows what changes if it costs less, or if producers charge
// grocers more than DABS pays. The state collects through the charge, which is fixed per bottle, so these change the
// grocery price, and the state only through sales tax on it.
import type { Assumption, AltDef, AltResult } from "./wineAlternatives";
import { WHOLESALER_MARGIN, alternativeById, distributorMargin, evaluate } from "./wineAlternatives";
import { minus } from "./format";

export const PRODUCER_DIRECT_METHOD = "producer-direct@1.0";

/** The producer's delivery, order and administration cost as a share of its price to the grocer: none, two steps, and
 * the private wholesaler's reference margin (the main case: no saving). */
export const DIRECT_COST_SHARES = [0, 0.1, 0.2, WHOLESALER_MARGIN] as const;
/** What producers charge grocers over what DABS pays (its landed cost). A lower price is not shown (see D2). */
export const PRODUCER_PREMIUMS = [0, 0.1, 0.2] as const;

const pctS = (v: number, d = 1) => `${minus((v * 100).toFixed(d))}%`;

export const DIRECT_ASSUMPTIONS: Assumption[] = [
  {
    id: "D1",
    label: "What delivery to grocers, order-taking and administration cost the producer",
    value: `${pctS(WHOLESALER_MARGIN)} of its price to the grocer in the main case (the private wholesaler's margin); 0%, 10% and 20% in the grid`,
    standing: "illustrative",
    note: "No source measures it for Utah grocery wine. Removing the wholesaler removes its margin, not its work, so the main case assumes no saving.",
  },
  {
    id: "D2",
    label: "What producers charge grocers for the wine",
    value: "what DABS pays (its landed cost) in the main case; 10% and 20% more in the grid",
    standing: "assumption",
    note: "Grocers buy in smaller lots than DABS; whether producers would charge them more is not measured. A price below what DABS pays is not shown.",
  },
  {
    id: "D3",
    label: "Everything else",
    value: "as in the private design (C_take)",
    standing: "assumption",
    note: "A charge equal to DABS's margin per bottle, collected from the grocer; grocers price for the 28% reference margin; the same store savings, $500,000 of new administration and 30% of household purchases moving.",
  },
];

/** Scenario D as an alternative definition, at the given producer cost share and premium. */
export function directDef(costShare: number = WHOLESALER_MARGIN, producerPremium = 0): AltDef {
  const base = alternativeById("C_take");
  return {
    ...base,
    id: costShare === WHOLESALER_MARGIN && producerPremium === 0 ? "D_direct" : `D_direct_${Math.round(costShare * 1000)}_${Math.round(producerPremium * 100)}`,
    group: "D",
    label: "D. Producer-direct supply; a charge on the grocery price equal to DABS's margin per bottle; sellers price for the reference margins",
    short: "D: producer-direct, charge = DABS margin",
    direct: { costShare, producerPremium },
    defines: `Grocers buy from producers, with no wholesaler. Delivery, orders and administration cost the producer ${pctS(costShare)} of its price to the grocer, and producers charge grocers ${producerPremium ? `${pctS(producerPremium, 0)} more than` : "what"} DABS pays. The charge equals DABS's margin per bottle, as in the private design.`,
  };
}

export interface DirectCell {
  costShare: number;
  producerPremium: number;
  /** The combined margin between what DABS pays and what the grocer pays, as a share of the grocer's cost. */
  margin: number;
  result: AltResult;
}

export interface DirectReport {
  method: string;
  assumptions: Assumption[];
  main: AltResult;
  /** The private design with a wholesaler, for comparison. */
  wholesale: AltResult;
  grid: DirectCell[];
}

let cached: DirectReport | null = null;
export function directReport(): DirectReport {
  if (cached) return cached;
  const grid: DirectCell[] = PRODUCER_PREMIUMS.flatMap((p) =>
    DIRECT_COST_SHARES.map((c) => {
      const def = directDef(c, p);
      return { costShare: c, producerPremium: p, margin: distributorMargin(def)!, result: evaluate(def) };
    }),
  );
  cached = { method: PRODUCER_DIRECT_METHOD, assumptions: DIRECT_ASSUMPTIONS, main: evaluate(directDef()), wholesale: evaluate(alternativeById("C_take")), grid };
  return cached;
}
