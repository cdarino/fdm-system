'use client';

import { Fragment, useState, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LoadingButton } from '@/components/ui/loading-button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleCheckboxList } from '@/components/dashboard/role-checkbox-list';
import {
  Plus,
  Settings2,
  Trash2,
  X,
  MoreHorizontal,
  Search,
  ListFilter,
  Check,
  ChevronRight,
  UserRoundPlus,
  UserRoundCheck,
  UserRoundX,
  SearchX,
  ShieldCheck,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CreateUserModal } from './create-user-modal';
import {
  AdminUsersProvider,
  useAdminUsers,
  type AdminDialog,
  type StatusFilter,
} from '@/lib/hooks/use-admin-users';
import { useMutation } from '@/lib/hooks/use-mutation';
import type { UserListItem } from '@/lib/actions/admin-user';
import { roleLabel } from '@/lib/role-labels';
import { SELF_DEMOTE_ERROR, SYSTEM_ADMIN_ROLE } from '@/lib/self-protection';
import { toast } from 'sonner';

/**
 * Tints and hover shades as complete class literals.
 *
 * Tokens in `globals.css` are hex, so slash-opacity would compile to invalid
 * `rgb(#hex / alpha)`. `color-mix()` against white/black is the supported way
 * to derive a shade, and the strings must stay unbroken for Tailwind's static
 * scanner to find them.
 */
const TINTS = {
  activePill: 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success',
  inactivePill: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive',
  primaryBtnHover: 'hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]',
  destructiveBtnHover: 'hover:bg-[color-mix(in_srgb,var(--destructive)_85%,black)]',
  successBtn: 'border-transparent bg-success text-success-foreground hover:bg-[color-mix(in_srgb,var(--success)_85%,black)] hover:text-success-foreground',
  // The shared outline/ghost variants hover to `bg-accent`, which is the bright
  // primary cyan — far too loud for a secondary control. These keep them quiet.
  quietBtn: 'border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground',
  dangerBtn: 'border-border bg-card text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,white)] hover:text-destructive',
  dangerMenuItem: 'text-destructive focus:text-destructive focus:bg-[color-mix(in_srgb,var(--destructive)_12%,white)]',
  // Hover is the warm page cream; an open row takes the gold tint and acts as
  // the header of its block. The panel below keeps the card colour and is set
  // apart by structure instead — tinting it as well made the whole block read
  // as one flat slab. All theme-aware tokens (see globals.css), not the cool
  // --muted grey, which clashes with this palette's warm background.
  rowIdle: 'hover:bg-row-hover',
  rowOpen: 'bg-row-active hover:bg-row-active',
  // The menu button lifts to the card colour so it reads as a chip against the
  // tinted row rather than vanishing into it.
  rowMenuBtn: 'hover:bg-card hover:text-foreground hover:shadow-sm data-[state=open]:bg-card data-[state=open]:text-foreground data-[state=open]:shadow-sm',
};

/** Matches the `duration-200` exit transition on Dialog/AlertDialog content. */
const DIALOG_EXIT_MS = 200;

/**
 * Consistent horizontal gutter for every band of the card.
 *
 * Each side is spelled out as its own complete literal. Tailwind scans source
 * text statically, so a gutter derived at runtime would compile to nothing.
 */
const GUTTER = 'px-4 sm:px-6';
const GUTTER_L = 'pl-4 sm:pl-6';
const GUTTER_R = 'pr-4 sm:pr-6';

function fullName(user: UserListItem): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

function initials(user: UserListItem): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  const fromName = `${first}${last}`.trim();
  if (fromName) return fromName.toUpperCase();
  return user.email.trim().charAt(0).toUpperCase() || '?';
}

/**
 * Which self-destructive actions the UI must block for `user`.
 *
 * Mirrors the server guards in `lib/self-protection.ts` so an admin sees the
 * action disabled rather than watching it fail after the click.
 */
function selfProtection(user: UserListItem, currentUserId: string) {
  const isSelf = user.id === currentUserId;
  return {
    isSelf,
    canToggle: !(isSelf && !user.isBanned),
    canDelete: !isSelf,
  };
}

