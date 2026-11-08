'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useNotifications } from '../controllers/use-notifications';

export function NotificationBell() {
  const { items, loading, toast, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const unread = items.filter((item) => !item.read_at).length;

  return <div className="relative">
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {toast && <div role="status" className="fixed right-4 top-16 z-[60] max-w-xs rounded-lg border border-border bg-card px-4 py-3 text-xs text-foreground shadow-lg">{toast}</div>}
    {open && <div className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Notifications</h2><span className="text-xs text-muted-foreground">{unread} unread</span></div>
      <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
        {loading ? <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading</div> : items.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">You’re all caught up.</p> : items.map((item) => <div key={item.id} className={`border-b border-border/60 p-3 ${item.read_at ? '' : 'bg-primary/5'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString('en-GB',{timeZone:'Africa/Kampala',dateStyle:'medium',timeStyle:'short'})}</p>{item.link && <Link href={item.link} onClick={()=>setOpen(false)} className="mt-2 inline-block text-xs font-medium text-primary underline">Open</Link>}</div>{!item.read_at && <button type="button" aria-label="Mark as read" onClick={()=>void markRead(item.id)} className="rounded-md p-1 text-primary hover:bg-primary/10"><Check className="h-4 w-4" /></button>}</div></div>)}
      </div>
    </div>}
  </div>;
}
