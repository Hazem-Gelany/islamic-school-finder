import { z } from 'zod';

const blank = z.literal('');
const text = (max: number) => z.string().trim().max(max).default('');
const url = z.string().trim().url('Enter a full web address starting with http:// or https://').refine((u) => /^https?:\/\//i.test(u), 'Must start with http:// or https://').or(blank);
const id = z.number().int().positive();

export const translationSchema = z.object({
  language_code: z.string().regex(/^[a-z]{2,3}$/),
  name: z.string().trim().min(1, 'School name is required').max(200),
  description: text(5000), admission_information: text(5000), islamic_studies_description: text(3000),
  quran_description: text(3000), arabic_description: text(3000),
});
export const feeSchema = z.object({
  id: z.string().uuid().optional(),
  fee_category_id: id,
  grade_level_id: id.nullable().optional(),
  amount: z.number().min(0, 'Amount cannot be negative').max(1_000_000_000),
  currency_code: z.string().length(3, 'Use a 3-letter currency code'),
  period: z.enum(['year', 'term', 'month', 'one_time']),
});

export const schoolSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens'),
  status: z.enum(['draft', 'pending', 'active', 'archived', 'suspended']),
  country_id: id, region_id: id.nullable(), city_id: id, school_type_id: id.nullable(),
  gender_policy: z.enum(['boys', 'girls', 'mixed']).nullable(),
  address: text(500), postal_code: text(20),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90).nullable(),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180).nullable(),
  phone: z.string().trim().regex(/^[+()\d\s.-]{6,30}$/, 'Enter a valid phone number').or(blank),
  email: z.string().trim().email('Enter a valid email address').or(blank),
  website: url, admissions_url: url,
  social_links: z.record(z.string(), url),
  founded_year: z.number().int().min(1800).max(new Date().getFullYear()).nullable(),
  student_capacity: z.number().int().positive().max(100000).nullable(),
  has_boarding: z.boolean(), has_transport: z.boolean(), offers_quran: z.boolean(), offers_arabic: z.boolean(),
  offers_islamic_studies: z.boolean(), scholarships_available: z.boolean(),
  currency_code: z.string().length(3).nullable(),
  verification_status: z.enum(['community_added', 'information_checked', 'school_verified', 'school_managed']),
  verification_source: text(300), verification_notes: text(2000),
  translations: z.array(translationSchema).min(1, 'Add the school name in at least one language'),
  curriculum_ids: z.array(id), language_codes: z.array(z.string()), facility_ids: z.array(id), grade_level_ids: z.array(id),
  fees: z.array(feeSchema),
}).superRefine((v, ctx) => {
  if ((v.latitude === null) !== (v.longitude === null)) ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Enter both latitude and longitude, or leave both empty' });
  if (v.fees.length && !v.currency_code) ctx.addIssue({ code: 'custom', path: ['currency_code'], message: 'Choose a currency' });
});
export type SchoolPayload = z.infer<typeof schoolSchema>;
