// Campus Customs crest + wordmark.
export function Crest({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="crest">
      <path d="M5 3h30v18c0 9-7 14.5-15 17C12 35.5 5 30 5 21z" fill="var(--blue)" />
      <path
        d="M8 6.2h24V21c0 7.2-5.5 11.5-12 13.7C13.5 32.5 8 28.2 8 21z"
        fill="none"
        stroke="var(--ivory)"
        strokeWidth="1.1"
      />
      <text
        x="20"
        y="24.5"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="13"
        fontWeight="700"
        fill="var(--ivory)"
      >
        CC
      </text>
    </svg>
  )
}

export default function Logo() {
  return (
    <span className="logo">
      <Crest />
      <span className="logo-text">
        <span className="logo-name">Campus Customs</span>
        <span className="logo-sub">57 Broadway · New Haven</span>
      </span>
    </span>
  )
}
