"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthForm, safeNext } from "@/components/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen } from "lucide-react";

function AuthInner() {
  const [isSignIn, setIsSignIn] = useState(true);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  // Someone who is already signed in has no business here: send them on.
  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(safeNext(search.get("next")));
  }, [loading, isAuthenticated, router, search]);

  if (loading || isAuthenticated) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  return (
    <div className="container flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Welcome to BookVerse</h1>
          <p className="text-muted-foreground">
            {isSignIn ? "Sign in to continue reading" : "Create an account to get started"}
          </p>
        </div>

        {/* key: switching modes must reset field errors and the server message */}
        <AuthForm key={isSignIn ? "in" : "up"} isSignIn={isSignIn} />

        <Button variant="ghost" className="w-full" onClick={() => setIsSignIn(!isSignIn)}>
          {isSignIn ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthInner />
    </Suspense>
  );
}
