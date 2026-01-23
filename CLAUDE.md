# CLAUDE.md - Guide pour Claude Code

## Projet Veelocity

Veelocity est un outil personnel d'analytics pour développeurs, mesurant les métriques DORA et la performance de delivery.

## Stack Technique

- **Backend** : Python 3.11+ avec FastAPI
- **Frontend** : Flutter (Web + iOS + Android)
- **Base de données** : PostgreSQL 15
- **Background tasks** : FastAPI BackgroundTasks + APScheduler
- **Package manager** : uv
- **Conteneurisation** : Docker (single container)

## Structure du Projet

```
veelocity/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # Routes FastAPI
│   │   ├── connectors/           # Intégrations (GitHub, Linear)
│   │   │   ├── base.py           # BaseConnector ABC
│   │   │   ├── github.py
│   │   │   ├── github_actions.py
│   │   │   └── linear.py
│   │   ├── core/                 # Configuration, database
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/               # Modèles SQLAlchemy
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── services/
│   │   │   ├── metrics/          # dora.py, development.py
│   │   │   └── sync.py           # Orchestration sync
│   │   └── main.py
│   ├── tests/
│   ├── alembic/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   └── lib/
│       ├── core/                 # Configuration
│       ├── models/
│       ├── services/             # api_service, providers
│       ├── screens/              # dashboard, dora, development, settings
│       ├── widgets/              # kpi_card, charts, period_selector
│       └── main.dart
├── infra/docker/
│   ├── docker-compose.yml
│   └── .env.example
├── docs/plans/
├── CLAUDE.md
└── Makefile
```

## Commandes Utiles

```bash
# Backend (uv gère le venv et les dépendances automatiquement)
cd backend
uv run uvicorn app.main:app --reload

# Frontend
cd frontend
flutter pub get
flutter run -d chrome

# Docker (dev)
make dev       # Lance PostgreSQL + backend
make down      # Arrête tout
make logs      # Affiche les logs
make test      # Lance les tests backend
make migrate   # Applique les migrations
make lint      # Ruff check
make format    # Black format
```

## Conventions de Code

### Python (Backend)
- Utiliser `async/await` pour toutes les opérations I/O
- Type hints obligatoires
- Docstrings Google style
- Formatter : `black`
- Linter : `ruff`
- Tests avec `pytest` + `pytest-asyncio`

### Dart (Frontend)
- Suivre les conventions Flutter/Dart officielles
- État géré avec `Riverpod`
- Formatter : `dart format`
- Tests unitaires et widget tests

### Commits
- Format : `type(scope): message`
- Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`
- Exemple : `feat(connector): add GitHub Actions integration`

## Architecture

### Pas d'authentification
Outil single-user. Pas de modèle User/Organization. Pas de JWT.

### Credentials via environnement
Tous les tokens (GitHub, Linear) sont configurés dans `.env`, pas via UI.

### Sync hybride
- Sync au démarrage du serveur
- Sync périodique via APScheduler
- Sync manuelle via API/UI
- Données récentes fetchées on-demand

### Détection des déploiements
Par pattern de nom de workflow GitHub Actions (configurable via `DEPLOYMENT_PATTERNS`).

## Architecture des Connecteurs

```python
from abc import ABC, abstractmethod
from datetime import datetime

class BaseConnector(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def test_connection(self) -> bool: ...

    @abstractmethod
    async def sync_all(self) -> SyncResult: ...

    @abstractmethod
    async def sync_recent(self, since: datetime) -> SyncResult: ...

    @abstractmethod
    def get_supported_metrics(self) -> list[str]: ...
```

## Métriques

### DORA Metrics (v0.3)
| Métrique | Calcul | Sources |
|----------|--------|---------|
| Deployment Frequency | Déploiements / période | GitHub Actions |
| Lead Time for Changes | Premier commit → deploy | GitHub + Actions |

### Development Metrics (v0.4)
| Métrique | Calcul | Sources |
|----------|--------|---------|
| PR Review Time | PR ouverte → première review | GitHub |
| PR Merge Time | PR ouverte → merged | GitHub |
| Cycle Time | Issue créée → PR merged | Linear + GitHub |
| Throughput | PRs/Issues par période | Linear + GitHub |

## Roadmap

### v0.1.0 - Foundation
- [x] Setup backend FastAPI
- [x] Setup frontend Flutter
- [x] Docker Compose pour dev local
- [x] Health endpoint + tests

### v0.2.0 - GitHub Integration
- [ ] Connecteur GitHub (repos, PRs, commits, reviews, comments)
- [ ] Mécanisme de sync (startup + APScheduler + manuel)
- [ ] Modèles GitHub (Repository, PullRequest, PRReview, PRComment, Commit)

### v0.3.0 - GitHub Actions + DORA
- [ ] Connecteur GitHub Actions (workflows, runs)
- [ ] Deployment Frequency
- [ ] Lead Time for Changes
- [ ] Dashboard basique Flutter

### v0.4.0 - Linear + Dev Metrics
- [ ] Connecteur Linear (teams, issues)
- [ ] Cycle Time, PR Review Time, Throughput
- [ ] Dashboard complet

### v0.5.0 - Polish
- [ ] Graphiques détaillés (fl_chart)
- [ ] Filtres (période, repo)
- [ ] Error handling, empty states

## Contexte

- **Entreprise** : Veesion
- **Usage** : Personnel / petite équipe
- **Objectif** : Visibilité sur la performance de delivery

## Notes pour Claude

1. **Simple** : Single-user, pas d'auth, pas de Redis/Celery/K8s
2. **Itératif** : Avancer version par version
3. **Tests** : Écrire des tests pour chaque fonctionnalité
4. **Async** : async/await partout dans le backend
5. **Type Safety** : Type hints Python + types Dart stricts
6. **YAGNI** : Ne pas sur-engineerer, garder les solutions simples
7. **uv** : Utiliser uv au lieu de pip pour les packages Python
