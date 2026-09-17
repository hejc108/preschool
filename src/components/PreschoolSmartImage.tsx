'use client';

import React, { useState, useEffect } from 'react';

interface PreschoolSmartImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  topic?: string;
  icon?: string;
}

export const PreschoolSmartImage: React.FC<PreschoolSmartImageProps> = ({
  src,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  topic = 'Bài Học Trải Nghiệm',
  icon = '🎨'
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [errorLevel, setErrorLevel] = useState<number>(0); // 0: primary, 1: fallback, 2: svg placeholder
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setCurrentSrc(src);
    setErrorLevel(0);
    setLoading(true);
  }, [src]);

  const handleError = () => {
    if (errorLevel === 0 && fallbackSrc) {
      setErrorLevel(1);
      setCurrentSrc(fallbackSrc);
    } else {
      setErrorLevel(2); // Fallback to Tier-3 SVG Placeholder UI
      setLoading(false);
    }
  };

  const handleLoad = () => {
    setLoading(false);
  };

  // Tier 3: High-quality SVG Graphic Placeholder UI (Offline & Fail-safe)
  if (errorLevel === 2 || !currentSrc) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg border-4 border-white ${className}`}>
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        {/* Animated Badge & Icon */}
        <div className="relative z-10 space-y-3 flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-3xl sm:text-4xl shadow-inner border border-white/30 animate-bounce">
            {icon}
          </div>
          
          <div className="space-y-1 max-w-xs">
            <span className="inline-block bg-amber-400 text-amber-950 font-black text-[10px] sm:text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              Trực Quan Mầm Non Sương Mai
            </span>
            <h4 className="font-extrabold text-sm sm:text-base line-clamp-2 drop-shadow-sm text-white">
              {topic}
            </h4>
            <p className="text-[11px] text-emerald-100 font-medium line-clamp-1">
              {alt}
            </p>
          </div>
        </div>

        {/* Bottom Sparkle Badge */}
        <div className="absolute bottom-3 right-3 text-xs opacity-70">
          ✨ Sương Mai Educational Visual
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      {/* Loading Pulse Skeleton */}
      {loading && (
        <div className="absolute inset-0 bg-emerald-100/80 backdrop-blur-sm animate-pulse flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-emerald-800">Đang tạo hình ảnh...</span>
        </div>
      )}

      <img
        src={currentSrc}
        alt={alt}
        className={`${className} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
