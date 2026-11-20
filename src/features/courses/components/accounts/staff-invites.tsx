"use client";

/**
 * Members: invite tutors and admins by email, and see or revoke pending
 * invites (#174; a/ux/01, section 5). A's inviteStaff, listInvites and
 * revokeInvite. Only the owner can invite admins; the server checks too.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { inviteStaff, revokeInvite } from "@/features/auth/invite-actions";
import { formatDate } from "@/lib/datetime";

import { actionError, parseEmails } from "../../lib/account-ui";

export interface InviteRow {
  id: string;
  email: string;
  role: string | null;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  state: "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";
}

const RESULT_LABEL = { INVITED: "invited", RESENT: "sent a new link", ALREADY_MEMBER: "already a member" } as const;

export function InviteStaffForm({ canInviteAdmins }: { canInviteAdmins: boolean }) {
  const router = useRouter();
  const [raw, setRaw] = React.useState("");
  const [role, setRole] = React.useState<"TUTOR" | "ADMIN">("TUTOR");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Array<{ email: string; status: keyof typeof RESULT_LABEL }> | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    const { emails, bad } = parseEmails(raw);
    if (bad.length) return setError(`These don't look like email addresses: ${bad.join(", ")}`);
    if (emails.length === 0) return setError("Enter at least one email address.");
    if (emails.length > 50) return setError("Invite up to 50 people at a time.");
    setBusy(true);
    const res = await inviteStaff({ emails, role });
    setBusy(false);
    if (!res?.data) return setError(actionError(res));
    setResults(res.data as Array<{ email: string; status: keyof typeof RESULT_LABEL }>);
    setRaw("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium">Email addresses</span>
        <Textarea rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="One or more, separated by commas or new lines" />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium">Role</span>
          <Select value={role} onValueChange={(v) => setRole(v as "TUTOR" | "ADMIN")}>
            <SelectTrigger className="w-40" aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TUTOR">Tutor</SelectItem>
              {canInviteAdmins ? <SelectItem value="ADMIN">Admin</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Send invites
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {role === "ADMIN" ? "Admins manage tutors, students, fees and settings." : "Tutors teach the courses you give them."} The link
        works for 7 days.
      </p>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {results ? (
        <ul className="space-y-0.5 text-sm" aria-live="polite">
          {results.map((r) => (
            <li key={r.email}>
              {r.email}: {RESULT_LABEL[r.status] ?? r.status}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

const STATE_LABEL: Record<InviteRow["state"], string> = {
  PENDING: "Waiting",
  EXPIRED: "Expired",
  ACCEPTED: "Joined",
  REVOKED: "Cancelled",
};

export function InviteList({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function revoke(id: string) {
    setBusyId(id);
    setError(null);
    const res = await revokeInvite({ inviteId: id });
    setBusyId(null);
    if (!res?.data) return setError(actionError(res));
    router.refresh();
  }

  if (invites.length === 0) return <p className="text-muted-foreground text-sm">No invites yet.</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-border border-border divide-y rounded-lg border">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-muted-foreground text-xs">
                {i.role === "ADMIN" ? "Admin" : "Tutor"} · invited by {i.invitedBy} on {formatDate(i.createdAt)}
                {i.state === "PENDING" ? ` · link works until ${formatDate(i.expiresAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={i.state === "PENDING" ? "secondary" : "outline"}>{STATE_LABEL[i.state] ?? i.state}</Badge>
              {i.state === "PENDING" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyId === i.id}
                  onClick={() => revoke(i.id)}
                  aria-label={`Cancel the invite for ${i.email}`}
                >
                  {busyId === i.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                  Cancel
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
