import { useEffect, useState } from "react";
import useAdminStore from "../../stores/adminStore";

export default function AdminDashboard() {
  const [query, setQuery] = useState("");
  const {
    overview,
    searchResults,
    loadingOverview,
    loadingSearch,
    runningMatch,
    error,
    lastRunResult,
    fetchOverview,
    searchAll,
    runMatching,
  } = useAdminStore();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const submitSearch = e => {
    e.preventDefault();
    searchAll(query);
  };

  const metrics = overview?.metrics;
  const recent = overview?.recent;
  const totalSearchHits =
    (searchResults.users?.length || 0) +
    (searchResults.groups?.length || 0) +
    (searchResults.matches?.length || 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Overview</h1>
        <p className="muted">
          Monitor users, matches, groups, and search across the whole system.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        <div className="card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">
            {loadingOverview ? "..." : (metrics?.totalUsers ?? 0)}
          </div>
          <p className="muted">
            Online: {metrics?.onlineUsers ?? 0} | Available: {metrics?.availableUsers ?? 0}
          </p>
        </div>
        <div className="card">
          <div className="stat-label">Matches</div>
          <div className="stat-value">
            {loadingOverview ? "..." : (metrics?.activeMatches ?? 0)}
          </div>
          <p className="muted">
            Active now, {metrics?.totalMatches ?? 0} total recorded.
          </p>
        </div>
        <div className="card">
          <div className="stat-label">Groups</div>
          <div className="stat-value">
            {loadingOverview ? "..." : (metrics?.activeGroups ?? 0)}
          </div>
          <p className="muted">
            Active now, {metrics?.totalGroups ?? 0} total recorded.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Quick Actions</h3>
            <p className="muted">Trigger matching and inspect what changed.</p>
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={runningMatch}
            onClick={runMatching}
          >
            {runningMatch ? "Running..." : "Run Matching"}
          </button>
        </div>
        {lastRunResult?.message && (
          <p className="muted">Last run: {lastRunResult.message}</p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Global Search</h3>
            <p className="muted">
              Search across users, groups, and matches from one place.
            </p>
          </div>
          <span className="badge">{totalSearchHits} hits</span>
        </div>
        <form className="filter-row" onSubmit={submitSearch}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by user email, group topic, match name..."
          />
          <button className="btn btn-primary" disabled={loadingSearch}>
            {loadingSearch ? "Searching..." : "Search"}
          </button>
        </form>
        <div className="search-results">
          <div className="search-column">
            <h4>Users</h4>
            {searchResults.users?.length ? (
              searchResults.users.map(user => (
                <div key={user._id} className="search-result-card">
                  <strong>{user.name}</strong>
                  <span className="muted">{user.email}</span>
                  <span className="muted">
                    {user.primaryInterest} |{" "}
                    {user.isAvailable ? "available" : "busy"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No user results yet.</p>
            )}
          </div>
          <div className="search-column">
            <h4>Groups</h4>
            {searchResults.groups?.length ? (
              searchResults.groups.map(group => (
                <div key={group._id} className="search-result-card">
                  <strong>
                    {group.name || group.internalName || "Unnamed group"}
                  </strong>
                  <span className="muted">{group.topic || "No topic"}</span>
                  <span className="muted">
                    {group.members?.length || 0} members |{" "}
                    {group.isActive ? "active" : "inactive"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No group results yet.</p>
            )}
          </div>
          <div className="search-column">
            <h4>Matches</h4>
            {searchResults.matches?.length ? (
              searchResults.matches.map(match => (
                <div key={match._id} className="search-result-card">
                  <strong>{match.name || "Unnamed match"}</strong>
                  <span className="muted">
                    {match.users?.length || 0} participants
                  </span>
                  <span className="muted">
                    {match.isActive ? "active" : "inactive"} |{" "}
                    {match.isGroupCreated ? "group created" : "waiting"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No match results yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Recent Users</h3>
          <div className="stack-list">
            {recent?.users?.map(user => (
              <div key={user._id} className="stack-item">
                <strong>{user.name}</strong>
                <span className="muted">{user.email}</span>
              </div>
            )) || <p className="muted">No recent users.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Recent Groups</h3>
          <div className="stack-list">
            {recent?.groups?.map(group => (
              <div key={group._id} className="stack-item">
                <strong>
                  {group.name || group.internalName || "Unnamed group"}
                </strong>
                <span className="muted">
                  {group.members?.length || 0} members
                </span>
              </div>
            )) || <p className="muted">No recent groups.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Recent Matches</h3>
          <div className="stack-list">
            {recent?.matches?.map(match => (
              <div key={match._id} className="stack-item">
                <strong>{match.name || "Unnamed match"}</strong>
                <span className="muted">
                  {match.isActive ? "active" : "inactive"} |{" "}
                  {match.users?.length || 0} participants
                </span>
              </div>
            )) || <p className="muted">No recent matches.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
