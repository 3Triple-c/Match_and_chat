import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import ProfileModal from "../components/ProfileModal";

export default function UserLayout({ children }) {
  const { user, logout, updateProfile, profileLoading } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);

  const saveProfile = async updates => {
    await updateProfile(updates);
    setShowProfile(false);
  };

  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="brand">StuGrMat</div>
        <nav className="nav-links">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/matches">Matches</NavLink>
          <NavLink to="/groups">Groups</NavLink>
        </nav>
        <div className="nav-actions">
          <button className="chip chip-button" onClick={() => setShowProfile(true)}>
            {user?.name || user?.email || "User"}
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSave={saveProfile}
          saving={profileLoading}
        />
      )}
    </div>
  );
}
