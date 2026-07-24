import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Create Account — KnowledgeVault',
  description: 'Create a new KnowledgeVault account',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* ── Logo / Header ────────────────────────────────────────────── */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with KnowledgeVault — secure document delivery with AI
          </p>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
