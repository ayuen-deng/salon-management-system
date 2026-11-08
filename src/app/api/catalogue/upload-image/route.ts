import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const serviceId = formData.get('serviceId') as string | null;
    const actorRole = (formData.get('actorRole') as string) || 'manager';
    const actorId = (formData.get('actorId') as string) || 'c0000000-0000-0000-0000-000000000002';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No image file provided' }, { status: 400 });
    }

    // Size limit 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File exceeds 5 MB limit' }, { status: 400 });
    }

    // MIME type check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPG, PNG or WebP images are allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate minimum dimensions: minimum 800px on short side
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ success: false, error: 'Invalid image format' }, { status: 400 });
    }

    const shortSide = Math.min(metadata.width, metadata.height);
    if (shortSide < 800) {
      return NextResponse.json({
        success: false,
        error: `Image short side is ${shortSide}px. Minimum required is 800px for crisp kiosk display.`
      }, { status: 400 });
    }

    // Optimize images:
    // 1. 4:3 card version (e.g. 1200x900)
    const cardBuffer = await sharp(buffer)
      .resize(1200, 900, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    // 2. 1:1 thumbnail version (e.g. 300x300)
    const thumbBuffer = await sharp(buffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    const timestamp = Date.now();
    const cleanId = (serviceId || 'temp').replace(/[^a-zA-Z0-9_-]/g, '');
    const cardPath = `services/${cleanId}_${timestamp}_4x3.webp`;
    const thumbPath = `services/${cleanId}_${timestamp}_thumb.webp`;

    const client = getServiceRoleClient();

    // Upload card image
    const { error: cardErr } = await client.storage
      .from('catalogue-images')
      .upload(cardPath, cardBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (cardErr) {
      return NextResponse.json({ success: false, error: cardErr.message }, { status: 500 });
    }

    // Upload thumb image
    await client.storage
      .from('catalogue-images')
      .upload(thumbPath, thumbBuffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    // Public URL
    const { data: pubData } = client.storage
      .from('catalogue-images')
      .getPublicUrl(cardPath);

    const imageUrl = pubData.publicUrl;

    // If serviceId is provided, persist immediately into service_metadata setting and log audit
    if (serviceId) {
      const { data: metaSetting } = await client
        .from('app_setting')
        .select('value')
        .eq('key', 'service_metadata')
        .maybeSingle();

      const metaMap = (metaSetting?.value as Record<string, any>) || {};
      const prev = metaMap[serviceId] || {};
      metaMap[serviceId] = {
        ...prev,
        image_url: imageUrl,
      };

      if (metaSetting) {
        await client.from('app_setting').update({ value: metaMap }).eq('key', 'service_metadata');
      } else {
        await client.from('app_setting').insert({ key: 'service_metadata', value: metaMap });
      }

      // Write audit log row (category 'catalogue')
      const { data: bday } = await client.from('business_day').select('id').limit(1).single();
      await client.from('audit_log').insert({
        actor_id: actorId,
        actor_role: actorRole,
        action: 'IMAGE_UPDATED',
        entity_type: 'service',
        entity_id: serviceId,
        category: 'catalogue',
        business_day_id: bday?.id,
        before: { image_url: prev.image_url || null },
        after: { image_url: imageUrl },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        cardPath,
        thumbPath,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
