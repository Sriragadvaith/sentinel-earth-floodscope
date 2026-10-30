import { type Variants, type Transition } from "motion/react";

/**
 * Standardized easing curves for Sentinel Earth FloodScope:
 * - cinematic: smooth deceleration for wide atmospheric reveals
 * - springGentle: responsive, organic tactile response for controls and panels
 * - sharp: quick snappy exit transitions
 */
export const transitions = {
  cinematic: {
    duration: 0.85,
    ease: [0.16, 1, 0.3, 1], // easeOutExpo-like luxury feel
  } as Transition,
  cinematicLong: {
    duration: 1.2,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,
  springGentle: {
    type: "spring",
    stiffness: 260,
    damping: 24,
    mass: 0.8,
  } as Transition,
  springSnappy: {
    type: "spring",
    stiffness: 380,
    damping: 28,
  } as Transition,
  micro: {
    duration: 0.2,
    ease: [0.2, 0, 0, 1],
  } as Transition,
};

/**
 * Stagger container variants for coordinated dashboard panels
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

/**
 * Coordinated panel entrances (Left rail, Center map, Right telemetry)
 */
export const panelFadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.cinematic,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: transitions.micro,
  },
};

export const panelSlideLeft: Variants = {
  hidden: { opacity: 0, x: -28 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.cinematic,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: transitions.micro,
  },
};

export const panelSlideRight: Variants = {
  hidden: { opacity: 0, x: 28 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.cinematic,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.micro,
  },
};

/**
 * Micro hover & tap interactions for buttons and cards
 */
export const interactiveHoverTap = {
  whileHover: { scale: 1.02, transition: { duration: 0.15 } },
  whileTap: { scale: 0.98, transition: { duration: 0.08 } },
};

export const buttonTactile = {
  whileHover: { scale: 1.015, y: -1, transition: { duration: 0.15 } },
  whileTap: { scale: 0.985, y: 1, transition: { duration: 0.08 } },
};

/**
 * Modal & overlay backdrop animation variants
 */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const modalScaleCard: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.springGentle,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: transitions.micro,
  },
};
