# CryptoJuju — Vector V1.1 sur historique public Bitunix

La première expérimentation de signaux réels part uniquement des historiques
`DATA_READY_FOR_RESEARCH_ONLY` de BTC/ETH/SOL en 15m/1h/4h, avec
`STABLE_TWO_READS` sur les 24 dernières chandelles fermées. Le code
`backtest/vector-ait-v1.mjs` respecte la convention des signaux confirmés
à la **clôture** et testés à l'**ouverture suivante**, sans ordres réels.

## Paramétrage de prix et limite TradingView
Le pas de prix de calcul est explicitement dérivé du champ `quotePrecision`
retourné par l'API publique officielle
`GET /api/v1/futures/market/trading_pairs`, conservé par symbole.
**Ce champ ne certifie pas `syminfo.mintick` de TradingView**.
Les tests Pine traduits existent dans `backtest/vector-pine-v11-parity.test.mjs`,
mais n'exécutent pas un graphique TradingView indépendant.

## Étapes réalisées par le script de recherche
1. Lecture du contrat Bitunix (lecture seule), aucun token.
2. Validation du lot Bitunix et de sa deuxième lecture, sans réinventer OHLC.
3. Calcul Vector V1.1 et vérification d'une série de préfixes : le résultat
   d'une chandelle fermée ne doit pas changer si les chandelles futures sont absentes.
4. Sortie horodatée des signaux longs/shorts `confirmedAtCloseMs` et
   `actionAllowedAtNextOpenMs`. Les signaux de la dernière chandelle
   sont conservés dans l'historique, mais non exécutés sans ouverture suivante.
5. Simulation historique préliminaire avec frais et slippage explicites,
   périodes d'entraînement/validation séparées à 70/30. Ce découpage
   **ne prouve pas** un vrai échantillon jamais consulté, ni la rentabilité.

Rapports : `*-vector-v11.json`, `vector-v11-summary.json` et
`vector-v11-contract-precision.json`, dans l'artefact GitHub de données.
**Pas de trading automatique. Aucun déploiement sur main.**
