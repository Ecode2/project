"use client";

import { useState } from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useRouter } from "next/navigation";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).optional(),
});

interface AuthFormProps {
  isSignIn: boolean;
}

export function AuthForm({ isSignIn }: AuthFormProps) {
  const router = useRouter();
  const { login, register } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: formData,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = formData;
    try {
      if (isSignIn) {
        if (login) {
          await login(values.email, values.password);
        }
      } else {
        if (register) {
          await register(values.username || "", values.email, values.password);
        }
      }
      router.push("/");
    } catch (error) {
      console.error("Authentication failed:", error);
      // Handle error, e.g., show a notification
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {!isSignIn && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="johndoe"
                    {...field}
                    value={formData.username}
                    onChange={handleInputChange}
                  />
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
                  {...field}
                  value={formData.email}
                  onChange={handleInputChange}
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
                  {...field}
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          {isSignIn ? "Sign In" : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
