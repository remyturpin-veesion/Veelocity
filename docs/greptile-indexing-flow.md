# Flux Greptile dans Veelocity (lecture seule)

Veelocity **ne déclenche jamais d’indexation** chez Greptile. Il ne fait que **récupérer des données** (statut d’indexation, métriques), les **stocker** et les **afficher**. Pour indexer ou ré-indexer des dépôts, il faut utiliser l’[app Greptile](https://app.greptile.com).

Ce doc décrit comment les statuts (Processing, Indexed, Error, etc.) arrivent dans Veelocity et comment ils sont mis à jour.

---

## 1. Rôle de Veelocity

- **Fetch** : appeler l’API Greptile (GET list, GET repo par ID) pour récupérer le statut d’indexation des repos.
- **Stockage** : persister ces données en base (table `GreptileRepository`, sync state).
- **Affichage** : montrer les statuts et métriques dans l’interface (page Indexing, overview Greptile, etc.).

Veelocity **n’appelle jamais** `POST /repositories` (trigger indexation) chez Greptile.

---

## 2. D’où viennent les statuts ?

Les statuts affichés (Indexed, Processing, Error, Not found, etc.) viennent **uniquement** de ce que l’API Greptile renvoie quand on interroge l’état des repos.

### Sync de fond (scheduler)

| Fréquence | Action |
|-----------|--------|
| Toutes les **5 minutes** (premier run à T+6 min) | `sync_greptile(db, api_key)` : appelle `list_repositories()` puis, pour les repos configurés GitHub absents de la liste, `get_repository(id)`. Pour les repos dont le statut en base est encore **submitted** / **processing** / **cloning**, on appelle aussi `get_repository(id)` pour récupérer un statut à jour. Résultat : upsert en base. |

### Refresh status (page Indexing)

| Déclencheur | Action |
|-------------|--------|
| Clic « Refresh status » ou timer 2,5 min (si des repos en error/processing) | `POST /api/v1/greptile/repos/refresh` : pour chaque repo cible, appelle `get_repository(api_key, repo_id)` puis met à jour la ligne en base. |

L’affichage (Processing, Indexed, Error) est dérivé du `status` stocké en base, lui-même issu de ces deux flux.

---

## 3. Combien de temps « Processing » peut durer ?

- **Côté Greptile** : l’indexation réelle peut prendre de quelques minutes à beaucoup plus selon la taille du repo. Veelocity n’a pas d’info en temps réel.
- **Côté Veelocity** : le libellé ne change que lorsqu’un **sync** ou un **Refresh status** refait un appel API et met à jour la base. Si le sync de fond récupère bien les statuts à jour (y compris pour les repos « in progress »), les lignes passeront de Processing à Indexed/Error sans action utilisateur.

---

## 4. Résumé

- Veelocity = **fetch, stockage, affichage** des données Greptile. **Aucun** trigger d’indexation.
- Indexation / ré-indexation = uniquement via l’app ou l’API Greptile en dehors de Veelocity.
- Les statuts en base sont mis à jour par le **sync de fond** (toutes les 5 min) et par le **Refresh status** (bouton ou auto sur la page Indexing).
