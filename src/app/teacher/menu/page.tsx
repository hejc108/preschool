'use client';

import React from 'react';
import { MonthlyMenuView } from '@/components/pwa/MonthlyMenuView';

export default function TeacherMenuPage() {
  return <MonthlyMenuView role="TEACHER" backHref="/teacher" />;
}
