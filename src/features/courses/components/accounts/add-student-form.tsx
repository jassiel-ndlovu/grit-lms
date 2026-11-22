"use client";

/**
 * Add a student (#174; a/ux/01, section 6): createStudentAccount, then the
 * sign-in card with the username and one-time code. Email and username are
 * optional; without a username Nexa makes one from the name. A minor needs
 * the tutor's consent tick (design 02).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReadOnlyNote, WriteGuard } from "@/components/shell/workspace-access";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createStudentAccount } from "@/features/users/account-actions";

import type { RosterCourse } from "../../lib/roster";
import { actionError, BILLING_PATH, isStudentLimitError } from "../../lib/account-ui";
import { SignInCard, type SignInCardData } from "./sign-in-card";

export function AddStudentForm({
  courses,
  workspaceName,
  coursesRequired,
}: {
  courses: RosterCourse[];
  workspaceName: string;
  /** Tutors must pick at least one of their courses; owners may add to none. */
  coursesRequired: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [isMinor, setIsMinor] = React.useState(true);
  const [consent, setConsent] = React.useState(false);
  const [courseIds, setCourseIds] = React.useState<string[]>(courses.length === 1 ? [courses[0].id] : []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [atLimit, setAtLimit] = React.useState(false);
  const [card, setCard] = React.useState<SignInCardData | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setUsername("");
    setIsMinor(true);
    setConsent(false);
    setCard(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAtLimit(false);
    if (fullName.trim().length < 2) return setError("Enter the student's full name.");
    if (coursesRequired && courseIds.length === 0) return setError("Choose at least one of your courses.");
    if (isMinor && !consent) return setError("Confirm you have a parent's or guardian's consent.");
    setBusy(true);
    const res = await createStudentAccount({
      fullName: fullName.trim(),
      email: email.trim() || null,
      ...(username.trim() ? { username: username.trim().toLowerCase() } : {}),
      isMinor,
      courseIds,
      consentAttested: isMinor ? consent : false,
    });
    setBusy(false);
    if (!res?.data) {
      setAtLimit(isStudentLimitError(res?.serverError));
      return setError(actionError(res));
    }
    setCard({
      name: fullName.trim(),
      role: "Student",
      workspaceName,
      username: res.data.username,
      email: res.data.email,
      code: res.data.code,
      expiresAt: typeof res.data.codeExpiresAt === "string" ? res.data.codeExpiresAt : new Date(res.data.codeExpiresAt).toISOString(),
    });
    router.refresh();
  }

  if (card) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Added. Give {card.name} this card.</p>
        <SignInCard card={card} onDone={reset} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium">Full name</span>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">Email (optional)</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">Username (optional)</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="We'll make one" />
        </label>
      </div>

      {courses.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">Courses{coursesRequired ? "" : " (optional)"}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={courseIds.includes(c.id)}
                  onCheckedChange={(v) => setCourseIds((ids) => (v ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : coursesRequired ? (
        <p className="text-muted-foreground text-sm">Create a course first, then add its students.</p>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isMinor} onCheckedChange={(v) => setIsMinor(v === true)} />
        Under 18
      </label>
      {isMinor ? (
        <label className="bg-muted/40 flex items-start gap-2 rounded-md p-3 text-sm">
          <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
          <span>I have a parent&apos;s or guardian&apos;s consent to create this account and keep the student&apos;s schoolwork on Nexa.</span>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
          {atLimit ? (
            <>
              {" "}
              <Link href={BILLING_PATH} className="text-foreground font-medium underline underline-offset-2">
                Go to billing
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <ReadOnlyNote billingHref={BILLING_PATH} />
      <WriteGuard label="Add student" size="default" variant="default">
        <Button type="submit" disabled={busy || (coursesRequired && courses.length === 0)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Add student
        </Button>
      </WriteGuard>
    </form>
  );
}
