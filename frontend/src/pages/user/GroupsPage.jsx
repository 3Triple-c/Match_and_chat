import GroupList from "../../components/groups/GroupList";
import CreateGroup from "../../components/groups/CreateGroup";
import GroupDetails from "../../components/groups/GroupDetails";

export default function GroupsPage() {
  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <div>
        <CreateGroup />
        <GroupList />
      </div>
      <GroupDetails />
    </div>
  );
}
