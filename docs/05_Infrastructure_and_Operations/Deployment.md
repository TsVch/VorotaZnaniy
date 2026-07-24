```markdown
# Deployment

> **This document defines the deployment strategy, CI/CD pipelines, environment management, and release procedures for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [Infrastructure](./Infrastructure.md)
> - [Integrations](./Integrations.md)
> - [Security Requirements](../04_Security_and_Access/Security_Requirements.md)
> - [System Architecture](../03_Architecture_and_Design/System_Architecture.md)
> - [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md)

---

## 🎯 Deployment Decision Summary

| Aspect | Decision | Rationale | ADR Reference |
| :--- | :--- | :--- | :--- |
| CI/CD Platform | GitHub Actions | Native GitHub integration, free for public repos, excellent marketplace | ADR-038 |
| Frontend Deployment | Vercel (Git-based) | Zero-config Next.js deployment, automatic preview environments | ADR-031 |
| Backend Deployment | Docker + ECS Fargate (or Render) | Containerized, reproducible, easy to scale horizontally | ADR-032 |
| Database Migrations | Prisma Migrate (CI-validated) | Type-safe, version-controlled, reversible migrations | ADR-039 |
| Release Strategy | Blue-Green (Production) | Zero-downtime deployments, instant rollback capability | ADR-040 |
| Configuration Mgmt | Environment Variables + Secrets Manager | No hardcoded secrets, environment-specific configs | ADR-037 |
| Artifact Registry | GitHub Container Registry (GHCR) | Native GitHub integration, free for public repos | ADR-041 |

---

## 🌍 Environment Strategy

### Environment Definitions

| Environment | Purpose | Deployment Trigger | Data | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Local (Dev)** | Developer machines | Manual (Docker Compose) | Seed/Mock data | Developers |
| **Preview** | PR validation | Automatic on PR creation | Isolated DB per PR | Developers, Reviewers |
| **Staging** | Pre-production validation | Automatic on merge to `develop` | Anonymized Production snapshot | Internal team, QA |
| **Production** | Live customer traffic | Manual approval after Staging validation | Real customer data | CTO, DevOps (restricted) |

### Environment Promotion Flow

```text
Developer Branch → PR → Preview Env → Code Review → Merge to develop → Staging → QA Validation → Manual Approval → Production
```

### Environment-Specific Configurations

#### Local Development
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: knowledgevault_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  minio:  # S3-compatible local storage
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
```

#### Staging
- Mirrors Production architecture (smaller instance sizes)
- Database: Anonymized Production snapshot (refreshed weekly)
- External services: Test mode (Stripe test keys, OpenAI sandbox)
- Domain: `staging.knowledgevault.com`

#### Production
- Full HA configuration (Multi-AZ, auto-scaling)
- Database: Encrypted, daily backups, PITR enabled
- External services: Live keys (Stripe live, OpenAI production)
- Domain: `app.knowledgevault.com`, `api.knowledgevault.com`

---

## 🔄 CI/CD Pipeline Design

### Pipeline Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   On PR      │───▶│  On Merge    │───▶│  On Release Tag  │  │
│  │              │    │  to develop  │    │                  │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                   │                      │             │
│         ▼                   ▼                      ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ - Lint       │    │ - Build      │    │ - Build Prod     │  │
│  │ - Type Check │    │ - Test       │    │ - Test           │  │
│  │ - Unit Tests │    │ - Deploy     │    │ - Deploy Staging │  │
│  │ - E2E Tests  │    │   Staging    │    │ - Manual Approval│  │
│  │ - Security   │    │ - E2E Tests  │    │ - Deploy Prod    │  │
│  │   Scan       │    │              │    │                  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

#### Stage 1: On Pull Request (Preview Environment)

**Triggers:**
- PR opened, updated, or reopened

**Jobs:**
```yaml
# .github/workflows/pr-validation.yml
name: PR Validation

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
  
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/
  
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      - name: Run GitLeaks to check for secrets
        uses: gitleaks/gitleaks-action@v2
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

**Preview Environment Deployment:**
- Vercel automatically creates a preview deployment for each PR
- Backend: Deploy to ephemeral ECS task (or skip for MVP)
- Database: Use shared Staging DB with isolated schema (or skip for MVP)

#### Stage 2: On Merge to `develop` (Staging Deployment)

**Triggers:**
- Push to `develop` branch

**Jobs:**
```yaml
# .github/workflows/staging-deploy.yml
name: Staging Deployment

