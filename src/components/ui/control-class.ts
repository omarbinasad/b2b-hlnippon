/** Shared form control style. Focus: brand border + soft brand ring (replaces the generic outline for form fields). */
export const controlClass =
  "rounded-ui border border-line bg-surface px-3 text-base text-foreground placeholder:text-muted " +
  "transition-[border-color,box-shadow] focus:border-brand focus:ring-3 focus:ring-brand/25 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:focus:ring-danger/25 sm:text-sm";
