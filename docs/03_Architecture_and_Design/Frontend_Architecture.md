```markdown
# Frontend Architecture

> **This document defines the client-side architecture, technology stack, and specific implementation strategies for the secure viewer.**
> 
> **Related Documents:** 
> - [System Architecture](./System_Architecture.md)
> - [Backend Architecture](./Backend_Architecture.md)
> - [Database Design](./Database_Design.md)
> - [API Contracts](./API_Contracts.md)
> - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
> - [Performance Requirements](../06_Quality_and_Standards/Performance_Requirements.md)
> - [Project Structure](../06_Quality_and_Standards/Project_Structure.md)

---

## 🎯 Architectural Decision Summary

| Aspect | Decision | Rationale | ADR Reference |
| :--- | :--- | :--- | :--- |
| Framework | Next.js 14+ (App Router) | SSR/SSG, excellent DX, strong ecosystem | ADR-008 |
| Language | TypeScript (strict) | Type safety, better refactoring, shared types | ADR-009 |
| Styling | Tailwind CSS + shadcn/ui | Rapid development, consistent design, a11y | ADR-010 |
| Server State | TanStack Query v5 | Caching, deduplication, background refetch | ADR-011 |
| Client State | Zustand | Lightweight, minimal boilerplate | ADR-012 |
| Secure Rendering | PDF.js → Canvas | Prevents direct file access, enables watermarking | ADR-004 |
| Form Validation | Zod + React Hook Form | Type-safe schemas, excellent UX | ADR-013 |

---

## 🛠️ Technology Stack

### Core Framework

- **Framework**: **Next.js 14+** with App Router
- **Why Next.js?**:
  - Excellent SSR/SSG for marketing pages and SEO
  - Robust, type-safe environment for dashboard
  - Built-in image optimization and routing
  - Strong ecosystem and community support
  - Middleware support for auth and routing logic
  - Server Components for reduced client bundle size

### Language

- **TypeScript** (Strict mode enabled)
- All components, hooks, and utilities fully typed.
- Shared types with backend via OpenAPI code generation (future enhancement).
- Strict null checks and no implicit any.

### Styling

- **Tailwind CSS**: Utility-first CSS framework for rapid, consistent styling.
- **shadcn/ui**: High-quality, accessible component library built on Radix UI.
- **Why this combination?**:
  - Consistent design system out of the box.
  - Excellent accessibility (a11y) support.
  - Rapid development with minimal custom CSS.
  - Copy-paste component model (no lock-in).
  - Dark mode support built-in.

### State Management

#### Server State (TanStack Query v5)
- Caching, deduplication, background refetching.
- Optimistic updates for better UX.
- Automatic garbage collection of stale data.
- Prefetching for smooth navigation.
- Infinite scrolling support for lists.

```typescript
// Example: Document fetching with TanStack Query
const useDocuments = (workspaceId: string) => {
  return useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => api.documents.list(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

#### Client State (Zustand)
- Lightweight, minimal boilerplate for ephemeral UI state.
- **Use cases**:
  - Current viewer page number.
  - UI toggles (sidebar open/closed).
  - Temporary form data.
  - Viewer zoom level.
  - Modal visibility.

```typescript
// Example: Viewer state with Zustand
interface ViewerState {
  currentPage: number;
  zoom: number;
  sidebarOpen: boolean;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  toggleSidebar: () => void;
}

const useViewerStore = create<ViewerState>((set) => ({
  currentPage: 1,
  zoom: 100,
  sidebarOpen: true,
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

### Secure Rendering

- **PDF.js** (customized fork) or **react-pdf**:
  - Configured to render pages to HTML5 `<canvas>` elements.
  - **Never** uses native `<iframe>` or `<object>` tags (security risk).
  - Custom text layer for controlled selection (with watermark injection).

### Form Handling

- **React Hook Form**: Performant, flexible form library.
- **Zod**: TypeScript-first schema validation.
- Integration via `@hookform/resolvers/zod`.

```typescript
// Example: Form with validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

---

## 📁 Project Structure

```text
frontend/
├── app/                               # Next.js App Router
│   ├── (auth)/                        # Authentication Routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                   # Creator Dashboard
│   │   ├── documents/
│   │   │   ├── page.tsx               # Document list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx           # Document details
│   │   │   │   ├── analytics/
│   │   │   │   │   └── page.tsx       # Analytics view
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx       # Protection settings
│   │   │   └── upload/
│   │   │       └── page.tsx           # Upload flow
│   │   ├── settings/
│   │   │   ├── page.tsx               # Workspace settings
│   │   │   └── billing/
│   │   │       └── page.tsx           # Subscription management
│   │   └── layout.tsx
│   │
│   ├── (viewer)/                      # Secure Viewer (Buyer)
│   │   ├── library/
│   │   │   └── page.tsx               # User's document library
│   │   ├── view/
│   │   │   └── [documentId]/
│   │   │       └── page.tsx           # Secure document viewer
│   │   └── layout.tsx
│   │
│   ├── (marketing)/                   # Public Marketing Pages
│   │   ├── page.tsx                   # Landing page
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   ├── features/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/                           # API Routes (webhooks only)
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts
│   │
│   ├── layout.tsx                     # Root Layout
│   ├── providers.tsx                  # Global Providers (Query, Auth, Theme)
│   └── globals.css                    # Global styles
│
├── components/                        # Reusable Components
│   ├── ui/                            # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── ...
│   │
│   ├── viewer/                        # Secure Viewer Components
│   │   ├── SecureViewer.tsx           # Main viewer wrapper
│   │   ├── CanvasRenderer.tsx         # Canvas rendering logic
│   │   ├── WatermarkOverlay.tsx       # Dynamic watermark
│   │   ├── ViewerControls.tsx         # Zoom, page navigation
│   │   ├── AIAssistant.tsx            # AI chat sidebar
│   │   ├── TextLayer.tsx              # Controlled text selection
│   │   └── SessionGuard.tsx           # Session validation
│   │
│   ├── dashboard/                     # Dashboard Components
│   │   ├── DocumentCard.tsx
│   │   ├── UploadDropzone.tsx
│   │   ├── AnalyticsChart.tsx
│   │   ├── ProtectionSettings.tsx
│   │   └── StatsOverview.tsx
│   │
│   ├── auth/                          # Auth Components
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── OAuthButtons.tsx
│   │
│   └── shared/                        # Shared Components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       └── EmptyState.tsx
│
├── hooks/                             # Custom React Hooks
│   ├── useAuth.ts                     # Authentication hook
│   ├── useDocument.ts                 # Document data fetching
│   ├── useViewer.ts                   # Viewer state management
│   ├── useAI.ts                       # AI assistant hook
│   ├── useSessionHeartbeat.ts         # Session validation
│   ├── useDebounce.ts                 # Debounce utility
│   └── useLocalStorage.ts             # Local storage hook
│
├── lib/                               # Utility Functions & Config
│   ├── api/                           # API Client
│   │   ├── client.ts                  # Fetch wrapper with auth
│   │   ├── endpoints.ts               # API endpoint definitions
│   │   ├── types.ts                   # API response types
│   │   └── errors.ts                  # Error handling
│   │
│   ├── utils/                         # Utility Functions
│   │   ├── cn.ts                      # Tailwind class merger
│   │   ├── format.ts                  # Date/number formatters
│   │   ├── validation.ts              # Validation schemas (Zod)
│   │   └── constants.ts               # App-wide constants
│   │
│   └── config/                        # Configuration
│       ├── env.ts                     # Environment variables
│       └── site.ts                    # Site metadata
│
├── stores/                            # Zustand Stores
│   ├── viewerStore.ts                 # Viewer state
│   ├── uiStore.ts                     # UI state (sidebar, modals)
│   └── authStore.ts                   # Auth state (if needed)
│
├── types/                             # TypeScript Type Definitions
│   ├── document.ts
│   ├── user.ts
│   ├── api.ts
│   └── viewer.ts
│
├── styles/
│   └── globals.css
│
├── public/                            # Static Assets
│   ├── images/
│   ├── fonts/
│   └── icons/
│
├── tests/                             # Test Files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.local.example                 # Environment Variables Template
├── next.config.js                     # Next.js Configuration
├── tailwind.config.ts                 # Tailwind Configuration
├── tsconfig.json                      # TypeScript Configuration
├── postcss.config.js                  # PostCSS Configuration
└── package.json                       # Dependencies & Scripts
```

---

## 🛡️ Secure Viewer Implementation Strategy

The secure viewer is the most critical frontend component. It must balance protection with UX.

### 1. Canvas Rendering

Documents are rendered as images on a `<canvas>` element.

**Benefits**:
- Prevents native browser "Save As" functionality.
- Makes text selection/copying controllable.
- Enables dynamic watermark overlay.

```typescript
// components/viewer/CanvasRenderer.tsx
interface CanvasRendererProps {
  documentId: string;
  pageNumber: number;
  onRenderComplete?: () => void;
}

const CanvasRenderer: React.FC<CanvasRendererProps> = ({ 
  documentId, 
  pageNumber,
  onRenderComplete 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const renderPage = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fetch secure page image via presigned URL
      const imageUrl = await api.viewer.getPageUrl(documentId, pageNumber);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Required for canvas manipulation
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        onRenderComplete?.();
      };

      img.src = imageUrl;
    };

    renderPage();
  }, [documentId, pageNumber]);

  return <canvas ref={canvasRef} className="max-w-full h-auto" />;
};
```

### 2. Dynamic Watermark Overlay

A semi-transparent, absolutely positioned `<div>` is rendered **on top** of the canvas. Contains: user's email, user ID, and current timestamp.

```typescript
// components/viewer/WatermarkOverlay.tsx
interface WatermarkOverlayProps {
  userEmail: string;
  userId: string;
  sessionId: string;
}

const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ 
  userEmail, 
  userId,
  sessionId 
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const timestamp = new Date().toISOString().split('T')[0];

  // Subtle movement based on mouse position (anti-screenshot)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      setOffset({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: 'transform 0.3s ease-out',
      }}
    >
      <div className="absolute inset-0 flex flex-wrap gap-20 opacity-20 rotate-45">
        {Array.from({ length: 30 }).map((_, i) => (
          <div 
            key={i} 
            className="text-xs text-gray-500 whitespace-nowrap"
            style={{ transform: `rotate(-45deg)` }}
          >
            {userEmail} | {timestamp} | {sessionId.slice(0, 8)}
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Anti-Screenshot Measures
- The watermark grid subtly shifts/rotates based on mouse movement or scroll position.
- Makes it difficult to cleanly crop out in a screenshot.
- Watermark includes unique session ID for leak tracing.

### 3. DOM Protection

```typescript
// components/viewer/SecureViewer.tsx
const SecureViewer: React.FC<SecureViewerProps> = ({ documentId }) => {
  const { user } = useAuth();
  const { session } = useViewer(documentId);

  // Disable right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Disable text selection (unless explicitly allowed)
  const viewerStyles: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
  };

  // If text selection is allowed, append watermark to copied text
  const handleCopy = (e: React.ClipboardEvent) => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText && user) {
      const watermark = `\n\n---\nCopied from KnowledgeVault\nUser: ${user.email}\nSession: ${session?.id}\nTimestamp: ${new Date().toISOString()}`;
      e.clipboardData.setData('text/plain', selectedText + watermark);
      e.preventDefault();
    }
  };

  // Disable keyboard shortcuts for saving/printing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's' || e.key === 'p') {
        e.preventDefault();
      }
    }
  };

  return (
    <div 
      className="relative w-full h-full"
      style={viewerStyles}
      onContextMenu={handleContextMenu}
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
    >
      <CanvasRenderer documentId={documentId} pageNumber={currentPage} />
      <WatermarkOverlay 
        userEmail={user?.email || ''}
        userId={user?.id || ''}
        sessionId={session?.id || ''}
      />
    </div>
  );
};
```

### 4. Session Heartbeat

Frontend sends a lightweight heartbeat every 60 seconds. If backend detects session violation (e.g., login from 3rd device), it revokes the token. Frontend immediately displays "Session Terminated" screen.

```typescript
// hooks/useSessionHeartbeat.ts
export const useSessionHeartbeat = (documentId: string, sessionId: string) => {
  const [sessionValid, setSessionValid] = useState(true);
  const [showTerminatedModal, setShowTerminatedModal] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await api.viewer.heartbeat(documentId, sessionId);
        if (!response.valid) {
          setSessionValid(false);
          setShowTerminatedModal(true);
        }
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    };

    const interval = setInterval(validateSession, 60000); // 60 seconds
    
    // Initial validation
    validateSession();

    return () => clearInterval(interval);
  }, [documentId, sessionId]);

  return { sessionValid, showTerminatedModal, setShowTerminatedModal };
};
```

### 5. Controlled Text Selection (Optional)

If the creator allows text selection, we provide a custom text layer with watermark injection.

```typescript
// components/viewer/TextLayer.tsx
interface TextLayerProps {
  documentId: string;
  pageNumber: number;
  allowSelection: boolean;
}

