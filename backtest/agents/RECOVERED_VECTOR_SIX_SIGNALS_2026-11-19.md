# CryptoJuju — audit des six signaux Vector réintroduits (19 novembre 2026)

**Statut : recherche historique descriptive, aucun gagnant promu.**
Données issues **exclusivement** de l'artefact réel de [GitHub Actions 44626524231](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44626524231), artefact `cj-VECTOR-1H-INTEGRATED-ATR-RECOVERY-RESEARCH` (ID 14579796216, archive valable jusqu'au 26 novembre 2026). Commit testé : `bdd70b70dc06f8338d0eb048c874dab6a89622aa`.

Marchés : HYPEUSDT et 1000PEPEUSDT; BTCUSDT n'a **aucun** signal récupéré (11 oppositions Daily rejetées par la confirmation EMA en 1H). Chaque marché utilise 960 chandelles 1H closes et 365 Daily closes, avec source publique Bitunix LAST_PRICE lue deux fois et comparée. Les six cas ont été retrouvés en comparant les listes de commandes `v11_daily_strict` et `v13_ema_confirmed_recovery`, puis reliés aux transactions exactes dans `*-integrated-portfolio-trades.json`.

## Les six cas audités — heure locale du Québec

| Marché | Signal confirmé (Québec) | Direction / Daily | EMA 1H | Stricte | Phase | Sortie simulée de base | Net base | Net stress |
|---|---|---|---|---|---|---|---:|---:|
| HYPE | 2 nov., 01 h EST | SHORT / Daily **haussier** | Bear stack | Aucune commande | Entraînement | Stop à 03 h EST | −10,00 $ | −10,00 $ |
| HYPE | 2 nov., 10 h EST | SHORT / Daily **haussier** | Bear stack | FLAT | Entraînement | Objectif 2R à 14 h EST | +16,70 $ | +13,59 $ |
| HYPE | 19 nov., 12 h EST | LONG / Daily **baissier** | Bull stack | FLAT | **Validation historique** | Inversion Vector à 14 h EST | −2,58 $ | −3,78 $ |
| 1000PEPE | 25 oct., 09 h EDT | SHORT / Daily **haussier** | Bear stack | FLAT | Entraînement | Timeout 12 barres à 22 h EDT | +11,42 $ | +8,85 $ |
| 1000PEPE | 26 oct., 14 h EDT | SHORT / Daily **haussier** | Bear stack | FLAT | Entraînement | Timeout 12 barres, 27 oct. 03 h EDT | −0,15 $ | −1,66 $ |
| 1000PEPE | 1er nov., 10 h EST | SHORT / Daily **haussier** | Bear stack | FLAT | Entraînement | Stop à 20 h EST (base), à 15 h EST (stress) | −10,66 $ | −10,48 $ |

Le total **2 transactions positives / 4 négatives** est un dénombrement de **six opérations simulées**, pas un win rate prospectif. Le capital initial est **1 000 $ fictifs, réinitialisés entre entraînement et validation**, avec risque nominal 1 % par entrée, exposition maximale 100 %, stop 1,5 ATR Wilder 14, objectif 2R, horizon maximum 12 chandelles. Fills sur ouverture après confirmation; collisions high/low résolues « stop d'abord ». Base : 0,06 % frais et 0,05 % slippage **par côté**. Stress : 0,10 % frais et 0,20 % slippage par côté. Les valeurs PnL sont par transaction **dans le portefeuille simulé**, ne doivent pas être simplement additionnées pour prédire l'amélioration totale.

## Impact réel dans le portefeuille : récupération VS Daily strict

| Marché | Période | Daily strict base | Récupération EMA base | Différence base | Différence stress |
|---|---|---:|---:|---:|---:|
| HYPE | Entraînement | −2,256 % | −1,585 % | **+0,671 point** | +0,363 point |
| HYPE | Validation historique | −0,136 % | −0,397 % | **−0,262 point** | −0,382 point |
| 1000PEPE | Entraînement | +4,071 % | +4,185 % | **+0,114 point** | **−0,297 point** |
| 1000PEPE | Validation historique | +2,506 % | +2,506 % | **0,000 point** | 0,000 point |
| BTC | Entraînement et validation | Identique | Identique | 0,000 point | 0,000 point |

