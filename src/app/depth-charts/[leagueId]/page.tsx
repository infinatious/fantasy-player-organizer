"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DepthChartBoard } from "./DepthChartBoard";

export default function DepthChartPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = parseInt(params.leagueId, 10);

  return (
    <div className="space-y-4">
      <Link href="/leagues" className="text-sm text-blue-600 hover:underline">
        ← All leagues
      </Link>
      {isNaN(leagueId) ? (
        <p className="text-sm text-red-600">Invalid league.</p>
      ) : (
        <DepthChartBoard leagueId={leagueId} />
      )}
    </div>
  );
}
