import React from 'react';

/** Marca da aplicação: monograma simples na cor de destaque. */
export const BrandMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const dims = { sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-lg' }[size];
  return (
    <div
      className={`${dims} rounded-xl bg-accent-600 text-on-accent flex items-center justify-center font-semibold tracking-tight shrink-0`}
      aria-hidden="true"
    >
      OL
    </div>
  );
};
