/**
 * CreateUserForm — tutor-only form for provisioning a new Student user.
 *
 * Submits to the createStudentUser server action, which creates both the
 * User row (with hashed password + role=STUDENT) and the linked Student
 * profile in one transaction. Suggests a random password on request.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { CreateStudentUserSchema } from "../schemas";
import { createStudentUser } from "../actions";

const FormSchema = CreateStudentUserSchema;
type FormValues = z.input<typeof FormSchema>;

function suggestPassword(): string {
  // 12-char mix of upper/lower/digits + one special
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const special = "!@#$%&*";
  const bytes = new Uint32Array(11);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (n) => chars[n % chars.length]).join("");
  const tailByte = crypto.getRandomValues(new Uint32Array(1))[0];
  return body + special[tailByte % special.length];
}

export function CreateUserForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      imageUrl: null,
    },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const res = await createStudentUser(values);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        toast.error("Please check the form for errors.");
        return;
      }
      toast.success(`Created student: ${values.fullName}`);
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setPending(false);
    }
  }

  function handleGeneratePassword() {
    const pwd = suggestPassword();
    form.setValue("password", pwd, { shouldValidate: true, shouldDirty: true });
    setShowPassword(true);
  }

  async function copyPassword() {
    const pwd = form.getValues("password");
    if (!pwd) {
      toast.error("Nothing to copy — generate or type a password first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(pwd);
      toast.success("Password copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Anesu Musungo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Used for sign-in and to link the student profile.
              </FormDescription>
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
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                  aria-label="Copy password"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Generate
                </Button>
              </div>
              <FormDescription>
                Share this with the student — they can change it after they
                sign in.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create student
          </Button>
        </div>
      </form>
    </Form>
  );
}
