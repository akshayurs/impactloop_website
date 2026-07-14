import Link from 'next/link'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  outline: 'border border-line text-fg hover:bg-card',
  ghost: 'text-fg hover:bg-card',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
}

type Props = {
  variant?: Variant
  size?: Size
  href?: string
  className?: string
  target?: string
  rel?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', size = 'md', href, className = '', target, rel, ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  if (href && !rest.disabled) {
    const linkRel = target === '_blank' && !rel ? 'noopener noreferrer' : rel
    return (
      <Link href={href} className={cls} target={target} rel={linkRel}>
        {rest.children}
      </Link>
    )
  }
  return <button type="button" className={cls} {...rest} />
}
