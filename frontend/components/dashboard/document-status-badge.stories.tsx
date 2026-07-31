import type { Meta, StoryObj } from '@storybook/react';
import DocumentStatusBadge from './document-status-badge';

const meta = {
  title: 'Dashboard/DocumentStatusBadge',
  component: DocumentStatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DocumentStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All three statuses side by side */
export const AllStatuses: StoryObj = {
  render: () => (
    <div className="flex items-center gap-4">
      <DocumentStatusBadge status="PROCESSING" />
      <DocumentStatusBadge status="READY" />
      <DocumentStatusBadge status="ERROR" />
    </div>
  ),
};

/** Processing (amber, animated pulse) */
export const Processing: Story = {
  args: {
    status: 'PROCESSING',
  },
};

/** Ready (green) */
export const Ready: Story = {
  args: {
    status: 'READY',
  },
};

/** Error (red) */
export const Error: Story = {
  args: {
    status: 'ERROR',
  },
};
