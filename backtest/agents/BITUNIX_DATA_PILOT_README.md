# Centre de données CryptoJuju — pilote Bitunix public

Premier lot sur la branche isolée `dev/ai-agents-phase1`, **sans Render payant**.
Le module `bitunix-data-pilot.mjs` se connecte à l'API REST publique officielle
`https://fapi.bitunix.com/api/v1/futures/market/kline` à travers l'adaptateur
`backtest/bitunix-adapter.mjs` existant. Aucun secret ou compte n'est nécessaire.

## Enveloppe de validation
- BTCUSDT, ETHUSDT et SOLUSDT sur 15m, 1h et 4h = **9 cas**.
- 96 chandelles **fermées** par cas, plus 3 chandelles d'ancrage historiques.
- La borne `endTime` est **exclusive**, alignée à l'UTC sur l'intervalle et jamais future.
- Les requêtes sont découpées en blocs au plus 150, sans mélanger d'autres exchanges.
- Le lot préserve la série REST originale, les SHA-256 des chandelles brutes,
  les prix normalisés, le motif et la preuve de chaque correction, les temps attendus,
  la continuité, les doublons, les anomalies et le rapport propre à chaque symbole/UT.
- Les OHLC ne sont ajustés **que** si la fermeture précédente confirme l'ouverture
  absente de l'enveloppe high/low ; sinon **BLOQUÉ**, pas de données approuvées.
- La fenêtre sans les trois chandelles d'ancrage est repassée dans le rôle Bitunix n°1.
- Aucun signal d'indicateur ni ordre de trading n'est créé dans ce pilote.

## Exécuter
- Tests sans réseau : `node --test backtest/agents/bitunix-data-pilot.test.mjs`
- Pilote en lecture seule : `node backtest/agents/run-bitunix-data-pilot.mjs rapport-bitunix`
- GitHub Actions : `.github/workflows/ai-agents-bitunix-data.yml`.
  Le travail démarre sur un push pertinent de cette branche ou `workflow_dispatch`;
  **pas** de cron GitHub autonome caché. Les fichiers bruts/normalisés expirent après 7 jours.

## Limites et prochaines validations
- Les deux chemins REST/proxy Bitunix viennent de la même bourse ; pas de comparaison
  indépendante exhaustive TradingView ou de confirmation de rentabilité.
- Le chargement REST en une fois ne démontre **pas** un flux continu,
  les reprises après déconnexion ou la latence de changement de chandelle.
- Avant d'activer les backtests autonomes, valider les implémentations des indicateurs
  et la confirmation non rétrospective de leurs signaux, puis augmenter les fenêtres
  à 480 fermées et prévoir un suivi sur plusieurs jours.
- Un statut `BLOCKED` ou une requête refusée sont des **résultats diagnostiques utiles**,
  pas une permission d'inventer une chandelle ou de changer d'exchange.

## Étape suivante (19 novembre) — historique 480 et tableau HTML
Le workflow interroge désormais **480 chandelles fermées** par configuration
(+3 chandelles historiques pour les corrections démontrées). Un rapport
`data-center.html` est archivé avec `summary.json` et les séries originales.
Il s'agit d'une **photographie** du contrôle REST, non d'une application
publique ou d'une surveillance 24/7. Toute configuration bloquée reste en rouge.

## Étape du 19 novembre — double lecture anti-dérive
Chaque fenêtre BTC/ETH/SOL × 15m/1h/4h est relue par REST sur ses **24 dernières
chandelles fermées** (plus 3 ancres), avec la même borne UTC fixe que la
première collecte de 480. Le module compare les valeurs OHLCV originales,
puis la série de recherche dérivée, chandelle par chandelle.

Si la seconde lecture manque, échoue, change le volume/prix, ne porte plus
sur la même période ou modifie une correction traçable : cette configuration
est **BLOQUÉE** dans le résumé du lot. Les écarts, hachages et les timestamps
sont disponibles dans `*-repeatability.json`. Ce contrôle est une répétition
immédiate, pas une preuve que la bourse ne modifiera jamais son historique,
ni une surveillance permanente.
