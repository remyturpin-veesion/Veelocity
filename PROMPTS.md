# Prompts d'Itération pour Claude Code

Ce fichier contient les prompts à exécuter avec Claude Code pour chaque version.
Exécute-les dans l'ordre, un par un.

---

## v0.1.0 - Foundation

### Prompt 1 : Setup Backend

```
Initialise le backend Python pour Veelocity :

1. Crée la structure backend/ avec :
   - app/main.py (FastAPI app)
   - app/core/config.py (settings avec pydantic-settings)
   - app/core/database.py (async SQLAlchemy avec PostgreSQL)
   - app/core/security.py (JWT utils)
   - app/api/v1/router.py
   - app/api/v1/endpoints/health.py (endpoint /health)

2. Crée requirements.txt avec :
   - fastapi
   - uvicorn[standard]
   - sqlalchemy[asyncio]
   - asyncpg
   - pydantic-settings
   - python-jose[cryptography]
   - passlib[bcrypt]
   - httpx
   - celery
   - redis
   - alembic
   - pytest
   - pytest-asyncio
   - black
   - ruff

3. Crée un Dockerfile pour le backend

4. Ajoute un endpoint GET /api/v1/health qui retourne {"status": "healthy"}

Suis les conventions du CLAUDE.md.
```

### Prompt 2 : Setup Frontend

```
Initialise le frontend Flutter pour Veelocity :

1. Crée le projet Flutter dans frontend/ avec :
   - Suppression du code boilerplate
   - Structure : lib/models/, lib/services/, lib/screens/, lib/widgets/
   - Configuration pour web + mobile

2. Ajoute les dépendances dans pubspec.yaml :
   - flutter_riverpod (state management)
   - dio (HTTP client)
   - fl_chart (graphiques)
   - go_router (navigation)
   - shared_preferences
   - intl

3. Crée un écran de base avec :
   - AppBar "Veelocity"
   - Message "Welcome to Veelocity"
   - Thème avec couleur primaire #1E3A5F

4. Configure le service API de base (lib/services/api_service.dart)

Suis les conventions du CLAUDE.md.
```

### Prompt 3 : Docker Compose

```
Crée la configuration Docker Compose pour le développement local :

1. Crée infra/docker/docker-compose.yml avec :
   - postgres:15 (port 5432, volume persistant)
   - redis:7 (port 6379)
   - backend (build depuis backend/, port 8000, depends_on postgres et redis)
   - Variables d'environnement depuis .env.example

2. Crée infra/docker/.env.example avec les variables nécessaires

3. Crée un Makefile à la racine avec les commandes :
   - make dev : lance docker-compose up
   - make down : arrête tout
   - make logs : affiche les logs
   - make shell-backend : ouvre un shell dans le container backend
   - make test : lance les tests backend

Assure-toi que tout fonctionne ensemble.
```

### Prompt 4 : Modèles de Base et Auth

```
Implémente les modèles de base et l'authentification :

1. Crée les modèles SQLAlchemy dans app/models/ :
   - User (id, email, hashed_password, full_name, is_active, created_at)
   - Organization (id, name, slug, created_at)
   - UserOrganization (user_id, organization_id, role)

2. Crée les schemas Pydantic dans app/schemas/ :
   - UserCreate, UserRead, UserUpdate
   - Token, TokenPayload
   - OrganizationCreate, OrganizationRead

3. Crée les endpoints d'auth dans app/api/v1/endpoints/auth.py :
   - POST /auth/register
   - POST /auth/login (retourne JWT)
   - GET /auth/me (utilisateur courant)

4. Configure Alembic pour les migrations :
   - alembic init
   - Première migration avec les modèles

5. Ajoute les tests pour l'authentification

Utilise async/await partout.
```

---

## v0.2.0 - GitHub Integration

### Prompt 5 : BaseConnector et GitHub Connector

