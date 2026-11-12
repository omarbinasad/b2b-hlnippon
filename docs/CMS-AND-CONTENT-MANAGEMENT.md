# CMS and content management

For the backend developer and anyone maintaining the website content features. Status of each feature is in `FRONTEND-MASTER-CHECKLIST.md`. In the demo all content lives in server memory (`src/lib/data/mock-content.ts`) and resets on restart.

## What exists

| Screen | Route | Service |
| --- | --- | --- |
| Pages list, add, edit | `/admin/pages` | `repositories.pages` |
| Posts list, add, edit | `/admin/posts` | `repositories.posts` |
| Media library | `/admin/media` | `repositories.media` |
| Navigation menus, menu builder | `/admin/menus` | `repositories.navigation` |
| Homepage builder (and About page content) | `/admin/homepage` | `repositories.siteContent` |
| Revisions of a page or post: history, compare, restore | `/admin/pages/[id]/revisions`, `/admin/posts/[id]/revisions` | `repositories.contentHistory` |
| Reusable blocks: list, add, edit, usage | `/admin/blocks`, `/admin/blocks/new`, `/admin/blocks/[id]` | `repositories.blocks` |
| Public page | `/[slug]` | `pages.getLiveBySlug` |
| Blog archive, article | `/blog`, `/blog/[slug]` | `posts.archive`, `posts.getBySlug` |
| Staff preview | `/preview/page/[id]`, `/preview/post/[id]` | `pages.getById`, `posts.getById` |
| Sitemap, robots | `/sitemap.xml`, `/robots.txt` | `pages.listLive`, `posts.list` |

Types are in `src/lib/types/content.ts` and `src/lib/types/media.ts`. Interfaces are in `src/lib/data/repositories.ts`.

## Publishing rules (`src/lib/content/rules.ts`, tested)

- Statuses: `draft`, `published`, `scheduled`, `trash`.
- **Live** means published, or scheduled with a time that has passed. A scheduled item goes live on its own at that time; there is no job. The backend can compute this the same way or run a job, but public endpoints must never return anything else.
- Scheduling needs a future time. Publishing needs content. Posts need at least one category to publish.
- Trash remembers the previous status for restoring. Permanent delete works only from the trash.
- Page addresses must be unique and not in `RESERVED_SLUGS`. Post addresses must be unique among posts, and live under `/blog`.
- The blog archive filters by search and by any of several categories (`categories`, comma-separated in the API), so a category name can't contain a comma.

## Content format and sanitization

Page and post bodies are stored as **HTML** produced by the editor (Tiptap, `src/components/admin/content/rich-editor.tsx`).

**The backend must sanitize on save.** The frontend also sanitizes when rendering (`sanitizeRichHtml`, `src/lib/html/sanitize.ts`), but that is a second layer, not the protection. Match this allowlist:

| Allowed | Rule |
| --- | --- |
| Tags | `p br strong em u s small sub sup ul ol li h2–h6 blockquote hr table thead tbody tr th td a img` (`h1` becomes `h2`, since the page has its own) |
| `a href` | `http(s):`, `mailto:`, `tel:`, site-relative `/…`, or `#…`. Check after decoding entities and removing whitespace and control characters |
| `img src` | `http(s):` or site-relative. The image is removed otherwise. `alt` is kept, escaped |
| `style` | Only `text-align` with left, center, right or justify, on `p h2–h6 td th` |
| `div` | Only a reusable-block marker `<div data-block="blk-…" data-name="…"></div>` (id must match `^blk-[a-z0-9-]{1,40}$`; the name is escaped; anything inside is dropped) or the render wrapper `<div data-block-kind="announcement\|banner\|cta\|contact\|productPromo">`. Other `div`s are dropped, their text kept |
| Everything else | Dropped. `script`, `style`, `iframe`, `svg`, `object` and similar are removed with their content |

`tests/cms.test.ts` lists attack strings to reuse as backend tests.

## Revisions (`src/lib/content/revisions.ts`, tested)

