# Business Model

> **This document defines the monetization strategy, pricing tiers, and revenue streams for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [Value_Proposition.md](./Value_Proposition.md)
> - [Roadmap.md](../02_Product_and_UX/Roadmap.md)
> - [Integrations.md](../05_Infrastructure_and_Operations/Integrations.md)

## 💰 Revenue Model
We operate on a **B2B2C SaaS Subscription Model** with usage-based add-ons for AI features. The end buyer (consumer) does not pay us directly; the creator (our customer) pays us for the infrastructure to serve their buyers.

## 📦 Pricing Tiers

### 1. Starter (Free / Freemium)
- **Target**: New creators testing the platform.
- **Limits**: Up to 3 active documents, 50 monthly active viewers.
- **Features**: Basic secure viewer, static watermarking, basic view analytics.
- **AI**: None.
- **Goal**: Frictionless onboarding and product-led growth (PLG).

### 2. Pro ($29 - $49 / month)
- **Target**: Established creators, coaches, and small educational businesses.
- **Limits**: Unlimited documents, up to 2,000 monthly active viewers.
- **Features**: Dynamic watermarking (User ID + Timestamp + IP), device/session locking, advanced analytics dashboard, custom branding (removal of "Powered by KnowledgeVault").
- **AI**: Up to 500 AI interactions (summaries, quizzes, Q&A) per month included.
- **Overage**: $0.01 per additional AI interaction.

### 3. Business ($99 - $199 / month)
- **Target**: Growing academies, mid-sized companies, high-volume creators.
- **Limits**: Unlimited documents, up to 10,000 monthly active viewers.
- **Features**: All Pro features, plus: API access, Webhook integrations (Stripe, Zapier), bulk document upload, completion certificates.
- **AI**: Up to 5,000 AI interactions per month included.

### 4. Enterprise (Custom Pricing)
- **Target**: Large corporations, universities, enterprise training.
- **Features**: All Business features, plus: SSO (SAML/OIDC), dedicated infrastructure, custom SLA (99.99%), white-labeling (custom domain for the viewer), advanced compliance (SOC2, HIPAA readiness).

## 💳 Revenue Streams
1. **Recurring Subscriptions**: Primary, predictable revenue from monthly/annual SaaS plans.
2. **AI Usage Overage**: Marginal revenue from heavy AI usage beyond tier limits (designed to cover LLM API costs + small margin).
3. **Future Expansion**: Transaction fee model (optional alternative for Starter tier: 0% platform fee + 5% KnowledgeVault fee per sale, waiving the monthly subscription).

## 📉 Cost Structure (Unit Economics)
- **Fixed Costs**: Development, core infrastructure (baseline servers, databases), administrative.
- **Variable Costs**: 
  - Object storage (S3) and bandwidth (egress) per document view.
  - LLM API calls (OpenAI/Anthropic) per AI interaction.
  - Payment gateway processing fees.
- **Goal**: Maintain a Gross Margin of >75% by aggressively caching AI summaries and optimizing document rendering (e.g., streaming PDF pages rather than loading entire files into memory).