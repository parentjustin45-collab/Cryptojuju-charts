# CryptoJuju Render — atelier six spécialistes (prototype de développement)

Branche **dev/ai-agents-phase1 seulement**. Ce dossier n'est **PAS** encore déployé.
Le service payé cryptojuju-api utilise le dépôt **cryptojuju-api**, branche **main**,
qui ne contient PAS ce moteur. Ne pas remplacer son startCommand avant d'avoir
préparé un déploiement compatible avec son proxy Bitunix public.

## Déroulement prévu (UTC, toutes les heures)
- :04 Données Bitunix — 9 fenêtres BTC/ETH/SOL × 15m/1h/4h, 480 chandelles fermées, deux lectures et SHA-256.
- :14 Vector — original V1.1 et V1.2 expérimental; ne démarre pas si le contrôle Bitunix courant échoue.
- :24 Momentum — exécute l'audit de l'indicateur existant, sans le modifier.
- :34 SPEED — audit original V3 sur 30 jours, sans comparer les chiffres de protocoles différents.
- :44 CJ Cipher — WaveTrend original; étude comparative expérimentale existante.
- :54 Diagnostics — détecte rapports manquants/bloqués et propose les vérifications à effectuer.

Chaque spécialiste est un rôle logique distinct. Un seul sous-processus lourd à la fois.
Cela évite six processus concurrents sur 0,5 CPU / 512 Mo. Les exécutions et les
extraits de journaux sont enregistrés dans PostgreSQL (table cj_agent_runs),
avec un identifiant unique (agent, heure UTC) pour éviter les doublons.
Un redémarrage laisse les traitements interrompus visibles comme RUNNING;
la prochaine heure réessaie, aucun succès n'est inventé.

IMPORTANT : Les modules actuels sont **déterministes** et NE SONT PAS des
agents LLM autonomes. Pas d'apprentissage automatique, d'édition de code,
de choix de version gagnante, de trading, ni de comparaison TradingView.
Pour devenir un atelier IA complet, il faudra brancher un modèle,
définir un budget/token ceiling et un protocole de promotion humaine avec
historique d'hypothèses, tests hors échantillon et revue de PR.

## Pré-requis Render et garde-fous
- Service Node >=22 branché sur **cette branche de développement**, au lieu de main;
  il faut conserver l'API/proxy existant (ne PAS substituer directement ce runner).
- Commande build : npm install --prefix backtest/agents/render --no-audit --no-fund
- Commande start expérimentale : node backtest/agents/render/supervisor.mjs
- Variables : DATABASE_URL (URL PostgreSQL **interne**, secrète), CJ_AGENT_RUNTIME_ENABLED=1.
- Runtime expose GET /healthz sur PORT. Ne pas exposer DATABASE_URL ni clés API dans GitHub.
- TABLE creation requires the internal database role to have CREATE TABLE privileges;
  no external DB access or IP allowlisting should be needed from Render Ohio.
- Le mode actif nécessite une validation de l'intégration avec le proxy d'API et
  un contrôle de l'empreinte du code source avant de changer la configuration Render.
- Budget et fiabilité : pas de nouveau serveur payant ou de service IA générative sans
  accord; pas de promesse de 24/7 tant que les journaux et les redémarrages réels ne
  sont pas validés.

## Tests isolés
node --test backtest/agents/render-plan.test.mjs backtest/agents/render-runtime.test.mjs

Les tests sont entièrement synthétiques (fausse base), n'affirment rien sur le
marché réel. La branche main, le site public et les services Render actifs
n'ont pas été modifiés.

## Intégration de l'API existante : état contrôlé le 22 novembre 2026

- Fichier de test d'intégration : `integrated-api.mjs`.
  Il conserve `GET /` et `GET /api/bitunix/proxy` version API 1.1.0,
  ajoute `GET /healthz` et `GET /api/agents/status`.
- Par défaut, le serveur continue de répondre même si les agents ne peuvent pas
  démarrer : `CJ_AGENT_RUNTIME_ENABLED` absent/0 = DISABLED;
  `DATABASE_URL` absent = BLOCKED, **aucun faux statut RUNNING**.
- Smoke HTTP réel mais source Bitunix simulée dans
  `integration-smoke.mjs`; GitHub Actions
  `.github/workflows/ai-agents-render-api.yml` installe Express/CORS/pg
  et valide routes, refus de proxy arbitraire, mémoire et journal.
- Mémoire `knowledge.mjs` : hypothèses/contre-preuves liées à source SHA-256,
  commit et disponibilité de l'information; table `cj_agent_insights`
  créée uniquement lorsque Render initialise réellement PostgreSQL.
  **Aucun moteur LLM activé. Aucun résultat réel ajouté pour l'instant.**
- Préparation de compilation (quand l'application API pointe sur ce code) :
  `npm install --prefix backtest/agents/render --no-audit --no-fund`.
- Commande de démarrage de la version intégrée :
  `node backtest/agents/render/integrated-api.mjs`.

### Blocage d'accès GitHub — action du propriétaire

L'installation GitHub de l'application sélectionne actuellement
`Cryptojuju-charts` mais pas `cryptojuju-api`.
Pour créer une branche `dev/render-ai-agents` dans le deuxième dépôt,
ajouter **seulement** `parentjustin45-collab/cryptojuju-api` aux
dépôts autorisés sur
https://github.com/settings/installations/174822231 .
Ne jamais donner de token dans une conversation. Le dépôt API `main`
n'a pas été modifié, sa configuration Render pointe toujours dessus.

### Blocage d'accès Postgres — action dans Render (après branche/API)

Base existante `cryptojuju-tv-momentum-pilot-db`, région Ohio,
1 Go; politique réseau externe fermée. Utiliser une **URL interne**
dans Render > service API > Environment : clé secrète `DATABASE_URL`.
Éviter d'ouvrir la base à Internet ou d'envoyer l'URL au chat.
Le contrôle d'accès DB, la création des tables et le fonctionnement
réel doivent être vérifiés avec des logs après un déploiement de
développement. La base connectée n'est pas encore confirmée.

**Ne pas déployer aveuglément l'entrée intégrée dans le service
`cryptojuju-api` : il faut d'abord une branche de développement
accessible, une stratégie de synchronisation du code Charts et un
test de bout en bout sans perte du proxy client.** Aucune dépense
supplémentaire ni changement `main` ne sont autorisés par ce guide.
