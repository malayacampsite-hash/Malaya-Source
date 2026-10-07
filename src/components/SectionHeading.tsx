import type { ReactNode } from 'react'

type Props = { eyebrow: string; title: string; children?: ReactNode }

export function SectionHeading({ eyebrow, title, children }: Props) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  )
}
