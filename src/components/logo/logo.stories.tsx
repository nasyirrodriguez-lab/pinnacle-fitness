import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import Icon from './icon'
import Wordmark from './wordmark'

const meta = {
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta

type IconStory = StoryObj<typeof Icon>
type WordmarkStory = StoryObj<typeof Wordmark>

// Icon Stories
export const IconDefault: IconStory = {
  render: () => <Icon size={100} />,
  name: 'Icon - Default',
}

export const IconSizes: IconStory = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Icon size={32} />
        <span className="text-xs text-neutral-600">32px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={48} />
        <span className="text-xs text-neutral-600">48px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={64} />
        <span className="text-xs text-neutral-600">64px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={100} />
        <span className="text-xs text-neutral-600">100px</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={150} />
        <span className="text-xs text-neutral-600">150px</span>
      </div>
    </div>
  ),
  name: 'Icon - Sizes',
}

export const IconColors: IconStory = {
  render: () => (
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-neutral-900" />
        <span className="text-xs text-neutral-600">neutral-900</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-darkOrange-500" />
        <span className="text-xs text-neutral-600">darkOrange-500</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-orange-500" />
        <span className="text-xs text-neutral-600">orange-500</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-lime-500" />
        <span className="text-xs text-neutral-600">lime-500</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-turquoise-500" />
        <span className="text-xs text-neutral-600">turquoise-500</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size={80} className="text-darkBlue-500" />
        <span className="text-xs text-neutral-600">darkBlue-500</span>
      </div>
    </div>
  ),
  name: 'Icon - Colors',
}

export const IconOnDark: IconStory = {
  render: () => (
    <div className="bg-neutral-900 p-12 rounded">
      <div className="flex items-center gap-8">
        <Icon size={80} className="text-white" />
        <Icon size={80} className="text-lime-400" />
        <Icon size={80} className="text-turquoise-400" />
      </div>
    </div>
  ),
  name: 'Icon - On Dark Background',
}

// Wordmark Stories
export const WordmarkDefault: WordmarkStory = {
  render: () => <Wordmark width={400} />,
  name: 'Wordmark - Default',
}

export const WordmarkSizes: WordmarkStory = {
  render: () => (
    <div className="flex flex-col items-start gap-8">
      <div className="flex flex-col gap-2">
        <Wordmark width={200} />
        <span className="text-xs text-neutral-600">200px width</span>
      </div>
      <div className="flex flex-col gap-2">
        <Wordmark width={300} />
        <span className="text-xs text-neutral-600">300px width</span>
      </div>
      <div className="flex flex-col gap-2">
        <Wordmark width={400} />
        <span className="text-xs text-neutral-600">400px width</span>
      </div>
      <div className="flex flex-col gap-2">
        <Wordmark width={500} />
        <span className="text-xs text-neutral-600">500px width</span>
      </div>
    </div>
  ),
  name: 'Wordmark - Sizes',
}

// Combined Usage
export const Combined: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-12">
      {/* Icon + Text */}
      <div className="flex items-center gap-4">
        <Icon size={48} className="text-neutral-900" />
        <h2 className="text-2xl font-heading font-bold">Pinnacle Fitness</h2>
      </div>

      {/* Full Wordmark */}
      <div>
        <Wordmark width={400} />
      </div>

      {/* Icon Only (Small) */}
      <div className="flex items-center gap-2">
        <Icon size={24} className="text-lime-600" />
        <span className="text-sm text-neutral-700">
          Icon as favicon or app icon
        </span>
      </div>
    </div>
  ),
  name: 'Combined Usage Examples',
}
