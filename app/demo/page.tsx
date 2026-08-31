"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { registerUser } from "@/lib/actions/admin-register";
import { login, logout } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Page() {
    const router = useRouter();

    const handleLogin = async () => {
        await login({ email: "admin@example.com", password: "admin" });
        router.push("/protected");
    };

    const handleWhoAmI = async () => {
        const supabase = createClient();
        alert(JSON.stringify(await supabase.auth.getUser()));
    }

    const handleLogout = async () => {
        await logout();
        router.push("/auth/login");
    }

    const handleRegister = async () => {
        const result = await registerUser({ email: "new@examp1.com", password: "password" });

        if (result.success) {
            alert("it worked")
        } else {
            alert("it did not work")
        }
    }

    return (
        <div className="flex flex-col items-center justify-center p-10">
            <Card className="min-w-2xl max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="text-xl"> Demo </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" onClick={handleWhoAmI}>
                        Who am I?
                    </Button>

                    <Button variant="outline" onClick={handleLogin}>
                        Log in as admin
                    </Button>

                    <Button variant="outline" onClick={handleLogout}>
                        Log out
                    </Button>

                    <Button variant="outline" onClick={handleRegister}>
                        Register
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
