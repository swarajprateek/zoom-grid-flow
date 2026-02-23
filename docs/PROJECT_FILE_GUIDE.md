# Project walkthrough (file by file) + backend plan

## 1) What this app is today
This is a Vite + React + TypeScript single-page app that acts as a **local photo library UI**. Users can upload image files, view them in a responsive grid, zoom grid density (pinch/ctrl+wheel), open a full-screen preview, download an image, and remove images. In the current implementation, photo data is held in browser memory/object URLs (frontend only).

---

## 2) File-by-file guide

### Root and tooling
- `README.md`: Generic Lovable scaffold with setup/deploy notes; not customized for this app yet.
- `package.json`: Scripts (`dev`, `build`, `test`, `lint`) and dependencies (React, Vite, Tailwind, Radix/shadcn, Vitest).
- `package-lock.json`, `bun.lockb`: Lockfiles for deterministic installs.
- `.gitignore`: Ignores build output, logs, node modules, editor files.
- `.env`: Frontend-exposed Supabase variables (project ID/url/publishable key).
- `index.html`: SPA host file with `#root` and metadata placeholders.
- `components.json`: shadcn UI generator config (style, aliases, Tailwind file pointers).

### Build/config files
- `vite.config.ts`: Vite server config, React SWC plugin, `@` alias, optional lovable component tagger in dev.
- `vitest.config.ts`: Vitest config using jsdom + `src/test/setup.ts`, `@` alias.
- `eslint.config.js`: ESLint flat config with TS/React hooks/react-refresh rules.
- `tailwind.config.ts`: Tailwind theme extension, CSS-variable color tokens, animations.
- `postcss.config.js`: Tailwind + autoprefixer wiring.
- `tsconfig.json`: Root TS project references + relaxed compiler defaults.
- `tsconfig.app.json`: App TS settings for browser code (bundler mode, jsx, aliases).
- `tsconfig.node.json`: TS settings for Node-side config files.

### Public assets
- `public/favicon.ico`: Browser tab icon.
- `public/robots.txt`: Crawl guidance file.
- `public/placeholder.svg`: Placeholder image asset.

### Supabase project metadata
- `supabase/config.toml`: Supabase local project ID reference.

### App entry and routing
- `src/main.tsx`: React root mount and global CSS import.
- `src/App.tsx`: App providers (React Query, tooltip, toasts), router (`/` + fallback).
- `src/pages/Index.tsx`: Maps home route to `PhotoLibrary` component.
- `src/pages/NotFound.tsx`: 404 page + logs unknown path to console.

### Main feature components/hooks
- `src/components/PhotoLibrary.tsx`: Primary UI/interaction layer.
  - Upload via hidden file input.
  - Drag-and-drop support.
  - Grid rendering with adjustable columns/sizes.
  - Pinch + ctrl/cmd-wheel handlers.
  - Full-screen image modal preview.
  - Remove/download actions per image.
- `src/hooks/usePhotoLibrary.ts`: Photo state model and actions.
  - Defines `Photo` type (`id`, `name`, `url`, `file`, `uploadedAt`).
  - Converts selected files to object URLs.
  - Validates `image/*` and max size guard.
  - Adds/removes photos and revokes object URLs.
  - Download helper creates temporary `<a download>`.
- `src/hooks/usePinchGrid.ts`: Grid zoom state machine.
  - Presets for small/medium/large/xlarge thumbnails.
  - Converts pinch delta into preset index changes.
  - Exposes columns/current preset + controls.
- `src/components/NavLink.tsx`: Tiny helper component for nav items with active state styling.
- `src/hooks/use-mobile.tsx`: Simple media-query hook for mobile breakpoint (`<768px`).
- `src/hooks/use-toast.ts`: Toast state/reducer + listener mechanism.

### Styling/utilities
- `src/index.css`: Tailwind layers + HSL design tokens (light/dark) + global base styles.
- `src/App.css`: Minimal default css from scaffold (largely unused by current UI).
- `src/lib/utils.ts`: `cn()` helper combining `clsx` + `tailwind-merge`.
- `src/vite-env.d.ts`: Vite TypeScript ambient types.

