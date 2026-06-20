import { useEffect, useState } from "react";
import useAdminStore from "../../stores/adminStore";

export default function Groups() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("all");
  const { groups, loadingGroups, error, fetchGroups } = useAdminStore();

  useEffect(() => {
    fetchGroups({});
  }, [fetchGroups]);

  const submit = e => {
    e.preventDefault();
    fetchGroups({
      q,
      active: active === "all" ? undefined : active,
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Groups</h1>
        <p className="muted">Review group activity, members, and creator data.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form className="filter-row" onSubmit={submit}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, internal name, or topic..."
          />
          <select value={active} onChange={e => setActive(e.target.value)}>
            <option value="all">All groups</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <button className="btn btn-primary" disabled={loadingGroups}>
            {loadingGroups ? "Loading..." : "Apply"}
          </button>
        </form>
      </div>

      <div className="stack-list">
        {groups.map(group => (
          <div key={group._id} className="card">
            <div className="card-header">
              <div>
                <h3>{group.name || group.internalName || "Unnamed group"}</h3>
                <p className="muted">{group.topic || "No topic"}</p>
              </div>
              <span className="badge">{group.isActive ? "active" : "inactive"}</span>
            </div>
            <div className="detail-grid">
              <div>
                <div className="stat-label">Creator</div>
                <div>{group.createBy?.email || "unknown"}</div>
              </div>
              <div>
                <div className="stat-label">Members</div>
                <div>{group.members?.length || 0}</div>
              </div>
              <div>
                <div className="stat-label">Feedback</div>
                <div>{group.feedbacks?.length || 0}</div>
              </div>
              <div>
                <div className="stat-label">Created</div>
                <div>{new Date(group.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <div className="participant-list">
              {group.members?.map(member => (
                <span key={member._id} className="chip">
                  {member.email}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!loadingGroups && groups.length === 0 && <p className="muted">No groups found.</p>}
      </div>
    </div>
  );
}
