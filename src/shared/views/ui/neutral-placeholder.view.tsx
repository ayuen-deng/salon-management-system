import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Construction } from 'lucide-react';

interface NeutralPlaceholderViewProps {
  title: string;
  role: string;
}

export function NeutralPlaceholderView({ title, role }: NeutralPlaceholderViewProps) {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card className="border-[#EDEFF3] shadow-xs bg-white">
        <CardHeader className="border-b border-[#EDEFF3] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Construction className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">{title}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{role} Workspace Module</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-12 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">This page is being built</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            This operational module is scheduled for implementation in its role-specific build prompt per the project roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
