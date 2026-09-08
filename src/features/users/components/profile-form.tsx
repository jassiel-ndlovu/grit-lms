/**
 * ProfileForm — the signed-in user edits their own name / bio / avatar.
 *
 * Bio is only shown for tutors (matches the schema — Student has no bio
 * field). Avatar upload uses the same client-blob path as other uploads
 * — we fall back to a plain URL field if `paths.ts` isn't configured.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { UpdateOwnProfileSchema } from "../schemas";
import { updateOwnProfile } from "../actions";

type FormValues = z.input<typeof UpdateOwnProfileSchema>;

interface Props {
  role: "STUDENT" | "TUTOR" | "ADMIN";
  defaults: {
    fullName: string;
    bio?: string | null;
    imageUrl?: string | null;
  };
}

export function ProfileForm({ role, defaults }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(UpdateOwnProfileSchema),
    defaultValues: {
      fullName: defaults.fullName ?? "",
      bio: defaults.bio ?? "",
      imageUrl: defaults.imageUrl ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const payload = {
        fullName: values.fullName,
        ...(role === "TUTOR" ? { bio: values.bio ?? null } : {}),
        imageUrl:
          values.imageUrl && values.imageUrl.trim().length > 0
            ? values.imageUrl.trim()
            : null,
      };
      const res = await updateOwnProfile(payload);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Profile updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPending(false);
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://…"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Paste a link to a hosted image. Leave empty to use your
                initials.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {role === "TUTOR" && (
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    placeholder="A short intro students see on your course pages."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
