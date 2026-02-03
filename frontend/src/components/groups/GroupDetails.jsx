import { useGroupStore } from "../../stores/groupStore";
import GroupChat from "../chat/GroupChat";
export default function GroupDetails() {
  const { activeGroup, leaveGroup } = useGroupStore();
  if (!activeGroup) return <p>Select a Group</p>;

  return (
    <div>
      <h2>{activeGroup.name}</h2>
      <h4>Members</h4>
      <ul>
        {activeGroup.members?.map(m => (
          <li key={m._id || m}>{m.email || m}</li>
        ))}
      </ul>
      <button onClick={() => leaveGroup(activeGroup._id)}>Leave Group</button>

      <GroupChat groupId={activeGroup._id} />
    </div>
  );
}