- Saving a page or post records a revision when its content changed: title, address, body, excerpt, featured image, SEO fields, page visibility, post categories and tags. A status change alone records nothing.
- The first save of an item with no history also keeps the version it replaced, labelled "Original version" (seed content has no history until then).
- The newest 25 per item are kept (`REVISION_LIMIT`). Deleting the item for good deletes its history.
- **Compare**: the revisions screen compares any revision with the current content ("Compare with current") or with the one before it ("What changed"). Fields are compared one by one; text is a word diff; reusable-block markers show as "[Reusable block: name]"; a change only in formatting, links or images is still reported. The diff runs on the server.
- **Restore** puts the revision's content back and keeps the item's status and publish date. It validates like a save (the address might be taken by now), is recorded as a new revision ("Restored from an earlier version"), and is refused for an item in the trash. On a live item the screen warns that visitors will see it straight away.
- API: `GET /admin/{kind}s/{id}/revisions`, `GET …/revisions/{revisionId}`, `POST …/revisions/{revisionId}/restore` (`kind` = page or post). Store revisions in their own table (see DATABASE-REQUIREMENTS.md).

## Autosave

- While someone edits an existing page or post, unsaved work is sent at most every 8 seconds (`PUT /admin/{kind}s/{id}/autosave`). It is stored apart from the item and **never changes what visitors see**.
- The editor shows the state: "Autosaving…", "Unsaved changes autosaved at 10:42. Visitors don't see them until you save.", "Unsaved changes.", "All changes saved." or an error.
- Opening the editor offers the autosave back when it is newer than the last save and differs from it ("There are newer unsaved changes": restore or discard). Saving the item removes it.
- A new, never-saved item has no id yet, so its autosave stays in the browser (`localStorage`, key `cms-autosave:page:new` / `cms-autosave:post:new`) and is offered back the next time "Add page" or "Add post" opens. Saving clears it.
- Leaving the editor with unsaved changes asks first (in-app links; the browser warns on close or reload).
- **Confirmation before changing live content:** updating a published item, switching it to draft, scheduling it (it leaves the site until then), "Save and preview" on it, and restoring a revision on it all ask first.
- A page or post may consist of just a reusable block or an image: either counts as content for publishing.
- The demo keeps one autosave per item. The backend should keep one per user per item and show whose it is.
- Not built: detecting that someone else saved the item after you opened it (send the `updatedAt` you loaded and refuse a stale save with 409). Listed in BACKEND-PENDING-FEATURES.md.

## Reusable blocks (`src/lib/content/blocks.ts`, tested)

- A block is named content written once and inserted into any number of pages and posts: announcement, banner, call to action, contact details or product promotion. Each type starts from an example and is styled by its type (`[data-block-kind]` in `globals.css`, light and dark).
- In the editor, the **Block** toolbar button opens a picker (search, preview text) and inserts a marker. The marker shows as a labelled box ("Reusable block: name") that can be moved or deleted like any block. Blocks can't contain blocks.
- Pages and posts store only the marker, never a copy. When a page or post is shown (`/[slug]`, `/blog/[slug]`, staff preview), `withBlocks` (`src/lib/data/expand-blocks.ts`) replaces each marker with the block's current content, sanitized. So editing a block updates every page that uses it; a deleted or unknown block shows nothing.
- The block screen lists where the block is used. Deleting is refused while a page or post outside the trash uses it.
- Names are unique (case-insensitive), 2 to 80 characters; content is required, at most 50,000 characters, sanitized like page content with any block markers removed.
- Permissions: blocks use the Pages capabilities (`pages.view`, `pages.create`, `pages.edit`, `pages.delete`); anyone who can edit pages or posts can insert one.
- API: `GET|POST /admin/content-blocks`, `GET|PUT|DELETE /admin/content-blocks/{id}`, `GET /admin/content-blocks/{id}/usage`, public `GET /content-blocks?ids=`. Better for the backend: expand markers itself when it serves a page, with the same rules as `expandBlocks`.

## Media and uploads

Demo limits: JPEG, PNG, WebP or PDF, 4 MB, detected from file content, not the name or browser-sent type. SVG is refused because it can carry scripts. Files are served by `/media/[id]` with `X-Content-Type-Options: nosniff`, and PDFs as attachments.

**Upload contract the backend must provide**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/media?q=&kind=&sort=&dir=&page=` | Paginated `MediaItem` list |
| POST | `/api/v1/media` | Multipart `file`. Returns `MediaItem`. 422 `{ errors: { file } }` |
| PATCH | `/api/v1/media/{id}` | `{ title, alt }` |
| DELETE | `/api/v1/media/{id}` | |

The backend must scan uploads, store them outside the web root or in object storage, generate image sizes, and return public URLs on the host set by `NEXT_PUBLIC_MEDIA_HOST`. Deleting a file in use currently only warns; the backend should decide whether to block it or keep the file.

## Menus (`src/lib/content/menu.ts`, tested)

A menu is a tree of up to 3 levels. An item links to a page (by id, follows renames), a category (by slug) or a custom URL. `GET /api/v1/navigation/{location}` should return the **resolved** form (`ResolvedMenuItem`): real URLs, with links to pages that aren't live left out. One menu per location; assigning a location takes it from any other menu. In the footer, top-level items are column headings.

## Homepage and About content

`SiteContent` is a single JSON document: a top bar, an ordered list of typed sections, and the About page. The backend can store it as one JSON column. Section ids and types are fixed by the frontend; the server action refuses unknown ones. Order and `enabled` are per section. Rules are in `src/lib/validation/site-content.ts`. Links must be `http(s)`, site-relative or `#`.

