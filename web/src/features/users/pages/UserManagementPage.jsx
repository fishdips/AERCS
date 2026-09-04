import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { createUser, createUsersBatch, deleteUser, listUsers, updateUserRole, updateUserStatus } from '../api';
import { ROLE_LABELS, ROLES } from '../../../shared/constants/roles';
import { DEPARTMENTS, OFFICES, formatUserOffice } from '../../activities/constants';
import Modal from '../../../shared/components/Modal';
import ActionMenu from '../../../shared/components/ActionMenu';
import './UserManagementPage.css';

const STATUS_FILTER_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE'];
const ROLE_FILTER_OPTIONS = ['ALL', ...Object.keys(ROLES)];
const USER_OFFICES = OFFICES.filter((office) => office.value !== 'OTHER');

function DeptOfficeOptions() {
  return (
    <>
      <option value="">None</option>
      <optgroup label="Department">
        {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </optgroup>
      <optgroup label="Office">
        {USER_OFFICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </optgroup>
    </>
  );
}

// Static permissions reference table (display-only in MVP)
const PERMISSIONS_TABLE = [
  { role: 'Department Staff',    create: true,  upload: true,  metadata: true,  reference: true,  monitor: false, admin: false },
  { role: 'Institutional Office',create: true,  upload: true,  metadata: true,  reference: true,  monitor: true,  admin: false },
  { role: 'Accred. Coordinator', create: true,  upload: true,  metadata: true,  reference: true,  monitor: true,  admin: false },
  { role: 'Accreditor (Link)',   create: false, upload: false, metadata: false, reference: true,  monitor: false, admin: false },
  { role: 'System Administrator',create: true,  upload: true,  metadata: true,  reference: true,  monitor: true,  admin: true  },
];

const Check = () => <span className="perm-check">✓</span>;
const Dash  = () => <span className="perm-dash">—</span>;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function UserManagementPage() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [users, setUsers]               = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm]         = useState({ role: '', active: true });

  const [showCreateModal, setShowCreateModal]     = useState(false);
  const [showTempPwModal, setShowTempPwModal]     = useState(false);
  const [newUserResult, setNewUserResult]         = useState(null);

  const [createForm, setCreateForm] = useState({ name: '', email: '', office: '', role: ROLES.DEPT_STAFF });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating]   = useState(false);

  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [bulkRows, setBulkRows]             = useState([{ name: '', email: '' }]);
  const [bulkShared, setBulkShared]         = useState({ office: '', role: ROLES.DEPT_STAFF });
  const [bulkError, setBulkError]           = useState('');
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkResults, setBulkResults]       = useState(null);

  const [searchQuery, setSearchQuery]   = useState('');
  const [roleFilter, setRoleFilter]     = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await listUsers();
      setUsers(data);
    } catch {
      
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus = statusFilter === 'ALL'
      || (statusFilter === 'ACTIVE' && u.active)
      || (statusFilter === 'INACTIVE' && !u.active);
    return matchSearch && matchRole && matchStatus;
  });

  const handleSelectUser = (u) => {
    if (selectedUser?.id === u.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(u);
      setEditForm({ role: u.role, active: u.active });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUser.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!window.confirm(`Permanently delete ${selectedUser.name}? This cannot be undone.`)) return;
    setIsSaving(true);
    try {
      await deleteUser(selectedUser.id);
      setSelectedUser(null);
      await loadUsers();
    } catch {
      alert('Failed to delete user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      const request = { name: createForm.name, email: createForm.email, office: createForm.office || null, role: createForm.role };
      const { data } = await createUser(request);
      setNewUserResult(data);
      setShowCreateModal(false);
      setShowTempPwModal(true);
      setCreateForm({ name: '', email: '', office: '', role: ROLES.DEPT_STAFF });
      loadUsers();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const addBulkRow = () => setBulkRows((rows) => [...rows, { name: '', email: '' }]);
  const removeBulkRow = (index) => setBulkRows((rows) => rows.filter((_, i) => i !== index));
  const updateBulkRow = (index, field, value) =>
    setBulkRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

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
      setBulkShared({ office: '', role: ROLES.DEPT_STAFF });
      loadUsers();
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Failed to create users');
    } finally {
      setIsBulkCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      if (editForm.role !== selectedUser.role) {
        await updateUserRole(selectedUser.id, editForm.role);
      }
      if (editForm.active !== selectedUser.active) {
        await updateUserStatus(selectedUser.id, editForm.active);
      }
      await loadUsers();
      setSelectedUser({ ...selectedUser, ...editForm });
    } catch {
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Revoke access for ${selectedUser.name}?`)) return;
    setIsSaving(true);
    try {
      await updateUserStatus(selectedUser.id, false);
      await loadUsers();
      setSelectedUser({ ...selectedUser, active: false });
      setEditForm((f) => ({ ...f, active: false }));
    } catch {
      alert('Failed to revoke access. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ump-shell">

      {/* ════════════ HEADER ════════════ */}
      <header className="ump-header">
        <div className="ump-header-left">
          <div className="ump-logo-box">A</div>
          <div className="ump-logo-text">
            <span className="ump-logo-name">AERCS</span>
            <span className="ump-logo-sub">EVIDENCE REPOSITORY</span>
          </div>
        </div>
        <div className="ump-header-right">
          <span className="ump-badge">AY 2026–2027</span>
          <div className="ump-avatar">{currentUser?.name?.charAt(0) ?? 'A'}</div>
          <div className="ump-user-info">
            <span className="ump-user-name">{currentUser?.name}</span>
            <span className="ump-user-role">{ROLE_LABELS[currentUser?.role] ?? currentUser?.role}</span>
          </div>
        </div>
      </header>

      <div className="ump-body">

        {/* ════════════ SIDEBAR ════════════ */}
        <aside className="ump-sidebar">
          <nav className="ump-nav">
            <p className="ump-nav-section">Workspace</p>
            <NavLink to="/dashboard" className={({ isActive }) => `ump-nav-link${isActive ? ' ump-nav-active' : ''}`}>Dashboard</NavLink>
            <NavLink to="/activities" className={({ isActive }) => `ump-nav-link${isActive ? ' ump-nav-active' : ''}`}>Documentation</NavLink>
            <NavLink to="/repository" className={({ isActive }) => `ump-nav-link${isActive ? ' ump-nav-active' : ''}`}>Repository</NavLink>
            <NavLink to="/shared-evidence" className={({ isActive }) => `ump-nav-link${isActive ? ' ump-nav-active' : ''}`}>Shared Evidence</NavLink>
            <p className="ump-nav-section">Administration</p>
            <NavLink to="/admin/users" className={({ isActive }) => `ump-nav-link${isActive ? ' ump-nav-active' : ''}`}>Access Management</NavLink>
          </nav>
          <div className="ump-sidebar-footer">
            <div className="ump-signed-as">
              <span className="ump-signed-label">Signed in as</span>
              <span className="ump-signed-name">{currentUser?.name}</span>
            </div>
            <button className="ump-logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </aside>

        {/* ════════════ MAIN ════════════ */}
        <main className="ump-main">
          <div className="ump-main-inner">
            <p className="ump-breadcrumb">Access Management › Users</p>

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
                    <th className="ump-pth">Monitor</th>
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
                      <td className="ump-ptd">{row.monitor   ? <Check /> : <Dash />}</td>
                      <td className="ump-ptd">{row.admin     ? <Check /> : <Dash />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ump-page-header">
              <h1 className="ump-page-title">Users &amp; Roles</h1>
              <div className="ump-page-actions">
                <button className="ump-btn-primary" onClick={() => setShowCreateModal(true)}>
                  + Invite User
                </button>
                <button className="ump-btn-secondary" onClick={() => setShowBulkModal(true)}>
                  + Bulk Invite
                </button>
                <button
                  className="ump-btn-secondary"
                  onClick={handleUpdate}
                  disabled={!selectedUser || isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
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
                {ROLE_FILTER_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r === 'ALL' ? 'Role: All' : ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
              <select className="ump-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? 'Status: All' : s}</option>
                ))}
              </select>
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
            <p className="ump-detail-section-label">User</p>
            <div className="ump-detail-user-card">
              <div className="ump-detail-avatar">{selectedUser.name.charAt(0)}</div>
              <div>
                <p className="ump-detail-name">{selectedUser.name}</p>
                <p className="ump-detail-email">{selectedUser.email}</p>
              </div>
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Department / Office</label>
              <input
                className="ump-detail-input"
                value={selectedUser.office ? formatUserOffice(selectedUser.office) : ''}
                readOnly
                placeholder="—"
              />
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Role</label>
              <select
                className="ump-detail-select"
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
              >
                {Object.keys(ROLES).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Scoped Offices</label>
              <div className="ump-detail-tag-placeholder">All offices</div>
            </div>
            <div className="ump-detail-field">
              <label className="ump-detail-label">Status</label>
              <div className="ump-detail-radio-group">
                <label className="ump-detail-radio">
                  <input type="radio" name="status" checked={editForm.active === true}
                    onChange={() => setEditForm((f) => ({ ...f, active: true }))} />
                  Active
                </label>
                <label className="ump-detail-radio">
                  <input type="radio" name="status" checked={editForm.active === false}
                    onChange={() => setEditForm((f) => ({ ...f, active: false }))} />
                  Suspended
                </label>
              </div>
            </div>
            <div className="ump-detail-actions">
              <button className="ump-detail-btn-primary" onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? '…' : 'Update'}
              </button>
              <ActionMenu
                items={[
                  {
                    label: 'Revoke Access',
                    danger: true,
                    disabled: isSaving,
                    onClick: handleRevoke,
                  },
                  {
                    label: 'Delete User',
                    danger: true,
                    disabled: isSaving,
                    onClick: handleDelete,
                  },
                ]}
              />
            </div>
            <div className="ump-activity">
              <p className="ump-detail-section-label">Activity</p>
              <p className="ump-activity-item">Account created {formatDate(selectedUser.createdAt)}</p>
              {!selectedUser.active && <p className="ump-activity-item">Access suspended</p>}
            </div>
          </aside>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setCreateError(''); }} title="Invite User">
        <form onSubmit={handleCreateUser} noValidate>
          {createError && <p className="ump-modal-error">{createError}</p>}
          <div className="ump-modal-field">
            <label className="ump-modal-label">Full Name</label>
            <input className="ump-modal-input" value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Juan dela Cruz" />
          </div>
          <div className="ump-modal-field">
            <label className="ump-modal-label">Email</label>
            <input type="email" className="ump-modal-input" value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required placeholder="firstname.lastname@inst.edu" />
          </div>
          <div className="ump-modal-field">
            <label className="ump-modal-label">Department / Office</label>
            <select className="ump-modal-select" value={createForm.office}
              onChange={(e) => setCreateForm((f) => ({ ...f, office: e.target.value }))}>
              <DeptOfficeOptions />
            </select>
          </div>
          <div className="ump-modal-field">
            <label className="ump-modal-label">Role</label>
            <select className="ump-modal-select" value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}>
              {/* NOTE: Add new roles here when extending beyond MVP */}
              <option value={ROLES.DEPT_STAFF}>{ROLE_LABELS[ROLES.DEPT_STAFF]}</option>
              <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
              <option value={ROLES.ACCRED_COORDINATOR}>{ROLE_LABELS[ROLES.ACCRED_COORDINATOR]}</option>
              <option value={ROLES.INSTITUTIONAL_OFFICE}>{ROLE_LABELS[ROLES.INSTITUTIONAL_OFFICE]}</option>
              <option value={ROLES.ACCREDITOR_LINK}>{ROLE_LABELS[ROLES.ACCREDITOR_LINK]}</option>
            </select>
          </div>
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
            <div className="ump-modal-field">
              <label className="ump-modal-label">Department / Office</label>
              <select className="ump-modal-select" value={bulkShared.office}
                onChange={(e) => setBulkShared((f) => ({ ...f, office: e.target.value }))}>
                <DeptOfficeOptions />
              </select>
            </div>
            <div className="ump-modal-field">
              <label className="ump-modal-label">Role</label>
              <select className="ump-modal-select" value={bulkShared.role}
                onChange={(e) => setBulkShared((f) => ({ ...f, role: e.target.value }))}>
                <option value={ROLES.DEPT_STAFF}>{ROLE_LABELS[ROLES.DEPT_STAFF]}</option>
                <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
                <option value={ROLES.ACCRED_COORDINATOR}>{ROLE_LABELS[ROLES.ACCRED_COORDINATOR]}</option>
                <option value={ROLES.INSTITUTIONAL_OFFICE}>{ROLE_LABELS[ROLES.INSTITUTIONAL_OFFICE]}</option>
                <option value={ROLES.ACCREDITOR_LINK}>{ROLE_LABELS[ROLES.ACCREDITOR_LINK]}</option>
              </select>
            </div>
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
                  ✕
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
    </div>
  );
}
