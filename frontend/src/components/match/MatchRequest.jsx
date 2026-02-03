import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useMatchStore from "../../stores/matchStore";
import { useAuthStore } from "../../stores/authStore";
const MatchRequest = () => {
  const navigate = useNavigate();
  const userId = useAuthStore(state => state.user?.id);
  const user = useAuthStore(state => state.user);
  const {
    activeMatch,
    loading,
    isActing,
    createdGroup,
    fetchActiveMatch,
    acceptMatch,
    rejectMatch,
  } = useMatchStore();

  useEffect(() => {
    if (userId){

      fetchActiveMatch();
    }
  }, [userId,fetchActiveMatch]);

  useEffect(() => {
    if (createdGroup?._id) {
      navigate(`/groups/${createdGroup._id}`);
    }
  }, [createdGroup, navigate]);
  if (!user) return <p>Loading user...</p>
  if (loading) return <p>Checking for active match...</p>;
  if (!activeMatch) return <p>No active match</p>;

  const myEntry = activeMatch.users.find(u => u.user._id === userId);
  if (!myEntry) return <p>Not part of a match</p>;

  const { status } = myEntry;

  return (
    <div>
      {status === "pending" && (
        <>
          <button
            disabled={isActing}
            onClick={() => acceptMatch(activeMatch._id)}
          >
            {isActing ? "Accepting" : "Accept"}
          </button>

          <button
            disabled={isActing}
            onClick={() => rejectMatch(activeMatch._id)}
          >
            {isActing ? "Rejecting" : "Reject"}
          </button>
        </>
      )}

      {status === "accepted" && <p>Waiting for the other user…</p>}
    </div>
  );
};
export default MatchRequest;
