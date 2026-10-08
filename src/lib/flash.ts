import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';

const sep = (to: string) => (to.includes('?') ? '&' : '?');
/** Redirect back to a page with a success or error banner. Both end the current action. */
export const done = (to: string, msg: string, revalidate: string[] = []): never => { revalidateTag('schools'); revalidate.forEach((p) => revalidatePath(p)); redirect(`${to}${sep(to)}msg=${encodeURIComponent(msg)}`); };
export const fail = (to: string, msg: string): never => redirect(`${to}${sep(to)}error=${encodeURIComponent(msg)}`);
