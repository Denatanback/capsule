export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className}>
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#c4a0d0"/>
          <stop offset="100%" stopColor="#3d2b5a"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#logoBg)"/>
      <path d="M 180 260 L 180 340 C 180 388, 212 412, 256 412 C 300 412, 332 388, 332 340 L 332 260 C 320 268, 290 274, 256 274 C 222 274, 192 268, 180 260 Z" fill="white" opacity="0.92"/>
      <g transform="rotate(-18, 210, 220)">
        <path d="M 180 260 C 180 260, 192 268, 256 268 C 320 268, 332 260, 332 260 L 332 180 C 332 132, 300 108, 256 108 C 212 108, 180 132, 180 180 Z" fill="white" opacity="0.55"/>
      </g>
      <circle cx="230" cy="195" r="5" fill="white" opacity="0.7"/>
      <circle cx="270" cy="180" r="4" fill="white" opacity="0.5"/>
      <circle cx="250" cy="165" r="3" fill="white" opacity="0.4"/>
    </svg>
  );
}
