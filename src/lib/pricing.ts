import { AutonomyLevel, PricingPolicy } from "@prisma/client";

export type PricingDecision = {
  policyId: string | null;
  level: AutonomyLevel;
  withinPolicy: boolean;
  requiresExplicitApproval: boolean;
  reason:
    | "within_autonomous_band"
    | "within_commercial_limits"
    | "below_minimum"
    | "above_maximum"
    | "currency_mismatch"
    | "missing_policy"
    | "missing_amount";
};

export function evaluatePricing(
  policy: PricingPolicy | null,
  amountCents: number | undefined,
  currency: string,
): PricingDecision {
  if (amountCents === undefined) {
    return {
      policyId: policy?.id ?? null,
      level: AutonomyLevel.A2,
      withinPolicy: false,
      requiresExplicitApproval: true,
      reason: "missing_amount",
    };
  }

  if (!policy) {
    return {
      policyId: null,
      level: AutonomyLevel.A2,
      withinPolicy: false,
      requiresExplicitApproval: true,
      reason: "missing_policy",
    };
  }

  if (policy.currency !== currency) {
    return {
      policyId: policy.id,
      level: AutonomyLevel.A2,
      withinPolicy: false,
      requiresExplicitApproval: true,
      reason: "currency_mismatch",
    };
  }

  if (amountCents < policy.minimumCents) {
    return {
      policyId: policy.id,
      level: AutonomyLevel.A2,
      withinPolicy: false,
      requiresExplicitApproval: true,
      reason: "below_minimum",
    };
  }

  if (policy.maximumCents !== null && amountCents > policy.maximumCents) {
    return {
      policyId: policy.id,
      level: AutonomyLevel.A2,
      withinPolicy: false,
      requiresExplicitApproval: true,
      reason: "above_maximum",
    };
  }

  const autonomousMin = policy.autonomousMinCents ?? policy.minimumCents;
  const autonomousMax = policy.autonomousMaxCents ?? policy.maximumCents;
  const insideAutonomousMin = amountCents >= autonomousMin;
  const insideAutonomousMax = autonomousMax === null || amountCents <= autonomousMax;

  if (insideAutonomousMin && insideAutonomousMax) {
    return {
      policyId: policy.id,
      level: AutonomyLevel.A1,
      withinPolicy: true,
      requiresExplicitApproval: false,
      reason: "within_autonomous_band",
    };
  }

  return {
    policyId: policy.id,
    level: AutonomyLevel.A2,
    withinPolicy: true,
    requiresExplicitApproval: true,
    reason: "within_commercial_limits",
  };
}
