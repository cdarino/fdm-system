import { describe, expect, it } from 'vitest';
import { calculateStorageFee, STORAGE_FEE_MONTHLY_RATE } from '@/lib/storage-fee';
import type { LandTitle } from '@/lib/types/title';

function createMockTitle(overrides?: Partial<LandTitle>): LandTitle {
  return {
    title_id: '11111111-1111-1111-1111-111111111111',
    property_id: '22222222-2222-2222-2222-222222222222',
    client_id: '33333333-3333-3333-3333-333333333333',
    status: 'Ready for Claim',
    is_legacy_transferred: false,
    created_by: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateStorageFee', () => {
  it('returns not_applicable for statuses prior to Ready for Claim', () => {
    const title = createMockTitle({ status: 'Document Preparation' });
    const result = calculateStorageFee(title);

    expect(result.isApplicable).toBe(false);
    expect(result.status).toBe('not_applicable');
    expect(result.accruedFee).toBe(0);
    expect(result.monthsOverdue).toBe(0);
  });

  it('calculates within_grace when under the 1-year threshold', () => {
    const readyAt = '2025-05-10T08:00:00.000Z';
    const title = createMockTitle({
      status: 'Ready for Claim',
      created_at: readyAt,
      history: [
        {
          history_id: 'h1',
          title_id: '11111111-1111-1111-1111-111111111111',
          status: 'Ready for Claim',
          changed_at: readyAt,
          changed_by: null,
        },
      ],
    });

    const evalDate = new Date('2025-11-10T08:00:00.000Z');
    const result = calculateStorageFee(title, evalDate);

    expect(result.isApplicable).toBe(true);
    expect(result.status).toBe('within_grace');
    expect(result.isOverdue).toBe(false);
    expect(result.accruedFee).toBe(0);
    expect(result.monthsOverdue).toBe(0);
    expect(result.daysRemainingInGrace).toBeGreaterThan(0);
  });

  it('charges 1 month on the first day past the 1-year grace period', () => {
    const readyAt = '2025-05-10T08:00:00.000Z';
    const title = createMockTitle({
      status: 'Ready for Claim',
      history: [
        {
          history_id: 'h1',
          title_id: '11111111-1111-1111-1111-111111111111',
          status: 'Ready for Claim',
          changed_at: readyAt,
          changed_by: null,
        },
      ],
    });

    // 1 year and 1 day after readyAt
    const evalDate = new Date('2026-05-11T08:00:00.000Z');
    const result = calculateStorageFee(title, evalDate);

    expect(result.isOverdue).toBe(true);
    expect(result.status).toBe('overdue');
    expect(result.monthsOverdue).toBe(1);
    expect(result.accruedFee).toBe(STORAGE_FEE_MONTHLY_RATE);
  });

  it('charges 2 months when advancing into the second overdue calendar month', () => {
    const readyAt = '2025-05-10T08:00:00.000Z';
    const title = createMockTitle({
      status: 'Ready for Claim',
      history: [
        {
          history_id: 'h1',
          title_id: '11111111-1111-1111-1111-111111111111',
          status: 'Ready for Claim',
          changed_at: readyAt,
          changed_by: null,
        },
      ],
    });

    // 1 year and 1 month and 2 days after readyAt (June 12, 2026)
    const evalDate = new Date('2026-06-12T08:00:00.000Z');
    const result = calculateStorageFee(title, evalDate);

    expect(result.isOverdue).toBe(true);
    expect(result.monthsOverdue).toBe(2);
    expect(result.accruedFee).toBe(STORAGE_FEE_MONTHLY_RATE * 2);
  });

  it('freezes calculation at release date when title is Released', () => {
    const readyAt = '2024-01-01T08:00:00.000Z';
    const releasedAt = '2025-03-01T08:00:00.000Z'; // Grace period ended 2025-01-01 -> 2 months overdue as of release
    const title = createMockTitle({
      status: 'Released',
      history: [
        {
          history_id: 'h1',
          title_id: '11111111-1111-1111-1111-111111111111',
          status: 'Ready for Claim',
          changed_at: readyAt,
          changed_by: null,
        },
        {
          history_id: 'h2',
          title_id: '11111111-1111-1111-1111-111111111111',
          status: 'Released',
          changed_at: releasedAt,
          changed_by: null,
        },
      ],
    });

    // Evaluating far into the future must not increase fee beyond the frozen release date
    const futureDate = new Date('2030-01-01T00:00:00.000Z');
    const result = calculateStorageFee(title, futureDate);

    expect(result.isFrozen).toBe(true);
    expect(result.monthsOverdue).toBe(2);
    expect(result.accruedFee).toBe(STORAGE_FEE_MONTHLY_RATE * 2);
  });
});
