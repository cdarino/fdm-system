import type { RbacRole } from '@/lib/actions/admin-roles';
import { roleLabel } from '@/lib/role-labels';

interface RoleCheckboxListProps {
  roles: RbacRole[];
  selectedIds: string[];
  onChange: (id: string, checked: boolean) => void;
  disabled?: boolean;
  /** Roles the current user may not change, e.g. their own system_admin role. */
  lockedIds?: string[];
  /** Explanation shown beneath a locked role. */
  lockedHint?: string;
}

export function RoleCheckboxList({
  roles,
  selectedIds,
  onChange,
  disabled,
  lockedIds = [],
  lockedHint,
}: RoleCheckboxListProps) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles available</p>;
  }

  return (
    <>
      {roles.map((role) => {
        const isLocked = lockedIds.includes(role.id);
        return (
          <label
            key={role.id}
            className={`flex items-start gap-3 p-3 bg-background rounded-lg border border-border transition-colors ${
              isLocked
                ? 'cursor-not-allowed opacity-70'
                : 'hover:border-primary hover:bg-sidebar-accent cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(role.id)}
              onChange={(e) => onChange(role.id, e.target.checked)}
              disabled={disabled || isLocked}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary cursor-pointer"
            />
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">{roleLabel(role.name)}</p>
              {role.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
              )}
              {isLocked && lockedHint && (
                <p className="text-xs text-muted-foreground mt-1">{lockedHint}</p>
              )}
            </div>
          </label>
        );
      })}
    </>
  );
}
