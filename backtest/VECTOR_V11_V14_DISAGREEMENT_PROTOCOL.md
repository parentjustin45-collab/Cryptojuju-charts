# Vector V1.1 vs V1.4 — audit des directions divergentes

**Autorisation « Go » : comparaison uniquement sur branche `dev/v1.26.0`. Pas de changement aux flèches V1.1, au module V1.4/WATCH, à l'API Render, au site public ni à `main`. Pas d'ordre Bitunix.**

## Question métier

Des captures sur téléphone montrent une flèche récente LONG de V1.1 sur SOLUSDT 1H, alors que la pastille WATCH V1.4 indique « SHORT maintenu ». Elles montrent aussi BTCUSDT LONG V1.4 en 1H et SHORT V1.4 en 4H.

Ces états ne sont **pas nécessairement des bugs** :
- Le vrai graphique dans `index.html` utilise `vectorAIT(data,tf)` V1.1 pour les flèches.
- La pastille de recherche calcule `applyVectorWatch` qui enveloppe la direction **V1.4**, sur le **dernier segment continu de bougies clôturées**.
- La V1.4 peut ignorer un LONG V1.1 si la cassure de structure ou une impulsion suffisante n'est pas confirmée; 1H et 4H sont aussi des historiques différents.
- La direction est **l'état maintenu depuis le dernier signal accepté**, pas une recommandation d'achat/vente actuelle.
- Si la pastille WATCH et les flèches reçoivent des historiques avec une fenêtre de chauffe ou des trous différents, leurs derniers états peuvent aussi diverger **à cause des conditions d'initialisation**.

## Protocole de comparaison

- Marchés **BTCUSDT, ETHUSDT, SOLUSDT 1H et BTCUSDT 4H**; chandelles publiques Bitunix `LAST_PRICE`, via proxy CryptoJuju **en lecture seule**.
- Fenêtre de **90 jours**, seulement bougies clôturées. Segmenter les OHLC à chaque trou, doublon et incohérence : n'inventer aucun prix, **55 bougies consécutives et valides** minimum, chauffage de 55 bougies.
- Sur **exactement les mêmes chandelles** et le même segment, calculer les directions V1.1 et V1.4, étiqueter accord / opposition / non établie, l'heure du dernier signal de chaque version, le pourcentage de bougies en opposition.
- Journal d'**épisodes d'opposition** : durée en chandelles et heures, quel moteur rejoint ensuite l'autre, et éventuel épisode censuré par un trou ou la fin des données.
- Retour **rétrospectif brut** à 3, 6, 12 chandelles depuis l'**ouverture suivante**, pour les deux directions à l'origine d'un désaccord. **Jamais** un input de signal, **jamais** un rendement de trading réel : pas de stop, commission, glissement ou position effectivement ouverte.
- Horizon futur tronqué/censuré en fin de fenêtre ou à la séparation chronologique en deux moitiés; ne jamais inventer une victoire dans les données manquantes.
- En plus des épisodes historiques, extraire un **instantané de la dernière bougie clôturée** et vérifier qu'il correspond au calcul `readVectorWatchState` sur cette même séquence. Si les 55 dernières bougies continuent sur une fenêtre insuffisante, **bloquer l'instantané** sans prétendre connaître le sens de position.
- L'analyse historique 90 jours **n'est pas un holdout neuf** et a déjà été utilisée par les explorations V1.1–V1.5. Aucun paramètre de Vector ne sera optimisé ni promu à partir des résultats.

## Sorties attendues

Workflow `.github/workflows/vector-direction-disagreement.yml` sur **dev uniquement**. JSON complet et CSV de comparaison. Un éventuel désaccord SOL n'est **confirmé au même timestamp** que si les deux moteurs le constatent sur les **mêmes OHLC** et la même heure de clôture. Les captures de l'utilisateur n'ont pas de crosshair de chandelle et ne suffisent pas à elles seules à identifier l'étiquette V1.1 exacte.

La seule façon de juger utilement un filtre est d'étudier ensuite le **risque, les gains manqués, le coût des flips et une période future réellement inédite**, avant d'envisager une nouvelle V1.6.
