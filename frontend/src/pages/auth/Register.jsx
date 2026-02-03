import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
export default function Register() {
  const { register, loading, error } = useAuthStore();
  const [form, setForm] = useState({
    email: "",
    password: "",
    level: "",
    name: "",
    department: "",
    studyTime: "",
  });

  const submit = e => {
    e.preventDefault();
    register(form);
  };
  return (
    <form onSubmit={submit}>
      <h2>Register</h2>
      <input
        placeholder="Email"
        onChange={e => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={e => setForm({ ...form, password: e.target.value })}
      />
      <input
        type="number"
        placeholder="Level"
        onChange={e => setForm({ ...form, level: e.target.value })}
      />{" "}
      <input
        placeholder="Name"
        onChange={e => setForm({ ...form, name: e.target.value })}
      />{" "}
      <input
        placeholder="Department"
        onChange={e => setForm({ ...form, department: e.target.value })}
      />{" "}
      <input
        placeholder="StudyTime"
        onChange={e => setForm({ ...form, studyTime: e.target.value })}
      />
      <button disabled={loading}>Register</button>
      {error && <p>{error}</p>}
    </form>
  );
}
