# Veelocity Frontend

React SPA for the Veelocity developer analytics platform.

## Tech Stack

- React 19 with TypeScript
- Vite for build tooling
- Zustand for state management
- TanStack Query for server state
- Recharts for data visualization
- React Router v7

## Development

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Start dev server (http://localhost:5173)
pnpm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API URL |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | TypeScript check + production build |
| `pnpm run preview` | Preview production build locally |
| `pnpm run lint` | Run ESLint |

## Path Aliases

`@/` maps to `./src/` — configured in `vite.config.ts` and `tsconfig.app.json`.

```typescript
import { api } from '@/api/client';
```

## Production Build

The `Dockerfile` in this directory builds a production image using nginx:

```bash
docker build --build-arg VITE_API_BASE_URL=https://your-api.example.com -t veelocity-frontend .
docker run -p 80:80 veelocity-frontend
```

See the root [deployment guide](../docs/deployment.md) for the full production setup.
