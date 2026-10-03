'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { done, fail } from '@/lib/flash';
import { friendlyError } from '@/lib/errors';

const slug = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'The URL name can only use lowercase letters, numbers and hyphens').max(80);
const names = { en: z.string().trim().min(1, 'The English name is required').max(120), ar: z.string().trim().max(120), ms: z.string().trim().max(120) };
const i18n = (p: { en: string; ar: string; ms: string }) => ({ en: p.en, ...(p.ar ? { ar: p.ar } : {}), ...(p.ms ? { ms: p.ms } : {}) });
const returnTo = (fd: FormData) => { const r = String(fd.get('return') ?? ''); return r.startsWith('/admin/settings/places') ? r : '/admin/settings/places'; };
const optId = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().positive().optional());
const UNIQUE = { '23505': 'That URL name is already used here. Choose a different one.' };
const IN_USE = { '23503': 'This place is used by schools or by other places, so it cannot be deleted.' };

export async function saveCountry(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage'); const to = returnTo(fd);
  const p = z.object({ id: optId, iso2: z.string().trim().length(2, 'Use the 2-letter country code, e.g. MY').toUpperCase(), slug, ...names, currency: z.string().trim().max(3).toUpperCase(), is_active: z.boolean() })
    .refine((v) => v.currency === '' || v.currency.length === 3, { message: 'Use a 3-letter currency code, e.g. MYR', path: ['currency'] })
    .safeParse({ id: fd.get('id'), iso2: fd.get('iso2'), slug: fd.get('slug'), en: fd.get('en'), ar: fd.get('ar') ?? '', ms: fd.get('ms') ?? '', currency: fd.get('currency') ?? '', is_active: fd.get('is_active') === 'on' });
  if (!p.success) return fail(to, p.error.issues[0].message);
  const row = { iso2: p.data.iso2, slug: p.data.slug, name_i18n: i18n(p.data), currency_code: p.data.currency || null, is_active: p.data.is_active };
  const { error } = p.data.id ? await supabase.from('countries').update(row).eq('id', p.data.id) : await supabase.from('countries').insert(row);
  if (error) return fail(to, friendlyError(error, 'Unable to save.', { '23505': 'That country code or URL name already exists.' }));
  return done(to, 'Country saved.', ['/admin/settings/places']);
}

export async function saveRegion(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage'); const to = returnTo(fd);
  const p = z.object({ id: optId, country_id: z.coerce.number().int().positive(), slug, ...names }).safeParse({ id: fd.get('id'), country_id: fd.get('country_id'), slug: fd.get('slug'), en: fd.get('en'), ar: fd.get('ar') ?? '', ms: fd.get('ms') ?? '' });
  if (!p.success) return fail(to, p.error.issues[0].message);
  const row = { country_id: p.data.country_id, slug: p.data.slug, name_i18n: i18n(p.data) };
  const { error } = p.data.id ? await supabase.from('regions').update(row).eq('id', p.data.id) : await supabase.from('regions').insert(row);
  if (error) return fail(to, friendlyError(error, 'Unable to save.', UNIQUE));
  return done(to, 'Region saved.');
}

export async function saveCity(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage'); const to = returnTo(fd);
  const coord = (min: number, max: number) => z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().min(min).max(max).optional());
  const p = z.object({ id: optId, country_id: z.coerce.number().int().positive(), region_id: optId, slug, ...names, lat: coord(-90, 90), lng: coord(-180, 180), aliases: z.string().max(1000) })
    .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Enter both latitude and longitude, or leave both empty', path: ['lat'] })
    .safeParse({ id: fd.get('id'), country_id: fd.get('country_id'), region_id: fd.get('region_id'), slug: fd.get('slug'), en: fd.get('en'), ar: fd.get('ar') ?? '', ms: fd.get('ms') ?? '', lat: fd.get('lat'), lng: fd.get('lng'), aliases: fd.get('aliases') ?? '' });
  if (!p.success) return fail(to, p.error.issues[0].message);
  const d = p.data;
  const row = { country_id: d.country_id, region_id: d.region_id ?? null, slug: d.slug, name_i18n: i18n(d), location: d.lat !== undefined ? `SRID=4326;POINT(${d.lng} ${d.lat})` : null };
  const res = d.id ? await supabase.from('cities').update(row).eq('id', d.id).select('id').single() : await supabase.from('cities').insert(row).select('id').single();
  if (res.error || !res.data) return fail(to, friendlyError(res.error, 'Unable to save.', { ...UNIQUE, '23503': 'The region does not belong to this country.' }));
  // Other names people may type when searching (e.g. "KL"), one per line
  const aliases = [...new Map(d.aliases.split(/\r?\n/).map((a) => a.trim()).filter((a) => a.length >= 2 && a.length <= 80).map((a) => [a.toLowerCase(), a])).values()];
  await supabase.from('search_aliases').delete().eq('entity_type', 'city').eq('entity_id', res.data.id);
  if (aliases.length) await supabase.from('search_aliases').insert(aliases.map((alias) => ({ entity_type: 'city', entity_id: res.data!.id, alias, language_code: /[\u0600-\u06FF]/.test(alias) ? 'ar' : null })));
  return done(to, 'City saved.');
}

async function deletePlace(fd: FormData) {
  const { supabase } = await requirePermission('categories.manage'); const to = returnTo(fd);
  const t = z.enum(['countries', 'regions', 'cities']).safeParse(fd.get('table')), id = Number(fd.get('id'));
  if (!t.success || !Number.isInteger(id)) return fail(to, 'Item not found.');
  if (t.data === 'cities') await supabase.from('search_aliases').delete().eq('entity_type', 'city').eq('entity_id', id);
  const { error } = await supabase.from(t.data).delete().eq('id', id);
  if (error) return fail(to, friendlyError(error, 'Unable to delete.', IN_USE));
  return done(to, 'Deleted.');
}

export async function deleteCountry(fd: FormData) { fd.set('table', 'countries'); return deletePlace(fd); }
export async function deleteRegion(fd: FormData) { fd.set('table', 'regions'); return deletePlace(fd); }
export async function deleteCity(fd: FormData) { fd.set('table', 'cities'); return deletePlace(fd); }
