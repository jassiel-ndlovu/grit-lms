/**
 * UserList — table of every provisioned user with an inline
 * password-reset dialog. Tutor-only.
 *
 * The Student/Tutor profile flags surface a common mistake — a User was
 * created without its linked profile row, which breaks course enrolment
 * and grading. The row highlights that case in amber.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { resetUserPassword } from "../actions";
import type { ManagedUserRow } from "../queries";

interface Props {
  users: ManagedUserRow[];
}

function suggestPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const special = "!@#$%&*";
  const bytes = new Uint32Array(11);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (n) => chars[n % chars.length]).join("");
  const tailByte = crypto.getRandomValues(new Uint32Array(1))[0];
  return body + special[tailByte % special.length];
}

export function UserList({ users }: Props) {
  const router = useRouter();
  const [resetTarget, setResetTarget] = useState<ManagedUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  function openReset(u: ManagedUserRow) {
    setResetTarget(u);
    setNewPassword(suggestPassword());
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const res = await resetUserPassword({
        userId: resetTarget.id,
        newPassword,
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      try {
        await navigator.clipboard.writeText(newPassword);
        toast.success(`Password reset for ${resetTarget.name} — copied.`);
      } catch {
        toast.success(`Password reset for ${resetTarget.name}.`);
      }
      setResetTarget(null);
      setNewPassword("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setPending(false);
    }
  }

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        No users yet. Add your first student using the form above.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Profile</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const needsProfile =
                (u.role === "STUDENT" && !u.hasStudentProfile) ||
                (u.role === "TUTOR" && !u.hasTutorProfile);
              return (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={u.role === "TUTOR" ? "default" : "secondary"}
                      className={
                        u.role === "TUTOR"
                          ? "bg-brand-terracotta text-brand-terracotta-foreground"
                          : ""
                      }
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {needsProfile ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="size-4" />
                        <span className="text-xs">Missing</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="size-4" />
                        <span className="text-xs">Linked</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReset(u)}
                    >
                      <KeyRound className="mr-2 size-4" />
                      Reset password
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={resetTarget != null}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-medium">{resetTarget?.name}</span>. Share
              the new password with them out-of-band — it&apos;ll be copied to
              your clipboard when you submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium" htmlFor="new-password">
              New password
            </label>
            <div className="flex gap-2">
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setNewPassword(suggestPassword())}
                aria-label="Generate new password"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Must be at least 8 characters.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitReset}
              disabled={pending}
              className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reset & copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
