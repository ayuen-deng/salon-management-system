'use client';

import React from 'react';

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-busy="true"
      className={`bg-slate-200/80 rounded-md animate-pulse motion-reduce:animate-none ${className}`}
      {...props}
    />
  );
}

export function Spinner({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5 border-2',
    md: 'w-4 h-4 border-2',
    lg: 'w-6 h-6 border-[2.5px]',
  };

  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-slate-200 border-t-[#1F4FD8] animate-spin motion-reduce:animate-none ${sizeClasses[size]} ${className}`}
    />
  );
}

export function ButtonLoading({
  isLoading,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingText?: string;
}) {
  return (
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading ? 'true' : undefined}
      className={`relative inline-flex items-center justify-center transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isLoading && (
        <span className="inline-flex items-center gap-1.5 mr-2">
          <Spinner size="sm" className="border-t-current" />
          {loadingText && <span>{loadingText}</span>}
        </span>
      )}
      <span className={isLoading && loadingText ? 'hidden' : 'inline-flex items-center gap-1.5'}>
        {children}
      </span>
    </button>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="bg-white border border-[#E2E7EF] rounded-2xl p-5 space-y-3 animate-pulse">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-36" />
      <div className="pt-2 border-t border-slate-100 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-[#E2E7EF] rounded-2xl overflow-hidden animate-pulse">
      <div className="p-4 bg-slate-50 border-b border-[#E2E7EF] flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="p-4 flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-3.5 bg-white border border-[#E2E7EF] rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white border border-[#E2E7EF] rounded-2xl p-5 space-y-4 animate-pulse">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImageSkeleton({
  src,
  alt,
  className = '',
  aspectRatio = 'aspect-[4/3]',
}: {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${aspectRatio} ${className}`}>
      {!loaded && !error && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      )}
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
          No photo
        </div>
      )}
    </div>
  );
}
