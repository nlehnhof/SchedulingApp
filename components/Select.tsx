import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className = '', id, children, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-label text-text-2">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={`w-full min-h-11 rounded-lg border bg-surface-2 px-3 py-2 text-body text-text transition-colors ${
          error ? 'border-rose' : 'border-edge'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-body-sm text-rose">{error}</span>}
    </div>
  );
});

export default Select;