const TextLayer: React.FC<TextLayerProps> = ({ 
  documentId, 
  pageNumber,
  allowSelection 
}) => {
  const [textItems, setTextItems] = useState<TextItem[]>([]);

  useEffect(() => {
    if (!allowSelection) return;

    const loadTextLayer = async () => {
      const textData = await api.viewer.getTextLayer(documentId, pageNumber);
      setTextItems(textData.items);
    };

    loadTextLayer();
  }, [documentId, pageNumber, allowSelection]);

  if (!allowSelection) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {textItems.map((item, idx) => (
        <span
          key={idx}
          className="absolute pointer-events-auto cursor-text"
          style={{
            left: item.x,
            top: item.y,
            fontSize: item.fontSize,
          }}
        >
          {item.str}
        </span>
      ))}
    </div>
  );
};
```

---

## 📱 Responsive Design & UX

### Mobile-First Approach
- Viewer supports pinch-to-zoom and swipe navigation on mobile devices.
- Touch-friendly controls (large buttons, adequate spacing).
- Responsive layout adapts from mobile (320px) to desktop (1920px+).

```typescript
// Responsive breakpoints (Tailwind)
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px

const ResponsiveLayout: React.FC = ({ children }) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4">
      <div className="w-full md:w-3/4">{/* Main content */}</div>
      <div className="w-full md:w-1/4">{/* Sidebar */}</div>
    </div>
  );
};
```

### Lazy Loading Strategy
- Only the current page, the previous page, and the next page are rendered in the DOM.
- Minimizes memory usage and ensures < 2s load times.

```typescript
// hooks/useLazyPageLoading.ts
export const useLazyPageLoading = (currentPage: number, totalPages: number) => {
  const pagesToRender = useMemo(() => {
    const pages = [currentPage];
    if (currentPage > 1) pages.push(currentPage - 1);
    if (currentPage < totalPages) pages.push(currentPage + 1);
    return pages;
  }, [currentPage, totalPages]);
  
  return pagesToRender;
};
```

### Skeleton Loaders
- Used during AI generation or document fetching to maintain perceived performance.

```typescript
// components/shared/LoadingSpinner.tsx
export const ViewerSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    </div>
  );
};
```

### Accessibility (a11y)
- All interactive elements are keyboard-navigable.
- ARIA labels for screen readers.
- Color contrast ratios meet WCAG 2.1 AA standards.
- Focus indicators visible and clear.

---

## 🔄 Build & Deployment

### CI/CD Pipeline

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:e2e
      
      - name: Build
        run: npm run build
```

