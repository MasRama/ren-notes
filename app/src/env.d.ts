/// <reference types="vite/client" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** "1" runs the page on demo data even inside the app. */
  readonly VITE_DEMO?: string;
}
