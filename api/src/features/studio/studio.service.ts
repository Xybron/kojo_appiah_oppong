import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../../type/binding';
import type { AuthUser } from '../auth/auth.types';
import { getSupabaseConfig } from '../../core/utils/supabase';
import {
  CLIENT_COLUMNS,
  ENQUIRY_COLUMNS,
  FILE_COLUMNS,
  PROJECT_COLUMNS,
  WORK_COLUMNS,
  MAX_FILE_SIZE,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  type EnquiryInput,
} from './studio.types';

export function dataClient(env: Bindings, token?: string) {
  const { url, key } = getSupabaseConfig(env);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
}

type Result<T> = { data: T | null; error: { code?: string; message?: string } | null };
export function checked<T>(result: Result<T>): T {
  if (result.error) {
    if (result.error.code === 'P0002')
      throw new HTTPException(404, { message: 'This record was not found.' });
    if (result.error.code === '23505')
      throw new HTTPException(409, { message: 'A record with these details already exists.' });
    if (result.error.code === '23503')
      throw new HTTPException(400, { message: 'The selected client or project no longer exists.' });
    if (result.error.code === '42501')
      throw new HTTPException(403, { message: 'You do not have permission to make this change.' });
    if (['42P01', 'PGRST205'].includes(result.error.code ?? ''))
      throw new HTTPException(503, { message: 'The studio database has not been set up yet.' });
    throw new HTTPException(503, {
      message: 'Unable to save or load studio data. Please try again.',
    });
  }
  return result.data as T;
}
export function requiredRecord<T>(result: Result<T>): NonNullable<T> {
  const record = checked(result);
  if (!record) throw new HTTPException(404, { message: 'This record was not found.' });
  return record;
}

export async function workspace(db: SupabaseClient, user: AuthUser) {
  // RLS is the authoritative ownership boundary, including direct Data API access.
  const [clientsResult, enquiriesResult, projectsResult, filesResult, worksResult] =
    await Promise.all([
      db
        .from('studio_clients')
        .select(CLIENT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(500),
      db
        .from('studio_enquiries')
        .select(ENQUIRY_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(500),
      db
        .from('studio_projects')
        .select(PROJECT_COLUMNS)
        .order('updated_at', { ascending: false })
        .limit(500),
      db
        .from('studio_files')
        .select(FILE_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(500),
      user.role === 'admin'
        ? db
            .from('studio_works')
            .select(WORK_COLUMNS)
            .order('sort_order')
            .order('created_at')
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const enquiries = checked(enquiriesResult);
  let notes: Record<string, string> = {};
  if (user.role === 'admin') {
    const rows = checked(
      await db.from('studio_enquiry_notes').select('enquiry_id,internal_notes').limit(500),
    );
    notes = Object.fromEntries(rows.map((row) => [row.enquiry_id, row.internal_notes]));
  }
  return {
    clients: checked(clientsResult),
    enquiries:
      user.role === 'admin'
        ? enquiries.map((enquiry) => ({ ...enquiry, internal_notes: notes[enquiry.id] ?? '' }))
        : enquiries,
    projects: checked(projectsResult),
    files: checked(filesResult),
    works: checked(worksResult),
  };
}

export async function submitEnquiry(db: SupabaseClient, input: EnquiryInput) {
  if (input.website) return;
  checked(
    await db.from('studio_enquiries').insert({
      name: input.name,
      email: input.email,
      interest: input.interest,
      message: input.message,
    }),
  );
}

const fileTypes: Record<string, { extension: string; magic: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': { extension: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    extension: 'png',
    magic: (b) => [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v),
  },
  'image/webp': {
    extension: 'webp',
    magic: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  },
  'application/pdf': {
    extension: 'pdf',
    magic: (b) => String.fromCharCode(...b.slice(0, 5)) === '%PDF-',
  },
  'application/zip': {
    extension: 'zip',
    magic: (b) =>
      b[0] === 80 &&
      b[1] === 75 &&
      ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6) || (b[2] === 7 && b[3] === 8)),
  },
};

export async function upload(db: SupabaseClient, file: File, projectId?: string) {
  const type = fileTypes[file.type];
  if (!file.size || file.size > MAX_FILE_SIZE)
    throw new HTTPException(400, { message: 'Choose a file between 1 byte and 15 MB.' });
  if (!type || (!projectId && !file.type.startsWith('image/')))
    throw new HTTPException(400, {
      message: projectId
        ? 'Use a JPG, PNG, WebP, PDF, or ZIP file.'
        : 'Use a JPG, PNG, or WebP image.',
    });
  if (!type.magic(new Uint8Array(await file.slice(0, 16).arrayBuffer())))
    throw new HTTPException(400, { message: 'The file contents do not match its file type.' });
  if (projectId)
    requiredRecord(await db.from('studio_projects').select('id').eq('id', projectId).maybeSingle());
  const bucket = projectId ? PRIVATE_BUCKET : PUBLIC_BUCKET;
  const path = `${projectId ?? 'work'}/${crypto.randomUUID()}.${type.extension}`;
  const result = await db.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: projectId ? '0' : '3600',
  });
  if (result.error)
    throw new HTTPException(503, {
      message: 'The file could not be uploaded. Check storage setup and try again.',
    });
  if (!projectId) return { image_url: db.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  const record = await db
    .from('studio_files')
    .insert({
      project_id: projectId,
      name: file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'File',
      mime_type: file.type,
      size: file.size,
      storage_path: path,
    })
    .select(FILE_COLUMNS)
    .single();
  if (record.error) {
    await db.storage.from(bucket).remove([path]);
    checked(record);
  }
  return { file: record.data };
}
