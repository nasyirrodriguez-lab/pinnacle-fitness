# Claude Code Documentation

This file contains documentation for working with Claude Code on The Worx project.

---

## SEO Expert Guidelines

When working on content, copy, meta descriptions, page structure, or any text that will be visible to users or search engines, apply these SEO principles. This section serves as your "SEO expert brain" for The Worx.

### Brand Identity & Vision

**The Worx** is more than a coworking space—it's an **entrepreneurial ecosystem** in Trinidad and Tobago that fosters community, collaboration, and innovation.

**Core philosophy** (inspired by Kauffman's Ecosystem Playbook):

- Entrepreneurship is a community sport, not a solo endeavor
- Trust and collaboration enable successful interaction between entrepreneurs
- Physical spaces create serendipitous collisions between people and ideas
- Diversity in people, ideas, and industries creates a stronger ecosystem
- Champions and connectors build momentum through community events and advocacy

**Brand voice:**

- Welcoming, professional, yet approachable
- Caribbean-proud but globally-minded
- Emphasizes community and collaboration over transactional workspace rental
- Speaks to ambition, growth, and possibility

### Target Audiences

**Primary (desk buyers):**

1. **Remote workers** - Employed by international companies, need reliable internet and professional environment
2. **Freelancers & solopreneurs** - Designers, developers, consultants, content creators
3. **Early-stage startups** - 1-5 person teams needing flexible, affordable office space
4. **Digital nomads** - International remote workers visiting Trinidad

**Secondary (ecosystem participants):**

- Corporate teams needing meeting rooms or off-site spaces
- Event organizers seeking unique venues
- Mentors, investors, and service providers serving entrepreneurs
- Educational institutions and students exploring entrepreneurship

### Keyword Strategy

**Primary keywords** (high intent, core offerings):

- coworking space Trinidad
- coworking Port of Spain
- shared office space Trinidad
- hot desk Trinidad
- office space for rent Port of Spain
- meeting room rental Trinidad

**Secondary keywords** (product-specific):

- dedicated desk Trinidad
- private office Port of Spain
- podcast studio Trinidad
- event space Port of Spain
- virtual office Trinidad

**Long-tail keywords** (ecosystem/community):

- entrepreneur community Trinidad
- startup ecosystem Caribbean
- remote work Trinidad
- freelancer workspace Port of Spain
- business networking Trinidad
- creative workspace Caribbean

**Location modifiers** to use:

- Trinidad, Trinidad and Tobago, Port of Spain, Long Circular Road
- Caribbean (for regional reach)

### Content Guidelines

**Headlines & titles:**

- Lead with benefit or outcome, not features
- Include location naturally when possible
- Use action verbs: "Work", "Build", "Connect", "Grow"

**Body copy principles:**

- Address pain points first (isolation, unreliable internet, unprofessional meeting spaces)
- Emphasize community and connection alongside practical amenities
- Use "you" and "your" to speak directly to the reader
- Include social proof when available (member testimonials, company logos)
- Balance practical benefits with aspirational messaging

**Meta descriptions:**

- 150-160 characters
- Include primary keyword naturally
- End with value proposition or call-to-action
- Make them compelling enough to click

**Alt text for images:**

- Describe the scene naturally
- Include relevant keywords where appropriate (not stuffed)
- Example: "Entrepreneurs collaborating at hot desk area in The Worx coworking space, Port of Spain"

### Technical SEO Requirements

**Page structure:**

- One H1 per page (clear, keyword-rich)
- Logical H2/H3 hierarchy
- Short paragraphs for readability
- Internal links to related pages

**Performance:**

- Optimize images (WebP format, lazy loading)
- Minimize JavaScript blocking
- Target Core Web Vitals thresholds

**Structured data** (already implemented):

- CoworkingSpace schema on homepage
- Ensure all pages have appropriate OpenGraph and Twitter cards
- Consider adding FAQ schema for FAQ sections
- Consider adding Event schema for future events

**Local SEO:**

- Consistent NAP (Name, Address, Phone) across site
- Google Business Profile alignment
- Location-specific landing pages if expanding

### Messaging Pillars

Use these themes throughout content:

1. **Community & Connection** - "You're not just renting a desk, you're joining a community of builders"
2. **Professional Environment** - Reliable internet, meeting rooms, professional address
3. **Flexibility** - Hot desks to private offices, scale as you grow
4. **Caribbean Entrepreneurship** - Part of the growing Trinidad/Caribbean startup ecosystem
5. **Productivity & Focus** - Escape home distractions, get real work done
6. **Networking & Opportunity** - Serendipitous connections, events, mentorship

### Competitor Differentiation

When writing copy, emphasize what makes The Worx unique:

- Community-first approach (not just a landlord)
- Entrepreneurial ecosystem mindset
- Events, workshops, and networking built-in
- Caribbean location with global connectivity
- Podcast studio and creative amenities

### SEO Checklist for New Pages

When creating or updating any page:

- [ ] Unique, descriptive title tag with primary keyword
- [ ] Compelling meta description (150-160 chars)
- [ ] One clear H1 that matches page intent
- [ ] Logical heading hierarchy (H2, H3)
- [ ] Internal links to related pages
- [ ] External links to authoritative sources (if relevant)
- [ ] Alt text on all images
- [ ] OpenGraph image and metadata
- [ ] Mobile-responsive design
- [ ] Fast page load (<3s)
- [ ] Clear CTA (call-to-action)

---

## Project Overview

The Worx is a coworking space website built with:

- **Framework**: Next.js 16.0.10 (App Router)
- **Language**: TypeScript 5.7.2 (strict mode)
- **Styling**: Tailwind CSS v4.1.17
- **Components**: shadcn/ui component library
- **Forms**: React Hook Form + Zod validation
- **Fonts**: Sen (body), Unbounded (headings) via next/font/google
- **Storybook**: 10.1.4 for component documentation

## Design System

The project uses a custom design system with:

- **Brand colors**: 10 official brand colors in OKLCH format with full 50-950 scales
- **Primary color**: Turquoise - used for primary buttons, active states, and accents
- **Semantic tokens**: shadcn tokens (`primary`, `secondary`, `accent`, `destructive`, `muted`) mapped to brand colors
- **Neutral scale**: Full gray palette (50-950) for UI elements
- **Subtle rounded corners**: Soft border radius (`--radius: 0.5rem`) for a friendly feel
- **Typography**: Sen for body text, Unbounded for headings

### Brand Colors

All colors are defined in OKLCH format for perceptually uniform tint generation.

| Color               | CSS Variable         | Tailwind Class   | Usage                       |
| ------------------- | -------------------- | ---------------- | --------------------------- |
| Turquoise (Primary) | `--brand-turquoise`  | `turquoise-500`  | Primary buttons, active nav |
| Lime                | `--brand-lime`       | `lime-500`       | Accent highlights           |
| Dark Orange         | `--brand-darkOrange` | `darkOrange-500` | Collaboration theme         |
| Orange              | `--brand-orange`     | `orange-500`     | Event space theme           |
| Green               | `--brand-green`      | `green-500`      | Success states              |
| Dark Blue           | `--brand-darkBlue`   | `darkBlue-500`   | Secondary accents           |
| Blue                | `--brand-blue`       | `blue-500`       | Links, info states          |
| Slate               | `--brand-slate`      | `slate-500`      | Subtle accents              |
| Pink                | `--brand-pink`       | `pink-500`       | Decorative                  |
| Red (Destructive)   | `--brand-red`        | `red-500`        | Errors, destructive actions |

### Usage

```tsx
// Semantic tokens (preferred for components)
<Button className="bg-primary text-primary-foreground" />
<Alert className="bg-destructive" />

// Direct brand colors (each has 50-950 scale)
<div className="bg-turquoise-500" />
<div className="bg-lime-100" />
<div className="border-darkOrange-500" />
```

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # Reusable components
│   ├── ui/          # shadcn/ui components (button, input, dialog, etc.)
│   ├── ctas/        # Call-to-action components
│   ├── faqs/        # FAQ components
│   ├── header/      # Site header
│   ├── footer/      # Site footer
│   ├── logo/        # Logo components
│   └── ...
├── views/           # Page view components
│   ├── home-view/   # Home page sections
│   ├── pricing-view/
│   └── ...
├── theme/           # Theme configuration
│   ├── globals.css  # Tailwind config with @theme directive
│   └── theme-colors.stories.tsx  # Storybook color palette
├── providers/       # React context providers
├── lib/             # Utility functions and schemas
│   ├── fonts.ts     # Next.js font configuration
│   └── schemas/     # Zod validation schemas
└── constants/       # App constants
```

## Node Version Requirements

- **Node**: 22.x
- **npm**: 10.x or 11.x

Use nvm to switch versions:

```bash
nvm use 22
```

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type checking
npx tsc --noEmit

# Storybook
npm run storybook         # Start Storybook dev server
npm run build-storybook   # Build Storybook for production
```

## Key Files

### Configuration

- `postcss.config.mjs` - PostCSS configuration for Tailwind v4
- `tsconfig.json` - TypeScript configuration
- `next.config.mjs` - Next.js configuration
- `components.json` - shadcn/ui configuration
- `.storybook/` - Storybook configuration

### Theme

- `src/theme/globals.css` - Tailwind v4 theme with @theme directive, all color palettes
- `src/lib/fonts.ts` - Next.js Google Fonts configuration (Sen, Unbounded)

### Core Utilities

- `src/lib/utils.ts` - cn() utility for class merging
- `src/lib/schemas/` - Zod validation schemas

### API Routes

- `src/pages/api/signup.ts` - Form submission handler (Google Sheets integration)

## Design System Usage

### Colors

All colors are defined in `src/theme/globals.css` with the `@theme` directive. Each palette has 11 shades (50-950).

**Available palettes**: neutral, lime, turquoise, darkOrange, orange, green, darkBlue, blue, slate, pink, red

**Usage**:

```tsx
// Tailwind classes
<div className="bg-turquoise-500 text-neutral-900" />
<div className="bg-lime-100 border-lime-500" />

// CSS variables (for dynamic values in Storybook or computed styles)
style={{ backgroundColor: 'var(--color-turquoise-500)' }}
```

### Typography

Fonts are loaded via `next/font/google` in `src/lib/fonts.ts` and applied automatically:

- **Body**: Sen (weights: 400, 700) → `font-sans` utility class
- **Headings**: Unbounded (weights: 300, 400, 700, 900) → `font-heading` utility class

**Usage**:

```tsx
<p className="font-sans">Body text</p>
<h1 className="font-heading font-bold">Heading</h1>
```

### Spacing & Layout

- **Spacing**: Tailwind's default spacing scale (1 = 0.25rem, 4 = 1rem, etc.)
- **Containers**: Use Tailwind's container utilities
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)

