import { useCallback, useEffect, useState } from 'react';
import ActivityShell from '../../activities/components/ActivityShell';
import { useAuth } from '../../../shared/hooks/useAuth';
import {
  createUser, createUsersBatch, deleteUser, listUsers, resetUserPassword,
  revokeUserSessions, updateUserProfile, updateUserRole, updateUserStatus,
} from '../api';
import { ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import { DEPARTMENTS, OFFICES, SERVICE_OFFICES, formatUserOffice } from '../../activities/constants';
import Modal from '../../../shared/components/Modal';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import ActionMenu from '../../../shared/components/ActionMenu';
import Alert from '../../../shared/components/Alert';
import './UserManagementPage.css';
import { Ban, Check as CheckIcon, LogOut, Mail, Trash2, X } from 'lucide-react';
import Icon from '../../../shared/components/Icon';
import RoleOfficeFields from '../components/RoleOfficeFields';
import { roleOfficeError } from '../accessRules';

const STATUS_FILTER_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE'];
const CHAIRPERSON_ASSIGNABLE_ROLES = [
  ROLES.DEPT_STAFF,
  ROLES.ACCRED_COORDINATOR,
  ROLES.ACCREDITOR_LINK,
];
const ALL_ASSIGNABLE_ROLES = [
  ROLES.DEPT_STAFF,
  ROLES.ADMIN,
  ROLES.ACCRED_COORDINATOR,
  ROLES.INSTITUTIONAL_OFFICE,
  ROLES.ACCREDITOR_LINK,
];
const ROLE_FILTER_OPTIONS = ['ALL', ...ALL_ASSIGNABLE_ROLES];
const ORG_UNIT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Org unit: All' },
  { value: '', label: 'Unassigned' },
  ...DEPARTMENTS.map((department) => ({ value: department.value, label: department.label })),
  ...OFFICES.filter((office) => office.value !== 'OTHER')
    .map((office) => ({ value: office.value, label: office.label })),
  ...SERVICE_OFFICES.filter((office) => office.value !== 'OTHER')
    .map((office) => ({ value: office.value, label: office.label })),
];
// Static permissions reference table (display-only in MVP)
// Visibility reflects ActivityService/DashboardService#canViewAll: ADMIN and
// INSTITUTIONAL_OFFICE see every activity institution-wide; DEPT_STAFF and
// ACCRED_COORDINATOR only see their own department plus public/service offices.
// Create/Upload reflect each controller's CREATE_ROLES, which deliberately
// excludes ADMIN so the audit trail (who actually authored content) stays
// meaningful - Admin only moderates via WRITE_ROLES (metadata, references).
const PERMISSIONS_TABLE = [
  { role: 'Department Staff',     create: true,  upload: true,  metadata: true,  reference: true, visibility: 'Own Dept + Public Offices', admin: false },
  { role: 'Institutional Staff', create: true,  upload: true,  metadata: true,  reference: true, visibility: 'All University',             admin: false },
  { role: 'Chairperson',          create: true,  upload: true,  metadata: true,  reference: true, visibility: 'Own Dept + Public Offices', admin: true  },
  { role: 'Accreditor (Link)',    create: false, upload: false, metadata: false, reference: true, visibility: 'Assigned Links Only',        admin: false },
  { role: 'System Administrator', create: false, upload: false, metadata: true,  reference: true, visibility: 'All University',             admin: true  },
];

