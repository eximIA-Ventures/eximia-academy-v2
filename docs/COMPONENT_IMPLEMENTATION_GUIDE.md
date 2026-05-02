# Component Implementation Guide

> Building components with the exímIA Academy Design System
> Based on Overlens visual tokens and Atomic Design principles
> Source of Truth: `/Benchmarks/Design/design-tokens.json`

## Overview

This guide walks you through building production-ready components using tokens and atomic design patterns.

---

## Component Structure

All components follow Atomic Design with consistent structure:

```
components/
├── atoms/                 # Single-purpose elements
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.stories.tsx
│   │   └── types.ts
│   ├── Input/
│   ├── Label/
│   └── Icon/
│
├── molecules/            # Simple component combinations
│   ├── FormField/        # Label + Input + Error message
│   ├── Card/
│   ├── MenuItem/
│   └── TextInput/
│
└── organisms/           # Complex feature components
    ├── Form/
    ├── Navigation/
    ├── Modal/
    └── Table/
```

---

## Step-by-Step: Building a Button Component

### Step 1: Create Type Definitions

**File:** `components/atoms/Button/types.ts`

```typescript
import { ReactNode } from 'react'

export type ButtonVariant = 'outline' | 'primary' | 'secondary' | 'danger' | 'transparent'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant
   * @default 'outline' (primary CTA in Overlens)
   */
  variant?: ButtonVariant

  /**
   * Button size
   * @default 'md'
   */
  size?: ButtonSize

  /**
   * Loading state (shows spinner, disables interaction)
   * @default false
   */
  isLoading?: boolean

  /**
   * Icon displayed before text
   */
  icon?: ReactNode

  /**
   * Content (text or ReactNode)
   */
  children: ReactNode
}
```

### Step 2: Define Token Mappings

**File:** `components/atoms/Button/tokens.ts`

```typescript
import tokens from '@/tokens/design-tokens.json'
import { ButtonVariant, ButtonSize } from './types'

// Map variants to canonical token colors
export const variantTokens: Record<ButtonVariant, {
  bg: string
  text: string
  border: string
  hover: string
}> = {
  outline: {
    bg: 'transparent',
    text: tokens.colors.text.primary.value,            // #ffffff
    border: tokens.colors.border.button.value,          // rgba(255,255,255,0.25)
    hover: 'rgba(255, 255, 255, 0.05)',
  },
  primary: {
    bg: tokens.colors.text.primary.value,               // #ffffff
    text: tokens.colors.backgrounds.app.value,          // #0f0f0f
    border: 'none',
    hover: '#e0e0e0',
  },
  secondary: {
    bg: tokens.colors.backgrounds.elevated.value,       // #242424
    text: tokens.colors.text.secondary.value,           // #a0a0a0
    border: tokens.colors.border.medium.value,          // rgba(255,255,255,0.1)
    hover: tokens.colors.backgrounds.hover.value,       // #2a2a2a
  },
  danger: {
    bg: tokens.colors.semantic.error.value,             // #fe4338
    text: tokens.colors.text.primary.value,             // #ffffff
    border: 'none',
    hover: '#ff6f60',
  },
  transparent: {
    bg: 'transparent',
    text: tokens.colors.text.secondary.value,           // #a0a0a0
    border: 'none',
    hover: 'transparent',
  },
}

// Map sizes to spacing tokens
export const sizeTokens: Record<ButtonSize, {
  padding: string
  fontSize: string
  height: string
}> = {
  sm: {
    padding: `${tokens.spacing.scale[1].value} ${tokens.spacing.scale[3].value}`,  // 0.25rem 0.75rem
    fontSize: tokens.typography.fontSizes.xs.value,                                  // 0.75rem
    height: '32px',
  },
  md: {
    padding: `${tokens.spacing.scale[2].value} ${tokens.spacing.scale[5].value}`,  // 0.5rem 1.25rem
    fontSize: tokens.typography.fontSizes.sm.value,                                  // 0.875rem
    height: '40px',
  },
  lg: {
    padding: `${tokens.spacing.scale[3].value} ${tokens.spacing.scale[6].value}`,  // 0.75rem 1.5rem
    fontSize: tokens.typography.fontSizes.base.value,                                // 1rem
    height: '48px',
  },
}
```

### Step 3: Implement Component

**File:** `components/atoms/Button/Button.tsx`

