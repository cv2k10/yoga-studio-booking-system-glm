import type { ReactNode } from "@/lib/next";
import type { ActionState } from "@/lib/actions";

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  submitClassName?: string;
  confirmText?: string;
  showMessage?: boolean;
  resetOnSuccess?: boolean;
};

/**
 * Posts to the action endpoint, which redirects back with the result as a
 * flash message (rendered by the root layout). The inline script in the
 * layout swaps in `pendingLabel` and handles `confirmText`.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working…",
  className,
  submitClassName = "btn btn-primary",
  confirmText,
}: Props) {
  return (
    <form action={action} className={className} data-confirm={confirmText}>
      {children}
      <button type="submit" className={submitClassName} data-pending={pendingLabel}>
        {submitLabel}
      </button>
    </form>
  );
}
