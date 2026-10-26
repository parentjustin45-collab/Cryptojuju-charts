# Vector — Audit événement par événement : BTC / ETH / SOL 1H

**26 octobre 2026 UTC — protocole exploratoire, branche `dev/v1.26.0`. Aucune promotion de version, aucun changement aux scripts d'indicateurs, aux expériences prospectives verrouillées ou à `main`.**

## Données et provenance

- [GitHub Actions 40252848044 : audit complet réussi](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40252848044).
- Artefact GitHub `vector-individual-trade-and-reversal-ledger-90d` : `vector-event-ledger-90d.json`, `vector-event-summary.json`, `vector-event-summary.csv`, `vector-event-cases.json`, `vector-closed-trades.csv`, `vector-rejected-signals.csv`.
- Historique **du 28 juillet 2026 à 01:00 UTC au 26 octobre 2026 à 01:00 UTC**; séparation temporelle au **11 septembre 2026 à 01:00 UTC**. 90 jours et historique déjà étudié par les précédentes versions.
- Bitunix BTCUSDT, ETHUSDT, SOLUSDT **1H**; bougies manquantes, invalides, dupliquées et fenêtres trop courtes soumises à quarantaine; aucun signal traversant un trou ne devient automatiquement une transaction gagnante.
- Détection et gestion du sens inchangées : V1.1, V1.2 `break_extreme_2`, V1.4 structure et V1.5 deux clôtures. Les seuils historiques ne sont pas réoptimisés.
- Frais simulés **0,06 % par côté**, glissement **0,05 % par côté**, stop **1,5 %**, cible **3 %**, durée maximale **12 bougies**; entrée à l'ouverture suivante après clôture du signal.
- Les mouvements à 3 h, 6 h et 12 h mesurés après un signal sont **des étiquettes rétrospectives brutes**, sans stop, et **non des gains tradables**, ni des caractéristiques accessibles au moment du signal.

## Ce que les filtres rejettent

Chaque ligne part des inversions V1.1, distingue `accepted` (confirmée dans les 3 chandelles avec la même source), `already_aligned` (bonne direction déjà détenue), et `rejected` (non confirmée).

Un rejet n'est qualifié de `potential_missed_move` que s'il est suivi de +0,4 % brut directionnel sur 12 h et d'au moins +0,8 % d'excursion favorable. Si le mouvement brut directionnel est nul ou négatif, il est étiqueté `possibly_avoided_loss`. Les autres sont ambigus ou censurés (horizon incomplet).

| Actif | Mode | Signaux V1.1 rejetés | Occasion potentiellement ratée | Mouvement défavorable au signal rejeté | Ambigus | Horizon incomplet |
|---|---|---:|---:|---:|---:|---:|
| BTC | V1.2 | 42 | 10 | 24 | 5 | 3 |
| BTC | V1.4 | 27 | **5** | 16 | 2 | 4 |
| BTC | V1.5 | 26 | **5** | 15 | 2 | 4 |
| ETH | V1.4 | 24 | 8 | 8 | 4 | 4 |
| ETH | V1.5 | 20 | **5** | 8 | 4 | 3 |
| SOL | V1.4 | 30 | 8 | 15 | 2 | 5 |
| SOL | V1.5 | 28 | **7** | 15 | 1 | 5 |

**Conclusion :** la V1.5 ne récupère **aucune** occasion supplémentaire parmi les cinq cas BTC selon le seuil fixé, même si elle semble améliorer cet indicateur descriptif sur ETH et SOL. Un mode peut déjà être orienté dans le bon sens : ces observations `already_aligned` ne sont pas comptées comme de mauvaises décisions.

## Quelques cas BTC avec des heures OHLC vérifiables (UTC)

