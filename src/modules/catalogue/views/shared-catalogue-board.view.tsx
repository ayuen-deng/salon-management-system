'use client';

import { showToast } from '@/shared/lib/toast';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { formatUGX } from '@/shared/models/money';
import {
  getCatalogueAction,
  getRecentOwnerChangesAction,
  markOwnerChangesAsSeenAction,
  getPriceHistoryAction,
  addServiceAction,
  addVariantAction,
  updatePriceAction,
  toggleActiveAction,
  updateStaffSkillsAction,
  importCsvAction,
  updateServiceMetadataAction,
  getCanonicalCategoriesAction,
  updateCanonicalCategoriesAction,
  type CatalogueServiceItem,
  type CatalogueVariantItem,
  type CataloguePriceHistoryItem,
  type CatalogueChangeItem,
  type CatalogueStaffOption,
} from '../controllers/catalogue.actions';
import {
  Plus,
  Edit2,
  Download,
  Upload,
  History,
  CheckCircle2,
  AlertCircle,
  Tag,
  Scissors,
  Users,
  Eye,
  Check,
  X,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Star,
  ArrowUpDown,
  FolderCog,
} from 'lucide-react';

interface SharedCatalogueBoardProps {
  userRole: 'owner' | 'manager';
}

export function SharedCatalogueBoardView({ userRole }: SharedCatalogueBoardProps) {
  const [services, setServices] = useState<CatalogueServiceItem[]>([]);
  const [staff, setStaff] = useState<CatalogueStaffOption[]>([]);
  const [ownerChanges, setOwnerChanges] = useState<CatalogueChangeItem[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; icon: string; sort_order: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modals & Drawers state
  const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
  const [manageCategoriesModalOpen, setManageCategoriesModalOpen] = useState(false);
  const [editImageModalService, setEditImageModalService] = useState<CatalogueServiceItem | null>(null);
  const [addVariantModalService, setAddVariantModalService] = useState<CatalogueServiceItem | null>(null);
  const [priceHistoryVariant, setPriceHistoryVariant] = useState<CatalogueVariantItem | null>(null);
  const [priceHistoryItems, setPriceHistoryItems] = useState<CataloguePriceHistoryItem[]>([]);
  const [priceAdjustmentVariant, setPriceAdjustmentVariant] = useState<{ variant: CatalogueVariantItem; serviceName: string } | null>(null);
  const [staffSkillsService, setStaffSkillsService] = useState<CatalogueServiceItem | null>(null);
  const [importCsvModalOpen, setImportCsvModalOpen] = useState(false);

  // Form states
  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: '',
    existingCategory: '',
    defaultMinutes: 30,
    featured: false,
    sortOrder: 10,
    imageUrl: '',
    variantName: 'Standard',
    listPrice: 30000,
    minPrice: 25000,
    maxPrice: 35000,
    minutes: 30,
    assignmentType: 'all' as 'all' | 'custom',
    assignedStaffIds: [] as string[],
  });

  const [imageUploadState, setImageUploadState] = useState<{
    uploading: boolean;
    previewUrl: string | null;
    error: string | null;
  }>({ uploading: false, previewUrl: null, error: null });

  const [editImageForm, setEditImageForm] = useState<{
    imageUrl: string;
    featured: boolean;
    sortOrder: number;
    previewUrl: string | null;
    uploading: boolean;
    error: string | null;
  }>({ imageUrl: '', featured: false, sortOrder: 10, previewUrl: null, uploading: false, error: null });

  const [variantForm, setVariantForm] = useState({
    name: '',
    listPrice: 30000,
    minPrice: 25000,
    maxPrice: 35000,
    minutes: 30,
  });

  const [priceForm, setPriceForm] = useState({
    listPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    reason: '',
  });

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [csvContent, setCsvContent] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [catRes, changeRes, catListRes] = await Promise.all([
      getCatalogueAction(),
      userRole === 'manager' ? getRecentOwnerChangesAction() : Promise.resolve({ success: true, data: [] }),
      getCanonicalCategoriesAction(),
    ]);

    if (catRes.success && catRes.data) {
      setServices(catRes.data.services);
      setStaff(catRes.data.staff);
    }
    if (changeRes.success && changeRes.data) {
      setOwnerChanges(changeRes.data);
    }
    if (catListRes.success && catListRes.data) {
      setCategories(catListRes.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, [
    'service', 'service_variant', 'staff_skill', 'app_user', 'app_setting',
  ]);


  useEffect(() => {
    loadData();
  }, [userRole]);

  // Categories list
  const existingCategories = categories.length > 0
    ? categories.map((c) => c.name)
    : Array.from(new Set(services.map((s) => s.category)));

  // File upload handler
  const handleFileUpload = async (file: File, target: 'add' | 'edit', serviceId?: string) => {
    if (file.size > 5 * 1024 * 1024) {
      const err = 'File size exceeds 5 MB limit.';
      if (target === 'add') setImageUploadState((p) => ({ ...p, error: err }));
      else setEditImageForm((p) => ({ ...p, error: err }));
      return;
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      const err = 'Only JPG, PNG or WebP images are allowed.';
      if (target === 'add') setImageUploadState((p) => ({ ...p, error: err }));
      else setEditImageForm((p) => ({ ...p, error: err }));
      return;
    }

    if (target === 'add') setImageUploadState({ uploading: true, previewUrl: null, error: null });
    else setEditImageForm((p) => ({ ...p, uploading: true, error: null }));

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (serviceId) fd.append('serviceId', serviceId);
      fd.append('actorRole', userRole);

      const res = await fetch('/api/catalogue/upload-image', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to process image');
      }

      if (target === 'add') {
        setImageUploadState({ uploading: false, previewUrl: json.data.imageUrl, error: null });
        setServiceForm((p) => ({ ...p, imageUrl: json.data.imageUrl }));
      } else {
        setEditImageForm((p) => ({
          ...p,
          uploading: false,
          imageUrl: json.data.imageUrl,
          previewUrl: json.data.imageUrl,
          error: null,
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (target === 'add') setImageUploadState((p) => ({ ...p, uploading: false, error: message }));
      else setEditImageForm((p) => ({ ...p, uploading: false, error: message }));
    }
  };

  // Handle Mark Owner Changes as Seen
  const handleMarkChangesAsSeen = async () => {
    const unseenIds = ownerChanges.filter((c) => !c.seen_by_manager).map((c) => parseInt(c.id, 10));
    if (unseenIds.length === 0) return;

    const res = await markOwnerChangesAsSeenAction(unseenIds);
    if (res.success) {
      setFeedback('Owner changes acknowledged and cleared.');
      loadData();
    }
  };

  // Open Price History Drawer
  const handleOpenPriceHistory = async (v: CatalogueVariantItem) => {
    setPriceHistoryVariant(v);
    const res = await getPriceHistoryAction(v.id);
    if (res.success && res.data) {
      setPriceHistoryItems(res.data);
    }
  };

  // Open Adjust Price Modal
  const handleOpenPriceAdjustment = (v: CatalogueVariantItem, serviceName: string) => {
    setPriceAdjustmentVariant({ variant: v, serviceName });
    setPriceForm({
      listPrice: v.list_price_ugx,
      minPrice: v.min_price_ugx,
      maxPrice: v.max_price_ugx,
      reason: '',
    });
  };

  // Submit Price Adjustment
  const handlePriceUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceAdjustmentVariant) return;
    if (!priceForm.reason.trim()) {
      showToast('A valid reason code is required for price adjustments.');
      return;
    }

    setSubmitting(true);
    const res = await updatePriceAction(
      priceAdjustmentVariant.variant.id,
      priceForm.listPrice,
      priceForm.minPrice,
      priceForm.maxPrice,
      priceForm.reason
    );

    if (res.success) {
      setFeedback(`Price updated for ${priceAdjustmentVariant.variant.name}`);
      setPriceAdjustmentVariant(null);
      loadData();
    } else {
      showToast(`Error updating price: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  // Toggle Active State
  const handleToggleActive = async (entityType: 'service' | 'service_variant', id: string, currentState: boolean) => {
    const res = await toggleActiveAction(entityType, id, !currentState);
    if (res.success) {
      setFeedback(`${entityType === 'service' ? 'Service' : 'Variant'} ${currentState ? 'disabled' : 'enabled'}.`);
      loadData();
    } else {
      showToast(`Error: ${res.error || 'Failed'}`);
    }
  };

  // Open Staff Skills Modal
  const handleOpenStaffSkills = (service: CatalogueServiceItem) => {
    setStaffSkillsService(service);
    setSelectedStaffIds(service.assigned_staff_ids || []);
  };

  // Save Staff Skills
  const handleSaveStaffSkills = async () => {
    if (!staffSkillsService) return;
    setSubmitting(true);
    const res = await updateStaffSkillsAction(staffSkillsService.id, selectedStaffIds);
    if (res.success) {
      setFeedback(`Assigned skills updated for ${staffSkillsService.name}`);
      setStaffSkillsService(null);
      loadData();
    } else {
      showToast(`Error updating skills: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  // Open Edit Image Modal
  const handleOpenEditImage = (service: CatalogueServiceItem) => {
    setEditImageModalService(service);
    setEditImageForm({
      imageUrl: service.image_url || '',
      featured: service.featured || false,
      sortOrder: service.sort_order ?? 10,
      previewUrl: service.image_url || null,
      uploading: false,
      error: null,
    });
  };

  // Save Edit Image & Settings
  const handleSaveEditImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editImageModalService) return;
    setSubmitting(true);
    const res = await updateServiceMetadataAction(editImageModalService.id, {
      imageUrl: editImageForm.imageUrl,
      featured: editImageForm.featured,
      sortOrder: editImageForm.sortOrder,
    });
    if (res.success) {
      setFeedback(`Updated image and settings for ${editImageModalService.name}`);
      setEditImageModalService(null);
      loadData();
    } else {
      showToast(`Error updating service image: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  // Submit Add Service
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = serviceForm.existingCategory || serviceForm.category;
    if (!serviceForm.name.trim() || !finalCategory.trim()) {
      showToast('Please fill out service name and category.');
      return;
    }

    setSubmitting(true);
    const res = await addServiceAction(
      serviceForm.name,
      finalCategory,
      serviceForm.defaultMinutes,
      {
        name: serviceForm.variantName,
        listPrice: serviceForm.listPrice,
        minPrice: serviceForm.minPrice,
        maxPrice: serviceForm.maxPrice,
        minutes: serviceForm.minutes,
      },
      {
        imageUrl: serviceForm.imageUrl || undefined,
        featured: serviceForm.featured,
        sortOrder: serviceForm.sortOrder,
        assignedStaffIds: serviceForm.assignmentType === 'custom' ? serviceForm.assignedStaffIds : undefined,
      }
    );

    if (res.success) {
      setFeedback(`New service "${serviceForm.name}" created successfully!`);
      setAddServiceModalOpen(false);
      setServiceForm({
        name: '',
        category: '',
        existingCategory: '',
        defaultMinutes: 30,
        featured: false,
        sortOrder: 10,
        imageUrl: '',
        variantName: 'Standard',
        listPrice: 30000,
        minPrice: 25000,
        maxPrice: 35000,
        minutes: 30,
        assignmentType: 'all',
        assignedStaffIds: [],
      });
      setImageUploadState({ uploading: false, previewUrl: null, error: null });
      loadData();
    } else {
      showToast(`Error creating service: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  // Submit Add Variant
  const handleAddVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addVariantModalService || !variantForm.name.trim()) return;

    setSubmitting(true);
    const res = await addVariantAction(
      addVariantModalService.id,
      variantForm.name,
      variantForm.listPrice,
      variantForm.minPrice,
      variantForm.maxPrice,
      variantForm.minutes
    );

    if (res.success) {
      setFeedback(`Variant "${variantForm.name}" added to ${addVariantModalService.name}`);
      setAddVariantModalService(null);
      setVariantForm({
        name: '',
        listPrice: 30000,
        minPrice: 25000,
        maxPrice: 35000,
        minutes: 30,
      });
      loadData();
    } else {
      showToast(`Error creating variant: ${res.error || 'Failed'}`);
    }
    setSubmitting(false);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Category', 'Service Name', 'Variant Name', 'Minutes', 'List Price UGX', 'Min Price UGX', 'Max Price UGX', 'Active'];
    const rows: string[] = [headers.join(',')];

    services.forEach((s) => {
      s.variants.forEach((v) => {
        const cleanName = `"${s.name.replace(/"/g, '""')}"`;
        const cleanCategory = `"${s.category.replace(/"/g, '""')}"`;
        const cleanVariant = `"${v.name.replace(/"/g, '""')}"`;
        rows.push([cleanCategory, cleanName, cleanVariant, v.expected_minutes, v.list_price_ugx, v.min_price_ugx, v.max_price_ugx, v.active ? 'YES' : 'NO'].join(','));
      });
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mzuri_salon_catalogue_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl  font-bold text-slate-900">Services & Pricing Catalogue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage services, professional photography, negotiated price boundaries, and kiosk visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white text-xs h-8" onClick={() => setAddServiceModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Service
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 border-[#CBD5E1]" onClick={() => setManageCategoriesModalOpen(true)}>
            <FolderCog className="w-3.5 h-3.5 mr-1 text-[#1F4FD8]" />
            Categories ({categories.length})
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 border-[#CBD5E1]" onClick={() => setImportCsvModalOpen(true)}>
            <Upload className="w-3.5 h-3.5 mr-1" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 border-[#CBD5E1]" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* "FROM THE OWNER" Notification Panel for Manager */}
      {userRole === 'manager' && ownerChanges.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="py-3 px-4 border-b border-indigo-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-indigo-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              From the Owner: Recent Catalogue Updates
            </CardTitle>
            {ownerChanges.some((c) => !c.seen_by_manager) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                onClick={handleMarkChangesAsSeen}
              >
                Mark all as seen
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-3 divide-y divide-indigo-100/60">
            {ownerChanges.slice(0, 3).map((change) => (
              <div key={change.id} className="py-2 flex items-center justify-between text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{change.summary}</span>
                  <span className="text-[10px] text-indigo-600">• {new Date(change.at).toLocaleDateString()}</span>
                </div>
                {!change.seen_by_manager && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800 ">
                    New
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Services & Variants List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">Loading active catalogue...</CardContent>
        </Card>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">No services in catalogue.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {services.map((service) => (
            <Card key={service.id} className={`overflow-hidden border border-[#CBD5E1] ${!service.active ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
              <CardHeader className="bg-[#FAF9F6] py-3.5 px-5 border-b border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Service Thumbnail (1:1) */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#CBD5E1] bg-slate-100 flex-shrink-0 flex items-center justify-center relative">
                    {service.image_url ? (
                      <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#1F4FD8]/10 flex items-center justify-center text-[#1F4FD8]">
                        <Scissors className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 tracking-normal">
                        {service.category}
                      </span>
                      {service.featured && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1F4FD8]/15 text-[#1F4FD8] flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#1F4FD8]" /> Featured on kiosk
                        </span>
                      )}
                      <CardTitle className="text-sm font-bold text-slate-900">{service.name}</CardTitle>
                      {service.is_owner_change && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {userRole === 'owner' ? 'Added by you' : 'Added by owner'}
                        </span>
                      )}
                      {!service.active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Default duration: ~{service.default_minutes} mins • Order rank: #{service.sort_order ?? 10}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-[#CBD5E1]"
                    onClick={() => handleOpenEditImage(service)}
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1 text-[#1F4FD8]" />
                    Photo & Kiosk
                  </Button>

                  {userRole === 'manager' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-[#CBD5E1]"
                      onClick={() => handleOpenStaffSkills(service)}
                    >
                      <Users className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {service.assigned_staff_ids.length === 0
                        ? 'No one assigned: anyone can take this'
                        : `Staff (${service.assigned_staff_ids.length})`}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#CBD5E1]"
                    onClick={() => setAddVariantModalService(service)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Variant
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs ${service.active ? 'text-rose-600' : 'text-emerald-600'}`}
                    onClick={() => handleToggleActive('service', service.id, service.active)}
                  >
                    {service.active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {service.variants.map((v) => (
                    <div
                      key={v.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors ${
                        !v.active ? 'opacity-60 bg-slate-50/50' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{v.name}</span>
                          <span className="text-xs text-muted-foreground">• ~{v.expected_minutes} min duration</span>
                          {v.is_owner_change && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {userRole === 'owner' ? 'Added by you' : 'Changed by owner'}
                            </span>
                          )}
                          {!v.active && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Disabled
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-900 font-extrabold">List: {formatUGX(v.list_price_ugx)}</span>
                          <span className="text-muted-foreground">
                            Custom price range: <strong>{formatUGX(v.min_price_ugx)}</strong> – <strong>{formatUGX(v.max_price_ugx)}</strong>
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                          A receptionist can set a negotiated price only within this range.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium border-[#CBD5E1]"
                          onClick={() => handleOpenPriceHistory(v)}
                        >
                          <History className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          History
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold border-[#CBD5E1]"
                          onClick={() => handleOpenPriceAdjustment(v, service.name)}
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Adjust Price
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 text-xs ${v.active ? 'text-rose-600' : 'text-emerald-600'}`}
                          onClick={() => handleToggleActive('service_variant', v.id, v.active)}
                        >
                          {v.active ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 1. ADD SERVICE MODAL WITH IMAGE UPLOAD */}
      {addServiceModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Add New Salon Service</h3>
            <p className="text-xs text-muted-foreground">
              Define the service details, photo, and initial variant. Changes appear immediately on the customer tablet.
            </p>

            <form onSubmit={handleAddServiceSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dreadlocks Retwist"
                  className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                    value={serviceForm.existingCategory}
                    onChange={(e) => setServiceForm({ ...serviceForm, existingCategory: e.target.value, category: '' })}
                  >
                    <option value="">Select canonical category...</option>
                    {existingCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Or New Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Locs & Twists"
                    className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value, existingCategory: '' })}
                    disabled={Boolean(serviceForm.existingCategory)}
                  />
                </div>
              </div>

              {/* Image Upload Dropzone */}
              <div className="border border-[#CBD5E1] rounded-xl p-3 bg-slate-50 space-y-2">
                <label className="text-xs font-semibold text-slate-800 block">Service Photo (4:3 Card & 1:1 Thumbnail)</label>
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG or WebP up to 5 MB. Minimum 800px on the short side for crisp kiosk rendering.
                </p>

                {imageUploadState.previewUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={imageUploadState.previewUrl}
                      alt="Preview"
                      className="w-20 h-15 object-cover rounded-lg border border-[#CBD5E1]"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Image ready
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setImageUploadState({ uploading: false, previewUrl: null, error: null });
                          setServiceForm((p) => ({ ...p, imageUrl: '' }));
                        }}
                        className="text-[11px] text-rose-600 hover:underline block"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="addServiceFileInput"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'add');
                      }}
                    />
                    <label
                      htmlFor="addServiceFileInput"
                      className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1F4FD8] rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                    >
                      <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-medium text-slate-700">Choose file or drag photo here</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Auto-optimised to 4:3 cards and 1:1 thumbnails</span>
                    </label>
                  </div>
                )}

                {imageUploadState.uploading && (
                  <div className="text-xs text-[#1F4FD8] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Optimising and uploading image...
                  </div>
                )}
                {imageUploadState.error && (
                  <div className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {imageUploadState.error}
                  </div>
                )}
              </div>

              {/* Featured & Sort Order */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="featuredKiosk"
                    checked={serviceForm.featured}
                    onChange={(e) => setServiceForm({ ...serviceForm, featured: e.target.checked })}
                    className="rounded border-[#CBD5E1] text-[#1F4FD8] focus:ring-[#1F4FD8]"
                  />
                  <label htmlFor="featuredKiosk" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Featured on kiosk
                  </label>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Display Order</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={serviceForm.sortOrder}
                    onChange={(e) => setServiceForm({ ...serviceForm, sortOrder: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Who can perform this (Staff Assignment) */}
              <div className="border-t pt-3 space-y-2">
                <label className="text-xs font-bold text-slate-900 block">Who can perform this</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="all"
                      checked={serviceForm.assignmentType === 'all'}
                      onChange={() => setServiceForm({ ...serviceForm, assignmentType: 'all', assignedStaffIds: [] })}
                      className="text-[#1F4FD8]"
                    />
                    <span>All staff (Default)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                    <input
                      type="radio"
                      name="assignmentType"
                      value="custom"
                      checked={serviceForm.assignmentType === 'custom'}
                      onChange={() => setServiceForm({ ...serviceForm, assignmentType: 'custom' })}
                      className="text-[#1F4FD8]"
                    />
                    <span>Choose people</span>
                  </label>
                </div>

                {serviceForm.assignmentType === 'custom' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mt-2">
                    <span className="text-[11px] text-slate-500 block font-medium">Select qualified stylists:</span>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                      {staff
                        .filter((s) => s.role === 'staff')
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={serviceForm.assignedStaffIds.includes(s.id)}
                              onChange={(e) => {
                                const nextIds = e.target.checked
                                  ? [...serviceForm.assignedStaffIds, s.id]
                                  : serviceForm.assignedStaffIds.filter((id) => id !== s.id);
                                setServiceForm({ ...serviceForm, assignedStaffIds: nextIds });
                              }}
                              className="rounded border-[#CBD5E1] text-[#1F4FD8]"
                            />
                            <span>{s.display_name}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-3 space-y-3">
                <span className="text-xs font-bold text-slate-900 block">Initial Standard Variant</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Variant Name</label>
                    <input
                      type="text"
                      className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                      value={serviceForm.variantName}
                      onChange={(e) => setServiceForm({ ...serviceForm, variantName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Duration (Mins)</label>
                    <input
                      type="number"
                      className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                      value={serviceForm.minutes}
                      onChange={(e) => setServiceForm({ ...serviceForm, minutes: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Standard List Price (UGX)</label>
                  <input
                    type="number"
                    className="w-full text-xs font-bold border rounded-lg p-2 border-[#CBD5E1]"
                    value={serviceForm.listPrice}
                    onChange={(e) => setServiceForm({ ...serviceForm, listPrice: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Min Price (Floor UGX)</label>
                    <input
                      type="number"
                      className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                      value={serviceForm.minPrice}
                      onChange={(e) => setServiceForm({ ...serviceForm, minPrice: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Max Price (Ceiling UGX)</label>
                    <input
                      type="number"
                      className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                      value={serviceForm.maxPrice}
                      onChange={(e) => setServiceForm({ ...serviceForm, maxPrice: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddServiceModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save & Publish Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PHOTO & KIOSK SETTINGS MODAL */}
      {editImageModalService && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Photo & Kiosk Settings: {editImageModalService.name}</h3>
            <p className="text-xs text-muted-foreground">
              Replace or remove the service photograph, feature it on the kiosk, or adjust display order.
            </p>

            <form onSubmit={handleSaveEditImage} className="space-y-4">
              {/* Photo Preview / Dropzone */}
              <div className="border border-[#CBD5E1] rounded-xl p-3 bg-slate-50 space-y-2">
                <label className="text-xs font-semibold text-slate-800 block">Service Image</label>
                {editImageForm.previewUrl ? (
                  <div className="space-y-3">
                    <img
                      src={editImageForm.previewUrl}
                      alt={editImageModalService.name}
                      className="w-full h-40 object-cover rounded-lg border border-[#CBD5E1]"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="editServiceFileInput"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'edit', editImageModalService.id);
                        }}
                      />
                      <label
                        htmlFor="editServiceFileInput"
                        className="text-xs font-semibold text-[#1F4FD8] hover:underline cursor-pointer"
                      >
                        Replace photo
                      </label>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setEditImageForm((p) => ({ ...p, imageUrl: '', previewUrl: null }))}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="editServiceFileInputEmpty"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'edit', editImageModalService.id);
                      }}
                    />
                    <label
                      htmlFor="editServiceFileInputEmpty"
                      className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1F4FD8] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                    >
                      <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-xs font-medium text-slate-700">Choose file or drag photo here</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG or WebP up to 5 MB</span>
                    </label>
                  </div>
                )}

                {editImageForm.uploading && (
                  <div className="text-xs text-[#1F4FD8] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Optimising and uploading image...
                  </div>
                )}
                {editImageForm.error && (
                  <div className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {editImageForm.error}
                  </div>
                )}
              </div>

              {/* Featured toggle & Sort order */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="editFeaturedKiosk"
                    checked={editImageForm.featured}
                    onChange={(e) => setEditImageForm({ ...editImageForm, featured: e.target.checked })}
                    className="rounded border-[#CBD5E1] text-[#1F4FD8] focus:ring-[#1F4FD8]"
                  />
                  <label htmlFor="editFeaturedKiosk" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Featured on kiosk
                  </label>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Display Order</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={editImageForm.sortOrder}
                    onChange={(e) => setEditImageForm({ ...editImageForm, sortOrder: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditImageModalService(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CANONICAL CATEGORIES MODAL */}
      {manageCategoriesModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Manage Categories</h3>
            <p className="text-xs text-muted-foreground">
              Canonical categories merged and sorted for the salon kiosk and service menu.
            </p>

            <div className="divide-y divide-slate-100 border border-[#CBD5E1] rounded-xl overflow-hidden">
              {categories.map((cat, idx) => (
                <div key={cat.name} className="p-3 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-900">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Rank #{cat.sort_order}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setManageCategoriesModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD VARIANT MODAL */}
      {addVariantModalService && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Variant to: {addVariantModalService.name}</h3>

            <form onSubmit={handleAddVariantSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Variant Name</label>
                <input
                  type="text"
                  placeholder="e.g. Long / Thick / Kids"
                  className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Expected Duration (Minutes)</label>
                <input
                  type="number"
                  className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={variantForm.minutes}
                  onChange={(e) => setVariantForm({ ...variantForm, minutes: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Standard List Price (UGX)</label>
                <input
                  type="number"
                  className="w-full text-xs font-bold border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={variantForm.listPrice}
                  onChange={(e) => setVariantForm({ ...variantForm, listPrice: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Min Price (Floor UGX)</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={variantForm.minPrice}
                    onChange={(e) => setVariantForm({ ...variantForm, minPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Max Price (Ceiling UGX)</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={variantForm.maxPrice}
                    onChange={(e) => setVariantForm({ ...variantForm, maxPrice: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddVariantModalService(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Variant'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PRICE HISTORY DRAWER */}
      {priceHistoryVariant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end p-0">
          <div className="bg-white h-full max-w-md w-full p-6 shadow-2xl space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Price History</h3>
                <p className="text-xs text-muted-foreground">{priceHistoryVariant.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPriceHistoryVariant(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {priceHistoryItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No prior price adjustments on record.</p>
              ) : (
                priceHistoryItems.map((item) => (
                  <div key={item.id} className="border border-[#CBD5E1] rounded-xl p-3 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{formatUGX(item.new_price_ugx)}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.changed_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Reason: <span className="italic">{item.reason || 'Standard update'}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Updated by: {item.changed_by_name} ({item.changed_by_role})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. PRICE ADJUSTMENT MODAL */}
      {priceAdjustmentVariant && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Adjust Price: {priceAdjustmentVariant.serviceName} ({priceAdjustmentVariant.variant.name})
            </h3>
            <p className="text-xs text-muted-foreground">
              Price adjustments are recorded permanently in the price history audit log. A valid reason code is required.
            </p>

            <form onSubmit={handlePriceUpdateSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Standard List Price (UGX)</label>
                <input
                  type="number"
                  className="w-full text-xs font-bold border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={priceForm.listPrice}
                  onChange={(e) => setPriceForm({ ...priceForm, listPrice: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Min Price (Floor UGX)</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={priceForm.minPrice}
                    onChange={(e) => setPriceForm({ ...priceForm, minPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Max Price (Ceiling UGX)</label>
                  <input
                    type="number"
                    className="w-full text-xs border rounded-lg p-2 border-[#CBD5E1]"
                    value={priceForm.maxPrice}
                    onChange={(e) => setPriceForm({ ...priceForm, maxPrice: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason for Price Adjustment</label>
                <select
                  className="w-full text-xs border rounded-lg p-2.5 border-[#CBD5E1]"
                  value={priceForm.reason}
                  onChange={(e) => setPriceForm({ ...priceForm, reason: e.target.value })}
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="MARKET_INFLATION">Market Inflation / Product Cost Increase</option>
                  <option value="SEASONAL_PROMO">Seasonal Promotion / Holiday Tariff</option>
                  <option value="TIER_ADJUSTMENT">Stylist Skill Tier Adjustment</option>
                  <option value="CORRECTION">Data Entry Correction</option>
                  <option value="OWNER_DIRECTIVE">Owner Directive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setPriceAdjustmentVariant(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Confirm Price Update'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. STAFF SKILLS MODAL */}
      {staffSkillsService && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Assign Staff: {staffSkillsService.name}</h3>
            <p className="text-xs text-muted-foreground">
              Select which stylists are qualified to be assigned to this service.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-[#CBD5E1] rounded-lg p-3">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStaffIds.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStaffIds([...selectedStaffIds, s.id]);
                      else setSelectedStaffIds(selectedStaffIds.filter((id) => id !== s.id));
                    }}
                    className="rounded text-[#1F4FD8] focus:ring-[#1F4FD8]"
                  />
                  <span>{s.display_name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setStaffSkillsService(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="bg-[#1F4FD8] hover:bg-[#85683F] text-white" onClick={handleSaveStaffSkills} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Staff Assignments'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
