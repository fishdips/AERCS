import { DEPARTMENTS, OFFICES, SERVICE_OFFICES, formatUserOffice } from '../../activities/constants';
import { ROLE_LABELS } from '../../../shared/constants/roles';
import {
  applyOfficeChange,
  applyRoleChange,
  isDepartmentValue,
  isOfficeValue,
  roleHasNoOffice,
  rolesForOffice,
} from '../accessRules';

const USER_OFFICES = OFFICES.filter((o) => o.value !== 'OTHER');
const USER_SERVICE_OFFICES = SERVICE_OFFICES.filter((o) => o.value !== 'OTHER');

function OfficeOptions({ value }) {
  const isKnown = !value || isDepartmentValue(value) || isOfficeValue(value);
  return (
    <>
      <option value="">None</option>
      {/* Value doesn't match any known department/office (legacy data): show it as-is
          instead of silently falling back to "None". */}
      {!isKnown && <option value={value}>{value}</option>}
      <optgroup label="Department">
        {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </optgroup>
      <optgroup label="Institutional Office">
        {USER_OFFICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </optgroup>
      <optgroup label="Service Office">
        {USER_SERVICE_OFFICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </optgroup>
    </>
  );
}

/**
 * Department/Office + Role pair that keeps the two consistent:
 *  - a department      -> Department Staff (default) or Chairperson
 *  - an office         -> Institutional Staff, set automatically and not changeable
 *  - Administrator / Accreditor -> no department or office
 *
 * `value` is { office, role }; `onChange` receives the next { office, role }.
 * `lockedOffice` pins the office to a chairperson's own department.
 */
export default function RoleOfficeFields({
  value,
  onChange,
  roleOptions,
  lockedOffice = '',
  variant = 'modal',
  disabled = false,
}) {
  const p = variant === 'detail' ? 'ump-detail' : 'ump-modal';
  const fieldClass = variant === 'detail' ? 'ump-detail-field' : 'ump-modal-field';
  const labelClass = `${p}-label`;
  const inputClass = `${p}-input`;
  const selectClass = `${p}-select`;

  const noOffice = roleHasNoOffice(value.role);
  const allowedRoles = lockedOffice ? roleOptions : rolesForOffice(value.office, roleOptions);
  // Exactly one possible role (any institutional/service office): fixed, so the select is locked.
  const roleIsAutomatic = allowedRoles.length === 1;
  // Keep the current role selectable even if legacy data doesn't match the rules.
  const shownRoles = allowedRoles.includes(value.role) ? allowedRoles : [value.role, ...allowedRoles];

  return (
    <>
      <div className={fieldClass}>
        <label className={labelClass}>Department / Office</label>
        {lockedOffice ? (
          <input
            className={inputClass}
            value={noOffice ? 'None' : (formatUserOffice(lockedOffice) || lockedOffice)}
            disabled
            readOnly
          />
        ) : (
          <select
            className={selectClass}
            value={noOffice ? '' : value.office}
            disabled={disabled || noOffice}
            onChange={(e) => onChange(applyOfficeChange(value, e.target.value, roleOptions))}
          >
            <OfficeOptions value={noOffice ? '' : value.office} />
          </select>
        )}
      </div>

      <div className={fieldClass}>
        <label className={labelClass}>Role</label>
        <select
          className={selectClass}
          value={value.role}
          disabled={disabled || (roleIsAutomatic && !noOffice && allowedRoles[0] === value.role)}
          onChange={(e) => onChange(applyRoleChange(value, e.target.value, lockedOffice))}
        >
          {shownRoles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>
      </div>
    </>
  );
}
