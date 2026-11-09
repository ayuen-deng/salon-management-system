'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import {
  Users,
  Search,
  Filter,
  Download,
  UserPlus,
  Edit2,
  UserX,
  UserCheck,
  Award,
  Calendar,
  Phone,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  CheckSquare,
  Square,
  KeyRound,
} from 'lucide-react';
import {
  getStaffDirectoryAction,
  createAccountAction,
  editStaffProfileAction,
  changeRoleAction,
  toggleAccountStatusAction,
  saveChecklistAction,
  type HrStaffMember,
} from '../controllers/hr.actions';
import { AppRole } from '@/shared/models/roles';
import { formatUgPhoneDisplay } from '@/shared/models/phone';
import { StaffSkillsEditor } from '@/shared/views/ui/staff-skills-editor';
import { getStaffSkillsEditorAction, saveStaffSkillsAction, type StaffSkillService } from '@/modules/staff-skills';
import { HrExportMenu } from './hr-export-menu';
import { openCredentialSlip } from '@/shared/views/ui/credential-slip-actions';

const ONBOARDING_ITEMS = [
  { id: 'account_created', label: 'Account created in system' },
  { id: 'pin_given', label: 'Initial 6-digit PIN securely issued' },
  { id: 'skills_assigned', label: 'Skills & services assigned by Manager' },
  { id: 'rota_set', label: 'Weekly working hours & rota set' },
  { id: 'first_clockin', label: 'First attendance clock-in verified' },
];

const OFFBOARDING_ITEMS = [
  { id: 'access_revoked', label: 'Access revoked & account deactivated' },
  { id: 'sessions_terminated', label: 'Active sessions terminated' },
  { id: 'final_attendance', label: 'Final attendance records confirmed' },
];

