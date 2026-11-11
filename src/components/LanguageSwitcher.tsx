'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  if (compact) {
    return (
      <div className="inline-flex items-center bg-white/15 backdrop-blur-sm p-0.5 rounded-full border border-white/25 text-[10px] font-bold shrink-0">
        <button
          type="button"
          onClick={() => setLanguage('vi')}
          className={`px-1.5 py-1 rounded-full leading-none transition-colors cursor-pointer ${
            language === 'vi'
              ? 'bg-white text-slate-900 font-extrabold shadow-xs'
              : 'text-white/80 hover:text-white'
          }`}
        >
          VI
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-1.5 py-1 rounded-full leading-none transition-colors cursor-pointer ${
            language === 'en'
              ? 'bg-white text-slate-900 font-extrabold shadow-xs'
              : 'text-white/80 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center bg-slate-100 p-1 rounded-pill border border-slate-200 text-xs font-bold shadow-sm shrink-0">
      <button
        onClick={() => setLanguage('vi')}
        className={`px-2.5 py-1 rounded-pill transition-all flex items-center gap-1 ${
          language === 'vi'
            ? 'bg-primary-700 text-white shadow-sm font-extrabold'
            : 'text-slate-600 hover:text-primary-800'
        }`}
      >
        <span>🇻🇳</span>
        <span>VI</span>
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-pill transition-all flex items-center gap-1 ${
          language === 'en'
            ? 'bg-primary-700 text-white shadow-sm font-extrabold'
            : 'text-slate-600 hover:text-primary-800'
        }`}
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}

export default LanguageSwitcher;

