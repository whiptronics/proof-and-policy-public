// The navigation: every view in exactly one group (nav.test.ts checks it), each with its page title and a one-sentence
// description for search results and link previews.
import type { View } from "./url";

export interface NavGroup {
  id: string;
  label: string;
  views: [View, string][];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "overview", label: "Overview", views: [["start", "Start here"], ["briefing", "Utah briefing"]] },
  {
    id: "utah",
    label: "Utah research",
    views: [
      ["initiative", "Utah grocery wine: full analysis"],
      ["scenario", "Utah revenue scenarios"],
      ["utah", "Utah at a glance"],
    ],
  },
  {
    id: "states",
    label: "Compare states",
    views: [
      ["change", "Before & after"],
      ["finder", "Find comparison states"],
      ["case", "Worked example"],
    ],
  },
  {
    id: "data",
    label: "Explore data",
    views: [
      ["map", "Map"],
      ["beverages", "Beer, wine & spirits"],
      ["fiscal", "Revenue by state"],
      ["explore", "Explore"],
      ["compare", "Compare"],
      ["revenue", "Revenue over time"],
      ["timeline", "Policy timeline"],
      ["matrix", "Policy matrix"],
      ["officials", "Officials & committees"],
    ],
  },
  {
    id: "methods",
    label: "Methods & data",
    views: [
      ["methods", "Definitions & methods"],
      ["sources", "Sources"],
      ["coverage", "Coverage"],
      ["downloads", "Downloads"],
    ],
  },
];

export const TITLES = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.views)) as Record<View, string>;

export const groupOf = (v: View): NavGroup => NAV_GROUPS.find((g) => g.views.some(([x]) => x === v)) ?? NAV_GROUPS[0];

export const DESCRIPTIONS: Record<View, string> = {
  start: "Wine in Utah grocery stores: an evidence-based examination of retail access, consumer prices, state revenue and implementation, with open, sourced data on alcohol laws, revenue and public health.",
  briefing: "A two-minute briefing on how Utah could allow grocery-store wine without losing state revenue, what each design means for prices, and what is not yet measured.",
  initiative: "The full Utah grocery-wine analysis: arrangements, policy alternatives, purchase flows, sensitivity ranges and open questions, computed from the scenario model.",
  scenario: "A calculator for Utah state revenue if some wine purchases moved to grocery stores, with every input labeled as data or assumption.",
  utah: "Utah's latest value on each measure, its rank among states, how Utah sells alcohol under verified law, and candidate comparison states.",
  change: "Averages before and after a state allowed grocery-store wine, with comparison states over the same years. Descriptive, not causal.",
  finder: "Rank states by how closely they resembled Utah on population, income, drinking and consumption, with the values behind every score.",
  case: "A worked before-and-after example: Tennessee's 2016 grocery-wine change, with its comparison pool, sensitivity checks and limits.",
  map: "A map of the United States with every state's value on drinking, alcohol sold, taxes, spending, retail sales or alcohol-related deaths.",
  beverages: "Beer, wine and spirits side by side for any state and the nation, with each one's share of pure alcohol and Utah's monthly state-store sales.",
  fiscal: "Where each state's alcohol money comes from: taxes, license fees and state-store receipts, side by side and never added together.",
  explore: "Chart measures from the dataset for the jurisdictions and years you choose, with a coded policy underneath and the source of every value.",
  compare: "State-level values side by side for one year, with Utah as a reference rather than an untreated control.",
  revenue: "Revenue and consumption trends for one state, each kind of revenue shown apart. Descriptive: a change after a law does not show the law caused it.",
  timeline: "Every coded alcohol policy over time, by state: verified runs, unknown stretches and dated snapshots of current law.",
  matrix: "Every state against every coded alcohol policy, on one day or as the latest dated snapshot of current law.",
  officials: "A reference directory of officials and the committees the source lists them on, kept apart from the alcohol data.",
  methods: "Definitions, methods, statistical conventions, review status and how AI assistance was used in this project.",
  sources: "Every source in the dataset: who published it, what it covers, its license and when it was retrieved.",
  coverage: "What the dataset holds by jurisdiction and year, which values are missing, and why.",
  downloads: "Download the whole dataset (CSV, Parquet, DuckDB) with its manifest, checksums and release notes.",
};
