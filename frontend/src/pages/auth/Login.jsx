import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      navigate("/matches", { replace: true });
    }
  }, [token,user,navigate]);
  const params = new URLSearchParams(window.location.search);
  const expired = params.get("expired");

  return (
    <form onSubmit={submit}>
      <h2>Login</h2>
      <input
        placeholder="Email"
        onChange={e => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={e => setForm({ ...form, password: e.target.value })}
      />
      <button disabled={loading}>Login</button>
      {error && <p>{error}</p>}
      {expired && (
        <p style={{ color: "red" }}>Session expired. Please login again</p>
      )}
    </form>
  );
}
