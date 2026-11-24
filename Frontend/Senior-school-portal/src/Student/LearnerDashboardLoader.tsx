import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LearnerDashboard from "./LearnerDashboard";
import type { LearnerDashboardData, LearnerDashboardProps } from "./LearnerDashboard";
import { ApiError } from "../api/authApi";
import { fetchLearnerDashboard } from "../api/learnerApi";

export default function LearnerDashboardLoader(props: Omit<LearnerDashboardProps, "data">) {
  const navigate = useNavigate();
  const [data, setData] = useState<LearnerDashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (force = false) => {
      setError("");
      try {
        setData(await fetchLearnerDashboard(force));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/", { replace: true }); // not signed in: back to the login page
          return;
        }
        setError(err instanceof ApiError ? err.message : "Cannot reach the server. Check your connection.");
      }
    },
    [navigate],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div style={{ padding: 32 }} role="alert">
        <p>{error}</p>
        <button type="button" className="ss-btn" onClick={() => void load(true)}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 32 }} role="status">
        Loading your dashboard…
      </div>
    );
  }
  return <LearnerDashboard {...props} data={data} />;
}