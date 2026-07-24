import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          KnowledgeVault SaaS
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Secure document delivery and interactive learning platform.
          Protect your digital content with DRM, enhance it with AI.
        </p>
        <div className="mt-10">
          <Link
            href="/docs/README.md"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            View Documentation
          </Link>
        </div>
      </div>
    </main>
  );
}
