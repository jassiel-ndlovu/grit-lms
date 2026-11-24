/**
 * The frame for legal pages (privacy policy, terms): the public header, a
 * contents list and readable sections. Server component.
 */

import { PublicHelpFrame } from "@/features/support/components/public-frame";

export type LegalSection = { id: string; heading: string; body: React.ReactNode };

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <PublicHelpFrame title={title} lead={`Last updated ${updated}`}>
      <div className="text-foreground flex flex-col gap-4 text-sm leading-relaxed">{intro}</div>
      <nav aria-label="Contents" className="border-border rounded-lg border p-4">
        <p className="text-foreground mb-2 text-sm font-semibold">Contents</p>
        <ol className="text-muted-foreground grid list-decimal gap-1 pl-5 text-sm sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-foreground underline-offset-2 hover:underline">{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex flex-col gap-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
            <h2 id={`${s.id}-h`} className="text-foreground mb-2 text-lg font-semibold">{i + 1}. {s.heading}</h2>
            <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </PublicHelpFrame>
  );
}
