type OpenCrabMarkProps = {
  className?: string;
  title?: string;
};

type OpenCrabWordmarkProps = {
  className?: string;
};

export function OpenCrabMark({ className = "", title = "OpenCrab" }: OpenCrabMarkProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M25 42C14 35 13 20 23 13c9-7 24-5 31 3-3 11-8 19-16 25 8 1 15 7 17 15H37c-4 0-8-1-12-4Z"
        fill="#ff6548"
        stroke="#1e2f5d"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path
        d="M103 42c11-7 12-22 2-29-9-7-24-5-31 3 3 11 8 19 16 25-8 1-15 7-17 15h18c4 0 8-1 12-4Z"
        fill="#ff6548"
        stroke="#1e2f5d"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path d="M32 55c-7 2-11 6-13 13" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <path d="M96 55c7 2 11 6 13 13" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <ellipse cx="64" cy="70" rx="34" ry="25" fill="#ff6548" stroke="#1e2f5d" strokeWidth="5" />
      <path
        d="M39 76c6 10 14 15 25 15s19-5 25-15c-8 2-16 3-25 3s-17-1-25-3Z"
        fill="#fff1da"
      />
      <path d="M47 53c4-6 11-10 17-10s13 4 17 10" stroke="#ffb39b" strokeLinecap="round" strokeWidth="5" />
      <circle cx="51" cy="65" r="10" fill="#fff1da" stroke="#1e2f5d" strokeWidth="4" />
      <circle cx="77" cy="65" r="10" fill="#fff1da" stroke="#1e2f5d" strokeWidth="4" />
      <circle cx="53" cy="66" r="4" fill="#1e2f5d" />
      <circle cx="75" cy="66" r="4" fill="#1e2f5d" />
      <circle cx="56" cy="62" r="2" fill="#ffffff" />
      <circle cx="78" cy="62" r="2" fill="#ffffff" />
      <path d="M54 80c3 4 7 6 10 6s7-2 10-6" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="4.5" />
      <path d="M35 91 26 100" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <path d="M47 94 40 104" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <path d="M81 94 88 104" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <path d="M93 91 102 100" stroke="#1e2f5d" strokeLinecap="round" strokeWidth="5" />
      <path d="M28 36c2-4 5-6 9-7" stroke="#fff1da" strokeLinecap="round" strokeWidth="5" />
      <path d="M100 36c-2-4-5-6-9-7" stroke="#fff1da" strokeLinecap="round" strokeWidth="5" />
      <path d="M51 55c2-2 4-3 6-3" stroke="#ffffff" strokeLinecap="round" strokeWidth="3" />
      <path d="M75 55c2-2 4-3 6-3" stroke="#ffffff" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

export function OpenCrabWordmark({ className = "" }: OpenCrabWordmarkProps) {
  return (
    <span className={className}>
      <span className="text-text">Open</span>
      <span className="text-[#ff6548]">Crab</span>
    </span>
  );
}