```typescript
import React, { forwardRef } from 'react'
import clsx from 'clsx'
import { ButtonProps } from './types'
import { variantTokens, sizeTokens } from './tokens'
import styles from './Button.module.css'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'outline',
    size = 'md',
    isLoading = false,
    icon,
    className,
    children,
    disabled,
    ...props
  }, ref) => {
    const colors = variantTokens[variant]
    const sizeStyles = sizeTokens[size]
    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(styles.button, className)}
        style={{
          // Layout
          height: sizeStyles.height,
          padding: sizeStyles.padding,
          // Typography
          fontSize: sizeStyles.fontSize,
          fontWeight: 500,
          // Colors
          backgroundColor: colors.bg,
          color: colors.text,
          borderRadius: '6px',   // tokens.border.radius.sm
          border: colors.border === 'none' ? 'none' : `1px solid ${colors.border}`,
          // Interactions
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.4 : 1,
          // Animation
          transition: 'all 200ms ease',
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.hover
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.bg
          }
        }}
        {...props}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        {isLoading ? <span className={styles.spinner}>Loading...</span> : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### Step 4: CSS Modules

**File:** `components/atoms/Button/Button.module.css`

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 500;
  white-space: nowrap;
  outline: none;

  /* Focus state (keyboard navigation) */
  &:focus-visible {
    outline: 2px solid #2a6ab0;   /* accent-blue-mid */
    outline-offset: 2px;
  }
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
}

.spinner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  &::after {
    content: '';
    display: inline-block;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### Step 5: Write Tests

**File:** `components/atoms/Button/Button.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('defaults to outline variant', () => {
    render(<Button>Outline</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveStyle({ backgroundColor: 'transparent' })
  })

  it('respects danger variant', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByText('Delete') as HTMLButtonElement
    expect(btn).toHaveStyle({ backgroundColor: '#fe4338' })
  })

  it('respects size prop', () => {
    render(<Button size="lg">Large Button</Button>)
    const btn = screen.getByText('Large Button') as HTMLButtonElement
    expect(btn).toHaveStyle({ height: '48px' })
  })

  it('disables when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  it('has focus state with keyboard', async () => {
    render(<Button>Focus me</Button>)
    const btn = screen.getByRole('button')
    btn.focus()
    expect(btn).toHaveFocus()
  })
})
```

### Step 6: Storybook Stories

**File:** `components/atoms/Button/Button.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['outline', 'primary', 'secondary', 'danger', 'transparent'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

// All variants in one view
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#0f0f0f', padding: '2rem' }}>
      <Button variant="outline">Outline (CTA)</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Delete</Button>
      <Button variant="transparent">Link Button</Button>
    </div>
  ),
}

// All sizes
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#0f0f0f', padding: '2rem' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

// Default outline button
export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
}

// Loading state
export const Loading: Story = {
  args: {
    children: 'Save',
    isLoading: true,
  },
}

// Disabled state
export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
}
```

### Step 7: Export in Index

**File:** `components/atoms/Button/index.ts`

```typescript
export { Button } from './Button'
export type { ButtonProps } from './types'
```

**File:** `components/atoms/index.ts`

```typescript
export { Button } from './Button'
export { Input } from './Input'
export { Label } from './Label'
export { Icon } from './Icon'
```

---

## Building Molecules (Multi-Component)

Example: `FormField` molecule = Label + Input + Error message

```typescript
// components/molecules/FormField/FormField.tsx

import React from 'react'
import { Label } from '@/components/atoms/Label'
import { Input } from '@/components/atoms/Input'
import tokens from '@/tokens/design-tokens.json'

export interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  [key: string]: any
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, required, ...inputProps }, ref) => {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing.scale[2].value,  // 0.5rem (8px)
      }}>
        <Label htmlFor={inputProps.id || ''} required={required}>
          {label}
        </Label>
        <Input ref={ref} {...inputProps} />
        {error && (
          <span style={{
            fontSize: tokens.typography.fontSizes.xs.value,     // 0.75rem
            color: tokens.colors.semantic.error.value,          // #fe4338
            marginTop: `-${tokens.spacing.scale[1].value}`,    // -0.25rem
          }}>
            {error}
          </span>
        )}
      </div>
    )
  }
)
```

---

## Token Usage Rules

### Always use tokens

```typescript
// WRONG - Hardcoded values
const styles = {
  backgroundColor: '#1e1e1e',
  padding: '16px',
  fontSize: '14px',
  color: '#ffffff'
}

