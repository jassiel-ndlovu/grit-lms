import { cn } from "@/lib/utils";
import { avatarIndexFor } from "./avatar-index";
import { avatars } from "./generated/registry";

type PeepAvatarProps = {
  userId: string;
  /** Pixel size of the circle. */
  size?: number;
  /** Set when the avatar stands alone, e.g. "Avatar for Thandi". */
  title?: string;
  className?: string;
};

/**
 * Default avatar: an Open Peeps bust picked by a stable hash of the user id.
 * Async server component, so only the one bust it renders reaches the page.
 * From a client component, call `avatars[avatarIndexFor(id)]()` yourself.
 */
export async function PeepAvatar({ userId, size = 40, title, className }: PeepAvatarProps) {
  const { default: Bust } = await avatars[avatarIndexFor(userId)]();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-muted text-foreground [--illustration-surface:var(--card)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* Square crop of the 240 x 324 bust: head and shoulders. */}
      <Bust viewBox="20 8 200 200" width={size} height={size} title={title} />
    </span>
  );
}
