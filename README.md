# The Worx

A modern coworking space website for [The Worx](https://theworx.io) in Port of Spain, Trinidad & Tobago.

## About

The Worx is a coworking space designed for entrepreneurs, creatives, innovators, and remote workers. This website serves as the primary platform for showcasing services, pricing, and facilitating member sign-ups.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI primitives + shadcn/ui patterns
- **Forms**: React Hook Form + Zod validation
- **Fonts**: Sen (body), Unbounded (headings)

## Getting Started

### Prerequisites

- Node.js 22.x
- npm 10.x or 11.x

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Available Scripts

| Command             | Description              |
| ------------------- | ------------------------ |
| `npm run dev`       | Start development server |
| `npm run build`     | Build for production     |
| `npm start`         | Run production build     |
| `npm run lint`      | Run ESLint               |
| `npm run lint:fix`  | Fix ESLint issues        |
| `npm run prettier`  | Format code              |
| `npm run storybook` | Start Storybook          |

## Project Structure

```
src/
├── app/              # Next.js pages (App Router)
├── components/       # Reusable UI components
│   ├── ui/          # Base components (Button, Input, Dialog, etc.)
│   ├── ctas/        # Call-to-action buttons
│   ├── header/      # Site navigation
│   └── footer/      # Site footer
├── views/           # Page-level view components
├── theme/           # Tailwind theme configuration
├── lib/             # Utilities and schemas
├── constants/       # Data (services, pricing, etc.)
└── providers/       # React context providers
```

## Environment Variables

Copy `.env.development` to `.env.local` and add required values. See `claude.md` for full documentation.

## Integrations

- **Nexudus**: Membership management and booking
- **Calendly**: Tour scheduling
- **Google Sheets**: Lead capture from sign-up forms

## Documentation

See `claude.md` for detailed development documentation including:

- Design system (colors, typography, spacing)
- Component patterns
- Form handling
- Git workflow and commit conventions

## License

Private - All rights reserved.
