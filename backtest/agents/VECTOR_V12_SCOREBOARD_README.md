# CryptoJuju — grille de comparaison native (Vector V1.1 / V1.2)

Le tableau `vector-v12-scoreboard.md` et la version JSON sont
générés **à partir de la seule campagne CryptoJuju avec Bitunix**.
Aucune comparaison ni parité TradingView n'est une étape obligatoire.

Chaque marché (BTC/ETH/SOL × 15m/1h/4h) présente, séparément pour
la baseline V1.1 et les 2 variantes V1.2 :
- transactions simulées en entraînement et en holdout chronologique,
- rendement simulé net de frais, drawdown simulé et différences en points
  de pourcentage relativement à V1.1 sur le même historique,
- statut `INSUFFICIENT_HOLDOUT_TRADES` en dessous de 20 transactions
  pour une variante ou la baseline,
- **aucune promotion automatique**, même si les rendements semblent meilleurs.

Le holdout de cette fenêtre de 480 chandelles a déjà été consulté.
Il ne constitue pas un nouvel échantillon prospectif indépendant.
Le rapport est une photographie descriptive et ne constitue pas un
classement définitif, un conseil d'investissement, ni une preuve de
performance future. Les lots bloqués restent affichés `BLOQUÉ`.
Pas de trading, d'optimisation automatique ni de déploiement.
