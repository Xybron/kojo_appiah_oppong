import { z } from 'zod';

const short = (max: number) => z.string().trim().max(max);
const required = (max: number) => short(max).min(1);
export const idSchema = z.string().uuid();
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const enquirySchema = z
  .object({
    name: required(120),
    email: emailSchema,
    interest: required(160),
    message: required(4000),
    website: short(200).optional(),
  })
  .strict();
export const clientSchema = z
  .object({ name: required(120), email: emailSchema, company: short(160).default('') })
  .strict();
export const clientUpdateSchema = clientSchema
  .extend({ company: clientSchema.shape.company.removeDefault() })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const projectSchema = z
  .object({
    client_id: idSchema,
    title: required(160),
    description: short(4000).default(''),
    status: z.enum(['planning', 'in_progress', 'review', 'completed']).default('planning'),
    next_step: short(1000).default(''),
    due_date: z.string().date().nullable().default(null),
  })
  .strict();
export const projectUpdateSchema = projectSchema
  .extend({
    description: projectSchema.shape.description.removeDefault(),
    status: projectSchema.shape.status.removeDefault(),
    next_step: projectSchema.shape.next_step.removeDefault(),
    due_date: projectSchema.shape.due_date.removeDefault(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export const enquiryUpdateSchema = z
  .object({
    status: z.enum(['new', 'in_progress', 'closed']).optional(),
    internal_notes: short(8000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const imageUrl = required(2048).refine((v) => {
  if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(v) && !v.includes('..')) return true;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Use an HTTPS image URL or a local /images/ path.');
export const workSchema = z
  .object({
    title: required(160),
    discipline: z.enum(['Fine art', 'Architecture', 'Fashion', 'Advertising']),
    image_url: imageUrl,
    alt: required(500),
    description: short(4000).default(''),
    width: z.number().int().min(1).max(20000).default(1600),
    height: z.number().int().min(1).max(20000).default(1200),
    sort_order: z.number().int().min(0).max(100000).default(0),
    published: z.boolean().default(false),
  })
  .strict();
export const workUpdateSchema = workSchema
  .extend({
    description: workSchema.shape.description.removeDefault(),
    width: workSchema.shape.width.removeDefault(),
    height: workSchema.shape.height.removeDefault(),
    sort_order: workSchema.shape.sort_order.removeDefault(),
    published: workSchema.shape.published.removeDefault(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);
export type EnquiryInput = z.infer<typeof enquirySchema>;
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const PUBLIC_BUCKET = 'studio-portfolio';
export const PRIVATE_BUCKET = 'studio-project-files';
export const FILE_COLUMNS = 'id,project_id,name,mime_type,size,created_at';
export const CLIENT_COLUMNS = 'id,name,email,company,created_at';
export const ENQUIRY_COLUMNS = 'id,name,email,interest,message,status,created_at';
export const PROJECT_COLUMNS =
  'id,client_id,title,description,status,next_step,due_date,created_at,updated_at';
export const WORK_COLUMNS =
  'id,title,discipline,image_url,alt,description,width,height,sort_order,published';
