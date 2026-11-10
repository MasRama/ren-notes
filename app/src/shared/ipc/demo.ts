import type { JSONContent } from "@tiptap/core";
import { deriveFields, type DocNode } from "../../features/editor/derive";
import { MemoryApi } from "./memory";
import { DEFAULT_FOLDER_ID } from "./types";

const DAY = 24 * 60 * 60 * 1000;

const p = (...parts: (string | JSONContent)[]): JSONContent => ({
  type: "paragraph",
  content: parts.map((x) => (typeof x === "string" ? { type: "text", text: x } : x)),
});
const h = (level: number, text: string): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const b = (text: string): JSONContent => ({ type: "text", text, marks: [{ type: "bold" }] });
const mark = (color: string, text: string): JSONContent => ({ type: "text", text, marks: [{ type: "highlight", attrs: { color } }] });
const tasks = (...items: [string, boolean][]): JSONContent => ({
  type: "taskList",
  content: items.map(([text, checked]) => ({ type: "taskItem", attrs: { checked }, content: [p(text)] })),
});
const bullets = (...items: string[]): JSONContent => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const table = (rows: string[][]): JSONContent => ({
  type: "table",
  content: rows.map((r) => ({
    type: "tableRow",
    content: r.map((c) => ({ type: "tableCell", content: [p(c)] })),
  })),
});

