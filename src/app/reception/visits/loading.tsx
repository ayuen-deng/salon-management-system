import React from 'react';

export default function VisitsLoading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-pulse">
      <div className="h-20 bg-slate-100 rounded-2xl w-full" />
      <div className="h-10 bg-slate-100 rounded-xl w-64" />
      <div className="h-96 bg-slate-100 rounded-2xl w-full" />
    </div>
  );
}
