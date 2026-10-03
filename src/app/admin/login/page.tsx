import { login } from './actions';

const messages: Record<string, string> = { invalid: 'The email or password is not correct.', forbidden: 'This account does not have access to the admin area.' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 p-6">
      <form action={login} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-white p-8">
        <div><h1 className="text-2xl font-semibold text-forest-900">Islamic School Finder</h1><p className="mt-1 text-muted">Admin sign in</p></div>
        {error && <p role="alert" className="rounded-lg bg-[#FCEDEA] p-3 text-sm text-[#8A1F11]">{messages[error] ?? 'Unable to sign in.'}</p>}
        <label className="block text-sm font-semibold text-muted">Email
          <input name="email" type="email" required autoComplete="email" className="mt-1.5 h-12 w-full rounded-[10px] border border-[#B9C4BD] px-3 text-base font-normal text-ink-900" /></label>
        <label className="block text-sm font-semibold text-muted">Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1.5 h-12 w-full rounded-[10px] border border-[#B9C4BD] px-3 text-base font-normal text-ink-900" /></label>
        <button className="h-12 w-full rounded-xl bg-forest-900 font-semibold text-cream-50 hover:bg-[#14503F]">Sign in</button>
      </form>
    </main>
  );
}