```
Implémente le système de connecteurs et l'intégration GitHub :

1. Crée app/connectors/base.py avec la classe abstraite BaseConnector :
   - name (property)
   - authenticate(credentials) -> bool
   - test_connection() -> bool
   - fetch_data(params) -> list[dict]
   - get_sync_status() -> SyncStatus
   - get_supported_metrics() -> list[str]

2. Crée app/connectors/github.py (GitHubConnector) :
   - Authentification via Personal Access Token
   - Méthodes pour récupérer :
     - Liste des repos
     - Pull Requests (avec reviews, comments)
     - Commits
     - Contributors
   - Utilise httpx async

3. Crée les modèles pour stocker les données GitHub :
   - Repository (id, github_id, name, full_name, org_id)
   - PullRequest (id, github_id, repo_id, number, title, state, author, created_at, merged_at, etc.)
   - Commit (id, sha, repo_id, author, message, created_at)

4. Crée les endpoints API :
   - POST /connectors/github/connect (enregistre le token)
   - GET /connectors/github/status
   - POST /connectors/github/sync (déclenche une sync)
   - GET /connectors/github/repos

5. Ajoute des tests pour le connecteur GitHub (avec mocks)
```

### Prompt 6 : GitHub Actions Connector

```
Implémente le connecteur GitHub Actions :

1. Crée app/connectors/github_actions.py :
   - Hérite les credentials du GitHubConnector
   - Récupère les workflows et leurs runs
   - Identifie les déploiements (workflows avec "deploy" dans le nom ou label)

2. Crée les modèles :
   - Workflow (id, github_id, repo_id, name, path)
   - WorkflowRun (id, github_id, workflow_id, status, conclusion, started_at, completed_at, etc.)
   - Deployment (id, run_id, environment, status, deployed_at)

3. Ajoute la logique pour identifier les déploiements :
   - Par nom de workflow (deploy, release, publish)
   - Par environment GitHub (production, staging)

4. Endpoints :
   - GET /connectors/github-actions/workflows
   - GET /connectors/github-actions/deployments
   - GET /connectors/github-actions/runs

5. Tests avec mocks
```

### Prompt 7 : Synchronisation Async

```
Implémente la synchronisation asynchrone avec Celery :

1. Configure Celery dans app/workers/ :
   - celery_app.py (configuration)
   - tasks.py (tâches de sync)

2. Crée les tâches de synchronisation :
   - sync_github_repos : sync les repos d'une org
   - sync_github_prs : sync les PRs (incrémental)
   - sync_github_actions : sync les workflow runs
   - sync_all : orchestre toutes les syncs

3. Ajoute le scheduling :
   - Sync incrémentale toutes les 15 minutes
   - Sync complète quotidienne à 3h du matin

4. Crée un modèle SyncLog pour tracker :
   - connector_name, started_at, completed_at, status, items_synced, error

5. Endpoints :
   - POST /sync/trigger (déclenche une sync manuelle)
   - GET /sync/status (statut des dernières syncs)
   - GET /sync/logs (historique)

6. Ajoute le worker Celery au docker-compose
```

---

## v0.3.0 - DORA Metrics

### Prompt 8 : Service de Métriques DORA

```
Implémente le calcul des métriques DORA :

1. Crée app/services/metrics/dora.py avec DORAMetricsService :
   
   - deployment_frequency(org_id, start_date, end_date, group_by=None)
     → Nombre de déploiements par période
     → Groupable par : jour, semaine, mois, repo, team
   
   - lead_time_for_changes(org_id, start_date, end_date)
     → Temps médian entre premier commit d'une PR et déploiement
     → Retourne : median, p50, p75, p90, p95
   
   - calculate_all(org_id, start_date, end_date)
     → Retourne toutes les métriques DORA

2. Crée les schemas de réponse :
   - DeploymentFrequencyResponse
   - LeadTimeResponse
   - DORAMetricsResponse

3. Endpoints :
   - GET /metrics/dora (toutes les métriques)
   - GET /metrics/dora/deployment-frequency
   - GET /metrics/dora/lead-time
   - Query params : start_date, end_date, repo_id (optionnel), team_id (optionnel)

4. Tests unitaires avec données de test réalistes
```

