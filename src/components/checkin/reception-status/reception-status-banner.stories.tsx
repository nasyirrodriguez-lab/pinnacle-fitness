import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ReceptionStatusBannerView } from './reception-status-banner'

// Fixed reference epoch so countdowns render deterministically.
const NOW = 1_700_000_000_000

const meta = {
  component: ReceptionStatusBannerView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="bg-neutral-50 min-h-[240px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReceptionStatusBannerView>

export default meta
type Story = StoryObj<typeof meta>

export const Lunch: Story = {
  args: {
    reasonId: 'lunch',
    awaySinceMs: NOW,
    returnAtIso: new Date(NOW + 30 * 60_000).toISOString(),
    secondsLeft: 18 * 60 + 42,
    isOverdue: false,
  },
}

export const InAMeeting: Story = {
  args: {
    reasonId: 'meeting',
    awaySinceMs: NOW,
    returnAtIso: new Date(NOW + 60 * 60_000).toISOString(),
    secondsLeft: 47 * 60 + 5,
    isOverdue: false,
  },
}

export const BathroomBreak: Story = {
  args: {
    reasonId: 'bathroom',
    awaySinceMs: NOW,
    returnAtIso: new Date(NOW + 5 * 60_000).toISOString(),
    secondsLeft: 2 * 60 + 13,
    isOverdue: false,
  },
}

export const Overdue: Story = {
  args: {
    reasonId: 'lunch',
    awaySinceMs: NOW,
    returnAtIso: new Date(NOW + 30 * 60_000).toISOString(),
    secondsLeft: 0,
    isOverdue: true,
  },
}
