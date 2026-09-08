/**
 * PasswordForm — signed-in user rotates their own password.
 *
 * Requires the current password (server-side re-verified before update).
 * The three fields are toggle-viewable individually so the user can spot
 * typos without exposing every field at once.
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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

import { ChangeOwnPasswordSchema } from "../schemas";
import { changeOwnPassword } from "../actions";

type FormValues = z.input<typeof ChangeOwnPasswordSchema>;

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState<
    Record<"current" | "next" | "confirm", boolean>
  >({ current: false, next: false, confirm: false });

  const form = useForm<FormValues>({
    resolver: zodResolver(ChangeOwnPasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const res = await changeOwnPassword(values);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Password updated.");
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPending(false);
    }
  }

  function toggle(key: "current" | "next" | "confirm") {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    type={visible.current ? "text" : "password"}
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggle("current")}
                  aria-label="Toggle visibility"
                >
                  {visible.current ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    type={visible.next ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggle("next")}
                  aria-label="Toggle visibility"
                >
                  {visible.next ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    type={visible.confirm ? "text" : "password"}
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggle("confirm")}
                  aria-label="Toggle visibility"
                >
                  {visible.confirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
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
            Change password
          </Button>
        </div>
      </form>
    </Form>
  );
}
