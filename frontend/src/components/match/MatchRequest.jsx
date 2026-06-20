import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useMatchStore from "../../stores/matchStore";
import { useAuthStore } from "../../stores/authStore";

const MatchRequest = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userId = user?.id || user?._id;
  const {
    activeMatches,
    loading,
    isActing,
    createdGroup,
    fetchActiveMatches,
    acceptMatch,
    rejectMatch,
    clearCreatedGroup,
  } = useMatchStore();

  useEffect(() => {
    if (userId) {
      fetchActiveMatches();
    }
  }, [userId, fetchActiveMatches]);

  useEffect(() => {
    if (createdGroup?._id) {
      navigate("/groups");
      clearCreatedGroup();
    }
  }, [createdGroup, navigate, clearCreatedGroup]);

  if (!user) return <p>Loading user...</p>;
  if (loading) return <p>Checking for active matches...</p>;
  if (!activeMatches.length) return <p>No active match</p>;
  const maskEmail = email => {
    if (!email || typeof email !== "string") return "unknown";
    const atIndex = email.indexOf("@");
    if (atIndex <= 1) return `**@${email.slice(atIndex + 1)}`;
    const name = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const visible = name.slice(0, 3);
    const masked = "*".repeat(Math.max(3, name.length - 3));
    return `${visible}${masked}@${domain}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Matches</h1>
        <p className="muted">Accept or reject your active matches.</p>
      </div>
      {activeMatches.map(match => {
        const myEntry = match.users.find(u => u.user._id === userId);
        if (!myEntry) return null;
        const { status } = myEntry;
        return (
          <div key={match._id} className="card">
            <div className="card-header">
              <h3>{match.name || "Match"}</h3>
              <span className="badge">
                Expires {new Date(match.expiresAt).toLocaleString()}
              </span>
            </div>
            <div className="participant-list">
              {match.users.map(entry => (
                <span key={entry._id} className="chip">
                  {maskEmail(entry.user?.email)}
                </span>
              ))}
            </div>
            {match.isGroupCreated && (
              <p>Group {match.name || "group"} created.</p>
            )}
            {status === "pending" && (
              <div className="actions">
                <button
                  className="btn btn-primary"
                  disabled={isActing}
                  onClick={() => acceptMatch(match._id)}
                >
                  {isActing ? "Accepting" : "Accept"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={isActing}
                  onClick={() => rejectMatch(match._id)}
                >
                  {isActing ? "Rejecting" : "Reject"}
                </button>
              </div>
            )}
            {status === "accepted" && !match.isGroupCreated && (
              <p className="muted">Waiting for the other users...</p>
            )}
            {status === "rejected" && <p>You rejected this match.</p>}
          </div>
        );
      })}
    </div>
  );
};

export default MatchRequest;