### Tests
- `src/test/example.test.ts`: Basic sample test (`2 + 2 = 4`) sanity check.
- `src/test/setup.ts`: Testing Library jest-dom setup.

### Supabase integration stubs
- `src/integrations/supabase/client.ts`: Initialized Supabase client from env vars.
- `src/integrations/supabase/types.ts`: Generated DB TypeScript types (currently no tables defined).

### shadcn UI primitives (mostly reusable wrappers)
These are standard Radix + Tailwind wrappers. In this project they are largely scaffolding for future UI needs:
- `src/components/ui/accordion.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button.tsx` *(used by PhotoLibrary)*
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx` *(used by App)*
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/tooltip.tsx` *(provider used by App)*
- `src/components/ui/use-toast.ts` *(re-export adapter)*

---

## 3) How to build the backend using your laptop storage + host on internet

## Recommended architecture (best balance for your use case)
Use this stack:
1. **Backend API**: Node.js + Fastify (or Express if you prefer familiarity).
2. **Metadata DB**: SQLite on your laptop (single file DB; ideal for personal/small usage).
3. **File storage**: Local filesystem folder, e.g. `~/photo-library-data/uploads`.
4. **Image processing**: `sharp` for thumbnails/compression.
5. **Auth**: Start simple with session/password; add OAuth later if needed.
6. **Internet exposure**: Cloudflare Tunnel or Tailscale Funnel (safer than direct router port-forward).
7. **TLS/domain**: Cloudflare managed domain + HTTPS via tunnel.
8. **Process manager**: PM2 or systemd service so backend auto-restarts.

Why this is best here:
- You explicitly want laptop-backed storage.
- SQLite + local filesystem is the simplest robust option.
- Tunnel avoids opening home network ports directly.

## Data model suggestion
- `photos` table:
  - `id` (uuid)
  - `filename_original`
  - `filename_storage`
  - `mime_type`
  - `size_bytes`
  - `width`, `height`
  - `created_at`
  - optional `sha256` for dedupe

Filesystem layout:
- `/data/uploads/<year>/<month>/<photoId>.jpg`
- `/data/thumbs/<photoId>-sm.webp`
- `/data/thumbs/<photoId>-md.webp`

## API endpoints (v1)
- `POST /api/photos` — multipart upload, save file + DB row.
- `GET /api/photos` — list photos (pagination).
- `GET /api/photos/:id/file` — stream original.
- `GET /api/photos/:id/thumb?size=sm|md` — stream thumbnail.
- `DELETE /api/photos/:id` — remove DB row + files.
- `GET /api/health` — uptime/status check.

## Security checklist (important when exposing a laptop)
- Run backend under non-admin user.
- Enforce auth on all write endpoints.
- Rate limit upload and login routes.
- Restrict upload MIME + validate magic bytes.
- Store files outside app source tree.
- Back up SQLite and uploads regularly.
- Add UPS/autosave strategy if power cuts matter.

## Reliability realities of hosting from your laptop
This can work well for personal or small-team usage, but trade-offs:
- Service availability depends on laptop power + internet uptime.
- Home ISPs may rotate IP / throttle uploads.
- Sleep mode kills service unless disabled.

If you expect frequent public usage, move backend to a low-cost VPS/NAS later while keeping same stack.

## Migration path from current frontend
1. Keep `PhotoLibrary` UI mostly unchanged.
2. Replace `usePhotoLibrary` local-object-URL logic with API calls.
3. Keep optimistic UI for smooth UX.
4. Add auth flow and token/session handling.
5. Optionally keep Supabase only for auth (or remove fully).

## What to use right now (practical pick)
- **Best practical pick for you**: Fastify + SQLite + local filesystem + Cloudflare Tunnel.
- **If you want easiest GUI management**: same stack but wrap with Docker Compose.
- **If you want max performance later**: migrate DB to Postgres, keep API contract unchanged.

