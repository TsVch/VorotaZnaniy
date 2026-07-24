-- Migration: Add billing fields to Workspace model
-- Created: 2026-07-23

-- 1. Add new billing columns to workspaces table
ALTER TABLE "workspaces"
  ADD COLUMN "activePaymentProvider" TEXT DEFAULT 'yookassa',
  ADD COLUMN "providerCustomerId" TEXT,
  ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'FREE',
  ADD COLUMN "subscriptionPlan" TEXT DEFAULT 'FREE',
  ADD COLUMN "subscriptionExpiresAt" TIMESTAMPTZ;

-- 2. Create unique index on providerCustomerId (matches @unique in schema)
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_providerCustomerId_key"
  ON "workspaces" ("providerCustomerId")
  WHERE "providerCustomerId" IS NOT NULL;

-- 3. Create table for webhook idempotency (24h TTL for processed payments)
CREATE TABLE IF NOT EXISTS "processed_payments" (
  "id" TEXT PRIMARY KEY,
  "providerTransactionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "processedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS "idx_processed_payments_tx"
  ON "processed_payments" ("providerTransactionId");

-- Index for periodic cleanup of old entries
CREATE INDEX IF NOT EXISTS "idx_processed_payments_processed_at"
  ON "processed_payments" ("processedAt");
