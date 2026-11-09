'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getAppointmentsAction,
  createAppointmentAction,
  convertAppointmentToVisitAction,
  markAppointmentLateAction,
  cancelAppointmentAction,
  requestManagerApprovalAction,
} from '../controllers/reception.actions';
import { Calendar, Clock, AlertTriangle, CheckCircle2, User, Scissors, ShieldAlert, ArrowRight, Plus, X } from 'lucide-react';

export function ReceptionAppointmentsView() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stylists, setStylists] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // New Appointment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newServiceId, setNewServiceId] = useState('');
  const [newStylistId, setNewStylistId] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newExpectedMinutes, setNewExpectedMinutes] = useState(45);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Conversion / Late request modal
  const [lateEscalationModal, setLateEscalationModal] = useState<{
    appointmentId: string;
    customerName: string;
    diffMinutes: number;
  } | null>(null);
  const [escalationReason, setEscalationReason] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await getAppointmentsAction();
    if (res.success) {
      setAppointments(res.data.appointments);
      setStylists(res.data.stylists);
      if ((res.data as any).services) {
        setServices((res.data as any).services);
        if (!newServiceId && (res.data as any).services.length > 0) {
          setNewServiceId((res.data as any).services[0].id);
        }
      }
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadData(); }, true, ['appointment', 'app_user', 'service', 'customer']);


  async function handleCreateAppointment(e: React.FormEvent) {
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
      await loadData();
    } else {
      setCreateError(res.error?.message || 'Failed to create appointment');
    }
    setCreating(false);
  }

  async function handleArrived(app: any) {
    const res = await convertAppointmentToVisitAction(app.id);
    if (res.success) {
      showToast(`Appointment converted to Visit! Ticket #${res.data.ticket_code} issued.`);
      await loadData();
    } else {
      if (res.error?.code === 'FORBIDDEN') {
        const appointmentStart = new Date(app.starts_at).getTime();
        const diffMinutes = Math.floor((Date.now() - appointmentStart) / 60000);
        setLateEscalationModal({
          appointmentId: app.id,
          customerName: app.customer_name,
          diffMinutes,
        });
      } else {
        showToast(res.error?.message || 'Failed to convert appointment.');
      }
    }
  }

  async function handleSendLateRequest() {
    if (!lateEscalationModal) return;
    await requestManagerApprovalAction({
      kind: 'late_appointment_conversion',
      reason: escalationReason || `Customer arrived ${lateEscalationModal.diffMinutes}m late. Convert to walk-in.`,
      details: {
        appointment_id: lateEscalationModal.appointmentId,
        diff_minutes: lateEscalationModal.diffMinutes,
      },
    });
    showToast('Late arrival escalation submitted to manager Approvals inbox.');
    setLateEscalationModal(null);
    setEscalationReason('');
    await loadData();
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Appointment Schedule Grid</h2>
          <p className="text-xs text-muted-foreground">
            Strict 15-minute grace period enforcement • Converted walk-ins enter live queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment</span>
          </Button>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            15m Grace Active
          </span>
        </div>
      </div>

      {/* Book Appointment Modal */}
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
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="space-y-4">
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
                  {services.map((srv) => (
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
                  {stylists.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
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

      {/* Appointment Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-white">
            No appointments booked for today.
          </div>
        ) : (
          appointments.map((a) => {
            const appointmentTime = new Date(a.starts_at);
            const nowTime = Date.now();
            const diffMinutes = Math.floor((nowTime - appointmentTime.getTime()) / 60000);
            const isPastGrace = diffMinutes > 15;
            const isCompleted = a.status === 'completed';

            return (
              <Card key={a.id} className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">{a.customer_name}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{a.customer_phone}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPastGrace
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isCompleted ? 'Converted ✓' : isPastGrace ? 'Past Grace (>15m)' : 'Booked'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Start Time:
                    </span>
                    <span className="font-bold text-slate-900">
                      {appointmentTime.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5" /> Service:
                    </span>
                    <span className="font-semibold">{a.service_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Stylist:
                    </span>
                    <span className="font-semibold">{a.stylist_name}</span>
                  </div>
                </div>

                {/* Actions */}
                {!isCompleted && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => cancelAppointmentAction(a.id, 'Client cancelled by phone')}
                      className="text-xs text-slate-400 hover:text-rose-600 font-semibold"
                    >
                      Cancel
                    </button>
                    {isPastGrace ? (
                      <Button
                        size="sm"
                        onClick={() => handleArrived(a)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Request Manager
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleArrived(a)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Arrived
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* LATE ARRIVAL ESCALATION MODAL */}
      {lateEscalationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Late Arrival Exceeds Grace Period</h3>
            </div>
            <p className="text-xs text-slate-600">
              Guest <span className="font-bold">{lateEscalationModal.customerName}</span> arrived{' '}
              <span className="font-bold text-rose-600">{lateEscalationModal.diffMinutes} minutes</span> after scheduled start.
              Per PDF rules, receptionists cannot slot in appointments past the 15-minute grace period. Requesting approval
              will allow the manager to convert them to a walk-in.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Explanation for Manager</label>
              <textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-xs"
                placeholder="e.g. Traffic delay; client agreed to wait in lounge"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setLateEscalationModal(null)}>
                Dismiss
              </Button>
              <Button size="sm" onClick={handleSendLateRequest} className="bg-amber-600 text-white font-bold">
                Submit Escalation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