/** A picture for the demo, drawn here: a hillside at dusk. */
function picture(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c66b"/><stop offset=".6" stop-color="#f49a6a"/><stop offset="1" stop-color="#c9667a"/></linearGradient></defs>
<rect width="960" height="640" fill="url(#s)"/><circle cx="640" cy="300" r="70" fill="#fff3c4" opacity=".9"/>
<path d="M0 420 C200 330 360 380 520 340 S820 300 960 360 V640 H0Z" fill="#7b4d6b"/>
<path d="M0 500 C240 430 420 480 620 440 S860 430 960 470 V640 H0Z" fill="#4f3557"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A second picture, for the demo's link card: pines on a hill. */
function pines(): string {
  const tree = (x: number, y: number, s: number) =>
    `<path d="M${x} ${y - 120 * s} L${x + 46 * s} ${y} H${x - 46 * s}Z" fill="#1f4d3a"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3d4"/><stop offset="1" stop-color="#8fbf9f"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#k)"/>
<path d="M0 470 C300 400 700 430 1200 380 V630 H0Z" fill="#3f7a5a"/>
${[120, 260, 420, 820, 980, 1110].map((x, i) => tree(x, 470 - (i % 3) * 18, 1 + (i % 2) * 0.35)).join("")}
<path d="M560 470 l90-70 l90 70 v80 h-180z" fill="#7a4b32"/><rect x="630" y="500" width="40" height="50" fill="#f2c46b"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The in-memory API filled with believable notes, for the page in a plain
 * browser and for screenshots. `?theme=dark`, `?view=gallery`,
 * `?sidebar=0`, `?empty=1`. */
export function demoApi(params: URLSearchParams): MemoryApi {
  const api = new MemoryApi();
  const now = Date.now();
  api.kv.set("ui", {
    theme: params.get("theme") ?? "system",
    view: params.get("view") ?? "list",
    sidebarShown: params.get("sidebar") !== "0",
    translucentSidebar: params.get("translucent") === "1",
  });
  api.tint = params.get("tint");
  if (params.get("empty")) return api;

  const folders = {
    personal: { id: "personal", parentId: null, name: "Personal", sortIndex: 1, noteCount: 0, isDefault: false },
    work: { id: "work", parentId: null, name: "Work", sortIndex: 2, noteCount: 0, isDefault: false },
    projects: { id: "projects", parentId: "work", name: "Projects", sortIndex: 0, noteCount: 0, isDefault: false },
    recipes: { id: "recipes", parentId: null, name: "Recipes", sortIndex: 3, noteCount: 0, isDefault: false },
  };
  api.folders.push(...Object.values(folders));
  const photo = api.addPictureUrl(picture(), "dusk.svg", 960, 640);
  const cabin = {
    url: "https://example.com/stays/pine-ridge-cabin",
    title: "Pine Ridge Cabin, Lembang",
    site: "example.com",
    imageId: api.addPictureUrl(pines(), "link-preview.jpg", 1200, 630),
  };
  const book = {
    url: "https://en.wikipedia.org/wiki/A_Pattern_Language",
    title: "A Pattern Language - Wikipedia",
    site: "Wikipedia",
    imageId: null,
  };
  // Pasting either address in the demo makes its card.
  for (const preview of [cabin, book]) api.previews.set(preview.url, preview);

  const add = (folderId: string, ago: number, content: JSONContent[], extra: { pinned?: boolean; deleted?: number } = {}) => {
    const doc = { type: "doc", content };
    const fields = deriveFields(doc as DocNode);
    const id = api.id();
    const at = now - ago;
    api.notes.push({
      id,
      folderId,
      title: fields.title,
      snippet: fields.snippet,
      firstImageId: fields.attachmentIds.includes(photo) ? photo : null,
      pinned: !!extra.pinned,
      hasChecklist: fields.hasChecklist,
      hasAttachment: fields.attachmentIds.length > 0,
      locked: false,
      createdAt: at - 3 * DAY,
      updatedAt: at,
      deletedAt: extra.deleted !== undefined ? now - extra.deleted : null,
      docJson: JSON.stringify(doc),
      docFormat: "tiptap",
      plainText: fields.plainText,
      tags: (fields.plainText.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()),
      attachmentIds: fields.attachmentIds,
      deletedFrom: extra.deleted !== undefined ? folderId : null,
      sealed: null,
    });
    return id;
  };

  const budget = add(folders.personal.id, 4 * DAY, [
    h(1, "Trip budget"),
    p("cabin = 850000"),
    p("fuel = 2 * 180000"),
    p("food = 4 * 3 * 45000"),
    p("Total: cabin + fuel + food ="),
    p("Each of us pays (cabin + fuel + food) / 4 ="),
  ]);
  add(DEFAULT_FOLDER_ID, 12 * 60 * 1000, [
    h(1, "Weekend in Lembang"),
    p("Leave Saturday at six to beat the traffic. ", mark("orange", "Book the cabin by Thursday.")),
    { type: "linkCard", attrs: cabin },
    h(2, "Pack"),
    tasks(["Rain jackets", true], ["Thermos and coffee", false], ["Power bank", false], ["Hiking shoes", false]),
    {
      type: "sketch",
      attrs: {
        height: 300,
        strokes: [
          { tool: "marker", color: "yellow", points: [90, 230, 300, 120, 470, 175, 640, 95, 880, 150] },
          { tool: "pen", color: "ink", points: [90, 230, 180, 175, 300, 120, 390, 150, 470, 175, 560, 130, 640, 95, 760, 120, 880, 150] },
          { tool: "pen", color: "red", points: [640, 70, 640, 95] },
          { tool: "pen", color: "red", points: [640, 70, 668, 78, 640, 86] },
          { tool: "pen", color: "blue", points: [80, 262, 140, 254, 200, 262, 260, 254, 320, 262] },
        ],
      },
    },
    p("Costs are split four ways in ", { type: "noteLink", attrs: { id: budget, title: "Trip budget" } }, "."),
    p("Sunset from the ridge was the best part last time. #travel"),
    { type: "image", attrs: { attachmentId: photo, alt: "dusk.svg" } },
  ]);
  add(DEFAULT_FOLDER_ID, 2 * 60 * 60 * 1000, [
    h(1, "Groceries"),
    tasks(["Eggs", false], ["Spinach", false], ["Tempeh", false], ["Oat milk", true], ["Coffee beans", true]),
  ], { pinned: true });
  add(folders.work.id, 26 * 60 * 60 * 1000, [
    h(1, "Q4 planning"),
    p("Three outcomes for the quarter, then the projects that serve them."),
    bullets("Ship Renotes 0.1 to the team", "Cut the release time to one day", "Write the onboarding guide"),
    p(b("Owner:"), " Ren. Review on Friday. #work"),
  ]);
  add(folders.projects.id, 3 * DAY, [
    h(1, "Renotes launch checklist"),
    table([
      ["Task", "Who", "Status"],
      ["Icon and screenshots", "Ren", "Done"],
      ["Release build", "CI", "Running"],
      ["Announce", "Ren", "Friday"],
    ]),
    p("#work #launch"),
  ]);
  add(folders.personal.id, 5 * DAY, [
    h(1, "Books to read"),
    bullets("The Remains of the Day", "A Pattern Language", "The Design of Everyday Things"),
    { type: "linkCard", attrs: book },
  ]);
  add(folders.recipes.id, 12 * DAY, [
    h(1, "Nasi goreng kampung"),
    p("Day-old rice is the secret. Shallots, garlic and chilli pounded rough, a spoon of terasi, then high heat."),
    h(3, "Serves two"),
    bullets("2 cups cold rice", "4 shallots, 3 cloves garlic", "2 red chillies", "1 tsp terasi", "Sweet soy to finish"),
  ]);
  add(DEFAULT_FOLDER_ID, 18 * DAY, [h(1, "Wi-Fi at the studio"), p("Network: studio-5g. Ask Dina for the guest code.")]);
  add(folders.personal.id, 70 * DAY, [h(1, "Gift ideas"), p("A good fountain pen for Bapak. Plants for the balcony.")]);
  add(DEFAULT_FOLDER_ID, 400 * DAY, [h(1, "Old meeting notes"), p("Decided to move the office in March.")]);
  add(DEFAULT_FOLDER_ID, 20 * DAY, [h(1, "Draft that went nowhere"), p("Maybe later.")], { deleted: 2 * DAY });

  // Locked with "renotes"; ?unlocked=1 starts with locked notes open.
  const bank = add(folders.personal.id, 6 * DAY, [
    h(1, "Bank accounts"),
    p("Savings at Bank Arta: 0123 4567 89."),
    p("Card PIN is the year we moved."),
  ]);
  api.password = { word: "renotes", hint: "The app’s name" };
  api.locksOpenNow = true;
  void api.notesLock(bank);
  api.locksOpenNow = params.get("unlocked") === "1";

  api.smart.push({
    id: "smart-work",
    name: "This Week at Work",
    rules: { tags: ["work"], tagMatch: "any", editedWithinDays: 7, createdWithinDays: null, hasChecklist: false, hasAttachment: false, pinned: false },
    sortIndex: 0,
  });
  return api;
}
