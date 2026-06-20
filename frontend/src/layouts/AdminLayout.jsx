import { NavLink } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function AdminLayout({ children }) {
  const { user, logout } = useAuthStore();

  return (
    <div className="app-shell admin">
      <header className="app-nav">
        <div className="brand">StuGrMat Admin</div>
        <nav className="nav-links">
          <NavLink to="/admin">Overview</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/groups">Groups</NavLink>
          <NavLink to="/admin/matches">Matches</NavLink>
        </nav>
        <div className="nav-actions">
          <span className="chip">{user?.email || "Admin"}</span>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
