import { useMemo, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useGroupStore } from "../../stores/groupStore";
import GroupChat from "../chat/GroupChat";
import StudySessionPanel from "./StudySessionPanel";
import { useSessionStore } from "../../stores/sessionStore";

export default function GroupDetails() {
  const { user } = useAuthStore();
  const { activeGroup, leaveGroup, renameGroup, deleteGroup } = useGroupStore();
  const currentSession = useSessionStore(state => state.currentSession);
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);

  const isCreator = useMemo(() => {
    if (!activeGroup?.createBy || !user) return false;
    const creatorId = activeGroup.createBy._id || activeGroup.createBy;
    return creatorId?.toString() === (user.id || user._id);
  }, [activeGroup, user]);

  if (!activeGroup) {
    return (
      <div className="panel empty scenic-empty">
        <h3>Your study room is waiting</h3>
        <p>Select a group on the left to open members, details, and live chat.</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditName(activeGroup.name || "");
    setEditing(true);
  };

  const submitEdit = e => {
    e.preventDefault();
    if (!editName.trim()) return;
    renameGroup(activeGroup._id, editName.trim());
    setEditing(false);
  };

  return (
    <div className="group-details">
      <div className="panel header group-hero">
        <div className="group-hero-copy">
          <p className="section-kicker">Active Study Room</p>
          <h2>{activeGroup.name}</h2>
          <p className="muted">
            Created by {activeGroup.createBy?.email || "unknown"}
          </p>
          <div className="participant-list">
            <span className="chip">{activeGroup.members?.length || 0} members</span>
            <span className="chip">{activeGroup.topic || "General study"}</span>
            <span className="chip">{activeGroup.studyStreak || 0} day streak</span>
            <span className="chip">Best: {activeGroup.longestStudyStreak || 0} days</span>
            {!currentSession && activeGroup.nextSessionPlan?.teacherUser?.name && (
              <span className="chip">
                Next teacher: {activeGroup.nextSessionPlan.teacherUser.name}
              </span>
            )}
            {activeGroup.nextSessionPlan?.planStatus && (
              <span className="chip">
                Plan: {activeGroup.nextSessionPlan.planStatus.replace("_", " ")}
              </span>
            )}
          </div>
          {(activeGroup.nextSessionPlan?.topic || activeGroup.nextSessionPlan?.scheduledFor) && (
            <div className="muted" style={{ marginTop: "0.6rem" }}>
              {activeGroup.nextSessionPlan?.topic
                ? `Upcoming topic: ${activeGroup.nextSessionPlan.topic}. `
                : ""}
              {activeGroup.nextSessionPlan?.scheduledFor
                ? `Scheduled for ${new Date(activeGroup.nextSessionPlan.scheduledFor).toLocaleString()}.`
                : "Next session time is still being decided."}
            </div>
          )}
        </div>
        <div className="actions">
          {isCreator && !editing && (
            <button className="btn btn-ghost" onClick={startEdit}>
              Edit name
            </button>
          )}
          {isCreator && activeGroup?.isActive === false && (
            <button
              className="btn btn-danger"
              onClick={() => deleteGroup(activeGroup._id)}
            >
              Delete Inactive Group
            </button>
          )}
          <button className="btn btn-danger" onClick={() => leaveGroup(activeGroup._id)}>
            Leave
          </button>
        </div>
      </div>

      {isCreator && editing && (
        <form onSubmit={submitEdit} className="panel edit-form">
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Group name"
          />
          <button className="btn btn-primary">Save</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      )}

      <div className="group-grid polished">
        <div className="panel members member-panel">
          <h4>Members</h4>
          <ul className="member-list">
            {activeGroup.members?.map(m => (
              <li key={m._id || m} className="member-card">
                <div className="member-avatar">{(m.name || "M").slice(0, 1)}</div>
                <div>
                  <div className="member-name">{m.name || "Member"}</div>
                  <div className="muted">{m.email || m}</div>
                  <div className="participant-list">
                    <span className={`chip ${m.isOnlineOnApp ? "chip-online" : ""}`}>
                      {m.isOnlineOnApp ? "On app" : "Offline on app"}
                    </span>
                    <span className={`chip ${
                      currentSession?.participants?.some(
                        participant =>
                          (participant.user?._id || participant.user)?.toString() ===
                            (m._id || m)?.toString() && participant.isOnline,
                      )
                        ? "chip-online"
                        : ""
                    }`}>
                      {currentSession?.participants?.some(
                        participant =>
                          (participant.user?._id || participant.user)?.toString() ===
                            (m._id || m)?.toString() && participant.isOnline,
                      )
                        ? "In session"
                        : "Not in session"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="session-column">
          <StudySessionPanel groupId={activeGroup._id} activeGroup={activeGroup} />
          <GroupChat groupId={activeGroup._id} session={currentSession} />
        </div>
      </div>
    </div>
  );
}
