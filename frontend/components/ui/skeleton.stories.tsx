import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Basic skeleton building blocks */
export const Basic: Story = {
  render: () => (
    <div className="w-[300px] space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  ),
};

/** Card-shaped skeleton used while document lists load */
export const CardLayout: Story = {
  render: () => (
    <div className="grid w-[420px] grid-cols-1 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-5 w-2/3" />
          </CardTitle>
          <Skeleton className="h-3 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

/** Avatar list skeleton (workspace members) */
export const AvatarList: Story = {
  render: () => (
    <div className="w-[320px] space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  ),
};
