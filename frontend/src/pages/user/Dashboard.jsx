import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useGroupStore } from "../../stores/groupStore";
import useMatchStore from "../../stores/matchStore";

export default function Dashboard() {
  const { user, toggleAvailability, availabilityLoading } = useAuthStore();
  const { groups, fetchMyGroups } = useGroupStore();
  const { activeMatches, fetchActiveMatches } = useMatchStore();

  useEffect(() => {
    fetchMyGroups();
    fetchActiveMatches();
  }, [fetchMyGroups, fetchActiveMatches]);

  return (
    <div className="page">
      <div className="hero">
        <div>
          <h1>Welcome back, {user?.name || "Student"}.</h1>
          <p className="muted">
            Your study network is ready. Join matches, chat in groups, and stay
            focused.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/matches">
              View Matches
            </a>
            <a className="btn btn-ghost" href="/groups">
              Open Groups
            </a>
          </div>
        </div>
        <div className="hero-card">
          <div className="stat">
            <div className="stat-label">Active Matches</div>
            <div className="stat-value">{activeMatches.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Groups</div>
            <div className="stat-value">{groups.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Primary Interest</div>
            <div className="stat-value">{user?.primaryInterest || "-"}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Study Streak</div>
            <div className="stat-value">{user?.studyStreak || 0} days</div>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Next Match</h3>
          {activeMatches[0] ? (
            <>
              <p className="muted">{activeMatches[0].name}</p>
              <p>
                Expires{" "}
                {new Date(activeMatches[0].expiresAt).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="muted">No active matches right now.</p>
          )}
        </div>
        <div className="card">
          <h3>Your Groups</h3>
          {groups.length ? (
            <ul className="simple-list">
              {groups.slice(0, 3).map(g => (
                <li key={g._id}>{g.name}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">You are not in any groups yet.</p>
          )}
        </div>
        <div className="card">
          <h3>Availability</h3>
          <p className="muted">
            {user?.isAvailable
              ? "You are available to receive new matches."
              : "You are currently unavailable for new matches."}
          </p>
          <button
            className="btn btn-primary"
            disabled={availabilityLoading}
            onClick={toggleAvailability}
          >
            {availabilityLoading
              ? "Updating..."
              : user?.isAvailable
                ? "Turn Off"
                : "Turn On"}
          </button>
        </div>
        <div className="card">
          <h3>Consistency</h3>
          <p className="muted">
            Keep joining your scheduled sessions to grow a daily study streak.
          </p>
          <p>Current streak: {user?.studyStreak || 0} day(s)</p>
          <p>Best streak: {user?.longestStudyStreak || 0} day(s)</p>
        </div>
      </div>
    </div>
  );
}
