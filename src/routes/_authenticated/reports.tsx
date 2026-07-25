import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { fetchProjects } from "@/lib/queries";
import { downloadCsv } from "@/lib/csv";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Kilowatt" }] }),
  component: ReportsPage,
});

type Row = { key: string; count: number; capex: number; co2: number };
type ProjectRow = Awaited<ReturnType<typeof fetchProjects>>[number];

function ReportsPage() {
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const rollup = (accessor: (p: ProjectRow) => string): Row[] => {
    const m = new Map<string, Row>();
    for (const p of projects) {
      const k = accessor(p);
      const r = m.get(k) ?? { key: k, count: 0, capex: 0, co2: 0 };
      r.count += 1;
      r.capex += Number(p.capex_estimate || 0);
      r.co2 += Number(p.expected_co2e_t_yr || 0);
      m.set(k, r);
    }
    return Array.from(m.values()).sort((a, b) => b.co2 - a.co2);
  };

  const byCat = rollup((p) => p.category?.name ?? "Uncategorised");
  const bySite = rollup((p) => p.site?.name ?? "Unassigned");

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Portfolio roll-ups for ESG and internal review. Export any table to CSV.
        </p>
      </div>

      <Table
        title="By category"
        rows={byCat}
        headers={["Category", "Projects", "Total CAPEX", "CO₂e t/yr"]}
        onExport={() =>
          downloadCsv("kilowatt-by-category.csv", [
            ["Category", "Projects", "Total CAPEX (USD)", "CO2e t/yr"],
            ...byCat.map((r) => [r.key, r.count, r.capex, r.co2.toFixed(1)]),
          ])
        }
      />

      <Table
        title="By site"
        rows={bySite}
        headers={["Site", "Projects", "Total CAPEX", "CO₂e t/yr"]}
        onExport={() =>
          downloadCsv("kilowatt-by-site.csv", [
            ["Site", "Projects", "Total CAPEX (USD)", "CO2e t/yr"],
            ...bySite.map((r) => [r.key, r.count, r.capex, r.co2.toFixed(1)]),
          ])
        }
      />
    </div>
  );
}

function Table({
  title,
  rows,
  headers,
  onExport,
}: {
  title: string;
  rows: Row[];
  headers: string[];
  onExport: () => void;
}) {
  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b">
        <div className="font-display font-semibold">{title}</div>
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`px-4 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="px-4 py-2.5">{r.key}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs">{r.count}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtCurrency(r.capex)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtNumber(r.co2)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-muted-foreground">No data.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}