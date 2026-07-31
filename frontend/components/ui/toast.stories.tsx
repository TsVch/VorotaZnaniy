import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  ToastProvider,
  useToastActions,
} from './toast';

/**
 * Demo harness: mounts inside ToastProvider and schedules toasts
 * on mount so the story renders the actual toast stack.
 */
type ToastMessage = {
  variant: 'default' | 'warning' | 'destructive';
  text: string;
};

// Module-level constants — stable references so the effect below runs only
// once (an inline array literal would change identity every render and cause
// an infinite addToast → re-render loop).
const ALL_VARIANTS: ToastMessage[] = [
  { variant: 'default', text: 'Document uploaded successfully.' },
  { variant: 'warning', text: 'Your session will expire soon.' },
  { variant: 'destructive', text: 'Upload failed. Please try again.' },
];

const SUCCESS_ONLY: ToastMessage[] = [
  { variant: 'default', text: 'Settings saved successfully.' },
];

const WARNING_ONLY: ToastMessage[] = [
  { variant: 'warning', text: 'Storage usage is above 90%.' },
];

const DESTRUCTIVE_ONLY: ToastMessage[] = [
  { variant: 'destructive', text: 'Session terminated on another device.' },
];

function ToastDemo({ messages }: { messages: ToastMessage[] }) {
  const { success, warning, error } = useToastActions();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Long duration so toasts are still on screen when the visual
    // screenshot is captured (default auto-dismiss is 5s).
    messages.forEach((m) => {
      if (m.variant === 'default') success(m.text, 60_000);
      if (m.variant === 'warning') warning(m.text, 60_000);
      if (m.variant === 'destructive') error(m.text, 60_000);
    });
  }, []);

  return null;
}

const meta = {
  title: 'UI/Toast',
  component: ToastProvider,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ToastProvider>;

export default meta;
// Composite stories use render() with manually composed children, so the
// generic StoryObj<typeof meta> (whose args mirror ToastProvider's required
// `children` prop) doesn't match — use the unparameterised StoryObj here.
type Story = StoryObj;

/** All three toast variants displayed together */
export const AllVariants: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo messages={ALL_VARIANTS} />
    </ToastProvider>
  ),
};

/** Success toast */
export const Success: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo messages={SUCCESS_ONLY} />
    </ToastProvider>
  ),
};

/** Warning toast */
export const Warning: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo messages={WARNING_ONLY} />
    </ToastProvider>
  ),
};

/** Destructive (error) toast */
export const Destructive: Story = {
  render: () => (
    <ToastProvider>
      <ToastDemo messages={DESTRUCTIVE_ONLY} />
    </ToastProvider>
  ),
};
