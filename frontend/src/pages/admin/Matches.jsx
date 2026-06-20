import { useEffect, useState } from "react";
import useAdminStore from "../../stores/adminStore";

export default function Matches() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const { matches, loadingMatches, error, fetchMatches } = useAdminStore();

  useEffect(() => {
    fetchMatches({ status: "all" });
  }, [fetchMatches]);

  const submit = e => {
    e.preventDefault();
    fetchMatches({ q, status });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Matches</h1>
        <p className="muted">Inspect match runs, participant state, and group creation.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form className="filter-row" onSubmit={submit}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by match name..."
          />
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All matches</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="grouped">Grouped</option>
            <option value="ungrouped">Ungrouped</option>
          </select>
          <button className="btn btn-primary" disabled={loadingMatches}>
            {loadingMatches ? "Loading..." : "Apply"}
          </button>
        </form>
      </div>

      <div className="stack-list">
        {matches.map(match => (
          <div key={match._id} className="card">
            <div className="card-header">
              <div>
                <h3>{match.name || "Unnamed match"}</h3>
                <p className="muted">
                  Created {new Date(match.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="badge">
                {match.isActive ? "active" : "inactive"}
              </span>
            </div>
            <div className="detail-grid">
              <div>
                <div className="stat-label">Participants</div>
                <div>{match.users?.length || 0}</div>
              </div>
              <div>
                <div className="stat-label">Group</div>
                <div>
                  {match.isGroupCreated
                    ? match.groupId?.name || "Created"
                    : "Not yet created"}
                </div>
              </div>
              <div>
                <div className="stat-label">Expires</div>
                <div>{new Date(match.expiresAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="stack-list compact">
              {match.users?.map(entry => (
                <div key={entry._id} className="stack-item row">
                  <span>{entry.user?.email || "Unknown user"}</span>
                  <span className="muted">{entry.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!loadingMatches && matches.length === 0 && <p className="muted">No matches found.</p>}
      </div>
    </div>
  );
}
