# keys-vault

Zero-knowledge password-notes web app. React SPA + Supabase. See `../OneDrive/Keys/docs/specs/` for the design spec and `../OneDrive/Keys/docs/plans/` for the implementation plan.

## Development

```bash
npm install
cp .env.example .env.local  # then fill in Supabase values
npm run dev
```

## Testing

```bash
npm run test:run
```

## Deploying to Cloudflare Pages

1. Push to `main` on GitHub.
2. Cloudflare Dashboard → Pages → Create project → Connect to GitHub → select `keys-vault` repo.
3. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: 20
4. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL` = (your project URL)
   - `VITE_SUPABASE_ANON_KEY` = (your anon key)
5. Deploy. URL will be `https://keys-vault.pages.dev` or your custom domain.
