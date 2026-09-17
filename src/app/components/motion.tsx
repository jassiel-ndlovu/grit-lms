"use client";

/**
 * Motion primitives for the marketing page.
 *
 * Small client islands so the landing page itself stays a Server
 * Component — only the wrappers ship framer-motion, not the copy.
 *
 * Everything here honours `prefers-reduced-motion`: when it's set, the
 * content renders in its final state with no transition rather than being
 * animated more slowly. Nothing is hidden behind an animation, so a
 * viewer who never triggers the scroll handler still sees the whole page.
 */

import * as React from "react";
import {
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface RevealProps {
  children: React.ReactNode;
  /** Seconds to wait before starting. Use for hand-tuned sequences. */
  delay?: number;
  /** Direction the element travels from. */
  from?: "below" | "left" | "right" | "none";
  className?: string;
}

/** Fade + travel into place the first time the element scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  from = "below",
  className,
}: RevealProps) {
  const reduced = useReducedMotion();

  const offset =
    from === "below"
      ? { y: 24 }
      : from === "left"
        ? { x: -24 }
        : from === "right"
          ? { x: 24 }
          : {};

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const listVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/**
 * Stagger a row or grid of children. Pair with <StaggerItem> — a plain
 * child renders normally but won't be animated.
 */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * A slow vertical drift, for hero artwork. Deliberately small and slow —
 * it should read as "alive", not as a moving target next to body copy.
 */
export function Float({
  children,
  className,
  distance = 10,
  duration = 7,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Entrance for the hero, which is above the fold and shouldn't wait for scroll. */
export function HeroIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
