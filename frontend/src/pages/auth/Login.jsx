import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error, token, user } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = e => {
    e.preventDefault();
    login(form);
  };
  useEffect(() => {
    if (token && user) {
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [token, user, navigate]);
  const params = new URLSearchParams(window.location.search);
  const expired = params.get("expired");

  return (
    <div className="auth-page">
      <form onSubmit={submit} className="auth-card">
        <h2>Welcome back</h2>
        <p className="muted">Sign in to continue to your dashboard.</p>
        <input
          placeholder="Email"
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn btn-primary" disabled={loading}>
          Login
        </button>
        {error && <p className="error">{error}</p>}
        {expired && (
          <p className="error">Session expired. Please login again</p>
        )}
        <p className="muted auth-switch">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </p>
      </form>
      <div className="auth-side">
        <h3>Build calm, focused study sessions</h3>
        <p className="muted">
          Match by interest, chat in real time, and stay accountable in a calmer
          study space.
        </p>
      </div>
    </div>
  );
}
