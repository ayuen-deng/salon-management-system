'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import {
  getQueueDisplayBoardAction,
  type QueueDisplayBoardState,
  type QueueDisplayBoardItem,
} from '@/modules/visits';
import { getBusinessDayStatusAction } from '@/modules/reception';

export function QueueDisplayView() {
  const [board, setBoard] = useState<QueueDisplayBoardState>({
    nowServing: [],
    nextUp: [],
    waitingList: [],
    estimatedWaitMinutes: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [recentChangedTicket, setRecentChangedTicket] = useState<string | null>(null);
  const [businessDayOpen, setBusinessDayOpen] = useState<boolean | null>(null);

  useEffect(() => {
    updateBoard();
  }, []);

  async function updateBoard() {
    try {
      const [res, day] = await Promise.all([getQueueDisplayBoardAction(), getBusinessDayStatusAction()]);
      if (day.success) setBusinessDayOpen(day.data.is_open);
      if (res.success && res.data) {
        setBoard((prev) => {
          // Detect changes for gentle highlight
          const prevCodes = new Set([...prev.nowServing, ...prev.nextUp].map((t) => t.ticketCode));
          const newCodes = [...res.data.nowServing, ...res.data.nextUp].map((t) => t.ticketCode);
          const changed = newCodes.find((code) => !prevCodes.has(code));
          if (changed) {
            setRecentChangedTicket(changed);
            setTimeout(() => setRecentChangedTicket(null), 3000);
          }
          return res.data;
        });
        setIsReconnecting(false);
      }
      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      setIsReconnecting(true);
    }
  }
  useSalonLiveRefresh(() => { void updateBoard(); }, true, ['visit', 'visit_service', 'app_user', 'service_variant', 'service', 'business_day']);


  // Format wait estimate header text
  const waitEstimateText =
    board.estimatedWaitMinutes > 0
      ? `About ${board.estimatedWaitMinutes - 5} to ${board.estimatedWaitMinutes + 5} minutes`
      : null;

  // Collapse waiting tickets if more than 8
  const maxWaitingVisible = 8;
  const visibleWaiting = board.waitingList.slice(0, maxWaitingVisible);
  const overflowWaitingCount = board.waitingList.length - visibleWaiting.length;

  if (businessDayOpen === false) return <div className="min-h-screen bg-[#0A0E14] text-white flex items-center justify-center p-8 text-center"><div><h1 className="text-3xl font-bold">Mzuri Unisex Salon</h1><p className="mt-5 text-xl text-slate-300">Not open yet</p></div></div>;

  return (
    <div className="min-h-screen bg-[#0A0E14] text-[#F6F8FB] flex flex-col p-6 lg:p-10 select-none font-sans overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-[#1E2633]">
        <div className="space-y-0.5">
          <h1 className="text-2xl lg:text-3xl tracking-tight text-white flex items-center gap-3">
            <span className="font-semibold">Mzuri</span>
            <span className="font-normal text-slate-300">Unisex Salon</span>
            <span className="text-xs font-medium text-[#4C7DF5] px-2.5 py-0.5 rounded-full border border-[#4C7DF5]/30 bg-[#4C7DF5]/10">
              Mbarara
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs tabular-nums text-[#8A94A6]">
          {isReconnecting && (
            <span className="px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800 rounded-md font-sans">
              Reconnecting...
            </span>
          )}
          <span>Updated {lastUpdated || 'just now'}</span>
        </div>
      </header>

      {/* 3-Column Live Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 mt-6">
        {/* COLUMN 1: NOW SERVING */}
        <section className="bg-[#111827] border border-[#1E2633] rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E2633]">
            <h2 className="text-lg lg:text-xl font-semibold tracking-tight text-white">
              Now serving
            </h2>
            <span className="text-xs font-medium px-2.5 py-0.5 bg-[#0A0E14] text-[#8A94A6] rounded-full border border-[#1E2633]">
              {board.nowServing.length} active
            </span>
          </div>

          <div className="flex-1 space-y-3 pt-5 overflow-hidden">
            {board.nowServing.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#566174] text-sm text-center">
                No one is being served right now.
              </div>
            ) : (
              board.nowServing.map((item) => {
                const isHighlight = item.ticketCode === recentChangedTicket;
                return (
                  <div
                    key={item.ticketCode}
                    className={`p-5 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                      isHighlight
                        ? 'bg-[#1F4FD8]/25 border-[#4C7DF5] ring-1 ring-[#4C7DF5]'
                        : 'bg-[#0A0E14] border-[#1E2633]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] tracking-normal text-[#8A94A6] font-semibold block">
                        Ticket
                      </span>
                      <span className="text-4xl lg:text-5xl tabular-nums font-black text-[#4C7DF5] tracking-tight">
                        {item.ticketCode}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs tracking-normal text-[#8A94A6] font-medium block">
                        Stylist / Station
                      </span>
                      <span className="text-lg lg:text-xl font-bold text-white block mt-0.5">
                        {item.assignedTo || 'Station'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN 2: NEXT */}
        <section className="bg-[#111827] border border-[#1E2633] rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E2633]">
            <h2 className="text-lg lg:text-xl font-semibold tracking-tight text-white">
              Next
            </h2>
            <span className="text-xs font-medium px-2.5 py-0.5 bg-[#0A0E14] text-[#8A94A6] rounded-full border border-[#1E2633]">
              Ready up to {board.nextUp.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 pt-5 overflow-hidden">
            {board.nextUp.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#566174] text-sm text-center">
                Next stations will appear here.
              </div>
            ) : (
              board.nextUp.map((item) => {
                const isHighlight = item.ticketCode === recentChangedTicket;
                return (
                  <div
                    key={item.ticketCode}
                    className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                      isHighlight
                        ? 'bg-[#1F4FD8]/20 border-[#4C7DF5]'
                        : 'bg-[#0A0E14] border-[#1E2633]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl lg:text-3xl tabular-nums font-bold text-white">
                        {item.ticketCode}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#4C7DF5] font-medium block">
                        {item.nextDetail || `For ${item.assignedTo}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMN 3: WAITING */}
        <section className="bg-[#111827] border border-[#1E2633] rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E2633]">
            <div>
              <h2 className="text-lg lg:text-xl font-semibold tracking-tight text-white">
                Waiting
              </h2>
              {waitEstimateText && (
                <p className="text-[11px] text-[#8A94A6] mt-0.5">
                  {waitEstimateText}
                </p>
              )}
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 bg-[#0A0E14] text-[#8A94A6] rounded-full border border-[#1E2633]">
              {board.waitingList.length} in line
            </span>
          </div>

          <div className="flex-1 pt-5 space-y-2 overflow-hidden">
            {board.waitingList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#566174] text-sm text-center">
                No one is waiting in line.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {visibleWaiting.map((item) => (
                    <div
                      key={item.ticketCode}
                      className="p-3 bg-[#0A0E14] border border-[#1E2633] rounded-xl text-center"
                    >
                      <span className="text-xl lg:text-2xl tabular-nums font-semibold text-slate-200">
                        {item.ticketCode}
                      </span>
                    </div>
                  ))}
                </div>

                {overflowWaitingCount > 0 && (
                  <div className="p-3 text-center bg-[#0A0E14]/60 border border-dashed border-[#1E2633] rounded-xl text-xs text-[#8A94A6] font-medium">
                    + {overflowWaitingCount} more in queue
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
