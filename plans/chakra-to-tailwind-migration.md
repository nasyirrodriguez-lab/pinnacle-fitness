# Chakra UI to Tailwind CSS + shadcn/ui Migration Plan

**Project**: The Worx Coworking Space Website
**Date**: 2025-12-08
**Migration Type**: Complete framework replacement

## Overview

Complete migration from Chakra UI v3 to Tailwind CSS + shadcn/ui + React Hook Form + Zod for The Worx website. This affects 22 files across the codebase.

## Tech Stack Changes

- **Remove**: @chakra-ui/react, @emotion/react
- **Add**: tailwindcss, shadcn/ui (Radix UI based), react-hook-form, zod
- **Keep**: next-themes (for dark mode), existing fonts (Sen, Unbounded)

## Key Design System Requirements

- **Colors**: 11 custom palettes with 10 shades each (neutral, darkOrange, orange, green, limeGreen, turquoise, darkBlue, slate, blue, pink, red)
- **Typography**: Sen (body), Unbounded (heading)
- **Sharp corners**: border-radius: 0 everywhere
- **Button variants**: primary, secondary, solid, outline with sizes sm/md/lg/xl
- **Input styling**: 2px borders, white background, neutral color borders

## Migration Phases

### Phase 1: Setup & Configuration (Foundation)

1. **Install dependencies**

   ```bash
   npm uninstall @chakra-ui/react @emotion/react
   npm install -D tailwindcss postcss autoprefixer
   npm install tailwindcss-animate class-variance-authority clsx tailwind-merge
   npm install @radix-ui/react-slot lucide-react
   npm install react-hook-form @hookform/resolvers zod
   npm install @radix-ui/react-dialog @radix-ui/react-accordion @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-tooltip
   npx tailwindcss init -p
   ```

2. **Create core files**

   - `tailwind.config.ts` - All 11 color palettes, fonts, sharp corners (--radius: 0rem)
   - `src/app/globals.css` - CSS variables, base styles, overflow-x-hidden
   - `src/lib/utils.ts` - cn() utility function
   - `src/lib/color-variants.ts` - Helper for dynamic colorPalette prop replacement
   - `components.json` - shadcn/ui configuration

3. **Install shadcn/ui components**

   ```bash
   npx shadcn-ui@latest init
   npx shadcn-ui@latest add button input select dialog toast card accordion alert label form
   ```

4. **Customize shadcn components**
   - `src/components/ui/button.tsx` - Match Chakra's button recipe (sharp corners, bold, 4 sizes, 4 variants)
   - `src/components/ui/input.tsx` - Match Chakra's input recipe (2px border, white bg, neutral borders)

### Phase 2: Component Migration (22 files)

**Migration order (dependencies first):**

1. **Logo components** (no Chakra deps)

   - `src/ui/logo/icon.tsx`
   - `src/ui/logo/wordmark.tsx`

2. **Offering card icons** (no deps)

   - `src/ui/offering-card/icons/day-pass.tsx`
   - `src/ui/offering-card/icons/private-office.tsx`
   - `src/ui/offering-card/icons/single-desk.tsx`
   - `src/ui/offering-card/icons/your-desk.tsx`

3. **Simple components**

   - `src/ui/offering-card/offering-card.tsx`
   - `src/components/page-header/page-header.tsx`

4. **Form with RHF + Zod** ⭐ CRITICAL

   - Create `src/lib/schemas/signup.ts` (Zod schema)
   - Migrate `src/components/sign-up-form/sign-up-form.tsx` to React Hook Form

5. **Modal & CTAs**

   - `src/components/sign-up-modal/sign-up-modal.tsx` (use shadcn Dialog)
   - `src/components/ctas/ctas.tsx`

6. **Layout components**

   - `src/ui/header/header.tsx`
   - `src/ui/footer/footer.tsx`

7. **Feature components**

   - `src/components/faqs/faqs.tsx`
   - `src/components/inclusions/inclusions.tsx`

8. **View components** (8 files)

   - `src/views/home-view/hero.tsx` ⚠️ Complex pseudo-elements
   - `src/views/home-view/offerings.tsx`
   - `src/views/home-view/vision.tsx`
   - `src/views/home-view/home-view.tsx`
   - `src/views/pricing-view/pricing-view.tsx`
   - `src/views/contact-view/contact-view.tsx`
   - `src/views/services-view/services-view.tsx`
   - `src/views/bank-details-view/bank-details-view.tsx`

9. **Providers & Layout**
   - `src/providers/theme-provider.tsx` (create new - wraps next-themes)
   - `src/providers/modal-provider/modal-provider.tsx` (keep logic, use shadcn Dialog)
   - `src/providers/index.tsx` (update to use ThemeProvider, Toaster)
   - `src/app/layout.tsx` (import globals.css, wrap with Providers)

