import { useEffect, useState } from "react";
import { fetchInterests } from "../api/interest.api";
import InterestSelector from "./InterestSelector";
import { STUDY_TIME_OPTIONS } from "../constants/studyTime";

export default function ProfileModal({ user, onClose, onSave, saving }) {
  const [interestOptions, setInterestOptions] = useState([]);
  const [interestsLoading, setInterestsLoading] = useState(true);
  const [form, setForm] = useState({
    name: user?.name || "",
    department: user?.department || "",
    level: user?.level || "",
    studyTime: user?.studyTime || "",
    interest: user?.interest || [],
    primaryInterest: user?.primaryInterest || "",
  });

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

  const toggleInterest = value => {
    setForm(prev => {
      const set = new Set(prev.interest);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      const updated = [...set];
      return {
        ...prev,
        interest: updated,
        primaryInterest: updated.includes(prev.primaryInterest)
          ? prev.primaryInterest
          : updated[0] || "",
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

  const submit = e => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <h3>Edit Profile</h3>
            <p className="muted">Update your study preferences and profile details.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <div className="detail-grid">
            <div>
              <label>Name</label>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label>Department</label>
              <input
                value={form.department}
                onChange={e =>
                  setForm(prev => ({ ...prev, department: e.target.value }))
                }
              />
            </div>
            <div>
              <label>Level</label>
              <input
                value={form.level}
                onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))}
              />
            </div>
            <div>
              <label>Study Time</label>
              <select
                value={form.studyTime}
                onChange={e =>
                  setForm(prev => ({ ...prev, studyTime: e.target.value }))
                }
              >
                <option value="">Select study time</option>
                {STUDY_TIME_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label>Primary Interest</label>
            <select
              value={form.primaryInterest}
              onChange={e => setPrimaryInterest(e.target.value)}
              disabled={interestsLoading}
            >
              <option value="">Select one</option>
              {form.interest.map(option => (
                <option key={option} value={option}>
                  {option}
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

          <div className="actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !form.primaryInterest}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
