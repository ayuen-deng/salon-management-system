'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getAppointmentsAction,
  createAppointmentAction,
  checkInAppointmentAction,
  getCatalogueAction,
  getStaffListAction,
  type ManagerAppointmentItem,
} from '../controllers/manager-nav.actions';
import { Calendar, Clock, User, Scissors, CheckCircle, AlertCircle, Plus, X } from 'lucide-react';
import { formatUgx } from '@/shared/models/money';

export function ManagerAppointmentsView() {
  const [appointments, setAppointments] = useState<ManagerAppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Appointment modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newServiceId, setNewServiceId] = useState('');
  const [newStylistId, setNewStylistId] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newExpectedMinutes, setNewExpectedMinutes] = useState(45);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadAppointments = async () => {
    setLoading(true);
    const res = await getAppointmentsAction();
    if (res.success && res.data) {
      setAppointments(res.data);
    }
    setLoading(false);
  };

  const loadOptions = async () => {
    const [catRes, staffRes] = await Promise.all([getCatalogueAction(), getStaffListAction()]);
    if (catRes.success && catRes.data) setServices(catRes.data);
    if (staffRes.success && staffRes.data) setStaffList(staffRes.data);
  };

  useSalonLiveRefresh(() => { void loadAppointments(); }, true, ['appointment', 'customer', 'service', 'app_user']);
  useSalonLiveRefresh(() => { void loadOptions(); }, true, ['service', 'service_variant', 'app_user', 'staff_skill', 'app_setting', 'visit_service']);


  useEffect(() => {
    loadAppointments();
    loadOptions();
  }, []);

  const handleCheckIn = async (id: string) => {
    setCheckingInId(id);
    const res = await checkInAppointmentAction(id);
    if (res.success && res.data) {
      setFeedback(`Checked in successfully! Created ticket ${res.data.ticket_code}`);
      loadAppointments();
    } else {
      showToast(`Error checking in: ${res.error || 'Failed'}`);
    }
    setCheckingInId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setCreateError('Please provide client name and phone number.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    const startsAtIso = new Date(`${newDate}T${newTime}:00`).toISOString();
    const res = await createAppointmentAction({
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      serviceId: newServiceId,
      stylistId: newStylistId || undefined,
      startsAt: startsAtIso,
      expectedMinutes: Number(newExpectedMinutes),
    });
    if (res.success) {
      setShowCreateModal(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setFeedback('Appointment booked successfully!');
      loadAppointments();
    } else {
      setCreateError(res.error || 'Failed to create appointment');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Appointments Schedule</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Advance bookings schedule, arrival status, and convert to queue tickets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadAppointments} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-300">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>Book New Appointment</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Christine"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number (07...)</label>
                  <input
                    type="tel"
                    required
                    placeholder="0771234567"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Service</label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  {services.map((srv: any) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Preferred Stylist (Optional)</label>
                <select
                  value={newStylistId}
                  onChange={(e) => setNewStylistId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="">Any Available Stylist</option>
                  {staffList.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.display_name || st.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={newExpectedMinutes}
                    onChange={(e) => setNewExpectedMinutes(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                >
                  {creating ? 'Booking...' : 'Confirm Appointment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Booked Appointments ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading appointment bookings...</div>
          ) : appointments.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No appointments booked for today.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {appointments.map((appt) => {
                const timeStr = new Date(appt.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isBooked = appt.status === 'booked';

                return (
                  <div key={appt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {timeStr}
                        </span>
                        <span className="text-xs text-muted-foreground">({appt.expected_minutes} min)</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full  ${
                          appt.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appt.late
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {appt.status} {appt.late && '• LATE'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-700">
                        <span className="flex items-center gap-1 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {appt.customer_name} ({appt.customer_phone})
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Scissors className="w-3.5 h-3.5" />
                          {appt.service_name} • Stylist: {appt.staff_name}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isBooked ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8"
                          onClick={() => handleCheckIn(appt.id)}
                          disabled={checkingInId === appt.id}
                        >
                          {checkingInId === appt.id ? 'Checking In...' : 'Check In Customer'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Checked into queue</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
