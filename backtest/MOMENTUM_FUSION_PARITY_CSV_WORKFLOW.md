# Momentum Fusion V1 — Comparer TradingView avec CryptoJuju sur les mêmes OHLC

**Statut au 27 octobre 2026 : `NOT_YET_VALIDATED` contre une vraie référence TradingView.** Les tests automatiques ont uniquement établi le comportement du comparateur sur des séries **synthétiques**, avec anomalies injectées. Ils ne prouvent aucune parité numérique réelle.

Le comparateur de recherche `backtest/momentum-fusion-compare-tv-csv.mjs` exécute le **Momentum Fusion V1 original** du projet sur les chandelles OHLC contenues dans le **CSV TradingView**. Il lit les valeurs tracées par notre indicateur de contrôle et signale précisément les divergences. Il n'utilise pas un historique Bitunix indépendant qui pourrait contenir d'autres clôtures.

## Fournir une référence TradingView authentique

1. Sur TradingView (si l'option est disponible dans ton compte), créer un **nouvel indicateur Pine** depuis le script `backtest/momentum-fusion-tv-parity-probe.pine`. Ne pas remplacer l'indicateur original ni les versions Vector.
2. Ouvrir une paire, une place de cotation et un timeframe connus (ex. BTCUSDT en 1H); noter **le ticker TradingView exact avec le fournisseur**. Si Bitunix n'est pas proposé par TradingView, une autre paire peut convenir pour **la parité mathématique à OHLC identiques**, mais **pas pour confirmer l'identité des prix Bitunix**.
3. Faire défiler l'historique vers la gauche pour charger **au moins 250–350 chandelles**, idéalement davantage. Sélectionner l'option **Exporter / Télécharger les données du graphique** depuis les commandes du graphique et choisir des timestamps **UTC explicites / ISO 8601** lorsque proposé.
4. Le CSV doit inclure `time,open,high,low,close` et les 11 colonnes propres au diagnostic : `Composite original`, `CHECK RSI14`, `CHECK StochRSI14 SMA3`, `CHECK Momentum10`, `CHECK PercentRank100`, `CHECK EMA21`, `CHECK EMA55`, `CHECK BullSignal 1/0`, `CHECK BearSignal 1/0`, `CHECK PivotLow confirmed NOW`, `CHECK PivotHigh confirmed NOW`.
5. Fournir ce **CSV exporté** (ou l'attacher dans la conversation ChatGPT) avec le ticker/timeframe exact et nous pourrons exécuter :
   `node backtest/momentum-fusion-compare-tv-csv.mjs export_tradingview.csv`
6. Le rapport JSON affiche `MATCHED_CSV_WITHIN_TOLERANCE`, `MISMATCH` ou `INCONCLUSIVE_INCOMPLETE_REFERENCE`; chaque champ contient le nombre de comparaisons et jusqu'à cinq exemples datés d'erreur.

La documentation TradingView confirme que **l'export de graphiques CSV peut inclure les tracés des indicateurs**, y compris ceux configurés `display=display.data_window`. L'export doit être accessible via une interface supportée et l'accès dépend du compte de TradingView :
https://www.tradingview.com/pine-script-docs/faq/indicators/
https://fr.tradingview.com/support/solutions/43000537255/

## Garde-fous

- CSV > 10 Mo ou mal formé, fuseau horaire implicite, OHLC impossibles, dates répétées/décroissantes, colonnes ambiguës : comparaison **refusée**.
- Au moins **200 barres**, puis exclusion des **150 premières barres** de la comparaison afin de réduire les faux écarts d'initialisation des EMA/RMA. Cette purge ne remplace pas un chargement préalable suffisant dans TradingView.
- Critère numérique de précontrôle : erreur absolue <= 0,0002 plus tolérance relative de 1e-6; états des signaux et pivots vérifiés **exactement** à la bougie de confirmation, sans antidater.
- Les valeurs absentes qui devraient être disponibles sont signalées comme anomalies, **jamais traitées comme des correspondances**.
- Parité du calcul ≠ validité prédictive des signaux ni parité de l'API Bitunix. Les signaux de divergences plus complexes (réguliers/cachés) nécessiteront le contrôle du Pine original après les pivots.
- Le résultat n'est **pas une stratégie, ni un ordre** et n'entraîne aucune modification de `main`, du site Render, de WATCH ou du protocole prospectif Vector.
- Aucun utilisateur n'a à communiquer identifiants TradingView, clés API ou renseignements financiers pour cette étape.

## Réalisé dans cette étape

- Exposition des booleens `pivotLowConfirmed`/`pivotHighConfirmed` dans le port JavaScript, sans modifier les règles de calcul du composite ni les signaux de trading.
- Création d'un comparateur CSV autonome et ses tests reproduisant succès, écart artificiel de composite, signal déplacé, horodatage incohérent, référence manquante et colonnes citées avec virgule.
- Workflow GitHub Actions de **pré-vérification** sur `dev/v1.26.0`, avec statut de parité à TradingView explicitement **non encore établie**.

**Prochaine dépendance :** un CSV issu de l'exécution réelle de Pine sur TradingView, pas de valeurs synthétiques.
