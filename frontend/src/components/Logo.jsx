import React from 'react';

/**
 * Reusable app logo (tab / favicon bee).
 * Primary: /Bee_Tab_Icon.gif (animated)
 * Fallback: /Bee_Tab_Icon.jpeg (for browsers that don't support GIF favicons / animation)
 * Final fallback: scissors icon tile if files are missing.
 */
function Logo({ size = 38, radius = 10, className = '', style = {} }) {
  const [src, setSrc] = React.useState('/Bee_Tab_Icon.gif');

  if (src === null) {
    return (
      <div
        className={`app-logo-fallback ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.42,
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          ...style,
        }}
      >
        <i className="fas fa-cut"></i>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="MyBeezNus Billing logo"
      width={size}
      height={size}
      className={`app-logo ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: 'cover',
        flexShrink: 0,
        ...style,
      }}
      onError={() =>
        setSrc((prev) => (prev === '/Bee_Tab_Icon.gif' ? '/Bee_Tab_Icon.jpeg' : null))
      }
    />
  );
}

export default Logo;
