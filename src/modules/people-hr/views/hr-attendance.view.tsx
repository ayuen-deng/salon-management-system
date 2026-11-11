'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  Edit2,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
} from 'lucide-react';
import {
  getAttendanceRecordsAction,
  correctAttendanceAction,
  type HrAttendanceRecord,
  type HrPunctualitySummary,
  type HrWorkHoursPolicy,
  type HrLeaveBalance,
  getWorkHoursPolicyAction,
  getLeaveBalancesAction,
  saveWorkHoursPolicyAction,
} from '../controllers/hr.actions';
import { HrExportMenu } from './hr-export-menu';

export function HrAttendanceView() {
  const [records, setRecords] = useState<HrAttendanceRecord[]>([]);
  const [punctuality, setPunctuality] = useState<HrPunctualitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'working-hours'>('overview');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'three_months' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [workPolicy, setWorkPolicy] = useState<HrWorkHoursPolicy>({ standard_start: '08:00', standard_end: '17:00', late_grace_minutes: 15, early_departure_grace_minutes: 15, working_days: [1,2,3,4,5,6], role_overrides: {} });
  const [leaveBalances, setLeaveBalances] = useState<HrLeaveBalance[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Correction Modal
  const [correctingRecord, setCorrectingRecord] = useState<HrAttendanceRecord | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    clockIn: '',
    clockOut: '',
    absenceType: 'none' as 'none' | 'approved_leave' | 'unapproved_absence' | 'off_duty',
    reason: '',
  });

  const dateRange = useMemo(() => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' }));
    const stamp = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const end = stamp(today);
    if (period === 'custom') return { startDate: customStart || end, endDate: customEnd || end };
    if (period === 'today') return { startDate: end, endDate: end };
    if (period === 'week') { const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return { startDate: stamp(monday), endDate: end }; }
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    if (period === 'three_months') start.setMonth(start.getMonth() - 2);
    return { startDate: stamp(start), endDate: end };
  }, [period, customStart, customEnd]);

  const loadData = async () => {
    setLoading(true);
    const res = await getAttendanceRecordsAction({ ...dateRange, role: roleFilter !== 'all' ? roleFilter : undefined, staffUserId: staffFilter });
    if (res.success && res.data) {
      setRecords(res.data.records);
      setPunctuality(res.data.punctuality);
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to load attendance records.' });
    }
    setLoading(false);
  };

  const loadPolicy = async () => {
    const policyRes = await getWorkHoursPolicyAction();
    if (policyRes.success && policyRes.data) setWorkPolicy(policyRes.data);
  };
  const loadLeaveBalances = async () => {
    const balanceRes = await getLeaveBalancesAction();
    if (balanceRes.success && balanceRes.data) setLeaveBalances(balanceRes.data);
  };
  useSalonLiveRefresh(() => { if (activeTab === 'working-hours') void loadPolicy(); }, true, ['work_hours_policy']);
  useSalonLiveRefresh(() => { void loadLeaveBalances(); }, true, ['hr_leave_balance', 'leave_request', 'annual_leave_policy']);
  useSalonLiveRefresh(() => { void loadData(); }, true, ['attendance', 'app_user', 'rota_entry', 'business_day', 'work_hours_policy']);


  useEffect(() => {
    loadData();
    loadLeaveBalances();
  }, [roleFilter, period, customStart, customEnd, staffFilter]);

  useEffect(() => {
    if (activeTab === 'working-hours') void loadPolicy();
  }, [activeTab]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.business_date.includes(searchTerm);
      return matchSearch;
    });
  }, [records, searchTerm]);

  const filteredPunctuality = useMemo(() => {
    return punctuality.filter((p) => {
      return p.staff_name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [punctuality, searchTerm]);

  const savePolicy = async (event: React.FormEvent) => {
    event.preventDefault(); setSavingPolicy(true);
    const result = await saveWorkHoursPolicyAction(workPolicy);
    if (result.success) { setFeedback({ type: 'success', message: 'Working hours saved for future attendance days.' }); loadData(); loadPolicy(); }
    else setFeedback({ type: 'error', message: result.error?.message || 'Could not save working hours.' });
    setSavingPolicy(false);
  };

  const handleOpenCorrection = (record: HrAttendanceRecord) => {
    setCorrectingRecord(record);
    const timeInput = (value: string | null) => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '';
    setCorrectionForm({
      clockIn: timeInput(record.clock_in),
      clockOut: timeInput(record.clock_out),
      absenceType: record.absence_type,
      reason: '',
    });
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;

    let fullIn = correctingRecord.clock_in;
    if (correctionForm.clockIn) {
      fullIn = new Date(`${correctingRecord.business_date}T${correctionForm.clockIn}:00+03:00`).toISOString();
    }
    let fullOut = correctingRecord.clock_out;
    if (correctionForm.clockOut) {
      fullOut = new Date(`${correctingRecord.business_date}T${correctionForm.clockOut}:00+03:00`).toISOString();
    }

    const res = await correctAttendanceAction({
      attendanceId: correctingRecord.id,
      staffUserId: correctingRecord.staff_user_id,
      businessDate: correctingRecord.business_date,
      clockIn: fullIn,
      clockOut: fullOut,
      absenceType: correctionForm.absenceType,
      reason: correctionForm.reason,
    });

    if (res.success) {
      setFeedback({ type: 'success', message: `Attendance record corrected for ${correctingRecord.staff_name}.` });
      setCorrectingRecord(null);
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to correct attendance.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Timesheets, arrival punctuality metrics, and audit-logged supervisor corrections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HrExportMenu title="Attendance" filename="attendance" rows={filteredRecords} filters={`${period} · ${dateRange.startDate} to ${dateRange.endDate} · Search: ${searchTerm || 'all'} · Role: ${roleFilter} · Person: ${staffFilter === 'all' ? 'all' : records.find((record) => record.staff_user_id === staffFilter)?.staff_name || staffFilter}`} columns={[{ label: 'Staff', value: (r) => r.staff_name }, { label: 'Role', value: (r) => r.role }, { label: 'Date', value: (r) => r.business_date }, { label: 'Standard shift', value: (r) => `${r.standard_start}-${r.standard_end}` }, { label: 'Clock in', value: (r) => r.clock_in || '—' }, { label: 'Clock out', value: (r) => r.clock_out || '—' }, { label: 'Arrival offset', value: (r) => r.arrival_offset_minutes === null ? '—' : `${r.arrival_offset_minutes} min` }, { label: 'Hours worked', value: (r) => r.status === 'in_progress' ? 'In progress' : r.status === 'missed_clock_out' ? 'Missed clock-out' : r.total_hours ?? '—' }, { label: 'Break minutes', value: (r) => r.break_minutes || 0 }, { label: 'Status', value: (r) => r.status }, { label: 'Absence', value: (r) => r.absence_type }]} />
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Period, role, and person filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto">
            <button onClick={() => setActiveTab('overview')} className={`px-3 py-1 rounded-lg ${activeTab === 'overview' ? 'bg-white shadow-xs text-slate-900 font-bold' : ''}`}>Overview</button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'records' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'hover:text-slate-900'
              }`}
            >
              Daily Records ({filteredRecords.length})
            </button>
            <button
              onClick={() => setActiveTab('working-hours')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'working-hours' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'hover:text-slate-900'
              }`}
            >
              Working Hours
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select aria-label="Attendance period" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="three_months">Last 3 months</option><option value="custom">Custom</option>
          </select>
          {period === 'custom' && <><input aria-label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5"/><input aria-label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5"/></>}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search person or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
          >
            <option value="all">All Roles</option>
            <option value="staff">Staff</option>
            <option value="receptionist">Receptionist</option>
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
          </select>
          <select aria-label="Attendance person" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 max-w-40">
            <option value="all">All people</option>{Array.from(new Map(records.map((record) => [record.staff_user_id, record.staff_name])).entries()).map(([id,name]) => <option value={id} key={id}>{name}</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'overview' && <AttendanceOverview records={filteredRecords} balances={leaveBalances} loading={loading} />}
      {activeTab === 'working-hours' && <WorkingHoursPolicyForm policy={workPolicy} setPolicy={setWorkPolicy} saving={savingPolicy} onSave={savePolicy} />}

      {/* Tab 1: Daily Records Table */}
      {activeTab === 'records' && (
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold  tracking-normal text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Person & Role</th>
                    <th className="py-3 px-4">Standard</th>
                    <th className="py-3 px-4">First In</th>
                    <th className="py-3 px-4">Last Out</th>
                    <th className="py-3 px-4">Hours</th>
                    <th className="py-3 px-4">Arrival / departure</th>
                    <th className="py-3 px-4">Break</th>
                    <th className="py-3 px-4">Flags</th>
                    <th className="py-3 px-4">Absence / Correction</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">Loading attendance rows...</td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">No attendance logs found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const isHrSelf = r.role === 'hr';
                      return (
                        <tr key={`${r.staff_user_id}-${r.business_date}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 tabular-nums text-slate-700">{r.business_date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{r.staff_name}</div>
                            <span className="text-[10px]  font-semibold text-slate-400">{r.role}</span>
                          </td>
                          <td className="py-3 px-4 tabular-nums text-slate-600">{r.standard_start}–{r.standard_end}</td>
                          <td className="py-3 px-4 tabular-nums text-slate-700">
                            {r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 tabular-nums text-slate-700">
                            {r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-3 px-4 tabular-nums font-medium text-slate-900">
                            {r.status === 'in_progress' ? <span className="text-blue-700">In progress · {r.total_hours?.toFixed(1)}h</span> : r.status === 'missed_clock_out' ? <span className="text-rose-700">Missed clock-out</span> : r.total_hours === null ? '—' : `${r.total_hours.toFixed(1)}h`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1 text-[10px]">{r.arrival_offset_minutes !== null && r.arrival_offset_minutes !== undefined && <div className={r.is_late ? 'text-amber-800 font-semibold' : 'text-slate-600'}>{r.arrival_offset_minutes < 0 ? `${Math.abs(r.arrival_offset_minutes)}m early` : `${r.arrival_offset_minutes}m after start`}{r.is_late ? ` · Late ${r.late_minutes}m` : ' · within policy'}</div>}{r.departure_offset_minutes !== null && r.departure_offset_minutes !== undefined && <div className="text-slate-600">{r.early_departure_minutes ? `Early leave ${r.early_departure_minutes}m` : r.overtime_minutes ? `Overtime ${r.overtime_minutes}m` : 'Departure on schedule'}</div>}</div>
                          </td>
                          <td className="py-3 px-4 tabular-nums text-slate-600">{r.break_minutes || 0}m</td>
                          <td className="py-3 px-4"><div className="flex flex-wrap gap-1">{r.status === 'on_time' && <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5">On time</span>}{r.status === 'late' && <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5">Late</span>}{r.status === 'early_departure' && <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5">Early departure</span>}{r.status === 'overtime' && <span className="rounded-full bg-blue-50 text-blue-800 px-2 py-0.5">Overtime</span>}{r.status === 'missed_clock_out' && <span className="rounded-full bg-rose-50 text-rose-800 px-2 py-0.5">Missed clock-out</span>}{r.status === 'in_progress' && <span className="rounded-full bg-blue-50 text-blue-800 px-2 py-0.5">In progress</span>}{r.status === 'on_leave' && <span className="rounded-full bg-indigo-50 text-indigo-800 px-2 py-0.5">On leave</span>}{r.status === 'not_present' && <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">Not present</span>}</div></td>
                          <td className="py-3 px-4">
                            {r.absence_type !== 'none' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 ">
                                {r.absence_type.replace(/_/g, ' ')}
                              </span>
                            ) : r.corrected_by_name ? (
                              <span className="text-[11px] text-slate-600 block">
                                Corrected: {r.corrected_reason}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isHrSelf ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-[#1F4FD8] hover:text-[#E05910]"
                                onClick={() => handleOpenCorrection(r)}
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Correct
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Manager only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Punctuality Overview */}
      {activeTab === 'overview' && (
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
            <CardTitle className="text-sm font-bold text-slate-900">Workforce Punctuality Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold  tracking-normal text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Days Logged</th>
                    <th className="py-3 px-4">Late Arrivals</th>
                    <th className="py-3 px-4">Total Late Minutes</th>
                    <th className="py-3 px-4">Average Arrival</th>
                    <th className="py-3 px-4">Unapproved Absences</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPunctuality.map((p) => (
                    <tr key={p.staff_user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{p.staff_name}</td>
                      <td className="py-3 px-4  text-[10px] font-semibold text-slate-500">{p.role}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-700">{p.days_recorded}</td>
                      <td className="py-3 px-4 tabular-nums">
                        <span className={p.late_count > 0 ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                          {p.late_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-700">{p.total_late_minutes}m</td>
                      <td className="py-3 px-4 tabular-nums font-medium text-slate-900">{p.average_arrival}</td>
                      <td className="py-3 px-4 tabular-nums">
                        <span className={p.absences_count > 0 ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                          {p.absences_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CORRECTION MODAL */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance Correction</h3>
                <span className="text-[11px] text-slate-500">
                  {correctingRecord.staff_name} • {correctingRecord.business_date}
                </span>
              </div>
              <button onClick={() => setCorrectingRecord(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clock In Time</label>
                  <input
                    type="time"
                    value={correctionForm.clockIn}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clockIn: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clock Out Time</label>
                  <input
                    type="time"
                    value={correctionForm.clockOut}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, clockOut: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Absence Classification</label>
                <select
                  value={correctionForm.absenceType}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, absenceType: e.target.value as any })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                >
                  <option value="none">Normal Shift / Present</option>
                  <option value="approved_leave">Approved Leave</option>
                  <option value="unapproved_absence">Unapproved Absence</option>
                  <option value="off_duty">Off Duty / Scheduled Rest</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason Code / Explanation (Mandatory)</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Verified late clock-in due to hardware reconnect..."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Do not enter medical details. This correction will be logged in the Owner&apos;s &ldquo;For your review&rdquo; feed.
                </span>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCorrectingRecord(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#E05910] text-white font-semibold">
                  Record Correction
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="p-4 border-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900 mt-1">{value}</p><p className="text-[11px] text-slate-500 mt-1">{detail}</p></Card>;
}

function AttendanceBars({ title, rows, valueLabel, secondaryLabel = 'late' }: { title: string; rows: { label: string; value: number; secondary?: number; valueText?: string }[]; valueLabel?: string; secondaryLabel?: string }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.value, row.secondary || 0)));
  return <Card className="p-4 border-slate-200 min-w-0"><h3 className="font-semibold text-sm text-slate-900 mb-3">{title}</h3><div className="space-y-3">{rows.length ? rows.map((row) => <div key={row.label} className="space-y-1"><div className="flex justify-between gap-3 text-[11px]"><span className="truncate text-slate-600">{row.label}</span><span className="shrink-0 tabular-nums text-slate-700">{row.valueText ?? `${row.value}${valueLabel || ''}`}{row.secondary !== undefined ? ` · ${row.secondary} ${secondaryLabel}` : ''}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(2, row.value / max * 100))}%` }} /></div>{row.secondary !== undefined && <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(row.secondary ? 2 : 0, row.secondary / max * 100))}%` }} /></div>}</div>) : <p className="text-xs text-slate-500 py-3">No attendance data for this period.</p>}</div></Card>;
}

function AttendanceOverview({ records, balances, loading }: { records: HrAttendanceRecord[]; balances: HrLeaveBalance[]; loading: boolean }) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const present = records.filter((row) => row.clock_in);
  const onTime = present.filter((row) => !row.is_late).length;
  const punctuality = present.length ? Math.round(onTime / present.length * 100) : 0;
  const arrival = present.map((row) => row.arrival_offset_minutes || 0);
  const avgArrival = arrival.length ? Math.round(arrival.reduce((a,b) => a+b,0) / arrival.length) : null;
  const closedHours = records.map((row) => row.total_hours).filter((value): value is number => value !== null);
  const avgHours = closedHours.length ? closedHours.reduce((a,b) => a+b,0) / closedHours.length : null;
  const overtime = records.reduce((sum,row) => sum + (row.overtime_minutes || 0),0);
  const missed = records.filter((row) => row.status === 'missed_clock_out').length;
  const unapproved = records.filter((row) => row.absence_type === 'unapproved_absence' || row.status === 'not_present').length;
  const weekly = new Map<string,{onTime:number;late:number}>();
  records.forEach((row) => { if (row.status !== 'on_time' && row.status !== 'late') return; const d = new Date(`${row.business_date}T12:00:00+03:00`); d.setDate(d.getDate() - ((d.getDay()+6)%7)); const key = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'Africa/Kampala'}); const v=weekly.get(key)||{onTime:0,late:0}; row.is_late ? v.late++ : v.onTime++; weekly.set(key,v); });
  const people = new Map<string,HrAttendanceRecord[]>(); records.forEach((row) => people.set(row.staff_user_id,[...(people.get(row.staff_user_id)||[]),row]));
  const byPerson = Array.from(people,([id,rows]) => ({ id,label:rows[0].staff_name,rows }));
  const arrivalBars = byPerson.map(({label,rows}) => { const values=rows.filter((r)=>r.clock_in).map((r)=>r.arrival_offset_minutes||0); const mean=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null; return {label,value:mean === null ? 0 : Math.abs(mean),valueText:mean===null?'No check-ins':`${mean>0?'+':''}${mean} min vs start`}; });
  const hoursBars = byPerson.map(({label,rows}) => { const worked=rows.reduce((sum,r)=>sum+(r.total_hours||0),0); const expected=rows.filter((r)=>r.is_rota_workday && r.status!=='on_leave').reduce((sum,r)=>sum+Math.max(0,(Number((r.standard_end||'17:00').slice(0,2))*60+Number((r.standard_end||'17:00').slice(3,5))-(Number((r.standard_start||'08:00').slice(0,2))*60+Number((r.standard_start||'08:00').slice(3,5))))/60),0); return {label,value:worked,secondary:expected,valueText:`${worked.toFixed(1)} / ${expected.toFixed(1)}h expected`}; });
  const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; const lateWeek=weekdays.map((label,index)=>({label,value:records.filter((r)=>r.is_late && new Date(`${r.business_date}T12:00:00+03:00`).getDay()===index).length}));
  const leaveBars=balances.map((balance)=>({label:balance.staff_name,value:balance.days_taken+balance.days_approved_upcoming,secondary:balance.entitlement_days ?? undefined,valueText:balance.entitlement_days===null?`${balance.days_taken+balance.days_approved_upcoming} approved · entitlement not configured`:`${balance.days_taken+balance.days_approved_upcoming} approved / ${balance.entitlement_days} days`}));
  const attention = records.filter((row) => ['missed_clock_out','unapproved_absence','not_present'].includes(row.status || '')).slice(0, 12);
  const selectedRows = selectedPerson ? records.filter((row) => row.staff_user_id === selectedPerson) : [];
  return <div className="space-y-4">
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">{loading ? Array.from({length:6}).map((_,i)=><div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100"/>):<><AttendanceMetric label="Punctuality" value={`${punctuality}%`} detail={`${onTime} on-time / ${present.length} present days`}/><AttendanceMetric label="Avg arrival offset" value={avgArrival===null?'—':`${avgArrival>0?'+':''}${avgArrival}m`} detail="Against the scheduled start"/><AttendanceMetric label="Avg completed hours" value={avgHours===null?'—':`${avgHours.toFixed(1)}h`} detail="Open shifts are shown separately"/><AttendanceMetric label="Overtime" value={`${Math.round(overtime/60)}h ${overtime%60}m`} detail="Clock-out after scheduled end"/><AttendanceMetric label="Missed clock-outs" value={String(missed)} detail="Past shifts with no clock-out"/><AttendanceMetric label="Unapproved absences" value={String(unapproved)} detail="Scheduled days without attendance"/></>}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><AttendanceBars title="On-time versus late days per week" rows={Array.from(weekly,([label,v])=>({label,value:v.onTime,secondary:v.late}))} valueLabel=" on time" secondaryLabel="late"/><AttendanceBars title="Average arrival against standard, by person" rows={arrivalBars} valueLabel=" min"/><AttendanceBars title="Hours worked against expected, by person" rows={hoursBars} valueLabel="h" secondaryLabel="expected"/><AttendanceBars title="Late arrivals by weekday" rows={lateWeek} valueLabel=" days"/><AttendanceBars title="Leave days used against entitlement" rows={leaveBars} valueLabel=" days" secondaryLabel="entitlement"/></div>
    <Card className="p-4 border-slate-200"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-sm text-slate-900">Needs attention</h3><p className="text-xs text-slate-500 mt-1">Missed clock-outs and absent scheduled workdays in this period.</p></div><span className="text-xs text-slate-500">{attention.length} shown</span></div><div className="mt-3 divide-y divide-slate-100">{attention.length ? attention.map((row)=><button key={`${row.staff_user_id}-${row.business_date}`} onClick={()=>setSelectedPerson(row.staff_user_id)} className="w-full flex flex-wrap justify-between gap-2 py-2 text-left text-sm hover:bg-slate-50"><span className="font-medium text-slate-800">{row.staff_name}<span className="ml-2 text-xs font-normal text-slate-500">{row.business_date}</span></span><span className="text-xs text-amber-700">{row.status?.replaceAll('_',' ')}</span></button>):<p className="py-4 text-sm text-slate-500">No attendance items need attention in this period.</p>}</div></Card>
    {selectedPerson && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Staff attendance details"><Card className="w-full max-w-lg p-5"><div className="flex justify-between gap-4"><div><h3 className="font-semibold">{selectedRows[0]?.staff_name || 'Staff attendance'}</h3><p className="text-xs text-slate-500">Attendance details for the selected period</p></div><Button variant="outline" size="sm" onClick={()=>setSelectedPerson(null)}>Close</Button></div><div className="mt-4 max-h-[60vh] overflow-y-auto divide-y">{selectedRows.map((row)=><div key={row.business_date} className="flex justify-between gap-3 py-2 text-sm"><span>{row.business_date}<span className="block text-xs text-slate-500">{row.clock_in?new Date(row.clock_in).toLocaleTimeString('en-GB',{timeZone:'Africa/Kampala',hour:'2-digit',minute:'2-digit'}):'No clock-in'}{row.clock_out?` – ${new Date(row.clock_out).toLocaleTimeString('en-GB',{timeZone:'Africa/Kampala',hour:'2-digit',minute:'2-digit'})}`:''}</span></span><span className="text-right">{row.total_hours===null?'—':`${row.total_hours.toFixed(1)}h`}<span className="block text-xs text-slate-500">{row.status?.replaceAll('_',' ')}</span></span></div>)}</div></Card></div>}
    {balances.some((balance)=>balance.entitlement_days===null) && <p className="text-xs text-slate-600 rounded-lg bg-blue-50 border border-blue-100 p-3">Annual leave entitlement has not been configured for every role. HR should set it after owner review; no legal entitlement has been assumed.</p>}
  </div>;
}

function WorkingHoursPolicyForm({ policy, setPolicy, saving, onSave }: { policy: HrWorkHoursPolicy; setPolicy: React.Dispatch<React.SetStateAction<HrWorkHoursPolicy>>; saving: boolean; onSave: (event: React.FormEvent) => void }) {
  const days=[['Monday',1],['Tuesday',2],['Wednesday',3],['Thursday',4],['Friday',5],['Saturday',6],['Sunday',0]] as const;
  const roles=['staff','receptionist','manager','hr'] as const;
  const updateRoleOverride=(role:typeof roles[number],key:string,value:string|number)=>setPolicy((current)=>({...current,role_overrides:{...current.role_overrides,[role]:{...(current.role_overrides[role]||{}),[key]:value}}}));
  return <Card className="p-5 border-slate-200"><div className="mb-4"><h3 className="font-semibold text-base">Working hours policy</h3><p className="text-xs text-slate-500 mt-1">Rota shifts override these defaults. A policy change applies from today forward; clock-in days retain their captured policy.</p></div><form onSubmit={onSave} className="space-y-5">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Standard arrival','standard_start'],['Standard departure','standard_end']].map(([label,key])=><label key={key} className="text-xs text-slate-600">{label}<input type="time" value={policy[key as 'standard_start'|'standard_end']} onChange={(e)=>setPolicy((current)=>({...current,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" required/></label>)}<label className="text-xs text-slate-600">Late grace (minutes)<input type="number" min="0" max="240" value={policy.late_grace_minutes} onChange={(e)=>setPolicy((current)=>({...current,late_grace_minutes:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/></label><label className="text-xs text-slate-600">Early departure grace (minutes)<input type="number" min="0" max="240" value={policy.early_departure_grace_minutes} onChange={(e)=>setPolicy((current)=>({...current,early_departure_grace_minutes:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"/></label></div>
    <fieldset><legend className="text-xs font-semibold mb-2">Working days</legend><div className="flex flex-wrap gap-3">{days.map(([label,value])=><label key={value} className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={policy.working_days.includes(value)} onChange={(event)=>setPolicy((current)=>({...current,working_days:event.target.checked?Array.from(new Set([...current.working_days,value])):current.working_days.filter((day)=>day!==value)}))}/>{label}</label>)}</div></fieldset>
    <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-xs font-semibold">Role overrides (optional)</legend><div className="space-y-3">{roles.map((role)=>{const values=policy.role_overrides[role]||{};return <div key={role} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end"><p className="col-span-2 md:col-span-1 text-xs font-semibold capitalize">{role}</p><label className="text-[11px] text-slate-600">Arrival<input type="time" value={String(values.standard_start||'')} onChange={(e)=>updateRoleOverride(role,'standard_start',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"/></label><label className="text-[11px] text-slate-600">Departure<input type="time" value={String(values.standard_end||'')} onChange={(e)=>updateRoleOverride(role,'standard_end',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"/></label><label className="text-[11px] text-slate-600">Late grace<input type="number" min="0" max="240" value={values.late_grace_minutes===undefined?'':Number(values.late_grace_minutes)} onChange={(e)=>updateRoleOverride(role,'late_grace_minutes',e.target.value===''?'':Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"/></label><label className="text-[11px] text-slate-600">Early grace<input type="number" min="0" max="240" value={values.early_departure_grace_minutes===undefined?'':Number(values.early_departure_grace_minutes)} onChange={(e)=>updateRoleOverride(role,'early_departure_grace_minutes',e.target.value===''?'':Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"/></label></div>})}</div><p className="mt-2 text-[11px] text-slate-500">Blank values inherit the location policy. Rota start/end still takes precedence.</p></fieldset>
    <div className="flex justify-end"><Button type="submit" disabled={saving||policy.working_days.length===0}>{saving?'Saving…':'Save working hours'}</Button></div>
  </form></Card>;
}
