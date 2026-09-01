"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/lib/actions/admin-register";
import { login, logout } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Page() {
    const router = useRouter();
    const [checked, setChecked] = useState(false);
    const [notifChecked, setNotifChecked] = useState(true);

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
        <div className="flex flex-col items-center gap-6 p-10">

            {/* Buttons & Functions which i demonstrated this Monday */}
            <Card className="min-w-2xl max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="text-xl"> Functions </CardTitle>
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

            {/* Shadcn Components */}

            <Card className="min-w-2xl max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="text-xl">Shadcn Components</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">

                    Buttons
                    <section className="flex flex-wrap gap-2">
                        <Button variant="default">Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="destructive">Destructive</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                        <Button size="sm">Small</Button>
                        <Button size="lg">Large</Button>
                        <Button size="default" disabled>Disabled</Button>
                    </section>

                    Badges
                    <section className="flex flex-wrap gap-2">
                        <Badge variant="default">Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="outline">Outline</Badge>
                    </section>

                    Input & Label
                    <section className="flex flex-wrap gap-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="demo-email">Email</Label>
                            <Input id="demo-email" type="email" placeholder="you@example.com" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="demo-disabled">Disabled</Label>
                            <Input id="demo-disabled" placeholder="Cannot type here" disabled />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="demo-checkbox"
                                checked={checked}
                                onCheckedChange={(v) => setChecked(!!v)}
                            />
                            <Label htmlFor="demo-checkbox">
                                {checked ? "Checked" : "Unchecked"}
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="demo-checkbox-disabled" disabled />
                            <Label htmlFor="demo-checkbox-disabled" className="text-muted-foreground">Disabled</Label>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    Actions <ChevronDown className="ml-1 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>Profile</DropdownMenuItem>
                                <DropdownMenuItem>Settings</DropdownMenuItem>
                                <DropdownMenuItem>Billing</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">Log out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    Checkboxes <ChevronDown className="ml-1 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={notifChecked}
                                    onCheckedChange={setNotifChecked}
                                >
                                    Email notifications
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={false} disabled>
                                    SMS (unavailable)
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </section>

                    <section >

                        <b> To add new shadcn components use this command: </b>
                        <p> <code> npx shadcn@latest add {"<component-name>"} </code> </p> <br />
                        <p> <b> Examples: </b> </p>

                        <p> <code> npx shadcn@latest add checkbox </code> </p>
                        <p> <a href="https://ui.shadcn.com/docs/components/base/checkbox">(https://ui.shadcn.com/docs/components/base/checkbox)</a> </p> <br />

                        <p> <code> npx shadcn@latest add badge </code> </p>
                        <p> <a href="https://ui.shadcn.com/docs/components/base/badge">(https://ui.shadcn.com/docs/components/base/badge)</a> </p>  <br />

                        <p> <code> npx shadcn@latest add button-group </code> </p>
                        <p> <a href="https://ui.shadcn.com/docs/components/base/button-group">(https://ui.shadcn.com/docs/components/base/button-group)</a> </p> <br />

                        <p> <code> npx shadcn@latest add spinner </code> </p>
                        <p> <a href="https://ui.shadcn.com/docs/components/base/spinner">(https://ui.shadcn.com/docs/components/base/spinner)</a> </p> <br />

                        <p> Find other components and more info about them here: <a href="https://ui.shadcn.com/docs/components">https://ui.shadcn.com/docs/components</a> </p>

                    </section>

                </CardContent>
            </Card>
        </div>
    );
}
