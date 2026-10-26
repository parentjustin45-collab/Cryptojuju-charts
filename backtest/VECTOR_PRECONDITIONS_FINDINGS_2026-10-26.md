# Vector — Conditions avant les bons retournements manqués (audit clos le 26 octobre 2026)

**Statut : étude exploratoire, aucune V1.6 sélectionnée ni publiée.** Branche `dev/v1.26.0`, `main` inchangée. Aucune modification aux moteurs V1.1–V1.5 ou aux suivis prospectifs indépendants.

## Source vérifiée

- [GitHub Actions #40253643855 — audit Bitunix et tests réussis](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40253643855).
- Artefact `vector-closed-bar-preconditions-90d` : `vector-preconditions-90d.json`, `vector-preconditions-summary.json`, `vector-preconditions-summary.csv`, `vector-preconditions-rows.json`.
- **Période strictement identique à celle du journal précédent** : 28 juillet 2026 01:00 UTC → 26 octobre 2026 01:00 UTC, coupure chronologique le 11 septembre 2026 01:00 UTC.
- BTCUSDT, ETHUSDT, SOLUSDT, intervalle **1H Bitunix**; lecture seule, données manquantes/invalides en quarantaine, indicateurs redémarrés à chaque fenêtre valide.
- Les classifications `potential_missed_move`, `possibly_avoided_loss`, `ambiguous`, `censored` sont **les mêmes** que dans `vector-event-ledger.mjs`, calculées après les **12 heures suivantes**, uniquement pour les signaux V1.1 rejetés par V1.4/V1.5. Seules les caractéristiques au moment du signal sont nouvelles.

## Observations à la clôture de deux signaux BTC 1H manqués

| Caractéristique mesurée au signal | SHORT 11 septembre 14:00 UTC | LONG 8 octobre 18:00 UTC |
|---|---:|---:|
| Mouvement brut directionnel constaté après 12 h | +1,905 % | +1,307 % |
| Excursion favorable constatée après 12 h | +2,449 % | +1,422 % |
| Excursion défavorable constatée après 12 h | -0,061 % | -0,102 % |
| Pente EMA50 signée selon le côté désiré (3 barres) | **-0,155 %** | **-0,353 %** |
| Prix vs EMA50 en ATR14, signé selon le côté désiré | **-1,625 ATR** | **-3,044 ATR** |
| Progression directionnelle signée sur les 3 h précédentes | -2,281 % | +0,575 % |
| Progression directionnelle signée sur les 6 h précédentes | -1,854 % | -0,978 % |
| ATR14 / prix | 0,810 % | 0,761 % |
| Corps / ATR14 | **0,712** | **1,212** |
| Volume / moyenne volume SMA20 | 3,368× | 1,282× |
| Rupture clôturée des extrêmes des 4 chandelles précédentes | **Non** | **Non** |
| Corps ≥ 1,25 ATR14 | **Non** | **Non** |
| Efficacité directionnelle des 6 bougies précédentes | 0,467 | 0,241 |

Les caractéristiques sont calculées **uniquement avec la clôture et les chandelles antérieures**. Le retour sur 12 h est une **étiquette rétrospective**, jamais visible de l'indicateur à la décision.

### Ce qu'on apprend — sans confondre corrélation et décision

1. **Les deux retournements se produisent encore contre la direction indiquée par l'EMA50** : sa pente et l'écart prix–EMA50 ne sont pas alignés avec la nouvelle direction. Un filtre « EMA50 obligatoire » strict aurait donc rejeté les deux signaux au moment de leur apparition.
2. **Aucun de ces deux signaux n'a déjà brisé les 4 extrêmes précédents en clôture** et **aucun n'a un corps de chandelle de 1,25 ATR ou plus**. Cela explique pourquoi une stratégie exigeant une cassure/impulsion instantanée peut être tardive sur des retournements précurseurs.
3. **Il n'existe pourtant pas un critère unique évident** : le SHORT de septembre n'a pas encore une progression directionnelle baissière sur les trois heures précédentes (valeur signée négative), alors que le LONG d'octobre a déjà +0,575 % dans son sens sur trois heures. Leurs volumes relatifs et efficacités de tendance diffèrent fortement.
4. Ces deux épisodes ont été **choisis après consultation des gains futurs**. Ils peuvent motiver une expérience préenregistrée, **mais pas valider une nouvelle règle**. Modifier les seuils pour « sauver » ces deux trades gonflerait artificiellement la performance historique.

## Effectifs après quarantaine et période de chauffe EMA

Les fenêtres admissibles de ce nouvel audit exigent **au moins 55 bougies** pour établir EMA50 et autres caractéristiques; cela exclut des observations qu'on pouvait classer dans l'audit précédent, d'où les **effectifs inférieurs** ci-dessous.

| Marché | Version de maintien | Rejets étudiés avec contexte EMA | Mouvements potentiellement manqués | Retournements ensuite défavorables | Ambigus | Horizon censuré |
|---|---|---:|---:|---:|---:|---:|
| BTC | V1.4 | 21 | 3 | 12 | 2 | 4 |
| BTC | V1.5 | 20 | 3 | 11 | 2 | 4 |
| ETH | V1.4 | 16 | 5 | 6 | 1 | 4 |
| ETH | V1.5 | 13 | 3 | 6 | 1 | 3 |
| SOL | V1.4 | 21 | 5 | 9 | 2 | 5 |
| SOL | V1.5 | 19 | 4 | 9 | 1 | 5 |

Attention aux limites :
- **Aucun sous-groupe séparé par actif, côté LONG/SHORT, demi-période et étiquette n'atteint 10 observations.** Les moyennes ou médianes de ces sous-groupes sont très instables.
- Comparer la V1.4 et la V1.5 sur les mêmes signaux historiques crée une forte corrélation et les données ont déjà servi à plusieurs explorations.
- Un mouvement favorable brut sur 12 heures **n'équivaut pas** à un rendement atteignable avec frais, glissement, stop, prise de profit et sortie à temps.
- Des réglages qui auraient sauvé un bon LONG risquent d'introduire un SHORT inutile, surtout en marché haché.
- Les captures Bitunix déjà fournies restent des exemples qualitatifs : leur correspondance au timestamp exact nécessiterait les heures du crosshair.

## Qualité des historiques

| Marché | Couverture Bitunix OHLC valides sur 90 jours | Bougies exclues des fenêtres éligibles | Fenêtres éligibles |
|---|---:|---:|---:|
| BTC 1H | 99,120 % | 284 | 13 |
| ETH 1H | 98,565 % | 362 | 16 |
| SOL 1H | 99,398 % | 13 | 14 |

## Décision et prochaine expérience possible

**Pas de déploiement ni d'optimisation V1.6 à partir de ces chiffres.** Une hypothèse candidate *à préenregistrer avant des données neuves* serait de traiter les retournements **contre EMA50** comme des alertes d'observation distinctes, sans inverser automatiquement la position et sans désactiver les protections de risque. Elle devrait être évaluée sur des échantillons prospectifs frais, sur les deux côtés et plusieurs marchés, en surveillant simultanément les retournements manqués, les pertes évitées, l'exposition et les faux changements de direction.

Toute décision de trading réel demande également l'exactitude de données et d'exécutions Bitunix, un stop, des frais/glissements réalistes, et une validation Pine. Le workflow de cet audit est indépendant des deux protocoles prospectifs BTC 1H SHORT déjà verrouillés; il ne crée pas d'exécution quotidienne sur `main`.

**Artefacts de code** : `backtest/vector-preconditions-audit.mjs`, `backtest/vector-preconditions-audit.test.mjs`, `.github/workflows/vector-preconditions-audit.yml`, `backtest/VECTOR_PRECONDITIONS_PROTOCOL.md`.