on:
  push:
    branches: [develop]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:staging
            ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build and push AI Worker
        uses: docker/build-push-action@v5
        with:
          context: ./ai_worker
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/ai-worker:staging
            ghcr.io/${{ github.repository }}/ai-worker:${{ github.sha }}
  
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-and-push]
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Staging (ECS Fargate)
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ./ecs/task-definition-staging.json
          service: knowledgevault-backend-staging
          cluster: knowledgevault-staging
          wait-for-service-stability: true
      
      - name: Run database migrations
        run: |
          aws ecs run-task \
            --cluster knowledgevault-staging \
            --task-definition knowledgevault-migrations-staging \
            --launch-type FARGATE \
            --network-configuration "..."
      
      - name: Run E2E tests against Staging
        run: npm run test:e2e:staging
      
      - name: Notify Slack
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment successful'
```

#### Stage 3: On Release Tag (Production Deployment)

**Triggers:**
- Manual workflow dispatch or tag push (e.g., `v1.2.3`)

**Jobs:**
```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v1.2.3)'
        required: true
      image_tag:
        description: 'Docker image tag to deploy'
        required: true

jobs:
  pre-deploy-checks:
    runs-on: ubuntu-latest
    steps:
      - name: Verify Staging is healthy
        run: |
          curl -f https://api-staging.knowledgevault.com/health || exit 1
      
      - name: Verify all E2E tests pass
        run: npm run test:e2e:staging
  
  build-production:
    runs-on: ubuntu-latest
    needs: [pre-deploy-checks]
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push Production images
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:${{ github.event.inputs.image_tag }}
            ghcr.io/${{ github.repository }}/backend:latest
  
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build-production]
    environment: 
      name: production
      url: https://api.knowledgevault.com
    steps:
      - name: Deploy to Production (Blue-Green)
        run: |
          # Deploy to Green environment
          aws ecs update-service \
            --cluster knowledgevault-production \
            --service knowledgevault-backend-green \
            --force-new-deployment \
            --task-definition knowledgevault-backend-prod:${{ github.event.inputs.image_tag }}
          
          # Wait for Green to be healthy
          aws ecs wait services-stable \
            --cluster knowledgevault-production \
            --services knowledgevault-backend-green
          
          # Switch ALB traffic to Green
          aws elbv2 set-rule-priorities \
            --rule-arns "$(aws elbv2 describe-rules --listener-arn $ALB_LISTENER_ARN --query 'rules[?conditions[0].field==`host-header` && conditions[0].values[0]==`api.knowledgevault.com`].ruleArn' --output text)" \
            --priorities Green=1,Blue=2
          
          # Terminate Blue environment (old version)
          aws ecs update-service \
            --cluster knowledgevault-production \
            --service knowledgevault-backend-blue \
            --desired-count 0
      
      - name: Run smoke tests
        run: |
          curl -f https://api.knowledgevault.com/health || exit 1
          npm run test:smoke:production
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.event.inputs.version }}
          release_name: Release ${{ github.event.inputs.version }}
          body: |
            ## Changes
            - See [CHANGELOG.md](./CHANGELOG.md)
            
            ## Deployment
            - Image: `${{ github.event.inputs.image_tag }}`
            - Deployed by: @${{ github.actor }}
      
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ github.event.inputs.version }} successful'
```

---

## 🎨 Frontend Deployment (Vercel)

### Deployment Model
- **Git-based**: Every push to `main` or `develop` triggers automatic deployment
- **Preview Environments**: Every PR gets a unique preview URL
- **Edge Network**: Global distribution via Vercel's edge network

### Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/docs",
      "destination": "https://docs.knowledgevault.com",
      "permanent": false
    }
  ]
}
```

### Environment Variables (Vercel Dashboard)
```bash
# Production
NEXT_PUBLIC_API_URL=https://api.knowledgevault.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Staging
NEXT_PUBLIC_API_URL=https://api-staging.knowledgevault.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Deployment Flow
```text
1. Developer pushes to GitHub
2. Vercel detects push
3. Vercel builds Next.js app
4. Vercel runs build-time checks (TypeScript, ESLint)
5. Vercel deploys to edge network
6. Vercel assigns preview URL (for PRs) or production URL (for main)
7. Vercel invalidates CDN cache
```

---

## 🐳 Backend Deployment (Docker + ECS Fargate)

### Dockerfile (Backend)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy built app
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]
```

### ECS Task Definition