- Le **11 septembre 2026 à 14 h UTC**, un SHORT V1.1 rejeté par V1.4 et V1.5 est suivi d'un mouvement directionnel brut à 12 h d'environ **+1,905 %** en faveur du SHORT; excursion favorable environ **+2,449 %** et adverse environ **-0,061 %**. Ex post uniquement; cela ne garantit pas une transaction réellement profitable, particulièrement avec les règles de stop et le délai de confirmation.
- Le **8 octobre 2026 à 18 h UTC**, un LONG V1.1 rejeté par les mêmes modes est suivi d'un mouvement brut **+1,307 %** et d'une excursion favorable **+1,422 %**; adverse **-0,102 %** sur 12 h.
- Le **12 octobre 2026 à 13:00 UTC puis 14:00 UTC**, la V1.1 émet LONG puis SHORT; **V1.4 et V1.5 n'émettent pas ces deux signaux aux mêmes heures**. Mais la V1.5 émet un SHORT le **11 octobre 19:00 UTC** et un LONG le **12 octobre 04:00 UTC**, signe que la nouvelle confirmation peut recréer des changements rapprochés.
- Le SHORT V1.4 / V1.5 **14 octobre 08:00 UTC** apparaît à l'initialisation d'une nouvelle fenêtre propre après un trou de données. **Il ne démontre pas** un maintien de position ininterrompu depuis plusieurs jours.

Les captures fournies par l'utilisateur servent à identifier des exemples qualitatifs, mais leurs fuseaux et heures exactes ne sont pas déterminés au crosshair : **ne pas affirmer que ces événements numériques reproduisent exactement les étiquettes des screenshots**.

## Transactions réelles du moteur de simulation : BTC, moitié récente (~45 jours)

| Version | SHORT trades clôturés | Net moyen SHORT par trade | LONG trades clôturés | Net moyen LONG par trade |
|---|---:|---:|---:|---:|
| V1.1 | 21 | -0,085 % | 23 | -0,014 % |
| V1.2 | 8 | +0,564 % | 8 | -0,386 % |
| V1.4 | 14 | +0,144 % | 15 | +0,029 % |
| V1.5 | 15 | +0,093 % | 16 | -0,077 % |

Ces nombres sont **différents des analyses précédentes sur 180 jours**, car la période, la coupure temporelle, la quarantaine et l'échantillon de trades ne sont pas identiques. **Aucun côté ni mode n'atteint 30 trades clôturés dans la moitié récente de cet audit BTC**. En outre, une moyenne par trade ne mesure pas le rendement composé, la fréquence des trades ou le capital exposé. Une configuration à seulement huit SHORT gagnants en moyenne est encore **insuffisante** pour être choisie.

Sur ETH SHORT récent : V1.4 **14 trades / +0,461 %**, V1.5 **14 / +0,717 %**. Sur SOL SHORT récent : V1.4 **17 / +0,222 %**, V1.5 **17 / +0,222 %**. Les échantillons restent petits et ne confirment aucune généralisation.

### Risque du maintien de tendance

Le journal séparé des épisodes `entrée → signal opposé` ne possède **aucun stop protecteur**. Sur BTC, il recense **47 épisodes V1.4 clôturés, 14 censurés** et **50 épisodes V1.5 clôturés, 14 censurés**. Leur excursion défavorable observée sur l'ensemble de la vie de chaque épisode a atteint environ **-4,141 %** pour les deux variantes. **Ce système sans stop n'est pas adapté au trading réel.**

Même sur les trades à stop-loss, l'excursion calculée à partir du *plus haut / plus bas de toute la bougie de sortie* peut dépasser le stop : une partie du mouvement peut avoir eu lieu **après** le déclenchement de la sortie, ce que les OHLC 1H ne permettent pas de reconstituer. Ne pas interpréter ce nombre comme une perte effectivement subie ou comme un drawdown exact.

## Qualité des données (90 jours)

| Actif | Couverture valide des bougies 1H | Bougies exclues des fenêtres utilisables | Fenêtres propres admissibles |
|---|---:|---:|---:|
| BTC | 99,120 % | 284 | 13 |
| ETH | 98,565 % | 362 | 16 |
| SOL | 99,398 % | 13 | 14 |

## Décision

**Ne pas coder une V1.6 sur la seule base de ces résultats.** Le meilleur prochain travail est d'examiner les occasions effectivement ratées **et** les pertes évitées avec une description des conditions de marché à la clôture du signal, sans faire entrer l'avenir dans la règle. Les exemples à commencer : SHORT BTC 11 septembre, LONG BTC 8 octobre, et les inversions du 11–12 octobre. Une nouvelle hypothèse devra être préenregistrée avant observation de **nouvelles données prospectives inédites**, sans modifier les observations V1.2 du 26 octobre ou V1.3 du 27 octobre.

Les sources de référence originales Pine V1.1 et l'interface `index.html` sont intactes. Aucun ordre Bitunix et aucune fusion vers `main`.
