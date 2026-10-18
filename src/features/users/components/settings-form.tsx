/**
 * SettingsForm — user preferences editor. Persists to UserPreferences via
 * updateOwnPreferences.
 *
 * Sections, shown per role:
 *   - Email: verification status, email notifications on/off + frequency
 *   - Alerts: what to be told about. Students get course-content, due-date,
 *     grade and study alerts; tutors get submission and grading alerts.
 *     Each switch governs both the in-app notification and its email.
 *   - Appearance & region: dark mode, language, time zone
 *   - Default view: start page after sign-in, course layout
 *
 * Everything takes effect on save: the dashboard layout re-reads the
 * preferences, so theme, zone and locale apply app-wide immediately.
 */

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/components/preferences-provider";
import type { DashboardTab, Role } from "@/features/shared/enums";
import { formatDateTime, LANGUAGES } from "@/lib/datetime";

import { requestEmailVerification, updateOwnPreferences } from "../actions";
import { startPageOptions } from "../start-page";

type Frequency = "IMMEDIATE" | "DAILY" | "WEEKLY" | "NONE";
type View = "LIST" | "GRID" | "TIMELINE";

export interface SettingsFormValues {
  emailNotifications: boolean;
  notificationFrequency: Frequency;
  notifyOnCourseUpdate: boolean;
  notifyOnNewLesson: boolean;
  notifyOnNewTest: boolean;
  notifyOnDueDateReminder: boolean;
  notifyOnGrades: boolean;
  studyReminders: boolean;
  notifyOnSubmissions: boolean;
  notifyOnGradingQueue: boolean;
  darkMode: boolean;
  preferredLanguage: string;
  timeZone: string | null;
  preferredView: View;
  defaultDashboardTab: DashboardTab;
}

interface Props {
  role: Role;
  email: string;
  emailVerified: boolean;
  defaults: SettingsFormValues;
}

type Toggle = {
  key: keyof SettingsFormValues;
  title: string;
  description: string;
};

const STUDENT_ALERTS: Toggle[] = [
  { key: "notifyOnNewLesson", title: "New lessons", description: "When a lesson is published, updated or removed in your courses." },
  { key: "notifyOnNewTest", title: "Tests & assignments", description: "When a test or assignment is set, changed or withdrawn." },
  { key: "notifyOnDueDateReminder", title: "Due-date reminders", description: "A reminder the day before work you haven't handed in is due." },
  { key: "notifyOnGrades", title: "Grades released", description: "When your tutor releases a mark." },
  { key: "notifyOnCourseUpdate", title: "Course & schedule updates", description: "New courses, and lectures or events added to the calendar." },
  { key: "studyReminders", title: "Study reminders", description: "A nudge when you haven't opened a lesson for a few days." },
];

const TUTOR_ALERTS: Toggle[] = [
  { key: "notifyOnSubmissions", title: "Student submissions", description: "When a student hands in a test or assignment." },
  { key: "notifyOnGradingQueue", title: "Grading reminders", description: "A daily summary of submitted work still waiting for a mark." },
];

const FREQUENCIES: { value: Exclude<Frequency, "NONE">; label: string }[] = [
  { value: "IMMEDIATE", label: "As it happens" },
  { value: "DAILY", label: "Daily digest" },
  { value: "WEEKLY", label: "Weekly digest" },
];

const VIEWS: { value: View; label: string }[] = [
  { value: "GRID", label: "Grid" },
  { value: "LIST", label: "List" },
];

const AUTO_ZONE = "__auto";

function allTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Africa/Johannesburg", "UTC"];
  }
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-2">
        <h2 className="font-display text-xl leading-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Separator className="my-4" />
      <div className="divide-border divide-y">{children}</div>
    </Card>
  );
}

