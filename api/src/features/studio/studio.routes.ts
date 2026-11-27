import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import type { ZodTypeAny } from 'zod';
import type { AppEnv } from '../../type/binding';
import { authMiddleware, requireAdmin } from '../../core/middleware/auth.middleware';
import {
  dataClient,
  checked,
  requiredRecord,
  submitEnquiry,
  upload,
  workspace,
} from './studio.service';
import {
  clientSchema,
  clientUpdateSchema,
  enquirySchema,
  enquiryUpdateSchema,
  idSchema,
  projectSchema,
  projectUpdateSchema,
  workSchema,
  workUpdateSchema,
  CLIENT_COLUMNS,
  ENQUIRY_COLUMNS,
  PROJECT_COLUMNS,
  WORK_COLUMNS,
  MAX_FILE_SIZE,
  PRIVATE_BUCKET,
} from './studio.types';

const validate = <T extends ZodTypeAny>(schema: T) =>
  zValidator('json', schema, (result) => {
    if (!result.success)
      throw new HTTPException(400, { message: 'Invalid request body. Check the supplied fields.' });
  });
const id = (value: string) => {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new HTTPException(400, { message: 'Invalid record ID.' });
  return result.data;
};
const limit = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: (c) => c.json({ message: 'Request body is too large.', statusCode: 413 }, 413),
  });

export const publicStudioRouter = new Hono<AppEnv>();
publicStudioRouter.get('/portfolio', async (c) => {
  const db = dataClient(c.env);
  return c.json({
    works: checked(
      await db
        .from('studio_works')
        .select(WORK_COLUMNS)
        .eq('published', true)
        .order('sort_order')
        .order('created_at')
        .limit(500),
    ),
  });
});
publicStudioRouter.post('/enquiries', limit(16 * 1024), validate(enquirySchema), async (c) => {
  c.header('Cache-Control', 'no-store');
  const input = c.req.valid('json');
  // Honeypot submissions get the same response without touching storage.
  if (!input.website) await submitEnquiry(dataClient(c.env), input);
  return c.json({ message: 'Your enquiry has been sent. The studio will be in touch.' }, 201);
});

export const studioRouter = new Hono<AppEnv>();
studioRouter.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
studioRouter.use('*', authMiddleware());
studioRouter.get('/', async (c) =>
  c.json(await workspace(dataClient(c.env, c.get('accessToken')), c.get('user'))),
);
// Exact empty-path route is handled as well when mounted without trailing slash.
studioRouter.get('/files/:id/download', async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  const file = requiredRecord<{ storage_path: string; name: string; mime_type: string }>(
    await db
      .from('studio_files')
      .select('storage_path,name,mime_type')
      .eq('id', id(c.req.param('id')))
      .maybeSingle(),
  );
  const preview = c.req.query('preview') === 'true';
  if (preview && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mime_type))
    throw new HTTPException(400, { message: 'Only JPG, PNG, and WebP images can be previewed.' });
  const result = await db.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(file.storage_path, 60, preview ? undefined : { download: file.name });
  if (result.error || !result.data?.signedUrl)
    throw new HTTPException(503, { message: 'Unable to prepare this download. Please try again.' });
  return c.json({ url: result.data.signedUrl });
});
studioRouter.use('*', requireAdmin());
studioRouter.use('*', async (c, next) => {
  if (
    !['/files', '/portfolio-image'].some((p) => c.req.path.endsWith(p)) ||
    c.req.method !== 'POST'
  )
    return limit(32 * 1024)(c, next);
  return limit(MAX_FILE_SIZE + 64 * 1024)(c, next);
});
studioRouter.post('/clients', validate(clientSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json(
    {
      client: requiredRecord(
        await db.from('studio_clients').insert(c.req.valid('json')).select(CLIENT_COLUMNS).single(),
      ),
    },
    201,
  );
});
studioRouter.patch('/clients/:id', validate(clientUpdateSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json({
    client: requiredRecord(
      await db
        .from('studio_clients')
        .update(c.req.valid('json'))
        .eq('id', id(c.req.param('id')))
        .select(CLIENT_COLUMNS)
        .maybeSingle(),
    ),
  });
});
studioRouter.post('/projects', validate(projectSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json(
    {
      project: requiredRecord(
        await db
          .from('studio_projects')
          .insert(c.req.valid('json'))
          .select(PROJECT_COLUMNS)
          .single(),
      ),
    },
    201,
  );
});
studioRouter.patch('/projects/:id', validate(projectUpdateSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json({
    project: requiredRecord(
      await db
        .from('studio_projects')
        .update(c.req.valid('json'))
        .eq('id', id(c.req.param('id')))
        .select(PROJECT_COLUMNS)
        .maybeSingle(),
    ),
  });
});
studioRouter.patch('/enquiries/:id', validate(enquiryUpdateSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  const enquiryId = id(c.req.param('id'));
  const input = c.req.valid('json');
  // One RPC transaction prevents notes/status from being partially saved.
  checked(
    await db.rpc('studio_update_enquiry', {
      enquiry_id: enquiryId,
      new_status: input.status ?? null,
      new_notes: input.internal_notes ?? null,
    }),
  );
  const enquiry = requiredRecord<Record<string, unknown>>(
    await db.from('studio_enquiries').select(ENQUIRY_COLUMNS).eq('id', enquiryId).maybeSingle(),
  );
  const note = checked<{ internal_notes: string } | null>(
    await db
      .from('studio_enquiry_notes')
      .select('internal_notes')
      .eq('enquiry_id', enquiryId)
      .maybeSingle(),
  );
  return c.json({ enquiry: { ...enquiry, internal_notes: note?.internal_notes ?? '' } });
});
studioRouter.post('/works', validate(workSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json(
    {
      work: requiredRecord(
        await db.from('studio_works').insert(c.req.valid('json')).select(WORK_COLUMNS).single(),
      ),
    },
    201,
  );
});
studioRouter.patch('/works/:id', validate(workUpdateSchema), async (c) => {
  const db = dataClient(c.env, c.get('accessToken'));
  return c.json({
    work: requiredRecord(
      await db
        .from('studio_works')
        .update(c.req.valid('json'))
        .eq('id', id(c.req.param('id')))
        .select(WORK_COLUMNS)
        .maybeSingle(),
    ),
  });
});
studioRouter.post('/files', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HTTPException(400, { message: 'Choose a file to upload.' });
  }
  const file = form.get('file');
  const projectId = form.get('project_id');
  if (!file || typeof file === 'string' || typeof projectId !== 'string')
    throw new HTTPException(400, { message: 'Choose a file and a project.' });
  return c.json(await upload(dataClient(c.env, c.get('accessToken')), file, id(projectId)), 201);
});
studioRouter.post('/portfolio-image', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HTTPException(400, { message: 'Choose an image to upload.' });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string')
    throw new HTTPException(400, { message: 'Choose an image to upload.' });
  return c.json(await upload(dataClient(c.env, c.get('accessToken')), file), 201);
});
