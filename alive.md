# ACIP UI Interaction & Motion Plan
## Making "The Pass" Feel Alive

---

## 0. Diagnosis: Why It Currently Feels Dead

A screen feels lifeless when every state looks identical — before you click, while you're clicking, and after. The mockup so far shows one frozen moment. To feel alive, **every interactive element needs at least 4 distinct states**, and the transitions between them need to be felt, not just instant:

| State | What's missing right now |
|---|---|
| **Idle** | Fine as-is |
| **Hover / focus** | No signal that something is clickable before you commit |
| **Active / pressed** | No physical feedback that the click registered |
| **Result** (loading → success/error) | Click just... does nothing visible, then the screen changes abruptly |

The fix isn't "add more animation everywhere" — it's **give every action a visible beginning, middle, and end.**

---

## 1. Motion Principles (the rules everything below follows)

1. **Every click gets an immediate reaction within 100ms.** Even before real data comes back, the button/card should visibly acknowledge the tap (press-scale, ripple, color shift). Waiting in silence is what reads as "dead."
2. **Nothing teleports.** Elements that appear, disappear, or change value should transition (fade, slide, or grow) rather than snap — 150–300ms is the sweet spot; longer feels sluggish, shorter feels like a glitch.
3. **Motion follows a physical metaphor, not decoration.** Since the whole system is built on the "kitchen ticket" idea, motion should reinforce that: things "print in," get "stamped," get "pulled off the rail" when resolved. This keeps animation purposeful instead of feeling bolted-on.
4. **One thing animates at a time per user action.** Simultaneous competing animations feel chaotic, not alive.
5. **Respect `prefers-reduced-motion`.** Every animation below has an instant-appear fallback.

---

## 2. Motion Tokens (define once, reuse everywhere)

| Token | Value | Use for |
|---|---|---|
| `--dur-instant` | 100ms | Button press, checkbox toggle |
| `--dur-fast` | 180ms | Hover states, small fades |
| `--dur-base` | 260ms | Card entrances, ticket print-in |
| `--dur-slow` | 420ms | Page-level transitions, chart draw-in |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Things entering/settling (feels natural, slight overshoot-free deceleration) |
| `--ease-snap` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard UI transitions (hover, color change) |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful confirmations (a ticket "landing," a success check) |

Defining these as CSS variables once means every component feels consistent instead of each developer picking their own random duration.

---

## 3. Per-Component Interaction Design

### 3.1 Buttons ("Open ↗", "Generate menu", "Approve order")
- **Idle:** current flat outline style.
- **Hover:** background shifts to `--surface-1`, border to `--border-strong`, over `--dur-fast`. Cursor becomes pointer (obvious, but often forgotten).
- **Active (pressed):** `transform: scale(0.97)` over `--dur-instant` — this is the single highest-impact fix for the "click and nothing happens" feeling. A physical press-down is what makes an interface feel touchable.
- **Loading (after click, waiting on the model/API):** button text swaps to a small inline spinner + "Generating…" — never leave a button in a pressed-but-frozen state with no explanation.
- **Result:** on success, a brief checkmark icon replaces the spinner for ~600ms before reverting, then the actual result (new ticket, updated table) animates in below.

### 3.2 Station Cards (Menu, Prep, Staff, Profit)
- **Hover:** border brightens to `--border-strong`, subtle `translateY(-2px)` lift over `--dur-fast` with `--ease-out` — literally feels like the card is rising slightly toward the user's cursor.
- **Active/click:** the whole card briefly scales to 0.98 before navigating, so the click has a felt "confirmation" instead of an instant jump-cut to the next screen.
- **Loading transition between screens:** instead of a hard page swap, the outgoing card fades+shrinks while the destination content fades in — even 200ms of cross-fade removes the "jump-cut" dead feeling.

### 3.3 Ticket Cards (the signature "print-in" moment)
This is where the kitchen metaphor should do the most work:
- **On creation** (a new risk flag appears, a menu is generated): the ticket animates in with a **slide-down + fade**, originating from slightly above its final position (mimicking paper coming out of a printer) — `transform: translateY(-12px) → translateY(0)`, opacity `0 → 1`, over `--dur-base` with `--ease-out`.
- **On resolution** (owner approves a purchase order, dismisses a risk flag): instead of just vanishing, the ticket does a quick **slide-right + fade** (like pulling a ticket off the rail once the dish is done) over `--dur-fast`.
- **Urgency pulse:** a *new* danger-level ticket gets one single soft pulse on its left border color (not a looping animation — pulsing forever is annoying, one pulse on arrival is enough to catch the eye) using `--ease-overshoot`.

