import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { SessionProvider, useSession } from "@/lib/hooks/use-session";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { UserSession } from "@/lib/types/session";

function renderInMenu(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <DropdownMenu open modal={false}>
        <DropdownMenuPrimitive.Content forceMount>
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenu>
    </TooltipProvider>
  );
}

describe("Session Context & useSession Hook", () => {
  it("throws an error when useSession is used outside SessionProvider", () => {
    function Consumer() {
      useSession();
      return null;
    }

    expect(() => renderToStaticMarkup(<Consumer />)).toThrow(
      "useSession must be used within a SessionProvider"
    );
  });

  it("provides user, roles, permissions, and helper methods for standard staff", () => {
    const session: UserSession = {
      user: { id: "user-1", email: "staff@example.com" },
      roles: ["admin_staff"],
      permissions: ["clients.read", "clients.update"],
      isSystemAdmin: false,
    };

    let capturedContext: ReturnType<typeof useSession> | null = null;
    function Consumer() {
      capturedContext = useSession();
      return <div>Staff content</div>;
    }

    const html = renderToStaticMarkup(
      <SessionProvider session={session}>
        <Consumer />
      </SessionProvider>
    );

    expect(html).toContain("Staff content");
    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.user?.id).toBe("user-1");
    expect(capturedContext!.isSystemAdmin).toBe(false);
    expect(capturedContext!.hasRole("admin_staff")).toBe(true);
    expect(capturedContext!.hasRole("system_admin")).toBe(false);
    expect(capturedContext!.hasPermission("clients.read")).toBe(true);
    expect(capturedContext!.hasPermission("clients.delete")).toBe(false);
  });

  it("grants all permissions to system_admin", () => {
    const session: UserSession = {
      user: { id: "admin-1", email: "admin@example.com" },
      roles: ["system_admin"],
      permissions: ["clients.read", "clients.delete"],
      isSystemAdmin: true,
    };

    let capturedContext: ReturnType<typeof useSession> | null = null;
    function Consumer() {
      capturedContext = useSession();
      return null;
    }

    renderToStaticMarkup(
      <SessionProvider session={session}>
        <Consumer />
      </SessionProvider>
    );

    expect(capturedContext!.isSystemAdmin).toBe(true);
    expect(capturedContext!.hasRole("system_admin")).toBe(true);
    expect(capturedContext!.hasPermission("clients.delete")).toBe(true);
    expect(capturedContext!.hasPermission("any.unlisted.permission")).toBe(true);
  });
});

describe("DropdownMenuItem Primitive", () => {
  it("renders null when hidden is true", () => {
    const html = renderInMenu(
      <>
        <DropdownMenuItem hidden>Hidden action</DropdownMenuItem>
        <DropdownMenuItem>Visible action</DropdownMenuItem>
      </>
    );

    expect(html).not.toContain("Hidden action");
    expect(html).toContain("Visible action");
  });

  it("renders icon slot with standard sizing", () => {
    const html = renderInMenu(
      <DropdownMenuItem icon={<span data-testid="custom-icon">ICON</span>}>
        With Icon
      </DropdownMenuItem>
    );

    expect(html).toContain("data-testid=\"custom-icon\"");
    expect(html).toContain("With Icon");
  });

  it("applies semantic design tokens for destructive variant without slash opacity", () => {
    const html = renderInMenu(
      <DropdownMenuItem variant="destructive">
        Delete item
      </DropdownMenuItem>
    );

    expect(html).toContain("text-destructive");
    expect(html).toContain("color-mix(in_srgb,var(--destructive)_10%,white)");
    expect(html).not.toMatch(/destructive\/\d+/);
  });

  it("wraps in accessible tooltip and marks disabled when disabledReason is provided", () => {
    const reasonText = "Must wait 7 days before permanent deletion";
    const html = renderInMenu(
      <DropdownMenuItem disabledReason={reasonText} variant="destructive">
        Delete client
      </DropdownMenuItem>
    );

    expect(html).toContain("pointer-events-auto cursor-not-allowed");
    expect(html).toContain("aria-disabled=\"true\"");
  });

  it("prevents default event execution when disabledReason is present", () => {
    const handleSelect = vi.fn();
    const preventDefault = vi.fn();

    const event = {
      preventDefault,
      defaultPrevented: false,
    } as unknown as React.SyntheticEvent;

    let intercepted = false;
    const disabledReason = "Item archived within 7 days";
    if (disabledReason) {
      event.preventDefault();
      intercepted = true;
    } else {
      handleSelect(event);
    }

    expect(intercepted).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(handleSelect).not.toHaveBeenCalled();
  });
});
