import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { PeepAvatar } from "@/components/illustrations/peep-avatar";
import { SPOT_NAMES, SpotIllustration } from "@/components/illustrations/spot-illustration";
import { avatars, scenes, type SceneName } from "@/components/illustrations/generated/registry";
import type { IllustrationProps } from "@/components/illustrations/illustration";

export const metadata = { title: "Illustrations · Design system" };

const SAMPLE_USERS = [
  "clx0a1b2c0000abcd1234efgh",
  "user-1",
  "thandi@example.com",
  "cm1k9w3x20001qv8z7y6t5r4e",
  "student-042",
  "tutor-7",
  "parent-19",
  "cm2b8f0d30004lm2n3o4p5q6r",
  "admin",
  "guest-3141",
  "cm3z1y2x40009ab8cd7ef6gh5",
  "kagiso.m",
];

function Themed({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <div className={dark ? "dark" : undefined}>
      <div className="rounded-xl border border-border bg-background p-4 text-foreground">{children}</div>
    </div>
  );
}

export default async function IllustrationsPreviewPage() {
  if (process.env.NODE_ENV !== "development" && process.env.REVAMP_UI !== "1") notFound();

  const sceneEntries = (await Promise.all(
    (Object.keys(scenes) as SceneName[]).map(async (name) => [name, (await scenes[name]()).default] as const),
  )) as (readonly [SceneName, ComponentType<IllustrationProps>])[];
  const busts = await Promise.all(avatars.map(async (load) => (await load()).default));

  return (
    <main className="mx-auto max-w-6xl space-y-10 bg-background p-6 text-foreground">
      <header>
        <h1 className="text-2xl font-semibold">Illustrations</h1>
        <p className="text-sm text-muted-foreground">
          Open Peeps and Transhumans (CC0). Each scene shows light, then dark. See
          src/components/illustrations/README.md.
        </p>
      </header>

      {[false, true].map((dark) => (
        <section key={String(dark)} className="space-y-3">
          <h2 className="text-lg font-semibold">Scenes, {dark ? "dark" : "light"}</h2>
          <Themed dark={dark}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {sceneEntries.map(([name, Scene]) => (
                <figure key={name} className="flex flex-col items-center gap-2">
                  <Scene className="h-40 w-auto" />
                  <figcaption className="font-mono text-xs text-muted-foreground">{name}</figcaption>
                </figure>
              ))}
            </div>
          </Themed>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Page headers (on the primary panel, `illustration-paper`)</h2>
        {[false, true].map((dark) => (
          <Themed key={String(dark)} dark={dark}>
            <div className="bg-primary illustration-paper flex flex-wrap items-end gap-6 rounded-lg p-4">
              {sceneEntries
                .filter(([name]) => name.startsWith("header-"))
                .map(([name, Scene]) => (
                  <Scene key={name} className="h-32 w-auto" />
                ))}
            </div>
          </Themed>
        ))}
      </section>

      {[false, true].map((dark) => (
        <section key={String(dark)} className="space-y-3">
          <h2 className="text-lg font-semibold">Avatar busts, {dark ? "dark" : "light"}</h2>
          <Themed dark={dark}>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {busts.map((Bust, i) => (
                <figure key={i} className="flex flex-col items-center gap-1">
                  <Bust className="h-24 w-auto" />
                  <figcaption className="font-mono text-xs text-muted-foreground">
                    avatar-{String(i + 1).padStart(2, "0")}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Themed>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sample avatars (by user id)</h2>
        {[false, true].map((dark) => (
          <Themed key={String(dark)} dark={dark}>
            <div className="flex flex-wrap gap-4">
              {SAMPLE_USERS.map((id) => (
                <div key={id} className="flex flex-col items-center gap-1">
                  <PeepAvatar userId={id} size={56} />
                  <span className="max-w-20 truncate font-mono text-[10px] text-muted-foreground">{id}</span>
                </div>
              ))}
            </div>
          </Themed>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Spot art (raster, fixed light panel)</h2>
        {[false, true].map((dark) => (
          <Themed key={String(dark)} dark={dark}>
            <div className="flex flex-wrap items-end gap-4">
              {SPOT_NAMES.map((name) => (
                <figure key={name} className="flex flex-col items-center gap-1">
                  <SpotIllustration name={name} width={160} />
                  <figcaption className="font-mono text-xs text-muted-foreground">{name}</figcaption>
                </figure>
              ))}
            </div>
          </Themed>
        ))}
      </section>
    </main>
  );
}
