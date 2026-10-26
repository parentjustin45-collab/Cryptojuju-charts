# Vector — WATCH précoce / LONG-SHORT confirmé : résultats historiques

**Recherche expérimentale sur `dev/v1.26.0`, 26 octobre 2026 UTC.** Étude GitHub Actions [#40255418068](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40255418068) réussie; tests globaux [#40255418035](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40255418035) réussis. Artefact `vector-early-watch-no-trades-90d`.

La fonctionnalité n'a **pas** été déployée sur l'interface du site. Aucun changement aux moteurs V1.1–V1.5, aux expériences prospectives V1.2/V1.3, à `index.html`, à la branche `main`, ni au compte Bitunix.

## Ce qui est codé

`backtest/vector-watch-shadow.mjs` et `backtest/vector-watch-90d-study.mjs` : une alerte non exécutable **WATCH LONG/SHORT** apparaît après clôture de la **première chandelle Vector opposée** à la direction V1.4 en cours, uniquement si V1.4 n'a pas déjà confirmé ce retournement. La WATCH **ne change jamais** la position confirmée et n'émet aucun ordre. Elle se confirme si V1.4 accepte la **même chandelle source** dans ses trois bougies suivantes, expire, est annulée par une chandelle Vector opposée ou censurée à la coupure de données. **Ce n'est pas un prédicteur entraîné**.

Les signaux CONFIRMED LONG/SHORT restent **exactement les mêmes que V1.4**, au même horodatage et dans le même ordre. Tous les tests de causalité/no-lookahead et d'égalité avec la V1.4 ont réussi.

## Contrôle exploratoire verrouillé

- Bitunix BTCUSDT, ETHUSDT, SOLUSDT **1H**, du **28 juillet au 26 octobre 2026, 01:00 UTC**, coupure au **11 septembre 01:00 UTC**.
- Les données historiques ont été **examinées auparavant** pour d'autres études Vector; ce n'est pas un échantillon inédit ni indépendant.
- Les données manquantes/invalides sont mises en quarantaine; les WATCH sont recalculées par segments continus et censurées aux bordures.
- Les 12 heures suivant une WATCH servent **uniquement à un diagnostic a posteriori**, jamais à déclencher une WATCH, une entrée ou une sortie.
- Convention descriptive inchangée : `potential_move` si brut directionnel à 12 heures >= +0,4 % et excursion favorable >= +0,8 %; `negative_move` si brut <= 0; `ambiguous` sinon. Une « possible opportunité » n'est **pas** un gain net de trading : pas de stops, frais, glissement ou fills comparables.

## Résultats WATCH sur les 90 jours

| Marché | WATCH | Confirmées par V1.4 | Expirées | Annulées par signal contraire | Remplacées par autre confirmation | Censurées en fin | WATCH avec issue 12h inconnue |
|---|---:|---:|---:|---:|---:|---:|---:|
| BTC | **40** | **9** | 19 | 11 | 1 | 0 | 4 |
| ETH | **33** | **5** | 22 | 5 | 1 | 0 | 8 |
| SOL | **46** | **14** | 23 | 7 | 1 | 1 | 6 |
| **Total** | **119** | **28** | **64** | **23** | **3** | **1** | **18** |

**Taux de confirmation V1.4 : 28 / 119 = 23,53 %.** Lorsque confirmées, les WATCH ont une avance moyenne d'environ **1,54 bougie 1H**. Elles sont donc potentiellement utiles comme **surveillance anticipée**, pas comme signal d'achat/vente.

### Diagnostic à 12 heures, information qui n'était pas disponible lors de la WATCH

| Marché | WATCH évaluables 12 h | Potentiellement favorables | Directionnelles négatives | Ambiguës | Censurées 12 h |
|---|---:|---:|---:|---:|---:|
| BTC | 36 | 11 | 21 | 4 | 4 |
| ETH | 25 | 11 | 8 | 6 | 8 |
| SOL | 40 | 18 | 18 | 4 | 6 |
| **Total** | **101** | **40** | **47** | **14** | **18** |

Les chiffres reposent sur des **mouvements bruts avec le bénéfice du recul**. Les 40 mouvements « potentiels » n'impliquent pas 40 transactions gagnantes, ni 40 vrais retournements. Les 47 mouvements négatifs démontrent le risque de trader chaque WATCH directement.

### Études de cas Bitcoin autour du 11–12 octobre

- **11 octobre 17:00 UTC**, WATCH SHORT, alors que la direction V1.4 est LONG; WATCH expirée, mouvement directionnel brut ultérieur 12 h **-0,238 %**. C'est un avertissement contre une entrée immédiate.
- **12 octobre 13:00 UTC**, WATCH LONG, alors que la direction V1.4 est SHORT; annulée par une chandelle Vector contraire, et horizon de 12 h **censuré** à cause d'une fenêtre historique. Ne pas classer cette observation comme gagnante ou perdante.
- Les heures sont tirées du journal OHLC Bitunix en UTC, **sans correspondance établie au crosshair des anciennes captures**.

## Conclusion / décision

**Valider la séparation conceptuelle « tendance confirmée » vs « possibilité de retournement », mais ne pas déployer les WATCH sur le graphique principal pour le moment.** Les trois quarts des WATCH ne se confirment pas selon V1.4 et pourraient surcharger le graphique ou inciter à entrer trop tôt.

La V1.4 elle-même **n'est pas suffisamment validée comme stratégie profitable**. L'ajout d'une WATCH non-tradable ne corrige pas ses performances historiques; il ne fait que rendre plus explicite l'incertitude entre les signaux.

Prochaine expérimentation pertinente : réduire le bruit visuel **sans modifier les flèches ou ouvrir des positions**, par exemple au moyen d'un petit état `retournement possible` dans un panneau discret, désactivé par défaut. **Ne pas inventer de filtre prédictif à partir de ce jeu historique déjà sur-exploré.** Pour valider l'utilité, recueillir prospectivement un jeu inédit à partir du **28 octobre 2026 00:00 UTC** après avoir défini et figé les mesures de fréquence d'alertes, confirmation, mouvements ratés et comportement des utilisateurs. Le workflow actuel se lance au push sur dev ou manuellement, **pas en continu**.

**Documents** : `backtest/VECTOR_WATCH_PROTOCOL.md`, `backtest/vector-watch-shadow.mjs`, `backtest/vector-watch-90d-study.mjs`, tests et workflow `.github/workflows/vector-watch-shadow.yml`.
