'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';

export function HrPortalView() {
  const staffList = [
    { name: 'Grace Atuhaire', role: 'Staff Stylist', phone: '+256772000005', status: 'Active', hours: '08:00 - 17:00' },
    { name: 'Sarah Kobusingye', role: 'Staff Stylist', phone: '+256772000006', status: 'Active', hours: '09:00 - 18:00' },
    { name: 'Peter Byamukama', role: 'Barber', phone: '+256772000007', status: 'Active', hours: '08:00 - 17:00' },
    { name: 'Rose Kyomugisha', role: 'Wash Assistant', phone: '+256772000008', status: 'Active', hours: '08:00 - 17:00' },
    { name: 'Mary Namubiru', role: 'Receptionist', phone: '+256772000004', status: 'Active', hours: '07:45 - 19:00' },
    { name: 'Joan Tumusiime', role: 'Branch Manager', phone: '+256772000002', status: 'Active', hours: '08:00 - 20:00' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">People & HR Management</h1>
          <p className="text-muted-foreground">David Kato • Scoped People and Access Operations (No Financial Data)</p>
        </div>
        <Button size="sm">Add Staff Member</Button>
      </div>

      {/* Staff Roster Grid */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-xl font-bold text-slate-900">Active Salon Staff & Rota</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs  text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Weekly Rota</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600">{s.role}</td>
                    <td className="py-3 px-4 tabular-nums text-xs">{s.phone}</td>
                    <td className="py-3 px-4 text-xs">{s.hours}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button className="text-xs text-primary font-medium hover:underline">Reset PIN</button>
                      <button className="text-xs text-slate-500 font-medium hover:underline">Edit Rota</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
