'use client';

import { showToast } from '@/shared/lib/toast';
import { showPrompt } from '@/shared/lib/toast';
import { useRouter, useSearchParams } from 'next/navigation';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import { normalizeUgPhone } from '@/shared/models/phone';
import { getCatalogueAction, CatalogueServiceItem, CatalogueVariantItem } from '@/modules/catalogue';
import { printVisitReceipt } from '@/modules/payments';
import {
  getBusinessDayStatusAction,
  lookupCustomersAction,
  getStylistsTodayAction,
  getLiveReceptionQueueAction,
  createVisitAction,
  requestManagerApprovalAction,
  removeFromQueueAction,
  reassignLineAction,
  startLineOnBehalfAction,
  finishLineOnBehalfAction,
  markStaffAttendanceOnBehalfAction,
  getTabletDraftAction,
  ReceptionCustomerMatch,
  ReceptionStylistOption,
  ReceptionServiceLineDraft,
  ReceptionQueueItem,
  ReceptionKioskOrder,
  TabletDraftSession,
  getPendingKioskOrdersAction,
  claimKioskOrderAction,
  touchKioskClaimAction,
  releaseKioskOrderAction,
  cancelKioskOrderAction,
  confirmKioskOrderAction,
  getKioskDiscountApprovalAction,
} from '../controllers/reception.actions';
import {
  Search,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Tablet,
  Phone,
  User,
  Scissors,
  ArrowRight,
  ShieldAlert,
  WifiOff,
  UserX,
  RefreshCw,
  Banknote,
  Smartphone,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { OpenDayModal } from '@/modules/day';
import { AttendanceStatusChip } from '@/shared/views/ui/attendance-status-chip';

export function ReceptionWorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Business Day Status
  const [dayOpen, setDayOpen] = useState<boolean>(true);
  const [checkingDay, setCheckingDay] = useState<boolean>(true);
  const [openDayModalOpen, setOpenDayModalOpen] = useState<boolean>(false);

  // Phone & Customer Lookup
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [customerMatches, setCustomerMatches] = useState<ReceptionCustomerMatch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id?: string;
    phone: string;
    first_name: string;
    tier?: 'regular' | 'premium';
    premium_since?: string;
    premium_reason?: string;
  } | null>(null);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState<string>('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);

  // Catalogue & Basket
  const [catalogue, setCatalogue] = useState<CatalogueServiceItem[]>([]);
  const [searchServiceQuery, setSearchServiceQuery] = useState<string>('');
  const [lines, setLines] = useState<ReceptionServiceLineDraft[]>([]);

  // Negotiated Price Modal / State
  const [editingCustomPriceIndex, setEditingCustomPriceIndex] = useState<number | null>(null);
  const [customPriceVal, setCustomPriceVal] = useState<string>('');
  const [customPriceReason, setCustomPriceReason] = useState<string>('');
  const [customPriceError, setCustomPriceError] = useState<string>('');

  // Stylists
  const [stylists, setStylists] = useState<ReceptionStylistOption[]>([]);

  // Discounts
  const [discountVal, setDiscountVal] = useState<string>('');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [discountApprovalRequested, setDiscountApprovalRequested] = useState<boolean>(false);
  const [kioskDiscountApproved, setKioskDiscountApproved] = useState(false);
  const RECEPTION_DISCOUNT_LIMIT_UGX = 10000;

  // Tablet Draft Push
  const [tabletDraft, setTabletDraft] = useState<TabletDraftSession | null>(null);

  // Live Queue
  const [queue, setQueue] = useState<ReceptionQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [kioskOrders, setKioskOrders] = useState<ReceptionKioskOrder[]>([]);
  const [loadingKioskOrders, setLoadingKioskOrders] = useState(true);
  const [kioskNow, setKioskNow] = useState(Date.now());
  const [activeKioskOrder, setActiveKioskOrder] = useState<ReceptionKioskOrder | null>(null);
  const [kioskNumberReadBack, setKioskNumberReadBack] = useState(false);
  const [kioskBusyId, setKioskBusyId] = useState<string | null>(null);
  const [highlightedKioskOrders, setHighlightedKioskOrders] = useState<string[]>([]);
  const seenKioskIds = useRef<Set<string>>(new Set());
  const kioskActivityAt = useRef(Date.now());
  const requestedKioskOrderId = searchParams.get('order');
  const openingKioskOrderId = useRef<string | null>(null);

  // Removal & Reassignment Modals
  const [removingVisit, setRemovingVisit] = useState<ReceptionQueueItem | null>(null);
  const [removeReason, setRemoveReason] = useState<string>('Customer left / no-show');
  const [reassigningLine, setReassigningLine] = useState<{ lineId: string; currentStylistId?: string } | null>(null);
  const [newStylistId, setNewStylistId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('Workload rebalancing');

  // Request Manager Escalation Modal
  const [managerRequestModal, setManagerRequestModal] = useState<{
    kind: 'remove_started_line' | 'dispute_adjustment';
    visitId: string;
    lineId?: string;
  } | null>(null);
  const [managerRequestReason, setManagerRequestReason] = useState<string>('');

  // Ticket Issued Confirmation Modal
  const [confirmedTicketInfo, setConfirmedTicketInfo] = useState<{
    visitId?: string;
    code: string;
    waitRange: [number, number];
    paymentMethod?: 'cash' | 'momo';
    amountPaidUgx?: number;
    receiptNumber?: string;
  } | null>(null);

  // Upfront Payment-First State
  const [upfrontMethod, setUpfrontMethod] = useState<'cash' | 'momo'>('cash');
  const [upfrontMomoRef, setUpfrontMomoRef] = useState<string>('');

  // Submitting state
  const [submittingVisit, setSubmittingVisit] = useState<boolean>(false);

  // Line action on-behalf modal & error handling
  const [actionLineModal, setActionLineModal] = useState<{
    lineId: string;
    variantName: string;
    staffName: string;
    actionType: 'start' | 'finish';
  } | null>(null);
  const [actionLineReason, setActionLineReason] = useState<string>('Staff phone unavailable / assisting client');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load initial data & polling
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      loadQueueAndDraft();
    }, 5000);
    const claimInterval = setInterval(() => {
      if (activeKioskOrder && !document.hidden && Date.now() - kioskActivityAt.current < 90_000) {
        void touchKioskClaimAction(activeKioskOrder.id);
      }
    }, 30_000);
    return () => { clearInterval(interval); clearInterval(claimInterval); };
  }, [activeKioskOrder]);

  async function loadInitialData() {
    setCheckingDay(true);
    const dayRes = await getBusinessDayStatusAction();
    if (dayRes.success) {
      setDayOpen(dayRes.data.is_open);
    }
    setCheckingDay(false);

    // Load catalogue
    const catRes = await getCatalogueAction();
    if (catRes.success) {
      setCatalogue(catRes.data.services.filter((s) => s.active));
    }

    // Load stylists
    const styRes = await getStylistsTodayAction();
    if (styRes.success) {
      setStylists(styRes.data);
    }

    await loadQueueAndDraft();
  }

  async function loadQueueAndDraft() {
    try {
      const qRes = await getLiveReceptionQueueAction();
      if (qRes.success) {
        setQueue(qRes.data);
        setConnectionError(false);
      } else {
        setConnectionError(true);
      }

      const dRes = await getTabletDraftAction();
      if (dRes.success) {
        setTabletDraft(dRes.data);
      }
      const kRes = await getPendingKioskOrdersAction();
      if (kRes.success) {
        const next = kRes.data;
        const fresh = next.filter((order) => !seenKioskIds.current.has(order.id));
        if (seenKioskIds.current.size > 0 && fresh.length) {
          const ids = fresh.map((order) => order.id);
          showToast(`New kiosk order ${fresh[0].order_code}`, 'info', {
            label: 'Open order',
            onClick: () => router.push(`/reception?order=${encodeURIComponent(fresh[0].id)}`),
          });
          setHighlightedKioskOrders((current) => [...new Set([...current, ...ids])]);
          window.setTimeout(() => setHighlightedKioskOrders((current) => current.filter((id) => !ids.includes(id))), 5000);
        }
        seenKioskIds.current = new Set(next.map((order) => order.id));
        setKioskOrders(next);
      }
      if (activeKioskOrder && discountAmount > RECEPTION_DISCOUNT_LIMIT_UGX) {
        const approval = await getKioskDiscountApprovalAction(activeKioskOrder.id, discountAmount);
        if (approval.success) {
          setKioskDiscountApproved(approval.data.approved);
          setDiscountApprovalRequested(approval.data.pending);
        }
      }
      setLoadingKioskOrders(false);
    } catch {
      setConnectionError(true);
    }
  }
  useSalonLiveRefresh(() => { void loadQueueAndDraft(); }, true, [
    'visit', 'visit_service', 'kiosk_order_request', 'desk_session', 'customer', 'app_user', 'service_variant',
  ]);
  useSalonLiveRefresh(() => { void refreshCatalogue(); }, true, ['service', 'service_variant', 'staff_skill', 'app_user', 'app_setting']);
  useSalonLiveRefresh(() => { void refreshStylists(); }, true, [
    'attendance', 'attendance_break_period', 'leave_request', 'rota_entry', 'staff_skill', 'app_user',
  ]);
  useSalonLiveRefresh(() => { void refreshBusinessDay(); }, true, ['business_day']);

  async function refreshCatalogue() {
    const result = await getCatalogueAction();
    if (result.success) setCatalogue(result.data.services.filter((service) => service.active));
  }

  async function refreshStylists() {
    const result = await getStylistsTodayAction();
    if (result.success) setStylists(result.data);
  }

  async function refreshBusinessDay() {
    const result = await getBusinessDayStatusAction();
    if (result.success) setDayOpen(result.data.is_open);
  }

  useEffect(() => {
    if (!requestedKioskOrderId || activeKioskOrder || openingKioskOrderId.current === requestedKioskOrderId) return;
    void handleOpenKioskOrder(requestedKioskOrderId);
  }, [requestedKioskOrderId, activeKioskOrder]);

  useEffect(() => {
    const markActivity = () => { kioskActivityAt.current = Date.now(); };
    window.addEventListener('pointerdown', markActivity);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('input', markActivity);
    return () => {
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('input', markActivity);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setKioskNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleOpenKioskOrder(orderOrId: ReceptionKioskOrder | string) {
    const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId.id;
    if (kioskBusyId || openingKioskOrderId.current === orderId) return;
    openingKioskOrderId.current = orderId;
    setKioskBusyId(orderId);
    let openedSuccessfully = false;
    try {
      const claimed = await claimKioskOrderAction(orderId);
      if (!claimed.success) {
        showToast(claimed.error?.message || 'Could not open this kiosk order.', 'error');
        return;
      }
      const opened = claimed.data;
      setActiveKioskOrder(opened);
      setPhoneInput(opened.phone);
      setNewCustomerFirstName(opened.first_name);
      setSelectedCustomer(null);
      setCustomerMatches([]);
      setLines(opened.lines);
      setKioskNumberReadBack(false);
      setKioskDiscountApproved(false);
      setDiscountApprovalRequested(false);
      setDiscountVal('');
      setDiscountReason('');
      openedSuccessfully = true;
      router.replace('/reception', { scroll: false });
      const customers = await lookupCustomersAction(opened.phone);
      if (customers.success) {
        setCustomerMatches(customers.data);
        if (customers.data.length === 1) {
          const customer = customers.data[0];
          setSelectedCustomer({ id: customer.id, phone: customer.phone_e164, first_name: customer.first_name, tier: customer.tier, premium_since: customer.premium_since, premium_reason: customer.premium_reason });
        }
      }
      void loadQueueAndDraft();
      document.getElementById('visit-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not open this kiosk order.');
    } finally {
      setKioskBusyId(null);
      if (!openedSuccessfully) openingKioskOrderId.current = null;
    }
  }

  async function handleReleaseKioskOrder() {
    if (!activeKioskOrder) return;
    const result = await releaseKioskOrderAction(activeKioskOrder.id);
    if (!result.success) { showToast(result.error?.message || 'Could not release this order.'); return; }
    openingKioskOrderId.current = null;
    setActiveKioskOrder(null);
    setKioskNumberReadBack(false);
    setLines([]); setPhoneInput(''); setSelectedCustomer(null); setNewCustomerFirstName('');
    void loadQueueAndDraft();
  }

  async function handleKioskDidNotCome(order: ReceptionKioskOrder) {
    const reason = await showPrompt('Choose a reason: Customer left, Changed mind, or Duplicate order');
    if (!reason || !['Customer left', 'Changed mind', 'Duplicate order'].includes(reason)) return;
    setKioskBusyId(order.id);
    const result = await cancelKioskOrderAction(order.id, reason);
    setKioskBusyId(null);
    if (!result.success) showToast(result.error?.message || 'Could not cancel this order.');
    await loadQueueAndDraft();
  }


  // Handle Phone input & dynamic matching
  useEffect(() => {
    const raw = phoneInput.trim();
    if (raw.length >= 7) {
      const timer = setTimeout(async () => {
        setIsSearchingCustomer(true);
        const res = await lookupCustomersAction(raw);
        if (res.success) {
          setCustomerMatches(res.data);
          if (res.data.length === 1 && !selectedCustomer) {
            setSelectedCustomer({
              id: res.data[0].id,
              phone: res.data[0].phone_e164,
              first_name: res.data[0].first_name,
              tier: res.data[0].tier,
              premium_since: res.data[0].premium_since,
              premium_reason: res.data[0].premium_reason,
            });
          }
        }
        setIsSearchingCustomer(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCustomerMatches([]);
    }
  }, [phoneInput]);

  // Apply tablet draft to visit builder
  function handleAdoptTabletDraft() {
    if (!tabletDraft || tabletDraft.selected_variants.length === 0) return;
    const newDraftLines: ReceptionServiceLineDraft[] = tabletDraft.selected_variants.map((v, i) => {
      const parentService = catalogue.find((s) => s.variants.some((vx) => vx.id === v.id));
      return {
        service_id: parentService?.id || '',
        variant_id: v.id,
        service_name: parentService?.name || 'Selected Service',
        variant_name: v.name,
        list_price_ugx: v.list_price_ugx,
        min_price_ugx: v.min_price_ugx,
        max_price_ugx: v.max_price_ugx,
        expected_minutes: v.expected_minutes,
        concurrent_with_previous: false,
        preferred_stylist_strict: false,
      };
    });
    setLines(newDraftLines);
    if (tabletDraft.phone_confirm) {
      setPhoneInput(tabletDraft.phone_confirm);
    }
  }

  // Add line to basket
  function handleAddServiceVariant(service: CatalogueServiceItem, variant: CatalogueVariantItem) {
    const isFirst = lines.length === 0;
    const defaultStylist = service.assigned_staff_ids.length > 0 ? service.assigned_staff_ids[0] : undefined;

    const newLine: ReceptionServiceLineDraft = {
      service_id: service.id,
      variant_id: variant.id,
      service_name: service.name,
      variant_name: variant.name,
      list_price_ugx: variant.list_price_ugx,
      min_price_ugx: variant.min_price_ugx,
      max_price_ugx: variant.max_price_ugx,
      expected_minutes: variant.expected_minutes,
      concurrent_with_previous: false,
      preferred_stylist_id: defaultStylist,
      preferred_stylist_strict: false,
    };
    setLines([...lines, newLine]);
  }

  // Remove line from basket
  function handleRemoveLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  // Toggle concurrent line
  function handleToggleConcurrent(index: number) {
    setLines(
      lines.map((l, i) => (i === index ? { ...l, concurrent_with_previous: !l.concurrent_with_previous } : l))
    );
  }

  // Custom Negotiated Price check & save
  function handleSaveCustomPrice() {
    if (editingCustomPriceIndex === null) return;
    const line = lines[editingCustomPriceIndex];
    const priceNum = parseInt(customPriceVal.replace(/[^0-9]/g, ''), 10);

    if (isNaN(priceNum)) {
      setCustomPriceError('Please enter a valid price in UGX.');
      return;
    }
    if (priceNum < line.min_price_ugx || priceNum > line.max_price_ugx) {
      setCustomPriceError(
        `Price out of bounds. Allowed range for ${line.variant_name} is ${formatUGX(line.min_price_ugx)} – ${formatUGX(line.max_price_ugx)}.`
      );
      return;
    }
    if (!customPriceReason.trim()) {
      setCustomPriceError('A reason code is mandatory for custom negotiated price.');
      return;
    }

    setLines(
      lines.map((l, i) =>
        i === editingCustomPriceIndex
          ? { ...l, custom_price_ugx: priceNum, custom_price_reason: customPriceReason }
          : l
      )
    );
    setEditingCustomPriceIndex(null);
    setCustomPriceVal('');
    setCustomPriceReason('');
    setCustomPriceError('');
  }

  // Calculate totals
  const totalListPrice = lines.reduce((acc, l) => acc + l.list_price_ugx, 0);
  const totalBasePrice = lines.reduce(
    (acc, l) => acc + (l.custom_price_ugx !== undefined ? l.custom_price_ugx : l.list_price_ugx),
    0
  );
  const discountAmount = parseInt(discountVal.replace(/[^0-9]/g, ''), 10) || 0;
  const isDiscountAboveLimit = discountAmount > RECEPTION_DISCOUNT_LIMIT_UGX;
  const totalFinalPrice = Math.max(0, totalBasePrice - (isDiscountAboveLimit ? 0 : discountAmount));
  const kioskPriceChanges = activeKioskOrder?.lines.filter((line) =>
    line.original_price_ugx !== undefined && line.original_price_ugx !== line.list_price_ugx
  ) ?? [];
  const hasAnySkillAssignments = stylists.some((stylist) => stylist.service_ids.length > 0);
  const unstaffedLines = activeKioskOrder ? lines.filter((line) => !stylists.some((stylist) =>
    stylist.status === 'present' && (!hasAnySkillAssignments || stylist.service_ids.includes(line.service_id))
  )) : [];

  // Confirm and Create Visit (Payment-First Flow)
  async function handleConfirmVisit() {
    if (!selectedCustomer && !newCustomerFirstName.trim()) {
      showToast('Please select an existing customer or enter the first name for the new customer.');
      return;
    }
    if (lines.length === 0) {
      showToast('Please add at least one service to build a visit.');
      return;
    }
    if (upfrontMethod === 'momo' && !upfrontMomoRef.trim()) {
      showToast('Mobile Money reference is mandatory to record upfront payment.');
      return;
    }

    setSubmittingVisit(true);

    if (activeKioskOrder) {
      const result = await confirmKioskOrderAction({
        order_id: activeKioskOrder.id,
        first_name: selectedCustomer?.first_name || newCustomerFirstName.trim(),
        phone: phoneInput,
        lines,
        discount_ugx: discountAmount,
        discount_reason: discountReason || undefined,
        method: upfrontMethod === 'momo' ? 'mobile_money' : 'cash',
        provider_reference: upfrontMethod === 'momo' ? upfrontMomoRef.trim() : undefined,
        idempotency_key: `kiosk_pay_${activeKioskOrder.id}`,
        number_read_back: kioskNumberReadBack,
      });
      if (result.success) {
        const visitId = result.data.visit_id;
        setConfirmedTicketInfo({ visitId, code: result.data.ticket_code, waitRange: [10, 30], paymentMethod: upfrontMethod, amountPaidUgx: result.data.total_final_ugx, receiptNumber: result.data.receipt_number });
        openingKioskOrderId.current = null;
        setActiveKioskOrder(null); setKioskNumberReadBack(false);
        setLines([]); setPhoneInput(''); setSelectedCustomer(null); setNewCustomerFirstName('');
        setDiscountVal(''); setDiscountReason(''); setUpfrontMethod('cash'); setUpfrontMomoRef('');
        await printVisitReceipt(visitId);
        await loadQueueAndDraft();
      } else {
        showToast(result.error?.message || 'Could not confirm payment.');
      }
      setSubmittingVisit(false);
      return;
    }

    const customerPayload = selectedCustomer
      ? { id: selectedCustomer.id, phone: selectedCustomer.phone, first_name: selectedCustomer.first_name }
      : { phone: phoneInput, first_name: newCustomerFirstName.trim() };

    const idempotencyKey = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const res = await createVisitAction({
      customer: customerPayload,
      lines,
      discount_ugx: isDiscountAboveLimit ? 0 : discountAmount,
      discount_reason: discountReason || undefined,
      payment: {
        method: upfrontMethod,
        amount_ugx: totalFinalPrice,
        provider_reference: upfrontMethod === 'momo' ? upfrontMomoRef.trim() : undefined,
        idempotency_key: idempotencyKey,
      },
    });

    if (res.success) {
      const visitId = res.data.visit_id;
      setConfirmedTicketInfo({
        visitId,
        code: res.data.ticket_code,
        waitRange: res.data.estimated_wait_minutes_range,
        paymentMethod: upfrontMethod,
        amountPaidUgx: totalFinalPrice,
        receiptNumber: res.data.receipt_number,
      });

      // Auto-open dedicated clean receipt print window if payment was taken
      if (visitId) {
        await printVisitReceipt(visitId);
      }

      // Reset visit builder form
      setLines([]);
      setPhoneInput('');
      setSelectedCustomer(null);
      setNewCustomerFirstName('');
      setDiscountVal('');
      setDiscountReason('');
      setUpfrontMethod('cash');
      setUpfrontMomoRef('');
      setTabletDraft(null);
      await loadQueueAndDraft();
    } else {
      showToast(res.error?.message || 'Failed to issue ticket.');
    }
    setSubmittingVisit(false);
  }

  // Request Manager Approval for discount
  async function handleRequestDiscountApproval() {
    if (!discountReason.trim()) {
      showToast('A reason is mandatory to request manager discount approval.');
      return;
    }
    const res = await requestManagerApprovalAction({
      kind: 'discount',
      visit_id: activeKioskOrder?.id,
      reason: discountReason,
      details: {
        amount_ugx: discountAmount,
        requested_discount_ugx: discountAmount,
        total_list_ugx: totalBasePrice,
        customer_phone: phoneInput,
        kiosk_order_id: activeKioskOrder?.id,
      },
    });
    if (res.success) {
      setDiscountApprovalRequested(true);
      showToast('Discount approval request sent to the manager. Payment remains blocked until it is decided.');
    } else {
      showToast(res.error.message || 'Failed to request approval.');
    }
  }

  // Filter catalogue
  const filteredCatalogue = catalogue.filter((service) => {
    const q = searchServiceQuery.toLowerCase();
    return (
      service.name.toLowerCase().includes(q) ||
      service.category.toLowerCase().includes(q) ||
      service.variants.some((v) => v.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Calm Persistent Day-Not-Open Banner */}
      {!dayOpen && !checkingDay && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-base">The business day has not been opened.</div>
              <div className="text-xs text-amber-700">
                Open the day with the morning cash float to start receiving guests and issuing tickets.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setOpenDayModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
              size="sm"
            >
              Open the Day
            </Button>
            <Link href="/manager/day">
              <Button variant="outline" size="sm" className="border-amber-400 bg-white hover:bg-amber-100 text-amber-900 text-xs">
                View Day ↗
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Connection Lost Notification */}
      {connectionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-900 text-xs">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-600" />
            <span>Connection issue detected. Use the paper forms if system is unreachable.</span>
          </div>
          <Link href="/reception/paper-forms" className="font-bold underline hover:text-rose-950">
            Open Paper Forms ↗
          </Link>
        </div>
      )}

      {/* 2. Customer Selection Draft from Paired Tablet Alert */}
      {tabletDraft && tabletDraft.selected_variants.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Customer selection ready from tablet</div>
              <div className="text-xs text-blue-700">
                {tabletDraft.selected_variants.length} services selected • Phone:{' '}
                <span className="font-semibold">{tabletDraft.phone_confirm || 'Unspecified'}</span>
              </div>
            </div>
          </div>
          <Button onClick={handleAdoptTabletDraft} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold">
            Adopt Draft to Visit Builder <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT = VISIT BUILDER, RIGHT = LIVE QUEUE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: VISIT BUILDER ================= */}
        <div className="lg:col-span-7 space-y-6">
          <Card id="visit-builder" className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">{activeKioskOrder ? `Order ${activeKioskOrder.order_code} · Confirm and pay` : 'Walk-in Visit Builder'}</CardTitle>
                  <p className="text-xs text-muted-foreground">Fast desk check-in without page reloads</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                  Desk Station 1
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* STEP 1: CUSTOMER PHONE & READ-BACK */}
              <div className="space-y-3">
                {activeKioskOrder && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Original estimate: <b>{formatUGX(activeKioskOrder.total_ugx)}</b> · Current service total: <b>{formatUGX(totalListPrice)}</b>
                      {kioskPriceChanges.length > 0 && <span className="mt-1 block">Catalogue price changed: {kioskPriceChanges.map((line) => `${line.variant_name} ${formatUGX(line.original_price_ugx!)} → ${formatUGX(line.list_price_ugx)}`).join('; ')}. Confirm the current total with the customer.</span>}
                      {activeKioskOrder.total_ugx !== totalListPrice && kioskPriceChanges.length === 0 && <span className="mt-1 block">The order total changed because services were added, removed, or adjusted. Confirm the current total with the customer.</span>}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void handleReleaseKioskOrder()}>Release</Button>
                  </div>
                )}
                {activeKioskOrder && kioskOrders.some((order) => order.id !== activeKioskOrder.id && order.phone === activeKioskOrder.phone) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    Another unpaid order uses this phone: <b>{kioskOrders.find((order) => order.id !== activeKioskOrder.id && order.phone === activeKioskOrder.phone)?.order_code}</b>. Confirm with the customer which order to keep.
                  </div>
                )}
                {activeKioskOrder && queue.some((visit) => visit.phone_e164 === activeKioskOrder.phone) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    An active salon visit already uses this phone: <b>{queue.find((visit) => visit.phone_e164 === activeKioskOrder.phone)?.ticket_code}</b>. Check with the customer before payment.
                  </div>
                )}
                <label className="text-xs font-bold text-slate-700  tracking-normal block">
                  Customer Phone (Uganda Normalization)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setSelectedCustomer(null);
                    }}
                    placeholder="Enter phone (e.g. 0772 123456 or +2567...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  />
                  {isSearchingCustomer && (
                    <RefreshCw className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 animate-spin" />
                  )}
                </div>

                {/* Large Customer Confirmation Read-back Text */}
                {phoneInput.trim().length >= 7 && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-bold  tracking-normal text-amber-800 block mb-0.5">
                      Confirm Phone Number With Customer
                    </span>
                    <span className="text-2xl font-black text-slate-900 tracking-normal tabular-nums">
                      {normalizeUgPhone(phoneInput)}
                    </span>
                  </div>
                )}

                {activeKioskOrder && (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
                    <input type="checkbox" checked={kioskNumberReadBack} onChange={(event) => setKioskNumberReadBack(event.target.checked)} className="h-4 w-4 accent-blue-700" />
                    Number read back to customer
                  </label>
                )}

                {/* Multi-Profile Matches (Shared Family / Friends Phone) */}
                {customerMatches.length > 0 && !selectedCustomer && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="text-xs font-bold text-slate-700">Multiple profiles on this phone — Who is this visit for?</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCustomer({
                            id: c.id,
                            phone: c.phone_e164,
                            first_name: c.first_name,
                            tier: c.tier,
                            premium_since: c.premium_since,
                            premium_reason: c.premium_reason,
                          })}
                          className="p-2.5 rounded-lg border bg-white hover:border-primary text-left text-xs transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 text-sm">{c.first_name}</span>
                            {c.tier === 'premium' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1F4FD8]/10 text-[#1F4FD8] border border-[#1F4FD8]/25">
                                Premium
                              </span>
                            )}
                          </div>
                          {c.usual_stylist && (
                            <div className="text-[11px] text-muted-foreground">Usual: {c.usual_stylist}</div>
                          )}
                          {c.recent_visits && c.recent_visits[0] && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              Last: {c.recent_visits[0].date} ({c.recent_visits[0].services})
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Selected Customer Profile Summary */}
                {selectedCustomer && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{selectedCustomer.first_name}</span>
                        <span className="text-slate-500">({selectedCustomer.phone})</span>
                        {selectedCustomer.tier === 'premium' && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1F4FD8]/15 text-[#1F4FD8] border border-[#1F4FD8]/30"
                            title={selectedCustomer.premium_reason ? `Premium: ${selectedCustomer.premium_reason}` : 'Premium Customer'}
                          >
                            Premium
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-emerald-700 hover:underline font-semibold"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* New Customer Registration (First Name Only) */}
                {phoneInput.trim().length >= 9 && customerMatches.length === 0 && !selectedCustomer && (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-slate-800">New Customer Registration (First Name Only)</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCustomerFirstName}
                        onChange={(e) => setNewCustomerFirstName(e.target.value)}
                        placeholder="Customer first name (e.g. Ronald)"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: SERVICE SEARCH & CATALOGUE SELECTION */}
              <div className="space-y-3 pt-4 border-t border-[#EDEFF3]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700  tracking-normal block">
                    Catalogue & Services
                  </label>
                  <span className="text-xs text-muted-foreground">{filteredCatalogue.length} services available</span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchServiceQuery}
                    onChange={(e) => setSearchServiceQuery(e.target.value)}
                    placeholder="Search services or categories (e.g. Wash, Knotless, Fade)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Service Cards Grid */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {filteredCatalogue.map((service) => (
                    <div key={service.id} className="border border-slate-200 rounded-xl p-3 bg-white hover:border-slate-300 transition-all">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-xs text-slate-900">{service.name}</span>
                        <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                          {service.category}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {service.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleAddServiceVariant(service, v)}
                            className="p-2 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-primary/5 hover:border-primary/40 text-left text-xs flex justify-between items-center transition-all group"
                          >
                            <div className="truncate pr-2">
                              <div className="font-medium text-slate-800 truncate">{v.name}</div>
                              <div className="text-[10px] text-slate-500">~{v.expected_minutes}m</div>
                            </div>
                            <span className="font-bold text-slate-900 text-xs shrink-0 group-hover:text-primary">
                              {formatUGX(v.list_price_ugx)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 3: VISIT LINES & SEQUENCE ORDER */}
              <div className="space-y-3 pt-4 border-t border-[#EDEFF3]">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700  tracking-normal block">
                    Selected Visit Lines ({lines.length})
                  </label>
                  <span className="text-xs text-slate-500 font-medium">Sequence execution default</span>
                </div>

                {lines.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-muted-foreground">
                    No services selected. Click variants above or adopt draft from tablet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">{line.variant_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {formatUGX(line.custom_price_ugx !== undefined ? line.custom_price_ugx : line.list_price_ugx)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Line Options: Concurrent execution + Custom Negotiated Price + Stylist */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                          {/* Concurrent toggle */}
                          {idx > 0 && (
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                              <input
                                type="checkbox"
                                checked={line.concurrent_with_previous}
                                onChange={() => handleToggleConcurrent(idx)}
                                className="rounded text-primary focus:ring-0"
                              />
                              <span className="text-[11px]">Same time as prev</span>
                            </label>
                          )}

                          {/* Custom Negotiated Price button */}
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomPriceIndex(idx);
                                setCustomPriceVal(
                                  line.custom_price_ugx !== undefined
                                    ? line.custom_price_ugx.toString()
                                    : line.list_price_ugx.toString()
                                );
                                setCustomPriceReason(line.custom_price_reason || 'Client negotiated within allowed bounds');
                              }}
                              className="text-[11px] text-primary hover:underline font-semibold block"
                            >
                              {line.custom_price_ugx !== undefined ? 'Edit Custom Price' : 'Custom price (negotiated)'}
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              Allowed: {formatUGX(line.min_price_ugx)} – {formatUGX(line.max_price_ugx)}
                            </span>
                          </div>

                          {/* Preferred Stylist assignment */}
                          <div>
                            <select
                              value={line.preferred_stylist_id || ''}
                              onChange={(e) => {
                                const newId = e.target.value || undefined;
                                setLines(lines.map((l, i) => (i === idx ? { ...l, preferred_stylist_id: newId } : l)));
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none"
                            >
                              <option value="">Any available stylist</option>
                              {stylists.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.display_name} ({s.status === 'present' ? 'Available' : s.status.replace('_', ' ')})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 4: DISCOUNT & CONFIRM TOTAL */}
              <div className="pt-4 border-t border-[#EDEFF3] space-y-4">
                {activeKioskOrder && unstaffedLines.length > 0 && (
                  <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    No clocked-in stylist is currently available for: {unstaffedLines.map((line) => line.variant_name).join(', ')}. Assign a stylist or check availability before taking payment.
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-700  tracking-normal block">
                      Discounts (Daily limit: UGX 10,000)
                    </span>
                    <span className="text-[11px] text-slate-500">Above limit triggers manager approval request</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      placeholder="Discount UGX"
                      className="w-32 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                    />
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason required"
                      className="w-40 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                    />
                  </div>
                </div>

                {isDiscountAboveLimit && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                    <div>
                      <span className="font-bold">Discount exceeds receptionist limit (UGX 10,000).</span>
                      <p className="text-[11px] text-amber-700">
                        Payment is blocked until a manager decides.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleRequestDiscountApproval}
                      disabled={discountApprovalRequested}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {discountApprovalRequested ? 'Requested ✓' : 'Request Approval'}
                    </Button>
                  </div>
                )}

                {/* Upfront Payment Selection (Payment-First Flow) */}
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950  tracking-normal block">
                      Upfront Payment (Paid before service)
                    </span>
                    <span className="text-xs font-bold text-blue-700 tabular-nums">
                      {formatUGX(totalFinalPrice)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUpfrontMethod('cash')}
                      className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        upfrontMethod === 'cash'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      Cash Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpfrontMethod('momo')}
                      className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        upfrontMethod === 'momo'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      Mobile Money
                    </button>
                  </div>

                  {upfrontMethod === 'momo' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-semibold text-blue-900 block">
                        MTN / Airtel Transaction ID <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MP261019.1234.H09823"
                        value={upfrontMomoRef}
                        onChange={(e) => setUpfrontMomoRef(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Final Price Summary & Confirm Button */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-xs text-muted-foreground block">Total Paid Upfront</span>
                    <span className="text-2xl font-black text-slate-900">{formatUGX(totalFinalPrice)}</span>
                  </div>
                  <Button
                    onClick={handleConfirmVisit}
                    disabled={submittingVisit || lines.length === 0 || !dayOpen || (Boolean(activeKioskOrder) && !kioskNumberReadBack) || (Boolean(activeKioskOrder) && isDiscountAboveLimit && !kioskDiscountApproved)}
                    size="lg"
                    className="bg-primary hover:bg-blue-700 text-white px-8 font-bold gap-2 text-sm shadow-md"
                  >
                    {submittingVisit ? 'Processing Payment & Ticket...' : activeKioskOrder ? 'Confirm payment' : 'Pay & Issue Ticket'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================= RIGHT COLUMN: LIVE QUEUE & STAFF ================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* LIVE QUEUE FEED CARD */}
          <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Live Salon Queue</CardTitle>
                <p className="text-xs text-muted-foreground">Real-time status, flags & stylist lines</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                {queue.length} Active
              </span>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  Queue is clear. No waiting or active tickets.
                </div>
              ) : (
                queue.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                      item.between_services_stage === 'escalate'
                        ? 'bg-rose-50/60 border-rose-300'
                        : item.between_services_stage === 'warn'
                        ? 'bg-amber-50/60 border-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900 tabular-nums tracking-normal bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {item.ticket_code}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{item.customer_name}</div>
                          <div className="text-[10px] text-muted-foreground">{item.services_summary}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            item.status === 'in_service'
                              ? 'bg-blue-100 text-blue-800'
                              : item.status === 'paid' || item.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                        <div className="text-[10px] font-semibold text-slate-700 mt-0.5">
                          {formatUGX(item.total_price_ugx)}
                        </div>
                      </div>
                    </div>

                    {/* Between-Services Idle Flag */}
                    {item.between_services_stage && (
                      <div
                        className={`p-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
                          item.between_services_stage === 'escalate'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Between services: idle {item.idle_minutes}m (
                          {item.between_services_stage === 'escalate' ? 'Escalated threshold' : 'Warning threshold'})
                        </span>
                      </div>
                    )}

                    {/* Service Lines & Stylist Actions */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100">
                      {item.lines.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-slate-50"
                        >
                          <div className="truncate pr-2">
                            <span className="font-medium text-slate-800">{l.variant_name}</span>
                            <span className="text-slate-400 ml-1.5">({l.staff_name || 'Pool'})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Action to start line on behalf */}
                            {l.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setActionLineReason('Staff phone unavailable / assisting client');
                                  setActionLineModal({
                                    lineId: l.id,
                                    variantName: l.variant_name,
                                    staffName: l.staff_name || 'Assigned Staff',
                                    actionType: 'start',
                                  });
                                }}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                              >
                                Start
                              </button>
                            )}
                            {/* Action to finish line on behalf */}
                            {(l.status === 'in_service' || l.status === 'in_progress') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setActionLineReason('Staff phone unavailable / customer completed');
                                  setActionLineModal({
                                    lineId: l.id,
                                    variantName: l.variant_name,
                                    staffName: l.staff_name || 'Assigned Staff',
                                    actionType: 'finish',
                                  });
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                              >
                                Finish
                              </button>
                            )}
                            {/* Reassign stylist */}
                            {l.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => setReassigningLine({ lineId: l.id, currentStylistId: l.staff_user_id })}
                                className="text-[10px] text-slate-500 hover:text-slate-800 underline font-medium"
                              >
                                Reassign
                              </button>
                            )}
                            {/* Remove started line requires manager approval */}
                            {l.status === 'in_service' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setManagerRequestModal({
                                    kind: 'remove_started_line',
                                    visitId: item.id,
                                    lineId: l.id,
                                  })
                                }
                                className="text-[10px] text-amber-600 hover:underline font-bold"
                              >
                                Req Manager
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom Queue Card Actions: Cancel/Remove Visit */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {item.status === 'in_service' || item.lines.some((l) => l.status === 'in_service' || l.status === 'in_progress' || l.status === 'done') ? (
                        <button
                          type="button"
                          onClick={() =>
                            setManagerRequestModal({
                              kind: 'remove_started_line',
                              visitId: item.id,
                            })
                          }
                          className="text-[10px] text-amber-700 hover:underline font-bold flex items-center gap-1"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          <span>Request Manager to Cancel</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRemovingVisit(item)}
                          className="text-[10px] text-rose-600 hover:underline font-bold"
                        >
                          Remove from Queue
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-blue-200 shadow-xs rounded-2xl overflow-hidden" aria-label="Kiosk orders awaiting payment">
            <CardHeader className="bg-blue-50/70 border-b border-blue-100 py-3 px-5 flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm font-bold text-slate-900">Kiosk orders <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{kioskOrders.length}</span></CardTitle><p className="text-xs text-slate-600">Awaiting payment</p></div>
              <Link href="/reception/kiosk-orders" className="text-xs font-semibold text-blue-700 hover:underline">View all ({kioskOrders.length})</Link>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {loadingKioskOrders && kioskOrders.length === 0 ? <div className="h-14 animate-pulse rounded-lg bg-slate-100" aria-label="Loading kiosk orders" />
                : kioskOrders.length === 0 ? <p className="py-3 text-center text-xs text-slate-500">No kiosk orders waiting.</p>
                  : kioskOrders.slice(0, 3).map((order) => <div key={order.id} className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${highlightedKioskOrders.includes(order.id) ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
                    <div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-sm">{order.order_code}</strong><span className="truncate text-xs font-medium">{order.first_name}</span><span className="shrink-0 text-[10px] text-slate-500">{Math.max(0, Math.floor((kioskNow - new Date(order.created_at).getTime()) / 60000))} min</span></div><p className="truncate text-[10px] text-slate-600">{order.lines.map((line) => line.variant_name).join(', ')}</p></div>
                    <Button size="sm" disabled={kioskBusyId === order.id || (Boolean(order.claimed_by) && activeKioskOrder?.id !== order.id && Boolean(order.claimed_at) && Date.now() - new Date(order.claimed_at!).getTime() < 120000)} onClick={() => void handleOpenKioskOrder(order)}>{kioskBusyId === order.id ? 'Opening…' : 'Open'}</Button>
                  </div>)}
            </CardContent>
          </Card>

          {/* STAFF TODAY ATTENDANCE CARD */}
          <Card className="border border-[#EDEFF3] shadow-xs rounded-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-[#EDEFF3] py-3 px-6">
              <CardTitle className="text-xs font-bold text-slate-700  tracking-normal">
                Staff Status Today
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {stylists.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-slate-900">{s.display_name}</div>
                    <div className="text-[10px] text-muted-foreground">Queue: {s.current_queue_count} tickets</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AttendanceStatusChip status={s.status} />
                    {['not_in', 'not_in_yet', 'absent'].includes(s.status) && (
                      <button
                        type="button"
                        onClick={() =>
                          markStaffAttendanceOnBehalfAction(
                            s.id,
                            'in',
                            'Staff forgot to clock in; receptionist marked present'
                          )
                        }
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold"
                      >
                        Mark In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CONFIRMED TICKET MODAL */}
      {confirmedTicketInfo && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900">Payment & Visit Confirmed</h3>
            <p className="text-xs text-slate-500">
              Payment confirmed upfront. The ticket is live on the lounge queue screen.
            </p>
            <div className="py-6 px-10 bg-slate-900 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <span className="text-6xl font-black tracking-normal tabular-nums block">
                {confirmedTicketInfo.code}
              </span>
              <span className="text-xs text-slate-400 mt-2 block">
                Estimated wait: ~{confirmedTicketInfo.waitRange[0]} to {confirmedTicketInfo.waitRange[1]} mins
              </span>
            </div>

            {/* Upfront Receipt Summary Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-left space-y-1 tabular-nums text-slate-800">
              <div className="flex justify-between">
                <span>Receipt Number:</span>
                <span className="font-bold text-slate-900">{confirmedTicketInfo.receiptNumber || 'REC-AUTO'}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-700">
                  {formatUGX(confirmedTicketInfo.amountPaidUgx || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className=" font-semibold">
                  {confirmedTicketInfo.paymentMethod === 'momo' ? 'Mobile Money (MTN/Airtel)' : 'Cash'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  if (confirmedTicketInfo.visitId) {
                    void printVisitReceipt(confirmedTicketInfo.visitId);
                  }
                }}
                variant="outline"
                className="w-full text-xs font-semibold border-slate-300 gap-1.5"
              >
                <Printer className="w-4 h-4 text-primary" /> Print Customer Receipt
              </Button>
              <Button
                onClick={() => setConfirmedTicketInfo(null)}
                className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl"
              >
                Done / Next Customer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* CUSTOM NEGOTIATED PRICE MODAL */}
      {editingCustomPriceIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Custom Negotiated Price ({lines[editingCustomPriceIndex]?.variant_name})
            </h3>
            <p className="text-xs text-slate-500">
              Receptionists may negotiate prices strictly within the allowed range.
            </p>
            <div className="p-3 bg-slate-50 border rounded-xl text-xs space-y-1">
              <div>
                Standard List Price:{' '}
                <span className="font-bold">{formatUGX(lines[editingCustomPriceIndex]?.list_price_ugx)}</span>
              </div>
              <div className="text-primary font-semibold">
                Allowed Range: {formatUGX(lines[editingCustomPriceIndex]?.min_price_ugx)} –{' '}
                {formatUGX(lines[editingCustomPriceIndex]?.max_price_ugx)}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Negotiated Price (UGX)</label>
                <input
                  type="text"
                  value={customPriceVal}
                  onChange={(e) => setCustomPriceVal(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                  placeholder="e.g. 110000"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mandatory Reason Code</label>
                <input
                  type="text"
                  value={customPriceReason}
                  onChange={(e) => setCustomPriceReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  placeholder="e.g. Regular braiding client negotiated rate"
                />
              </div>
              {customPriceError && <p className="text-xs text-rose-600 font-bold">{customPriceError}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingCustomPriceIndex(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveCustomPrice} className="bg-primary text-white font-bold">
                Apply Custom Price
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* REMOVE FROM QUEUE MODAL (Reason Mandatory) */}
      {removingVisit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Remove Ticket {removingVisit.ticket_code} from Queue?
            </h3>
            <p className="text-xs text-slate-500">
              Removing a ticket before service starts requires a recorded operational reason code.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Reason Code</label>
              <select
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs"
              >
                <option value="Customer left / no-show">Customer left / no-show</option>
                <option value="Customer changed mind">Customer changed mind</option>
                <option value="Duplicate ticket issued">Duplicate ticket issued</option>
                <option value="Payment / budget issue">Payment / budget issue</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setRemovingVisit(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={async () => {
                  await removeFromQueueAction(removingVisit.id, removeReason);
                  setRemovingVisit(null);
                  await loadQueueAndDraft();
                }}
              >
                Confirm Removal
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* REASSIGN STYLIST MODAL (Reason Mandatory) */}
      {reassigningLine && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Reassign Line to Another Stylist</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Stylist</label>
                <select
                  value={newStylistId}
                  onChange={(e) => setNewStylistId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                >
                  <option value="">Select stylist...</option>
                  {stylists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                  placeholder="e.g. Current stylist busy with complex braid"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setReassigningLine(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newStylistId}
                onClick={async () => {
                  await reassignLineAction(reassigningLine.lineId, newStylistId, reassignReason);
                  setReassigningLine(null);
                  await loadQueueAndDraft();
                }}
                className="bg-primary text-white font-bold"
              >
                Reassign Line
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* REQUEST MANAGER APPROVAL MODAL (Started Line Removal or Dispute) */}
      {managerRequestModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Request Manager Approval</h3>
            </div>
            <p className="text-xs text-slate-600">
              {managerRequestModal.kind === 'remove_started_line'
                ? 'A service line that has already started cannot be cancelled by reception. Requesting approval will alert Joan Tumusiime.'
                : 'Price dispute adjustments require manager authorization.'}
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Reason for Request</label>
              <textarea
                value={managerRequestReason}
                onChange={(e) => setManagerRequestReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-xs"
                placeholder="Explain the situation clearly for the manager..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setManagerRequestModal(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!managerRequestReason.trim()}
                onClick={async () => {
                  await requestManagerApprovalAction({
                    kind: managerRequestModal.kind,
                    visit_id: managerRequestModal.visitId,
                    reason: managerRequestReason,
                    details: { line_id: managerRequestModal.lineId },
                  });
                  setManagerRequestModal(null);
                  setManagerRequestReason('');
                  showToast('Request sent to manager Approvals inbox.');
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Send Request
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ON-BEHALF ACTION MODAL (Start or Finish Line on Behalf of Staff) */}
      {actionLineModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {actionLineModal.actionType === 'start' ? 'Start Service Line' : 'Finish Service Line'} on Behalf
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Acting on behalf of <span className="font-semibold text-slate-800">{actionLineModal.staffName}</span> for{' '}
                <span className="font-semibold text-slate-800">{actionLineModal.variantName}</span>.
              </p>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Reason Code / Audit Explanation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={actionLineReason}
                onChange={(e) => setActionLineReason(e.target.value)}
                placeholder="Reason required for compliance..."
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-[#1F4FD8] outline-hidden"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Staff phone unavailable',
                  'Assisting client hands-full',
                  'Client walked to station',
                  'Client completed early',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setActionLineReason(sample)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => {
                  setActionLineModal(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!actionLineReason.trim() || actionLoading}
                onClick={async () => {
                  setActionLoading(true);
                  setActionError(null);
                  try {
                    if (actionLineModal.actionType === 'start') {
                      const res = await startLineOnBehalfAction(actionLineModal.lineId, actionLineReason.trim());
                      if (!res.success) {
                        setActionError(res.error?.message || 'Failed to start line.');
                        setActionLoading(false);
                        return;
                      }
                    } else {
                      const res = await finishLineOnBehalfAction(actionLineModal.lineId, actionLineReason.trim());
                      if (!res.success) {
                        setActionError(res.error?.message || 'Failed to finish line.');
                        setActionLoading(false);
                        return;
                      }
                    }
                    setActionLineModal(null);
                    await loadQueueAndDraft();
                  } catch (e: any) {
                    setActionError(e?.message || 'An unexpected error occurred.');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                className={
                  actionLineModal.actionType === 'start'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                }
              >
                {actionLoading ? 'Processing...' : actionLineModal.actionType === 'start' ? 'Confirm Start' : 'Confirm Finish'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* OPEN DAY MODAL FOR RECEPTIONIST */}
      <OpenDayModal
        isOpen={openDayModalOpen}
        onClose={() => setOpenDayModalOpen(false)}
        onSuccess={async () => {
          await loadInitialData();
          await loadQueueAndDraft();
        }}
        role="receptionist"
      />
    </div>
  );
}
