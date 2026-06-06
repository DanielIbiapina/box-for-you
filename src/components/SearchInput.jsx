export function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`bfy-search ${className}`}>
      <svg className="bfy-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.75" />
        <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <input
        className="bfy-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
