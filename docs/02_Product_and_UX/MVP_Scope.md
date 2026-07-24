# MVP Scope

> **This document strictly defines the boundaries of the Minimum Viable Product (MVP). Its purpose is to prevent scope creep and ensure rapid, focused delivery of core value.**
> 
> **Related Documents:** 
> - [Feature_Catalog.md](./Feature_Catalog.md)
> - [Roadmap.md](./Roadmap.md)
> - [Definition_of_Done.md](../07_Management_and_Process/Definition_of_Done.md)

## 🎯 MVP Goal
Deliver a functional, secure, and monetizable platform where a Creator can upload a PDF, protect it with basic DRM, integrate it with Stripe, and allow a Buyer to view it with AI-assisted Q&A in a responsive web browser.

## ✅ IN Scope (MVP Release)
1. **User Management**: 
   - Creator registration/login (Email + Password, Google OAuth).
   - Buyer account creation via Magic Link post-purchase.
2. **Content Management**: 
   - Upload PDF files only (max 100MB for MVP).
   - Secure, page-by-page canvas rendering (no direct PDF file exposure).
3. **Security (Basic DRM)**: 
   - Dynamic visible watermark (Buyer Email + Timestamp).
   - Max 2 concurrent sessions per buyer.
   - Right-click and "Save As" disabled in the viewer.
   - S3 Presigned URLs (5-minute expiry).
4. **AI Features**: 
   - Auto-generated document summary (cached on upload).
   - Contextual Q&A chatbot (RAG-based, limited to 50 queries/document/month for MVP cost control).
5. **Integrations**: 
   - Stripe Checkout webhook integration for access granting.
   - Basic embeddable "Access Link" (no complex UI widget yet, just a secure hosted URL).
6. **Analytics**: 
   - Total views and unique viewers per document.

## ❌ OUT of Scope (Explicitly Deferred)
- **File Types**: EPUB, ZIP, Video (PDF only for MVP).
- **Advanced AI**: Auto-generated quizzes, flashcards, and multi-language support.
- **Advanced DRM**: Device fingerprinting, invisible watermarking, offline mode.
- **Advanced Analytics**: Engagement heatmaps, completion certificates.
- **Integrations**: Zapier, custom domain white-labeling, complex Webflow/WordPress plugins.
- **Mobile Apps**: Native iOS/Android apps (MVP is strictly responsive web).

## 🛑 Scope Change Protocol
Any request to add features to the MVP must be formally evaluated by the CTO. If approved, it requires:
1. Updating this document.
2. Creating a new Architecture Decision Record (ADR) if it impacts architecture.
3. Adjusting the Roadmap and potentially delaying the MVP release date.