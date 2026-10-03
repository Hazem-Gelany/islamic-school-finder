'use client';
export function ConfirmButton({ message, children, className = '', formAction, name, value }: { message: string; children: React.ReactNode; className?: string; formAction?: (fd: FormData) => void | Promise<void>; name?: string; value?: string }) {
  return <button type="submit" name={name} value={value} className={className} formAction={formAction} formNoValidate={!!formAction} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
export function SelectAll({ form }: { form: string }) {
  return <input type="checkbox" aria-label="Select all schools on this page" className="size-4" onChange={(e) => {
    document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${form}"]`).forEach((c) => (c.checked = e.target.checked));
  }} />;
}
