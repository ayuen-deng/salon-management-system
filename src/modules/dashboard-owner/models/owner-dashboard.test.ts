import { describe, it, expect } from 'vitest';
import { OwnerDashboardRepository } from './owner-dashboard.repository';

describe('OwnerDashboardRepository (Live Remote DB Integration)', () => {
  const repo = new OwnerDashboardRepository();

  it('queries live owner summary data from remote Supabase', async () => {
    const res = await repo.getDashboardSummary();
    if (!res.success) {
      console.error('Repository Error:', res.error);
    }
    expect(res.success).toBe(true);
    if (!res.success) return;

    const data = res.data;
    expect(data.business_date).toBeDefined();
    expect(['open', 'closing', 'closed', 'not_opened']).toContain(data.day_status);
    expect(typeof data.revenue_today_ugx).toBe('number');
    expect(typeof data.revenue_momo_ugx).toBe('number');
    expect(typeof data.revenue_cash_ugx).toBe('number');
    expect(typeof data.momo_verified_pct).toBe('number');
    expect(data.momo_verified_pct).toBeGreaterThanOrEqual(0);
    expect(data.momo_verified_pct).toBeLessThanOrEqual(100);

    // Truth test: revenue is never negative
    expect(data.revenue_today_ugx).toBeGreaterThanOrEqual(0);

    // Staff present and expected
    expect(data.staff.present).toBeGreaterThanOrEqual(0);
    expect(data.staff.expected).toBeGreaterThan(0);

    // Time sanity: last_activity_iso must not be in the future
    const lastActivityTime = new Date(data.last_activity_iso).getTime();
    const nowTime = Date.now() + 5000; // 5s clock skew tolerance
    expect(lastActivityTime).toBeLessThanOrEqual(nowTime);

    // 4-week same-weekday average
    if (data.comp_count > 0) {
      expect(data.avg_same_weekday_ugx).not.toBeNull();
      expect(data.avg_same_weekday_ugx).toBeGreaterThan(0);
    }

    // Review items
    expect(Array.isArray(data.review_items)).toBe(true);
    expect(Array.isArray(data.revenue_chart)).toBe(true);
    expect(data.revenue_chart.length).toBe(7);
  }, 60000);
});
