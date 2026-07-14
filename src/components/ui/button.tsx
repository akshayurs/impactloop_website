import Link from 'next/link'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  outline: 'border border-line text-fg hover:bg-card',
  ghost: 'text-fg hover:bg-card',
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
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', size = 'md', href, className = '', ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  if (href) {
    return (
      <Link href={href} className={cls}>
        {rest.children}
      </Link>
    )
  }
  return <button type="button" className={cls} {...rest} />
}
