# Feature Catalog

> **This document provides a comprehensive, prioritized list of all features planned for the KnowledgeVault SaaS platform.**
> 
> **Related Documents:** 
> - [PRD.md](./PRD.md)
> - [MVP_Scope.md](./MVP_Scope.md)
> - [Roadmap.md](./Roadmap.md)

## 📌 Priority Legend
- **P0**: Critical for MVP. Must have.
- **P1**: Important for post-MVP growth. Should have.
- **P2**: Nice to have, deferred to later phases.

---

## 1. Core Platform & Content Management
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| CM-01 | Document Upload | Drag-and-drop upload for PDF, EPUB, ZIP (up to 500MB). | P0 |
| CM-02 | Secure Rendering | Convert documents to secure, tile-based or canvas rendering to prevent direct URL extraction. | P0 |
| CM-03 | Document Library | Creator dashboard to view, edit, and manage uploaded assets. | P0 |
| CM-04 | Consumer Library | End-user dashboard showing all purchased/accessed materials with progress tracking. | P0 |
| CM-05 | Document Versioning | Allow creators to update a document; existing buyers retain access to the new version. | P1 |

## 2. Security & DRM (Digital Rights Management)
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| SEC-01 | Dynamic Watermarking | Overlay viewer's email, user ID, and timestamp on every page/screen. | P0 |
| SEC-02 | Session Management | Limit concurrent active sessions (e.g., max 2 devices). Auto-kick older sessions. | P0 |
| SEC-03 | UI Protection | Disable right-click, text selection (optional), and browser "Save As" within the viewer iframe. | P0 |
| SEC-04 | Presigned URLs | Serve all document assets via short-lived (e.g., 5 min) S3 presigned URLs. | P0 |
| SEC-05 | Device Fingerprinting | Basic browser/device fingerprinting to detect suspicious session sharing. | P1 |
| SEC-06 | Download Restrictions | Toggle to completely disable direct file downloads (View-Only mode). | P0 |

## 3. AI-Powered Features
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| AI-01 | Auto-Summary | Generate a 1-page executive summary upon document upload. | P0 |
| AI-02 | Contextual Q&A | Sidebar chatbot answering questions strictly using RAG on the specific document. | P0 |
| AI-03 | Auto-Quizzes | Generate 5-10 multiple-choice questions based on document content. | P1 |
| AI-04 | Flashcards | Generate spaced-repetition flashcards from key concepts in the document. | P1 |
| AI-05 | AI Usage Dashboard | Track and display AI token usage and interaction counts per document. | P1 |

## 4. Analytics & Reporting
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| AN-01 | View Analytics | Track total views, unique viewers, and average time spent per document. | P0 |
| AN-02 | Engagement Heatmap | Show which pages/chapters have the highest drop-off or re-read rates. | P1 |
| AN-03 | Completion Certificates | Auto-generate and award a PDF certificate when a user finishes a document/quiz. | P2 |

## 5. Integrations & Distribution
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| INT-01 | Stripe Webhooks | Listen to `checkout.session.completed` to automatically grant user access. | P0 |
| INT-02 | Embeddable Widget | Provide a simple `<script>` tag for creators to embed the secure viewer or buy button on their sites. | P0 |
| INT-03 | Magic Link Access | Allow one-click access via email for buyers without forcing immediate password creation. | P0 |
| INT-04 | Zapier Integration | Allow creators to connect KnowledgeVault to their existing CRM/email tools. | P2 |

## 6. Administration & Billing
| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :---: |
| ADM-01 | Subscription Management | Integration with Stripe Billing for Creator SaaS tier upgrades/downgrades. | P0 |
| ADM-02 | Role-Based Access Control (RBAC) | Define roles: Super Admin, Creator, Viewer (Buyer). | P0 |
| ADM-03 | Audit Logs | Record critical security events (e.g., session termination, bulk downloads attempted). | P1 |