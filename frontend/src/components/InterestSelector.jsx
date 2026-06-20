import { useMemo, useState } from "react";

export default function InterestSelector({
  options,
  selected,
  primaryValue,
  onToggle,
  onPrimaryChange,
  loading,
}) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(option => option.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <div className="interest-selector">
      <div className="interest-selector-header">
        <div>
          <label>Subjects</label>
          <p className="muted">Search and choose the subjects you care about.</p>
        </div>
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search subjects..."
        disabled={loading}
      />

      {!!selected.length && (
        <div className="selected-interest-list">
          {selected.map(item => (
            <button
              key={item}
              type="button"
              className={`interest-pill ${primaryValue === item ? "primary" : ""}`}
              onClick={() => onPrimaryChange(item)}
            >
              {item}
              {primaryValue === item ? " - Primary" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="interest-option-grid">
        {loading && <p className="muted">Loading subjects...</p>}
        {!loading &&
          filteredOptions.map(option => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`interest-option ${active ? "active" : ""}`}
                onClick={() => onToggle(option)}
              >
                <span>{option}</span>
                <span className="muted">{active ? "Selected" : "Add"}</span>
              </button>
            );
          })}
        {!loading && filteredOptions.length === 0 && (
          <p className="muted">No subject matched your search.</p>
        )}
      </div>
    </div>
  );
}
