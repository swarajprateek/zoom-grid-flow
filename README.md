# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local backend (persist photos on your PC)

This repo now includes a local backend that:

- stores image files in `server/data/uploads`
- stores metadata in SQLite at `server/data/photos.db`
- exposes a local proxy API on `http://localhost:4001` for frontend CRUD calls

### Run locally

```sh
npm install
npm run dev:full
```

This starts:

- frontend: `http://localhost:5173`
- photo server (DB/files): `http://localhost:4000`
- proxy API (frontend target): `http://localhost:4001`

For LAN testing on another device, open the frontend using your PC IP:
- `http://<your-pc-ip>:5173`
The app will automatically call:
- `http://<your-pc-ip>:4001`

If needed, set these environment variables:

- `VITE_API_BASE_URL` (frontend API base, default `http://localhost:4001`)
- `PORT` (backend port, default `4000`)
- `PROXY_PORT` (proxy port, default `4001`)
- `PHOTO_SERVER_URL` (photo server URL, default `http://localhost:4000`)
- `APP_ORIGIN` (single CORS origin, legacy)
- `APP_ORIGINS` (comma-separated CORS origins, preferred)

### Deployed frontend + local API via tunnel

If your frontend is deployed publicly and your API runs on your PC:

1. Start local services:
```sh
npm run dev:server
npm run dev:proxy
```
2. Expose proxy (`http://localhost:4001`) using a tunnel (for example Cloudflare Tunnel).
3. Set deployed frontend env:
```sh
VITE_API_BASE_URL=https://<your-tunnel-domain>
```
4. Set local API env on your PC so CORS allows both local dev and deployed frontend:
```sh
APP_ORIGINS=http://localhost:5173,https://<your-frontend-domain>
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Deploy frontend with GitHub Pages

This repo includes a workflow at `.github/workflows/deploy-pages.yml`.

### One-time GitHub setup

1. Push this repo to GitHub.
2. In GitHub: `Settings -> Pages -> Build and deployment -> Source`, choose `GitHub Actions`.
3. In GitHub: `Settings -> Secrets and variables -> Actions -> Variables`, add:
   - `VITE_API_BASE_URL=https://<your-public-api-domain-or-tunnel>`

### Deploy

- Push to `main` (or run the workflow manually from Actions tab).
- Site URL will be:
  - `https://<github-username>.github.io/<repo-name>/`

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
