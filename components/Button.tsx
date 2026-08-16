import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-lume text-lume-ink hover:bg-lume-bright disabled:bg-lume/25 disabled:text-text-3 disabled:hover:bg-lume/25',
  secondary:
    'bg-surface-2 text-text border border-edge hover:brightness-110 hover:border-lume/40 disabled:opacity-50 disabled:hover:brightness-100 disabled:hover:border-edge',
  ghost:
    'bg-transparent text-text-2 hover:bg-lume/8 hover:text-text disabled:opacity-50 disabled:hover:bg-transparent',
  danger:
    'bg-rose text-void hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100',
};

export default function Button({
  variant = 'primary',
  glow = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; glow?: boolean }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-body-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${
        variantClasses[variant]
      } ${variant === 'primary' && glow ? 'shadow-glow' : ''} ${className}`}
      {...props}
    />
  );
}
