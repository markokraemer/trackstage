/**
 * Sessionboard interaction layer — the adopted interior.dev catalogue.
 *
 * 45 motion primitives copied in from https://www.interior.dev (shadcn registry),
 * then restyled onto our tokens: no raw stone/emerald/red palette, no hardcoded
 * #4568FF, no dark-mode branches (we are light-mode only, RULES.md #3). Their
 * animation timing and mechanics are untouched — that is the whole point.
 *
 * Nine registry items were deliberately NOT adopted (modal, popover, drawer,
 * dropdown, context-menu, tabs, accordion, tooltip-group, pagination): our
 * shadcn-on-Base-UI versions in src/components/ui/* stay canonical for anything
 * a11y-critical (focus traps, collision handling, roving tabindex). RULES.md #17.
 *
 * Sources live in src/components/interior/*. Import from THIS barrel.
 * Intended per-component usage: docs/memory/INTERACTIONS.md
 */

export { PepButton } from "./pep-button"
export type { PepButtonProps } from "./pep-button"

/** Placeholder resolves into the photo. */
export * from "@/components/interior/blur-up-image"
/** Folds to its title, or lets go entirely. */
export * from "@/components/interior/collapsible-banner"
/** Results reorder as you type. */
export * from "@/components/interior/command-palette"
/** Copy to tick, width locked, reverts after 2s. */
export * from "@/components/interior/copy-button"
/** Icon to field with focus handled. */
export * from "@/components/interior/expanding-search"
/** Filtering rearranges, it does not blink. */
export * from "@/components/interior/filter-grid"
/** The label makes room instead of disappearing. */
export * from "@/components/interior/floating-label"
/** Toolbar yields to the content. */
export * from "@/components/interior/hide-on-scroll"
/** A guard rail in front of destructive actions. */
export * from "@/components/interior/hold-to-confirm"
/** Play/pause, menu/close as one mechanism. */
export * from "@/components/interior/icon-morph"
/** Error message that does not shove the form. */
export * from "@/components/interior/inline-validation"
/** Zoom that returns where it started. */
export * from "@/components/interior/lightbox"
/** Optimistic like that survives rapid taps. */
export * from "@/components/interior/like-burst"
/** The system's ongoing work, worn as a small object. */
export * from "@/components/interior/live-activity"
/** Sentinel that loads before you hit the end. */
export * from "@/components/interior/load-more"
/** Label to state without layout shift. */
export * from "@/components/interior/loading-button"
/** Stops when you look at it. */
export * from "@/components/interior/logo-marquee"
/** Intent confirmed by time, and cancelled by everything else. */
export * from "@/components/interior/long-press"
/** New content without stealing your scroll. */
export * from "@/components/interior/new-items-pill"
/** Auto advance, paste, error recovery. */
export * from "@/components/interior/otp-input"
/** Strength read segment by segment. */
export * from "@/components/interior/password-strength"
/** The winner lands last. */
export * from "@/components/interior/poll-results"
/** Join and leave as a layout change. */
export * from "@/components/interior/presence-avatars"
/** The feeling that the press landed. */
export * from "@/components/interior/press-depth"
/** Indeterminate handing over to determinate. */
export * from "@/components/interior/progress-bar"
/** How much is left. */
export * from "@/components/interior/reading-progress"
/** The gap the siblings open is the drop target. */
export * from "@/components/interior/reorder-list"
/** Touch feedback from the pointer origin. */
export * from "@/components/interior/ripple"
/** The section you are actually in. */
export * from "@/components/interior/scroll-spy"
/** Thumb slides, label inverts through it. */
export * from "@/components/interior/segmented-control"
/** Height animates, text does not reflow. */
export * from "@/components/interior/show-more"
/** Skeleton to content with zero layout shift. */
export * from "@/components/interior/skeleton-swap"
/** Stops you can feel. */
export * from "@/components/interior/slider-detents"
/** Momentum that lands on a slide. */
export * from "@/components/interior/snap-carousel"
/** Rows travel to their new order. */
export * from "@/components/interior/sortable-table"
/** Condenses as you go down. */
export * from "@/components/interior/sticky-header"
/** Token by token with a caret. */
export * from "@/components/interior/streaming-text"
/** A stack you decide through. */
export * from "@/components/interior/swipe-deck"
/** Enter adds, backspace highlights then removes. */
export * from "@/components/interior/tag-input"
/** The system narrates its work. */
export * from "@/components/interior/task-steps"
/** Words arrive in reading order. */
export * from "@/components/interior/text-reveal"
/** Disclosure the arrow keys can walk. */
export * from "@/components/interior/tree-view"
/** Someone is writing. */
export * from "@/components/interior/typing-indicator"
/** Marks what just changed. */
export * from "@/components/interior/value-flash"
/** Transition knows forward from back. */
export * from "@/components/interior/wizard-steps"
