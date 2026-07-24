# User Journey Maps

> **This document outlines the step-by-step experiences of primary personas as they interact with the platform.**
> 
> **Related Documents:** 
> - [User_Personas.md](./User_Personas.md)
> - [Feature_Catalog.md](./Feature_Catalog.md)
> - [API_Contracts.md](../03_Architecture_and_Design/API_Contracts.md)

## 🗺️ Journey 1: The Creator (Onboarding & Publishing)
1. **Discovery & Sign-up**: Alex signs up via email or OAuth (Google/GitHub). 
2. **Workspace Setup**: Creates a "Workspace", configures basic branding (logo, colors).
3. **Content Upload**: Drags and drops a `Advanced_SEO_Guide.pdf` (50MB). System validates file type and size.
4. **Protection Configuration**: 
   - Enables "Dynamic Watermarking" (User Email + Timestamp).
   - Sets "Max Concurrent Devices" to 2.
   - Disables "Direct Download" (View Only).
5. **AI Enhancement**: Clicks "Generate AI Assets". System processes the document and creates a baseline summary and enables the Q&A assistant.
6. **Distribution**: Alex copies the secure "Checkout Link" or embeds the provided `<script>` tag into their Webflow site.
7. **Monitoring**: Alex checks the Analytics Dashboard to see that 150 users viewed the guide, with high engagement on Chapter 3.

## 🗺️ Journey 2: The Consumer (Purchase & Consumption)
1. **Purchase**: Sarah clicks "Buy Now" on Alex's website. Completes payment via Stripe.
2. **Access Grant**: Sarah receives an email with a magic link, or is redirected to the KnowledgeVault Reader.
3. **Authentication**: Sarah creates a lightweight account (or uses magic link) to claim permanent access to her library.
4. **Viewing**: Opens the document on her iPad. The secure viewer loads the first page in < 1.5s. A subtle, dynamic watermark with her email is visible in the background.
5. **Interaction**: 
   - Highlights a paragraph and asks the AI Assistant: "Explain this concept with an example."
   - Takes an auto-generated 5-question quiz at the end of Chapter 1.
6. **Completion**: Finishes the guide. System awards a "Completion Certificate" visible in her library.

## ⚠️ Edge Cases & Alternative Paths
- **Failed Payment**: Webhook fails → Access remains revoked, user sees a "Payment Pending" state.
- **Suspicious Activity**: Sarah tries to share her login with a friend. The system detects concurrent sessions from different geolocations and temporarily locks the account, requiring email re-verification.
- **Offline Access**: (Future feature) User downloads an encrypted, app-specific version for offline reading (out of scope for MVP web viewer).