'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

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

