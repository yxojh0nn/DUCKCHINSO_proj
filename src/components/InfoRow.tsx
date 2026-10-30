type Props = { label: string; children: React.ReactNode }

export function InfoRow({ label, children }: Props) {
  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-0">
      <dt className="w-20 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  )
}
