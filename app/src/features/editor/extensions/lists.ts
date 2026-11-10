import { BulletList } from "@tiptap/extension-list";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dashedList: {
      /** A bulleted list drawn with dashes, like the Mac's "Dashed List". */
      toggleDashedList: () => ReturnType;
    };
  }
}

/** Bulleted lists that can also be dashed (`data-style="dash"`). */
export const NoteBulletList = BulletList.extend({
  addAttributes() {
    return {
      dashed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-style") === "dash",
        renderHTML: (attrs) => (attrs.dashed ? { "data-style": "dash" } : {}),
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      toggleDashedList:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive("bulletList", { dashed: true })) return chain().toggleBulletList().run();
          if (editor.isActive("bulletList")) return chain().updateAttributes("bulletList", { dashed: true }).run();
          return chain().toggleBulletList().updateAttributes("bulletList", { dashed: true }).run();
        },
    };
  },
});
