# Vector — faisabilité 15M / 30M (recherche séparée)

**Branche** : `dev/v1.26.0`, lecture seule. Ne modifie **ni** les signaux V1.1/V1.2 ni le protocole prospectif BTC 1H SHORT commençant le 26 octobre 2026 à 00:00 UTC. Aucun ordre réel, aucune modification de `main`.

## Pourquoi ce test?
La comparaison 1D → 4H → 1H a révélé une piste 4H bearish pour le SHORT BTC 1H, encore limitée en taille d'échantillon. Avant de descendre dans le 30M et le 15M, il faut savoir combien de signaux chaque période produit et si ces signaux sont en accord avec les **dernières périodes supérieures complètement clôturées**.

## Étude figée

- Symbole : **BTCUSDT**.
- Données Bitunix : **45 jours historiques** de 15M, 30M, 1H, 4H et 1D.
- Signaux 15M, 30M et 1H, chacun selon **Vector V1.1** et **V1.2 `break_extreme_2`**. Pas de réglage de paramètre ni d'optimisation.
- Métriques : signaux LONG/SHORT, nombre de bougies exploitables, densité par 1000 bougies, fréquence des paires de signaux opposés et paires rapprochées **à trois heures ou moins**.
- Contexte **1H, 4H, 1D** de la **dernière bougie terminée** à l'entrée au prochain open (1H ignoré comme contexte de lui-même) : même direction, direction opposée, neutre, inconnu.
- Les données manquantes/dupliquées/invalides sont mises en quarantaine. Aucun calcul ne franchit une rupture de bougies. Aucune bougie en cours n'est consommée. Une direction non disponible reste inconnue.
- Comparaison de fréquence et de cohérence seulement. Les durées entre signaux, les statistiques brutes et les populations de bougies diffèrent entre 15M, 30M et 1H.

## Ce que les chiffres NE signifient PAS

**Un signal n'est pas une transaction et un retournement rapide n'est pas nécessairement un mauvais signal.** Pas de rendement par trade, pas de taux de réussite, pas de conclusion sur la précision ou la rentabilité dans cette première étape. Ces 45 jours historiques ne constituent pas un échantillon prospectif inédit.

Si le diagnostic est exploitable, la prochaine étude devra fixer un point d'entrée, un horizon de sortie commun en **heures**, le stop et la cible, les frais de 0,06 % par côté, des glissements réalistes plus élevés sur les petites périodes, et comparer avec le benchmark 1H original sur des données ultérieures distinctes.

## Exécution et rapports

Workflow : `.github/workflows/vector-lower-tf-feasibility.yml`. Tests automatisés : `backtest/vector-lower-tf-diagnostic.test.mjs`. Résultat : artefact `vector-lower-tf-btc-45day`. Il s'exécute sur les modifications de cette étude dans `dev/v1.26.0`, **pas** tous les jours. Aucun cron créé sur `main`.
