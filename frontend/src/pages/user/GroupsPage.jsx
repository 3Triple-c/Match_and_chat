import GroupList from "../../components/groups/GroupList";
import GroupDetails from "../../components/groups/GroupDetails";

export default function GroupsPage() {
  return (
    <div className="page">
      <div className="page-header groups-header">
        <div>
          <h1>Groups</h1>
          <p className="muted">Your study groups and live chat.</p>
        </div>
        <div className="groups-header-note">
          <span className="badge">Live chat</span>
          <span className="badge">Shared focus</span>
        </div>
      </div>
      <div className="page-body">
        <div className="sidebar">
          <GroupList />
        </div>
        <div className="content">
          <GroupDetails />
        </div>
      </div>
    </div>
  );
}
