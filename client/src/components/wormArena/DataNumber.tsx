import React from 'react';

export default function DataNumber({
  children,
  size = 'xl',
}: {
  children: React.ReactNode;
  size?: 'lg' | 'xl';
}) {
  const sizeClass = size === 'xl' ? 'text-3xl' : 'text-xl';

  return (
    <span className={`worm-pill-green px-2.5 py-0.5 ${sizeClass}`}>
      {children}
    </span>
  );
}
