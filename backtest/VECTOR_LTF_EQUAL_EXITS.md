# Vector V1.1/V1.2 — 15M, 30M, 1H, sorties comparables

**Recherche exploratoire uniquement sur `dev/v1.26.0`. Aucun ordre réel et aucune modification de `main`, de l'interface de production ou de la recherche prospective BTC 1H SHORT débutant le 26 octobre 2026 à 00:00 UTC.**

## Hypothèses fixées avant l'exécution

- BTCUSDT, Bitunix : 90 jours historiques, chandelles *clôturées*; 15M, 30M, 1H et contexte 4H.
- Entrée au prochain *open* après signal SHORT Vector V1.1 (référence) ou V1.2 `break_extreme_2`.
- Même stop de **1,5 %**, même take profit **3 %**, et **durée maximale de 12 heures** : **48 bougies 15M, 24 bougies 30M, 12 bougies 1H**. Ce n'est pas le même nombre de chandelles, mais bien le même temps de détention maximal.
- Frais Bitunix simulés à **0,06 % par côté**. Scénarios : glissement 0, glissement commun **0,05 % par côté**, puis glissement conservateur **15M = 0,10 %**, **30M = 0,075 %**, **1H = 0,05 %**, par côté. Ce sont des hypothèses de sensibilité, pas des mesures de glissement réel Bitunix.
- Deux stratégies simulées **indépendamment** avec positions non chevauchantes : tous les SHORT Vector / seulement ceux où le dernier Vector **4H clôturé** est bearish à l'entrée. Ne jamais utiliser la bougie 4H en formation.
- Échantillon partagé en moitiés chronologiques « earlier » et « later », sans laisser une position traverser le découpage. **La période plus récente n'est pas un échantillon entièrement indépendant** : ces historiques ont déjà servi à l'exploration.
- Interdiction des chandelles absentes/invalides/dupliquées : quarantaine, réinitialisation des indicateurs par fenêtre continue, aucun trade à travers un trou.
- Exécution conservatrice en cas de stop et TP dans la même chandelle : stop exécuté d'abord; gaps simulés au cours d'ouverture réel; coûts et délais inclus.
- Indicateurs : nombre de signaux autorisés, trades clôturés, taux gagnant, net moyen/trade, motifs de sortie, positions censurées, qualité des données; minimum **30 trades clôturés dans chaque moitié** pour une lecture exploratoire.

## Interprétation

Comparer les horizons temporels et les coûts n'égalise **pas** les opportunités : plus de bougies peut donner plus de transactions, et les stratégies sont exposées différemment. Les statistiques sont des **moyennes nettes par transaction clôturée**, et non des rendements de portefeuille composés. Une stratégie filtrée peut prendre d'autres trades après les signaux ignorés (elle a sa propre gestion d'occupation), donc ses résultats peuvent différer d'un simple sous-groupe descriptif.

**Ne pas déclarer de « gagnant » sur la seule meilleure performance historique**, particulièrement si le groupe a peu de trades ou si l'effet disparaît avec davantage de glissement. Les tests ne certifient pas encore la parité du portage Vector avec le Pine Script TradingView.

Le protocole prospectif BTC 1H SHORT et ses sous-groupes 4H existants demeurent verrouillés et séparés. Pour autoriser une règle 30M ou 15M à être réellement utilisée, il faudra la déclarer avant une nouvelle période indépendante et vérifier les signaux sur TradingView.

## Fichiers GitHub

- `backtest/vector-ltf-execution-comparison.mjs` : étude et export JSON.
- `backtest/vector-ltf-execution-comparison.test.mjs` : tests de causalité et de frais.
- `.github/workflows/vector-ltf-equal-exits.yml` : déclenchement sur push correspondant à cette étude dans dev; artefact **`vector-ltf-equal-exits-90d`**.

Aucun programme journalier automatique n'est créé par ce workflow sur `main`.
