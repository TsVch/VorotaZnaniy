-- Migration: Add providerPaymentMethodId for recurring payments (TASK-007.2)
-- Created: 2026-07-24

ALTER TABLE "workspaces"
  ADD COLUMN "providerPaymentMethodId" TEXT;
