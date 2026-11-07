"use client";

import { useMemo, useState } from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";

interface AuthFormProps {
  isSignIn: boolean;
}

/** Only same-site paths: `?next=//evil.com` must not become an open redirect. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) return "/";
  return raw;
}

export function AuthForm({ isSignIn }: AuthFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { login, register } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  // Sign-in only needs *a* password (the server decides if it's right);
  // sign-up enforces a username and a minimum length up front.
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email("Enter a valid email address."),
        password: isSignIn
          ? z.string().min(1, "Enter your password.")
          : z.string().min(8, "Use at least 8 characters."),
        username: isSignIn
          ? z.string().optional()
          : z.string().trim().min(3, "Pick a username of at least 3 characters."),
      }),
    [isSignIn],
  );
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", username: "" },
  });
  const submitting = form.formState.isSubmitting;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      if (isSignIn) await login?.(values.email.trim(), values.password);
      else await register?.(values.username ?? "", values.email.trim(), values.password);
      router.replace(safeNext(search.get("next")));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {!isSignIn && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="johndoe" autoComplete="username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="example@email.com"
                  type="email"
                  autoComplete={isSignIn ? "username" : "email"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  placeholder="••••••••"
                  type="password"
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSignIn ? "Sign In" : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
