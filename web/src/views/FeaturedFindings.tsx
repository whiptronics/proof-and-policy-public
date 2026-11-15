// The start page's featured findings. Loaded on demand (it pulls in the scenario models), and every figure is computed
// by the same functions the briefing and the initiative page use, so the start page cannot drift from them.
import { useMemo } from "react";
import { Go } from "../components/common";
import { INITIATIVES, initiativeFigures } from "../lib/initiatives";
import { alternativesReport } from "../lib/wineAlternatives";

const amount = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `$${(Math.abs(v) / 1e6).toFixed(1)}M`);
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export default function FeaturedFindings({ verified }: { verified: string[] }) {
  const f = useMemo(() => initiativeFigures(INITIATIVES[0]), []);
  const alt = useMemo(() => alternativesReport(), []);
  const P = f.comparison.private.lines;
  const W = f.comparison.wholesale.lines;
  const a = alt.results.find((r) => r.def.id === "A_target")!;
  const c = alt.results.find((r) => r.def.id === "C_take")!;
  const back = (r: typeof a) => r.demand.find((d) => d.id === "return_to_stores")!.net;
  return (
    <ul className="finding-cards">
      <li>
        <p className="finding-tag">Utah · state revenue</p>
        <h3>Grocery wine can be designed so Utah keeps its revenue</h3>
        <p>
          With DABS as the wholesaler selling to grocers at today's price, the model has the state about {amount(a.fixed.ledger.net)} a year
          ahead; with private wholesalers paying a state charge equal to DABS's markup, about {amount(c.fixed.ledger.net)} ahead. Both stay ahead (
          {amount(back(a))} and {amount(back(c))}) if some shoppers go back to state stores.
        </p>
        <Go to={{ v: "briefing" }} reset>
          Read the briefing
        </Go>
      </li>
      <li>
        <p className="finding-tag">Utah · the design decides</p>
        <h3>State stores stay the low-price option</h3>
        <p>
          In those designs grocery wine is priced for convenience, about {pct(a.fixed.stack.consumerChange)} to {pct(c.fixed.stack.consumerChange)}{" "}
          above the state store, which keeps today's prices. Designs that hold grocery prices to state-store prices pay the grocer out of the
          state's share instead: {amount(W?.net)} to {amount(P?.net)} a year less in the worked example.
        </p>
        <Go to={{ v: "briefing" }} reset>
          What makes a design work
        </Go>
      </li>
      <li>
        <p className="finding-tag">Other states</p>
        <h3>What happened where grocery-wine laws changed</h3>
        <p>
          Grocery-wine law is verified over time for {verified.length} states ({verified.join(", ")}). Before-and-after comparisons show what
          happened there, with comparison states over the same years; they describe, they do not prove cause.
        </p>
        <Go to={{ v: "change" }} reset>
          See the before-and-after tool
        </Go>
      </li>
    </ul>
  );
}