const Check = () => <span className="perm-check"><Icon as={CheckIcon} size={14} /></span>;
const Dash  = () => <span className="perm-dash">—</span>;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const isChairperson = currentUser?.role === ROLES.ACCRED_COORDINATOR;
  const chairOffice = currentUser?.office || '';

  const [users, setUsers]               = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm]         = useState({ role: '', active: true, office: '', name: '', email: '' });

  const [showCreateModal, setShowCreateModal]     = useState(false);
  const [showTempPwModal, setShowTempPwModal]     = useState(false);
  const [newUserResult, setNewUserResult]         = useState(null);

  const [createForm, setCreateForm] = useState({ name: '', email: '', office: isChairperson ? chairOffice : '', role: ROLES.DEPT_STAFF });
  const [createError, setCreateError] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [isCreating, setIsCreating]   = useState(false);

  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [bulkRows, setBulkRows]             = useState([{ name: '', email: '' }]);
  const [bulkShared, setBulkShared]         = useState({ office: isChairperson ? chairOffice : '', role: ROLES.DEPT_STAFF });
  const [bulkError, setBulkError]           = useState('');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResults, setBulkResults]       = useState(null);

  const [searchQuery, setSearchQuery]   = useState('');
  const [roleFilter, setRoleFilter]     = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orgUnitFilter, setOrgUnitFilter] = useState('ALL');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [resetPwConfirmOpen, setResetPwConfirmOpen] = useState(false);
  const [forceLogoutConfirmOpen, setForceLogoutConfirmOpen] = useState(false);
  const [isResettingPw, setIsResettingPw] = useState(false);
  const [isForcingLogout, setIsForcingLogout] = useState(false);

  const roleFilterOptions = isChairperson
    ? ['ALL', ...CHAIRPERSON_ASSIGNABLE_ROLES]
    : ROLE_FILTER_OPTIONS;

  const orgUnitFilterOptions = isChairperson
    ? [{ value: 'ALL', label: `Org unit: ${formatUserOffice(chairOffice) || chairOffice || 'My Department'}` }]
    : ORG_UNIT_FILTER_OPTIONS;

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await listUsers();
      setUsers(data);
    } catch {
      
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const isEditFormDirty = !!selectedUser && (
    editForm.name !== selectedUser.name
    || editForm.email !== selectedUser.email
    || editForm.role !== selectedUser.role
    || (!isChairperson && editForm.office !== (selectedUser.office || ''))
    || editForm.active !== selectedUser.active
  );

  const filteredUsers = users.filter((u) => {
    if (isChairperson) {
      const matchOffice = chairOffice && (u.office || '').toLowerCase() === chairOffice.toLowerCase();
      const matchCreatedBy = u.createdBy && currentUser?.id && u.createdBy === currentUser?.id;
      if (!matchOffice && !matchCreatedBy) return false;
    }
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus = statusFilter === 'ALL'
      || (statusFilter === 'ACTIVE' && u.active)
      || (statusFilter === 'INACTIVE' && !u.active);
    const matchOrgUnit = orgUnitFilter === 'ALL' || (u.office || '') === orgUnitFilter;
    const createdDate = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '';
    const matchCreatedFrom = !createdFrom || (createdDate && createdDate >= createdFrom);
    const matchCreatedTo = !createdTo || (createdDate && createdDate <= createdTo);
    return matchSearch && matchRole && matchStatus && matchOrgUnit && matchCreatedFrom && matchCreatedTo;
  });

  const hasActiveFilters = searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
    || orgUnitFilter !== 'ALL' || createdFrom || createdTo;

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setOrgUnitFilter('ALL');
    setCreatedFrom('');
    setCreatedTo('');
  };

  const handleSelectUser = (u) => {
    setActionError('');
    setActionMessage('');
    if (selectedUser?.id === u.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(u);
      setEditForm({ role: u.role, active: u.active, office: u.office || '', name: u.name, email: u.email });
    }
  };

  const requestDelete = () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser.id) {
      setActionError('You cannot delete your own account.');
      return;
    }
    if (isChairperson && selectedUser.role === ROLES.ADMIN) {
      setActionError('Chairpersons cannot delete Administrator accounts.');
      return;
    }
    setActionError('');
    setDeleteConfirmOpen(true);
  };

  const requestForceLogout = () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser.id) {
      setActionError('You cannot force logout your own account.');
      return;
    }
    if (isChairperson && selectedUser.role === ROLES.ADMIN) {
      setActionError('Chairpersons cannot force logout Administrator accounts.');
      return;
    }
    setActionError('');
    setForceLogoutConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await deleteUser(selectedUser.id);
      setSelectedUser(null);
      setDeleteConfirmOpen(false);
      await loadUsers();
    } catch {
      setActionError('Failed to delete user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateError('');
    setCreateFieldErrors({});
    setCreateForm({
      name: '',
      email: '',
      office: isChairperson ? chairOffice : '',
      role: ROLES.DEPT_STAFF,
    });
    setShowCreateModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateFieldErrors({});
    const ruleError = roleOfficeError(createForm);
    if (ruleError) {
      setCreateError(ruleError);
      return;
    }
    setIsCreating(true);
    try {
      const request = {
        name: createForm.name,
        email: createForm.email,
        office: createForm.office || null,
        role: createForm.role,
      };
      const { data } = await createUser(request);
      setNewUserResult(data);
      setShowCreateModal(false);
      setShowTempPwModal(true);
      setCreateForm({
        name: '',
        email: '',
        office: isChairperson ? chairOffice : '',
        role: ROLES.DEPT_STAFF,
      });
      loadUsers();
    } catch (err) {
      setCreateFieldErrors(err.response?.data?.details || {});
      setCreateError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const addBulkRow = () => setBulkRows((rows) => [...rows, { name: '', email: '' }]);
  const removeBulkRow = (index) => setBulkRows((rows) => rows.filter((_, i) => i !== index));
  const updateBulkRow = (index, field, value) =>
    setBulkRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleOpenBulkModal = () => {
    setBulkError('');
    setBulkRows([{ name: '', email: '' }]);
    setBulkShared({
      office: isChairperson ? chairOffice : '',
      role: ROLES.DEPT_STAFF,
    });
    setShowBulkModal(true);
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setBulkError('');

    const rows = bulkRows.filter((r) => r.name.trim() || r.email.trim());
    if (rows.length === 0) {
      setBulkError('Add at least one user.');
      return;
    }
    if (rows.some((r) => !r.name.trim() || !r.email.trim())) {
      setBulkError('Each row needs both a full name and an email.');
      return;
    }

    const ruleError = roleOfficeError(bulkShared);
    if (ruleError) {
      setBulkError(ruleError);
      return;
    }

    setIsBulkCreating(true);
    try {
      const request = {
        users: rows.map((r) => ({ name: r.name.trim(), email: r.email.trim() })),
        office: bulkShared.office || null,
        role: bulkShared.role,
      };
      const { data } = await createUsersBatch(request);
      setBulkResults(data);
      setShowBulkModal(false);
      setBulkRows([{ name: '', email: '' }]);
      setBulkShared({
        office: isChairperson ? chairOffice : '',
        role: ROLES.DEPT_STAFF,
      });
      loadUsers();
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Failed to create users');
    } finally {
      setIsBulkCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    setActionError('');
    setActionMessage('');
    setIsSaving(true);
    try {
      if (editForm.name !== selectedUser.name || editForm.email !== selectedUser.email) {
        await updateUserProfile(selectedUser.id, editForm.name.trim(), editForm.email.trim());
      }
      if (!isChairperson && (editForm.role !== selectedUser.role || editForm.office !== (selectedUser.office || ''))) {
        const ruleError = roleOfficeError(editForm);
        if (ruleError) throw new Error(ruleError);
        // One request: the role and department/office are validated as a pair.
        await updateUserRole(selectedUser.id, editForm.role, editForm.office);
      }
      if (editForm.active !== selectedUser.active) {
        await updateUserStatus(selectedUser.id, editForm.active);
      }
      await loadUsers();
      setSelectedUser({ ...selectedUser, ...editForm, ...(isChairperson ? { office: selectedUser.office } : {}) });
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setActionError('');
    setActionMessage('');
    setIsResettingPw(true);
    try {
      await resetUserPassword(selectedUser.id);
      setResetPwConfirmOpen(false);
      setActionMessage(`A new temporary password was emailed to ${selectedUser.email}.`);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setIsResettingPw(false);
    }
  };

  const handleForceLogout = async () => {
    if (!selectedUser) return;
    setActionError('');
    setActionMessage('');
    setIsForcingLogout(true);
    try {
      await revokeUserSessions(selectedUser.id);
      setForceLogoutConfirmOpen(false);
      setActionMessage(`${selectedUser.name} has been signed out of all sessions.`);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to force logout. Please try again.');
    } finally {
      setIsForcingLogout(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await updateUserStatus(selectedUser.id, false);
      await loadUsers();
      setSelectedUser({ ...selectedUser, active: false });
      setEditForm((f) => ({ ...f, active: false }));
      setRevokeConfirmOpen(false);
    } catch {
      setActionError('Failed to revoke access. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ActivityShell>
      <div className="ump-layout">
        <main className="ump-main">
          <div className="ump-main-inner">
            <p className="ump-breadcrumb">Access Management › Users{isChairperson && chairOffice ? ` (${formatUserOffice(chairOffice) || chairOffice})` : ''}</p>

            <div className="ump-perms-section">
              <p className="ump-section-label">Permissions by Role</p>
              <table className="ump-perms-table">
                <thead>
                  <tr>
                    <th className="ump-pth">Role</th>
                    <th className="ump-pth">Create</th>
                    <th className="ump-pth">Upload</th>
                    <th className="ump-pth">Metadata</th>
                    <th className="ump-pth">Reference</th>
                    <th className="ump-pth">Visibility</th>
                    <th className="ump-pth">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS_TABLE.map((row) => (
                    <tr key={row.role}>
                      <td className="ump-ptd ump-ptd-role">{row.role}</td>
                      <td className="ump-ptd">{row.create    ? <Check /> : <Dash />}</td>
                      <td className="ump-ptd">{row.upload    ? <Check /> : <Dash />}</td>
                      <td className="ump-ptd">{row.metadata  ? <Check /> : <Dash />}</td>
                      <td className="ump-ptd">{row.reference ? <Check /> : <Dash />}</td>
                      <td className="ump-ptd ump-ptd-visibility">{row.visibility}</td>
                      <td className="ump-ptd">{row.admin     ? <Check /> : <Dash />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ump-page-header">
              <h1 className="ump-page-title">Users &amp; Roles</h1>
              <div className="ump-page-actions">
                <button className="ump-btn-primary" onClick={handleOpenCreateModal}>
                  + Invite User
                </button>
                <button className="ump-btn-secondary" onClick={handleOpenBulkModal}>
                  + Bulk Invite
                </button>
                <button
                  className="ump-btn-secondary"
                  onClick={handleUpdate}
                  disabled={!selectedUser || isSaving || !isEditFormDirty}
                >
                  {isSaving ? 'Saving…' : <><Icon as={CheckIcon} /> Save Changes</>}
                </button>
              </div>
            </div>

            <div className="ump-filters">
              <input
                className="ump-search"
                placeholder="Search users…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="ump-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                {roleFilterOptions.map((r) => (
                  <option key={r} value={r}>{r === 'ALL' ? 'Role: All' : ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
              <select className="ump-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? 'Status: All' : s}</option>
                ))}
              </select>
              <select className="ump-select" value={orgUnitFilter} onChange={(e) => setOrgUnitFilter(e.target.value)} disabled={isChairperson}>
                {orgUnitFilterOptions.map((orgUnit) => (
                  <option key={orgUnit.value || 'UNASSIGNED'} value={orgUnit.value}>{orgUnit.label}</option>
                ))}
              </select>
              <label className="ump-date-filter">
                <span>From</span>
                <input
                  className="ump-date-input"
                  type="date"
                  value={createdFrom}
                  max={createdTo || undefined}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  aria-label="Created from"
                />
              </label>
              <label className="ump-date-filter">
                <span>To</span>
                <input
                  className="ump-date-input"
                  type="date"
                  min={createdFrom || undefined}
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  aria-label="Created to"
                />
              </label>
              {hasActiveFilters && (
                <button className="ump-btn-secondary ump-clear-filters" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            <div className="ump-table-section">
              <div className="ump-table-header-row">
                <span className="ump-section-label">
                  Users <span className="ump-count">{filteredUsers.length} total{selectedUser ? ' — 1 selected' : ''}</span>
                </span>
              </div>
              <table className="ump-table">
                <thead>
                  <tr>
                    <th className="ump-th ump-th-check"></th>
                    <th className="ump-th">Name</th>
                    <th className="ump-th">Email</th>
                    <th className="ump-th">Department</th>
                    <th className="ump-th">Role</th>
                    <th className="ump-th">Status</th>
                    <th className="ump-th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`ump-tr ${selectedUser?.id === u.id ? 'ump-tr-selected' : ''}`}
                      onClick={() => handleSelectUser(u)}
                    >
                      <td className="ump-td ump-td-check">
                        <input
                          type="checkbox"
                          checked={selectedUser?.id === u.id}
                          onChange={() => handleSelectUser(u)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="ump-td ump-td-name">{u.name}</td>
                      <td className="ump-td ump-td-email">{u.email}</td>
                      <td className="ump-td">
                        {formatUserOffice(u.office)}
                      </td>
                      <td className="ump-td">
                        <span className="ump-role-badge">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </td>
                      <td className="ump-td">
                        <span className={`ump-status-badge ${u.active ? 'ump-status-active' : 'ump-status-inactive'}`}>
                          {u.active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="ump-td">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={7} className="ump-empty">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* ════════════ RIGHT PANEL ════════════ */}
        {selectedUser && (
          <aside className="ump-detail">
            <div className="ump-detail-head">
              <p className="ump-detail-section-label">User</p>
              <button
                type="button"
                className="ump-detail-close"
                onClick={() => handleSelectUser(selectedUser)}
                aria-label="Close user details"
              >
                <Icon as={X} size={16} />
              </button>
            </div>
            <div className="ump-detail-user-card">
              <div className="ump-detail-avatar">{selectedUser.name.charAt(0)}</div>
              <div>
                <p className="ump-detail-name">{selectedUser.name}</p>
                <p className="ump-detail-email">{selectedUser.email}</p>
              </div>
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Full Name</label>
              <input
                className="ump-detail-input"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Email</label>
              <input
                type="email"
                className="ump-detail-input"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            {isChairperson ? (
              <>
                {/* Chairpersons can invite staff but cannot change anyone's role or department. */}
                <div className="ump-detail-field">
                  <label className="ump-detail-label">Department / Office</label>
                  <input
                    className="ump-detail-input"
                    value={selectedUser.office ? (formatUserOffice(selectedUser.office) || selectedUser.office) : 'None'}
                    disabled
                    readOnly
                  />
                </div>
                <div className="ump-detail-field">
                  <label className="ump-detail-label">Role</label>
                  <input
                    className="ump-detail-input"
                    value={ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                    disabled
                    readOnly
                  />
                </div>
              </>
            ) : (
              <RoleOfficeFields
                variant="detail"
                value={{ office: editForm.office, role: editForm.role }}
                onChange={(next) => setEditForm((f) => ({ ...f, ...next }))}
                roleOptions={ALL_ASSIGNABLE_ROLES}
              />
            )}
            <div className="ump-detail-field">
              <label className="ump-detail-label">Status</label>
              <div className="ump-detail-radio-group">
                <label className="ump-detail-radio">
                  <input type="radio" name="status" checked={editForm.active === true} disabled={isChairperson}
                    onChange={() => setEditForm((f) => ({ ...f, active: true }))} />
                  Active
                </label>
                <label className="ump-detail-radio">
                  <input type="radio" name="status" checked={editForm.active === false} disabled={isChairperson}
                    onChange={() => setEditForm((f) => ({ ...f, active: false }))} />
                  Suspended
                </label>
              </div>
            </div>
            <Alert type="error" message={actionError} onDismiss={() => setActionError('')} />
            {actionMessage && <p className="am-alert am-alert-success">{actionMessage}</p>}
            <div className="ump-detail-actions">
              <button className="ump-detail-btn-primary" onClick={handleUpdate} disabled={isSaving || !isEditFormDirty}>
                {isSaving ? '…' : <><Icon as={CheckIcon} /> Update</>}
              </button>
              {/* Resend invite / reset password, force logout, revoke access and delete are admin-only. */}
              {!isChairperson && (
              <ActionMenu
                items={[
                  {
                    icon: Mail,
                    label: 'Resend Invite / Reset Password',
                    disabled: isResettingPw,
                    onClick: () => setResetPwConfirmOpen(true),
                  },
                  {
                    icon: LogOut,
                    label: 'Force Logout',
                    disabled: isForcingLogout,
                    onClick: requestForceLogout,
                  },
                  {
                    icon: Ban,
                    label: 'Revoke Access',
                    danger: true,
                    disabled: isSaving,
                    onClick: () => setRevokeConfirmOpen(true),
                  },
                  {
                    icon: Trash2,
                    label: 'Delete User',
                    danger: true,
                    disabled: isSaving,
                    onClick: requestDelete,
                  },
                ]}
              />
              )}
            </div>
            <div className="ump-activity">
              <p className="ump-detail-section-label">Activity</p>
              <p className="ump-activity-item">Account created {formatDate(selectedUser.createdAt)}</p>
              {!selectedUser.active && <p className="ump-activity-item">Access suspended</p>}
            </div>
          </aside>
        )}
      </div>
      </ActivityShell>

      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setCreateError(''); setCreateFieldErrors({}); }} title="Invite User">
        <form onSubmit={handleCreateUser} noValidate>
          {createError && <p className="ump-modal-error">{createError}</p>}
          <div className="ump-modal-field">
            <label className="ump-modal-label">Full Name</label>
            <input className="ump-modal-input" value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Juan dela Cruz" />
            {createFieldErrors.name && <span className="ump-field-error">{createFieldErrors.name}</span>}
          </div>
          <div className="ump-modal-field">
            <label className="ump-modal-label">Email</label>
            <input type="email" className="ump-modal-input" value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required placeholder="firstname.lastname@inst.edu" />
            {createFieldErrors.email && <span className="ump-field-error">{createFieldErrors.email}</span>}
          </div>
          <RoleOfficeFields
            value={{ office: createForm.office, role: createForm.role }}
            onChange={(next) => setCreateForm((f) => ({ ...f, ...next }))}
            roleOptions={isChairperson ? CHAIRPERSON_ASSIGNABLE_ROLES : ALL_ASSIGNABLE_ROLES}
            lockedOffice={isChairperson ? chairOffice : ''}
          />
          <button type="submit" className="ump-modal-submit" disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Create Account'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={showTempPwModal} onClose={() => setShowTempPwModal(false)} title="Account Created">
        {newUserResult && (
          <div className="ump-temppw">
            <p className="ump-tempw-intro" hidden>
              Account for <strong>{newUserResult.name}</strong> has been created.
              Share this temporary password with them — it will not be shown again.
            </p>
            <p className="ump-tempw-note">
              A temporary password has been sent to <strong>{newUserResult.email}</strong>.
              The user will be required to change it on first login.
            </p>
            <button className="ump-modal-submit"
              onClick={() => setShowTempPwModal(false)}>
              Close
            </button>
          </div>
        )}
      </Modal>

      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkError(''); }} title="Bulk Invite Users" size="wide">
        <form onSubmit={handleBulkCreate} noValidate>
          {bulkError && <p className="ump-modal-error">{bulkError}</p>}

          <div className="ump-bulk-shared">
            <RoleOfficeFields
              value={{ office: bulkShared.office, role: bulkShared.role }}
              onChange={(next) => setBulkShared((f) => ({ ...f, ...next }))}
              roleOptions={isChairperson ? CHAIRPERSON_ASSIGNABLE_ROLES : ALL_ASSIGNABLE_ROLES}
              lockedOffice={isChairperson ? chairOffice : ''}
            />
            <p className="ump-bulk-shared-note">Applied to every user added below.</p>
          </div>

          <div className="ump-bulk-rows">
            {bulkRows.map((row, i) => (
              <div className="ump-bulk-row" key={i}>
                <input className="ump-modal-input" placeholder="Full name" value={row.name}
                  onChange={(e) => updateBulkRow(i, 'name', e.target.value)} />
                <input type="email" className="ump-modal-input" placeholder="Email"
                  value={row.email} onChange={(e) => updateBulkRow(i, 'email', e.target.value)} />
                <button type="button" className="ump-bulk-row-remove"
                  onClick={() => removeBulkRow(i)} disabled={bulkRows.length === 1}
                  aria-label="Remove row">
                  <Icon as={X} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ump-bulk-add-row" onClick={addBulkRow}>
            + Add another
          </button>

          <button type="submit" className="ump-modal-submit" disabled={isBulkCreating}>
            {isBulkCreating ? 'Creating…' : `Create ${bulkRows.length} Account${bulkRows.length === 1 ? '' : 's'}`}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!bulkResults} onClose={() => setBulkResults(null)} title="Bulk Invite Results">
        {bulkResults && (
          <div className="ump-bulk-results">
            {bulkResults.map((r) => (
              <div className={`ump-bulk-result-row ${r.success ? 'ump-bulk-result-ok' : 'ump-bulk-result-fail'}`} key={r.email}>
                <span className="ump-bulk-result-email">{r.email}</span>
                <span className="ump-bulk-result-status">{r.success ? 'Invited' : (r.error || 'Failed')}</span>
              </div>
            ))}
            <button className="ump-modal-submit" onClick={() => setBulkResults(null)}>
              Close
            </button>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Permanently delete ${selectedUser?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={isSaving}
      />

      <ConfirmModal
        isOpen={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        onConfirm={handleRevoke}
        title="Revoke Access"
        message={`Revoke access for ${selectedUser?.name}?`}
        confirmLabel="Revoke"
        danger
        busy={isSaving}
      />

      <ConfirmModal
        isOpen={resetPwConfirmOpen}
        onClose={() => setResetPwConfirmOpen(false)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Send ${selectedUser?.name} a new temporary password by email? Their current password will stop working, and they'll be required to set a new one on next login.`}
        confirmLabel="Send"
        busy={isResettingPw}
      />

      <ConfirmModal
        isOpen={forceLogoutConfirmOpen}
        onClose={() => setForceLogoutConfirmOpen(false)}
        onConfirm={handleForceLogout}
        title="Force Logout"
        message={`Sign ${selectedUser?.name} out of every active session? They'll need to log in again.`}
        confirmLabel="Force Logout"
        danger
        busy={isForcingLogout}
      />
    </>
  );
}
