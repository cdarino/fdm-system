"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { logout as signOut } from "@/lib/auth";

/** 
 * Client button that signs the current user out of Supabase and redirects them 
 * to `/login`.
 */
export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await signOut();
    router.replace("/");
    router.refresh();
  };

  return <Button onClick={logout}>Logout</Button>;
}
