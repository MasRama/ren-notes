import { reactive } from "vue";

export type MenuItem =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      action?: () => void;
      disabled?: boolean;
      checked?: boolean;
      danger?: boolean;
      shortcut?: string;
    };

/** The one open menu (context menu or a toolbar popover's list). */
export const menu = reactive({
  open: false,
  x: 0,
  y: 0,
  items: [] as MenuItem[],
});

export function openMenu(at: { clientX: number; clientY: number }, items: MenuItem[]): void {
  menu.items = items;
  menu.x = at.clientX;
  menu.y = at.clientY;
  menu.open = true;
}

export function closeMenu(): void {
  menu.open = false;
}
