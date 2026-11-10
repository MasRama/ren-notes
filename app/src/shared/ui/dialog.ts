import { reactive } from "vue";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirm: string;
  danger?: boolean;
}

/** The one open alert; `resolve` answers whoever asked. */
export const alertState = reactive({
  open: false,
  options: null as ConfirmOptions | null,
  resolve: null as ((ok: boolean) => void) | null,
});

/** Asks before something that cannot be undone. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  alertState.resolve?.(false);
  return new Promise((resolve) => {
    Object.assign(alertState, { open: true, options, resolve });
  });
}

export function answer(ok: boolean): void {
  const resolve = alertState.resolve;
  Object.assign(alertState, { open: false, resolve: null });
  resolve?.(ok);
}
