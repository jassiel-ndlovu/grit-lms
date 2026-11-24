/**
 * Terms of service (owner, 24 Nov): plain language, no personal contact
 * details. Facts follow the code and the owner's decisions: 14-day trial,
 * 30-day billing per active student, 2% on card fee payments, data kept two
 * months after the last payment, credits that expire. Update with them.
 */

import Link from "next/link";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/branding";

export const metadata = {
  title: "Terms of service",
  description: `The agreement between ${APP_NAME} and the people and organisations who use it.`,
  alternates: { canonical: "/terms-of-service" },
};

const sections: LegalSection[] = [
  {
    id: "about",
    heading: "About these terms",
    body: (
      <>
        <p>These terms are the agreement between {APP_NAME} (&ldquo;Nexa&rdquo;, &ldquo;we&rdquo;) and you when you use Nexa. By creating an account or using Nexa, you agree to them. If you use Nexa for an organisation, you agree to them on its behalf and confirm you may do so.</p>
        <p>Our <Link href="/privacy-policy">privacy policy</Link> explains how we handle personal information, and forms part of these terms.</p>
      </>
    ),
  },
  {
    id: "accounts",
    heading: "Your account",
    body: (
      <ul>
        <li>Keep your sign-in details to yourself, and tell us straight away if you think someone else has used your account.</li>
        <li>Give accurate details, and keep your email address up to date: it&apos;s how we reach you.</li>
        <li>Students under 18 use Nexa through their tutor or school, which is responsible for having their parent&apos;s or guardian&apos;s consent.</li>
        <li>You&apos;re responsible for what happens in your account.</li>
      </ul>
    ),
  },
  {
    id: "organisations",
    heading: "Tutors and organisations",
    body: (
      <>
        <p>If you teach on Nexa, alone or as an organisation:</p>
        <ul>
          <li>You decide which students, staff and records are on Nexa, and you&apos;re responsible for having the right to add them, including any consent you need under POPIA. Nexa handles these records on your behalf.</li>
          <li>You decide who on your staff can see and change what, through their roles.</li>
          <li>You&apos;re responsible for what you teach, the marks you give, and the fees you charge.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    heading: "Using Nexa properly",
    body: (
      <>
        <p>Don&apos;t use Nexa to:</p>
        <ul>
          <li>break the law, or help anyone else to;</li>
          <li>harass, bully or harm anyone, especially children;</li>
          <li>upload anything you don&apos;t have the right to share, or that contains malware;</li>
          <li>try to reach accounts, records or parts of Nexa you haven&apos;t been given access to, or put an unreasonable load on the service;</li>
          <li>copy or resell Nexa itself.</li>
        </ul>
        <p>We may suspend an account that breaks these rules. Where we can, we&apos;ll tell you why first and give you a chance to put it right.</p>
      </>
    ),
  },
  {
    id: "content",
    heading: "Your content",
    body: (
      <ul>
        <li>What you put on Nexa (lessons, tests, answers, files and messages) stays yours, or your organisation&apos;s.</li>
        <li>You allow us to store, copy and show it, only as needed to run Nexa for you and the people you share it with, including sending it to the AI services behind the features you choose to use.</li>
        <li>You can download your own data at any time under Settings, Account.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    heading: "AI features",
    body: (
      <ul>
        <li>AI drafts, suggested marks and study assistant answers can be wrong. Tutors should check drafts and suggested marks before using them; students should check answers against their lessons and ask their tutor when unsure.</li>
        <li>Suggested marks are only suggestions: a tutor decides the mark.</li>
      </ul>
    ),
  },
  {
    id: "plans",
    heading: "Plans and payments to Nexa (organisations)",
    body: (
      <ul>
        <li><strong>Trial:</strong> a new organisation can use Nexa free for 14 days.</li>
        <li><strong>What you pay:</strong> a price per active student on each course, depending on the plan you choose for that course. Prices are shown in Billing before you pay.</li>
        <li><strong>When:</strong> every 30 days, by card. A student who joins partway through a period is added to the next payment for the days they were there.</li>
        <li><strong>If a payment fails:</strong> we try again and tell you. If it stays unpaid, your organisation is locked: everyone can still see their work, but nothing can be changed until it&apos;s paid.</li>
        <li><strong>Cancelling:</strong> you can cancel at any time in Billing. You keep access until the end of the period you&apos;ve paid for.</li>
        <li><strong>Price changes:</strong> we&apos;ll tell you at least 30 days before a price change applies to you.</li>
      </ul>
    ),
  },
  {
    id: "fees",
    heading: "Fees paid through Nexa (families, tutors and organisations)",
    body: (
      <ul>
        <li>Fees are set by the tutor or organisation, not by Nexa. Questions about a fee, or a refund of one, go to them first.</li>
        <li>When a family pays a fee by card, the payment goes to the tutor&apos;s or organisation&apos;s bank account through our payment provider. Nexa keeps a commission of 2% of each card payment, and the card processing cost is taken from it too.</li>
        <li>Fees paid in cash or by bank transfer are between the family and the tutor; Nexa only records them.</li>
        <li>If we refund a card payment after an investigation, the tutor&apos;s share is recovered from later card payments to them, as explained when it happens.</li>
      </ul>
    ),
  },
  {
    id: "credits",
    heading: "AI and study credits",
    body: (
      <ul>
        <li>Organisations can buy AI credits for staff, and students or parents can buy study credits for the study assistant, in the packs shown.</li>
        <li>Credits last for the time shown before you buy. Any left after that are lost.</li>
        <li>Credits can&apos;t be exchanged for money, except where the law requires it.</li>
      </ul>
    ),
  },
  {
    id: "end",
    heading: "Ending your use of Nexa",
    body: (
      <ul>
        <li>You can delete your own account at any time under Settings, Account, with 14 days to change your mind.</li>
        <li>When an organisation stops paying, its data is kept for two months after its last payment, so it can come back or download what it needs. We warn the owners 30 days and 7 days before it is deleted. Payment and tax records are kept as long as the law requires.</li>
      </ul>
    ),
  },
  {
    id: "service",
    heading: "Availability and changes to Nexa",
    body: (
      <p>We work to keep Nexa available and your information safe, but we can&apos;t promise it will never be interrupted. We may improve or change features. If we remove something you pay for, we&apos;ll tell you beforehand and, where fair, adjust what you pay.</p>
    ),
  },
  {
    id: "liability",
    heading: "Our responsibility to you",
    body: (
      <>
        <p>Nothing in these terms takes away rights you have under the Consumer Protection Act or other South African law that can&apos;t be excluded.</p>
        <p>As far as the law allows, Nexa isn&apos;t responsible for indirect losses, or for losses caused by things outside our reasonable control. Otherwise, our total responsibility to an organisation is limited to what it paid Nexa in the 12 months before the problem arose.</p>
      </>
    ),
  },
  {
    id: "law",
    heading: "Law and disputes",
    body: <p>These terms are governed by the law of South Africa. If something goes wrong, contact us first: most problems are quicker to solve together.</p>,
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: <p>We&apos;ll update this page when the terms change, and change the date at the top. For changes that matter to you, we&apos;ll tell you by email or in Nexa at least 30 days before they take effect.</p>,
  },
  {
    id: "contact",
    heading: "Contact us",
    body: (
      <p>
        Questions about these terms: use <Link href="/support">Help and support</Link> (or Help, if you&apos;re signed in). For accounts and organisations, use our <Link href="/contact">contact form</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="24 November 2026"
      intro={<p>These terms explain what you can expect from {APP_NAME}, and what we expect from you. We&apos;ve kept them as short and plain as we can.</p>}
      sections={sections}
    />
  );
}
