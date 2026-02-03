import { useEffect } from "react";
import { useGroupStore } from "../../stores/groupStore";

export default function GroupList() {
  const { groups, fetchMyGroups, setActiveGroup } = useGroupStore();
  useEffect(() => {
    fetchMyGroups();
  }, []);

  return (
    <div>
      <h3>My Groups</h3>
      {groups.map(group => (
        <button key={group._id} onClick={() => setActiveGroup(group)}>
          {group.name}
        </button>
      ))}
    </div>
  );
}
