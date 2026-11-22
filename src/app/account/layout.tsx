/**
 * /account/* — pages reached from emailed links (#182, #185). They work
 * signed out, so there is no app shell: the page frame sits at the top of
 * the window (`data-shell="focus"` sets --shell-top to 0).
 */

export default function AccountLinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-shell="focus" className="bg-background min-h-dvh pb-16">
      {children}
    </div>
  );
}
