"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthForm } from "@/components/auth-form";
import { BookOpen } from "lucide-react";

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);

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

        <AuthForm isSignIn={isSignIn} />

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setIsSignIn(!isSignIn)}
        >
          {isSignIn ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
}