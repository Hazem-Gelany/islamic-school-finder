'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addMedia, removeMedia } from '@/app/admin/(panel)/schools/actions';

export type MediaItem = { id: string; kind: string; url: string; alt: string };
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX = 5 * 1024 * 1024;

export function MediaManager({ schoolId, items }: { schoolId: string; items: MediaItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'logo' | 'photo'>('photo');
  const [alt, setAlt] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, start] = useTransition();

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg({ tone: 'err', text: 'Choose an image first.' });
    if (!TYPES[file.type]) return setMsg({ tone: 'err', text: 'Use a JPG, PNG, WebP or AVIF image.' });
    if (file.size > MAX) return setMsg({ tone: 'err', text: 'The image is larger than 5 MB. Please resize it and try again.' });
    if (alt.trim().length < 3) return setMsg({ tone: 'err', text: 'Describe the image in a few words (alt text) for accessibility.' });
    setMsg(null);
    start(async () => {
      const sb = createClient();
      const path = `${schoolId}/${crypto.randomUUID()}.${TYPES[file.type]}`;
      const up = await sb.storage.from('school-media').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return setMsg({ tone: 'err', text: 'Upload failed. Check your permissions and try again.' });
      const r = await addMedia({ school_id: schoolId, kind, storage_path: path, mime_type: file.type, size_bytes: file.size, alt });
      if (!r.ok) { await sb.storage.from('school-media').remove([path]); return setMsg({ tone: 'err', text: r.message }); }
      setMsg({ tone: 'ok', text: 'Image uploaded.' }); setAlt(''); if (fileRef.current) fileRef.current.value = ''; router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm('Remove this image?')) return;
    start(async () => { const r = await removeMedia(id, schoolId); setMsg(r.ok ? { tone: 'ok', text: 'Image removed.' } : { tone: 'err', text: r.message }); router.refresh(); });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-xl border border-line p-4 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
        <label className="text-sm font-semibold text-muted">Image file (max 5 MB)<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="mt-1 block w-full text-base font-normal" /></label>
        <label className="text-sm font-semibold text-muted">Type<select value={kind} onChange={(e) => setKind(e.target.value as 'logo' | 'photo')} className="mt-1 block h-12 w-full rounded-[10px] border border-[#7F9288] bg-white px-3 font-normal"><option value="photo">Photo</option><option value="logo">Logo (replaces current)</option></select></label>
        <label className="text-sm font-semibold text-muted">Alt text<input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Describe the image" className="mt-1 block h-12 w-full rounded-[10px] border border-[#7F9288] px-3 font-normal" /></label>
        <button type="button" disabled={busy} onClick={upload} className="h-12 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 disabled:opacity-50">{busy ? 'Working…' : 'Upload'}</button>
      </div>
      {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${msg.tone === 'err' ? 'bg-[#FCEDEA] text-[#8A1F11]' : 'bg-mint-100 text-forest-900'}`}>{msg.text}</p>}
      {items.length === 0 ? <p className="text-muted">No images yet.</p> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt} loading="lazy" className="aspect-[4/3] w-full bg-[#F6F4EC] object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-sm"><span className="font-semibold capitalize">{m.kind}</span><button type="button" onClick={() => remove(m.id)} className="h-9 rounded-lg border border-[#7F9288] px-3">Remove</button></div>
            </li>))}
        </ul>)}
    </div>
  );
}