## Other endpoints to implement

Mirror the repository methods, each behind a content permission:

- `GET|POST /api/v1/pages`, `GET|PUT /api/v1/pages/{id}`, `POST /api/v1/pages/{id}/trash`, `POST /api/v1/pages/{id}/restore`, `DELETE /api/v1/pages/{id}`, `GET /api/v1/public/pages/{slug}`
- The same for `/posts`, plus `GET /api/v1/public/posts`, `GET /api/v1/posts/categories`
- `GET|POST /api/v1/menus`, `GET|PUT|DELETE /api/v1/menus/{id}`
- `GET|PUT /api/v1/site-content`
- Revisions, autosave and reusable blocks: see the sections above and `docs/API-CONTRACTS.md` (generated, authoritative).

A public page with visibility `customers` must return 403 or 404 to anyone but an approved customer. The frontend check is only a screen rule.

## Known limits

- Categories and tags are typed as comma-separated text and derived from posts. There is no separate management screen.
- Autosave doesn't detect a save by someone else in the meantime (see above). Revisions keep content, not status changes.
- Reusable blocks are expanded by the frontend server in the demo; the API should expand them when serving pages.
- Scheduling times are entered in the store's time zone.
- Dragging works with a mouse. Every drag move also has a button, for touch screens and keyboards. The homepage's drag was checked only through its arrow buttons in the browser test.
- The bundled sample logos, photos and copy are sample content for one company. Replace them for a real deployment.

## Hero slides

A slide with a photo uses the photo layout: the photo fills the slide and the copy sits on a frosted card on the left. Without a photo it uses the green card with an icon grid. Fields:

| Field | Notes |
| --- | --- |
| `eyebrow`, `title`, `description` | Small heading, heading, text |
| `cta` | The button. Required |
| `secondaryCta` | Optional text link next to the button, both label and link or neither |
| `image` | Photo for the light theme. Turns on the photo layout |
| `imageDark` | Optional photo for the dark theme. Without it the light photo shows in both |
| `imageMobile` | Optional photo for phones (under 640px), usually portrait. Without it phones show `image`, cropped |
| `imageMobileDark` | Optional phone photo for the dark theme. Without it phones use `imageMobile`, or `imageDark` if there is no phone photo |

The photo layout follows the owner's design: from 1280px the slide keeps the photo's proportions (2089 × 753) and the card's place on it. The card is the same in both themes and slightly see-through, like glass, and everything on the card scales with the slide's width. Below that the photo is cropped to its right-hand side, with the card over the left. On phones the slide is 10:9 (a little wider than tall) and shows the phone photo when there is one; the card sits across the bottom without the description, and its button and link stay on one row. Each photo is a `<picture>` and the hidden theme's photo is lazy, so a browser downloads only the photo it shows. The heading is Poppins unless a heading font is chosen in Company & Branding. The highlights under the heading only show on slides without a photo.

The sample photos are in `public/brand/hero/`. They come from the owner's designs with the card that was drawn into them removed, so the live, editable card sits in its place. A replacement photo works best with its subject on the right; a phone photo works best portrait, with its subject in the upper half and plain ground below for the card. The sample phone photos (`hero-mobile-light.webp`, `hero-mobile-dark.webp`) are web-ready copies of the owner's `public/images/herobannermobile.webp` and `herobannermobiledark.webp`, with the white rounded corners trimmed off the light one.

## Trusted brands section

The homepage's brands section reads from **Admin → Brands**, not from the homepage builder. Each brand has a logo from the media library, a "show on the homepage" switch and a display order (lower first). The builder sets only the heading, the most to show, and the section's place and visibility. A brand without a logo shows its name. A tile links to `/shop?brand=<slug>` only when the brand has products on sale. The section is hidden when no brand is marked. Logos sit on a white tile in dark mode too, so dark logos stay visible.
