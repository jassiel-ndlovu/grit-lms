-- CreateEnum
CREATE TYPE "TierKey" AS ENUM ('CORE', 'PLUS', 'PRO');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('BASIC', 'PREMIUM', 'ADDON');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'PARKED', 'LATER', 'HIDDEN', 'RETIRED');

-- CreateEnum
CREATE TYPE "Meter" AS ENUM ('ACTIVE_STUDENTS', 'AI_MARKS', 'LIVE_ROOM_MINUTES', 'STORAGE_MB', 'API_REQUESTS');

-- CreateEnum
CREATE TYPE "PaymentProviderId" AS ENUM ('PAYSTACK', 'PAYFAST');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'AUTHORISED', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BillingPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SeatChargeKind" AS ENUM ('ADVANCE', 'CATCH_UP');

-- CreateEnum
CREATE TYPE "UsageSource" AS ENUM ('NIGHTLY', 'EVENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UsageCapSource" AS ENUM ('TUTOR', 'TRIAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'PAST_DUE', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PlatformPaidVia" AS ENUM ('CARD', 'OFFSITE', 'CREDIT', 'COMPED');

-- CreateEnum
CREATE TYPE "DunningStage" AS ENUM ('NONE', 'DAY0', 'DAY3', 'DAY7', 'LOCKED');

-- CreateEnum
CREATE TYPE "PlatformInvoiceLineKind" AS ENUM ('ADVANCE', 'CATCH_UP', 'TIER_UPGRADE', 'ADDON', 'PASS_THROUGH', 'DISCOUNT', 'CREDIT', 'COMP', 'VAT');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('OPEN', 'APPLIED', 'VOID');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('WORKSPACE_BILL', 'TIER', 'ADDON', 'PARENT_INVOICE');

-- CreateEnum
CREATE TYPE "ProviderOwnerType" AS ENUM ('WORKSPACE', 'USER');

-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('WORKSPACE', 'PER_TUTOR');

-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "FeeScheduleKind" AS ENUM ('MONTHLY', 'LESSON_PACK', 'ONCE_OFF');

-- CreateEnum
CREATE TYPE "FeeInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "FeeInvoicePaidVia" AS ENUM ('ONLINE', 'OFFSITE');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('CARD_AUTHORISATION', 'PLATFORM_INVOICE', 'PARENT_CHECKOUT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'ABANDONED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OffsiteMethod" AS ENUM ('CASH', 'EFT', 'OTHER');

-- CreateEnum
CREATE TYPE "OffsiteMarkedAs" AS ENUM ('TUTOR', 'WORKSPACE_ADMIN', 'NEXA_ADMIN');

-- CreateTable
CREATE TABLE "Tier" (
    "id" TEXT NOT NULL,
    "key" "TierKey" NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "aiMarksPerStudent" INTEGER NOT NULL DEFAULT 0,
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeTo" TIMESTAMP(3),

    CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "tier" "TierKey" NOT NULL,
    "status" "ServiceStatus" NOT NULL,
    "meter" "Meter",
    "unitPriceCents" INTEGER,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BillingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "vatRateBps" INTEGER NOT NULL DEFAULT 1500,
    "vatEffectiveFrom" DATE,
    "apiMarginBps" INTEGER NOT NULL DEFAULT 8000,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "retentionMonthsAfterLastPayment" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseService" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT NOT NULL,

    CONSTRAINT "CourseService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTierHold" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "tierKey" "TierKey" NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL,
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "raisedByUserId" TEXT NOT NULL,

    CONSTRAINT "CourseTierHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTierOverride" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "tierKey" "TierKey" NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTierOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL DEFAULT 'PAYSTACK',
    "providerCustomerCode" TEXT,
    "authorizationCodeEnc" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),
    "lastPaidAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "billingEmail" TEXT NOT NULL,
    "legalName" TEXT,
    "customerVatNumber" TEXT,
    "compedUntil" TIMESTAMP(3),
    "readOnlySince" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "trialEmailDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPeriod" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "BillingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "openedByInvoiceId" TEXT NOT NULL,

    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatCharge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "tierKey" "TierKey" NOT NULL,
    "kind" "SeatChargeKind" NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "SeatCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meter" "Meter" NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT '',
    "day" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "providerCostMilliCents" INTEGER NOT NULL DEFAULT 0,
    "source" "UsageSource" NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCap" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "meter" "Meter" NOT NULL,
    "limitQuantity" INTEGER NOT NULL,
    "hardStop" BOOLEAN NOT NULL DEFAULT true,
    "source" "UsageCapSource" NOT NULL,
    "notifiedPeriodStart" TIMESTAMP(3),
    "notifiedLevel" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "opensPeriodStart" TIMESTAMP(3) NOT NULL,
    "closesPeriodId" TEXT,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "vatRateBps" INTEGER,
    "vatCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidVia" "PlatformPaidVia",
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "dunningStage" "DunningStage" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "PlatformInvoiceLineKind" NOT NULL,
    "courseId" TEXT,
    "courseTitle" TEXT,
    "tierKey" "TierKey",
    "serviceKey" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "discountCodeId" TEXT,
    "creditNoteId" TEXT,

    CONSTRAINT "PlatformInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'OPEN',
    "appliedToInvoiceId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuerWorkspaceId" TEXT,
    "description" TEXT NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "percentBps" INTEGER,
    "amountCents" INTEGER,
    "scope" "DiscountScope" NOT NULL,
    "scopeTierKey" "TierKey",
    "scopeServiceKey" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "durationPeriods" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "redeemerKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "payerUserId" TEXT,
    "learnerId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodsApplied" INTEGER NOT NULL DEFAULT 0,
    "exhaustedAt" TIMESTAMP(3),

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCustomer" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "ownerType" "ProviderOwnerType" NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "customerCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "workspaceId" TEXT NOT NULL,
    "payoutMode" "PayoutMode" NOT NULL DEFAULT 'WORKSPACE',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 7,
    "overdueReminders" BOOLEAN NOT NULL DEFAULT true,
    "restrictOnOverdue" BOOLEAN NOT NULL DEFAULT false,
    "offsiteInstructions" TEXT,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT,
    "provider" "PaymentProviderId" NOT NULL DEFAULT 'PAYSTACK',
    "subaccountCode" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "PayoutAccountStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "learnerId" TEXT,
    "kind" "FeeScheduleKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "lessonsInPack" INTEGER,
    "description" TEXT NOT NULL,
    "billingDay" INTEGER,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "payoutAccountId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "status" "FeeInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "paidVia" "FeeInvoicePaidVia",
    "payerUserId" TEXT,
    "lockedByPaymentId" TEXT,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "feeScheduleId" TEXT,
    "courseId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitAmountCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "discountCodeId" TEXT,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "reference" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "workspaceId" TEXT,
    "payerUserId" TEXT,
    "platformInvoiceId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedFeeCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER,
    "channel" TEXT,
    "splitSent" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "payoutAccountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "shareCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "feeShareCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "allocationId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "commissionReturnedCents" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffsitePayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "platformInvoiceId" TEXT,
    "method" "OffsiteMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedOn" DATE NOT NULL,
    "reference" TEXT,
    "note" TEXT NOT NULL,
    "markedByUserId" TEXT NOT NULL,
    "markedAs" "OffsiteMarkedAs" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "OffsitePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tier_key_activeFrom_key" ON "Tier"("key", "activeFrom");

-- CreateIndex
CREATE INDEX "CourseService_workspaceId_idx" ON "CourseService"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseService_courseId_serviceKey_key" ON "CourseService"("courseId", "serviceKey");

-- CreateIndex
CREATE INDEX "CourseTierHold_courseId_holdUntil_idx" ON "CourseTierHold"("courseId", "holdUntil");

-- CreateIndex
CREATE INDEX "CourseTierHold_workspaceId_idx" ON "CourseTierHold"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTierOverride_courseId_key" ON "CourseTierOverride"("courseId");

-- CreateIndex
CREATE INDEX "CourseTierOverride_workspaceId_idx" ON "CourseTierOverride"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Subscription_renewsAt_idx" ON "Subscription"("renewsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPeriod_workspaceId_start_key" ON "BillingPeriod"("workspaceId", "start");

-- CreateIndex
CREATE INDEX "SeatCharge_workspaceId_idx" ON "SeatCharge"("workspaceId");

-- CreateIndex
CREATE INDEX "SeatCharge_invoiceId_idx" ON "SeatCharge"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatCharge_billingPeriodId_courseId_learnerId_key" ON "SeatCharge"("billingPeriodId", "courseId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_workspaceId_meter_scopeKey_day_key" ON "UsageRecord"("workspaceId", "meter", "scopeKey", "day");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCap_workspaceId_meter_source_key" ON "UsageCap"("workspaceId", "meter", "source");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_number_key" ON "PlatformInvoice"("number");

-- CreateIndex
CREATE INDEX "PlatformInvoice_workspaceId_issuedAt_idx" ON "PlatformInvoice"("workspaceId", "issuedAt");

-- CreateIndex
CREATE INDEX "PlatformInvoice_status_nextAttemptAt_idx" ON "PlatformInvoice"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_workspaceId_closesPeriodId_key" ON "PlatformInvoice"("workspaceId", "closesPeriodId");

-- CreateIndex
CREATE INDEX "PlatformInvoiceLine_invoiceId_idx" ON "PlatformInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_workspaceId_status_idx" ON "CreditNote"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

-- CreateIndex
CREATE INDEX "Redemption_workspaceId_idx" ON "Redemption"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Redemption_discountCodeId_redeemerKey_key" ON "Redemption"("discountCodeId", "redeemerKey");

-- CreateIndex
CREATE INDEX "ProviderCustomer_customerCode_idx" ON "ProviderCustomer"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomer_provider_ownerType_workspaceId_userId_key" ON "ProviderCustomer"("provider", "ownerType", "workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_subaccountCode_key" ON "PayoutAccount"("subaccountCode");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_workspaceId_membershipId_key" ON "PayoutAccount"("workspaceId", "membershipId");

-- CreateIndex
CREATE INDEX "FeeSchedule_workspaceId_active_idx" ON "FeeSchedule"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "FeeSchedule_courseId_idx" ON "FeeSchedule"("courseId");

-- CreateIndex
CREATE INDEX "FeeSchedule_learnerId_idx" ON "FeeSchedule"("learnerId");

-- CreateIndex
CREATE INDEX "Invoice_studentUserId_status_idx" ON "Invoice"("studentUserId", "status");

-- CreateIndex
CREATE INDEX "Invoice_learnerId_idx" ON "Invoice"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workspaceId_number_key" ON "Invoice"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_workspaceId_idx" ON "Payment"("workspaceId");

-- CreateIndex
CREATE INDEX "Payment_payerUserId_idx" ON "Payment"("payerUserId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_platformInvoiceId_idx" ON "Payment"("platformInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_dedupeKey_key" ON "PaymentEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "PaymentEvent_status_receivedAt_idx" ON "PaymentEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_reference_idx" ON "PaymentEvent"("reference");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "OffsitePayment_workspaceId_idx" ON "OffsitePayment"("workspaceId");

-- CreateIndex
CREATE INDEX "OffsitePayment_invoiceId_idx" ON "OffsitePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "OffsitePayment_platformInvoiceId_idx" ON "OffsitePayment"("platformInvoiceId");

-- AddForeignKey
ALTER TABLE "CourseService" ADD CONSTRAINT "CourseService_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseService" ADD CONSTRAINT "CourseService_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseService" ADD CONSTRAINT "CourseService_serviceKey_fkey" FOREIGN KEY ("serviceKey") REFERENCES "Service"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTierHold" ADD CONSTRAINT "CourseTierHold_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTierHold" ADD CONSTRAINT "CourseTierHold_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTierOverride" ADD CONSTRAINT "CourseTierOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTierOverride" ADD CONSTRAINT "CourseTierOverride_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCharge" ADD CONSTRAINT "SeatCharge_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCharge" ADD CONSTRAINT "SeatCharge_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCap" ADD CONSTRAINT "UsageCap_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvoiceLine" ADD CONSTRAINT "PlatformInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_platformInvoiceId_fkey" FOREIGN KEY ("platformInvoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "PaymentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffsitePayment" ADD CONSTRAINT "OffsitePayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffsitePayment" ADD CONSTRAINT "OffsitePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffsitePayment" ADD CONSTRAINT "OffsitePayment_platformInvoiceId_fkey" FOREIGN KEY ("platformInvoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

