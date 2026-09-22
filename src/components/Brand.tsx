export default function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <svg
        width="23"
        height="25"
        viewBox="0 0 28 30"
        fill="none"
        aria-hidden="true"
      >
        <path d="M3 3h22v8H11v6h10v7H11v4H3V3Z" fill="currentColor" />
        <path d="M18 3h7v8h-7V3Z" fill="var(--studio-accent, #38bdf8)" />
        <path d="M20 5h3v4h-3V5Z" fill="currentColor" />
      </svg>
      {!small && <span>Forma</span>}
    </span>
  );
}
