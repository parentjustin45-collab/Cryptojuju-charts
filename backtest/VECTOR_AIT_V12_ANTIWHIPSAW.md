# Vector Always-In-Trade V1.2 — expériences anti-retournements

**Branche :** `dev/v1.26.0` uniquement. Aucun changement à `main`, au Pine Script V1.1 original ou à l'interface de production.

## Pourquoi cette expérience?

Le balayage précédent a montré que passer à 3 confirmations augmente les inversions rapprochées, tandis que 5 confirmations les réduit au prix de nombreux signaux manqués. Aucun seuil n'a démontré une amélioration robuste des rendements. On conserve **4 confirmations** dans les trois variantes et on essaie une confirmation après le signal Vector.

## Trois variantes (aucune ne repeint le passé)

- **baseline_v11 :** signal LONG/SHORT dès la fermeture de la chandelle Vector V1.1, entrée possible à l'ouverture suivante.
- **follow_close_1 :** mémoriser la clôture d'une chandelle Vector opposée à la direction confirmée. Le signal devient valide **seulement si la chandelle suivante clôture plus haut** (LONG) ou plus bas (SHORT) que cette clôture. Sinon, la tentative expire.
- **break_extreme_2 :** mémoriser le plus haut/plus bas de la chandelle Vector. Le signal devient valide si l'une des **deux chandelles suivantes clôture au-dessus du plus haut** (LONG) ou **en dessous du plus bas** (SHORT). Une simple mèche ne suffit pas.

Si une chandelle Vector de sens opposé apparaît avant la validation du signal en attente, l'ancienne tentative est annulée. Le marché reste dans la dernière direction **confirmée** jusqu'à ce qu'un nouveau signal soit validé. Toutes les décisions reposent uniquement sur des bougies clôturées et sont exécutées à l'ouverture suivante.

## Comparabilité

- BTC/ETH/SOL, 15m/30m/1h/4h, recherche jusqu'à 365 jours de chandelles brutes Bitunix.
- Même entrée **au prochain open** après signal; mêmes frais (0,06 % par côté), même sortie **SL 1,5 % / TP 3 % / 12 barres maximum**. Stop exécuté d'abord en cas d'ambiguïté intrabar.
- Simulation de glissement **0,05 % par côté** pour le contrôle de robustesse.
- Fenêtres discontinues ou contenant des données manquantes exclues; aucune position transportée par-dessus un trou. Positions coupées par une limite de fenêtre ou d'échantillon **censurées**, non comptabilisées comme trades clôturés.
- Délimitation chronologique commune; sélection parmi les trois modes **uniquement en entraînement**; test non utilisé pour choisir.
- LONG et SHORT séparés. Au moins 30 trades clôturés pour sélectionner en entraînement et 30 en validation pour interpréter une piste.
- Comptabilisation des tentatives Vector non confirmées, du délai supplémentaire, du nombre de trades et des inversions opposées sous trois chandelles.

## Décision

Une variante retardée ne pourra être considérée intéressante que si elle bat la V1.1 sur les données de validation avec au moins 30 trades, qu'elle reste **positive après glissement** et qu'elle ne repose pas sur trop de trades censurés. Le taux d'inversions rapprochées est **descriptif**, ce n'est ni une preuve d'erreur ni un critère suffisant. Des confirmations sur des périodes futures, la fidélité au Pine Script TradingView, des tests contre le surajustement et une évaluation de la qualité des données restent nécessaires.

**Aucune promotion automatique de V1.2.** Ce module est strictement de la recherche.
