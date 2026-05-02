# exímIA Academy Design System Documentation

## Source of Truth

All design tokens are extracted from **visual analysis of Overlens platform screenshots**. This is the single canonical source.

**Canonical chain:** Screenshots → `shock-report.html` (visual reference) → `design-tokens.json` (machine-readable) → all docs aligned.

---

## What Was Generated

Complete design system documentation extracted from Overlens and ready for component building.

### Documentation Files

| File | Purpose | Location |
|------|---------|----------|
| **PATTERN_LIBRARY.md** | Complete design tokens, colors, typography, spacing, component specs | `/docs/` |
| **COMPONENT_IMPLEMENTATION_GUIDE.md** | Step-by-step: build buttons, forms, molecules, organisms with code examples | `/docs/` |
| **ACCESSIBILITY_CHECKLIST.md** | WCAG 2.2 AA compliance checklist, testing procedures, tools | `/docs/` |
| **shock-report.html** | Visual reference report with all tokens rendered | `/docs/` |
| **design-tokens.json** | Machine-readable tokens (colors, typography, spacing, etc.) | `/Benchmarks/Design/` |

### Design Foundation

**From Overlens Visual Analysis:**
- 7 background surfaces (#0f0f0f to #2a2a2a)
- 4 text levels (primary, secondary, muted, inactive)
- 3 accent groups (blue 4 shades, gold 3 shades, teal 2 shades)
- 4 semantic colors (success, error, warning, info)
- 3 border opacity levels (subtle, medium, button)
- 2 font families (Inter, JetBrains Mono)
- 12 font sizes (0.625rem to 2.8rem)
- 10 spacing scale steps (0.25rem to 4rem)
- 6 border radius values (6px to 100px + circle)
- Dark theme optimized
- WCAG AA color contrast verified

---

## Quick Start

### For Designers
1. Open `/Benchmarks/Design/design-tokens.json`
2. Import colors into Figma (backgrounds, text, accents, semantic)
3. Set up Inter font with weight/size scale
4. Reference `/docs/PATTERN_LIBRARY.md` for specifications

### For Developers
1. Read `/docs/COMPONENT_IMPLEMENTATION_GUIDE.md`
2. Follow the Button example step-by-step
3. Key steps:
   - Define types (ButtonProps, ButtonVariant)
   - Map variants to tokens
   - Implement component
   - Write tests
   - Create Storybook stories
4. Import tokens from `/Benchmarks/Design/design-tokens.json`

### For QA / Accessibility
1. Read `/docs/ACCESSIBILITY_CHECKLIST.md`
2. Before each component ships:
   - [ ] Color contrast: 4.5:1 (normal text)
   - [ ] Focus visible on keyboard nav
   - [ ] All buttons/inputs labeled and accessible
   - [ ] Tested with screen reader (VoiceOver)

---

## Component Building Roadmap

### Phase 1: Atoms (Foundation)
1. **Button** - Variants: outline (primary CTA), primary, secondary, danger, transparent
2. **Input** - Types: text, email, password, number, search
3. **Label** - Associated with inputs, required indicator
4. **Icon** - SVG wrapper, sizing system
5. **Card** - Container with variants (standard, trilhas, lives, course)

### Phase 2: Molecules (Combinations)
- **FormField** = Label + Input + Error message
- **MenuItem** = Icon + Label + Badge
- **Badge** = Label + background (pill shape)
- **Alert** = Icon + Title + Message
- **DudBar** = AI assistant message component

### Phase 3: Organisms (Complex)
- **Form** = Multiple FormFields + validation
- **Navigation** = Sidebar (200px fixed) with groups and active states
- **Modal** = Header + content + footer + close
- **Hero** = Gradient background + heading + CTA

### Phase 4: Templates (Full Pages)
- **Login** = Form + branding
- **Dashboard** = Sidebar + Hero + content grid
- **Trilhas** = Hero + horizontal scroll cards

---

## Key Files to Reference

### When Building Components
1. **`/docs/PATTERN_LIBRARY.md`** - Token values (colors, spacing, typography)
2. **`/docs/COMPONENT_IMPLEMENTATION_GUIDE.md`** - Code examples (TypeScript, CSS, tests)
3. **`/Benchmarks/Design/design-tokens.json`** - Programmatic access to tokens

### When Testing Components
1. **`/docs/ACCESSIBILITY_CHECKLIST.md`** - Before/after shipping checklist

### When Reviewing Visual Design
1. **`/docs/shock-report.html`** - Visual reference of all tokens rendered

---

## Token Architecture

```
design-tokens.json
├── colors
│   ├── backgrounds (7: app, sidebar, surface, card, elevated, hover, dud)
│   ├── text (4: primary, secondary, muted, inactive)
│   ├── accent
│   │   ├── blue (4: deep, default, mid, light)
│   │   ├── gold (3: dark, default, light)
│   │   └── teal (2: dark, default)
│   ├── semantic (4: success, error, warning, info)
│   ├── border (3: subtle, medium, button)
│   └── special (2: courseCard, courseCardText)
├── typography
│   ├── fontFamilies (2: Inter, JetBrains Mono)
│   ├── fontSizes (12: 0.625rem to 2.8rem)
│   ├── fontWeights (5: 300-700)
│   └── lineHeights (4: tight, normal, relaxed, loose)
├── spacing
│   ├── scale (10: 0.25rem to 4rem)
│   ├── padding (component-specific)
│   └── gap (6: xs to 2xl)
├── border
│   ├── radius (6: sm, md, lg, xl, pill, circle)
│   └── width (default, focus)
├── shadows (3: card, elevated, hero)
├── layout (sidebar 200px, topbar 56px)
└── components (button, card, input, sidebar, hero, dudBar)
```

**Import pattern:**
```typescript
import tokens from '@/tokens/design-tokens.json'

// Use in component
const cardStyles = {
  backgroundColor: tokens.colors.backgrounds.card.value,    // #1e1e1e
  padding: tokens.spacing.scale[4].value,                    // 1rem
  borderRadius: tokens.border.radius.md.value,               // 12px
  border: `1px solid ${tokens.colors.border.subtle.value}`,  // rgba(255,255,255,0.06)
  color: tokens.colors.text.primary.value,                   // #ffffff
}
```

---

## Quality Gates

All components must pass:

- [ ] **TypeScript:** No errors in strict mode
- [ ] **Linting:** ESLint passes
- [ ] **Testing:** >80% code coverage
- [ ] **Accessibility:** WCAG 2.2 AA compliant
  - Color contrast >= 4.5:1
  - Focus visible
  - Keyboard accessible
  - Screen reader tested
- [ ] **Documentation:** Storybook stories

---

## Reading Order

**Start here:**
1. This file (README_DESIGN_SYSTEM.md)
2. `/docs/PATTERN_LIBRARY.md` - Color System section
3. `/docs/COMPONENT_IMPLEMENTATION_GUIDE.md` - Building a Button section
4. Build first component (Button)

**Before shipping each component:**
1. `/docs/ACCESSIBILITY_CHECKLIST.md` - Component-specific checklist
2. Test with VoiceOver (macOS)

**Ongoing reference:**
1. `/docs/PATTERN_LIBRARY.md` for token values
2. `/docs/COMPONENT_IMPLEMENTATION_GUIDE.md` for code patterns
3. `/Benchmarks/Design/design-tokens.json` for programmatic access

---

**Design System Status:** Foundation Complete, Tokens Aligned, Ready for Component Building
**Last Updated:** 2026-02-07
**Source of Truth:** Visual analysis of Overlens platform screenshots
**Version:** 1.1.0 - Tokens Aligned