## Common Patterns

### Component Pattern

```typescript
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  // ... other props
}

export function Component({ className, ...props }: Props) {
  return (
    <div className={cn('base-classes', className)}>
      {/* content */}
    </div>
  )
}
```

### Form Pattern

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { schema } from '@/lib/schemas/...'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... }
})

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

### Storybook Story Pattern

```typescript
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Component } from './component'

const meta = {
  title: 'Category/Component',
  component: Component,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // ... props
  },
}
```

## Git Workflow

### Commit Guidelines

- **Granular commits**: Make small, focused commits that do one thing well
- **No generated tags**: Do not add "Generated with Claude Code" or "Co-Authored-By" tags
- **Lowercase messages**: Use lowercase for commit messages (e.g., "add user auth", not "Add User Auth")
- **Present tense**: Use present tense (e.g., "add feature" not "added feature")
- **Concise**: Keep subject line under 50 characters when possible

**Examples:**

```
add user authentication
fix pricing calculation bug
update header responsive styles
refactor modal provider types
```

### Pre-commit Hooks

The project uses husky + lint-staged to run ESLint and Prettier on staged files before each commit. This ensures code quality without manual intervention.

## Linting & Formatting

### ESLint

- Configuration: `eslint.config.mjs` (flat config format)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
- Includes: Storybook rules, Prettier compatibility

