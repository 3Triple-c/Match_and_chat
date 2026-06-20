import { useEffect } from "react";
import { useGroupStore } from "../../stores/groupStore";

export default function GroupList() {
  const { groups, fetchMyGroups, fetchGroupDetails, activeGroup } =
    useGroupStore();
  useEffect(() => {
    fetchMyGroups().then(list => {
      if (!activeGroup && list?.[0]?._id) {
        fetchGroupDetails(list[0]._id);
      }
    });
  }, [fetchMyGroups, fetchGroupDetails, activeGroup]);

  return (
    <div className="panel group-list-card">
      <div className="panel-header">
        <div>
          <h3>My Groups</h3>
          <p className="muted">Pick a room and continue your study flow.</p>
        </div>
        <span className="badge">{groups.length}</span>
      </div>
      <div className="group-list">
        {groups.length === 0 && (
          <p className="muted">No groups yet.</p>
        )}
        {groups.map(group => (
          <button
            key={group._id}
            className={`group-item ${
              activeGroup?._id === group._id ? "active" : ""
            }`}
            onClick={() => fetchGroupDetails(group._id)}
          >
            <div className="group-item-top">
              <div className="group-title">{group.name || "Study room"}</div>
              <span className="group-member-count">
                {group.members?.length || 0}
              </span>
            </div>
            <div className="group-item-meta">
              Members: {group.members?.length || 0} | Streak: {group.studyStreak || 0}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