// CORRECT - Token-based
import tokens from '@/tokens/design-tokens.json'

const styles = {
  backgroundColor: tokens.colors.backgrounds.card.value,    // #1e1e1e
  padding: tokens.spacing.scale[4].value,                    // 1rem (16px)
  fontSize: tokens.typography.fontSizes.sm.value,            // 0.875rem (14px)
  color: tokens.colors.text.primary.value,                   // #ffffff
}
```

### Import once, reuse everywhere

```typescript
import tokens from '@/tokens/design-tokens.json'

export const MyComponent = () => {
  const cardBg = tokens.colors.backgrounds.card.value        // #1e1e1e
  const padding = tokens.spacing.scale[4].value               // 1rem
  const fontSize = tokens.typography.fontSizes.base.value     // 1rem
  // ... use these throughout
}
```

### Create token maps for variants

```typescript
const variantStyles = {
  success: { bg: tokens.colors.semantic.success.value, text: '#ffffff' },  // #4b9560
  error: { bg: tokens.colors.semantic.error.value, text: '#ffffff' },      // #fe4338
  warning: { bg: tokens.colors.semantic.warning.value, text: '#ffffff' },  // #f6a609
}
```

---

## Token Reference Quick Guide

### Colors
| Access Path | Value | Description |
|-------------|-------|-------------|
| `colors.backgrounds.app.value` | `#0f0f0f` | App background |
| `colors.backgrounds.card.value` | `#1e1e1e` | Card background |
| `colors.backgrounds.elevated.value` | `#242424` | Elevated surfaces |
| `colors.backgrounds.hover.value` | `#2a2a2a` | Hover state |
| `colors.text.primary.value` | `#ffffff` | Primary text |
| `colors.text.secondary.value` | `#a0a0a0` | Secondary text |
| `colors.text.muted.value` | `#666666` | Muted/placeholder text |
| `colors.accent.blue.mid.value` | `#2a6ab0` | Focus borders, active |
| `colors.semantic.error.value` | `#fe4338` | Error states |
| `colors.semantic.success.value` | `#4b9560` | Success states |
| `colors.border.subtle.value` | `rgba(255,255,255,0.06)` | Subtle borders |
| `colors.border.medium.value` | `rgba(255,255,255,0.1)` | Medium borders |
| `colors.border.button.value` | `rgba(255,255,255,0.25)` | Button borders |

### Spacing
| Access Path | Value |
|-------------|-------|
| `spacing.scale[2].value` | `0.5rem` (8px) |
| `spacing.scale[4].value` | `1rem` (16px) |
| `spacing.scale[6].value` | `1.5rem` (24px) |
| `spacing.scale[8].value` | `2.5rem` (40px) |

### Border Radius
| Access Path | Value |
|-------------|-------|
| `border.radius.sm.value` | `6px` |
| `border.radius.md.value` | `12px` |
| `border.radius.lg.value` | `18px` |
| `border.radius.pill.value` | `100px` |

---

## Testing Checklist

Before committing a component:

- [ ] **Types:** Component props properly typed
- [ ] **Tokens:** Zero hardcoded color/spacing values
- [ ] **Variants:** All variants render correctly
- [ ] **Sizes:** All sizes apply correct spacing
- [ ] **States:** Hover, active, focus, disabled all work
- [ ] **Accessibility:** Tab order logical, labels present
- [ ] **Focus:** Visible focus ring on keyboard nav (2px solid #2a6ab0)
- [ ] **Contrast:** Colors meet WCAG AA minimum
- [ ] **Tests:** >80% code coverage
- [ ] **Lint:** ESLint passes
- [ ] **Types:** TypeScript strict mode passes
- [ ] **Storybook:** Stories render and are documented

---

## Next: Build Atoms

Ready to start building? Follow this sequence:

1. **Button** (foundation for CTAs)
2. **Input** (foundation for forms)
3. **Label** (paired with inputs)
4. **Icon** (visual support)
5. **Card** (layout container)

Then compose molecules, then organisms.

---

**Questions?** Refer to `/docs/PATTERN_LIBRARY.md` for token values.
**Token JSON:** `/Benchmarks/Design/design-tokens.json`
