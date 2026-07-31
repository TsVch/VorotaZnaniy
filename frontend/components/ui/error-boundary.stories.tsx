import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary } from './error-boundary';

/**
 * A child component that throws during render — used to exercise the
 * ErrorBoundary fallback UI in stories.
 */
function ThrowingComponent({ message = 'Something exploded' }: { message?: string }): never {
  throw new Error(message);
}

const meta = {
  title: 'UI/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
// Composite stories use render() with manually composed children, so the
// generic StoryObj<typeof meta> (whose args mirror ErrorBoundary's required
// `children` prop) doesn't match — use the unparameterised StoryObj here.
type Story = StoryObj;

/** Default fallback UI when a child throws */
export const DefaultFallback: Story = {
  render: () => (
    <div className="w-[420px]">
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    </div>
  ),
};

/** Custom fallback passed via the `fallback` prop */
export const CustomFallback: Story = {
  render: () => (
    <div className="w-[420px]">
      <ErrorBoundary
        fallback={
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Custom fallback UI</p>
            <p>This replaces the default error screen.</p>
          </div>
        }
      >
        <ThrowingComponent />
      </ErrorBoundary>
    </div>
  ),
};

/** Healthy children render normally (no error caught) */
export const HealthyChildren: Story = {
  render: () => (
    <div className="w-[420px]">
      <ErrorBoundary>
        <div className="rounded-lg border border-border bg-card p-6 text-sm">
          <p className="font-medium text-foreground">No errors here</p>
          <p className="mt-1 text-muted-foreground">
            This content renders normally because nothing throws.
          </p>
        </div>
      </ErrorBoundary>
    </div>
  ),
};
