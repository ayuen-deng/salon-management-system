'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import { subscribeToKioskBusinessDayChanges } from '@/shared/lib/salon-live-updates';
import { formatUGX } from '@/shared/models/money';
import { isValidUgPhone } from '@/shared/models/phone';
import { fetchKioskCatalogueAction, ServiceItem, ServiceVariant } from '@/modules/catalogue';
import { createKioskOrderAction, getKioskBusinessDayStatusAction, pairKioskDeviceAction } from '../controllers/kiosk-order.actions';
import {
  Scissors,
  Sparkles,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  ChevronRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
  X,
  RotateCcw,
  Loader2,
} from 'lucide-react';

interface CartItem {
  variant: ServiceVariant;
  service: ServiceItem;
  quantity: number;
}

export function DeskTabletView() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');
  const [pairingChecked, setPairingChecked] = useState(false);
  const [businessDayStatus, setBusinessDayStatus] = useState<'loading' | 'open' | 'closed' | 'offline'>('loading');
  const previousBusinessDayStatus = useRef<'loading' | 'open' | 'closed' | 'offline'>('loading');
  const [expectedOpen, setExpectedOpen] = useState('08:00');
  const [catalogue, setCatalogue] = useState<ServiceItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [selectedAudience, setSelectedAudience] = useState<'men' | 'women'>('men');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'pair' | 'welcome' | 'kiosk' | 'review' | 'phone_confirm' | 'order'>('pair');
  const [phone, setPhone] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [confirmedOrder, setConfirmedOrder] = useState<{
    code: string;
    waitMinutes: number;
    totalUgx: number;
    phone: string;
  } | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);

  // Variant bottom selection drawer state
  const [selectedServiceForVariant, setSelectedServiceForVariant] = useState<ServiceItem | null>(null);

  // Idle timeout (60 seconds resets to welcome screen)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshCatalogue = useCallback(async () => {
    setCatalogueLoading(true);
    try {
      const res = await fetchKioskCatalogueAction();
      if (res.success && res.data) setCatalogue(res.data);
    } finally {
      setCatalogueLoading(false);
    }
  }, []);

  useSalonLiveRefresh(() => { void refreshCatalogue(); }, true, ['service', 'service_variant', 'app_setting']);

  useEffect(() => {
    try {
      const savedToken = window.localStorage.getItem('mzuri-kiosk-device-session');
      if (savedToken) {
        setSessionToken(savedToken);
        setStep('welcome');
      }
    } finally {
      setPairingChecked(true);
    }
  }, []);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (step !== 'welcome') {
      idleTimerRef.current = setTimeout(() => {
        resetKiosk();
      }, 60000);
    }
  };

  useEffect(() => {
    const handleUserActivity = () => resetIdleTimer();
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [step]);

  useEffect(() => {
    if (!sessionToken) return;
    void refreshCatalogue();
  }, [sessionToken, refreshCatalogue]);

  // Filter catalogue by Audience (Men / Women / Both)
  const audienceFilteredCatalogue = useMemo(() => {
    return catalogue.filter((item) => {
      if (selectedAudience === 'men') {
        return item.audience === 'men' || item.audience === 'both';
      } else {
        return item.audience === 'women' || item.audience === 'both';
      }
    });
  }, [catalogue, selectedAudience]);

  // Extract distinct categories for the selected audience
  const categories = useMemo(() => {
    const set = new Set<string>();
    audienceFilteredCatalogue.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [audienceFilteredCatalogue]);

  // Filter catalogue by category & search
  const visibleServices = useMemo(() => {
    return audienceFilteredCatalogue.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.variants.some((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [audienceFilteredCatalogue, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (variant: ServiceVariant, service: ServiceItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.variant.id === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variant.id === variant.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { variant, service, quantity: 1 }];
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.variant.id === variantId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.variant.id === variantId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prev.filter((item) => item.variant.id !== variantId);
    });
  };

  const clearCart = () => setCart([]);

  const cartTotalUGX = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.variant.list_price_ugx * item.quantity, 0);
  }, [cart]);

  const cartTotalMinutes = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.variant.expected_minutes * item.quantity, 0);
  }, [cart]);

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Handle number pad for phone input
  const handleKeypadPress = (digit: string) => {
    if (phone.length < 10) {
      setPhone((prev) => prev + digit);
    }
  };

  const handleKeypadDelete = () => {
    setPhone((prev) => prev.slice(0, -1));
  };

  const handlePairTablet = async (event: React.FormEvent) => {
    event.preventDefault();
    setPairingError('');
    setPairingLoading(true);
    try {
      const result = await pairKioskDeviceAction(pairingCode);
      if (result.success && result.data) {
        window.localStorage.setItem('mzuri-kiosk-device-session', result.data.sessionToken);
        setSessionToken(result.data.sessionToken);
        setBusinessDayStatus('loading');
        previousBusinessDayStatus.current = 'loading';
        setStep('welcome');
      } else if (!result.success) {
        setPairingError(result.error.message);
      }
    } catch {
      setPairingError('Could not pair this tablet. Check the connection and try again.');
    } finally {
      setPairingLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) { setBusinessDayStatus('loading'); return; }
    let disposed = false;
    let checking = false;
    const checkDay = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await getKioskBusinessDayStatusAction(sessionToken);
        if (disposed) return;
        if (result.success) {
          setExpectedOpen(result.data.expected_open);
          const nextStatus = result.data.is_open ? 'open' : 'closed';
          if (nextStatus === 'open' && previousBusinessDayStatus.current === 'closed') setStep('welcome');
          previousBusinessDayStatus.current = nextStatus;
          setBusinessDayStatus(nextStatus);
        } else if (result.error.code === 'FORBIDDEN') {
          window.localStorage.removeItem('mzuri-kiosk-device-session');
          setSessionToken(null);
          previousBusinessDayStatus.current = 'loading';
          setStep('pair');
        } else setBusinessDayStatus('offline');
      } catch {
        if (!disposed) setBusinessDayStatus('offline');
      } finally { checking = false; }
    };
    void checkDay();
    const unsubscribe = subscribeToKioskBusinessDayChanges(() => { void checkDay(); });
    const interval = window.setInterval(() => { void checkDay(); }, 30_000);
    const handleResume = () => { if (document.visibilityState === 'visible') void checkDay(); };
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);
    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [sessionToken]);

  const handleCreateOrder = async () => {
    if (submitLockRef.current || orderLoading) return;
    if (!sessionToken) {
      setStep('pair');
      return;
    }
    if (cart.length === 0 || !isValidUgPhone(phone) || !firstName.trim()) {
      setOrderError('Enter your first name and a valid Uganda phone number, then try again.');
      return;
    }
    submitLockRef.current = true;
    setOrderLoading(true);
    setOrderError('');
    idempotencyKeyRef.current ||= crypto.randomUUID();
    try {
      const result = await createKioskOrderAction({
        sessionToken,
        idempotencyKey: idempotencyKeyRef.current,
        firstName,
        phone,
        lines: cart.map((item) => ({ variantId: item.variant.id, quantity: item.quantity })),
      });
      if (result.success) {
        const normalizedPhone = result.data.phone;
        const nationalPhone = normalizedPhone.startsWith('+256') ? `0${normalizedPhone.slice(4)}` : phone;
        setFirstName(result.data.first_name);
        setConfirmedOrder({
          code: result.data.order_code,
          waitMinutes: result.data.wait_minutes,
          totalUgx: result.data.total_ugx,
          phone: nationalPhone.length === 10 ? `${nationalPhone.slice(0, 4)} *** ${nationalPhone.slice(-3)}` : '••••••••••',
        });
        idempotencyKeyRef.current = null;
        setStep('order');
      } else {
        setOrderError(result.error.message);
        if (result.error.code === 'FORBIDDEN') {
          window.localStorage.removeItem('mzuri-kiosk-device-session');
          setSessionToken(null);
          setStep('pair');
        }
      }
    } catch {
      setOrderError('Could not place your order. Check the connection and try again.');
    } finally {
      submitLockRef.current = false;
      setOrderLoading(false);
    }
  };

  const resetKiosk = () => {
    setCart([]);
    setPhone('');
    setFirstName('');
    setConfirmedOrder(null);
    setOrderError('');
    idempotencyKeyRef.current = null;
    setSelectedServiceForVariant(null);
    setStep(sessionToken ? 'welcome' : 'pair');
    setSelectedCategory('all');
    setSearchQuery('');
  };

  useEffect(() => {
    if (step !== 'order') return;
    const timer = window.setTimeout(resetKiosk, 15000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const phoneError = phone.length >= 2 && !phone.startsWith('07')
    ? 'Use a Uganda mobile number starting with 07.'
    : phone.length === 10 && !isValidUgPhone(phone)
      ? 'Enter a valid Uganda mobile number.'
      : '';

  const capitalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

  if (!pairingChecked) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] p-6 font-sans text-[#1F2328]" aria-busy="true" data-loading="true">
        <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-[#E4E1DA] bg-white px-6 py-5">
          <h1 className="text-xl font-bold tracking-tight">Mzuri Unisex Salon</h1>
          <span className="text-sm text-slate-600">Mbarara</span>
        </header>
        <section className="mx-auto mt-10 max-w-5xl rounded-3xl border border-[#CBD5E1] bg-white p-6 shadow-sm sm:p-8" aria-label="Preparing kiosk">
          <h2 className="text-2xl font-bold">Preparing this tablet</h2>
          <p className="mt-2 text-sm text-slate-600">Checking tablet pairing and loading salon services…</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden="true">
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </section>
      </div>
    );
  }

  if (step === 'pair') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2] p-6 font-sans text-[#1F2328]">
        <form onSubmit={handlePairTablet} className="w-full max-w-md rounded-3xl border border-[#CBD5E1] bg-white p-8 shadow-sm space-y-5">
          <div><p className="text-sm font-semibold text-[#1F4FD8]">Mzuri Unisex Salon</p><h1 className="mt-2 text-2xl font-bold">Pair this tablet</h1><p className="mt-2 text-sm text-slate-600">Enter the six-digit pairing code provided by the manager.</p></div>
          {pairingError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{pairingError}</p>}
          <label className="block text-sm font-semibold">Pairing code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.3em]" /></label>
          <button disabled={pairingLoading || pairingCode.length !== 6} className="w-full rounded-xl bg-[#1F4FD8] px-4 py-3 font-bold text-white disabled:opacity-50">{pairingLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Pairing…</span> : 'Pair tablet'}</button>
        </form>
      </div>
    );
  }

  if (sessionToken && businessDayStatus === 'loading') {
    return <div className="min-h-screen bg-[#F6F5F2] p-8" aria-label="Checking salon status"><div className="mx-auto mt-24 h-48 max-w-3xl animate-pulse rounded-3xl bg-white shadow-sm" /></div>;
  }

  if (sessionToken && businessDayStatus === 'offline') {
    return <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-8 text-center"><h1 className="text-3xl font-bold">Mzuri Unisex Salon</h1><p className="mt-4 text-lg text-slate-700">We can&apos;t connect right now. Please ask at the reception desk.</p><p className="mt-3 text-sm text-slate-500">Checking again automatically…</p></div>;
  }

  if (sessionToken && businessDayStatus === 'closed' && (step === 'welcome' || step === 'kiosk')) {
    return <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-8 text-center"><h1 className="text-3xl font-bold text-[#1F2328]">Mzuri Unisex Salon</h1><p className="mt-5 text-xl font-medium text-slate-700">We are not taking orders yet. Please ask at the reception desk.</p><p className="mt-2 text-base text-slate-600">We open at {expectedOpen}</p></div>;
  }

  // 1. WELCOME SCREEN WITH HERO PHOTO & MEN / WOMEN PHOTO TILES
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-between select-none font-sans text-[#1F2328]">
        {/* Top Brand Bar */}
        <header className="px-8 py-6 flex items-center justify-between border-b border-[#E4E1DA] bg-white">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl  font-bold tracking-tight text-[#1F2328]">Mzuri Unisex Salon</h1>
            <span className="text-xs  tracking-normal text-[#1F4FD8] font-semibold border-l border-[#CBD5E1] pl-3">
              Mbarara
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Touch screen to explore services</span>
        </header>

        {/* Hero Section */}
        <div className="max-w-5xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2328]">Welcome to Mzuri Unisex Salon</h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Select your service section below to browse treatments, hairstyles, and grooming services.
            </p>
          </div>

          {/* Men / Women Visual Photo Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full mx-auto">
            {/* Men's Services Tile */}
            <button
              type="button"
              onClick={() => {
                setSelectedAudience('men');
                setSelectedCategory('all');
                setStep('kiosk');
              }}
              className="group relative rounded-3xl overflow-hidden border border-[#CBD5E1] bg-white shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col h-80 focus:outline-none focus:ring-4 focus:ring-[#1F4FD8]/30"
            >
              <div className="relative flex-1 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80"
                  alt="Men's Grooming"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <span className="text-[11px] font-bold  tracking-normal text-[#1F4FD8] bg-white/90 px-2.5 py-1 rounded-full inline-block mb-2">
                    Grooming & Cuts
                  </span>
                  <h3 className="text-2xl  font-bold">Men&apos;s Services</h3>
                  <p className="text-xs text-slate-200 mt-1">Haircuts, fades, beard care, trims & hot towel shaves</p>
                </div>
              </div>
            </button>

            {/* Women's Services Tile */}
            <button
              type="button"
              onClick={() => {
                setSelectedAudience('women');
                setSelectedCategory('all');
                setStep('kiosk');
              }}
              className="group relative rounded-3xl overflow-hidden border border-[#CBD5E1] bg-white shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col h-80 focus:outline-none focus:ring-4 focus:ring-[#1F4FD8]/30"
            >
              <div className="relative flex-1 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=800&q=80"
                  alt="Women's Styling & Treatments"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <span className="text-[11px] font-bold  tracking-normal text-[#1F4FD8] bg-white/90 px-2.5 py-1 rounded-full inline-block mb-2">
                    Styling & Beauty
                  </span>
                  <h3 className="text-2xl  font-bold">Women&apos;s Services</h3>
                  <p className="text-xs text-slate-200 mt-1">Braids, weaves, natural hair, treatments, nails & makeup</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-6 text-center text-xs text-muted-foreground border-t border-[#E4E1DA] bg-white">
          Payment is made at the reception desk before service begins • No booking fee
        </footer>
      </div>
    );
  }

  // 2. ORDER CONFIRMATION SCREEN (payment and queue placement happen at reception)
  if (step === 'order' && confirmedOrder) {
    return (
      <div className="min-h-screen bg-[#1F2328] text-white flex flex-col justify-between p-8 select-none font-sans">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl  font-bold tracking-tight text-white">Mzuri Unisex Salon</h1>
            <span className="text-xs text-[#1F4FD8]  tracking-normal">Mbarara</span>
          </div>
          <span className="text-xs bg-[#1F4FD8]/20 text-[#1F4FD8] px-3 py-1 rounded-full font-semibold border border-[#1F4FD8]/40">
              Order placed
          </span>
        </div>

        <div className="max-w-lg w-full mx-auto text-center space-y-6 py-6">
          <div className="w-16 h-16 bg-[#1F4FD8]/20 text-[#1F4FD8] border border-[#1F4FD8]/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs  tracking-normal text-slate-400 font-semibold block mb-2">
              Your order number
            </span>
            <div className="text-7xl sm:text-8xl tabular-nums font-bold tracking-normal text-[#1F4FD8] py-6 px-8 bg-black/40 rounded-3xl border border-slate-700 shadow-2xl">
              {confirmedOrder.code}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-2.5 text-left text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Client:</span>
              <span className="font-bold text-white">{firstName || 'Guest'} ({confirmedOrder.phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Services ({totalItemCount}):</span>
              <span className="font-semibold text-slate-200 text-right truncate max-w-[200px]">
                {cart.map((c) => c.variant.name).join(', ')}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-slate-400">Estimated wait after payment:</span>
              <span className="font-bold text-white">About {confirmedOrder.waitMinutes} minutes</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2 text-sm">
              <span className="text-slate-300 font-semibold">Estimated total, confirmed at the desk:</span>
              <span className="font-bold text-[#1F4FD8] tabular-nums">{formatUGX(confirmedOrder.totalUgx)}</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 text-[11px] text-slate-400">
            Please go to the reception desk to pay. Your place in the queue starts after payment.
          </div>
        </div>

        <div className="max-w-md w-full mx-auto">
          <button
            onClick={resetKiosk}
            className="w-full py-4 rounded-2xl bg-[#1F4FD8] hover:bg-[#85683F] text-white font-bold text-sm shadow-lg transition-all"
          >
            Start New Order
          </button>
        </div>
      </div>
    );
  }

  // 3. PHONE & GUEST IDENTIFICATION SCREEN
  if (step === 'phone_confirm') {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-between p-6 select-none font-sans text-[#1F2328]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#E4E1DA] pb-4 bg-white -mx-6 -mt-6 p-6">
          <button
            onClick={() => setStep('review')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-slate-700 font-semibold text-xs hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Summary
          </button>
          <div className="text-center">
            <h2 className="text-base  font-bold text-[#1F2328]">Confirm Your Visit Details</h2>
            <p className="text-[11px] text-slate-500">First name & phone number for your visit record</p>
          </div>
          <div className="w-24"></div>
        </div>

        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
          {/* Keypad & Phone input */}
          <div className="bg-white border border-[#CBD5E1] rounded-3xl p-6 shadow-xs space-y-4">
            <label className="text-xs font-bold text-slate-700  tracking-normal block">
              Enter Uganda Phone Number (07...)
            </label>
            <div className="h-14 bg-slate-50 border border-[#CBD5E1] rounded-2xl flex items-center justify-center px-4 tabular-nums text-xl font-bold text-[#1F2328] tracking-normal">
              {phone || '07 _ _  _ _ _  _ _ _'}
            </div>
            {phoneError && <p role="alert" className="text-xs font-medium text-rose-600">{phoneError}</p>}

            <div className="grid grid-cols-3 gap-2 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="h-13 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-[#CBD5E1] text-lg font-bold text-slate-800 shadow-2xs transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleKeypadDelete}
                className="h-13 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-[#CBD5E1] text-xs font-semibold text-rose-600 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                className="h-13 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-[#CBD5E1] text-lg font-bold text-slate-800 shadow-2xs transition-colors"
              >
                0
              </button>
              <button
                onClick={() => {
                  if (phone.length === 10) setStep('phone_confirm');
                }}
                className="h-13 rounded-2xl bg-slate-50 border border-[#CBD5E1] text-xs font-bold text-slate-500"
              >
                OK
              </button>
            </div>
          </div>

          {/* First Name & Order Recap */}
          <div className="bg-white border border-[#CBD5E1] rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700  tracking-normal block mb-1">
                  What is your first name?
                </label>
                <input
                  type="text"
                  placeholder="e.g. David, Grace, Ronald"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onBlur={(e) => setFirstName(capitalizeName(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-[#CBD5E1] font-bold text-sm text-[#1F2328] focus:outline-none focus:ring-2 focus:ring-[#1F4FD8]"
                />
              </div>

              <div className="bg-slate-50 border border-[#CBD5E1] rounded-2xl p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block text-xs">Selected Services</span>
                <div className="divide-y divide-slate-200 max-h-40 overflow-y-auto">
                  {cart.map((c) => (
                    <div key={c.variant.id} className="py-1.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {c.quantity}x {c.variant.name} ({c.service.name})
                      </span>
                      <span className="font-bold text-[#1F2328] tabular-nums">
                        {formatUGX(c.variant.list_price_ugx * c.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-[#1F2328]">
                  <span>Estimated total</span>
                  <span className="tabular-nums text-[#1F4FD8]">{formatUGX(cartTotalUGX)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                We keep your phone number strictly for your salon visit record. No SMS messages are sent.
              </p>
            </div>

            {businessDayStatus === 'closed' && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The business day has closed. Please ask at the reception desk.</p>}
            {orderError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{orderError}</p>}
            <button
              onClick={handleCreateOrder}
              disabled={orderLoading || businessDayStatus !== 'open' || !isValidUgPhone(phone) || !firstName.trim() || cart.length === 0}
              className="w-full py-3.5 rounded-2xl bg-[#1F4FD8] hover:bg-[#85683F] text-white font-bold text-sm shadow-md transition-all disabled:opacity-60"
            >
              {orderLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Placing order…</span> : 'Place order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. REVIEW BASKET SCREEN
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-between p-6 select-none font-sans text-[#1F2328]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#E4E1DA] pb-4 bg-white -mx-6 -mt-6 p-6">
          <button
            onClick={() => setStep('kiosk')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-slate-700 font-semibold text-xs hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" /> Add More Services
          </button>
          <div className="text-center">
            <h2 className="text-base  font-bold text-[#1F2328]">Review Your Order</h2>
            <p className="text-[11px] text-slate-500">{totalItemCount} items selected</p>
          </div>
          <button
            onClick={clearCart}
            className="text-xs font-semibold text-rose-600 hover:underline px-2 py-1"
          >
            Clear All
          </button>
        </div>

        {/* Selected Items */}
        <div className="max-w-2xl w-full mx-auto py-6 space-y-3 flex-1 overflow-y-auto">
          {cart.map((item) => (
            <div
              key={item.variant.id}
              className="bg-white border border-[#CBD5E1] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs"
            >
              <div>
                <h4 className="font-bold text-sm text-[#1F2328]">{item.variant.name}</h4>
                <p className="text-xs text-muted-foreground">{item.service.name} • ~{item.variant.expected_minutes} mins</p>
                <div className="text-xs font-bold text-[#1F4FD8] tabular-nums mt-1">
                  {formatUGX(item.variant.list_price_ugx)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => removeFromCart(item.variant.id)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#CBD5E1] flex items-center justify-center text-slate-700"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-bold text-xs text-[#1F2328] tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addToCart(item.variant, item.service)}
                  className="w-8 h-8 rounded-xl bg-[#1F4FD8] hover:bg-[#85683F] text-white flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-[#CBD5E1] pt-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Estimated Service Time:</span>
              <span className="font-bold text-slate-700">~{cartTotalMinutes} minutes</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-[#1F2328]">
              <span>Total Price:</span>
              <span className="text-[#1F4FD8] tabular-nums">{formatUGX(cartTotalUGX)}</span>
            </div>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto">
          <button
            onClick={() => setStep('phone_confirm')}
            className="w-full py-4 rounded-2xl bg-[#1F4FD8] hover:bg-[#85683F] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            Continue to Identification <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 5. MAIN KIOSK BROWSING INTERFACE (Image-Led, KFC-Style Layout)
  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col font-sans select-none text-[#1F2328]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#CBD5E1] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep('welcome')}
            className="text-left group"
          >
            <h1 className="text-xl  font-bold tracking-tight text-[#1F2328] group-hover:text-[#1F4FD8] transition-colors">
              Mzuri Unisex Salon
            </h1>
            <p className="text-[11px] text-muted-foreground">Self-Order Kiosk • Mbarara</p>
          </button>
        </div>

        {/* Men / Women Segmented Selector */}
        <div className="flex items-center p-1 bg-[#F6F5F2] rounded-2xl border border-[#CBD5E1] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedAudience('men');
              setSelectedCategory('all');
            }}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              selectedAudience === 'men'
                ? 'bg-white text-[#1F2328] shadow-xs border border-[#CBD5E1]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-[#1F4FD8]" />
            Men&apos;s Services
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedAudience('women');
              setSelectedCategory('all');
            }}
            className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
              selectedAudience === 'women'
                ? 'bg-white text-[#1F2328] shadow-xs border border-[#CBD5E1]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1F4FD8]" />
            Women&apos;s Services
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#F6F5F2] border border-[#CBD5E1] rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#1F4FD8]"
          />
        </div>
      </header>

      {/* Main Container: Left Category Rail + Right 4:3 Image Cards */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Category Rail */}
        <aside className="w-48 sm:w-56 bg-white border-r border-[#CBD5E1] flex flex-col p-3 gap-1 overflow-y-auto shrink-0 shadow-2xs">
          <span className="text-[10px]  tracking-normal font-bold text-slate-400 px-3 py-1">
            Categories
          </span>

          <button
            onClick={() => setSelectedCategory('all')}
            className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
              selectedCategory === 'all'
                ? 'bg-[#1F4FD8]/10 text-[#1F4FD8] font-bold border border-[#1F4FD8]/30'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <span>All Services</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                selectedCategory === cat
                  ? 'bg-[#1F4FD8]/10 text-[#1F4FD8] font-bold border border-[#1F4FD8]/30'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span className="truncate">{cat}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ))}
        </aside>

        {/* Right Grid of 4:3 Image Cards */}
        <main className="flex-1 p-6 overflow-y-auto pb-32">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base  font-bold text-[#1F2328]">
              {selectedCategory === 'all' ? `All ${selectedAudience}'s Services` : selectedCategory}
            </h2>
            <span className="text-xs text-muted-foreground">{visibleServices.length} items</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {catalogueLoading && <div className="col-span-full rounded-2xl border border-[#CBD5E1] bg-white p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1F4FD8]" />Loading services…</div>}
            {!catalogueLoading && visibleServices.length === 0 && <div className="col-span-full rounded-2xl border border-[#CBD5E1] bg-white p-8 text-center"><p className="font-semibold">No services are available here right now.</p><p className="mt-1 text-sm text-slate-500">Please ask at the reception desk for assistance.</p></div>}
            {visibleServices.map((service) => {
              // Find lowest price
              const minPrice = service.variants.length > 0
                ? Math.min(...service.variants.map((v) => v.list_price_ugx))
                : 0;

              return (
                <div
                  key={service.id}
                  className="bg-white border border-[#CBD5E1] rounded-3xl overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* 4:3 Image Area */}
                  <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                    {service.image_url ? (
                      <img
                        src={service.image_url}
                        alt={service.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1F4FD8]/10 flex items-center justify-center text-[#1F4FD8]">
                        <Scissors className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-slate-800 shadow-2xs backdrop-blur-xs flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      ~{service.default_minutes}m
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400  tracking-normal block mb-1">
                        {service.category}
                      </span>
                      <h3 className="font-bold text-sm text-[#1F2328] group-hover:text-[#1F4FD8] transition-colors">
                        {service.name}
                      </h3>
                      {service.subcategory && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{service.subcategory}</p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Starting from</span>
                        <span className="text-xs font-bold text-[#1F2328] tabular-nums">
                          {formatUGX(minPrice)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedServiceForVariant(service)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1F4FD8] hover:bg-[#85683F] text-white text-xs font-bold shadow-2xs transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Select
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* 6. BOTTOM VARIANT SELECTION SHEET (Drawer when a service is clicked) */}
      {selectedServiceForVariant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-3">
              <div>
                <h3 className="text-base  font-bold text-[#1F2328]">
                  {selectedServiceForVariant.name}
                </h3>
                <p className="text-xs text-muted-foreground">Select option or hair length</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceForVariant(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedServiceForVariant.variants.map((v) => {
                const cartItem = cart.find((item) => item.variant.id === v.id);
                const isSelected = Boolean(cartItem);

                return (
                  <div
                    key={v.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#1F4FD8]/10 border-[#1F4FD8] text-[#1F2328]'
                        : 'bg-white border-[#CBD5E1] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-[#1F2328]">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Duration: ~{v.expected_minutes} mins</div>
                      <div className="text-xs font-bold text-[#1F4FD8] tabular-nums mt-1">
                        {formatUGX(v.list_price_ugx)}
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => removeFromCart(v.id)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-[#1F2328] tabular-nums">
                          {cartItem?.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(v, selectedServiceForVariant)}
                          className="w-7 h-7 rounded-lg bg-[#1F4FD8] hover:bg-[#85683F] text-white flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(v, selectedServiceForVariant)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1F4FD8] hover:bg-[#85683F] text-white text-xs font-bold shadow-2xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedServiceForVariant(null)}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FLOATING BASKET BAR */}
      {cart.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#CBD5E1] p-4 shadow-2xl z-40">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-[#1F4FD8] text-white flex items-center justify-center shadow-md">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                  {totalItemCount}
                </span>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground font-medium">Selected Services ({totalItemCount})</div>
                <div className="text-base font-bold text-[#1F2328] tabular-nums">{formatUGX(cartTotalUGX)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="px-6 py-2.5 rounded-xl bg-[#1F4FD8] hover:bg-[#85683F] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                Review & Confirm <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