### Hosting
- **Vercel** or **AWS Amplify** for the Next.js frontend.
- Ensures global edge caching for static assets.
- Automatic HTTPS and CDN distribution.
- Preview deployments for every PR.

### Environment Variables

```bash
# .env.local.example
NEXT_PUBLIC_API_URL=https://api.knowledgevault.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_GA_ID=G-...

# Private (server-side only)
STRIPE_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
```

---

## 📊 Performance Metrics

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1
- **INP (Interaction to Next Paint)**: < 200ms

### Monitoring
- **Sentry**: Error tracking and performance monitoring.
- **Vercel Analytics**: Real-user metrics (RUM).
- **Custom analytics**: Track viewer-specific metrics (page load time, AI query latency).

```typescript
// lib/utils/performance.ts
export const trackViewerPerformance = (metric: string, value: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric, {
      event_category: 'Viewer',
      value: value,
    });
  }
};
```

### Optimization Techniques
- **Code Splitting**: Dynamic imports for heavy components (viewer, charts).
- **Image Optimization**: Next.js `<Image>` component with automatic optimization.
- **Bundle Analysis**: Regular audits with `@next/bundle-analyzer`.
- **Tree Shaking**: Ensure unused code is eliminated.

---

## 🧪 Testing Strategy

### Unit Tests (Jest + React Testing Library)
- All hooks tested in isolation.
- Component rendering and interaction tests.
- Coverage target: 80%+ for critical components (viewer, auth).