/**
 * Keeps the most recent dialog mounted for the length of its exit animation.
 *
 * Radix animates a dialog out on the element it is unmounting. Rendering
 * dialogs straight off `activeDialog` tore them from the screen the instant the
 * value became null, so the close animation never played.
 */
function useDialogPresence(activeDialog: AdminDialog) {
  const [rendered, setRendered] = useState<AdminDialog>(activeDialog);

  useEffect(() => {
    if (activeDialog) {
      setRendered(activeDialog);
      return;
    }
    const timer = setTimeout(() => setRendered(null), DIALOG_EXIT_MS);
    return () => clearTimeout(timer);
  }, [activeDialog]);

  return { rendered, isOpen: activeDialog !== null };
}

/* -------------------------------------------------------------------------- */
/*  Presentational pieces                                                     */
/* -------------------------------------------------------------------------- */

function UserAvatar({ user, className }: { user: UserListItem; className?: string }) {
  return (
    // The ring sits on the root, not the fallback, so a row can recolour it
    // for its open state without reaching through the component.
    <Avatar className={cn('ring-1 ring-inset ring-border', className)}>
      {/* --row-hover / --foreground is a real surface+text token pair defined
          for both themes, so the initials stay legible in each. */}
      <AvatarFallback className="bg-row-hover text-foreground">{initials(user)}</AvatarFallback>
    </Avatar>
  );
}

function DisplayName({ user, className }: { user: UserListItem; className?: string }) {
  const name = fullName(user);
  if (name) return <span className={className}>{name}</span>;
  return <span className="italic font-normal text-muted-foreground">No name set</span>;
}

