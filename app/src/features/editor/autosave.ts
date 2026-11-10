export interface AutosaveOptions {
  /** Quiet time after the last change before saving, in ms. */
  delay: number;
  /** Wait before trying a failed save again, in ms. */
  retry?: number;
  /** Saves the editor's current content. */
  save: () => Promise<void>;
  onError?: (error: unknown) => void;
  onRecovered?: () => void;
}

/** Saves a note a moment after typing stops, at once when asked (note
 * switch, blur, close), and keeps retrying a failed save: the content stays
 * in the editor until a save succeeds. */
export class Autosave {
  dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private failing = false;

  constructor(private readonly options: AutosaveOptions) {}

  changed(): void {
    this.dirty = true;
    this.schedule(this.options.delay);
  }

  /** Saves now if anything is unsaved, after any save in progress. */
  async flush(): Promise<void> {
    this.cancel();
    while (this.running) await this.running;
    if (this.dirty) await this.run();
  }

  /** Forgets pending work (the note was replaced or deleted). */
  reset(): void {
    this.cancel();
    this.dirty = false;
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, ms);
  }

  private run(): Promise<void> {
    if (this.running) return this.running;
    this.dirty = false;
    this.running = this.options
      .save()
      .then(() => {
        if (this.failing) {
          this.failing = false;
          this.options.onRecovered?.();
        }
      })
      .catch((error) => {
        this.dirty = true;
        this.failing = true;
        this.options.onError?.(error);
        this.schedule(this.options.retry ?? 2000);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