```json
{
  "family": "knowledgevault-backend-prod",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ghcr.io/knowledgevault/backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:knowledgevault/prod/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:knowledgevault/prod/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/knowledgevault-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Auto-Scaling Configuration

```yaml
# Auto-scaling based on CPU utilization
Resources:
  BackendAutoScalingTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      MaxCapacity: 10
      MinCapacity: 2
      ResourceId: !Sub service/knowledgevault-production/knowledgevault-backend
      ScalableDimension: ecs:service:DesiredCount
      ServiceNamespace: ecs
  
  BackendAutoScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: BackendCPUScalingPolicy
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref BackendAutoScalingTarget
      TargetTrackingScalingPolicyConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
        TargetValue: 70.0
        ScaleInCooldown: 300
        ScaleOutCooldown: 60
```

---

## 🗄️ Database Migrations

### Migration Strategy

#### Principles
1. **Version-Controlled**: All migrations stored in `prisma/migrations/`
2. **Reversible**: Every migration has an up and down script
3. **Non-Breaking**: Migrations must not break existing functionality
4. **CI-Validated**: Migrations tested in CI before deployment

#### Migration Flow
```text
1. Developer creates migration: npx prisma migrate dev --name add_new_field
2. Prisma generates SQL migration file
3. Developer commits migration to Git
4. CI runs migration against test database
5. On Staging deployment: migration runs automatically
6. On Production deployment: migration runs before app code deployment
```

#### Safe Migration Patterns

✅ **Safe: Add nullable column**
```sql
ALTER TABLE documents ADD COLUMN new_field TEXT;
```

✅ **Safe: Add index**
```sql
CREATE INDEX CONCURRENTLY idx_documents_status ON documents(status);
```

❌ **Unsafe: Rename column (breaks existing code)**
```sql
-- DON'T DO THIS
ALTER TABLE documents RENAME COLUMN old_name TO new_name;
```

✅ **Safe: Rename column (expand-contract pattern)**
```sql
-- Step 1: Add new column
ALTER TABLE documents ADD COLUMN new_name TEXT;

-- Step 2: Backfill data
UPDATE documents SET new_name = old_name;

-- Step 3: Deploy code that writes to both columns

-- Step 4: Deploy code that reads from new column only

-- Step 5: Drop old column (after verification)
ALTER TABLE documents DROP COLUMN old_name;
```

### Migration Execution

#### Staging
```bash
# Automatically run on deployment
npx prisma migrate deploy
```

#### Production
```bash
# Run in separate ECS task (not in app container)
aws ecs run-task \
  --cluster knowledgevault-production \
  --task-definition knowledgevault-migrations-prod \
  --launch-type FARGATE \
  --network-configuration "..."
```

---

## 🚀 Release Strategies

### Strategy 1: Blue-Green Deployment (Production)

**How it works:**
- Two identical environments: Blue (current) and Green (new version)
- Deploy new version to Green
- Run health checks and smoke tests on Green
- Switch ALB traffic from Blue to Green
- Terminate Blue environment

**Benefits:**
- Zero downtime
- Instant rollback (switch back to Blue)
- Easy to test new version before going live

**Implementation:**
```bash
# 1. Deploy to Green
aws ecs update-service \
  --cluster knowledgevault-production \
  --service knowledgevault-backend-green \
  --force-new-deployment

# 2. Wait for Green to be healthy
aws ecs wait services-stable \
  --cluster knowledgevault-production \
  --services knowledgevault-backend-green

# 3. Switch traffic to Green
aws elbv2 modify-listener \
  --listener-arn $ALB_LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$GREEN_TARGET_GROUP_ARN

# 4. Terminate Blue
aws ecs update-service \
  --cluster knowledgevault-production \
  --service knowledgevault-backend-blue \
  --desired-count 0
```

### Strategy 2: Rolling Update (Staging)

**How it works:**
- Gradually replace old tasks with new tasks
- Maintain minimum availability during deployment

**Implementation:**
```json
{
  "deploymentConfiguration": {
    "maximumPercent": 200,
    "minimumHealthyPercent": 100
  }
}
```

### Strategy 3: Canary Deployment (Future, Phase 3)

**How it works:**
- Deploy new version to small percentage of traffic (e.g., 5%)
- Monitor metrics (error rate, latency)
- Gradually increase traffic if metrics are healthy
- Rollback automatically if metrics degrade

---

## 🔙 Rollback Procedures

### Scenario 1: Application Code Rollback

**Blue-Green (Production):**
```bash
# Switch traffic back to Blue (old version)
aws elbv2 modify-listener \
  --listener-arn $ALB_LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$BLUE_TARGET_GROUP_ARN
