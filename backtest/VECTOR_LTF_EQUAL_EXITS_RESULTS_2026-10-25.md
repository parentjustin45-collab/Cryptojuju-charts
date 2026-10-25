# Vector BTC SHORT 15M / 30M / 1H — résultats historiques du 25 octobre 2026

**Recherche uniquement, branche `dev/v1.26.0`.** Aucun changement aux indicateurs de production ou au protocole prospectif BTC 1H SHORT commençant le 26 octobre 2026 00:00 UTC.

## Provenance

- GitHub Actions : [Vector comparable 12h exits](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40238348884).
- Artefact officiel du job : `vector-ltf-equal-exits-90d` (contient `vector-ltf-equal-exits.json`).
- Période de données demandée : **2026-07-27 22:00 UTC — 2026-10-25 22:00 UTC**, soit 90 jours; partage chronologique à **2026-09-10 22:00 UTC**. Les données sont issues des chandelles historiques Bitunix via le proxy CryptoJuju.
- Stop **1,5 %**, cible **3 %**, durée maximale **12 heures de marché** pour tous (15M : 48 chandelles; 30M : 24; 1H : 12), commission **0,06 % par côté**.
- Le tableau principal applique un glissement simulé **commun de 0,05 % par côté**. Les scénarios plus sévères sont séparés dans le rapport complet.

## Comparaison non filtrée — SHORT, glissement commun 0,05 %

| Timeframe | Signal | Trades clôturés moitié antérieure | Rendement net moyen/trade antérieur | Trades clôturés moitié récente | Taux gagnant récent | Rendement net moyen/trade récent |
|---|---|---:|---:|---:|---:|---:|
| 15M | V1.1 | 42 | -0,371 % | 31 | 41,9 % | -0,136 % |
| 15M | V1.2 break_extreme_2 | 31 | -0,444 % | 23 | 26,1 % | -0,552 % |
| 30M | V1.1 | 36 | -0,252 % | 35 | 31,4 % | -0,410 % |
| 30M | V1.2 break_extreme_2 | 18 | -0,444 % | 22 | 36,4 % | -0,392 % |
| 1H | V1.1 | 22 | -0,289 % | 23 | 39,1 % | -0,134 % |
| 1H | V1.2 break_extreme_2 | 14 | -0,221 % | 9 | 66,7 % | +0,447 % |

Les performances ci-dessus ne sont **pas** des rendements de portefeuille : il s'agit de moyennes par transaction clôturée. Des trades censurés ne sont pas inclus dans les rendements. Le glissement peut changer le nombre et l'ordre des transactions fermées.

## Filtre indépendant 4H bearish — SHORT, glissement commun 0,05 %

| Timeframe | Signal | Trades moitié antérieure | Net moyen antérieur | Trades moitié récente | Net moyen récent |
|---|---|---:|---:|---:|---:|
| 15M | V1.1 | 14 | -0,309 % | 18 | -0,290 % |
| 15M | V1.2 | 10 | -0,342 % | 15 | -0,948 % |
| 30M | V1.1 | 14 | -0,397 % | 20 | -0,666 % |
| 30M | V1.2 | 8 | -0,459 % | 15 | -0,649 % |
| 1H | V1.1 | 10 | -0,220 % | 10 | -0,216 % |
| 1H | V1.2 | 5 | +0,038 % | 5 | +0,413 % |

Ce filtre était simulé comme une **stratégie distincte**, pas simplement un tri après l'exécution : sa gestion des positions non chevauchantes est indépendante. En particulier, sur la moitié récente du BTC 1H SHORT V1.2, le 4H bearish **ne dépasse pas** l'absence de filtre sur le rendement moyen (+0,413 % pour cinq trades contre +0,447 % pour neuf trades). Aucune conclusion de supériorité du filtre 4H n'est donc justifiée.

## Glissement renforcé (par côté)

- 15M : 0,10 %. V1.2 non filtré moitié récente : **24 trades**, **-0,683 %** en moyenne.
- 30M : 0,075 %. V1.2 non filtré moitié récente : **22 trades**, **-0,437 %** en moyenne.
- 1H : 0,05 %. V1.2 non filtré moitié récente : **9 trades**, **+0,447 %** en moyenne.

Ces hypothèses de glissement ne constituent **pas** des mesures de liquidité ou d'exécution réelles.

## Qualité des historiques

| Timeframe | Couverture des chandelles reçues valides | Bougies exclues du backtest par quarantaine |
|---|---:|---:|
| 15M | 98,692 % | 347 |
| 30M | 98,819 % | 136 |
| 1H | 99,120 % | 32 |
| 4H | 99,815 % | 1 |

Les petites périodes ont davantage de fenêtres coupées et de censures. Cela peut produire un biais de sélection; ne pas généraliser.

## Décision de recherche

1. **Ne pas promouvoir** d'entrée 15M ou 30M SHORT V1.2 à ce stade; les tests historiques restent négatifs dans les deux moitiés après frais et glissement commun.
2. **Continuer l'observation prospective BTC 1H SHORT V1.2**, car l'échantillon récent positif ne compte que neuf transactions; la moitié antérieure est négative. Ce résultat n'est pas une validation indépendante.
3. **Garder le 4H descriptif**, sans le rendre obligatoire. Son avantage n'est pas démontré dans le présent test à taille d'échantillon limitée.
4. Aucune optimisation rétroactive ni fusion vers `main`. Avant promotion : données prospectives inédites, nombres de trades suffisants, parité avec Pine Script TradingView et analyse du coût d'exécution.

**Note méthodologique** : les chandelles de ces 90 jours ont déjà alimenté plusieurs études CryptoJuju; le sous-échantillon « récent » n'est donc pas un holdout totalement vierge. Le workflow vert valide l'exécution du code, non la rentabilité de la stratégie.