```typescript
// tests/unit/hooks/useViewer.test.ts
describe('useViewer', () => {
  it('should initialize with page 1', () => {
    const { result } = renderHook(() => useViewer('doc-123'));
    expect(result.current.currentPage).toBe(1);
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() => useViewer('doc-123'));
    act(() => {
      result.current.goToNextPage();
    });
    expect(result.current.currentPage).toBe(2);
  });
});
```

### Integration Tests
- API client integration with mock server (MSW).
- Viewer rendering with mock document data.
- Form submission and validation flows.

```typescript
// tests/integration/viewer.test.tsx
describe('SecureViewer Integration', () => {
  it('should render document with watermark', async () => {
    render(<SecureViewer documentId="doc-123" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('canvas-renderer')).toBeInTheDocument();
      expect(screen.getByTestId('watermark-overlay')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Playwright)
- Full user flows: register → upload → view.
- Secure viewer DRM enforcement tests.
- Mobile responsiveness tests.
- Cross-browser compatibility (Chrome, Firefox, Safari).

```typescript
// tests/e2e/viewer.spec.ts
test('viewer prevents right-click', async ({ page }) => {
  await page.goto('/view/doc-123');
  
  // Attempt right-click
  await page.click('canvas', { button: 'right' });
  
  // Verify context menu is blocked
  const contextMenu = page.locator('[role="menu"]');
  await expect(contextMenu).not.toBeVisible();
});
```

---

## 📈 Scalability Path

### Phase 1 (MVP)
- Single Next.js deployment on Vercel.
- Static assets on CDN.
- API calls to single backend instance.

### Phase 2 (Growth)
- Edge functions for auth middleware.
- ISR (Incremental Static Regeneration) for marketing pages.
- Separate deployment for viewer (isolation from dashboard).
- Multi-region deployments for global audience.

### Phase 3 (Enterprise)
- Custom domain support per workspace.
- White-label theming system.
- Advanced caching strategies (service workers for offline support).
- Micro-frontend architecture if team scales significantly.

---

## 📌 Key Takeaways for Implementation

1. **Security is paramount**: Canvas rendering, watermarking, DOM protection are non-negotiable.
2. **Performance matters**: < 2s load time, lazy loading, code splitting.
3. **Type safety**: TypeScript strict mode, shared types with backend.
4. **Testability**: Every component and hook must be testable in isolation.
5. **Accessibility**: WCAG 2.1 AA compliance is mandatory.
6. **Documentation is truth**: Any deviation requires an ADR update.

See [Security Requirements](../04_Security_and_Access/Security_Requirements.md) for detailed DRM implementation guidelines.
```