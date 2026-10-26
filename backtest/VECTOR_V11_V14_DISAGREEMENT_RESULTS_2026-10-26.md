# Vector V1.1 vs V1.4 — désaccords des directions sur chandelles Bitunix identiques

**26 octobre 2026, rapport exploratoire.** Étude exécutée avec succès dans [GitHub Actions #40330103901](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40330103901), commit `ed16715636de8ae4038ad7f636c370a9e8113904`. La suite complète de tests déterministes GitHub [#40330103921](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40330103921) a réussi. Artefact `vector-v11-v14-bitunix-direction-1h-4h` (JSON complet, résumés JSON et CSV).

**Recherche sur `dev/v1.26.0` seulement. Aucun ordre sur Bitunix, aucun déploiement sur Render, aucune modification à `main`, aux moteurs V1.1/V1.4 ou aux expériences prospectives V1.2/V1.3.**

## Dernière direction sur la même séquence valide de bougies clôturées

Instantané : **2026-10-26T13:23:14 UTC**, dernière clôture disponible en 1H = bougie ouvrant **12:00 UTC** (fermée à 13:00 UTC); en 4H = bougie ouvrant **08:00 UTC** (fermée à 12:00 UTC).

| Symbole / TF | V1.1 même historique | V1.4 même historique | Concordance | Dernier signal V1.1 (UTC) | Dernier signal V1.4 (UTC) | Bougies finales continues |
|---|---|---|---|---|---|---:|
| BTCUSDT 1H | LONG | LONG | oui | LONG 26 oct. 08:00 | LONG 26 oct. 09:00 | 169 |
| ETHUSDT 1H | LONG | LONG | oui | LONG 25 oct. 11:00 | LONG 25 oct. 16:00 | 79 |
| SOLUSDT 1H | **LONG** | **SHORT** | **non** | LONG 26 oct. 04:00 | SHORT 23 oct. 22:00 | 206 |
| BTCUSDT 4H | SHORT | SHORT | oui | SHORT 22 oct. 00:00 | SHORT 22 oct. 00:00 | 138 |

La **pastille WATCH** retournait les mêmes directions V1.4 pour chacun des quatre flux. Aucun signal/ordre n'a été déclenché.

L'opposition SOL est bien **une différence de logique sur les mêmes bougies**, et non seulement une différence de source ou une défaillance visuelle : la V1.1 a produit LONG, tandis que la V1.4 maintenait SHORT après refus de la confirmation de retournement. Au dernier point étudié l'opposition persiste depuis **9 bougies 1H** (26 oct. 04:00–12:00 UTC). Elle est censurée : **le résultat futur est inconnu**.

## Comparaison 90 jours historiques 1H / 4H

90 jours jusqu'au 26 octobre 2026, **déjà explorés** dans les études précédentes. Les calculs imposent bougies Bitunix OHLC valides, **55 bougies consécutives** et chauffe de 55 bougies. Un trou ou OHLC incohérent coupe la séquence et réinitialise les moteurs; **le pourcentage ne porte que sur les bougies admissibles après chauffe**, pas sur toutes les bougies calendaires.

| Marché | Bougies classées | Bougies V1.1 ↔ V1.4 opposées | % d'opposition | Épisodes distincts | Durée moyenne par épisode |
|---|---:|---:|---:|---:|---:|
| BTCUSDT 1H | 1186 | 317 | 26,73 % | 29 | 10,93 bougies 1H |
| ETHUSDT 1H | 946 | 267 | 28,22 % | 21 | 12,71 bougies 1H |
| SOLUSDT 1H | 1391 | 316 | 22,72 % | 36 | 8,78 bougies 1H |
| BTCUSDT 4H | 431 | 85 | 19,72 % | 9 | 9,44 bougies 4H (~37,8 h) |

Il y a parfois un état **non établi** (ni accord ni opposition) lorsque l'historique disponible manque de premiers signaux. Ne pas comparer les pourcentages sans considérer la qualité et le nombre de fenêtres : 13 fenêtres BTC 1H, 16 ETH 1H, 14 SOL 1H, 2 BTC 4H.

### Quel moteur rejoint l'autre ?

| Marché | La V1.4 rejoint la direction V1.1 | La V1.1 revient sur la direction V1.4 | Censuré avant résolution |
|---|---:|---:|---:|
| BTC 1H | 11 | 16 | 2 |
| ETH 1H | 13 | 6 | 2 |
| SOL 1H | 15 | 16 | 5 |
| BTC 4H | 6 | 3 | 0 |

Une V1.1 qui revient à la V1.4 peut signifier un changement de tendance parasite filtré, **mais aussi** un bon retournement abandonné trop tôt; la simple fréquence ne permet pas de trancher.

## Contrôle rétrospectif directionnel brut depuis l'ouverture de la bougie suivante

Pour chaque début d'épisode d'opposition, on compare **le mouvement de prix signé sur les 12 bougies suivantes**, si le segment reste continu et ne traverse pas le milieu temporel. Ce ne sont **pas des transactions simulées** : ni stops, frais, glissement, remplissage d'ordres ni performance d'un portefeuille. En 4H, 12 bougies représentent **48 heures**, et non 12 heures.

| Marché | Épisodes avec horizon observable | Direction V1.1, moyenne brute | Direction V1.4, moyenne brute |
|---|---:|---:|---:|
| BTC 1H | 25 | -0,157 % | +0,157 % |
| ETH 1H | 15 | **+0,769 %** | **-0,769 %** |
| SOL 1H | 30 | -0,197 % | +0,197 % |
| BTC 4H | 9 | -0,319 % | +0,319 % |

**Interprétation cruciale :** bien que les débuts d'oppositions BTC, SOL et BTC 4H aient, en moyenne et avec le recul, favorisé le sens V1.4, ceux d'ETH 1H ont plutôt favorisé V1.1. Ces échantillons sont **très petits**, rétrospectifs et sélectionnés; ces résultats n'établissent **pas** la meilleure stratégie ou un avantage après frais. Ne pas optimiser une V1.6 sur ce tableau.

### Exemples spécifiques où la prudence compte

- **SOL 1H :** opposition débutant le 26 octobre 04:00 UTC, encore ouverte au dernier point. **Aucun retour futur ne peut être attribué** à cette opposition et personne ne devrait choisir une entrée ou sortie sur cette seule image.
- **SOL 1H :** épisode du 23 oct. 23:00 au 25 oct. 20:00 UTC (46 bougies), V1.1 LONG vs V1.4 SHORT. Sur les 12 bougies qui ont suivi *le début* de cet épisode, l'évolution brute directionnelle a été environ **-1,294 % côté LONG** et **+1,294 % côté SHORT**, avant les frais et stops éventuels.
- **ETH 1H :** un contre-exemple du 21 oct. 18:00 UTC (V1.1 SHORT contre V1.4 LONG), suivi d'un mouvement brut **+2,559 % dans le sens V1.1** sur 12 bougies. Un filtre supplémentaire pourrait rater de telles occasions.
- **BTC 4H :** la direction SHORT confirmée par les deux versions le 22 octobre ne justifie pas d'extrapoler la même conclusion au 1H; ce sont des marchés découpés en horizons distincts.

## Décision

**Ne pas créer une V1.6 gagnante par rétro-optimisation.** L'expérience confirme que les directions opposées sont structurellement normales et parfois durables; il faut conserver un libellé clair **« Flèches V1.1 » vs « Direction filtrée V1.4 »**. La prochaine expérience devrait isoler **le coût du retard de confirmation** (surtout ETH 1H), puis préenregistrer une nouvelle hypothèse sur des chandelles réellement futures en conservant les frais, stops, glissement et épisodes incomplets. Les échantillons passés ne sont pas un holdout.

**V1.4/WATCH reste un diagnostic expérimental.** Le site Render de test `cryptojuju-watch-v126-test.onrender.com` et le site GitHub Pages sur `main` sont inchangés dans cette étape.
