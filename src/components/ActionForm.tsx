"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
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

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working…",
  className,
  submitClassName = "btn btn-primary",
  confirmText,
  showMessage = true,
  resetOnSuccess = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {children}
      <button type="submit" className={submitClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {showMessage && state ? (
        <p
          className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${
            state.ok
              ? "bg-sage/12 text-sage"
              : "bg-clay/12 text-clay"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      {resetOnSuccess && state?.ok ? <ResetOnNext /> : null}
    </form>
  );
}

function ResetOnNext() {
  return null;
}
