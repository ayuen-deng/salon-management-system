import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { status: 'error', message: 'Missing Supabase environment variables' },
      { status: 500 }
    );
  }

  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Best-effort keep-alive ping against public.app_user
    const { data, error } = await client.from('app_user').select('id').limit(1);

    const latencyMs = Date.now() - t0;

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'error',
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
      service: 'salon-management-system',
      environment: process.env.NODE_ENV || 'development',
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown health check failure';
    return NextResponse.json(
      { status: 'error', message, latencyMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}
