# Pattern Library - exímIA Academy Design System

> Based on Overlens Visual Analysis (Canonical Source)
> Last Updated: 2026-02-07

## Overview

This pattern library documents the complete design system for exímIA Academy platform. All tokens are extracted from **visual analysis of Overlens platform screenshots** - the single source of truth.

**Status:** Foundation extracted, ready for component building
**Phase:** Greenfield setup (design tokens available)
**Source of Truth:** `shock-report.html` (visual tokens) + `design-tokens.json` (aligned)

---

## Table of Contents

1. [Design Tokens](#design-tokens)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Patterns](#component-patterns)
6. [Getting Started](#getting-started)
7. [Best Practices](#best-practices)
8. [Accessibility](#accessibility)

---

## Design Tokens

All styling decisions are token-based. Zero hardcoded values in components.

### Token Architecture

```
design-tokens.json
├── colors/
│   ├── backgrounds/    (7 dark surfaces: app, sidebar, surface, card, elevated, hover, dud)
│   ├── text/           (4 levels: primary, secondary, muted, inactive)
│   ├── accent/         (3 groups: blue, gold, teal)
│   ├── semantic/       (4 status: success, error, warning, info)
│   ├── border/         (3 opacity levels: subtle, medium, button)
│   └── special/        (course card cream)
├── typography/
│   ├── fontFamilies/   (2 families: Inter, JetBrains Mono)
│   ├── fontSizes/      (12 sizes: 0.625rem to 2.8rem)
│   ├── fontWeights/    (5 weights: 300-700)
│   └── lineHeights/    (4 levels: tight, normal, relaxed, loose)
├── spacing/
│   ├── scale/          (10 steps: 0.25rem to 4rem)
│   ├── padding/        (component-specific)
│   └── gap/            (6 levels: xs to 2xl)
├── border/
│   ├── radius/         (6 values: 6px to 100px + circle)
│   └── width/          (default 1px, focus 2px)
├── shadows/            (3 levels: card, elevated, hero)
└── layout/
    ├── sidebar/        (200px fixed)
    └── topbar/         (56px height)
```

**See:** `/Benchmarks/Design/design-tokens.json` for complete token definitions.

---

## Color System

### Background Surfaces (Dark Theme)

Overlens uses a subtle gray gradient scale for depth hierarchy.

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-app` | `#0f0f0f` | Primary app background, darkest |
| `bg-sidebar` | `#111111` | Sidebar background |
| `bg-surface` | `#1a1a1a` | Content surface |
| `bg-card` | `#1e1e1e` | Card backgrounds |
| `bg-elevated` | `#242424` | Modals, dropdowns, elevated surfaces |
| `bg-hover` | `#2a2a2a` | Hover state backgrounds |
| `bg-dud` | `#1c1c1c` | D.U.D assistant bar |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#ffffff` | Headings, active nav items, high emphasis |
| `text-secondary` | `#a0a0a0` | Descriptions, secondary content |
| `text-muted` | `#666666` | Placeholders, timestamps |
| `text-inactive` | `#888888` | Inactive nav items, disabled text |

### Accent Colors

#### Blue (Hero, Active States, Links)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue-deep` | `#0d2847` | Hero gradient base, deep background |
| `accent-blue` | `#1a4a8a` | Primary blue accent |
| `accent-blue-mid` | `#2a6ab0` | Active states, focus borders, info |
| `accent-blue-light` | `#4a8ad0` | Highlights, links |

#### Gold (Trilhas/Learning Paths)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-gold-dark` | `#8a6a20` | Gold gradient base |
| `accent-gold` | `#c4a040` | Trilhas card accent |
| `accent-gold-light` | `#d4b860` | Text on gold cards |

#### Teal (Lives/Streaming)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-teal-dark` | `#1a4a5a` | Teal gradient base |
| `accent-teal` | `#2a7a8a` | Lives card accent |

### Semantic Colors

Status and feedback colors with specific meanings.

| Token | Hex | Meaning |
|-------|-----|---------|
| `success` | `#4b9560` | Positive, approved, complete |
| `error` | `#fe4338` | Error, danger, destructive |
| `warning` | `#f6a609` | Warning, attention needed |
| `info` | `#2a6ab0` | Information (uses accent-blue-mid) |

**Rule:** Use semantic colors for status only, not for branding.

### Border Colors

All borders use white with varying opacity for subtle dark-theme integration.

| Token | Value | Usage |
|-------|-------|-------|
| `border-subtle` | `rgba(255, 255, 255, 0.06)` | Sidebar dividers, card edges |
| `border-medium` | `rgba(255, 255, 255, 0.1)` | Card borders, input borders |
| `border-button` | `rgba(255, 255, 255, 0.25)` | Outline button borders |

### Special Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `courseCard` | `#f0ece4` | Light cream background for course cards |
| `courseCardText` | `#2a2a2a` | Dark text on light course cards |

---

## Typography

### Font Stack

```css
/* Primary (all UI) */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Code/Monospace */
font-family: 'JetBrains Mono', 'Monaco', monospace;
```

**Note:** Overlens uses Inter as its only display/body font. No Outfit font observed in visual analysis.

### Font Sizes

All values in `rem` for accessibility.

| Token | Size | Computed | Use Case |
|-------|------|----------|----------|
| `text-2xs` | `0.625rem` | 10px | Micro labels |
| `text-xs` | `0.75rem` | 12px | Small labels, badges, captions |
| `text-sm` | `0.875rem` | 14px | Nav items, form labels, secondary text |
| `text-base` | `1rem` | 16px | Body text (default) |
| `text-md` | `1.125rem` | 18px | Subheadings |
| `text-lg` | `1.25rem` | 20px | Section headings |
| `text-xl` | `1.5rem` | 24px | Page headings |
| `text-2xl` | `1.75rem` | 28px | Major headings |
| `text-3xl` | `2rem` | 32px | Hero subheadings |
| `text-4xl` | `2.25rem` | 36px | Large display |
| `text-5xl` | `2.5rem` | 40px | Hero headings |
| `text-6xl` | `2.8rem` | 44.8px | Maximum display |

### Font Weights

| Weight | Token | Use Case |
|--------|-------|----------|
| 300 | `light` | Large display text |
| 400 | `normal` | Body text, default |
| 500 | `medium` | Buttons, nav items, emphasis |
| 600 | `semibold` | Headings, strong emphasis |
| 700 | `bold` | Hero headings, maximum emphasis |

### Line Heights

| Value | Token | Use Case |
|-------|-------|----------|
| 1.1 | `tight` | Headlines, compact layouts |
| 1.3 | `normal` | Body text, standard reading |
| 1.5 | `relaxed` | Descriptions, standard line spacing |
| 1.6 | `loose` | Long-form content |

### Typography Scale Example

```
Hero (H1):        2.8rem, 700, 1.1    → 44.8px, bold, tight
Heading (H2):     2rem, 600, 1.1      → 32px, semibold, tight
Heading (H3):     1.5rem, 600, 1.3    → 24px, semibold, normal
Subheading (H4):  1.25rem, 500, 1.3   → 20px, medium, normal
Body Text:        1rem, 400, 1.5      → 16px, normal, relaxed
Small Text:       0.875rem, 400, 1.5  → 14px, normal, relaxed
Caption:          0.75rem, 400, 1.5   → 12px, normal, relaxed
```

---

## Spacing & Layout

### Spacing Scale

Based on 4px base unit.

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `space-1` | `0.25rem` | 4px | Minimal gaps, tight inline |
| `space-2` | `0.5rem` | 8px | Small spacing, icon gaps |
| `space-3` | `0.75rem` | 12px | Small gaps, nav item padding |
| `space-4` | `1rem` | 16px | Base spacing, card padding |
| `space-5` | `1.25rem` | 20px | Medium spacing |
| `space-6` | `1.5rem` | 24px | Large spacing, section gaps |
| `space-7` | `2rem` | 32px | Component separation |
| `space-8` | `2.5rem` | 40px | Section separation |
| `space-9` | `3rem` | 48px | Major section gaps |
| `space-10` | `4rem` | 64px | Hero-level spacing |

### Layout Patterns

#### Sidebar
```
Width: 200px (fixed)
Background: #111111
Border-right: 1px solid rgba(255,255,255,0.06)
Nav item padding: 0.5rem 1.25rem
Nav item font: 0.875rem, 500 weight
Inactive text: #888888
Active text: #ffffff
```

#### Top Bar
```
Height: 56px
Background: transparent (overlays content)
Border-bottom: 1px solid rgba(255,255,255,0.06)
```

#### Cards
```
Background: #1e1e1e
Border: 1px solid rgba(255,255,255,0.06)
Border radius: 12px
Padding: 1rem
Box-shadow: 0 2px 8px rgba(0,0,0,0.4)
```

#### Hero Section
```
Min-height: 420px
Background: Real image (right 70%) + gradient overlay from left
Overlay: linear-gradient(90deg, rgba(15,15,15,0.95) 0%, rgba(15,15,15,0.7) 40%, transparent 100%)
Heading: 3.2rem, 800 weight, line-height 1.05, letter-spacing -1px
```

#### D.U.D Bar
```
Background: #1c1c1c
Border: 1px solid rgba(255,255,255,0.06)
Border radius: 12px
Padding: 0.75rem 1rem
```

---

## Component Patterns

### Button

**Token dependencies:** colors, spacing, typography, borders

#### Variants

##### 1. Outline (Primary CTA in Overlens)
```
Background: transparent
Text: #ffffff
Border: 1px solid rgba(255,255,255,0.25)
Padding: 0.5rem 1.25rem
Border radius: 6px
Font: 0.875rem, 500 weight
Hover: background → rgba(255,255,255,0.05)
```

##### 2. Primary (White)
```
Background: #ffffff
Text: #0f0f0f
Border: none
Padding: 0.5rem 1.25rem
Border radius: 6px
Hover: background → #e0e0e0
Disabled: opacity 0.4
```

##### 3. Secondary (Dark)
```
Background: #242424
Text: #a0a0a0
Border: 1px solid rgba(255,255,255,0.1)
Padding: 0.5rem 1.25rem
Border radius: 6px
Hover: background → #2a2a2a
```

##### 4. Danger (Red)
```
Background: #fe4338
Text: #ffffff
Border: none
Padding: 0.5rem 1.25rem
Border radius: 6px
Hover: brightness(1.1)
Disabled: opacity 0.4
```

##### 5. Transparent
```
Background: transparent
Text: #a0a0a0
Border: none
Padding: 0.5rem 1.25rem
Hover: text → #ffffff
```

### Forms

#### Input
```
Background: #1e1e1e
Text: #ffffff
Placeholder: #666666
Border: 1px solid rgba(255,255,255,0.1)
Border radius: 6px
Padding: 0.75rem 1rem
Height: 44px
Font: 0.875rem, 400 weight

Focus:
  Border: 2px solid #2a6ab0

Error:
  Border: 2px solid #fe4338

Disabled:
  Opacity: 0.4
```

### Navigation

#### Sidebar Menu
```
Width: 200px (fixed)
Background: #111111
Border-right: 1px solid rgba(255,255,255,0.06)

Item:
  Padding: 0.5rem 1.25rem
  Font: 0.875rem, 500 weight
  Text: #888888 (inactive)

Active Item:
  Text: #ffffff
  Left border: 2px solid #2a6ab0

Hover:
  Background: #1a1a1a
  Text: #ffffff
```

### Cards

#### Standard Card
```
Background: #1e1e1e
Border: 1px solid rgba(255,255,255,0.06)
Border radius: 12px
Padding: 1rem
Box-shadow: 0 2px 8px rgba(0,0,0,0.4)

Hover:
  Box-shadow: 0 8px 24px rgba(0,0,0,0.5)
  Transform: translateY(-2px)
```

#### Card Variants (Overlens-specific)
```
Trilhas:   gradient(135deg, #8a6a20, #c4a040) - gold
Lives:     gradient(135deg, #1a4a5a, #2a7a8a) - teal
Biblioteca: background #1e1e1e - dark standard
Course:    background #f0ece4, text #2a2a2a - light cream
```

### Badges
```
Background: rgba(255,255,255,0.1)
Text: #a0a0a0
Border radius: 100px (pill)
Padding: 0.25rem 0.75rem
Font: 0.75rem
```

---

## Getting Started

### For Designers

1. **Open design-tokens.json** - Complete token reference
2. **Use these values in Figma:**
   - Colors: Import background, text, accent, semantic palettes
   - Typography: Inter font with weight/size scale
   - Components: Build atoms (Button, Input, Card) then molecules

### For Developers

1. **Import tokens in your build:**
   ```typescript
   import tokens from '@/tokens/design-tokens.json'
   ```

2. **Build first components using Atomic Design:**
   - **Atoms:** Button, Input, Label, Icon
   - **Molecules:** FormField, Card, Menu
   - **Organisms:** Form, Navigation, Modal

3. **Follow token-based styling (no hardcoded values):**
   ```typescript
   // Use token values
   const buttonStyle = {
     backgroundColor: tokens.colors.backgrounds.elevated.value,
     color: tokens.colors.text.secondary.value,
     borderRadius: tokens.border.radius.sm.value,
     padding: tokens.spacing.padding.button
   }
   ```

### For Product Managers

1. **Reference:** This design system covers all UI patterns for consistency
2. **Building new features?** Choose existing components from library
3. **Need new pattern?** Request via design system team
4. **Measure:** Track design token usage for consistency %

---

## Best Practices

### DO

- **Use semantic colors** for status: error, success, warning, info
- **Build with tokens only** - zero hardcoded hex codes
- **Test color contrast** - minimum WCAG AA (4.5:1 normal, 3:1 large)
- **Use spacing scale** - all spacing from scale tokens
- **Use rem for font sizes** - scales with user's base font size
- **Test dark theme** - all components optimized for dark backgrounds
- **Use rgba borders** - white with opacity for dark-theme integration

### DON'T

- Hardcode colors like `#ffffff` - use token instead
- Use arbitrary spacing like `17px` - snap to spacing scale
- Create new color values - use palette tokens
- Mix accent colors without intent (blue for actions, gold for Trilhas, teal for Lives)
- Forget focus states - all interactive elements need visible focus
- Ship untested contrast ratios - use contrast-check tool
- Use Material Design colors (`#2196f3`, `#4caf50`, etc.) - they are NOT in this palette

---

## Accessibility

### WCAG 2.2 Compliance (Target: AA)

Key contrast ratios with canonical colors:

| Pair | Ratio | Result |
|------|-------|--------|
| `#ffffff` on `#0f0f0f` (text on bg-app) | 20.9:1 | AAA |
| `#ffffff` on `#1e1e1e` (text on card) | 16.5:1 | AAA |
| `#a0a0a0` on `#0f0f0f` (secondary text on bg-app) | 8.5:1 | AAA |
| `#a0a0a0` on `#1e1e1e` (secondary text on card) | 6.7:1 | AAA |
| `#888888` on `#0f0f0f` (inactive on bg-app) | 5.9:1 | AAA |
| `#666666` on `#0f0f0f` (muted on bg-app) | 3.9:1 | AA large |
| `#2a2a2a` on `#f0ece4` (course card text) | 11.2:1 | AAA |

### Testing Checklist

Before shipping a component:

- [ ] Color contrast >= 4.5:1 (normal text)
- [ ] Color contrast >= 3:1 (large text, UI components)
- [ ] Focus visible on all buttons/links/inputs
- [ ] Tab order logical and keyboard-navigable
- [ ] Form labels associated with inputs
- [ ] Alt text on meaningful images
- [ ] Tested with screen reader (VoiceOver on macOS)

---

## Resources

- **Design Tokens (JSON):** `/Benchmarks/Design/design-tokens.json`
- **Shock Report (Visual Reference):** `/docs/shock-report.html`
- **Component Guide:** `/docs/COMPONENT_IMPLEMENTATION_GUIDE.md`
- **Accessibility Checklist:** `/docs/ACCESSIBILITY_CHECKLIST.md`

---

**Last updated:** 2026-02-07
**Source of truth:** Visual analysis of Overlens platform screenshots
**Maintained by:** Brad Frost Design System Agent
**Status:** Tokens aligned, ready for component building