### Prompt 9 : Dashboard Flutter - Base

```
Crée le dashboard principal dans Flutter :

1. Structure de navigation :
   - Sidebar avec : Dashboard, DORA Metrics, Builds, Settings
   - AppBar avec user menu

2. Écran Dashboard (lib/screens/dashboard_screen.dart) :
   - 4 cards KPI en haut (les 4 DORA metrics)
   - Chaque card affiche : valeur, tendance, sparkline
   - Sélecteur de période (7j, 30j, 90j, custom)

3. Crée les widgets réutilisables :
   - KPICard (valeur, label, tendance, sparkline)
   - PeriodSelector
   - TrendIndicator (up/down avec couleur)

4. Service API pour récupérer les métriques :
   - lib/services/metrics_service.dart
   - Méthodes : getDORAMetrics(), getDeploymentFrequency(), etc.

5. State management avec Riverpod :
   - metricsProvider
   - periodProvider
   - Gestion du loading et des erreurs
```

### Prompt 10 : Graphiques DORA

```
Ajoute les graphiques détaillés pour les métriques DORA :

1. Écran DORA Metrics (lib/screens/dora_metrics_screen.dart) :
   - Tabs : Overview, Deployment Frequency, Lead Time
   
2. Tab Overview :
   - 4 cards KPI (comme dashboard)
   - Graphique combiné avec les 4 métriques sur 30 jours

3. Tab Deployment Frequency :
   - Bar chart des déploiements par jour/semaine
   - Filtre par repository
   - Tableau des derniers déploiements

4. Tab Lead Time :
   - Line chart de l'évolution du lead time
   - Distribution (histogramme) des lead times
   - Percentiles (p50, p75, p90, p95)

5. Widgets graphiques :
   - TimeSeriesChart (générique pour line/bar)
   - DistributionChart (histogramme)
   - Utilise fl_chart

6. Ajoute les tests widget
```

---

## v0.4.0 - Linear & Dev Metrics

### Prompt 11 : Linear Connector

```
Implémente le connecteur Linear :

1. Crée app/connectors/linear.py :
   - Authentification OAuth2 ou API Key
   - GraphQL client pour l'API Linear
   
2. Récupération des données :
   - Teams
   - Projects
   - Issues (avec états, assignees, dates)
   - Cycles

3. Modèles :
   - LinearTeam
   - LinearProject
   - LinearIssue (id, identifier, title, state, assignee_id, created_at, started_at, completed_at, etc.)
   - LinearCycle

4. Mapping Issue → PR :
   - Via branch name (feature/ISSUE-123)
   - Via PR description (mentions d'issue)

5. Endpoints :
   - POST /connectors/linear/connect
   - GET /connectors/linear/teams
   - GET /connectors/linear/issues
   - POST /connectors/linear/sync

6. Tâches Celery pour sync Linear
```

### Prompt 12 : Métriques de Développement

```
Implémente les métriques de développement :

1. Crée app/services/metrics/development.py :

   - pr_review_time(org_id, start_date, end_date)
     → Temps entre PR ouverte et première review
     → Temps entre PR ouverte et merge
   
   - cycle_time(org_id, start_date, end_date)
     → Issue créée → PR merged
     → Nécessite le lien Linear ↔ GitHub
   
   - throughput(org_id, start_date, end_date, group_by)
     → PRs merged par période
     → Issues completed par période
     → Groupable par dev, team, repo

2. Schemas :
   - PRReviewTimeResponse
   - CycleTimeResponse
   - ThroughputResponse

3. Endpoints :
   - GET /metrics/development/pr-review-time
   - GET /metrics/development/cycle-time
   - GET /metrics/development/throughput

4. Tests avec scénarios réalistes
```

