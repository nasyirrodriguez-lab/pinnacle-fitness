import type { Meta, StoryObj } from '@storybook/nextjs-vite'

const BRAND_COLORS = [
  { name: 'lime', var: '--brand-lime', hex: '#DBE139' },
  { name: 'turquoise', var: '--brand-turquoise', hex: '#54C6DA' },
  { name: 'darkOrange', var: '--brand-darkOrange', hex: '#E64E39' },
  { name: 'orange', var: '--brand-orange', hex: '#FCB432' },
  { name: 'green', var: '--brand-green', hex: '#068067' },
  { name: 'darkBlue', var: '--brand-darkBlue', hex: '#2D4763' },
  { name: 'blue', var: '--brand-blue', hex: '#506FB5' },
  { name: 'slate', var: '--brand-slate', hex: '#96ACD9' },
  { name: 'pink', var: '--brand-pink', hex: '#F8B6B8' },
  { name: 'red', var: '--brand-red', hex: '#E83551' },
]

const NEUTRAL_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const SEMANTIC_COLORS = [
  { name: 'primary', desc: 'Main actions, brand identity' },
  { name: 'secondary', desc: 'Secondary actions, subtle backgrounds' },
  { name: 'accent', desc: 'Highlights, special elements' },
  { name: 'destructive', desc: 'Errors, delete actions' },
  { name: 'muted', desc: 'Subtle text, disabled states' },
]

function ThemeColors() {
  return (
    <div className="p-8 space-y-12">
      <div>
        <h1 className="text-3xl font-heading font-bold mb-2">Theme Colors</h1>
        <p className="text-neutral-600">Brand colors and semantic tokens</p>
      </div>

      <div>
        <h2 className="text-xl font-heading font-bold mb-4">Brand Colors</h2>
        <div className="grid grid-cols-5 gap-4">
          {BRAND_COLORS.map((color) => (
            <div key={color.name}>
              <div
                className="h-24 flex items-end justify-center p-2"
                style={{ backgroundColor: `var(${color.var})` }}
              >
                <span className="text-xs font-mono text-neutral-900 bg-white/80 px-1">
                  {color.hex}
                </span>
              </div>
              <div className="text-sm mt-2 font-medium">{color.name}</div>
              <div className="text-xs font-mono text-neutral-500">
                {color.var}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-heading font-bold mb-4">Neutral Scale</h2>
        <div className="grid grid-cols-11 gap-2">
          {NEUTRAL_SHADES.map((shade) => {
            const isLight = shade < 400
            return (
              <div key={shade}>
                <div
                  className="h-20 flex items-end justify-center p-2"
                  style={{ backgroundColor: `var(--neutral-${shade})` }}
                >
                  <span
                    className={`text-xs font-mono ${isLight ? 'text-neutral-900' : 'text-white'}`}
                  >
                    {shade}
                  </span>
                </div>
                <div className="text-xs text-center mt-1 font-mono text-neutral-600">
                  neutral-{shade}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-heading font-bold mb-4">Semantic Tokens</h2>
        <p className="text-neutral-600 mb-4 text-sm">
          Use these for consistent component styling. They adapt to dark mode.
        </p>
        <div className="grid grid-cols-5 gap-4">
          {SEMANTIC_COLORS.map((token) => (
            <div key={token.name}>
              <div
                className="h-20 flex items-end justify-center p-2"
                style={{ backgroundColor: `var(--${token.name})` }}
              >
                <span className="text-xs font-mono text-neutral-900 bg-white/80 px-1">
                  {token.name}
                </span>
              </div>
              <div className="text-sm mt-2 font-medium">{token.name}</div>
              <div className="text-xs text-neutral-500">{token.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Theme/Colors',
  component: ThemeColors,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ThemeColors>

export default meta
type Story = StoryObj<typeof meta>

export const AllColors: Story = {}