export function SettingsForm({ role, email, emailVerified, defaults }: Props) {
  const router = useRouter();
  const mounted = useMounted();
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState<SettingsFormValues>(defaults);
  const [values, setValues] = useState<SettingsFormValues>(defaults);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(saved),
    [values, saved],
  );

  const alerts = role === "STUDENT" ? STUDENT_ALERTS : role === "TUTOR" ? TUTOR_ALERTS : [];
  const zones = useMemo(allTimeZones, []);
  const deviceZone = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const effectiveZone = values.timeZone ?? deviceZone ?? undefined;

  function patch<K extends keyof SettingsFormValues>(key: K, v: SettingsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSave() {
    setPending(true);
    try {
      const res = await updateOwnPreferences(values);
      if (res?.serverError || res?.validationErrors) {
        toast.error(res.serverError ?? "Some settings are invalid.");
        return;
      }
      setSaved(values);
      toast.success("Preferences saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  async function onSendVerification() {
    setSending(true);
    try {
      const res = await requestEmailVerification({});
      if (res?.data?.ok) {
        toast.success(`Verification email sent to ${email}.`);
      } else {
        toast.error(res?.data?.ok === false ? res.data.error : res?.serverError ?? "Couldn't send the email.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Email" description="Notification emails, and how often they arrive.">
        <div className="py-3">
          {emailVerified ? (
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-brand-terracotta size-4" />
              <span className="text-foreground">{email}</span>
              <Badge variant="soft">Verified</Badge>
            </p>
          ) : (
            <div className="bg-brand-terracotta/[0.08] flex flex-col gap-3 rounded-md p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-foreground">
                <MailWarning className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
                <span>
                  Verify <strong>{email}</strong> to receive notification emails.
                </span>
              </p>
              <Button size="sm" variant="outline" onClick={onSendVerification} disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                Send verification email
              </Button>
            </div>
          )}
        </div>
        <Row title="Email notifications" description="Get your alerts by email as well as in the app.">
          <Switch
            checked={values.emailNotifications}
            onCheckedChange={(v) => {
              patch("emailNotifications", v);
              // "Never" was a frequency once; the switch replaces it.
              if (v && values.notificationFrequency === "NONE") patch("notificationFrequency", "IMMEDIATE");
            }}
            aria-label="Email notifications"
          />
        </Row>
        <Row
          title="Frequency"
          description="Digests arrive around 07:00 in your time zone; weekly ones on Mondays."
        >
          <Select
            value={values.notificationFrequency === "NONE" ? "IMMEDIATE" : values.notificationFrequency}
            onValueChange={(v) => patch("notificationFrequency", v as Frequency)}
            disabled={!values.emailNotifications}
          >
            <SelectTrigger className="w-44" aria-label="Email frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section
        title="Alerts"
        description="What we tell you about. Turning an alert off stops it in the app and by email."
      >
        {alerts.length === 0 ? (
          <p className="text-muted-foreground py-3 text-sm">
            Alert options for your account type are on the way.
          </p>
        ) : (
          alerts.map((a) => (
            <Row key={a.key} title={a.title} description={a.description}>
              <Switch
                checked={values[a.key] as boolean}
                onCheckedChange={(v) => patch(a.key, v as never)}
                aria-label={a.title}
              />
            </Row>
          ))
        )}
      </Section>

      <Section title="Appearance & region" description="How the app looks, and how dates are shown.">
        <Row title="Dark mode" description="Use a dark colour scheme across the app.">
          <Switch
            checked={values.darkMode}
            onCheckedChange={(v) => patch("darkMode", v)}
            aria-label="Dark mode"
          />
        </Row>
        <Row title="Language" description="Used for dates and numbers. The interface is in English for now.">
          <Select
            value={LANGUAGES.some((l) => l.value === values.preferredLanguage) ? values.preferredLanguage : "en-ZA"}
            onValueChange={(v) => patch("preferredLanguage", v)}
          >
            <SelectTrigger className="w-56" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row
          title="Time zone"
          description={
            mounted
              ? `Times are shown in this zone. It's ${formatDateTime(new Date(), { timeZone: effectiveZone }, { hour: "2-digit", minute: "2-digit", weekday: "short" })} there now.`
              : "Times are shown in this zone."
          }
        >
          <Select
            value={values.timeZone ?? AUTO_ZONE}
            onValueChange={(v) => patch("timeZone", v === AUTO_ZONE ? null : v)}
          >
            <SelectTrigger className="w-64" aria-label="Time zone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={AUTO_ZONE}>
                Use this device{deviceZone ? ` (${deviceZone})` : ""}
              </SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="Default view" description="Where you land, and how lists are laid out.">
        <Row title="Start page" description="Where you land after signing in.">
          <Select
            value={values.defaultDashboardTab}
            onValueChange={(v) => patch("defaultDashboardTab", v as DashboardTab)}
          >
            <SelectTrigger className="w-44" aria-label="Start page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {startPageOptions(role).map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        {(role === "STUDENT" || role === "TUTOR") && (
          <Row title="Course layout" description="Show course lists as a grid of cards or as rows.">
            <Select
              value={values.preferredView === "LIST" ? "LIST" : "GRID"}
              onValueChange={(v) => patch("preferredView", v as View)}
            >
              <SelectTrigger className="w-32" aria-label="Course layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        )}
      </Section>

      <div className="bg-background/90 sticky bottom-0 flex items-center justify-end gap-3 py-3 backdrop-blur">
        {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
        <Button
          onClick={onSave}
          disabled={pending || !dirty}
          className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
