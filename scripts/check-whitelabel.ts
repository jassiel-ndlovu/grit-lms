/**
 * Branding, white-label and onboarding rules (#216 phase 3): which emails
 * are branded, sender names, the From header, rebranding a rendered email,
 * and the onboarding checklist and branch progress. Pure.
 *
 *   npx tsx scripts/check-branding.ts
 */

import { applyBrand, brandedTemplate, cleanSenderName, fromWithName, senderLabel, validAccent, type EmailBrand } from "../src/features/workspaces/brand-rules";
import { branchProgress, orgChecklist } from "../src/features/workspaces/onboarding-rules";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Which emails carry a workspace's brand.
check("families' emails are branded", ["fees:invoice", "parent:weekly", "booking:confirmed", "risk:shared", "attendance:absence", "enquiry:reply", "staff:cover-assigned", "notification", "digest"].every(brandedTemplate), true);
check("Nexa's own never are", ["billing:dunning-day-3", "account:email-confirm", "payout:failed", "guardian:linked", "enquiry:new", "verify", "password-reset"].some(brandedTemplate), false);

// Names and headers.
check("sender names lose header-breaking characters", cleanSenderName('Ubuntu "Tutors" <x>, Ltd\r\nBcc: a@b'), "Ubuntu Tutors x Ltd Bcc: a@b");
check("From keeps Nexa's address", fromWithName("Nexa LMS <noreply@notify.nexa-lms.co.za>", "Ubuntu Tutors via Nexa"), "Ubuntu Tutors via Nexa <noreply@notify.nexa-lms.co.za>");
check("From from a bare address", fromWithName("noreply@x.test", "Ubuntu"), "Ubuntu <noreply@x.test>");
const plus: EmailBrand = { name: "Ubuntu Tutors", senderName: "Ubuntu Tutors", logoUrl: "https://abc.public.blob.vercel-storage.com/logo.png", accentColor: "#1F6FEB", whiteLabel: false };
const pro: EmailBrand = { ...plus, whiteLabel: true };
check("Plus: 'via Nexa'", senderLabel(plus), "Ubuntu Tutors via Nexa");
check("Pro white-label: just the name", senderLabel(pro), "Ubuntu Tutors");
check("accent colours", [validAccent("#1F6FEB"), validAccent("1F6FEB"), validAccent("#12345"), validAccent("red")], [true, false, false, false]);

// Rebranding a rendered email.
const rendered = {
  subject: "Booked: Tue 25 Nov · Maths",
  text: "You can reply in Nexa's messages: https://www.nexa-lms.co.za/dashboard\nUbuntu Tutors through Nexa LMS.",
  html: '<div style="background:#1B2A41;border-bottom:3px solid #C16E48;font-size:20px;">Nexa LMS</div><p>Open <a href="https://www.nexa-lms.co.za/dashboard">Nexa</a>.</p><p>Ubuntu Tutors through Nexa LMS.</p><a style="background:#C16E48" href="https://www.nexa-lms.co.za/x">Open Nexa</a>',
};
const p = applyBrand(rendered, plus);
check("Plus: header shows logo and name", p.html.includes('font-size:20px;"><img src="https://abc.public.blob.vercel-storage.com/logo.png"') && p.html.includes("Ubuntu Tutors</div>"), true);
check("Plus: accent colour used", [p.html.includes("#C16E48"), p.html.includes("#1F6FEB")], [false, true]);
check("Plus: Nexa still named in the body", p.text.includes("Nexa LMS"), true);
const w = applyBrand(rendered, pro);
check("white-label: no Nexa in text", /Nexa(?!-lms)/.test(w.text.replace(/nexa-lms/g, "")), false);
check("white-label: words replaced", w.text, "You can reply in Ubuntu Tutors's messages: https://www.nexa-lms.co.za/dashboard\nUbuntu Tutors.");
check("white-label: links untouched", (w.html.match(/https:\/\/www\.nexa-lms\.co\.za/g) ?? []).length, 2);
check("white-label: link text replaced", w.html.includes(">Ubuntu Tutors</a>") && w.html.includes(">Open Ubuntu Tutors</a>"), true);
check("white-label: no Nexa between tags", /Nexa/.test(w.html.replace(/<[^>]+>/g, "")), false);

// Onboarding.
const empty = branchProgress({ teams: 0, staff: 0, invited: 0, courses: 0, students: 0, events: 0 });
check("empty branch: 0%", empty.percent, 0);
const half = branchProgress({ teams: 2, staff: 3, invited: 4, courses: 0, students: 0, events: 1 });
check("teams, staff and calendar: 60%, invites waiting", [half.percent, half.waitingOnInvites], [60, 4]);
check("all done: 100%", branchProgress({ teams: 1, staff: 1, invited: 0, courses: 1, students: 1, events: 1 }).percent, 100);
const list = orgChecklist({ branches: 2, brand: false, brandAllowed: false, payout: true, fees: false, enquiryForm: false, staffImported: true, studentsImported: false, calendarImported: false });
check("branding hidden when the plan doesn't allow it", list.some((s) => s.key === "brand"), false);
check("required steps", list.filter((s) => !s.optional).map((s) => `${s.key}:${s.done}`), ["branches:true", "staff:true", "students:false"]);
check("branding shown on Plus", orgChecklist({ branches: 0, brand: true, brandAllowed: true, payout: false, fees: false, enquiryForm: false, staffImported: false, studentsImported: false, calendarImported: false }).find((s) => s.key === "brand")?.done, true);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
