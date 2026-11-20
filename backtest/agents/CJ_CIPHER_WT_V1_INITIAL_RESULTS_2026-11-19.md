# CJ Cipher WT V1.0 — Premier pilote Bitunix (19 novembre 2026)

## Vérification effectuée

Le Pine Script v6 de l'utilisateur est conservé **sans changement de sa logique**
dans `backtest/agents/cj-cipher-wavetrend-v1-source.pine`.
Son premier port JavaScript de laboratoire est
`backtest/agents/cj-cipher-wavetrend-v1.mjs`.

Workflow GitHub Actions :
[DEV CJ Cipher WaveTrend V1 1H real Bitunix research](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44656240484)
— **SUCCESS**, tests ciblés **31/31**, **3/3** marchés passés,
première fenêtre de 960 chandelles 1H closes par marché.
CI générale de la même révision :
[145/145 tests](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44656240381).
Commit : `d63015c447cd1b32907e5d3395919521ef6554d6`.

Données : BTCUSDT, HYPEUSDT et 1000PEPEUSDT, Futures public
Bitunix LAST_PRICE. Double lecture des chandelles fermées,
contrôle strict des dates/OHLC et de leur répétabilité, copies de
source et SHA conservés dans
[artefact d'audit](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44656240484/artifacts/14592114957)
(jusqu'au 27 novembre 2026 environ).

## Ce qui a été comparé

Trois stratégies, sur LES MÊMES chandelles et le MÊME simulateur :

1. **Cipher original seul** : LONG quand WT1 croise WT2 vers le haut,
   SHORT quand WT1 croise WT2 vers le bas.
2. **Vector V1.1 seul** : signaux d'origine non modifiés, reproduits
   contre le pilote Vector existant.
3. **Vector + Cipher WT1/WT2** : accepte Vector LONG quand WT1>WT2,
   Vector SHORT quand WT1<WT2 au CLOSE du signal.
   Une inversion inverse refusée peut déclencher FLAT à l'OPEN suivant.
   Ces règles ont été fixées avant les résultats.

**Attention : le moteur de CE pilote est "reverse on next open, exit
on opposite signal / final close", allocation max 100 % du capital,
SANS stop ATR, take profit ni timeout.**
Il ne faut donc JAMAIS comparer ses pourcentages aux campagnes
Vector ATR1.5/2R de novembre, dont les sorties sont différentes.
Frais de base : 0,06 % et glissement 0,05 % par côté,
hypothèses stress supplémentaires archivées.

Découpage historique 70 % entraînement / 30 % validation rétrospective.
L'horizon de validation était déjà inspecté pendant le développement :
**pas de validation prospective indépendante.**

## Comptages sur 960 bougies 1H fermées (fenêtre complète)

| Contrat | Cross Cipher LONG | Cross Cipher SHORT | Vector candidats | Vector admis par WT1/WT2 |
|---|---:|---:|---:|---:|
| BTCUSDT | 73 | 73 | 56 | 33 |
| HYPEUSDT | 74 | 74 | 67 | 33 |
| 1000PEPEUSDT | 68 | 68 | 43 | 25 |

Les croisements Cipher de la fenêtre entière ne sont **pas** tous
des transactions du holdout ; le découpage et les positions déjà
ouvertes changent les nombres d'opérations.

## Résultats fictifs — 30 % historique, frais de base

| Contrat | Cipher seul | Vector V1.1 seul | Vector + Cipher |
|---|---:|---:|---:|
| BTC | −7,17 % (39 trades) | −6,42 % (17 trades) | +3,36 % (8 trades) |
| HYPE | −2,72 % (43 trades) | −12,60 % (23 trades) | −12,23 % (11 trades) |
| PEPE | −26,05 % (39 trades) | +30,35 % (14 trades) | −5,38 % (8 trades) |

Ne pas promouvoir une variante parce que BTC combinaison apparaît
positive : seulement 8 trades, et les deux autres marchés sont
négatifs. La baisse de PEPE sur Cipher seul et la grande dispersion
montrent l'importance d'ajouter une gestion des sorties et des coûts.
Le filtre semble rejeter beaucoup de signaux, pouvant supprimer de
bonnes entrées comme de mauvaises. Ces résultats ne prouvent ni
l'efficacité ni l'inefficacité future de Cipher.

## Travaux prioritaires après ce premier port

1. **Vérifier numériquement** WT1, WT2, croisements et dates sur des
   chandelles exactement identiques dans TradingView/Pine et dans
   CryptoJuju. Les tests JS déterministes ne prouvent pas la parité Pine.
   `confirmClose=false` intrabar n'est PAS reconstituable depuis OHLC
   et n'a pas été simulé.
2. Mettre Cipher seul, Vector seul et Vector+Cipher sur un
   **même moteur de risque ATR** (stop, objectif, durée et frais stress).
   Séparer exploration ancienne et nouveaux résultats prospectifs.
3. Étudier SPEED V3 + Cipher puis SPEED + Cipher + Frank Test
   seulement quand les ports et leur synchronisation causale sont
   validés. Comparer contre chaque indicateur seul.
4. Ne pas modifier les paramètres Cipher d'après ces mêmes
   résultats : conserver la V1.0 et créer toute future V1.1
   expérimentale séparément, enregistrement préalable des règles.

Aucune modification du site public, de `main` ou de
`dev/v1.26.0`. Aucun ordre, aucun abonnement, aucun déploiement.
