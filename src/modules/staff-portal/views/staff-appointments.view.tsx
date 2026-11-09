'use client';

import React, { useState, useEffect } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { getStaffQueueAction, type StaffAppointmentItem } from '../controllers/staff.actions';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';

export function StaffAppointmentsView() {
  const [appointments, setAppointments] = useState<StaffAppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAppointments() {
    const res = await getStaffQueueAction();
    if (res.success && res.data) setAppointments(res.data.todayAppointments || []);
    setLoading(false);
  }

  useSalonLiveRefresh(() => { void loadAppointments(); }, true, ['appointment', 'customer', 'service']);

  useEffect(() => {
    void loadAppointments();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-6 space-y-4 font-sans">
      <div>
        <h2 className="text-xl  font-bold text-[#1F2328]">Assigned Appointments</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Clients booked specifically with you or scheduled for today.
        </p>
      </div>

      {loading ? (
        <Card className="border border-[#CBD5E1]">
          <CardContent className="p-8 text-center text-xs text-muted-foreground">Loading bookings...</CardContent>
        </Card>
      ) : appointments.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-white rounded-2xl border border-[#CBD5E1] p-6">
          <div className="w-12 h-12 rounded-full bg-[#1F4FD8]/10 text-[#1F4FD8] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-[#1F2328]">No Booked Appointments</p>
          <p className="text-xs text-muted-foreground">You have no upcoming client appointments assigned today.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {appointments.map((appt) => {
            const apptDate = new Date(appt.startsAt);
            const timeStr = apptDate.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
            const dateStr = apptDate.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
            const isCompleted = appt.status === 'completed';

            return (
              <div
                key={appt.id}
                className="p-4 rounded-2xl bg-white border border-[#CBD5E1] shadow-2xs flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1F2328] text-sm">{appt.customerFirstName}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {dateStr} • {timeStr}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {appt.serviceName} (~{appt.expectedMinutes} mins)
                  </div>
                </div>
                <div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : appt.late
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-[#1F4FD8]/15 text-[#1F4FD8]'
                    }`}
                  >
                    {isCompleted ? 'Finished' : appt.late ? 'Late' : 'Booked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
