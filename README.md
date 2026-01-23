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
- **Frontend** : Flutter (Web, iOS, Android)
- **Database** : PostgreSQL 15
- **Package manager** : uv

## Quick Start

### Prérequis

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Flutter 3.x
- Docker & Docker Compose

### Installation

```bash
# Clone
git clone https://github.com/veesion-io/veelocity.git
cd veelocity

# Frontend
cd frontend
flutter pub get

# Lancer avec Docker (PostgreSQL + backend)
make dev
```

### Développement

```bash
# Backend (avec hot reload) - uv gère le venv et les dépendances automatiquement
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Frontend (web)
cd frontend
flutter run -d chrome
```

### Commandes Make

```bash
make dev             # Lance PostgreSQL + backend
make down            # Arrête les containers
make logs            # Affiche les logs
make test            # Lance les tests backend
make migrate         # Applique les migrations Alembic
make lint            # Ruff check
make format          # Black format
```

## Structure

```
veelocity/
├── backend/          # API FastAPI
├── frontend/         # App Flutter
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
