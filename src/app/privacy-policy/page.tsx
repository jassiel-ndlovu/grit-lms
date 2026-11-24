/**
 * Privacy policy (owner, 24 Nov): plain language, POPIA-shaped, no personal
 * contact details. Facts here follow the code: retention periods, cookies,
 * card details and AI use. Update it when those change.
 */

import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/branding";

export const metadata = {
  title: "Privacy policy",
  description: `How ${APP_NAME} collects, uses and protects personal information, and your rights under POPIA.`,
  alternates: { canonical: "/privacy-policy" },
};

const sections: LegalSection[] = [
  {
    id: "who",
    heading: "Who we are, and who decides",
    body: (
      <>
        <p>{APP_NAME} (&ldquo;Nexa&rdquo;, &ldquo;we&rdquo;) is an online platform, based in South Africa, that tutors, schools and other organisations use to teach, assess and run their classes.</p>
        <p>Two kinds of personal information pass through Nexa, and different people are responsible for each:</p>
        <ul>
          <li><strong>Your account and our service to you</strong> (your sign-in details, your preferences, what organisations pay us): Nexa decides how this is used. Under the Protection of Personal Information Act (POPIA), we are the <strong>responsible party</strong>.</li>
          <li><strong>Teaching records</strong> (students&apos; courses, work, marks, attendance, reports and messages): the tutor or organisation that teaches the student decides what is collected and why. They are the responsible party, and Nexa processes this information on their behalf as their <strong>operator</strong>. Questions about these records are best asked of the tutor or school first.</li>
        </ul>
      </>
    ),
  },
  {
    id: "collect",
    heading: "What we collect",
    body: (
      <>
        <ul>
          <li><strong>Account details:</strong> name, email address or a sign-in code from your tutor, a password (stored only in scrambled form), two-step sign-in settings, profile picture if you add one, and your preferences such as language, time zone, theme and notifications.</li>
          <li><strong>Learning records:</strong> the courses you&apos;re in, lessons you&apos;ve completed, your answers to tests and assignments, files you hand in, marks and comments, attendance, term reports, bookings, and notes from your tutors.</li>
          <li><strong>Family links:</strong> which parent or guardian is linked to which student.</li>
          <li><strong>Payments:</strong> fees, invoices and receipts. Card numbers are entered on our payment provider&apos;s secure page; we never see or keep them. We keep only the card type, its last four digits and expiry date, to show you which card is on file. For tutors who receive fees, the payment provider holds the bank account details.</li>
          <li><strong>Messages to us:</strong> questions, feedback and problem reports you send through Help, with any screenshots, and enquiries sent through our contact form.</li>
          <li><strong>Study assistant chats</strong>, where a course offers it: the questions asked and the answers given.</li>
          <li><strong>Technical information:</strong> sign-in times, the device and browser you use, and error reports when something goes wrong. Error reports have personal details removed before they are stored. We count page visits without cookies and without identifying you.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    body: (
      <>
        <ul>
          <li>To run the service: sign you in, show the right courses and records to the right people, and send the notifications and emails you&apos;ve chosen.</li>
          <li>To take and pass on payments: fees to the tutor or organisation, and organisations&apos; payments to Nexa.</li>
          <li>To answer your questions and fix problems you report.</li>
          <li>To keep Nexa secure: spotting misuse, preventing fraud, and keeping records of important changes.</li>
          <li>To improve Nexa, using totals and patterns rather than looking at individuals.</li>
        </ul>
        <p>We don&apos;t sell personal information, and we don&apos;t use it for advertising.</p>
      </>
    ),
  },
  {
    id: "ai",
    heading: "AI features",
    body: (
      <>
        <p>Some features use AI services to help tutors and students: drafting tests and report comments, suggesting marks for written and photographed answers, and answering students&apos; questions in the study assistant. To do this, the relevant text, images or lesson content are sent to an AI service to produce a result, and the result comes back to Nexa.</p>
        <ul>
          <li>Suggested marks are suggestions. A tutor reviews them before students or parents see a mark.</li>
          <li>Tutors can read their students&apos; study assistant chats.</li>
          <li>We don&apos;t send passwords, payment details or contact details to AI services.</li>
        </ul>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <>
        <p>Many students on Nexa are under 18. Their accounts are made by, or with the agreement of, their tutor or school, who is responsible for having the consent of a parent or guardian.</p>
        <p>A linked parent or guardian can see their child&apos;s courses, marks, attendance and fees. If you are a parent and believe your child&apos;s information is on Nexa without your consent, contact the tutor or school, or us.</p>
      </>
    ),
  },
  {
    id: "share",
    heading: "Who can see it, and who we share it with",
    body: (
      <>
        <ul>
          <li><strong>Inside an organisation:</strong> staff see what their role allows. A tutor sees their own courses; an owner or admin sees the whole organisation. Students see their own work. Parents see their linked children.</li>
          <li><strong>Service providers</strong> who help us run Nexa, under contracts that limit them to doing so: hosting and databases, email delivery, payment processing, error monitoring and AI services.</li>
          <li><strong>When the law requires it</strong>, for example a valid court order, or to protect someone&apos;s safety.</li>
        </ul>
      </>
    ),
  },
  {
    id: "abroad",
    heading: "Information stored outside South Africa",
    body: (
      <p>Some of our service providers store or process information outside South Africa, for example in the United States or Europe. We only use providers bound by laws or agreements that protect personal information at least as well as POPIA does.</p>
    ),
  },
  {
    id: "keep",
    heading: "How long we keep it",
    body: (
      <ul>
        <li><strong>Your account and learning records:</strong> for as long as your account is open, or the organisation that teaches you keeps your records.</li>
        <li><strong>When you delete your account:</strong> you have 14 days to change your mind. After that your personal details and work are removed. Payment and tax records stay as long as the law requires (usually five years), with your name only.</li>
        <li><strong>Study assistant chats:</strong> deleted a year after the last message.</li>
        <li><strong>Messages to Help:</strong> deleted two years after the query is closed. Contact form enquiries: deleted after a year.</li>
        <li><strong>Spreadsheet imports:</strong> the uploaded file is deleted after 30 days.</li>
      </ul>
    ),
  },
  {
    id: "safe",
    heading: "How we keep it safe",
    body: (
      <ul>
        <li>Everything travels encrypted between your device and Nexa.</li>
        <li>Passwords are stored scrambled; nobody at Nexa can read them.</li>
        <li>Organisation owners and Nexa&apos;s own team must use two-step sign-in.</li>
        <li>Access follows roles, and important changes are recorded.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: (
      <>
        <p>We use a small number of cookies that Nexa needs to work, and no advertising cookies:</p>
        <ul>
          <li>to keep you signed in;</li>
          <li>to remember the organisation you last opened, and whether you&apos;re working as an organisation or a tutor;</li>
          <li>to remember Data saver, and a &ldquo;remind me tomorrow&rdquo; for two-step sign-in;</li>
          <li>to remember who referred you, if you arrived through a referral link.</li>
        </ul>
      </>
    ),
  },
  {
    id: "rights",
    heading: "Your rights",
    body: (
      <>
        <p>Under POPIA you may ask:</p>
        <ul>
          <li>what personal information we hold about you, and for a copy of it;</li>
          <li>for it to be corrected, or deleted if we have no reason to keep it;</li>
          <li>us to stop using it for a particular purpose.</li>
        </ul>
        <p>You can download a copy of your data, change your details and delete your account yourself under Settings, Account. For anything else, contact us (below). For teaching records, we may pass your request to the tutor or school responsible for them.</p>
        <p>If you&apos;re not happy with how we handle your information, you may complain to the Information Regulator of South Africa (<a href="https://inforegulator.org.za" rel="noreferrer">inforegulator.org.za</a>).</p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: <p>We&apos;ll update this page when how we use personal information changes, and change the date at the top. If a change matters to you, we&apos;ll tell you by email or in Nexa before it takes effect.</p>,
  },
  {
    id: "contact",
    heading: "Contact us",
    body: (
      <p>
        For privacy questions and requests, including to reach our Information Officer, use <Link href="/support">Help and support</Link> (or Help, if you&apos;re signed in) and choose &ldquo;Signing in and my account&rdquo;.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="24 November 2026"
      intro={
        <p>
          This policy explains what personal information {APP_NAME} collects, why, who can see it, how long we keep it, and your rights under South Africa&apos;s Protection of Personal Information Act (POPIA). It applies to everyone who uses Nexa: students, parents, tutors and organisations.
        </p>
      }
      sections={sections}
    />
  );
}
