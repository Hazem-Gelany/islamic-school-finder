/** Turns database errors into messages a non-technical admin can act on. Raw errors are logged, never shown. */
export function friendlyError(error: { code?: string; message?: string; details?: string } | null | undefined, fallback = 'Something went wrong. Please try again.', custom: Partial<Record<string, string>> = {}) {
  if (!error) return fallback;
  console.error('[db]', error.code, error.message, error.details);
  if (error.code && custom[error.code]) return custom[error.code]!;
  switch (error.code) {
    case '23505': return 'A school with this URL name already exists in that city. Change the URL name and try again.';
    case '23503': return 'Unable to save. Please check the selected country, city and other options, and try again.';
    case '23514': return error.message?.includes('translation') ? 'A published school needs at least one translation.' : 'One of the values is not allowed. Please check the form.';
    case '22P02': case '22007': return 'One of the values has an invalid format. Please check the form.';
    case '42501': return 'You do not have permission to do that.';
    default: return fallback;
  }
}