### Phase 3: Cleanup

1. **Delete old files**

   - `src/theme/index.ts`
   - `src/components/ui/provider.tsx` (old Chakra)
   - `src/components/ui/color-mode.tsx` (old Chakra)
   - `src/components/ui/tooltip.tsx` (old Chakra)
   - `src/components/ui/toaster.tsx` (old Chakra)

2. **Clean dependencies**
   ```bash
   npm uninstall @chakra-ui/react @emotion/react
   rm package-lock.json && npm install
   ```

## Critical Migration Patterns

### Chakra → Tailwind Mappings

```typescript
// Box → div
<Box py={16} px={12} bg="limeGreen.500">
<div className="py-16 px-12 bg-limeGreen-500">

// Grid Layout
<Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

// HStack/VStack
<HStack gap={4} alignItems="center">
<div className="flex items-center gap-4">

<VStack gap={2} alignItems="start">
<div className="flex flex-col items-start gap-2">

// Responsive typography
<Heading size={{ base: 'lg', lg: 'xl' }} color="neutral.900">
<h1 className="text-lg lg:text-xl text-neutral-900 font-heading">

// Pseudo-selectors
_hover={{ bg: 'neutral.100' }} → hover:bg-neutral-100
_focus={{ borderColor: 'neutral.900' }} → focus:border-neutral-900
_before={{ ... }} → before:absolute before:content-[''] before:...
```

### Dynamic Color Palette Challenge

**Problem**: Chakra's `colorPalette` prop allows dynamic colors. Tailwind requires static classes.

**Solution**: Use the `color-variants.ts` helper:

```typescript
// Create variants mapping
const colorVariants = {
  limeGreen: 'bg-limeGreen-500 hover:bg-limeGreen-600',
  darkOrange: 'bg-darkOrange-500 hover:bg-darkOrange-600',
  // ... all palettes
}

// Usage
<Button className={colorVariants[color]}>Click</Button>
```

### Complex Example: Hero Component

**Before (Chakra):**

```tsx
<Box
  position="relative"
  background={{ base: 'neutral.900', lg: 'white' }}
  _before={{
    position: 'absolute',
    top: -150,
    display: { base: 'none', lg: 'block' },
    background: 'limeGreen.500',
    content: '""',
    clipPath: 'polygon(55% 0%, 100% 0%, 100% 100%, 45% 100%)',
  }}
>
```

**After (Tailwind):**

```tsx
<div className="relative bg-neutral-900 lg:bg-white before:absolute before:top-[-150px] before:hidden lg:before:block before:bg-limeGreen-500 before:content-[''] before:[clip-path:polygon(55%_0%,100%_0%,100%_100%,45%_100%)]">
```

## Form Migration: SignUpForm (React Hook Form + Zod)

### 1. Create Zod Schema

**File**: `src/lib/schemas/signup.ts`

```typescript
import { z } from 'zod'

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  tel: z.string().optional(),
  age: z.string().min(1, 'Please select your age range'),
  membership: z.string().min(1, 'Please select a membership type'),
})

export type SignupFormData = z.infer<typeof signupSchema>
```

### 2. Update SignUpForm Component

**Key changes:**

- Replace `useState` hooks with `useForm` from RHF
- Use `zodResolver` for validation
- Replace `Field.Root/Field.Label` with shadcn `FormField/FormItem/FormLabel`
- Replace `NativeSelect` with shadcn `Select`
- Keep same state management (idle/submitting/error/success)
- Keep same API integration (`/api/signup`)

## Testing Checklist

### Visual Regression

- [ ] Compare screenshots before/after migration
- [ ] Verify all 11 color palettes render correctly
- [ ] Check all responsive breakpoints (base, md, lg, xl)
- [ ] Test hover states on all interactive elements
- [ ] Verify fonts (Sen, Unbounded) load correctly

### Functional Testing

- [ ] Header navigation works
- [ ] Footer links work
- [ ] Sign-up form validation (required fields, email format)
- [ ] Form submission success/error states
- [ ] Modal opens/closes correctly
- [ ] All CTAs navigate properly

### Build Test

```bash
npm run build  # Must succeed with no errors
```

## Success Criteria

- ✅ All pages render visually identical to Chakra version
- ✅ All interactions (forms, modals, navigation) work correctly
- ✅ Form validation works with proper error messages
- ✅ Responsive design works across all breakpoints
- ✅ `npm run build` succeeds with no errors
- ✅ No Chakra or Emotion imports remain in codebase
- ✅ Bundle size reduced (Chakra ~100KB + Emotion ~50KB removed)