export function HrStaffView() {
  const [staff, setStaff] = useState<HrStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    role: 'staff' as 'staff' | 'receptionist' | 'manager',
    phone: '',
    username: '',
    startDate: new Date().toISOString().split('T')[0],
    pin: '',
  });
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createdPinResult, setCreatedPinResult] = useState<{ pin: string; name: string; username: string; role: string } | null>(null);

  const [editingMember, setEditingMember] = useState<HrStaffMember | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', startDate: '' });

  const [roleChangeMember, setRoleChangeMember] = useState<HrStaffMember | null>(null);
  const [roleChangeForm, setRoleChangeForm] = useState({
    newRole: 'staff' as 'staff' | 'receptionist' | 'manager',
    reason: '',
  });

  const [deactivateMember, setDeactivateMember] = useState<HrStaffMember | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const [checklistMember, setChecklistMember] = useState<HrStaffMember | null>(null);
  const [skillsMember, setSkillsMember] = useState<HrStaffMember | null>(null);
  const [skillServices, setSkillServices] = useState<StaffSkillService[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getStaffDirectoryAction();
    if (res.success && res.data) {
      setStaff(res.data);
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to load staff list.' });
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadData(); }, true, ['app_user', 'staff_skill', 'service', 'app_setting']);


  useEffect(() => {
    loadData();
  }, []);

  const openSkills = async (member: HrStaffMember) => {
    setSkillError(null);
    const res = await getStaffSkillsEditorAction(member.id);
    if (res.success && res.data) {
      setSkillServices(res.data.services);
      setSelectedSkillIds(res.data.selectedServiceIds);
      setSkillsMember(member);
    } else if (!res.success) setFeedback({ type: 'error', message: res.error?.message || 'Could not load skills.' });
  };

  const saveSkills = async (ids: string[]) => {
    if (!skillsMember) return;
    setSavingSkills(true);
    setSkillError(null);
    const res = await saveStaffSkillsAction(skillsMember.id, ids);
    if (res.success) {
      const names = skillServices.filter((service) => ids.includes(service.id)).map((service) => service.name);
      setStaff((current) => current.map((member) => member.id === skillsMember.id ? { ...member, skills: names } : member));
      setFeedback({ type: 'success', message: `Skills saved for ${skillsMember.full_name}.` });
      setSkillsMember(null);
    } else if (!res.success) setSkillError(res.error?.message || 'Could not save skills. Try again.');
    setSavingSkills(false);
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchesSearch =
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm);
      const matchesRole = roleFilter === 'all' || s.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, searchTerm, roleFilter, statusFilter]);

  // Export CSV (People data only, zero financial or customer metrics)
  const handleExportCsv = () => {
    const headers = ['Full Name', 'Display Name', 'Role', 'Username', 'Phone', 'Status', 'Start Date', 'Skills'];
    const rows = filteredStaff.map((s) => [
      `"${s.full_name}"`,
      `"${s.display_name}"`,
      s.role,
      s.username,
      s.phone,
      s.status,
      s.start_date,
      `"${s.skills.join('; ')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mzuri_staff_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Actions handlers
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreatingAccount(true);
    const res = await createAccountAction(createForm);
    if (res.success && res.data) {
      setCreatedPinResult({
        pin: res.data.pin,
        name: createForm.fullName,
        username: res.data.username,
        role: createForm.role,
      });
      setShowCreateModal(false);
      setCreateForm({
        fullName: '',
        role: 'staff',
        phone: '',
        username: '',
        startDate: new Date().toISOString().split('T')[0],
        pin: '',
      });
      setUsernameEdited(false);
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to create account.' });
    }
    setCreatingAccount(false);
  };

  const handleCopyCredentials = async () => {
    if (!createdPinResult) return;
    await navigator.clipboard.writeText(`Username: ${createdPinResult.username}\nTemporary PIN: ${createdPinResult.pin}`);
    setFeedback({ type: 'success', message: 'Credentials copied. Share them privately with the staff member.' });
  };

  const handlePrintCredentials = () => {
    if (!createdPinResult) return;
    if (!openCredentialSlip({ fullName: createdPinResult.name, role: createdPinResult.role, username: createdPinResult.username, pin: createdPinResult.pin })) {
      setFeedback({ type: 'error', message: 'Allow the print window to open, then try again.' });
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const res = await editStaffProfileAction({
      userId: editingMember.id,
      fullName: editForm.fullName,
      phone: editForm.phone,
      startDate: editForm.startDate,
    });
    if (res.success) {
      setFeedback({ type: 'success', message: `Profile updated for ${editForm.fullName}.` });
      setEditingMember(null);
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to edit profile.' });
    }
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleChangeMember) return;
    const res = await changeRoleAction({
      userId: roleChangeMember.id,
      newRole: roleChangeForm.newRole,
      reason: roleChangeForm.reason,
    });
    if (res.success) {
      setFeedback({ type: 'success', message: `Role changed to ${roleChangeForm.newRole.toUpperCase()} for ${roleChangeMember.full_name}.` });
      setRoleChangeMember(null);
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to change role.' });
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateMember) return;
    const isDeactivating = deactivateMember.status === 'active';
    const res = await toggleAccountStatusAction({
      userId: deactivateMember.id,
      status: isDeactivating ? 'inactive' : 'active',
      reason: deactivateReason,
    });
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `${deactivateMember.full_name} has been ${isDeactivating ? 'deactivated and all sessions terminated' : 'reactivated'}.`,
      });
      setDeactivateMember(null);
      setDeactivateReason('');
      loadData();
    } else if (!res.success) {
      setFeedback({ type: 'error', message: res.error?.message || 'Failed to update status.' });
    }
  };

  const handleToggleChecklistItem = async (itemKey: string, type: 'onboarding' | 'offboarding') => {
    if (!checklistMember) return;
    const currentList = type === 'onboarding' ? (checklistMember.onboarding_checklist || []) : (checklistMember.offboarding_checklist || []);
    const updated = currentList.includes(itemKey)
      ? currentList.filter((k) => k !== itemKey)
      : [...currentList, itemKey];

    const res = await saveChecklistAction({
      userId: checklistMember.id,
      type,
      items: updated,
    });

    if (res.success) {
      setChecklistMember({
        ...checklistMember,
        [type === 'onboarding' ? 'onboarding_checklist' : 'offboarding_checklist']: updated,
      });
      // Update in master list
      setStaff((prev) =>
        prev.map((s) =>
          s.id === checklistMember.id
            ? { ...s, [type === 'onboarding' ? 'onboarding_checklist' : 'offboarding_checklist']: updated }
            : s
        )
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Personnel & Staff Directory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Profiles, roles, onboarding checklists, and identity provisioning (People data only, zero financial metrics)
          </p>
        </div>
      <div className="flex items-center gap-2">
          <HrExportMenu title="Staff directory" filename="staff-directory" rows={filteredStaff} filters={`Search: ${searchTerm || 'all'} · Role: ${roleFilter} · Status: ${statusFilter}`} columns={[{ label: 'Full name', value: (r) => r.full_name }, { label: 'Display name', value: (r) => r.display_name }, { label: 'Role', value: (r) => r.role }, { label: 'Username', value: (r) => r.username }, { label: 'Phone', value: (r) => formatUgPhoneDisplay(r.phone) }, { label: 'Status', value: (r) => r.status }, { label: 'Start date', value: (r) => r.start_date }, { label: 'Skills', value: (r) => r.skills.join('; ') }]} />
          <Button
            size="sm"
            onClick={() => { setCreatedPinResult(null); setShowCreateModal(true); }}
            className="bg-[#1F4FD8] hover:bg-[#E05910] text-white text-xs h-8 font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Create Account
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* One-time credentials result */}
      {createdPinResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-950  tracking-wide">
                Account created
              </span>
            </div>
            <button onClick={() => setCreatedPinResult(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-800">
            Give these credentials privately to <strong className="font-semibold">{createdPinResult.name}</strong>. This PIN is shown only once. HR can reset it later.
          </p>
          <p className="text-xs text-emerald-800">Username: <strong>{createdPinResult.username}</strong> · Role: <strong>{createdPinResult.role}</strong></p>
          <div className="p-3 bg-white border border-emerald-200 rounded-lg inline-block tabular-nums text-2xl font-black text-emerald-800 tracking-normal">
            {createdPinResult.pin}
          </div>
          <p className="text-xs text-emerald-800">Next: set the rota, assign skills for staff roles, and tell the person to sign in and choose a new PIN.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCopyCredentials}>Copy credentials</Button>
            <Button size="sm" variant="outline" onClick={handlePrintCredentials}>Print credentials slip</Button>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, username or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
          >
            <option value="all">All Roles</option>
            <option value="staff">Staff (Stylist/Barber)</option>
            <option value="receptionist">Receptionist</option>
            <option value="manager">Manager</option>
            <option value="hr">HR</option>
            <option value="owner">Owner</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4FD8]"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold  tracking-normal text-[10px]">
                <tr>
                  <th className="py-3 px-4">Person</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Username & Phone</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Skills (Manager Assigned)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Loading personnel records...</td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No personnel records found.</td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => {
                    const isProtected = s.role === 'owner' || s.role === 'hr';
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.full_name}</div>
                          <div className="text-[11px] text-slate-400">{s.display_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold  tracking-normal ${
                              s.role === 'owner'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : s.role === 'manager'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : s.role === 'hr'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : s.role === 'receptionist'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {s.role === 'hr' ? 'HR' : s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="tabular-nums text-slate-700">{s.username}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">{formatUgPhoneDisplay(s.phone)}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums">
                          {s.start_date ? new Date(`${s.start_date}T12:00:00+03:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' }) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {s.skills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.skills.slice(0, 4).map((sk, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] border border-slate-200"
                                >
                                  {sk}
                                </span>
                              ))}
                              {s.skills.length > 4 && <button type="button" onClick={() => openSkills(s)} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] border border-blue-200">+{s.skills.length - 4} more</button>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No services</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{s.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Checklists button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setChecklistMember(s)}
                            >
                              Checklist
                            </Button>

                            {!isProtected && (
                              <>
                                {s.role === 'staff' && <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => openSkills(s)}>Skills ({s.skills.length})</Button>}
                                {/* Edit */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-slate-700 hover:text-slate-900"
                                  onClick={() => {
                                    setEditingMember(s);
                                    setEditForm({ fullName: s.full_name, phone: s.phone, startDate: s.start_date });
                                  }}
                                >
                                  Edit
                                </Button>

                                {/* Change Role */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-[#1F4FD8] hover:text-[#E05910]"
                                  onClick={() => {
                                    setRoleChangeMember(s);
                                    setRoleChangeForm({
                                      newRole: (s.role === 'owner' || s.role === 'hr' ? 'staff' : s.role) as any,
                                      reason: '',
                                    });
                                  }}
                                >
                                  Role
                                </Button>

                                {/* Deactivate / Activate */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 px-2 text-[11px] ${
                                    s.status === 'active'
                                      ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  onClick={() => {
                                    setDeactivateMember(s);
                                    setDeactivateReason('');
                                  }}
                                >
                                  {s.status === 'active' ? 'Deactivate' : 'Reactivate'}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE ACCOUNT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Staff Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Mugerwa"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value, username: usernameEdited ? createForm.username : e.target.value.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20) })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                >
                  <option value="staff">Staff (Stylist, Barber, Wash Assistant)</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  HR may only create Staff, Receptionist, or Manager accounts. Owner and HR accounts are managed by the salon owner.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[a-z0-9._]{3,20}"
                  placeholder="e.g. samuel"
                  value={createForm.username}
                  onChange={(e) => { setUsernameEdited(true); setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20) }); }}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="07xx xxx xxx or +2567xx xxx xxx"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Temporary PIN (optional)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Leave blank to generate securely"
                  value={createForm.pin}
                  onChange={(e) => setCreateForm({ ...createForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">PIN must be six digits, not repeated or sequential, and not your phone’s last six digits.</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creatingAccount} className="bg-[#1F4FD8] hover:bg-[#E05910] text-white font-semibold">
                  {creatingAccount ? 'Creating account…' : 'Create & Generate PIN'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Profile: {editingMember.display_name}</h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>
              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#E05910] text-white font-semibold">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE ROLE MODAL */}
      {roleChangeMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Change Role: {roleChangeMember.full_name}</h3>
              <button onClick={() => setRoleChangeMember(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleChangeRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Role</label>
                <select
                  value={roleChangeForm.newRole}
                  onChange={(e) => setRoleChangeForm({ ...roleChangeForm, newRole: e.target.value as any })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                >
                  <option value="staff">Staff (Stylist/Barber)</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {roleChangeMember.role === 'manager' && roleChangeForm.newRole !== 'manager' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                  <span>
                    <strong>Warning:</strong> The salon will have no manager until another is assigned.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Role Change (Mandatory)</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain why this person's role is being updated..."
                  value={roleChangeForm.reason}
                  onChange={(e) => setRoleChangeForm({ ...roleChangeForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRoleChangeMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#1F4FD8] hover:bg-[#E05910] text-white font-semibold">
                  Confirm Role Change
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE / REACTIVATE CONFIRMATION MODAL */}
      {deactivateMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {deactivateMember.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
              </h3>
              <button onClick={() => setDeactivateMember(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                {deactivateMember.status === 'active' ? (
                  <>
                    Are you sure you want to deactivate <strong className="font-semibold text-slate-900">{deactivateMember.full_name}</strong>?
                    Their active sessions will be terminated immediately. Their historical attendance and records will remain.
                  </>
                ) : (
                  <>
                    Reactivate <strong className="font-semibold text-slate-900">{deactivateMember.full_name}</strong> to restore their login and salon directory access?
                  </>
                )}
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason Code / Explanation {deactivateMember.status === 'active' && '(Mandatory)'}
                </label>
                <input
                  type="text"
                  required={deactivateMember.status === 'active'}
                  placeholder="e.g. Resigned, leave of absence, contract ended..."
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#1F4FD8] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDeactivateMember(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeactivate}
                  className={`font-semibold text-white ${
                    deactivateMember.status === 'active'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {deactivateMember.status === 'active' ? 'Terminate & Deactivate' : 'Reactivate Account'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING & OFFBOARDING CHECKLIST MODAL */}
      {checklistMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">HR Checklists: {checklistMember.display_name}</h3>
                <span className="text-[11px] text-slate-500">Track onboarding & offboarding governance per person</span>
              </div>
              <button onClick={() => setChecklistMember(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Onboarding */}
              <div>
                <h4 className="font-bold text-slate-900  tracking-normal text-[11px] mb-2 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  Onboarding Tasks
                </h4>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ONBOARDING_ITEMS.map((item) => {
                    const isChecked = (checklistMember.onboarding_checklist || []).includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklistItem(item.id, 'onboarding')}
                        className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={isChecked ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Offboarding */}
              <div>
                <h4 className="font-bold text-slate-900  tracking-normal text-[11px] mb-2 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                  Offboarding Tasks
                </h4>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {OFFBOARDING_ITEMS.map((item) => {
                    const isChecked = (checklistMember.offboarding_checklist || []).includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklistItem(item.id, 'offboarding')}
                        className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={isChecked ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <Button size="sm" onClick={() => setChecklistMember(null)} className="text-xs">
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {skillsMember && <StaffSkillsEditor staffName={skillsMember.full_name} services={skillServices} selectedIds={selectedSkillIds} isOpen saving={savingSkills} error={skillError} onClose={() => setSkillsMember(null)} onSave={saveSkills} />}
    </div>
  );
}
