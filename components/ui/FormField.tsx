import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// Shared input styling
const inputClass =
  "w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent";

const labelClass = "block text-sm font-medium text-neutral-300 mb-2";

// ── FormInput ────────────────────────────────────────────────────────────────

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input */
  label?: string;
  id: string;
  /** Red error text rendered below the input */
  error?: string | null;
}

export function FormInput({ label, id, error, ...props }: FormInputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <input id={id} className={inputClass} {...props} />
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

// ── FormTextarea ─────────────────────────────────────────────────────────────

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  id: string;
  error?: string | null;
}

export function FormTextarea({ label, id, error, ...props }: FormTextareaProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`${inputClass} resize-none`}
        {...props}
      />
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

// ── ToggleSwitch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "sm" = small (w-9 h-5), "md" = medium (w-11 h-6). Defaults to "sm". */
  size?: "sm" | "md";
  /** Accessible label for screen readers */
  label?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  size = "sm",
  label,
}: ToggleSwitchProps) {
  const trackClass =
    size === "md"
      ? "w-11 h-6 after:h-5 after:w-5"
      : "w-9 h-5 after:h-4 after:w-4";

  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
        aria-label={label}
      />
      <div
        className={`${trackClass} bg-neutral-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:transition-all peer-checked:bg-emerald-500`}
      />
    </label>
  );
}