function StatusPill({ isBanned }: { isBanned: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isBanned ? TINTS.inactivePill : TINTS.activePill
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${isBanned ? 'bg-destructive' : 'bg-success'}`}
      />
      {isBanned ? 'Inactive' : 'Active'}
    </span>
  );
}

function RoleBadges({ roles }: { roles: UserListItem['roles'] }) {
  if (roles.length === 0) {
    return <span className="text-sm text-muted-foreground">No roles assigned</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Badge
          key={role.id}
          variant="secondary"
          className="border-border bg-card font-medium text-foreground hover:bg-card"
        >
          {roleLabel(role.name)}
        </Badge>
      ))}
    </div>
  );
}

/** Avatar plus name and email, so dialogs name the user they act on. */
function UserIdentity({ user }: { user: UserListItem }) {
  return (
    <div className="-mt-1 flex items-center gap-3 rounded-lg bg-row-hover p-3">
      <UserAvatar user={user} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          <DisplayName user={user} />
        </p>
        <p className="break-all text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialogs                                                                   */
/* -------------------------------------------------------------------------- */

function ToggleUserDialog({ user, open }: { user: UserListItem; open: boolean }) {
  const { toggleUserStatus, closeDialog } = useAdminUsers();
  const { state, execute } = useMutation(toggleUserStatus);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success(user.isBanned ? 'User activated successfully' : 'User deactivated successfully');
    }
  }, [state.status, closeDialog, user.isBanned]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {user.isBanned ? 'Activate user?' : 'Deactivate user?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {user.isBanned
              ? <><span>This will restore access for </span><strong>{user.email}</strong><span>. They will be able to log in immediately.</span></>
              : <><span>This will block access for </span><strong>{user.email}</strong><span>. They will be unable to log in until reactivated.</span></>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.status === 'error' && <p className="-mt-2 text-sm text-destructive">{state.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={state.status === 'pending'}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={state.status === 'pending'}
            onClick={() => execute(user.id, user.isBanned)}
            className={user.isBanned ? `bg-primary text-primary-foreground ${TINTS.primaryBtnHover}` : `bg-destructive text-white ${TINTS.destructiveBtnHover}`}
          >
            {state.status === 'pending' ? 'Saving...' : user.isBanned ? 'Activate' : 'Deactivate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteUserDialog({ user, open }: { user: UserListItem; open: boolean }) {
  const { deleteUser, closeDialog } = useAdminUsers();
  const { state, execute } = useMutation(deleteUser);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('User deleted successfully');
    }
  }, [state.status, closeDialog]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{user.email}</strong> from the system. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.status === 'error' && <p className="-mt-2 text-sm text-destructive">{state.error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={state.status === 'pending'}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={state.status === 'pending'}
            onClick={() => execute(user.id)}
            className={`bg-destructive text-white ${TINTS.destructiveBtnHover}`}
          >
            {state.status === 'pending' ? 'Deleting...' : 'Delete User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditRolesDialog({ user, open }: { user: UserListItem; open: boolean }) {
  const { roles, updateUserRoles, closeDialog, currentUserId } = useAdminUsers();
  const { state, execute } = useMutation(updateUserRoles);
  const initialRoleIds = user.roles.map((r) => r.id);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialRoleIds);

  // An admin editing their own roles must keep system_admin, otherwise they
  // lose access to this page and cannot undo the change.
  const isSelf = user.id === currentUserId;
  const ownSystemAdminRoleId = isSelf
    ? roles.find((r) => r.name === SYSTEM_ADMIN_ROLE && initialRoleIds.includes(r.id))?.id
    : undefined;
  const lockedIds = ownSystemAdminRoleId ? [ownSystemAdminRoleId] : [];

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Roles updated successfully');
    }
  }, [state.status, closeDialog]);

  const isDirty =
    selectedRoleIds.length !== initialRoleIds.length ||
    selectedRoleIds.some((id) => !initialRoleIds.includes(id));

  function handleRoleChange(roleId: string, checked: boolean) {
    setSelectedRoleIds((prev) => (checked ? [...prev, roleId] : prev.filter((id) => id !== roleId)));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Edit Roles</DialogTitle>
        </DialogHeader>
        <UserIdentity user={user} />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          <RoleCheckboxList
            roles={roles}
            selectedIds={selectedRoleIds}
            onChange={handleRoleChange}
            disabled={state.status === 'pending'}
            lockedIds={lockedIds}
            lockedHint={SELF_DEMOTE_ERROR}
          />
        </div>
        {state.status === 'error' && <p className="text-xs text-destructive">{state.error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={state.status === 'pending'} className={TINTS.quietBtn}>
            Cancel
          </Button>
          <LoadingButton
            isLoading={state.status === 'pending'}
            disabled={!isDirty}
            onClick={() => execute(user.id, selectedRoleIds)}
            className={`bg-primary text-primary-foreground ${TINTS.primaryBtnHover}`}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditNameDialog({ user, open }: { user: UserListItem; open: boolean }) {
  const { updateUserName, closeDialog } = useAdminUsers();
  const { state, execute } = useMutation(updateUserName);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Name updated successfully');
    }
  }, [state.status, closeDialog]);

  const isDirty = firstName !== (user.firstName || '') || lastName !== (user.lastName || '');

  function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('First name and last name are required');
      return;
    }
    setValidationError(null);
    execute(user.id, firstName.trim(), lastName.trim());
  }

  const displayError = validationError || (state.status === 'error' ? state.error : null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Edit Name</DialogTitle>
        </DialogHeader>
        <UserIdentity user={user} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="edit-firstName"
            label="First Name"
            labelClassName="text-xs text-muted-foreground"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Juan"
          />
          <FormField
            id="edit-lastName"
            label="Last Name"
            labelClassName="text-xs text-muted-foreground"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Dela Cruz"
          />
        </div>
        {displayError && <p className="text-xs text-destructive">{displayError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={state.status === 'pending'} className={TINTS.quietBtn}>
            Cancel
          </Button>
          <LoadingButton
            isLoading={state.status === 'pending'}
            disabled={!isDirty || !firstName.trim() || !lastName.trim()}
            onClick={handleSave}
            className={`bg-primary text-primary-foreground ${TINTS.primaryBtnHover}`}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                     */
/* -------------------------------------------------------------------------- */

/** The full per-user action set, reachable without expanding the row. */
function UserActionsMenu({ user }: { user: UserListItem }) {
  const { openDialog, currentUserId } = useAdminUsers();
  const { isSelf, canToggle, canDelete } = selfProtection(user, currentUserId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Actions for ${user.email}`}
          className={`rounded-md p-1.5 text-muted-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${TINTS.rowMenuBtn}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      {/* Radix portals the menu into a React child of the row, so clicks inside
          it still bubble to the row's expand handler and have to be stopped. */}
      <DropdownMenuContent align="end" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDialog({ type: 'edit-name', user }); }}>
          <Settings2 className="h-4 w-4" />
          Edit name
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDialog({ type: 'edit-roles', user }); }}>
          <ShieldCheck className="h-4 w-4" />
          Edit roles
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canToggle}
          onSelect={(e) => { e.preventDefault(); openDialog({ type: 'toggle', user }); }}
        >
          {user.isBanned
            ? <><UserRoundCheck className="h-4 w-4" />Activate user</>
            : <><UserRoundX className="h-4 w-4" />Deactivate user</>}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canDelete}
          className={canDelete ? TINTS.dangerMenuItem : undefined}
          onSelect={(e) => { e.preventDefault(); openDialog({ type: 'delete', user }); }}
        >
          <Trash2 className="h-4 w-4" />
          Delete user
        </DropdownMenuItem>
        {isSelf && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            This is your own account, so it cannot be deactivated or deleted here.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({ user, isExpanded }: { user: UserListItem; isExpanded: boolean }) {
  const { selectUser, currentUserId } = useAdminUsers();
  const { isSelf } = selfProtection(user, currentUserId);
  const toggle = () => selectUser(isExpanded ? null : user.id);

  return (
    <TableRow
      // Each state's background has to repeat as a `hover:` class, otherwise
      // TableRow's own `hover:bg-muted` wins and the open row turns grey.
      className={`group cursor-pointer transition-colors duration-150 ${
        isExpanded ? TINTS.rowOpen : TINTS.rowIdle
      }`}
      onClick={toggle}
    >
      <TableCell className={`relative py-4 pr-3 ${GUTTER_L}`}>
        {/* Accent rail. Always present but transparent when idle, so turning it
            on never nudges the row's contents sideways. It lines up with the
            detail panel's rail, making an open row and its panel read as one
            block. */}
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 transition-all duration-150 ${
            isExpanded ? 'w-1 bg-row-accent' : 'w-0.5 bg-transparent group-hover:bg-border'
          }`}
        />
        <div className="flex items-center gap-3">
          {/* A real button, so the row can be expanded from the keyboard — the
              row's own click handler is mouse-only. */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${user.email}`}
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className={`shrink-0 rounded-md p-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isExpanded ? 'text-row-accent-foreground' : 'text-muted-foreground group-hover:text-foreground'
            }`}
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
          <UserAvatar user={user} className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* Weight deliberately does not change with state: semibold is
                  wider than medium, so the name would visibly reflow on every
                  click. The rail, chevron, avatar ring and row tint carry the
                  state instead. */}
              <DisplayName user={user} className="truncate text-sm font-medium text-foreground" />
              {isSelf && (
                <Badge
                  variant="outline"
                  className="border-border bg-card px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide text-muted-foreground hover:bg-card"
                >
                  You
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden px-3 py-4 md:table-cell">
        <RoleBadges roles={user.roles} />
      </TableCell>
      <TableCell className="px-3 py-4">
        <StatusPill isBanned={user.isBanned} />
      </TableCell>
      <TableCell className={`w-14 py-4 pl-3 text-right ${GUTTER_R}`}>
        <UserActionsMenu user={user} />
      </TableCell>
    </TableRow>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Detail panel rendered directly beneath the row it belongs to, so it is always
 * adjacent to the user that was clicked no matter how far down the list they are.
 */
function UserDetailRow({ user }: { user: UserListItem }) {
  const { openDialog, currentUserId } = useAdminUsers();
  const { isSelf, canToggle, canDelete } = selfProtection(user, currentUserId);
  const panelRef = useRef<HTMLDivElement>(null);

  // A row near the bottom of the scroll area would otherwise open its panel
  // off-screen.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  return (
    // The body carries no tint of its own, so the block is delimited by
    // structure instead: the gold rail down the left, the row's ordinary grey
    // divider closing it off, and a shadow cast downward so the open block
    // reads as lifted off the list rather than as another plain row.
    <TableRow className="bg-card hover:bg-card">
      {/* z-[1] lifts the panel above the rows that paint after it, so its cast
          shadow lands on top of them instead of being covered. Kept below the
          sticky header's z-10 so it never rides over the column titles. */}
      <TableCell colSpan={4} className="relative z-[1] p-0">
        {/* Same rail as the open row above, continuing down the panel. Drawn as
            an overlay rather than a left border so the panel's text keeps the
            card's gutter instead of being pushed in by the rail's width. */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-row-accent" />
        <div
          ref={panelRef}
          className={`animate-in fade-in-0 slide-in-from-top-2 shadow-[0_10px_12px_-10px_var(--row-panel-shadow)] duration-200 pb-6 pt-4 ${GUTTER}`}
        >
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="First name">{user.firstName || '—'}</DetailField>
            <DetailField label="Last name">{user.lastName || '—'}</DetailField>
            <DetailField label="Email address">
              <span className="break-all">{user.email}</span>
            </DetailField>
            <DetailField label="Assigned roles">
              <RoleBadges roles={user.roles} />
            </DetailField>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog({ type: 'edit-name', user })}
              className={TINTS.quietBtn}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Edit name
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog({ type: 'edit-roles', user })}
              className={TINTS.quietBtn}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Edit roles
            </Button>

            <span className="grow" />

            <Button
              size="sm"
              variant="outline"
              disabled={!canToggle}
              onClick={() => openDialog({ type: 'toggle', user })}
              className={user.isBanned ? TINTS.successBtn : TINTS.quietBtn}
            >
              {user.isBanned
                ? <><UserRoundCheck className="h-3.5 w-3.5" />Activate</>
                : <><UserRoundX className="h-3.5 w-3.5" />Deactivate</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canDelete}
              onClick={() => openDialog({ type: 'delete', user })}
              className={TINTS.dangerBtn}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>

          {isSelf && (
            <p className="mt-3 text-xs text-muted-foreground">
              This is your own account. Ask another system administrator to deactivate or delete it.
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Toolbar                                                                   */
/* -------------------------------------------------------------------------- */

/** Status filter as a segmented control, doubling as an at-a-glance breakdown. */
function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  const tabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  return (
    <div role="tablist" aria-label="Filter by status" className="inline-flex items-center gap-1 rounded-lg bg-row-hover p-1">
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`text-xs tabular-nums ${isActive ? 'text-muted-foreground' : ''}`}>
              {counts[tab.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RoleFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { roles } = useAdminUsers();
  const active = roles.find((r) => r.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${TINTS.quietBtn}`}>
          <ListFilter className="h-4 w-4 text-muted-foreground" />
          {active ? roleLabel(active.name) : 'All roles'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Role
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); onChange(null); }}
          className="justify-between"
        >
          All roles
          {value === null && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        {roles.map((role) => (
          <DropdownMenuItem
            key={role.id}
            onSelect={(e) => { e.preventDefault(); onChange(role.id); }}
            className="justify-between"
          >
            {roleLabel(role.name)}
            {value === role.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loading / empty states                                                    */
/* -------------------------------------------------------------------------- */

/** Placeholder rows shaped like the real ones, so loading does not reflow. */
function UserTableSkeleton() {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 py-4 ${GUTTER}`}>
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36 max-w-full" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-6 w-28 shrink-0 rounded-md md:block" />
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  isFiltered,
  onClearFilters,
  onCreateUser,
}: {
  isFiltered: boolean;
  onClearFilters: () => void;
  onCreateUser: () => void;
}) {
  const Icon = isFiltered ? SearchX : UserRoundPlus;

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {isFiltered ? 'No matching users' : 'No users yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isFiltered
            ? 'Try a different search term, or clear the filters to see everyone.'
            : 'Create the first account to give your team access to the system.'}
        </p>
      </div>
      {isFiltered ? (
        <Button variant="outline" onClick={onClearFilters} className={`gap-1.5 ${TINTS.quietBtn}`}>
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : (
        <Button onClick={onCreateUser} className={`gap-2 bg-primary text-primary-foreground ${TINTS.primaryBtnHover}`}>
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

function UserManagementContent() {
  const {
    users,
    visibleUsers,
    isLoading,
    error,
    selectedUserId,
    activeDialog,
    openDialog,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
  } = useAdminUsers();

  const { rendered: dialog, isOpen: isDialogOpen } = useDialogPresence(activeDialog);

  const isFiltered = search.trim() !== '' || roleFilter !== null || statusFilter !== 'all';
  const counts: Record<StatusFilter, number> = {
    all: users.length,
    active: users.filter((u) => !u.isBanned).length,
    inactive: users.filter((u) => u.isBanned).length,
  };

  function clearFilters() {
    setSearch('');
    setRoleFilter(null);
    setStatusFilter('all');
  }

  return (
    <>
      <Card className="flex flex-1 flex-col overflow-hidden border-border bg-card">
        {/* Header */}
        <div className={`flex flex-wrap items-start justify-between gap-4 pb-5 pt-6 ${GUTTER}`}>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              User Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Create accounts and control what each member of the team can reach.
            </p>
          </div>
          <Button
            onClick={() => openDialog({ type: 'create' })}
            className={`gap-2 bg-primary text-primary-foreground ${TINTS.primaryBtnHover}`}
          >
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        </div>

        {/* Toolbar */}
        <div className={`flex flex-col gap-3 pb-5 xl:flex-row xl:items-center xl:justify-between ${GUTTER}`}>
          <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email or role"
                aria-label="Search users"
                className="w-full pl-9 sm:w-72"
              />
            </div>
            <RoleFilter value={roleFilter} onChange={setRoleFilter} />
            {isFiltered && (
              <Button variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:bg-row-hover hover:text-foreground">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
              <p className="text-sm font-medium text-destructive">Could not load users</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : isLoading ? (
            <UserTableSkeleton />
          ) : visibleUsers.length === 0 ? (
            <EmptyState
              isFiltered={isFiltered}
              onClearFilters={clearFilters}
              onCreateUser={() => openDialog({ type: 'create' })}
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-card hover:bg-card">
                  <TableHead className={`h-11 pr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_L}`}>
                    User
                  </TableHead>
                  <TableHead className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    Roles
                  </TableHead>
                  <TableHead className="h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className={`h-11 w-14 pl-3 ${GUTTER_R}`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.map((user) => {
                  const isExpanded = selectedUserId === user.id;
                  return (
                    <Fragment key={user.id}>
                      <UserRow user={user} isExpanded={isExpanded} />
                      {isExpanded && <UserDetailRow user={user} />}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        {!error && (
          <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-border py-3 ${GUTTER}`}>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isLoading
                ? 'Loading users…'
                : isFiltered
                  ? `Showing ${visibleUsers.length} of ${users.length} user${users.length === 1 ? '' : 's'}`
                  : `${users.length} user${users.length === 1 ? '' : 's'}`}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Select a row to see full details
            </p>
          </div>
        )}
      </Card>

      {/* Keyed by user id: a dialog that lingers for its exit animation must not
          be reused for a different user, or it would reopen carrying the
          previous user's form state. */}
      {dialog?.type === 'create' && <CreateUserModal open={isDialogOpen} />}
      {dialog?.type === 'edit-name' && <EditNameDialog key={dialog.user.id} open={isDialogOpen} user={dialog.user} />}
      {dialog?.type === 'edit-roles' && <EditRolesDialog key={dialog.user.id} open={isDialogOpen} user={dialog.user} />}
      {dialog?.type === 'toggle' && <ToggleUserDialog key={dialog.user.id} open={isDialogOpen} user={dialog.user} />}
      {dialog?.type === 'delete' && <DeleteUserDialog key={dialog.user.id} open={isDialogOpen} user={dialog.user} />}
    </>
  );
}

export function UserManagementSection({ currentUserId }: { currentUserId: string }) {
  return (
    <AdminUsersProvider currentUserId={currentUserId}>
      <UserManagementContent />
    </AdminUsersProvider>
  );
}
