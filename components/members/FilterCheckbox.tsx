interface FilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon: React.ReactNode;
}

export function FilterCheckbox({
  checked,
  onChange,
  label,
  icon,
}: FilterCheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer transition-colors border min-h-[44px] ${
        checked
          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
          : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {icon}
      <span className="text-sm">{label}</span>
    </label>
  );
}
