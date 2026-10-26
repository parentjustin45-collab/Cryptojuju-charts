# Vector V1.5 — Observations historiques et coût des retournements manqués

**Statut : EXPÉRIMENTAL, AUCUNE PROMOTION.** Étude Bitunix 180 jours du 26 octobre 2026, version exécutée au commit `b2b80199b5dbe6bacceb292b0402aaea42a84512`.

[GitHub Actions #40251953896 — résultats et tests réussis](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40251953896). Artefact `vector-v15-btc-eth-sol-opportunity-180d` : `vector-v15-opportunity-180d.json`, `vector-v15-summary.json`, `vector-v15-summary.csv`.

## Hypothèse préenregistrée avant les résultats

La V1.5 reprend la logique structure/impulsion de la V1.4, plus une voie **deux clôtures progressives** sur un candidat de retournement (seuils : 0,15 ATR et 0,45 ATR, fenêtre de 2–3 chandelles). Aucune modification aux versions V1.1–V1.4 ni au suivi prospectif V1.2 et V1.3 déjà verrouillé.

Comparaison historique non indépendante, **180 jours du 29 avril au 26 octobre 2026 (UTC)**, moitiés chronologiques coupées au 28 juillet 2026 00:00 UTC, **BTCUSDT / ETHUSDT / SOLUSDT 1H**, LONG et SHORT.

Entrée au prochain open, stop 1,5 %, take-profit 3 %, max 12 chandelles, commission 0,06 % par côté, glissement commun simulé 0,05 % par côté. Les rendements ci-dessous sont des **moyennes nettes par trade clôturé**, **pas** des rendements de portefeuille ou une prédiction de rentabilité.

## Comparaison SHORT — moitié historique récente

| Symbole | V1.2 trades/net | V1.4 trades/net | V1.5 trades/net | V1.5 net avec glissement doublé |
|---|---|---|---|---|
| BTCUSDT | 21 / +0,100 % | 27 / -0,066 % | **29 / -0,060 %** | -0,155 % |
| ETHUSDT | 17 / -0,013 % | 24 / -0,097 % | **24 / +0,137 %** | +0,041 % |
| SOLUSDT | 21 / +0,151 % | 30 / -0,037 % | **32 / -0,059 %** | -0,270 % |

**La V1.5 n'a pas démontré un avantage fiable sur les trois marchés** et ne franchit pas les 30 trades SHORT récents sur BTC et ETH. Même lorsqu'un échantillon franchit le seuil indicatif de 30, cela ne valide pas la stratégie.

Sur la première moitié BTC SHORT, V1.4 : **33 trades / -0,670 %**; V1.5 : **34 trades / -0,714 %**. La V1.5 était donc légèrement plus mauvaise avant le segment récent, malgré son objectif de réduire les occasions manquées.

Sur BTC LONG récent, V1.4 = **31 trades / -0,220 %**; V1.5 = **32 trades / -0,265 %**. La V1.5 ne domine pas non plus en retournement LONG.

## Diagnostic des LONG/SHORT rejetés — mouvements ex post 12 heures

Un signal de référence V1.1 n'est examiné comme « rejeté » que si la version cible **ne suit pas déjà la même direction** et ne confirme pas ce signal dans sa fenêtre de 3 chandelles. Une « occasion potentiellement ratée » est un rejet suivi d'une variation brute directionnelle à 12 h ≥ **+0,4 %** et excursion favorable ≥ **+0,8 %**, mesurées depuis l'open suivant le signal. **Ces prix futurs ne servent jamais aux décisions de l'indicateur.** C'est un critère descriptif avec le bénéfice du recul; il ne représente pas un trade gagnant garanti.

| Marché | V1.4 occasions ratées première moitié / récente | V1.5 occasions ratées première moitié / récente |
|---|---|---|
| BTC | 6 / 5 | **4 / 5** |
| ETH | 5 / 9 | **4 / 6** |
| SOL | 9 / 8 | **7 / 7** |

Sur BTC récent : V1.4 rejette **28** signaux V1.1 dont **24** ont un horizon 12 h observable, avec **17** rejets suivis d'une variation directionnelle négative ou nulle, **5** occasions potentiellement ratées, et **2** résultats ambigus; V1.5 rejette **27** signaux dont **23** sont observables, avec **16** négatifs ou nuls, **5** occasions potentiellement ratées et **2** ambigus. La différence ne démontre pas une amélioration de la capacité à récupérer les bons retournements BTC.

Les événements censurés, tronqués ou traversant une coupure chronologique ne sont jamais présentés comme des gains; néanmoins leur exclusion peut biaiser les moyennes.

## Audit visuel d'octobre BTC Bitunix 1H (UTC)

La série OHLC auditée contient :
- **V1.1** : LONG le 12 octobre **13:00 UTC**, SHORT le 12 octobre **14:00 UTC** (aller-retour rapproché).
- **V1.4** : aucun de ces deux signaux émis.
- **V1.5** : aucun de ces deux signaux émis **mais ajoute** un SHORT le 11 octobre **19:00 UTC**, et un LONG le 12 octobre **04:00 UTC**, par rapport à la V1.4. **Cela peut réintroduire des inversions non souhaitées.**
- **V1.4 et V1.5** : SHORT le 14 octobre **08:00 UTC**, classé `initial` car une nouvelle fenêtre continue a commencé après quarantaine; cela ne prouve pas un maintien de position ininterrompu.

Attention : les heures des étiquettes sur les captures d'écran TradingView n'ont pas été vérifiées au crosshair et leur fuseau n'a pas été établi. Ces dates sont des sorties algorithmiques Bitunix, **pas** une correspondance au pixel près avec les images.

## Qualité historique

| Marché | Couverture OHLC valide | Bougies exclues des fenêtres utilisables |
|---|---:|---:|
| BTC | 99,236 % | 312 |
| ETH | 98,866 % | 551 |
| SOL | 99,306 % | 202 |

Les données manquantes ou invalides sont mises en quarantaine. Les simulations ne traversent pas de trou; aucune estimation de P&L n'est autorisée au-delà des fenêtres utilisables.

## Conclusion de recherche

1. **Conserver la V1.5 uniquement en laboratoire**, sans fusion sur `main` et sans changer les suivis prospectifs V1.2/V1.3.
2. La confirmation sur deux clôtures **ne règle pas encore** les occasions manquées sur BTC et peut réintroduire des retournements parasites; la V1.2 SHORT BTC 1H reste notre contrôle historique le plus crédible, mais ses échantillons sont modestes et déjà exploités.
3. Avant de proposer une autre règle, isoler des épisodes avec **marqueurs précis et données OHLC**, puis analyser non seulement les bonnes inversions rejetées mais aussi le coût des sorties tardives, de la durée d'exposition et du drawdown.
4. Aucun résultat n'est un conseil d'achat/vente ni une preuve d'avantage live. Les données utilisées sont historiques et ont servi à plusieurs expérimentations successives; la sélection d'une version sur ces mêmes données amplifierait le surajustement.

**Aucun fichier du site public, du Pine original ni de la branche `main` n'a été modifié.**
