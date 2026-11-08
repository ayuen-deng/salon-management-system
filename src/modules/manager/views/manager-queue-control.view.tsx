'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  getQueueBoardAction,
  reassignLineAction,
  startOutOfOrderAction,
  removeStartedLineAction,
  markStylistUnavailableAction,
} from '../controllers/manager-nav.actions';
import { QueueBoardData, QueueLineCard, StylistColumn } from '../models/manager-operations.repository';
import {
  Users,
  Scissors,
  Clock,
  AlertTriangle,
  Flame,
  ArrowRight,
  UserCheck,
  UserX,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export function ManagerQueueControlView() {
  const [board, setBoard] = useState<QueueBoardData>({ pool_lines: [], stylists: [] });
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<QueueLineCard | null>(null);
  const [modalAction, setModalAction] = useState<'reassign' | 'start' | 'remove' | 'unavailable' | null>(null);
  const [targetStylistId, setTargetStylistId] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('manager_balance');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBoard();
  }, []);

  async function loadBoard() {
    setLoading(true);
    const res = await getQueueBoardAction();
    if (res.success) {
      setBoard(res.data);
    }
    setLoading(false);
  }
  useSalonLiveRefresh(() => { void loadBoard(); });


  async function handleConfirmAction() {
    if (submitting) return;
    setSubmitting(true);

    if (modalAction === 'reassign' && selectedLine) {
      const staffTarget = targetStylistId === 'pool' ? null : targetStylistId;
      await reassignLineAction(selectedLine.line_id, staffTarget, reasonCode);
    } else if (modalAction === 'start' && selectedLine && targetStylistId) {
      await startOutOfOrderAction(selectedLine.line_id, targetStylistId, reasonCode);
    } else if (modalAction === 'remove' && selectedLine) {
      await removeStartedLineAction(selectedLine.line_id, reasonCode);
    } else if (modalAction === 'unavailable' && targetStylistId) {
      await markStylistUnavailableAction(targetStylistId, reasonCode);
    }

    setSubmitting(false);
    setModalAction(null);
    setSelectedLine(null);
    await loadBoard();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Queue Control Board</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active service line dispatching with late binding and no resource held between stages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBoard} className="text-xs">
          Refresh Board
        </Button>
      </div>

      {/* Columns Grid: Left Pool (Waiting Lounge) + Right Stylist Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* POOL COLUMN (4 cols) */}
        <div className="md:col-span-4 space-y-3">
          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600" />
              <span className="font-bold text-sm text-slate-800">Unassigned Pool</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-white text-slate-700 shadow-2xs">
              {board.pool_lines.length} tickets
            </span>
          </div>

          <div className="space-y-2.5 min-h-96 bg-slate-50/50 p-2 rounded-xl border border-dashed border-slate-200">
            {board.pool_lines.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Pool is clear. All tickets assigned.
              </div>
            ) : (
              board.pool_lines.map((line) => (
                <div
                  key={line.line_id}
                  className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-[#1F4FD8]/50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-bold text-base text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        {line.ticket_code}
                      </span>
                      <span className="font-semibold text-xs text-slate-800">{line.customer_name}</span>
                    </div>
                    {line.preference_strict && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        Strict Stylist
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{line.service_name}</span> • ~{line.expected_minutes}m
                  </div>

                  {line.between_services && (
                    <div className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      Between services (wash done, waiting chair)
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 px-2"
                      onClick={() => {
                        setSelectedLine(line);
                        setModalAction('reassign');
                      }}
                    >
                      Assign to Stylist
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* STYLIST COLUMNS (8 cols) */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {board.stylists.map((col) => (
            <div key={col.stylist_id} className="space-y-3">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  col.is_available
                    ? 'bg-white border-slate-200'
                    : 'bg-rose-50/50 border-rose-200 text-rose-900'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-900">{col.display_name}</div>
                  <div className="text-[10px] font-semibold text-slate-500 ">
                    {col.is_available ? 'Available' : 'Unavailable / Break'}
                  </div>
                </div>
                {col.is_available && (
                  <button
                    onClick={() => {
                      setTargetStylistId(col.stylist_id);
                      setModalAction('unavailable');
                    }}
                    className="text-[10px] font-semibold text-rose-600 hover:underline"
                  >
                    Mark Off
                  </button>
                )}
              </div>

              {/* ACTIVE LINE (In Chair) */}
              <div className="space-y-2">
                <div className="text-[10px]  font-bold text-slate-400 px-1">Active In Chair</div>
                {col.active_line ? (
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 shadow-2xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="tabular-nums font-bold text-base text-blue-950">
                        {col.active_line.ticket_code}
                      </span>
                      <span className="text-[10px]  font-bold px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-900">
                        In Service
                      </span>
                    </div>
                    <div className="text-xs text-blue-900 font-semibold">
                      {col.active_line.customer_name} • {col.active_line.service_name}
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-[10px] h-6 px-2"
                        onClick={() => {
                          setSelectedLine(col.active_line);
                          setModalAction('remove');
                        }}
                      >
                        Remove Started Line
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-muted-foreground">
                    Chair is empty
                  </div>
                )}
              </div>

              {/* QUEUED LINES IN THIS STYLIST'S LANE */}
              <div className="space-y-2">
                <div className="text-[10px]  font-bold text-slate-400 px-1">
                  Queued in Lane ({col.queued_lines.length})
                </div>
                {col.queued_lines.map((line) => (
                  <div
                    key={line.line_id}
                    className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="tabular-nums font-bold text-sm text-slate-900">
                        {line.ticket_code}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{line.customer_name}</span>
                    </div>
                    <div className="text-xs text-slate-600">{line.service_name}</div>
                    <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 px-2"
                        onClick={() => {
                          setSelectedLine(line);
                          setTargetStylistId(col.stylist_id);
                          setModalAction('start');
                        }}
                      >
                        Start Out of Order
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px] h-6 px-2 text-slate-600"
                        onClick={() => {
                          setSelectedLine(line);
                          setModalAction('reassign');
                        }}
                      >
                        Reassign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTION MODAL */}
      {modalAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border">
            <h3 className="text-base font-bold text-slate-900">
              {modalAction === 'reassign' && 'Reassign Service Line'}
              {modalAction === 'start' && 'Start Line Out of Order'}
              {modalAction === 'remove' && 'Remove Started Service Line'}
              {modalAction === 'unavailable' && 'Mark Stylist Unavailable'}
            </h3>

            {selectedLine && (
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
                <div>
                  Ticket: <span className="font-bold">{selectedLine.ticket_code}</span> ({selectedLine.customer_name})
                </div>
                <div>Service: {selectedLine.service_name}</div>
              </div>
            )}

            {(modalAction === 'reassign' || modalAction === 'start') && (
              <div>
                <label className="text-xs  font-bold text-slate-700 block mb-1">
                  Target Stylist / Assignment
                </label>
                <select
                  value={targetStylistId}
                  onChange={(e) => setTargetStylistId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                >
                  <option value="">Select stylist...</option>
                  <option value="pool">Return to Unassigned Pool</option>
                  {board.stylists.map((s) => (
                    <option key={s.stylist_id} value={s.stylist_id}>
                      {s.display_name} {s.is_available ? '' : '(Unavailable)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs  font-bold text-slate-700 block mb-1">
                Mandatory Reason Code
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
              >
                <option value="manager_balance">Load Balancing & Chair Optimization</option>
                <option value="customer_urgency">Customer Departure Urgency</option>
                <option value="stylist_unavailable">Stylist Unavailable / On Break</option>
                <option value="skill_requirement">Special Skill Requirement</option>
                <option value="customer_request">Customer Changed Preference</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalAction(null);
                  setSelectedLine(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#1F4FD8] hover:bg-[#1F4FD8]/90 text-white"
                onClick={handleConfirmAction}
                disabled={submitting}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
