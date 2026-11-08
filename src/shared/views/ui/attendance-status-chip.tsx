'use client';

import React from 'react';
import { UnifiedAttendanceStatus } from '@/shared/lib/attendance-presence';

interface AttendanceStatusChipProps {
  status: UnifiedAttendanceStatus | string;
  label?: string;
  timeLabel?: string;
  leaveType?: string;
  className?: string;
}

export function AttendanceStatusChip({
  status,
  label,
  timeLabel,
  leaveType,
  className = '',
}: AttendanceStatusChipProps) {
  const norm = (status || '').toLowerCase().replace(/\s+/g, '_');

  let badgeClasses = 'bg-slate-50 text-slate-700 border-slate-200';
  let dotClasses = 'bg-slate-400';
  let defaultLabel = 'Not present';

  switch (norm) {
    case 'in':
    case 'present':
      badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      dotClasses = 'bg-emerald-500';
      defaultLabel = 'Present';
      break;
    case 'on_break':
    case 'break':
      badgeClasses = 'bg-amber-50 text-amber-800 border-amber-300';
      dotClasses = 'bg-amber-500';
      defaultLabel = 'On break';
      break;
    case 'out':
      badgeClasses = 'bg-slate-100 text-slate-700 border-slate-300';
      dotClasses = 'bg-slate-400';
      defaultLabel = 'Out';
      break;
    case 'not_present':
    case 'not_in_yet':
    case 'not_in':
      badgeClasses = 'bg-slate-50 text-slate-600 border-slate-300';
      dotClasses = 'bg-slate-300';
      defaultLabel = 'Not present';
      break;
    case 'on_leave':
    case 'leave':
      badgeClasses = 'bg-blue-50 text-blue-800 border-blue-300';
      dotClasses = 'bg-blue-500';
      defaultLabel = leaveType ? `On leave · ${leaveType.replace(/_/g, ' ')}` : 'On leave';
      break;
    default:
      defaultLabel = 'Not present';
      break;
  }

  const displayLabel = label || defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border font-medium transition-colors ${badgeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses}`} />
      <span>{displayLabel}</span>
      {timeLabel && <span className="text-[10px] font-normal opacity-80">{timeLabel}</span>}
    </span>
  );
}
