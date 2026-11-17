import { describe, it, expect } from 'vitest';
import {
  buildClientPropertyBillingSummary,
  RawAccountBillingData,
} from '@/lib/billing/client-property-billing';

function createMockRawAccount(overrides: Partial<RawAccountBillingData> = {}): RawAccountBillingData {
  return {
    account_id: 'acc-1',
    property_id: 'prop-1',
    total_contract_price: 360000,
    remaining_balance: 180000,
    downpayment: 0,
    terms_months: 36,
    monthly_amortization: 10000,
    amortization_day: 25,
    penalty_rate_percent: 3.5,
    first_due_date: '2025-01-25',
    status: 'Active',
    created_at: '2024-12-25T00:00:00Z',
    payments: [],
    notices: [],
    ...overrides,
  };
}

describe('buildClientPropertyBillingSummary', () => {
  it('correctly maps raw account into billing summary for current account', () => {
    const raw = createMockRawAccount({
      payments: [
        {
          payment_id: 'pay-1',
          payment_date: '2025-01-20',
          amount: 10000,
          receipt_number: 'OR#101',
        },
      ],
    });

    const summary = buildClientPropertyBillingSummary(raw, '2025-01-22');
    expect(summary.accountStatus).toBe('Active');
    expect(summary.totalContractPrice).toBe(360000);
    expect(summary.totalCollected).toBe(10000);
    expect(summary.lastPaymentDate).toBe('2025-01-20');
    expect(summary.status).toBe('current');
  });

  it('correctly extracts latest notice and current notice stage', () => {
    const raw = createMockRawAccount({
      status: 'Delinquent',
      overdue_notice_stage: 'second_notice',
      notices: [
        {
          notice_id: 'not-1',
          stage: 'first_notice',
          notice_number: 1,
          notice_date: '2025-05-01',
          title: 'First Notice',
          overdue_amount: 10000,
          arrears_principal: 10000,
          penalty_due: 350,
        },
        {
          notice_id: 'not-2',
          stage: 'second_notice',
          notice_number: 2,
          notice_date: '2025-06-01',
          title: 'Second Notice',
          overdue_amount: 20000,
          arrears_principal: 20000,
          penalty_due: 1050,
        },
      ],
    });

    const summary = buildClientPropertyBillingSummary(raw, '2025-06-05');
    expect(summary.overdueNoticeStage).toBe('second_notice');
    expect(summary.latestNotice?.stage).toBe('second_notice');
    expect(summary.latestNotice?.noticeNumber).toBe(2);
    expect(summary.latestNotice?.noticeDate).toBe('2025-06-01');
  });

  it('identifies settled account and records settled date from last payment', () => {
    const raw = createMockRawAccount({
      total_contract_price: 20000,
      terms_months: 2,
      monthly_amortization: 10000,
      payments: [
        {
          payment_id: 'p1',
          payment_date: '2025-01-25',
          amount: 10000,
          receipt_number: 'OR#1',
        },
        {
          payment_id: 'p2',
          payment_date: '2025-02-25',
          amount: 10000,
          receipt_number: 'OR#2',
        },
      ],
    });

    const summary = buildClientPropertyBillingSummary(raw, '2025-03-01');
    expect(summary.status).toBe('settled');
    expect(summary.settledDate).toBe('2025-02-25');
    expect(summary.remainingBalance).toBe(0);
    expect(summary.percentPaid).toBe(100);
  });
});
