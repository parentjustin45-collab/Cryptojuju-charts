# Vector AIT — 960 chandelles, premier historique élargi

- Un **seul** pilote : `BTCUSDT / 15m`, 960 barres **fermées** + 3 ancres.
- Relecture intégrale de la même fenêtre avec 2 captures REST indépendantes.
- L'ancien pilote BTC/ETH/SOL (3 UT × 480 barres) reste inchangé.
- L'API est interrogée par pages au maximum de 150 barres, via l'adaptateur
  Bitunix officiel existant ; aucun autre exchange.
- On conserve toutes les données et preuves des anomalies, avec rejet en cas
  de différence OHLCV, manque, doublon ou correction non confirmée.
- On compare ensuite V1.1 originale, V1.2 `follow_close_1` et
  `break_extreme_2` sur les mêmes 960 chandelles.
- Diagnostics natifs : délais de confirmation, retournements opposés ≤3
  bougies (proxy de whipsaw, **pas** preuve d'erreur), simulation 70/30
  avec mêmes frais/slippage et statut des échantillons.
- **Pas de promotion automatique**. Le nouvel historique contient des
  périodes déjà regardées; il ne constitue pas un holdout prospectif neuf.

Fichiers : `vector-depth-BTC15m-*.json`, `vector-depth-BTC15m-report.md`,
dans l'artefact temporaire GitHub Actions existant. Source Bitunix, laboratoire
CryptoJuju uniquement, aucun test TradingView, transaction, Render payant,
déploiement public ou tâche récurrente supplémentaire.

## Réduction des contrôles redondants
Le workflow principal collecte désormais **960 chandelles fermées sur les
neuf combinaisons** Bitunix BTC/ETH/SOL × 15m/1h/4h et fait la double
lecture complète. Le pilote de profondeur BTC15m reste un outil manuel
(`node backtest/agents/run-vector-depth-pilot.mjs rapport-bitunix`),
mais n'est **plus relancé dans le même workflow** : cela aurait dupliqué
les appels REST BTC15m sans nouvelle donnée utile. Les diagnostics et
tests Vector restent actifs dans la campagne commune; aucune promotion
de variante ni transaction n'est autorisée.
