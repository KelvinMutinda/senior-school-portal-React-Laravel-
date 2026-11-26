import { useCallback, useEffect, useState } from "react";
import LearnerDashboard from "../../Student/LearnerDashboard";
import type { LearnerDashboardData, LearnerDashboardProps } from "../../Student/LearnerDashboard";
import { fetchLearnerDashboard, logout } from "../../api/learnerApi";

/** Loads the signed-in learner, then shows the dashboard. */
export default function LearnerPage(props: LearnerDashboardProps) {
  const [data, setData] = useState<LearnerDashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchLearnerDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your dashboard.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div role="alert" style={{ padding: 24 }}>
        <p>{error}</p>
        <button type="button" onClick={load}>Retry</button>{" "}
        <button type="button" onClick={logout}>Sign in again</button>
      </div>
    );
  }
  if (!data) return <p style={{ padding: 24 }}>Loading your dashboard…</p>;

  return <LearnerDashboard {...props} data={data} />;
}