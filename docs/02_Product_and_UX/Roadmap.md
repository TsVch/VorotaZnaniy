# Product Roadmap

> **This document outlines the phased delivery plan for the KnowledgeVault SaaS platform, aligning technical execution with business milestones.**
> 
> **Related Documents:** 
> - [MVP_Scope.md](./MVP_Scope.md)
> - [Feature_Catalog.md](./Feature_Catalog.md)
> - [Release_Plan.md](../05_Infrastructure_and_Operations/Release_Plan.md)

## 🗓️ Phase 1: MVP (Months 1-2)
**Theme:** "Secure Foundation & Core Value"
**Goal:** Launch a working, monetizable product for early-adopter creators.
- **M1.1**: Core infrastructure setup, DB schema, Auth (JWT/OAuth).
- **M1.2**: Document upload pipeline, S3 integration, secure canvas rendering.
- **M1.3**: Basic DRM (watermarking, session limits, presigned URLs).
- **M1.4**: AI RAG pipeline integration (Summary + Q&A) with strict token limits.
- **M1.5**: Stripe webhook integration and basic Creator/Buyer dashboards.
- **Milestone**: Closed Beta launch with 5-10 friendly creators.

## 🗓️ Phase 2: Growth & Engagement (Months 3-4)
**Theme:** "Enhanced Value & Retention"
**Goal:** Increase buyer engagement and provide creators with deeper insights.
- **M2.1**: Advanced AI: Auto-generated quizzes and flashcards.
- **M2.2**: Enhanced Analytics: Engagement heatmaps, AI usage dashboards.
- **M2.3**: Improved Distribution: Embeddable JS widget for creator websites.
- **M2.4**: Security upgrade: Basic device fingerprinting and audit logs.
- **Milestone**: Public Launch, transition to paid SaaS tiers.

## 🗓️ Phase 3: Scale & Enterprise (Months 5-6+)
**Theme:** "Robustness & Market Expansion"
**Goal:** Support high-volume creators and prepare for B2B enterprise sales.
- **M3.1**: Multi-format support: EPUB, ZIP, and basic video protection.
- **M3.2**: Enterprise features: SSO (SAML/OIDC), White-labeling (custom domains).
- **M3.3**: Advanced Integrations: Zapier, native Webflow/WordPress plugins.
- **M3.4**: Completion certificates and advanced RBAC for team accounts.
- **Milestone**: SOC2 Type I compliance readiness, Enterprise tier launch.

## 🔄 Living Document Note
This roadmap is reviewed bi-weekly by the CTO. Priorities may shift based on Beta user feedback, technical blockers, or changes in the AI/DRM landscape. Any major shift will be documented in an ADR.