### 3.4 Forms (Event Planner: guest count, budget, theme)
- **Live preview binding:** as the owner types guest count/budget, the menu preview ticket should visibly update — even a subtle 150ms cross-fade on the changed number makes the interface feel responsive and "aware," rather than static until a Submit button is pressed.
- **Field validation:** invalid input (budget too low for guest count) shows an inline red-bordered state with a **gentle shake** (`translateX` ±4px, 3 cycles, ~250ms total) — a well-known, satisfying "no" signal that's more alive than just turning red silently.
- **Field focus:** input border transitions to `--border-accent` with a soft focus ring (`box-shadow: 0 0 0 3px var(--bg-accent)`), `--dur-fast`.

### 3.5 Tables (Purchasing, Staffing)
- **Row hover:** background tints to `--surface-1` on hover — makes a dense table feel scannable and responsive rather than a flat static grid.
- **Row update (e.g., quantity auto-fills after prediction runs):** the specific cell that changed does a brief highlight-flash (background pulses to `--bg-accent` then fades back over 500ms) so the owner's eye is drawn to exactly what the AI just changed — critical for trust, since silent changes feel either broken or sneaky.

### 3.6 Charts (Sales Forecast)
- **On load:** the line/area draws in left-to-right over `--dur-slow` rather than appearing fully rendered instantly — this single change is one of the most noticeable "alive" cues in any dashboard, because static charts are one of the biggest offenders for feeling like a screenshot rather than software.
- **Hover on a data point:** point scales up slightly (`transform: scale(1.4)`) and a tooltip fades in over `--dur-fast`.

### 3.7 Toasts / Confirmations
- Any background action (auto-saved draft, purchase order sent) surfaces a small toast that slides up from the bottom-right, holds for ~3s, then fades — gives the owner confidence that something happened even when they weren't staring at the exact spot it changed.

---

## 4. Loading & Empty States (the "in-between" moments matter most)

Dead-feeling UIs are often dead specifically in the gap between click and result. Fix every one of these:

- **Skeleton loaders**, not blank space: while a menu/report/forecast is generating, show a soft pulsing placeholder shaped like the eventual content (a grey ticket-shaped block with a subtle shimmer sweep), not a spinner floating in empty space.
- **Progressive reveal:** if a response has multiple parts (e.g., Profit Analyzer's flagged items), reveal them one at a time with a ~80ms stagger between each, rather than all appearing simultaneously — this alone makes multi-item results feel considered rather than dumped on screen.
- **Empty states animate in too:** even "no events yet" should fade/slide in rather than being present on first paint — consistency of motion across every state (including empty ones) is what makes the whole app feel coherent.

---

## 5. Sound & Haptics (optional, low-effort, high-impact for a live demo)

If this is being demoed on a laptop/tablet:
- A very quiet, short "stamp" click sound (under 100ms) on ticket creation — real kitchens are loud with tickets printing; even a subtle audio cue reinforces the metaphor and makes a judge's demo feel tactile. Must be easily mutable/off by default with a single toggle, and never required for understanding the UI.
- On touch devices, a light haptic tap (`navigator.vibrate(10)`) on button press, if supported.

---

## 6. Implementation Priority (highest impact first, since you likely have limited build time)

| Priority | Item | Effort | Impact |
|---|---|---|---|
| 1 | Button press-scale + hover states | Very low | High — fixes the exact "click and nothing" complaint directly |
| 2 | Ticket print-in / print-out animation | Low | High — this is the signature moment, worth getting right |
| 3 | Skeleton loaders instead of blank waits | Low–medium | High — removes the dead gap between click and result |
| 4 | Live form preview updates | Medium | High — makes the Event Planner feel intelligent, not form-then-submit |
| 5 | Chart draw-in animation | Low | Medium — one clean win for the Forecast screen |
| 6 | Row highlight-flash on AI-driven changes | Medium | Medium — builds trust that the system did something specific |
| 7 | Toast notifications | Low | Medium |
| 8 | Sound/haptics | Low | Low–medium, nice-to-have for live demos only |

Start with items 1–3. Those three alone are what will make the biggest difference between "looks like a static mockup" and "feels like real software" — everything after that is polish.

---

## 7. Accessibility Guardrail

Every animation described above must check `prefers-reduced-motion: reduce` and fall back to an instant state change (no slide, no scale, no shake) — CSS makes this simple:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
This is a one-time global rule, not per-component work, so there's no excuse to skip it.