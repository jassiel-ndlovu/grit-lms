"use client";

/**
 * A student's or parent's referral link for one workspace (viewer.md Draft
 * 1.16): the address, Copy, Share (the device's share sheet, or WhatsApp
 * where there isn't one) and how many families came through it. Rewards
 * aren't decided, so nothing here mentions any.
 */

import * as React from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { referralCounts, referralMessage } from "../lib/join-ui";

export interface ReferralLinkData {
  workspaceId: string;
  workspaceName: string;
  url: string;
  requested: number;
  joined: number;
  /** Whether the workspace has a course in Find courses now. */
  hasListed: boolean;
}

export function ReferralLinkCard({ link }: { link: ReferralLinkData }) {
  const id = React.useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  async function share() {
    const text = referralMessage(link.workspaceName);
    if (typeof navigator.share === "function") {
      // Closing the share sheet rejects too; there's nothing to report.
      await navigator.share({ title: link.workspaceName, text, url: link.url }).catch(() => undefined);
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link.url}`)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Card className="gap-4 p-5">
      <div className="space-y-1">
        <h3 className="text-foreground text-base font-semibold">{link.workspaceName}</h3>
        <p className="text-muted-foreground text-sm">{referralCounts(link.requested, link.joined)}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Your link for {link.workspaceName}
        </label>
        <Input id={id} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={copy}>
            <Copy aria-hidden className="size-4" />
            Copy
          </Button>
          <Button type="button" onClick={share}>
            <Share2 aria-hidden className="size-4" />
            Share
          </Button>
        </div>
      </div>
      {link.hasListed ? null : (
        <p className="text-muted-foreground text-sm">
          {link.workspaceName} has no courses in Find courses right now, so people who follow your link can&apos;t ask to join yet.
        </p>
      )}
    </Card>
  );
}
