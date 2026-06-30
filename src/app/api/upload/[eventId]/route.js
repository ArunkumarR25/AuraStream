import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role key so uploads bypass RLS (server-side only, never exposed to browser)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UPLOAD_SECRET = process.env.UPLOAD_SECRET;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * POST /api/upload/[eventId]
 *
 * Accepts multipart/form-data with one or more "file" fields.
 * Authentication: ?secret=YOUR_UPLOAD_SECRET  (or X-Upload-Secret header)
 */
export async function POST(request, { params }) {
  const { eventId } = await params;
  console.log(`[upload] START — eventId: ${eventId}`);

  // ── 1. Auth check ─────────────────────────────────────────
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');
  const secretHeader = request.headers.get('x-upload-secret');
  const providedSecret = secretParam || secretHeader;

  // Bypass secret check if request comes from our own website (same-origin browser uploads)
  const host = request.headers.get('host') || '';
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const isSameOrigin = (origin && origin.includes(host)) || (referer && referer.includes(host));

  console.log(`[upload] secret check — provided: ${!!providedSecret}, expected: ${!!UPLOAD_SECRET}, isSameOrigin: ${isSameOrigin}`);

  if (UPLOAD_SECRET && !isSameOrigin && providedSecret !== UPLOAD_SECRET) {
    console.warn(`[upload] REJECTED — secret mismatch`);
    return NextResponse.json(
      { error: 'Unauthorized: invalid upload secret' },
      { status: 401 }
    );
  }

  // ── 2. Verify event exists ────────────────────────────────
  const { data: event, error: eventErr } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single();

  if (eventErr || !event) {
    console.error(`[upload] Event not found: ${eventId}`, eventErr?.message);
    return NextResponse.json(
      { error: 'Event not found' },
      { status: 404 }
    );
  }

  // ── 3. Parse multipart body ───────────────────────────────
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error(`[upload] Failed to parse formData:`, err.message);
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('file');
  console.log(`[upload] files in form: ${files?.length ?? 0}`);

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: 'No "file" field found in form data' },
      { status: 400 }
    );
  }

  // ── 4. Upload each file ───────────────────────────────────
  const results = [];
  const errors = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    // Validate type
    if (!file.type.startsWith('image/')) {
      errors.push({ name: file.name, error: 'Not an image file' });
      continue;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      errors.push({ name: file.name, error: 'File exceeds 20 MB limit' });
      continue;
    }

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const storagePath = `events/${eventId}/${timestamp}-${random}.${ext}`;

      console.log(`[upload] uploading "${file.name}" → ${storagePath}`);

      // Convert File to ArrayBuffer for Supabase upload
      const buffer = await file.arrayBuffer();

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('wedding-photos')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('wedding-photos')
        .getPublicUrl(storagePath);

      // Insert DB record (triggers Supabase Realtime → guest portal updates live)
      const { data: dbRecord, error: dbErr } = await supabaseAdmin
        .from('event_images')
        .insert({
          event_id: eventId,
          storage_path: storagePath,
          public_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      console.log(`[upload] SUCCESS — stored: ${storagePath}`);
      results.push({
        name: file.name,
        id: dbRecord.id,
        public_url: urlData.publicUrl,
        storage_path: storagePath,
      });
    } catch (err) {
      console.error(`[upload] ERROR uploading "${file.name}":`, err.message);
      errors.push({ name: file.name, error: err.message });
    }
  }

  console.log(`[upload] DONE — ${results.length} ok, ${errors.length} errors`);

  return NextResponse.json(
    {
      uploaded: results.length,
      errors: errors.length,
      results,
      errors,
    },
    { status: results.length > 0 ? 200 : 500 }
  );
}

// Next.js App Router route segment config
// Sets max execution time to 60s for large file uploads
export const maxDuration = 60;
// Dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';
