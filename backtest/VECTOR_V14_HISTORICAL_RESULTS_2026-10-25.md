# Résultats — Vector AIT V1.4 expérimental : structure et maintien de tendance

**Rapport vérifié GitHub Actions** : [exécution 40250789296](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40250789296), réussite au commit `0ca030c2658af4e97966a2b659bfd7c0ebdcbacd`. Artefact exact `vector-v14-structure-180day-exploratory` : `vector-v14-history.json`, `vector-v14-summary.json`, `vector-v14-summary.csv`.

## Verrouillage et période

- Recherche historique **2026-04-29 à 2026-10-26 00:00 UTC** (180 jours), divisée le **28 juillet 2026 00:00 UTC**.
- BTCUSDT, ETHUSDT, SOLUSDT en 1H, OHLC Bitunix lus en lecture seule via CryptoJuju. **Historiques déjà explorés** et captures choisies rétrospectivement : **aucune période out-of-sample neuve**.
- 4 variantes indépendantes : `baseline_v11`, `break_extreme_2` V1.2, `v13_ema50_slope`, `v14_hysteresis_structure_momentum_v1`.
- 1) Backtest à sorties fixes : **SL 1,5 % / TP 3 % / 12 bougies**, entrée au prochain open, **0,06 % de frais par côté**, **0,05 % de glissement par côté** (stress 0,10 %). 2) Étude distincte **maintien de tendance jusqu'au signal inverse**, entrée/sortie au prochain open, **sans stop protecteur**; ce deuxième modèle n'est pas prêt pour la production et peut perdre fortement.
- Chiffres ci-dessous : **rendement net moyen par trade clôturé**, pas une performance totale de portefeuille.

## BTC 1H — trades SHORT, dernière moitié chronologique

| Mode | Trades clôturés | Net moyen/trade, frais et glissement inclus | Net moyen sous stress renforcé |
|---|---:|---:|---:|
| V1.1 | 42 | -0,172 % | -0,262 % |
| V1.2 break_extreme_2 | 21 | **+0,100 %** | +0,008 % |
| V1.3 EMA50 | 2 | -0,526 % | -0,627 % |
| V1.4 structure / maintien | 27 | -0,066 % | -0,159 % |

En première moitié, la V1.4 SHORT affichait **33 trades / -0,670 % net moyen/trade**, contre 21 trades / -0,017 % pour la V1.2. La V1.4 ne domine donc **pas** la V1.2 dans cette simulation. Sur la moitié récente elle reste négative et n'atteint pas 30 trades clôturés. Une comparaison par trade ne mesure pas non plus la différence de turnover ou d'exposition.

## Généralisation ETH/SOL SHORT

| Marché 1H | V1.4 trades récents | V1.4 net moyen/trade récent | V1.2 net moyen/trade récent |
|---|---:|---:|---:|
| ETH | 24 | -0,097 % | -0,013 % |
| SOL | 30 | -0,037 % | +0,151 % |

Les résultats sont **insuffisants pour promouvoir** la V1.4 sur ces marchés.

## L'objectif « tenir un SHORT puis passer LONG »

Le diagnostic indépendant de positions **sans stop** montre que réduire les changements de direction n'assure pas une meilleure capture des tendances. Sur BTC, dans la moitié récente :
- V1.1 : 91 épisodes clôturés, +0,020 % par épisode en moyenne;
- V1.2 : 35 épisodes, +0,534 %;
- V1.4 : 49 épisodes, **-0,132 %**, avec excursion défavorable observée jusqu'à **-4,141 %** parmi les épisodes clôturés.

**Attention :** les épisodes restés ouverts / censurés à la frontière d'un historique ou d'un gap ne sont pas crédités dans cette moyenne; ces résultats ne sont pas une estimation de performance totale sur capital et sous-estiment potentiellement le risque.

## Audit ciblé des signaux illustrés par l'utilisateur

Sur les signaux retrouvés dans les **chandelles Bitunix 1H** (UTC) :
- Baseline V1.1 : LONG **12 octobre 13:00 UTC**, SHORT **12 octobre 14:00 UTC**;
- V1.4 : **aucun signal accepté à ces deux timestamps**, car la nouvelle machine conserve sa direction si la structure n'est pas confirmée;
- Baseline V1.1 et V1.4 : SHORT **14 octobre 08:00 UTC**.

C'est un **cas précis d'un aller-retour écarté**, sans prouver que les chandelles correspondent exactement aux flèches photographiées : timezone TradingView non confirmée, crosshair non disponible, captures qualitatives, fenêtres Bitunix partielles. Le SHORT V1.4 du 14 octobre est noté `initial` parce qu'une **nouvelle fenêtre de données propres** démarre : ce n'est pas une démonstration de continuité parfaite de maintien de position à travers des données manquantes.

Un filtre qui supprime le faux LONG peut aussi manquer le **bon LONG de retournement ultérieur**. Il faudra vérifier par export daté, et mesurer le mouvement raté, avant d'affirmer que cette logique réalise exactement le but demandé.

## Qualité Bitunix et restrictions

| Marché | Couverture OHLC valide | Chandelles exclues des fenêtres utilisables |
|---|---:|---:|
| BTC 1H | 99,236 % | 312 |
| ETH 1H | 98,866 % | 551 |
| SOL 1H | 99,306 % | 202 |

Les données ont été soumises à la quarantaine stricte, les indicateurs sont réinitialisés par fenêtre continue et les trades traversant des gaps sont exclus. Les chiffres ne doivent **pas** être projetés sur des trades live.

## Décision

**V1.4 : laboratoire uniquement. Pas de promotion.** La réduction de certains flips est démontrable, mais la rentabilité et la généralisation ne le sont pas. Conserver V1.1, V1.2 et V1.3 comme références intactes, sans affecter les deux expériences prospectives déjà verrouillées (V1.2 26 octobre, V1.3 27 octobre). Prochaine étape utile : audit manuel **de l'entrée et de la sortie exacte sur plusieurs exemples**, des faux flips rejetés **et des bons retournements manqués**, avant de préenregistrer une autre règle à vérifier sur une période future.

**Aucune modification au site public, au Pine Script, aux fonds Bitunix ni à `main`.**
