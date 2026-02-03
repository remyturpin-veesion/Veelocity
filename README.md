# Veelocity

Developer Analytics Platform - Mesure et visualisation des métriques de performance pour équipes de développement.

## Fonctionnalités

### DORA Metrics
- **Deployment Frequency** - Fréquence des déploiements
- **Lead Time for Changes** - Temps entre commit et déploiement

### Development Metrics
- **PR Review Time** - Temps de review des Pull Requests
- **Cycle Time** - De l'issue à la PR mergée
- **Throughput** - PRs/Issues par période

## Intégrations

| Source | Statut |
|--------|--------|
| GitHub | Planned |
| GitHub Actions | Planned |
| Linear | Planned |

## Stack Technique

- **Backend** : Python 3.11+ / FastAPI
- **Frontend** : React (Vite, TypeScript) — web
- **Database** : PostgreSQL 15
- **Package manager** : uv (backend), npm (frontend)

## Quick Start

### Prérequis

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+ et npm
- Docker & Docker Compose

### Installation

```bash
# Clone
git clone https://github.com/veesion-io/veelocity.git
cd veelocity

# Frontend (React)
cd frontend-react
npm install
cp .env.example .env   # optional: set VITE_API_BASE_URL (default http://localhost:8000)

# Lancer avec Docker (PostgreSQL + backend)
make dev
```

### Développement

```bash
# Backend (avec hot reload)
make dev-local
# ou: cd backend && uv run uvicorn app.main:app --reload --port 8000

# Frontend (React, Vite)
make dev-frontend
# ou: cd frontend-react && npm run dev
```

Le frontend est servi sur http://localhost:5173 et appelle l’API sur `VITE_API_BASE_URL` (par défaut http://localhost:8000).

### Commandes Make

```bash
make dev             # Lance PostgreSQL + backend (Docker)
make dev-local       # Backend en local avec hot reload
make dev-frontend    # Frontend React (Vite) en local
make down            # Arrête les containers
make logs            # Affiche les logs
make test            # Lance les tests backend
make migrate         # Applique les migrations Alembic
make lint            # Ruff check (backend)
make format          # Black format (backend)
```

## Structure

```
veelocity/
├── backend/          # API FastAPI
├── frontend-react/   # App React (Vite, TypeScript)
├── frontend/         # Ancienne app Flutter (conservée pour référence)
├── infra/docker/     # Docker Compose
├── docs/plans/       # Design documents
├── CLAUDE.md         # Guide pour Claude Code
└── README.md
```

## Roadmap

- **v0.1.0** - Foundation (setup projet)
- **v0.2.0** - GitHub Integration
- **v0.3.0** - GitHub Actions + DORA Metrics
- **v0.4.0** - Linear + Dev Metrics
- **v0.5.0** - Polish (charts, filtres)

## Equipe

Projet interne Veesion.

## License

Proprietary - Veesion 2026
