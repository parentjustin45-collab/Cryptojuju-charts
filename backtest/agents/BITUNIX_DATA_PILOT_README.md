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
