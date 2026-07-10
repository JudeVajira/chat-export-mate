import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastLevel = "info" | "warn" | "error";

export interface ToastMessage {
  id: number;
  level: ToastLevel;
  message: string;
}

const icons: Record<ToastLevel, typeof Info> = {
  info: CheckCircle2,
  warn: Info,
  error: CircleAlert,
};

export function ToastStack({
  onDismiss,
  toasts,
}: {
  onDismiss: (id: number) => void;
  toasts: ToastMessage[];
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="toast-stack">
      {toasts.map((toast) => {
        const Icon = icons[toast.level];
        return (
          <div className={`toast toast--${toast.level}`} key={toast.id} role="status">
            <Icon aria-hidden="true" />
            <p>{toast.message}</p>
            <button
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
