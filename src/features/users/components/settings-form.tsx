/**
 * SettingsForm — user preferences editor. Persists to UserPreferences via
 * updateOwnPreferences. All fields are optional; the action patches only
 * what changed.
 *
 * Grouped into three sections that match how a user thinks about them:
 *   - Notifications: what to be told about, and how often
 *   - Appearance & locale: dark mode, timezone, preferred view
 *   - Dashboard defaults: which tab lands first, study reminders
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { updateOwnPreferences } from "../actions";

type Frequency = "IMMEDIATE" | "DAILY" | "WEEKLY" | "NONE";
type View = "LIST" | "GRID" | "TIMELINE";
type Tab = "COURSES" | "NOTIFICATIONS" | "CALENDAR" | "GRADES";

export interface SettingsFormValues {
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationFrequency: Frequency;
  notifyOnCourseUpdate: boolean;
  notifyOnNewLesson: boolean;
  notifyOnNewTest: boolean;
  notifyOnDueDateReminder: boolean;
  notifyOnGrades: boolean;
  notifyOnMessages: boolean;
  darkMode: boolean;
  preferredLanguage: string;
  timeZone: string | null;
  preferredView: View;
  studyReminders: boolean;
  defaultDashboardTab: Tab;
}

interface Props {
  defaults: SettingsFormValues;
}

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "IMMEDIATE", label: "Immediately" },
  { value: "DAILY", label: "Daily digest" },
  { value: "WEEKLY", label: "Weekly digest" },
  { value: "NONE", label: "Never" },
];

const VIEWS: { value: View; label: string }[] = [
  { value: "LIST", label: "List" },
  { value: "GRID", label: "Grid" },
  { value: "TIMELINE", label: "Timeline" },
];

const TABS: { value: Tab; label: string }[] = [
  { value: "COURSES", label: "Courses" },
  { value: "NOTIFICATIONS", label: "Notifications" },
  { value: "CALENDAR", label: "Calendar" },
  { value: "GRADES", label: "Grades" },
];

// A tidy short list; browsers can suggest others via their Intl API but
// we keep the dropdown short so it stays scannable.
const TIMEZONES = [
  "Africa/Johannesburg",
  "Africa/Harare",
  "Africa/Lagos",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo",
  "UTC",
];

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
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsForm({ defaults }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<SettingsFormValues>(defaults);

  function patch<K extends keyof SettingsFormValues>(
    key: K,
    v: SettingsFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSave() {
    setPending(true);
    try {
      const res = await updateOwnPreferences(values);
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Preferences saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-2">
          <h2 className="font-display text-xl leading-tight">Notifications</h2>
          <p className="text-muted-foreground text-sm">
            What we tell you about, and how often.
          </p>
        </div>
        <Separator className="my-4" />
        <div className="divide-border divide-y">
          <Row
            title="Email notifications"
            description="Receive notifications via email."
          >
            <Switch
              checked={values.emailNotifications}
              onCheckedChange={(v) => patch("emailNotifications", v)}
            />
          </Row>
          <Row
            title="Push notifications"
            description="In-app notifications while you're signed in."
          >
            <Switch
              checked={values.pushNotifications}
              onCheckedChange={(v) => patch("pushNotifications", v)}
            />
          </Row>
          <Row
            title="Frequency"
            description="How often we batch non-urgent notifications."
          >
            <Select
              value={values.notificationFrequency}
              onValueChange={(v) =>
                patch("notificationFrequency", v as Frequency)
              }
            >
              <SelectTrigger className="w-44">
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
          <Row title="Course updates">
            <Switch
              checked={values.notifyOnCourseUpdate}
              onCheckedChange={(v) => patch("notifyOnCourseUpdate", v)}
            />
          </Row>
          <Row title="New lessons">
            <Switch
              checked={values.notifyOnNewLesson}
              onCheckedChange={(v) => patch("notifyOnNewLesson", v)}
            />
          </Row>
          <Row title="New tests">
            <Switch
              checked={values.notifyOnNewTest}
              onCheckedChange={(v) => patch("notifyOnNewTest", v)}
            />
          </Row>
          <Row title="Due-date reminders">
            <Switch
              checked={values.notifyOnDueDateReminder}
              onCheckedChange={(v) => patch("notifyOnDueDateReminder", v)}
            />
          </Row>
          <Row title="Grade released">
            <Switch
              checked={values.notifyOnGrades}
              onCheckedChange={(v) => patch("notifyOnGrades", v)}
            />
          </Row>
          <Row title="Messages">
            <Switch
              checked={values.notifyOnMessages}
              onCheckedChange={(v) => patch("notifyOnMessages", v)}
            />
          </Row>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-2">
          <h2 className="font-display text-xl leading-tight">
            Appearance &amp; locale
          </h2>
          <p className="text-muted-foreground text-sm">
            How the app looks and where you are.
          </p>
        </div>
        <Separator className="my-4" />
        <div className="divide-border divide-y">
          <Row
            title="Dark mode"
            description="Ask the app for a dark colour scheme. May be overridden by your OS."
          >
            <Switch
              checked={values.darkMode}
              onCheckedChange={(v) => patch("darkMode", v)}
            />
          </Row>
          <Row title="Preferred language">
            <Input
              value={values.preferredLanguage}
              onChange={(e) => patch("preferredLanguage", e.target.value)}
              className="w-24"
              maxLength={5}
            />
          </Row>
          <Row title="Time zone">
            <Select
              value={values.timeZone ?? "UTC"}
              onValueChange={(v) => patch("timeZone", v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row
            title="Preferred view"
            description="Default rendering for list-heavy pages."
          >
            <Select
              value={values.preferredView}
              onValueChange={(v) => patch("preferredView", v as View)}
            >
              <SelectTrigger className="w-32">
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
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-2">
          <h2 className="font-display text-xl leading-tight">
            Dashboard defaults
          </h2>
          <p className="text-muted-foreground text-sm">
            Where you land when you open the app.
          </p>
        </div>
        <Separator className="my-4" />
        <div className="divide-border divide-y">
          <Row title="Default dashboard tab">
            <Select
              value={values.defaultDashboardTab}
              onValueChange={(v) => patch("defaultDashboardTab", v as Tab)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row
            title="Study reminders"
            description="Prompt you to review lessons that are due for revisiting."
          >
            <Switch
              checked={values.studyReminders}
              onCheckedChange={(v) => patch("studyReminders", v)}
            />
          </Row>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={pending}
          className="bg-brand-terracotta text-brand-terracotta-foreground hover:opacity-90"
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