### Prompt 13 : Vue Équipe et Développeur

```
Crée les vues par équipe et développeur dans Flutter :

1. Écran Team View (lib/screens/team_screen.dart) :
   - Liste des développeurs avec leurs stats
   - Métriques agrégées de l'équipe
   - Graphique de contribution (qui fait quoi)

2. Écran Developer Detail (lib/screens/developer_screen.dart) :
   - Stats individuelles :
     - PRs ouvertes/merged
     - Review time moyen
     - Cycle time moyen
     - Throughput
   - Historique d'activité (timeline)
   - Comparaison avec la moyenne de l'équipe

3. Widgets :
   - DeveloperCard (avatar, nom, stats clés)
   - ActivityTimeline
   - ComparisonChart (dev vs team avg)

4. Providers Riverpod :
   - teamMembersProvider
   - developerStatsProvider(developerId)
```

---

## v0.5.0 - Mobile Builds

### Prompt 14 : Métriques de Builds

```
Implémente les métriques de builds iOS/Android :

1. Crée app/services/metrics/builds.py :

   - build_success_rate(org_id, platform, start_date, end_date)
     → % de builds réussis
     → Par plateforme (ios, android, all)
   
   - build_duration(org_id, platform, start_date, end_date)
     → Durée moyenne, médiane, p90
     → Évolution dans le temps
   
   - build_frequency(org_id, platform, start_date, end_date)
     → Nombre de builds par période

2. Identification des builds mobile dans GitHub Actions :
   - Par nom de workflow (ios-build, android-build, mobile-ci)
   - Par fichier workflow (*.yml contenant xcodebuild, gradle)
   - Ajouter un champ 'platform' au modèle WorkflowRun

3. Endpoints :
   - GET /metrics/builds/success-rate
   - GET /metrics/builds/duration
   - GET /metrics/builds/frequency
   - Query param : platform (ios|android|all)

4. Tests
```

### Prompt 15 : Dashboard Builds Flutter

```
Crée l'écran de statistiques builds dans Flutter :

1. Écran Builds (lib/screens/builds_screen.dart) :
   - Toggle iOS / Android / All
   - Cards KPI : Success Rate, Avg Duration, Builds Today

2. Graphiques :
   - Success rate over time (line chart)
   - Build duration trend (line chart avec bandes p50/p90)
   - Builds per day (bar chart)
   - Failed builds breakdown (pie chart par type d'erreur si dispo)

3. Tableau des derniers builds :
   - Status (success/failure)
   - Plateforme
   - Durée
   - Branch
   - Lien vers GitHub Actions

4. Widgets :
   - PlatformToggle (iOS/Android/All)
   - BuildStatusBadge
   - DurationDisplay (formaté)

5. Providers :
   - buildMetricsProvider(platform)
   - recentBuildsProvider(platform)
```

---

## v0.6.0 - Slack & Incidents

### Prompt 16 : Slack Connector

```
Implémente le connecteur Slack :

1. Crée app/connectors/slack.py :
   - OAuth2 authentication
   - Scopes : channels:history, channels:read

2. Fonctionnalités :
   - Identifier les channels d'incidents (#incidents, #alerts, etc.)
   - Parser les messages d'incidents
   - Détecter début/fin d'incident (via reactions, threads, ou mots-clés)

3. Modèles :
   - SlackChannel
   - Incident (id, channel_id, title, started_at, resolved_at, severity, deployment_id)

4. Configuration :
   - Patterns pour identifier les incidents
   - Mapping channel → environment

5. Endpoints :
   - POST /connectors/slack/connect
   - GET /connectors/slack/channels
   - GET /connectors/slack/incidents
   - POST /connectors/slack/configure (définir les patterns)

6. Sync Celery
```

