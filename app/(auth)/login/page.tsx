import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; registered?: string; error?: string; confirmed?: string }>;
}) {
  const [params, { m }] = await Promise.all([searchParams, getI18n()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{m.auth.welcomeBack}</CardTitle>
        <CardDescription>{m.auth.signInSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {params.registered && (
          <p className="mb-4 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success">
            {m.auth.checkEmail}
          </p>
        )}
        {params.confirmed && (
          <p role="status" className="mb-4 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success">
            {m.auth.emailConfirmed}
          </p>
        )}
        {params.error === "confirmation-failed" && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {m.auth.confirmationFailed}
          </p>
        )}
        <LoginForm redirectTo={params.redirectTo} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {m.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            {m.auth.signUp}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
