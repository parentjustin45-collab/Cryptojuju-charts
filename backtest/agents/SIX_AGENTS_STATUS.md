# Les six agents CryptoJuju — statut de développement

Les **six responsabilités** sont représentées dans `six-agent-workshop.mjs` et testées dans GitHub Actions.
Il ne s'agit **pas** encore de six agents de langage indépendants ni d'une exécution nocturne permanente.

| Rôle | Phase actuelle | Autonomie actuelle |
|---|---|---|
| 1 — Données Bitunix | Contrôle qualité déterministe des chandelles fournies | Exécutable par CLI/CI, sans correction inventée |
| 2 — Backtests | Recyclage du moteur et comparaison chronologique | Exécutable par CLI/CI pour signaux déjà calculés |
| 3 — Diagnostics | Détection de blocage et de métriques suspectes | Heuristiques explicites, pas de diagnostic IA génératif |
| 4 — Corrections | Propositions de vérifications et pistes de correctifs | **Aucune écriture automatique** |
| 5 — Validation | Contrôles de non-régression du pipeline | Tests GitHub Actions à chaque push dev |
| 6 — Coordination | Rapport structuré et Markdown | Exécutable, sans notifications planifiées depuis GitHub |

## Conditions avant autonomie nocturne réelle
- Source d'historique Bitunix vérifiée et chargement continu des données sans trous.
- Connecteurs de signaux Vector / SPEED / Momentum / Frank (et futur Cipher) contrôlés contre les versions Pine,
  et horodatés au moment **réel de confirmation** ; aucune divergence rétroactive.
- Séparation des échantillons de mise au point et de validation ; journal des tests négatifs et frais.
- Choix d'un **ordonnanceur réellement actif** : les workflows GitHub Actions `schedule` ne s'exécutent
  que depuis la **branche par défaut**. Créer un fichier cron sur cette branche dev **n'activerait rien**.
  Exécution par tâche ChatGPT planifiée ou service Render de développement sans autoriser une modification de `main`.
- Budget : objectif jusqu'à 80 $ CA/mois, aucune augmentation ou abonnement payé sans choix explicite.
- Fenêtre envisagée 22 h–8 h America/Toronto, commencer petit.
- Aucun agent ne peut modifier `main`, publier en production ou placer des trades sans accord humain.
- Les changements de code proposés devront passer dans une branche isolée, tests avant revue humaine.

## Statut actuel
Un orchestrateur **hors ligne** à six rôles fonctionne sur des séries/stratégies fournies,
mais n'analyse pas encore les marchés réels en boucle autonome.
La réussite CI n'est pas une preuve de rentabilité ou de fidélité TradingView.
