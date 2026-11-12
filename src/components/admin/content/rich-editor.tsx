"use client";

import { pickBlocksAction, type BlockChoice } from "@/app/admin/content-actions";
import { useViewOnly } from "@/components/admin/capabilities-context";
import { Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState, type ReactNode } from "react";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { blockKindLabel } from "@/lib/content/blocks";
import { cx } from "@/lib/cx";

/**
 * A reusable block in page content: an empty marker (`<div data-block="blk-…" data-name="…">`) that the site replaces
 * with the block's current content when the page is shown (src/lib/content/blocks.ts). In the editor it shows as a labelled box.
 */
const ReusableBlock = Node.create({
  name: "reusableBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-block"), renderHTML: (a) => ({ "data-block": a.id }) },
      name: { default: "", parseHTML: (el) => el.getAttribute("data-name") ?? "", renderHTML: (a) => ({ "data-name": a.name }) },
    };
  },
  parseHTML: () => [{ tag: "div[data-block]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", HTMLAttributes],
});

/** Rich content editor. Stores HTML, which the server sanitizes (src/lib/html/sanitize.ts) on save and when rendered. */
export default function RichEditor({ id, value, onChange, invalid, describedBy, blocks = false }: { id: string; value: string; onChange: (html: string) => void; invalid?: boolean; describedBy?: string; /** Offer "Insert block" (pages and posts; not inside a block). */ blocks?: boolean }) {
  const viewOnly = useViewOnly();
  const editor = useEditor({
    editable: !viewOnly,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, protocols: ["https", "mailto", "tel"] } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
      ReusableBlock,
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Content",
        ...(invalid ? { "aria-invalid": "true" } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class:
          "cms-editor min-h-72 px-4 py-3 text-sm leading-6 outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-ui [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-surface-muted [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  return (
    <div className={cx("overflow-hidden rounded-ui border bg-surface focus-within:ring-2 focus-within:ring-brand/40", invalid ? "border-danger" : "border-line")}>
      {editor ? <Toolbar editor={editor} blocks={blocks} /> : <div className="h-11 border-b border-line bg-surface-muted" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the text selection while the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx("grid h-8 min-w-8 place-items-center rounded px-1.5 text-sm font-medium hover:bg-surface disabled:opacity-40", active && "bg-brand-soft text-brand")}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />;

function Toolbar({ editor, blocks }: { editor: Editor; blocks: boolean }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const openLink = () => {
    setHref((editor.getAttributes("link").href as string) ?? "");
    setLinkError("");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = href.trim();
    if (!url) {
      chain().unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!/^(?:https?:\/\/\S+|mailto:\S+|tel:\S+|\/(?!\/)\S*|#\S*)$/.test(url)) {
      setLinkError("Use a link like /shop or https://example.com.");
      return;
    }
    chain().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-muted p-1.5">
      <ToolButton label="Heading 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
      <ToolButton label="Heading 3" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
      <Sep />
      <ToolButton label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}><strong>B</strong></ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}><em>I</em></ToolButton>
      <ToolButton label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}><span className="underline">U</span></ToolButton>
      <Sep />
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>• List</ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>1. List</ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>❝</ToolButton>
      <Sep />
      <ToolButton label="Align left" active={s.left} onClick={() => chain().setTextAlign("left").run()}>Left</ToolButton>
      <ToolButton label="Align center" active={s.center} onClick={() => chain().setTextAlign("center").run()}>Center</ToolButton>
      <ToolButton label="Align right" active={s.right} onClick={() => chain().setTextAlign("right").run()}>Right</ToolButton>
      <Sep />
      <ToolButton label="Link" active={s.link} onClick={openLink}>Link</ToolButton>
      <ToolButton label="Image" onClick={() => setMediaOpen(true)}>Image</ToolButton>
      {blocks && <ToolButton label="Insert reusable block" onClick={() => setBlockOpen(true)}>Block</ToolButton>}
      {s.table ? (
        <>
          <ToolButton label="Add row" onClick={() => chain().addRowAfter().run()}>+ Row</ToolButton>
          <ToolButton label="Add column" onClick={() => chain().addColumnAfter().run()}>+ Col</ToolButton>
          <ToolButton label="Delete table" onClick={() => chain().deleteTable().run()}>× Table</ToolButton>
        </>
      ) : (
        <ToolButton label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</ToolButton>
      )}
      <Sep />
      <ToolButton label="Undo" disabled={!s.canUndo} onClick={() => chain().undo().run()}>↶</ToolButton>
      <ToolButton label="Redo" disabled={!s.canRedo} onClick={() => chain().redo().run()}>↷</ToolButton>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} title="Add a link" description="Leave it empty to remove the link.">
        <div className="space-y-4">
          <Field id="editor-link" label="Link address" error={linkError}>
            <Input id="editor-link" value={href} placeholder="/shop or https://example.com" onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} aria-invalid={Boolean(linkError)} aria-describedby={linkError ? "editor-link-error" : undefined} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={applyLink}>Apply</Button>
          </div>
        </div>
      </Dialog>
      {blocks && (
        <BlockPicker
          open={blockOpen}
          onClose={() => setBlockOpen(false)}
          onSelect={(b) => {
            chain().insertContent({ type: "reusableBlock", attrs: { id: b.id, name: b.name } }).run();
            setBlockOpen(false);
          }}
        />
      )}
      <MediaPicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        title="Insert an image"
        onSelect={(m) => {
          chain().setImage({ src: m.url, alt: m.alt }).run();
          setMediaOpen(false);
        }}
      />
    </div>
  );
}

function BlockPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (b: BlockChoice) => void }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<BlockChoice[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => pickBlocksAction(search).then((r) => { if (live) setItems(r); }), search ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [open, search]);
  return (
    <Dialog open={open} onClose={onClose} title="Insert a reusable block" description="The page shows the block's current content, so later edits to the block appear here too.">
      <div className="space-y-3">
        <Field id="block-search" label="Search blocks">
          <Input id="block-search" type="search" value={search} placeholder="Name or text" onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-ui border border-line" aria-label="Blocks">
          {items === null ? (
            <li className="p-3 text-sm text-muted">Loading…</li>
          ) : items.length ? (
            items.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onSelect(b)} className="block w-full p-3 text-left hover:bg-surface-muted">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{b.name}<span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-normal text-muted">{blockKindLabel(b.kind)}</span></span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{b.preview}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="p-3 text-sm text-muted">No blocks found.</li>
          )}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href="/admin/blocks" target="_blank" rel="noopener" className="text-sm font-medium text-brand hover:underline">Manage blocks (opens a new tab)</a>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
