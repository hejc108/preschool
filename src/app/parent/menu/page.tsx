'use client';

import React from 'react';
import { MonthlyMenuView } from '@/components/pwa/MonthlyMenuView';

export default function ParentMenuPage() {
  return <MonthlyMenuView role="PARENT" backHref="/parent" />;
}
