export function BaoLogo({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="Bao Message logo — a steamed bun with a speech-bubble steam curl"
    >
      {/* steam curl as a tiny speech bubble */}
      <path
        d="M60 14c6-4 14-2 16 3 2 5-2 10-8 10h-9c-2 0-3-2-2-4 1-3 1-6 3-9Z"
        fill="#F2EDE6"
        stroke="#8A8A8A"
        strokeWidth="2"
      />
      <path d="M62 27l-4 6 9-2" fill="#F2EDE6" />
      {/* bun body */}
      <path
        d="M14 66c0-20 15-34 34-34s34 14 34 34c0 6-4 10-10 10H24c-6 0-10-4-10-10Z"
        fill="#FFD6A5"
        stroke="#2B2B2B"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* three pleats */}
      <path
        d="M40 33c2 5 2 9 0 13M48 32v14M56 33c-2 5-2 9 0 13"
        stroke="#2B2B2B"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* face */}
      <circle cx="38" cy="60" r="2.4" fill="#2B2B2B" />
      <circle cx="58" cy="60" r="2.4" fill="#2B2B2B" />
      <path
        d="M44 66c2.5 2.5 5.5 2.5 8 0"
        stroke="#2B2B2B"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
