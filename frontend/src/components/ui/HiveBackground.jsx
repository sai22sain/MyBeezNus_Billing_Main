import React from 'react';

const HIVE_CONFIG = {
  patternWidth: 180,
  patternHeight: 208,
  hexagon: 'M90 12 L158 51 L158 129 L90 168 L22 129 L22 51 Z',
  patternOpacity: 0.42,
  glowOpacity: 0.7,
};

function HiveBackground() {
  return (
    <svg
      className="hive-background"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id="hive-hexagons"
          width={HIVE_CONFIG.patternWidth}
          height={HIVE_CONFIG.patternHeight}
          patternUnits="userSpaceOnUse"
          patternTransform="translate(52 -34) rotate(-8)"
        >
          <path
            d={HIVE_CONFIG.hexagon}
            fill="none"
            stroke="var(--hive-line)"
            strokeWidth="1.2"
            opacity={HIVE_CONFIG.patternOpacity}
          />
        </pattern>
        <linearGradient id="hive-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--hive-accent)" stopOpacity="0.05" />
          <stop offset="0.55" stopColor="var(--hive-accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--hive-line)" stopOpacity="0.035" />
        </linearGradient>
        <radialGradient id="hive-glow" cx="0.7" cy="0.18" r="0.72">
          <stop offset="0" stopColor="var(--hive-glow)" stopOpacity={HIVE_CONFIG.glowOpacity} />
          <stop offset="0.42" stopColor="var(--hive-glow)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--hive-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100%" height="100%" fill="url(#hive-wash)" />
      <rect width="100%" height="100%" fill="url(#hive-hexagons)" />
      <ellipse className="hive-glow" cx="1110" cy="150" rx="470" ry="350" fill="url(#hive-glow)" />

      <g className="hive-curves" fill="none" stroke="var(--hive-accent)" strokeLinecap="round">
        <path d="M-80 660 C220 500 310 760 550 590 S930 370 1130 520 S1350 760 1530 600" strokeWidth="2" opacity="0.09" />
        <path d="M-120 730 C170 580 300 820 510 680 S850 470 1050 600" strokeWidth="1" opacity="0.08" />
        <path d="M920 -70 C1020 80 1000 210 1150 260 S1350 250 1510 390" strokeWidth="1.5" opacity="0.08" />
      </g>

      <g className="hive-accents" fill="var(--hive-accent)">
        <circle cx="1160" cy="142" r="3" opacity="0.24" />
        <circle cx="1210" cy="190" r="1.8" opacity="0.18" />
        <circle cx="1010" cy="625" r="2.4" opacity="0.14" />
      </g>
    </svg>
  );
}

export default HiveBackground;
