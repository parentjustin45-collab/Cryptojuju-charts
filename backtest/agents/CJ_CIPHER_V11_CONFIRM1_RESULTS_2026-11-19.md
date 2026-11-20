# CJ Cipher V1.1 — la confirmation +1h ne résout pas le problème global

19 novembre 2026, heure du Québec. Hypothèse inscrite avant cette simulation
dans le commit `28dfdeb9b948bcdec67f6f945531a414e76de825`.
Source exacte : Actions 44656240484, BTC/HYPE/1000PEPE × 960 bougies 1H closes,
archive conservée et vérifiée SHA-256 dans le dépôt. Les valeurs du JS et du
Pine V1.0 sont inchangées, contrôlées par SHA-256 au démarrage.

**Décision : conserver cette variante comme expérience, sans la promouvoir.**
L'entrée attend une bougie fermée de plus, et une ancienne position opposée sort
à plat dès le croisement original, au prochain OPEN. Aucun délai ou seuil n'a
été ajusté après observation des résultats.

## Résultat principal : les 288 dernières bougies historiques, mêmes risques et coûts

| Marché 1H | Trades V1.0 → V1.1 | Rendement net V1.0 ATR | Rendement net V1.1 ATR | DD sur clôtures V1.0 → V1.1 | Gagnants V1.0 restés gagnants |
|---|---:|---:|---:|---:|---:|
| BTC | 39 → 37 | −1,05 % | −4,47 % | 8,11 → 9,99 % | 11/13 |
| HYPE | 43 → 39 | +1,72 % | +4,94 % | 6,37 → 5,91 % | 14/14 |
| 1000PEPE | 39 → 37 | −3,73 % | −0,82 % | 8,90 → 9,26 % | 11/13 |

Chaque marché est simulé séparément, à 1 000 $ fictifs. **Ne pas additionner les
rendements** ni les comparer aux anciens backtests sans stop/objectif.
Deux marchés améliorent le rendement; BTC se dégrade et le drawdown PEPE augmente.

La variante refuse **8 candidats**, qui correspondent ici à **8 trades V1.0
perdants** (2 BTC, 4 HYPE, 2 PEPE). Aucun gagnant V1.0 n'est refusé par ce filtre
dans cette phase. Mais **4 gagnants deviennent perdants après l'entrée retardée**
(2 BTC, 2 PEPE) : garder le sens du signal ne suffit pas à conserver son bon prix.
Au total, 36/40 trades gagnants V1.0 restent gagnants; ce sont des correspondances
rétrospectives entre deux portefeuilles, pas des occasions connues à l'avance.

Les sorties effectives sur signal opposé en ≤6h passent seulement de **49/121
(40,50 %) à 48/113 (42,48 %)**. Leur nombre baisse de un, leur proportion augmente.
Les anciennes « 71 inversions » venaient du moteur reversal-only; elles ne doivent
pas être utilisées comme référence numérique dans ce nouveau moteur ATR.
Une sortie rapide n'est pas automatiquement une fausse entrée.

| Marché | Stress V1.0 ATR | Stress V1.1 ATR | Plus longue période sans position V1.0 → V1.1, base |
|---|---:|---:|---:|
| BTC | −10,85 % | −13,18 % | 9 → 8h |
| HYPE | −4,40 % | −2,91 % | 11 → 12h |
| 1000PEPE | −7,42 % | −4,41 % | 15 → 18h |

Les trois marchés restent négatifs sous les hypothèses stress. La période de
672 bougies précédente présente aussi des résultats mélangés : voir le JSON
complet `results/cj-cipher-confirm1-2026-11-19.json`, qui conserve les deux phases,
les deux frictions, LONG/SHORT, candidats refusés et coûts d'opportunité.

## Modèle, vérifications et limites

Le **même noyau d'exécution ATR** sert aux deux variantes, sans modification de
son calcul : Wilder ATR14, stop 1,5 ATR, cible 2R, timeout 12h, risque nominal 1 %,
notionnel ≤100 %, entrée prochaine ouverture, stop prioritaire lors des collisions.
Frais/glissement par côté : base 0,06 % + 0,05 %, stress 0,10 % + 0,20 %.
Le drawdown est valorisé aux clôtures; les risques intrabar et gaps peuvent
être plus élevés. Funding, spread réel, liquidité et taille de lot non mesurés.

Les contrôles vérifient l'archive et chaque fichier lu contre ses octets, les deux
lectures REST, les empreintes brutes et dérivées recalculées, la normalisation
reproduite et les commandes originales exactes. Les tests contrôlent l'attente
réelle de +1h, les annulations, égalités, frontières, causalité et l'identité des
résultats du noyau ATR entre identifiants Vector et Cipher à commandes égales.
Les fichiers Pine/JS V1.0 restent identiques.

**161/161 tests d'agents passent localement.** Le workflow dédié produit le détail
de chaque opération et candidat dans `cj-CIPHER-CONFIRM1-FIXED-ARCHIVE-ATR`.
La réussite des tests techniques n'est pas une validation de rentabilité.

Reproduction depuis la racine du dépôt : extraire l'archive dont le chemin est
dans `cj-cipher-v11-lock.json`, puis :

```sh
node --test backtest/agents/*.test.mjs
node backtest/agents/run-cj-cipher-confirm1.mjs SOURCE_EXTRAITE SORTIE
```

## Suite figée et portée

La fenêtre future est inscrite du **19 novembre à 23h au Québec** au
**1 décembre à 23h**, 288 bougies, fin exclusive. Elle n'a pas été lue ni évaluée.
Le collecteur manuel `--prospective SORTIE` refuse toute collecte avant le
2 décembre à 04h02 UTC. Aucune nouvelle tâche planifiée n'est créée ici.
Les critères sont ceux du protocole initial; aucun succès prospectif revendiqué.

Le bilan actuel indique que retarder toutes les entrées d'une heure conserve
trop de retournements et peut dégrader le prix d'entrée. La prochaine hypothèse
devrait distinguer la qualité d'entrée de la sortie, puis être préinscrite
séparément, sans chercher le meilleur délai sur ces mêmes pertes connues.
Les combinaisons SPEED/Frank restent ultérieures à l'étude individuelle.

Tout est limité à `dev/ai-agents-phase1`. Aucun ordre réel, dépense, déploiement,
édition du site public, de `main` ou de `dev/v1.26.0`.
