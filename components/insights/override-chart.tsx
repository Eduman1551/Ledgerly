"use client";
// Bar chart: how often reviewers override each rule. A table with the same
// numbers sits under it for screen readers and exact values.
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RuleStat } from "@/lib/services/insights";

const VAGUE_THRESHOLD = 40;

export function OverrideChart({ stats }: { stats: RuleStat[] }) {
  const data = stats.map((s) => ({ name: s.title, rate: Math.round(s.overrideRate * 100), overrides: s.overrides, total: s.total }));
  return (
    <div className="flex flex-col gap-3">
      <div className="h-56 w-full" role="img" aria-label="Bar chart of override rate per rule. The table below has the same data.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "#5b6672" }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "#1f2933" }} />
            <Tooltip formatter={(value, _name, item) => [`${value}% (${item.payload.overrides} of ${item.payload.total} decisions)`, "Override rate"]} cursor={{ fill: "#f3f4f6" }} />
            <ReferenceLine x={VAGUE_THRESHOLD} stroke="#9333ea" strokeDasharray="4 4" label={{ value: "vague-rule line (40%)", position: "insideTopRight", fontSize: 11, fill: "#7e22ce" }} />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.rate >= VAGUE_THRESHOLD ? "#9333ea" : "#0f766e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-medium">Rule</th>
            <th className="text-right font-medium">Accepted / edited</th>
            <th className="text-right font-medium">Overridden</th>
            <th className="text-right font-medium">Override rate</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.ruleId} className="border-b border-border last:border-0">
              <td className="py-1.5">{s.title}</td>
              <td className="text-right tabular-nums">{s.accepts + s.edits}</td>
              <td className="text-right tabular-nums">{s.overrides}</td>
              <td className={`text-right font-medium tabular-nums ${s.overrideRate * 100 >= VAGUE_THRESHOLD ? "text-purple-700" : ""}`}>{Math.round(s.overrideRate * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
