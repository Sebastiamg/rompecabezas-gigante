import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Texto accesible (y tooltip). Siempre obligatorio. */
  label: string;
  /** Muestra el texto junto al icono a partir de cierto ancho. */
  showLabel?: 'always' | 'wide' | 'never';
  tone?: 'default' | 'accent' | 'quiet';
}

/** Botón redondo de 44 px mínimo (objetivo táctil cómodo). */
export function IconButton({
  icon,
  label,
  showLabel = 'never',
  tone = 'default',
  className = '',
  ...props
}: IconButtonProps) {
  const tones = {
    default: 'border-white/10 bg-ink-800/85 text-slate-100 hover:bg-ink-700',
    accent: 'border-accent/40 bg-accent/15 text-accent hover:bg-accent/25',
    quiet: 'border-transparent bg-transparent text-slate-300 hover:bg-white/10',
  } as const;
  const labelClass = showLabel === 'always' ? '' : showLabel === 'wide' ? 'hidden sm:inline' : 'sr-only';
  return (
    <button
      type="button"
      aria-label={showLabel === 'always' ? undefined : label}
      title={label}
      className={`pointer-events-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold shadow-lg shadow-black/25 transition active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${tones[tone]} ${focusRing} ${className}`}
      {...props}
    >
      <Icon name={icon} size={20} />
      <span className={labelClass}>{label}</span>
    </button>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  icon?: IconName;
}

export function Button({ children, variant = 'primary', size = 'md', icon, className = '', ...props }: ButtonProps) {
  const variants = {
    primary:
      'bg-linear-to-r from-accent to-sky-400 text-ink-950 shadow-lg shadow-cyan-500/25 hover:brightness-110',
    secondary: 'border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10',
  } as const;
  const sizes = { md: 'min-h-12 px-6 text-base', sm: 'min-h-11 px-3 text-sm' } as const;
  return (
    <button
      type="button"
      className={`pointer-events-auto inline-flex items-center justify-center gap-2 rounded-2xl font-bold tracking-wide transition active:scale-[0.97] ${sizes[size]} ${variants[variant]} ${focusRing} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </button>
  );
}
