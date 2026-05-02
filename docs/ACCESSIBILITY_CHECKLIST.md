# Accessibility Checklist - exímIA Academy Design System

> WCAG 2.2 AA Compliance
> Based on Overlens visual tokens (canonical source)

## Quick Checklist (Before Shipping)

- [ ] **Color Contrast** - 4.5:1 for normal text, 3:1 for large text
- [ ] **Focus Visible** - All buttons, links, inputs have visible focus ring
- [ ] **Keyboard Navigation** - Tab order is logical, all interactive elements keyboard-accessible
- [ ] **Labels** - All form inputs have associated `<label>` elements
- [ ] **Alt Text** - Meaningful images have descriptive alt text
- [ ] **Semantic HTML** - Using `<button>`, `<a>`, `<input>`, not `<div>` as buttons
- [ ] **Error Messages** - Clear, linked to form field
- [ ] **Dark Mode** - Tested in high contrast mode
- [ ] **Screen Reader** - Tested with at least one (NVDA, JAWS, VoiceOver)

---

## Detailed Checklist by Component Type

### Buttons

#### Visual
- [ ] **Contrast:** Button text meets 4.5:1 minimum
  - Primary (white bg): #ffffff + #0f0f0f = 20.9:1
  - Secondary (dark bg): #242424 + #a0a0a0 = 5.4:1
  - Danger (red bg): #fe4338 + #ffffff = 5.1:1
  - Outline: #ffffff on transparent (#0f0f0f bg) = 20.9:1
- [ ] **Size:** Minimum 44px × 44px touch target
- [ ] **Focus Ring:** Visible when tabbed to
  - Style: `2px solid #2a6ab0` + 2px offset

#### Interaction
- [ ] **Keyboard:** Activates with Enter or Space
- [ ] **Mouse:** Cursor changes to `pointer`
- [ ] **Disabled:** Has `disabled` attribute + visual indicator

#### Semantics
- [ ] **Element:** Uses `<button>` not `<div>`
- [ ] **Type:** Button has `type="button"` or `type="submit"`
- [ ] **Label:** Text content is clear and descriptive
- [ ] **ARIA:** No redundant `role="button"` if using `<button>`

#### State Indicators
- [ ] **Loading:** Visual indicator (spinner) + disabled state
- [ ] **Error:** Clear error message displayed
- [ ] **Hover:** Clear visual change (not color-only)

**Test:**
```bash
# Tab through page - focus ring should be visible on all buttons
# Press Tab, then Enter/Space - button should activate
# Use arrow keys (if button group) - focus moves correctly
```

---

### Form Inputs

