# CryptoJuju Vector V1.2 — amélioration native, sans référence TradingView obligatoire

## Intention
CryptoJuju devient le laboratoire principal des indicateurs. Bitunix reste la
**source unique des chandelles de recherche**. L'objectif n'est pas de copier
TradingView, mais de tester si les modifications améliorent réellement les
résultats. Aucun test TradingView n'est requis dans ce protocole expérimental.

## Plan de recherche
Le module `vector-v12-real-comparison.mjs` évalue les **mêmes 480 chandelles
fermées et déjà vérifiées** sur BTC/ETH/SOL en 15m/1h/4h :
- `baseline_v11` : Vector V1.1 original, inchangé ;
- `follow_close_1` : attend une prochaine clôture confirmant la direction ;
- `break_extreme_2` : attend jusqu'à deux clôtures pour confirmer une cassure.

On utilise le même `priceStep` explicite provenant des métadonnées Bitunix,
le même capital simulé, les mêmes frais et le même slippage. Les ordres
simulés sont exécutés uniquement à l'**ouverture suivante** à la confirmation.
Les signaux en fin de fenêtre sans barre suivante ne sont pas exécutés.

Le moteur calcule des résultats d'entraînement et de holdout distincts,
compare précisément le résultat de base V1.1 à sa campagne de référence et
échantillonne des calculs sur préfixes afin de détecter un lookahead.
Tout changement de prix brut ou de provenance non validé bloque le lot.

## Conditions de qualité, pas de promotion automatique
Ces comparaisons **n'élisent aucun gagnant** : chaque variante est
`CANDIDATES_EVALUATED_RESEARCH_ONLY` et reste expérimentale.
Il faut notamment examiner le nombre de signaux, le nombre de transactions,
la rentabilité nette simulée, le drawdown, les faux retournements et les
retards d'entrée. Une amélioration sur 480 barres inspectées n'est pas une
preuve hors échantillon indépendant. Avant d'envisager une version suivante
sur le site, ajouter des fenêtres prospectives plus longues et diverses
situations de marché (tendance, range, volatilité, perte), puis exiger
une revue humaine.

Le pipeline est déterministe, **non six IA autonomes**, sans trading,
déploiement ou paiement Render.