```

**Rolling Update (Staging):**
```bash
# Redeploy previous image tag
aws ecs update-service \
  --cluster knowledgevault-staging \
  --service knowledgevault-backend \
  --task-definition knowledgevault-backend:previous-tag
```

### Scenario 2: Database Migration Rollback

**If migration fails:**
```bash
# Run down migration
npx prisma migrate reset --force

# Or manually run down SQL
psql $DATABASE_URL -f prisma/migrations/20260721_add_field/down.sql
```

**If migration succeeds but app code fails:**
```bash
# 1. Rollback app code to previous version
# 2. Migration is already applied, but new code doesn't use new field yet
# 3. No data loss, no rollback needed
```

### Scenario 3: Configuration Rollback

**Environment Variables:**
```bash
# Vercel: Rollback via Dashboard (version history)
# ECS: Update task definition with previous environment values
```

---

## 📊 Monitoring Deployments

### Deployment Metrics

| Metric | Target | Alert Threshold |
| :--- | :--- | :--- |
| Deployment Success Rate | 100% | < 95% |
| Deployment Duration | < 10 min | > 15 min |
| Rollback Rate | < 5% | > 10% |
| Time to Recovery (TTR) | < 5 min | > 15 min |

### Post-Deployment Checks

#### Automated Smoke Tests
```typescript
// tests/smoke/production-smoke.test.ts
describe('Production Smoke Tests', () => {
  it('health endpoint returns 200', async () => {
    const response = await fetch('https://api.knowledgevault.com/health');
    expect(response.status).toBe(200);
  });

  it('can create a user', async () => {
    const response = await fetch('https://api.knowledgevault.com/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        password: 'TestPass123!',
      }),
    });
    expect(response.status).toBe(201);
  });
});
```

#### Manual Validation Checklist
- [ ] Frontend loads without errors
- [ ] Login flow works (email/password, OAuth, magic link)
- [ ] Document upload works
- [ ] Secure viewer loads and renders
- [ ] AI Q&A returns answers
- [ ] Stripe webhooks process correctly
- [ ] No console errors in browser
- [ ] No errors in Sentry
- [ ] Database queries performant (check slow query logs)

---

## 📌 Key Takeaways for Implementation (Freebuff)

### Deployment Requirements

1. **Dockerize Everything**: Backend and AI Worker must have production-ready `Dockerfile`s.
2. **Health Checks Mandatory**: Every service must expose `/health` endpoint.
3. **No Hardcoded Configs**: All environment-specific values via environment variables.
4. **Migrations in CI**: Test migrations in CI before deployment.
5. **Secrets in Secrets Manager**: Never in code, never in `.env` files committed to Git.
6. **Immutable Tags**: Use Git SHA as Docker image tag, never `latest` in production.
7. **Rollback Plan**: Every deployment must have a documented rollback procedure.
8. **Monitoring**: Every deployment must include Sentry and CloudWatch/Datadog integration.

### CI/CD Pipeline Requirements

1. **Fast Feedback**: PR validation must complete in < 10 minutes.
2. **Parallel Jobs**: Lint, type-check, unit tests, security scan run in parallel.
3. **Caching**: Use GitHub Actions cache for `node_modules` and Docker layers.
4. **Artifact Storage**: Docker images stored in GHCR (GitHub Container Registry).
5. **Notifications**: Slack notifications for deployment success/failure.

### Security Requirements

1. **No Secrets in Logs**: Mask sensitive data in CI/CD logs.
2. **Signed Commits**: Require signed commits for `main` and `develop` branches.
3. **Branch Protection**: Require PR reviews, status checks, and up-to-date branches.
4. **Least Privilege**: CI/CD roles have minimal permissions (only what's needed).

---

## 🔗 Related Documents

- [Infrastructure](./Infrastructure.md) - Cloud provider configuration, network topology
- [Integrations](./Integrations.md) - External service connections (Stripe, OpenAI, etc.)
- [Security Requirements](../04_Security_and_Access/Security_Requirements.md) - Secrets management, network security
- [Testing Strategy](../06_Quality_and_Standards/Testing_Strategy.md) - Test types, coverage requirements
- [System Architecture](../03_Architecture_and_Design/System_Architecture.md) - High-level deployment architecture
- [Backend Architecture](../03_Architecture_and_Design/Backend_Architecture.md) - Backend deployment specifics
- [Frontend Architecture](../03_Architecture_and_Design/Frontend_Architecture.md) - Frontend deployment specifics
```