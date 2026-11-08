import { describe, it, expect } from 'vitest';
import { getAttendanceStatusLabel, UnifiedAttendanceStatus } from './attendance-presence';

describe('shared attendance snapshot labels', () => {
  const allowedStatuses: UnifiedAttendanceStatus[] = ['present', 'on_break', 'out', 'not_present', 'on_leave'];

  it.each([
    ['present', 'Present'],
    ['on_break', 'On break'],
    ['out', 'Out'],
    ['not_present', 'Not present'],
    ['on_leave', 'On leave'],
  ] as const)('labels %s consistently', (status, label) => {
    expect(getAttendanceStatusLabel(status)).toBe(label);
  });

  it('shows the leave type on leave status', () => {
    expect(getAttendanceStatusLabel('on_leave', 'approved_leave')).toBe('On leave · approved leave');
  });

  it('never puts punctuality statuses in a snapshot', () => {
    const labels = allowedStatuses.map((status) => getAttendanceStatusLabel(status));
    expect(labels.join(' ')).not.toMatch(/Late|Absent|Not in yet/);
  });
});
