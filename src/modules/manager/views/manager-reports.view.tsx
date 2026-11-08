'use client';

import { useSalonLiveRefresh } from '@/shared/lib/salon-live-updates';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { StatCard } from '@/shared/views/ui/stat-card';
import {
  getManagerReportsAction,
  type ManagerReportsData,
} from '../controllers/manager-nav.actions';
import { formatUgx } from '@/shared/models/money';
import { BarChart3, TrendingUp, DollarSign, Users, Calendar, Download } from 'lucide-react';

export function ManagerReportsView() {
  const [data, setData] = useState<ManagerReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    const res = await getManagerReportsAction();
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };
  useSalonLiveRefresh(() => { void loadReports(); });


  useEffect(() => {
    loadReports();
  }, []);

  const exportReportCsv = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Cumulative Revenue (UGX)', data.totalRevenueUgx.toString()],
      ['Cash Revenue (UGX)', data.cashRevenueUgx.toString()],
      ['Mobile Money Revenue (UGX)', data.momoRevenueUgx.toString()],
      ['Total Client Visits', data.totalVisitsCount.toString()],
      ['Audited Business Days', data.businessDaysCount.toString()],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `manager_operations_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Operational & Financial Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated salon performance, payment collection breakdown, and visit volume analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportReportCsv} disabled={!data} className="text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Summary CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadReports} disabled={loading} className="text-xs h-8">
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            Calculating report metrics...
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            No report data available.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatUgx(data.totalRevenueUgx)}
              subtitle="All verified payments"
            />
            <StatCard
              title="Cash Revenue"
              value={formatUgx(data.cashRevenueUgx)}
              subtitle="Cash drawer collections"
            />
            <StatCard
              title="MoMo Revenue"
              value={formatUgx(data.momoRevenueUgx)}
              subtitle="MTN / Airtel Mobile Money"
            />
            <StatCard
              title="Total Visits"
              value={data.totalVisitsCount.toString()}
              subtitle={`Across ${data.businessDaysCount} business days`}
            />
          </div>

          {/* Breakdown Card */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Payment Method Revenue Share
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Mobile Money ({data.totalRevenueUgx > 0 ? Math.round((data.momoRevenueUgx / data.totalRevenueUgx) * 100) : 0}%)</span>
                  <span>{formatUgx(data.momoRevenueUgx)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${data.totalRevenueUgx > 0 ? (data.momoRevenueUgx / data.totalRevenueUgx) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Cash Drawer ({data.totalRevenueUgx > 0 ? Math.round((data.cashRevenueUgx / data.totalRevenueUgx) * 100) : 0}%)</span>
                  <span>{formatUgx(data.cashRevenueUgx)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full"
                    style={{ width: `${data.totalRevenueUgx > 0 ? (data.cashRevenueUgx / data.totalRevenueUgx) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
