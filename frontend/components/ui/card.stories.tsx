import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from './card';
import { Button } from './button';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Minimal card with just content */
export const Default: Story = {
  render: () => (
    <div className="w-[360px]">
      <Card>
        <CardContent>Simple card content with no header or footer.</CardContent>
      </Card>
    </div>
  ),
};

/** Standard card: header, description, content and footer */
export const WithHeaderAndFooter: Story = {
  render: () => (
    <div className="w-[360px]">
      <Card>
        <CardHeader>
          <CardTitle>Annual Report 2025</CardTitle>
          <CardDescription>
            Financial summary for the fiscal year.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium">$2.4M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Documents</span>
              <span className="font-medium">128</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm">
            View details
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

/** Compact card (size="sm") */
export const Compact: Story = {
  render: () => (
    <div className="w-[300px]">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Quick stats</CardTitle>
        </CardHeader>
        <CardContent>Compact variant with tighter spacing.</CardContent>
        <CardFooter>
          <span className="text-xs text-muted-foreground">
            Updated 2 minutes ago
          </span>
        </CardFooter>
      </Card>
    </div>
  ),
};

/** Card with an action button in the header */
export const WithAction: Story = {
  render: () => (
    <div className="w-[380px]">
      <Card>
        <CardHeader>
          <CardTitle>Workspace settings</CardTitle>
          <CardAction>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          Configure your workspace name, slug, and access policies.
        </CardContent>
      </Card>
    </div>
  ),
};
