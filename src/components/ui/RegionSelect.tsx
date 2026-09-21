import { GHANA_REGIONS } from "@/lib/config/constants";

interface RegionSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  placeholder?: string;
}

export function RegionSelect({ label, placeholder = "Select region", className = "", ...props }: RegionSelectProps) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-fg-secondary">{label}</label>}
      <select
        {...props}
        className={[
          "h-11 w-full rounded-lg border border-line bg-card px-3 text-fg transition-colors",
          "focus:border-brand-600 focus:outline-none",
          className,
        ].join(" ")}
      >
        <option value="">{placeholder}</option>
        {GHANA_REGIONS.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
    </div>
  );
}