Le train/holdout est séparé au **7 novembre 2026, 22:00 UTC** (soit le 7 novembre à 17 h EST). Ces fenêtres ont été inspectées pendant le développement : **elles ne sont pas un holdout prospectif aveugle**.

### Éclairage important sur les six décisions

1. **HYPE short du 2 novembre à 01 h** : nouveau SHORT alors que le Daily reste bull; la tendance 1H bear ne prévient pas un stop (-10,00 $). Aucun ordre strict au même moment.
2. **HYPE short du 2 novembre à 10 h** : remplace une commande FLAT stricte, rejoint l'objectif 2R (+16,70 $). Le signal de correction a été utile dans cette simulation.
3. **HYPE long du 19 novembre à midi** : le Daily était bear, mais les EMA 1H bull. Le strict aurait fermé son SHORT sans ouvrir de LONG; la variante récupérée ferme le SHORT et ouvre le LONG, lequel est fermé à la prochaine inversion Vector (-2,58 $). **C'est le seul des six cas situé en phase de validation.**
4. **PEPE short du 25 octobre** : signal strict FLAT, EMA 1H bear en opposition au Daily bull; sortie au timeout avec gain (+11,42 $).
5. **PEPE short du 26 octobre** : même contexte, mais prix quasi latéral; gain brut trop faible pour compenser correctement les frais (−0,15 $ base, −1,66 $ stress).
6. **PEPE short du 1er novembre** : encore une correction contre le Daily bull, mais stop touché (−10,66 $ base). Le scénario stress ferme plus tôt.

**Résultat expérimental :** le filtre « EMA 1H dans le sens du signal contre Daily » **ne suffit pas** à sélectionner des récupérations fiables. HYPE train s'améliore, HYPE validation se dégrade. PEPE train s'améliore légèrement à faibles frais puis se dégrade sous coûts stress, PEPE validation n'est pas changée. Aucune proposition de promotion V1.3 n'est justifiée par ces six cas.

### Provenance explicite des données historisées

- HYPE 1H SHA256 des lignes brutes : `d707770c223d20d68be17d5633eacff3183d91a59408cbb4042ed143cb214ca1`
- HYPE 1D SHA256 : `f8fad2a66c8346fee30962dd081796c1fe8603439acefb616329a390d80719e4`
- 1000PEPE 1H SHA256 : `bf5753d4f05428842dfb7d5f4bba41030199804618151937e4e15d3e0a0cc411`
- 1000PEPE 1D SHA256 : `8b79c95844cfe13f3fe850b3ab9301d7ae6c040f554e4f66e7da31c5e4fa2b89`

Ces empreintes permettent de rattacher les six événements à la capture Bitunix contrôlée; **aucune comparaison indépendante TradingView**, aucun funding ni exécution réelle n'ont été démontrés.

## Contrôle de répétabilité GitHub Actions (même source archivée)

Un second programme de replay, dans le dépôt, a parcouru exactement la
même archive Bitunix GitHub et a comparé les commandes, les barres de
confirmation, les EMA, le dernier Daily clos et les portefeuilles simulés.
Le workflow [DEV inspect EXACT six archived Vector recovery signals](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44629325163)
a réussi **8 tests sur 8**, avec **6 signaux retrouvés sur 6** et des
écarts de rendement de portefeuille identiques aux tableaux ci-dessus.
C'est une vérification informatique de **répétabilité sur la même source**,
et non une validation de marché indépendante.

## Décision de recherche pour le prochain cycle des agents

**Ne pas** changer de réglages pour « sauver » ces six cas (surajustement). Garder `v11_daily_strict` comme comparateur, et conserver V1.1 original. Lancer une **nouvelle hypothèse prédéfinie**, testée séparément sans regarder le résultat pendant le réglage, telle que Momentum Fusion (ou Frank Test, pas les deux ensemble) comme confirmation de reprise, avec une chronologie sans repaint et les mêmes coûts base/stress. Étendre à d'autres périodes/marchés, imposer une taille minimale d'échantillon et valider prospectivement avant toute promotion. Contrôler séparément le retard de la nouvelle bougie 1H en direct.

Toute cette étude est **research only**, en branche `dev/ai-agents-phase1` : aucun ordre Bitunix, aucun déploiement, aucun changement de `main`, `dev/v1.26.0` ou du site public.
