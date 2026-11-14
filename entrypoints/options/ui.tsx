import type { ChangeEvent, ReactNode } from 'react';

export function Card({
  children,
  title,
  desc,
  right,
  danger,
}: {
  children?: ReactNode;
  title?: string;
  desc?: string;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`card ${danger ? 'card--danger' : ''}`}>
      {(title || right) && (
        <header className="card__head">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {desc && <p className="card__desc">{desc}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  inline,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <label className={`field ${inline ? 'field--inline' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  password,
  monospace,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  password?: boolean;
  monospace?: boolean;
}) {
  return (
    <input
      className={`input ${monospace ? 'input--mono' : ''}`}
      type={password ? 'password' : type}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      className="select"
      value={value}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-row__label">{label}</div>
        {hint && <div className="toggle-row__hint">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch"
        data-on={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__dot" />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  small,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${small ? 'btn--sm' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <div className={`note note--${tone}`}>{children}</div>;
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}) {
  return (
    <div className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider__value">{format ? format(value) : value}</span>
    </div>
  );
}
