import './Input.css';

export function Input({ label, hint, error, className = '', ...props }) {
  return (
    <div className={`input-group ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input className={`input ${error ? 'input-error' : ''}`} {...props} />
      {hint && !error && <span className="input-hint">{hint}</span>}
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}
