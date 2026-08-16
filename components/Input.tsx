import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-label text-text-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`w-full min-h-11 rounded-lg border bg-surface-2 px-3 py-2 text-body text-text placeholder:text-text-3 transition-colors ${
          error ? 'border-rose' : 'border-edge'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-body-sm text-rose">{error}</span>}
    </div>
  );
});

export default Input;
