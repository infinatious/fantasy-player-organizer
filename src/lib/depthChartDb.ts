import { getDb } from "./db";
import { type DepthChartData, emptyDepthChartData, normalizeDepthChartData } from "./depthChart";

export function getDepthChart(leagueId: number): DepthChartData {
  const db = getDb();
  const row = db.prepare("SELECT data FROM depth_charts WHERE league_id = ?").get(leagueId) as
    | { data: string }
    | undefined;
  if (!row) return emptyDepthChartData();
  try {
    return normalizeDepthChartData(JSON.parse(row.data));
  } catch {
    return emptyDepthChartData();
  }
}

export function saveDepthChart(leagueId: number, data: DepthChartData): void {
  const db = getDb();
  const normalized = normalizeDepthChartData(data);
  db.prepare(
    `INSERT INTO depth_charts (league_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(league_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(leagueId, JSON.stringify(normalized));
}
