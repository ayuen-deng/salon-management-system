'use client';

import React, { useMemo, useState } from 'react';
import { DetailModal } from '@/shared/views/ui/detail-modal';
import { Button } from '@/shared/views/ui/button';
import { Search, Check, X } from 'lucide-react';

export interface StaffSkillOption {
  id: string;
  name: string;
  category: string;
}

interface StaffSkillsEditorProps {
  staffName: string;
  services: StaffSkillOption[];
  selectedIds: string[];
  isOpen: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (selectedIds: string[]) => Promise<void>;
}

const CATEGORIES = ['Haircuts', 'Hair care and treatments', 'Colour', 'Braids and styling', 'Massage', 'Makeup', 'Nails', 'Skin and facials', 'Brows and lashes'];

export function StaffSkillsEditor({ staffName, services, selectedIds, isOpen, saving = false, error, onClose, onSave }: StaffSkillsEditorProps) {
  const [selection, setSelection] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState('');
  React.useEffect(() => { setSelection(selectedIds); setSearch(''); }, [selectedIds, isOpen]);

  const filtered = useMemo(() => services.filter((service) => service.name.toLowerCase().includes(search.toLowerCase())), [services, search]);
  const grouped = useMemo(() => CATEGORIES.map((category) => ({
    category,
    services: filtered.filter((service) => service.category === category),
  })).filter((group) => group.services.length > 0), [filtered]);

  function toggle(id: string) {
    setSelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleCategory(category: string, checked: boolean) {
    const ids = services.filter((service) => service.category === category).map((service) => service.id);
    setSelection((current) => checked ? Array.from(new Set([...current, ...ids])) : current.filter((id) => !ids.includes(id)));
  }

  const footer = <div className="flex items-center justify-between gap-3">
    <span className="text-xs text-slate-600">{selection.length} of {services.length} selected</span>
    <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={() => onSave(selection)}>{saving ? 'Saving…' : 'Save skills'}</Button></div>
  </div>;

  return <DetailModal isOpen={isOpen} onClose={onClose} title={`Skills · ${staffName}`} subtitle="Assign active salon services to this staff member" footer={footer} maxWidthClass="max-w-4xl">
    <label className="relative block"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services…" aria-label="Search services" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></label>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {grouped.map(({ category, services: group }) => {
        const allSelected = group.every((service) => selection.includes(service.id));
        return <section key={category} className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-200"><h3 className="font-semibold text-sm">{category}</h3><button type="button" onClick={() => toggleCategory(category, !allSelected)} className="text-xs font-medium text-primary hover:underline">{allSelected ? 'Clear category' : 'Select all'}</button></div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">{group.map((service) => <label key={service.id} className="flex gap-2 items-center px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={selection.includes(service.id)} onChange={() => toggle(service.id)} className="accent-blue-700"/><span className="min-w-0 flex-1">{service.name}</span>{selection.includes(service.id) && <Check className="w-4 h-4 text-emerald-600"/>}</label>)}</div>
        </section>;
      })}
    </div>
    {grouped.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No matching services.</p>}
  </DetailModal>;
}
