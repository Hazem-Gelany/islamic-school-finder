'use client';
import { useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveMediaProposal } from '@/app/portal/actions';

export type Published = { id: string; kind: string; url: string; alt: string };
export type Pending = { kind: 'photo' | 'logo'; storage_path: string; mime_type: string; size_bytes: number; alt: string; url: string };
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export function PortalMedia({ schoolId, published, pendingAdd, pendingRemove }: { schoolId: string; published: Published[]; pendingAdd: Pending[]; pendingRemove: string[] }) {
  const file = useRef<HTMLInputElement>(null);
  const [add, setAdd] = useState(pendingAdd), [remove, setRemove] = useState(pendingRemove);
  const [kind, setKind] = useState<'photo' | 'logo'>('photo'), [alt, setAlt] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, start] = useTransition();
  const strip = (a: Pending[]) => a.map(({ url: _u, ...rest }) => rest);

  async function persist(nextAdd: Pending[], nextRemove: string[]) {
    const r = await saveMediaProposal(schoolId, strip(nextAdd), nextRemove);
    if (!r.ok) { setMsg({ tone: 'err', text: r.message ?? 'Unable to save.' }); return false; }
    setAdd(nextAdd); setRemove(nextRemove); return true;
  }
  function upload() {
    const f = file.current?.files?.[0];
    if (!f) return setMsg({ tone: 'err', text: 'Choose an image first.' });
    if (!TYPES[f.type]) return setMsg({ tone: 'err', text: 'Use a JPG, PNG, WebP or AVIF image.' });
    if (f.size > 5 * 1024 * 1024) return setMsg({ tone: 'err', text: 'The image is larger than 5 MB. Please resize it.' });
    if (alt.trim().length < 3) return setMsg({ tone: 'err', text: 'Describe the image in a few words (alt text) for accessibility.' });
    setMsg(null);
    start(async () => {
      const sb = createClient(), path = `${schoolId}/pending/${crypto.randomUUID()}.${TYPES[f.type]}`;
      const up = await sb.storage.from('school-media').upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) return setMsg({ tone: 'err', text: 'Upload failed. Please try again.' });
      const url = sb.storage.from('school-media').getPublicUrl(path).data.publicUrl;
      const item: Pending = { kind, storage_path: path, mime_type: f.type, size_bytes: f.size, alt: alt.trim(), url };
      const next = kind === 'logo' ? [...add.filter((a) => a.kind !== 'logo'), item] : [...add, item];
      if (await persist(next, remove)) { setMsg({ tone: 'ok', text: 'Added. It will appear after our team approves it.' }); setAlt(''); if (file.current) file.current.value = ''; }
      else await sb.storage.from('school-media').remove([path]);
    });
  }
  function dropPending(p: Pending) {
    start(async () => { if (await persist(add.filter((a) => a.storage_path !== p.storage_path), remove)) await createClient().storage.from('school-media').remove([p.storage_path]); });
  }
  function toggleRemove(id: string) { start(async () => { await persist(add, remove.includes(id) ? remove.filter((x) => x !== id) : [...remove, id]); }); }

  return (
    <div className="grid gap-6">
      <p className="rounded-lg bg-[#F6F4EC] p-3 text-sm text-muted">Photos and logos are checked by our team before they appear. Photos you add or remove here are saved straight away as part of your pending changes.</p>
      <div className="grid gap-4 rounded-xl border border-line p-4 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
        <label className="text-sm font-semibold text-muted">Image file (max 5 MB)<input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="mt-1 block w-full text-base font-normal" /></label>
        <label className="text-sm font-semibold text-muted">Type<select value={kind} onChange={(e) => setKind(e.target.value as 'photo' | 'logo')} className="mt-1 block h-12 w-full rounded-[10px] border border-[#7F9288] bg-white px-3 font-normal"><option value="photo">Photo</option><option value="logo">Logo (replaces current)</option></select></label>
        <label className="text-sm font-semibold text-muted">Alt text<input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Describe the image" className="mt-1 block h-12 w-full rounded-[10px] border border-[#7F9288] px-3 font-normal" /></label>
        <button type="button" disabled={busy} onClick={upload} className="h-12 rounded-xl bg-forest-900 px-5 font-semibold text-cream-50 disabled:opacity-50">{busy ? 'Working…' : 'Add'}</button>
      </div>
      {msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${msg.tone === 'err' ? 'bg-[#FCEDEA] text-[#8A1F11]' : 'bg-mint-100 text-forest-900'}`}>{msg.text}</p>}
      {add.length > 0 && (<div><h3 className="mb-2 font-semibold">Waiting for review</h3><ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{add.map((p) => (
        <li key={p.storage_path} className="overflow-hidden rounded-xl border-2 border-[#E2B95B]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt={p.alt} className="aspect-[4/3] w-full object-cover" />
          <div className="flex items-center justify-between gap-2 p-2 text-sm"><span className="font-semibold capitalize">{p.kind}</span><button type="button" disabled={busy} onClick={() => dropPending(p)} className="h-9 rounded-lg border border-[#7F9288] px-3">Cancel</button></div></li>))}</ul></div>)}
      <div><h3 className="mb-2 font-semibold">Published</h3>{published.length === 0 ? <p className="text-muted">No images published yet.</p> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{published.map((m) => { const going = remove.includes(m.id); return (
          <li key={m.id} className={`overflow-hidden rounded-xl border ${going ? 'border-[#B3261E] opacity-60' : 'border-line'}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.url} alt={m.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-2 p-2 text-sm"><span className="font-semibold capitalize">{m.kind}{going && <span className="ms-1 font-normal text-[#8A1F11]">(removal pending)</span>}</span>
              <button type="button" disabled={busy} onClick={() => toggleRemove(m.id)} className="h-9 rounded-lg border border-[#7F9288] px-3">{going ? 'Keep' : 'Remove'}</button></div></li>); })}</ul>)}</div>
    </div>
  );
}