Run manually:

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Prettier

- Configuration: `.prettierrc.json`
- Settings: No semicolons, single quotes, 80 char width, ES5 trailing commas

Run manually:

```bash
npm run prettier       # Format all files
npm run prettier:check # Check formatting
```

## Working with Claude

### Best Practices

1. Reference this file and existing code patterns before starting work
2. Use TypeScript strict mode - all types must be properly defined
3. Follow existing component patterns and file structure
4. Maintain visual consistency with the design system (subtle rounded corners, custom colors)
5. Test responsive behavior at all breakpoints
6. Create Storybook stories for new UI components

### Code Style

- **No redundant comments**: Avoid obvious comments like `{/* Content */}` or `{/* Image */}`. Code should be self-documenting. Only add comments when explaining non-obvious logic.
- **Clean code**: Let the code speak for itself. Well-named variables and components don't need explanatory comments.

### Tech Stack Guidelines

- **Styling**: Use Tailwind utility classes; avoid inline styles except for dynamic CSS variables
- **Colors**: Use Tailwind classes (`bg-turquoise-500`, `bg-lime-500`) or CSS variables for dynamic values (`var(--color-turquoise-500)`)
- **Forms**: Always use React Hook Form with Zod validation
- **Components**: Use shadcn/ui components from `@/components/ui/` as building blocks
- **Fonts**: Automatically applied via font utility classes (`font-sans`, `font-heading`)
- **File naming**: Use kebab-case for directories and files (e.g., `sign-up-form/sign-up-form.tsx`)

## External Integrations

### Google Sheets

Form submissions are sent to Google Sheets via `/api/signup` endpoint.

### Analytics

(To be documented)

## Environment Variables

### Required for Development

Create a `.env.local` file with:

```bash
# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Google Sheets Integration (for sign-up form)
GOOGLE_TYPE=service_account
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
GOOGLE_SPREADSHEET_ID=your-spreadsheet-id
```

## Storybook

Component documentation and visual testing available at `http://localhost:6006` when running `npm run storybook`.

### Available Stories

- **UI/Button** - shadcn/ui button component with all variants
- **Theme/Colors** - Complete color palette grid showing all 11 palettes
- **Brand/Logo** - Logo icon and wordmark components with size and color variations
- **Components/OfferingCard** - Pricing card component with icons and color variations
- **Components/Inclusions** - Amenities section with badge styles and background variations

### Adding New Stories

Place story files in the same directory as the component:

- UI components: `src/components/ui/*.stories.tsx`
- Theme stories: `src/theme/*.stories.tsx`
- Feature components: `src/components/*/*.stories.tsx`

---

Last updated: 2026-01-12
