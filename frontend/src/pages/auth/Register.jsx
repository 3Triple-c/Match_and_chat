import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { fetchInterests } from "../../api/interest.api";
import InterestSelector from "../../components/InterestSelector";
import { STUDY_TIME_OPTIONS } from "../../constants/studyTime";

export default function Register() {
  const navigate = useNavigate();
  const { register, loading, error, token, user } = useAuthStore();
  const [interestOptions, setInterestOptions] = useState([]);
  const [interestsLoading, setInterestsLoading] = useState(true);
  const [form, setForm] = useState({
    email: "",
    password: "",
    level: "",
    name: "",
    department: "",
    studyTime: "",
    interest: [],
    primaryInterest: "",
  });

  const submit = e => {
    e.preventDefault();
    register(form);
  };

  useEffect(() => {
    let mounted = true;
    fetchInterests()
      .then(list => {
        if (!mounted) return;
        setInterestOptions(list);
      })
      .finally(() => {
        if (mounted) setInterestsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (token && user) {
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    }
  }, [token, user, navigate]);

  const toggleInterest = value => {
    setForm(prev => {
      const set = new Set(prev.interest);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      const updated = [...set];
      const primaryStillValid = updated.includes(prev.primaryInterest);
      return {
        ...prev,
        interest: updated,
        primaryInterest: primaryStillValid ? prev.primaryInterest : "",
      };
    });
  };

  const setPrimaryInterest = value => {
    setForm(prev => {
      if (!value) return { ...prev, primaryInterest: "" };
      const set = new Set(prev.interest);
      set.add(value);
      return { ...prev, primaryInterest: value, interest: [...set] };
    });
  };

  return (
    <div className="auth-page">
      <form onSubmit={submit} className="auth-card">
        <h2>Create your account</h2>
        <p className="muted">Match with students who share your interests.</p>
        <div className="form-grid">
          <input
            placeholder="Name"
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
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
          />
          <input
            placeholder="Department"
            onChange={e => setForm({ ...form, department: e.target.value })}
          />
          <select
            value={form.studyTime}
            onChange={e => setForm({ ...form, studyTime: e.target.value })}
          >
            <option value="">Select study time</option>
            {STUDY_TIME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Primary Interest</label>
          <select
            value={form.primaryInterest}
            onChange={e => setPrimaryInterest(e.target.value)}
            disabled={interestsLoading}
          >
            <option value="">Select one</option>
            {interestOptions.map(i => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <InterestSelector
          options={interestOptions}
          selected={form.interest}
          primaryValue={form.primaryInterest}
          onToggle={toggleInterest}
          onPrimaryChange={setPrimaryInterest}
          loading={interestsLoading}
        />

        <button className="btn btn-primary" disabled={loading || !form.primaryInterest}>
          Register
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
      <div className="auth-side">
        <h3>Join a softer, calmer study network</h3>
        <p className="muted">
          We group by interest and study time to keep sessions productive and
          less overwhelming.
        </p>
      </div>
    </div>
  );
}
