import { useEffect, useState } from "react";
import useAdminStore from "../../stores/adminStore";

export default function Users() {
  const [q, setQ] = useState("");
  const [availability, setAvailability] = useState("all");
  const { users, loadingUsers, error, fetchUsers } = useAdminStore();

  useEffect(() => {
    fetchUsers({});
  }, [fetchUsers]);

  const submit = e => {
    e.preventDefault();
    fetchUsers({
      q,
      availability: availability === "all" ? undefined : availability,
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users</h1>
        <p className="muted">Search, filter, and inspect user state.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form className="filter-row" onSubmit={submit}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by email, name, interest, or department..."
          />
          <select value={availability} onChange={e => setAvailability(e.target.value)}>
            <option value="all">All availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          <button className="btn btn-primary" disabled={loadingUsers}>
            {loadingUsers ? "Loading..." : "Apply"}
          </button>
        </form>
      </div>

      <div className="stack-list">
        {users.map(user => (
          <div key={user._id} className="card">
            <div className="card-header">
              <div>
                <h3>{user.name}</h3>
                <p className="muted">{user.email}</p>
              </div>
              <span className="badge">{user.role}</span>
            </div>
            <div className="detail-grid">
              <div>
                <div className="stat-label">Primary Interest</div>
                <div>{user.primaryInterest || "-"}</div>
              </div>
              <div>
                <div className="stat-label">Department</div>
                <div>{user.department || "-"}</div>
              </div>
              <div>
                <div className="stat-label">Level</div>
                <div>{user.level || "-"}</div>
              </div>
              <div>
                <div className="stat-label">Availability</div>
                <div>{user.isAvailable ? "Available" : "Unavailable"}</div>
              </div>
              <div>
                <div className="stat-label">On Web App</div>
                <div>{user.isOnlineOnApp ? "Online" : "Offline"}</div>
              </div>
              <div>
                <div className="stat-label">Groups</div>
                <div>{user.groups?.length || 0}</div>
              </div>
              <div>
                <div className="stat-label">Joined</div>
                <div>{new Date(user.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="stat-label">Last Seen</div>
                <div>
                  {user.lastSeenOnAppAt
                    ? new Date(user.lastSeenOnAppAt).toLocaleString()
                    : "No presence yet"}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loadingUsers && users.length === 0 && <p className="muted">No users found.</p>}
      </div>
    </div>
  );
}
