"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-4">
      <div className="container mx-auto text-center">
        <div className="flex justify-center space-x-8 mb-2">
          <SwapLink link="/forgot-password" text="Forgot your password?" />
          <SwapLink link="/support" text="Contact Support" />
          <SwapLink link="/privacy-policy" text="Privacy Policy" />
          <SwapLink link="/terms-of-service" text="Terms of Service" />
        </div>
        <p className="text-xs text-gray-300 mt-2">
          &copy; {new Date().getFullYear()} Grit LMS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

type SwapLinkProps = {
  link: string;
  text: string;
};

function SwapLink({ link, text }: SwapLinkProps) {
  // If the link is not the root path, render a link to the root path
  const path = usePathname();

  return (path === link) ? (
    <Link href="/" className="text-sm hover:underline">
      Log In
    </Link>
  ) : (
    <Link href={link} className="text-sm hover:underline">
      {text}
    </Link>
  );
}