### Prompt 17 : Métriques DORA Complètes

```
Complète les métriques DORA avec CFR et MTTR :

1. Ajoute à app/services/metrics/dora.py :

   - change_failure_rate(org_id, start_date, end_date)
     → % de déploiements suivis d'un incident
     → Fenêtre de corrélation configurable (ex: 1h après deploy)
   
   - mean_time_to_recovery(org_id, start_date, end_date)
     → Temps moyen entre début et fin d'incident
     → Par severity si disponible

2. Logique de corrélation deployment ↔ incident :
   - Par timestamp (incident dans les X heures après deploy)
   - Par environment (prod, staging)
   - Possibilité de lier manuellement

3. Mise à jour des endpoints et schemas

4. Dashboard Flutter :
   - Ajouter CFR et MTTR aux cards KPI
   - Graphiques d'évolution
   - Liste des incidents récents avec déploiement associé

5. Tests avec scénarios d'incidents
```

---

## v1.0.0 - Production Ready

### Prompt 18 : Multi-utilisateurs

```
Implémente le système multi-utilisateurs complet :

1. Gestion des organisations :
   - Invitations par email
   - Rôles : Admin, Manager, Viewer
   - Permissions granulaires

2. Endpoints :
   - POST /organizations (créer une org)
   - POST /organizations/{id}/invite
   - GET /organizations/{id}/members
   - PUT /organizations/{id}/members/{user_id}/role
   - DELETE /organizations/{id}/members/{user_id}

3. Middleware de permissions :
   - Vérifier le rôle avant chaque action
   - Isolation des données par org

4. Flutter :
   - Écran Settings avec gestion de l'équipe
   - Invitation de nouveaux membres
   - Gestion des rôles (pour admins)

5. Tests d'autorisation
```

### Prompt 19 : Déploiement Production

```
Prépare le déploiement production :

1. Kubernetes manifests dans infra/k8s/ :
   - Deployment backend (avec replicas, resources, probes)
   - Service + Ingress
   - ConfigMap et Secrets
   - PostgreSQL (ou RDS)
   - Redis
   - Celery workers
   - CronJob pour sync quotidienne

2. GitHub Actions workflows :
   - .github/workflows/ci.yml (tests sur PR)
   - .github/workflows/deploy.yml (deploy sur main)
   - Build et push images vers ECR
   - Deploy via kubectl/helm

3. Configuration :
   - Variables d'environnement par env (staging/prod)
   - Secrets management
   - Health checks et readiness probes

4. Monitoring :
   - Endpoint /metrics (Prometheus format)
   - Logs structurés (JSON)

5. Documentation de déploiement dans docs/
```

### Prompt 20 : Documentation et Polish

```
Finalise la documentation et le polish :

1. Documentation API :
   - OpenAPI/Swagger automatique via FastAPI
   - Exemples pour chaque endpoint
   - Guide d'authentification

2. README complet :
   - Installation détaillée
   - Configuration
   - Guide de contribution

3. Guide utilisateur :
   - Comment connecter GitHub
   - Comment connecter Linear
   - Comprendre les métriques DORA

4. Polish Flutter :
   - Loading states partout
   - Error handling avec retry
   - Empty states
   - Animations subtiles
   - Dark mode

5. Tests E2E :
   - Scénario complet : login → connect GitHub → voir métriques
```

---

## Notes d'utilisation

1. **Exécute un prompt à la fois** avec Claude Code
2. **Vérifie que tout fonctionne** avant de passer au suivant
3. **Commit après chaque prompt** réussi
4. **Tag les versions** : `git tag v0.1.0` après avoir complété une version

### Commande type pour Claude Code

```bash
cd ~/projects/veelocity
claude "Initialise le backend Python pour Veelocity : [coller le prompt]"
```

Ou plus simple, ouvre le fichier PROMPTS.md et copie-colle le prompt dans Claude Code.
