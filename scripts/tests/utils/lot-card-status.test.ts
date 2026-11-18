import { describe, it, expect } from 'vitest';
import {
  clientPropertyKey,
  getLotCallingCardStatus,
  isClientPropertyClosed,
  sortClientPropertiesForDisplay,
} from '@/lib/utils/lot-card-status';
import type { ClientProperty } from '@/lib/types/client';

function createMockProperty(overrides: Partial<ClientProperty> = {}): ClientProperty {
  return {
    property_id: 'prop-123',
    project_area_id: 'area-1',
    boundary: null,
    location: 'Project A',
    block_number: 4,
    lot_number: 12,
    area_size: 150,
    price_per_sqm: 4000,
    status: 'Sold',
    title_number: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    is_archived: false,
    archived_at: null,
    account_id: 'acc-123',
    ...overrides,
  };
}

describe('getLotCallingCardStatus', () => {
  it('derives status for titled lot in Legal domain', () => {
    const prop = createMockProperty({
      has_title: true,
      title_id: 'title-1',
      title_status: 'Ready for Claim',
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Ready for Claim');
    expect(status.tone).toBe('teal');
    expect(status.detail).toBe('Original title in vault');
  });

  it('derives status for lot cleared by Billing awaiting Legal intake', () => {
    const prop = createMockProperty({
      cleared_at: '2026-10-15T08:00:00Z',
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Cleared by Billing');
    expect(status.tone).toBe('info');
    expect(status.detail).toContain('Since');
  });

  it('derives status for Active account in good standing', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'current',
        accountStatus: 'Active',
        overdueNoticeStage: 'none',
        monthsOverdue: 0,
        daysUntilDue: 18,
        currentTermDue: 5000,
        arrearsPrincipal: 0,
        totalPenaltyDue: 0,
        totalPayableNow: 5000,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Active');
    expect(status.tone).toBe('success');
    expect(status.progress).toBe(50);
    expect(status.trailing).toContain('5,000 due');
  });

  it('derives status for Due Soon account within 7 days of due date', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'due_soon',
        accountStatus: 'Active',
        overdueNoticeStage: 'none',
        monthsOverdue: 0,
        daysUntilDue: 4,
        currentTermDue: 5000,
        arrearsPrincipal: 0,
        totalPenaltyDue: 0,
        totalPayableNow: 5000,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Due in 4d');
    expect(status.tone).toBe('warning');
    expect(status.trailing).toContain('5,000 due');
  });

  it('derives status for Overdue account under 3 months with warning tone', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Active',
        overdueNoticeStage: 'none',
        monthsOverdue: 2,
        daysUntilDue: 0,
        currentTermDue: 5000,
        arrearsPrincipal: 10000,
        totalPenaltyDue: 700,
        totalPayableNow: 15700,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
        lastPaymentDate: '2026-08-25',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('2m Overdue');
    expect(status.tone).toBe('warning');
    expect(status.detail).toContain('Last paid');
    expect(status.trailing).toContain('15,700 due');
  });

  it('derives status for Overdue account at or over 3 months with destructive tone', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Delinquent',
        overdueNoticeStage: 'none',
        monthsOverdue: 4,
        daysUntilDue: 0,
        currentTermDue: 5000,
        arrearsPrincipal: 20000,
        totalPenaltyDue: 1800,
        totalPayableNow: 26800,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
        lastPaymentDate: '2026-06-25',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('4m Overdue');
    expect(status.tone).toBe('destructive');
    expect(status.trailing).toContain('26,800 due');
  });

  it('derives status for 1st Notice Served', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Delinquent',
        overdueNoticeStage: 'first_notice',
        monthsOverdue: 2,
        daysUntilDue: 0,
        currentTermDue: 5000,
        arrearsPrincipal: 10000,
        totalPenaltyDue: 700,
        totalPayableNow: 15700,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
        latestNotice: {
          stage: 'first_notice',
          noticeNumber: 1,
          noticeDate: '2026-11-01',
          title: 'First Notice',
          overdueAmount: 15700,
        },
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('1st Notice Served');
    expect(status.tone).toBe('warning');
    expect(status.detail).toContain('Sent');
    expect(status.trailing).toContain('15,700 due');
  });

  it('derives status for 2nd Notice Served', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Delinquent',
        overdueNoticeStage: 'second_notice',
        monthsOverdue: 3,
        daysUntilDue: 0,
        currentTermDue: 5000,
        arrearsPrincipal: 15000,
        totalPenaltyDue: 1200,
        totalPayableNow: 21200,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
        latestNotice: {
          stage: 'second_notice',
          noticeNumber: 2,
          noticeDate: '2026-11-05',
          title: 'Second Notice',
          overdueAmount: 21200,
        },
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('2nd Notice Served');
    expect(status.tone).toBe('warning');
    expect(status.detail).toContain('Sent');
    expect(status.trailing).toContain('21,200 due');
  });

  it('derives status for Final Demand Issued', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Delinquent',
        overdueNoticeStage: 'final_demand',
        monthsOverdue: 4,
        daysUntilDue: 0,
        currentTermDue: 5000,
        arrearsPrincipal: 20000,
        totalPenaltyDue: 1800,
        totalPayableNow: 26800,
        totalContractPrice: 600000,
        remainingBalance: 300000,
        totalCollected: 300000,
        percentPaid: 50,
        latestNotice: {
          stage: 'final_demand',
          noticeNumber: 3,
          noticeDate: '2026-11-10',
          title: 'Final Demand',
          overdueAmount: 26800,
        },
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Final Demand Issued');
    expect(status.tone).toBe('destructive');
    expect(status.detail).toContain('Sent');
    expect(status.trailing).toContain('26,800 due');
  });

  it('derives status for Matured Account', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'current',
        accountStatus: 'Matured',
        overdueNoticeStage: 'none',
        monthsOverdue: 0,
        daysUntilDue: 0,
        currentTermDue: 0,
        arrearsPrincipal: 0,
        totalPenaltyDue: 0,
        totalPayableNow: 50000,
        totalContractPrice: 600000,
        remainingBalance: 50000,
        totalCollected: 550000,
        percentPaid: 92,
        lastPaymentDate: '2026-05-10',
        maturedDate: '2026-01-25',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Matured Account');
    expect(status.tone).toBe('warning');
    expect(status.detail).toContain('Last paid');
    expect(status.trailing).toContain('50,000 payable');
  });

  it('derives status for Settled / Fully Paid awaiting clearance', () => {
    const prop = createMockProperty({
      billing_summary: {
        status: 'settled',
        accountStatus: 'Active',
        overdueNoticeStage: 'none',
        monthsOverdue: 0,
        daysUntilDue: 0,
        currentTermDue: 0,
        arrearsPrincipal: 0,
        totalPenaltyDue: 0,
        totalPayableNow: 0,
        totalContractPrice: 600000,
        remainingBalance: 0,
        totalCollected: 600000,
        percentPaid: 100,
        settledDate: '2026-11-12',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Fully Paid · Awaiting Clearance');
    expect(status.tone).toBe('info');
    expect(status.progress).toBe(100);
    expect(status.detail).toContain('Settled');
    expect(status.trailing).toBe('₱0 balance');
  });

  it('derives status for Forfeited account with redemption period', () => {
    const recentForfeit = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const formattedDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
      new Date(recentForfeit)
    );
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Forfeited',
        overdueNoticeStage: 'forfeited',
        monthsOverdue: 6,
        daysUntilDue: 0,
        currentTermDue: 0,
        arrearsPrincipal: 50000,
        totalPenaltyDue: 5000,
        totalPayableNow: 55000,
        totalContractPrice: 600000,
        remainingBalance: 150000,
        totalCollected: 450000,
        percentPaid: 75,
        forfeitedAt: recentForfeit,
        forfeitureReason: '3 months default',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Forfeited');
    expect(status.tone).toBe('destructive');
    expect(status.detail).toContain(formattedDate);
    expect(status.detail).toContain('grace left');
    expect(status.detail).not.toContain('3 months default');
    expect(status.trailing).toContain('150,000 unpaid');
  });

  it('derives status for Forfeited account when redemption expired', () => {
    const expiredForfeit = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const formattedDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
      new Date(expiredForfeit)
    );
    const prop = createMockProperty({
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Forfeited',
        overdueNoticeStage: 'forfeited',
        monthsOverdue: 8,
        daysUntilDue: 0,
        currentTermDue: 0,
        arrearsPrincipal: 50000,
        totalPenaltyDue: 5000,
        totalPayableNow: 55000,
        totalContractPrice: 600000,
        remainingBalance: 150000,
        totalCollected: 450000,
        percentPaid: 75,
        forfeitedAt: expiredForfeit,
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Forfeited');
    expect(status.tone).toBe('destructive');
    expect(status.detail).toBe(`${formattedDate} · ₱150,000 unpaid`);
  });

  it('falls back to property pricing for raw subdivision lot', () => {
    const prop = createMockProperty({
      status: 'Open',
      account_id: null,
      billing_summary: null,
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Open');
    expect(status.tone).toBe('success');
    expect(status.detail).toContain('TCP');
  });

  it('shows concise forfeiture date and unpaid balance for reopened forfeited accounts', () => {
    const recentForfeit = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const reopenedAt = new Date().toISOString();
    const fmt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });
    const prop = createMockProperty({
      status: 'Reserved',
      account_id: 'acc-old-forfeited',
      account_status: 'Forfeited',
      reopened_at: reopenedAt,
      billing_summary: {
        status: 'overdue',
        accountStatus: 'Forfeited',
        overdueNoticeStage: 'forfeited',
        monthsOverdue: 4,
        daysUntilDue: 0,
        currentTermDue: 0,
        arrearsPrincipal: 20000,
        totalPenaltyDue: 1000,
        totalPayableNow: 21000,
        totalContractPrice: 600000,
        remainingBalance: 150000,
        totalCollected: 450000,
        percentPaid: 75,
        forfeitedAt: recentForfeit,
        forfeitureReason: 'Defaulted after final demand',
      },
    });
    const status = getLotCallingCardStatus(prop);
    expect(status.label).toBe('Forfeited');
    expect(status.tone).toBe('destructive');
    expect(status.progress).toBeUndefined();
    expect(status.detail).toBe(`${fmt.format(new Date(recentForfeit))} · ₱150,000 unpaid`);
  });
});

describe('isClientPropertyClosed and sortClientPropertiesForDisplay', () => {
  it('flags released titles and forfeited accounts as closed, leaving active and in-progress lots open', () => {
    const released = createMockProperty({
      property_id: 'prop-released',
      account_id: 'acc-rel',
      account_status: 'Active',
      has_title: true,
      title_id: 'title-rel',
      title_status: 'Released',
    });
    const inLegal = createMockProperty({
      property_id: 'prop-legal',
      account_id: 'acc-leg',
      account_status: 'Active',
      has_title: true,
      title_id: 'title-leg',
      title_status: 'Ready for Claim',
    });
    const forfeited = createMockProperty({
      property_id: 'prop-forf',
      status: 'Reserved',
      account_id: 'acc-old',
      account_status: 'Forfeited',
    });
    const reReserved = createMockProperty({
      property_id: 'prop-forf',
      status: 'Reserved',
      account_id: 'acc-new',
      account_status: 'Active',
    });

    expect(isClientPropertyClosed(released)).toBe(true);
    expect(isClientPropertyClosed(forfeited)).toBe(true);
    expect(isClientPropertyClosed(inLegal)).toBe(false);
    expect(isClientPropertyClosed(reReserved)).toBe(false);
  });

  it('orders closed (released/forfeited) cards last while keeping both accounts for a re-reserved lot', () => {
    const released = createMockProperty({
      property_id: 'prop-1',
      account_id: 'acc-1',
      account_status: 'Active',
      has_title: true,
      title_id: 'title-1',
      title_status: 'Released',
    });
    const oldForfeited = createMockProperty({
      property_id: 'prop-2',
      status: 'Reserved',
      account_id: 'acc-2-old',
      account_status: 'Forfeited',
    });
    const activeReReserved = createMockProperty({
      property_id: 'prop-2',
      status: 'Reserved',
      account_id: 'acc-2-new',
      account_status: 'Active',
    });
    const activeOther = createMockProperty({
      property_id: 'prop-3',
      status: 'Reserved',
      account_id: 'acc-3',
      account_status: 'Active',
    });

    const sorted = sortClientPropertiesForDisplay([
      released,
      oldForfeited,
      activeReReserved,
      activeOther,
    ]);

    expect(sorted.map((p) => p.account_id)).toEqual([
      'acc-2-new',
      'acc-3',
      'acc-1',
      'acc-2-old',
    ]);
    expect(clientPropertyKey(activeReReserved)).not.toBe(clientPropertyKey(oldForfeited));
  });
});
