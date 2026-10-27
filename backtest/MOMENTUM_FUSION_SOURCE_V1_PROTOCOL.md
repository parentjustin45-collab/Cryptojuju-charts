# CryptoJuju — Momentum Fusion V1.0, base originale de l'utilisateur

**26 octobre 2026 — R&D séparée sur `dev/v1.26.0`.**
Le Pine Script v6 « Momentum Fusion » a été fourni directement par l'utilisateur. Cette étape implémente et audite **la base fournie**, sans optimiser de paramètres, sans modifier WATCH/Vector V1.1/V1.4, sans altérer `main` ni Render.

## Composition à conserver

- RSI(14) avec lissage Wilder/RMA; Stoch RSI(14) puis SMA(3); Momentum(close - close[10]) puis `ta.percentrank(...,100)`.
- Poids **1:1:1**; total `max(somme,0.001)`; composite lissé avec **EMA(3)**.
- Zone OB 70 / OS 30; extrêmes 90 / 10.
- Filtre directionnel **EMA(close,21)>EMA(close,55)** pour LONG et inverse pour SHORT, activé.
- LONG lorsque le composite traverse **30 vers le haut**, seulement si le filtre EMA est haussier; SHORT lorsqu'il traverse **70 vers le bas**, seulement si le filtre EMA est baissier.
- Détection des divergences **régulières et cachées, haussières et baissières**, sur pivots oscillateur **5 à gauche / 5 à droite**, deux pivots au plus **60 chandelles** à part. Comparer les **prix LOW/HIGH sur les barres du pivot oscillateur** (ce ne sont pas des pivots du prix).
- Les événements de divergence appartiennent à la **barre de confirmation**, **cinq bougies après** la barre du pivot. L'étiquette Pine est dessinée rétrospectivement sur le pivot, mais il est impossible d'agir dessus cinq bougies plus tôt. Toutes les comparaisons respectent ce délai.
- Couleurs, emplacements de dashboard et visibilité de labels ne changent pas les règles de calcul/alertes.

## Audit de base Bitunix, sans stratégie

Sur Bitunix public LAST_PRICE, BTCUSDT/ETHUSDT/SOLUSDT **15M, 30M, 1H, 4H** (12 combinaisons), **672 bougies clôturées par marché** au contrôle. Quarantaine stricte des OHLC impossibles, trous et doublons : **minimum 135 bougies continues** avant de calculer la séquence (les 110 premières sont nécessaires au rang de momentum). Aucune autre bourse en secours.

Exporter le nombre de signaux haussiers/baissiers et les quatre types de divergence, le nombre de croisements filtrés par l'EMA, le nombre de Momentum LONG contre Vector SHORT et vice versa, ainsi que l'éventuelle apparition ultérieure du même signal Vector dans les **12 bougies suivantes**. Ce dernier rapprochement est **rétrospectif**; il ne fournit aucun taux de succès prédictif ni résultat de trading.

## Étape de parité encore requise

Le port JS reprend les algorithmes usuels Pine mais **la parité chiffrée avec TradingView n'est pas encore démontrée**. À vérifier sur mêmes symboles/horodatages/sources avec valeurs exportées de l'oscillateur (en particulier le traitement exact de `na` dans Stoch RSI/SMA, les égalités de pivots, le traitement RSI d'un prix complètement plat, et les règles `ta.percentrank` en cas d'égalités). Les flux TradingView ne sont pas automatiquement équivalents aux bougies Bitunix.

**Ne pas déclarer Momentum « meilleur » sur la seule fréquence des signaux.** Évaluer ultérieurement les divergences sans anticipation, les occasions manquées, faux retournements et coût du filtrage sur une période prospective future distincte. La comparaison Vector prospective déjà verrouillée au 28 octobre reste **strictement inchangée**.

## Fichiers

- `backtest/momentum-fusion-v1.mjs` — calcul fermé sur OHLC, aucune clé ni aucun ordre.
- `backtest/momentum-fusion-v1.test.mjs` — tests déterministes des paramètres et de la causalité.
- `backtest/momentum-fusion-bitunix-audit.mjs` — extraction publique, quarantaine, comptages de base.
- `backtest/momentum-fusion-bitunix-audit.test.mjs` — injections isolées, qualité des données et délai de confirmation.
- `.github/workflows/momentum-fusion-original.yml` — exécution uniquement sur la branche de développement, aucun déploiement.