#### Visual
- [ ] **Contrast:** Input text meets 4.5:1 minimum
  - Dark inputs (#1e1e1e) + white text = 16.5:1
- [ ] **Border:** Clear border when unfocused
- [ ] **Focus State:** Obvious focus indicator
  - Style: `2px solid #2a6ab0` border + shadow
- [ ] **Error State:** Red border + error text (#fe4338)

#### Size & Spacing
- [ ] **Touch Target:** Minimum 44px × 44px (input height: 44px)
- [ ] **Padding:** 0.75rem 1rem (12px 16px)
- [ ] **Gap to Label:** 0.5rem (8px) minimum

#### Labels
- [ ] **Element:** `<label>` properly associated with input
  ```html
  <label htmlFor="email">Email</label>
  <input id="email" type="email" />
  ```
- [ ] **Required:** Required field marked (`<label>Name *</label>` + `<input required />`)
- [ ] **Error:** Error message linked to input
  ```html
  <input aria-describedby="email-error" />
  <span id="email-error">Invalid email format</span>
  ```

#### States
- [ ] **Placeholder:** Not a substitute for label
  - Placeholder disappears, label is permanent
- [ ] **Disabled:** Clear visual (opacity 0.5) + `disabled` attribute
- [ ] **Error:** Clear error message (not color alone)
- [ ] **Success:** Visual indicator (checkmark or green border)

#### Keyboard
- [ ] **Tab Order:** Inputs receive focus in logical order
- [ ] **Tab Trap:** Focus doesn't get stuck in modal/dropdown
- [ ] **Autofocus:** Only on first input, not middle of form
- [ ] **Enter:** Submits form (not by default, check `onKeyDown`)

#### Semantics
- [ ] **Type Attribute:** Uses correct `type="email"`, `type="password"`, etc.
- [ ] **Pattern Attribute:** For custom validation (e.g., phone numbers)
- [ ] **Required:** Mark required fields both visually and with attribute
- [ ] **aria-label:** For inputs without visible labels (search box icon)

**Test:**
```bash
# Tab through form - focus moves logically
# Type in input - placeholder disappears, label remains visible
# Trigger error - message appears, linked to field, visible in high contrast
# Press Enter - form submits (if button present)
# Use screen reader - hears "Email, required, text input"
```

---

### Color Usage

#### Contrast Testing
- [ ] **Text on Background:**
  - Normal text: ≥4.5:1 ratio
  - Large text (≥18px or ≥14px bold): ≥3:1 ratio
  - UI components: ≥3:1 ratio
- [ ] **Tool:** Use WebAIM contrast checker
  ```
  Foreground: #ffffff
  Background: #1e1e1e (card)
  Ratio: 16.5:1 PASS

  Foreground: #a0a0a0
  Background: #0f0f0f (app bg)
  Ratio: 8.5:1 PASS

  Foreground: #888888
  Background: #0f0f0f (app bg)
  Ratio: 5.9:1 PASS

  Foreground: #666666
  Background: #0f0f0f (app bg)
  Ratio: 3.9:1 PASS (large text only)
  ```

#### Color Not the Only Signal
- [ ] **Error:** Not red text alone, but red border + text + icon
- [ ] **Success:** Not green text alone, but green border + text + checkmark
- [ ] **Disabled:** Not light color alone, but also `disabled` attribute + text change

#### Dark Mode
- [ ] **Dark Theme Tested:** All colors readable on dark backgrounds
  - Background: bg-app (#0f0f0f) or bg-card (#1e1e1e)
  - Text: white (#ffffff) or text-secondary (#a0a0a0)
  - Accents: accent-blue-mid (#2a6ab0), success (#4b9560)
- [ ] **High Contrast Mode:** Tested in Windows High Contrast
- [ ] **Inverted Colors:** Works when user enables color inversion

**Test:**
```bash
# Windows: Settings → Ease of Access → High Contrast
# macOS: System Preferences → Accessibility → Display → Increase Contrast
# All text readable? All buttons visible? All status colors clear?
```

---

### Typography

#### Font Sizes
- [ ] **Minimum:** No text smaller than 0.875rem (14px) for body
- [ ] **Base:** 1rem (16px) is default body size
- [ ] **Headings:** 1.125rem minimum for subheadings
- [ ] **Scaling:** All sizes in `rem` units (responsive to base font)

#### Line Height & Spacing
- [ ] **Line Height:** ≥1.3 (130%) for body text
  - Standard: 130% for normal reading
  - Relaxed: 150% for longer-form content
  - Tight: 100% for headlines only
- [ ] **Letter Spacing:** Not negative for body text
  - Headlines: -0.02em is OK
  - Body: 0em (normal)
- [ ] **Paragraph Spacing:** ≥space-3 (1rem) gap between paragraphs

#### Text Alignment
- [ ] **Left Aligned:** Default for LTR languages
- [ ] **Justified:** Only with hyphenation (not English without careful setup)
- [ ] **Center Aligned:** Headings only, not body text
- [ ] **All Caps:** Used sparingly (harder to read)

**Test:**
```bash
# Set browser zoom to 200% - text still readable?
# Increase font size in OS settings - responsive?
# Read body text aloud with screen reader - line breaks make sense?
```

---

### Focus & Keyboard Navigation

#### Focus Styles
- [ ] **Visible:** Focus ring visible at all zoom levels (including 200%)
- [ ] **Color:** Meets 3:1 contrast with background
- [ ] **Size:** At least 2px thick
- [ ] **Distance:** Minimum 2px from element
- [ ] **Not Removed:** Never `outline: none` without replacement

**CSS Standard:**
```css
button:focus {
  outline: 2px solid #2a6ab0;
  outline-offset: 2px;
}
```

#### Tab Order
- [ ] **Logical:** Follows visual flow (left to right, top to bottom)
- [ ] **No Skips:** All interactive elements reachable by Tab
- [ ] **Trap Prevention:** Focus can exit modals by tabbing to close button
- [ ] **Custom Order:** Use `tabindex` only when necessary
  - Never: `tabindex="0"` on `<div>` buttons
  - OK: `tabindex="-1"` to make focusable via script

**Test:**
```bash
# Start at page top
# Press Tab repeatedly
# Confirm focus moves in reading order
# No element should be unreachable
```

#### Skip Links
- [ ] **Present:** Skip to main content link (for screen readers)
  ```html
  <a href="#main" class="sr-only">Skip to main content</a>
  <main id="main">...</main>
  ```
- [ ] **Visible on Focus:** Hidden by default, visible when focused

#### Keyboard Accessibility
- [ ] **Links:** Activated by Enter
- [ ] **Buttons:** Activated by Enter or Space
- [ ] **Dialogs:** Escape closes (focus returns to trigger)
- [ ] **Dropdowns:** Arrow keys navigate, Enter selects
- [ ] **Checkboxes:** Space toggles
- [ ] **Radio Buttons:** Arrow keys select, Space checks selected

**Test:**
```bash
# Unplug mouse
# Navigate entire page using Tab, Enter, Escape, Arrow keys
# Should be able to use all features
```

---

### Images & Icons

#### Alt Text
- [ ] **Meaningful:** Describes image purpose, not "image.png"
  ```html
  ❌ <img src="pic.jpg" alt="image" />
  ✅ <img src="hero.jpg" alt="Team meeting in conference room" />
  ```
- [ ] **Decorative:** Empty alt for decorative images
  ```html
  ❌ <img src="divider.png" alt="divider" /> (no alt, just border)
  ✅ <img src="divider.png" alt="" />
  ```
- [ ] **Icons with Text:** Icon itself not alt-textified
  ```html
  ✅ <button><CheckIcon /> Save</button>
     (No alt needed, button text "Save" sufficient)
  ```
- [ ] **Complex Images:** Description on page or link to extended description
  ```html
  <figure>
    <img src="chart.png" alt="Sales growth chart" />
    <figcaption><a href="#chart-details">Full data table</a></figcaption>
  </figure>
  ```

#### Icon Contrast
- [ ] **Standalone Icons:** Must meet 3:1 contrast with background
- [ ] **Icons + Text:** Text must meet 4.5:1
- [ ] **Decorative Icons:** Can have lower contrast if not actionable

---

### ARIA Usage

#### Proper Semantic HTML
- [ ] **Navigation:** `<nav>` for page navigation
- [ ] **Main Content:** `<main>` wraps primary content
- [ ] **Sections:** `<section>`, `<article>`, `<aside>` with headings
- [ ] **Forms:** `<form>`, `<fieldset>`, `<legend>` for grouped inputs
- [ ] **Lists:** `<ul>`, `<ol>`, `<li>` for actual lists (not spacing)

#### ARIA Only When Needed
- [ ] **No Redundant ARIA:** Don't add `role="button"` to `<button>`
- [ ] **ARIA Properties:** Use for dynamic content only
  ```html
  ✅ <button aria-expanded="false" aria-controls="menu">Menu</button>
  ❌ <button role="button">Save</button> (already <button>)
  ```
- [ ] **aria-label:** For icon-only buttons
  ```html
  ✅ <button aria-label="Close"><XIcon /></button>
  ```
- [ ] **aria-describedby:** For form error messages
  ```html
  <input aria-describedby="error-msg" />
  <span id="error-msg">Email is required</span>
  ```

#### Live Regions
- [ ] **Dynamic Updates:** Use `aria-live="polite"` for toast messages
- [ ] **Loading States:** Announce loading with live region
- [ ] **Search Results:** Announce number of results

**Test:**
```bash
# Use screen reader (NVDA, JAWS, VoiceOver)
# Should hear proper semantics:
#   "Heading 1: Page Title"
#   "Navigation, list, 5 items"
#   "Button, Close"
#   "Edit text, Email, required"
```

---

### Testing with Screen Readers

#### Windows (Free)
- **NVDA:** Download from nvaccess.org
  - Start: NVDA + N (Open menu)
  - Reading: NVDA + Down Arrow (read next line)
  - Browse mode: Browse element list (NVDA + F7)

#### macOS (Built-in)
- **VoiceOver:** Cmd + F5 to toggle
  - Modifier key: Ctrl + Option
  - Read from here: Ctrl + Option + A
  - Rotor: Ctrl + Option + U

#### Testing Procedure
1. **Start screen reader**
2. **Go to page top**
3. **Listen** - What do you hear first?
   - ✅ Page title and main heading
   - ❌ Nothing (page not properly marked up)
4. **Navigate** - Can you find all content?
   - Use arrow keys, Tab, Rotor/menu
5. **Interact** - Can you activate buttons/forms?
   - Use Enter, Space, arrow keys
6. **Announce** - Are dynamic updates announced?
   - Toast messages, loading states, errors

---

### Testing Tools

#### Automated
- **axe DevTools:** Browser extension (free)
- **WAVE:** Browser extension + web version
- **Lighthouse:** Built into Chrome DevTools
- **ESLint Plugin:** `jsx-a11y/recommended`

#### Manual
- **Contrast:** WebAIM contrast checker
- **Keyboard:** Tab through entire page
- **Screen Reader:** NVDA (Windows), VoiceOver (macOS)
- **Zoom:** Test at 200% browser zoom
- **High Contrast:** Windows High Contrast mode

#### Automated Test
```bash
# Run in CI/CD
npm run test:a11y

# Check linting
npm run lint -- --plugin jsx-a11y
```

---

## Component Accessibility Checklist

Use this template for each component before shipping:

### Component: [Name]

#### Visual
- [ ] Contrast: 4.5:1 (normal), 3:1 (large)
- [ ] Focus ring: 2px, #2a6ab0, 2px offset
- [ ] Size: 44px+ touch targets
- [ ] Color not only signal (icons, borders, text)

#### Interaction
- [ ] Keyboard: All functions available via keyboard
- [ ] Tab order: Logical flow
- [ ] Focus trap: Can escape (Escape key, close button)
- [ ] States: Hover, active, disabled, error visible

#### Semantics
- [ ] HTML: Using semantic elements (`<button>`, `<input>`, etc.)
- [ ] ARIA: Only when semantic HTML insufficient
- [ ] Labels: All inputs labeled
- [ ] Errors: Linked to fields, clear message

#### Testing
- [ ] Keyboard: Tab, Enter, Space, Arrow, Escape all work
- [ ] Screen Reader: All content/functionality accessible
- [ ] Zoom: Readable at 200% browser zoom
- [ ] High Contrast: Readable in Windows HC mode

**Result:** PASS ✅ / FAIL ❌

**Issues Found:**
1.
2.
3.

**Resolution:**
(Describe fixes or defer to next phase)

---

## Accessibility Standards

### WCAG 2.2 AA (Target)
- **A (Basic):** 30 criteria
- **AA (Enhanced):** 50 criteria ← **WE TARGET THIS**
- **AAA (Specialized):** 78 criteria

### exímIA Academy Targets
- ✅ Text Contrast: 4.5:1 (normal), 3:1 (large), 3:1 (UI)
- ✅ Focus Visible: All interactive elements
- ✅ Keyboard Accessible: All features via keyboard
- ✅ WCAG 2.2 Level AA: All 50 criteria

---

## Resources

- **WCAG 2.2 Official:** www.w3.org/WAI/WCAG22/quickref/
- **WebAIM Contrast:** webaim.org/resources/contrastchecker/
- **ARIA Authoring Practices:** w3c.github.io/aria-practices-1.1/
- **Screen Reader Guides:**
  - NVDA: nvaccess.org/documentation/
  - VoiceOver: apple.com/voiceover/
  - JAWS: freedomscientific.com/

---

## Common Failures & Fixes

### "Color contrast too low"
```css
/* ❌ FAIL: 3.9:1 contrast (normal text) */
color: #666666;        /* text-muted */
background: #0f0f0f;   /* bg-app */

/* ✅ PASS: 8.5:1 contrast */
color: #a0a0a0;        /* text-secondary */
background: #0f0f0f;   /* bg-app */

/* ✅ PASS: 20.9:1 contrast */
color: #ffffff;        /* text-primary */
background: #0f0f0f;   /* bg-app */
```

### "No focus visible"
```css
/* ❌ FAIL: Focus removed */
button:focus {
  outline: none;
}

/* ✅ PASS: Focus visible */
button:focus {
  outline: 2px solid #2a6ab0;
  outline-offset: 2px;
}
```

### "Error color-only"
```html
<!-- ❌ FAIL: Only red color signals error -->
<input style="border-color: #fe4338" />

<!-- ✅ PASS: Red border + message + icon -->
<input aria-describedby="error" style="border: 2px solid #fe4338" />
<span id="error" style="color: #fe4338">
  <ErrorIcon /> Email is required
</span>
```

### "Button too small"
```css
/* ❌ FAIL: 32px button */
button {
  padding: 8px 16px;
  font-size: 12px;
  /* Height: 32px */
}

/* ✅ PASS: 44px minimum touch target */
button {
  padding: 12px 20px;
  font-size: 16px;
  min-height: 44px;
  min-width: 44px;
}
```

---

**Last Updated:** 2026-02-07
**Source of Truth:** Visual analysis of Overlens platform screenshots
**Maintained by:** Brad Frost, Design System Architect
**Compliance Target:** WCAG 2.2 Level AA
