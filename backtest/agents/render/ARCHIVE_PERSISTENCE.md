# CryptoJuju — Archives permanentes des agents sur Render (pilotage DEV)

## Ce qui est sauvegardé automatiquement

Chaque cycle horaire possède une clé unique `(agent,slot UTC)` dans `cj_agent_runs` et un rapport JSON détaillé dans `evidence`. Les agents enregistrent en plus leurs **fichiers complets** dans PostgreSQL via deux tables :

- `cj_archive_objects` : contenu original compressé avec gzip, contrôlé par SHA256, dédupliqué par empreinte.
- `cj_archive_manifest` : index immuable `(agent, slot UTC, chemin relatif)` vers l'objet SHA256.

Le pilote Bitunix archive tous les fichiers sources OHLC et leurs contrôles de double lecture, les sources supplémentaires des fenêtres bloquées, les résumés JSON/Markdown et la vue HTML. Vector archive ses fichiers détaillés V1.1/V1.2, chronologie, scénarios et régimes. Momentum et SPEED archivent leurs résumés de validation par marché/UT. Cipher archive ses deux lectures OHLC, comparaisons et simulations détaillées, les sommaires JSON et Markdown. Diagnostics reste conservé comme `evidence` JSON dans `cj_agent_runs` et inclut la mesure réelle `pg_database_size`.

Les fichiers ne sont **pas** publiés dans un dépôt GitHub, pour éviter d'inonder l'historique et le quota GitHub avec les données horaires. Les historiques PostgreSQL et les empreintes sont persistants même si le système de fichiers éphémère Render disparaît.

Un cycle de calcul ne peut être marqué réussi tant que l'archivage et la relecture SQL de sa liste de fichiers n'ont pas réussi. En cas d'échec, statut `BLOCKED` avec raison `ARCHIVE_PERSISTENCE_FAILED`. Les agents qui dépendent de données Bitunix non validées sont bloqués. Aucun ordre de trading, publication `main` ou changement automatique de version d'indicateur.

## Vérifier les archives

Exemples de lecture SQL **privée** (n'exposer ni `DATABASE_URL` ni les octets archives au site public) :

```sql
SELECT agent, date_trunc('hour',slot) AS heure_utc, status,
       evidence->'archive'->>'status' AS archive_status,
       evidence->'archive'->>'files' AS nombre_fichiers
FROM cj_agent_runs
ORDER BY slot DESC, agent
LIMIT 60;

SELECT agent, slot, count(*) AS fichiers
FROM cj_archive_manifest
GROUP BY agent,slot
ORDER BY slot DESC
LIMIT 40;

SELECT pg_size_pretty(pg_database_size(current_database())) AS espace_total_utilise,
       count(*) AS objets_uniques, pg_size_pretty(sum(compressed_bytes)) AS volume_comprime
FROM cj_archive_objects;
```

Les lignes de la table `cj_agent_insights` contiennent des hypothèses enregistrées *seulement si l'API rememberFinding est effectivement appelée*. Ne pas confondre cette structure avec un agent LLM auto-apprenant : aucun LLM autonome n'a été activé.

## Restauration privée d'un cycle

Dans un environnement ayant accès au `DATABASE_URL` privé et à Node 22 avec le package `pg` :

```sh
node backtest/agents/render/restore-archive.mjs \
  vector 2026-11-23T02:00:00.000Z /dossier/de/restauration
```

La restauration vérifie le SHA256 de chaque fichier décompressé et refuse d'écraser des fichiers existants.

## Capacité et limites

Au 23 novembre 2026, le disque PostgreSQL fourni est de **1 Go** (`diskAutoscalingEnabled=false`). Le chiffre de 256 Mo associé au plan PostgreSQL est sa mémoire RAM, **pas son espace disque**.

Chaque diagnostic horaire mesure `pg_database_size` et émet `CJ_ARCHIVE_CAPACITY`. Un avertissement apparaît quand l'usage atteint 70 % du budget de disque connu. Le budget par défaut est 1 Gio (~1 Go); si le disque Render est agrandi, ajuster `CJ_ARCHIVE_DISK_BUDGET_BYTES` en conséquence.

**Les données ne sont jamais supprimées silencieusement pour économiser le disque.** Il faut agrandir le disque PostgreSQL et prévoir le coût **avant** la saturation. PostgreSQL est le stockage primaire de ce pilote; une sauvegarde hors base et une politique de récupération après désastre restent recommandées.

Cette fonctionnalité protège uniquement les **nouveaux cycles exécutés après son déploiement**. Les anciens fichiers locaux temporaires déjà disparus ne peuvent pas être reconstruits depuis les simples résumés. Les séries historiques de **deux ans** étudiées précédemment doivent être inventoriées, comparées à leurs SHA/versions de code et importées séparément depuis les sources encore disponibles. Elles ne sont pas réputées présentes dans PostgreSQL par défaut.

Chaque test utilise les versions de l'indicateur et les données disponibles lors de son exécution. La reproduction d'un autre algorithme, d'un autre paramètre, ou d'une autre période peut encore nécessiter un nouveau test. Ne pas assimiler des résultats exploratoires passés à une validation indépendante hors-échantillon.

## Sécurité et changements

Déployer uniquement depuis `dev/ai-agents-phase1` et `dev/render-ai-agents`; aucune modification `main`, aucun ordre réel. Les tables sont privées, jamais accessibles par l'API publique. Un échec de schéma empêche les agents de démarrer mais ne doit pas interrompre l'API Bitunix publique.
