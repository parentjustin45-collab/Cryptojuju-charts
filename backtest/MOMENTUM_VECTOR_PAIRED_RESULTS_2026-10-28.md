# Résultats — Momentum Fusion V1.0 comme filtre du Vector (audit Bitunix)

**28 octobre 2026, 15:01 UTC — GitHub Actions #40711682866 : SUCCÈS.**
Rapport brut et CSV : artifact `cj-momentum-vector-paired-pre-forward-bitunix` de cette exécution (id 12825952536).
Tests généraux indépendants : #40711682542 SUCCÈS.
Branche : `dev/v1.26.0`; source de l'audit : `84dc99f0821335730e213a081b0a6402bfaf7337`.

## Protocole et limites

Ce protocole a été **figé avant de lire les résultats**. Il utilise uniquement des chandelles historiques publiques Bitunix clôturées **avant le 28 octobre 2026 00:00 UTC**, donc hors de l'étude prospective Vector V1.1/V1.4 déjà en cours. Aucun ordre réel. Aucun réglage Vector modifié. Vérification de qualité OHLC stricte : une anomalie coupe le segment et force une nouvelle chauffe (minimum 180 bougies continues). Les signaux Vector et le composite Momentum sont disponibles au moment de la clôture de la bougie signal. Entrée au prochain open, stop 1,5 %, take 3 %, horizon 12 chandelles, frais 0,06 % par côté, glissement 0,05 % par côté, stop-first si ambigu.

**Règle testée seulement** : accepter LONG si Momentum Fusion composite >50 ET EMA21 > EMA55; SHORT si composite <50 ET EMA21 < EMA55. Les résultats rejetés par cette règle sont calculés séparément « ce qui se serait passé », à titre de diagnostic.

**Attention : chaque signal est simulé indépendamment**, des trades peuvent se chevaucher. Les pourcentages ne sont **pas** la performance d'un portefeuille et les trades censurés ne sont pas inclus dans le calcul des gains. La concordance numérique avec TradingView Pine n'a pas été vérifiée indépendamment.

## Ensemble des 6 marchés

| Version | TF | Signaux Vector | Candidats clôturés | Acceptés par Momentum (clôturés) | Acceptés gagnants | Moyenne nette d'un candidat clôturé | Moyenne nette d'un candidat accepté clôturé |
|---|---|---:|---:|---:|---:|---:|---:|
| V1.1 | 1H | 36 | 30 | 5 | 0 | -0,600 % | -1,669 % |
| V1.1 | 4H | 34 | 33 | 4 | 1 | -0,367 % | -0,545 % |
| V1.4 | 1H | 15 | 11 | 1 | 0 | -0,221 % | -1,668 % |
| V1.4 | 4H | 23 | 23 | 5 | 1 | -0,694 % | -1,068 % |
| **V1.1 total** | **1H + 4H** | **70** | **63** | **9** | **1** | **-0,478 %** | **-1,169 %** |
| **V1.4 total** | **1H + 4H** | **38** | **34** | **6** | **1** | **-0,541 %** | **-1,168 %** |

Statistiques calculées à partir des **candidats clôturés**. Le nombre de signaux et de candidats clôturés peut différer : absence de bougies suivantes ou horizon de sortie incomplet. Les chiffres moyens sont des **moyennes de rendements isolés**, non des rendements cumulés.

## Qualité par marché

| Marché | TF | OHLC reçues | OHLC signalées invalides | Bougies hors segments exploitables | Segments qualifiés |
|---|---|---:|---:|---:|---:|
| BTCUSDT | 1H | 1 836 | 16 | 1 097 | 4 |
| ETHUSDT | 1H | 2 016 | 27 | 1 798 | 1 |
| SOLUSDT | 1H | 2 016 | 12 | 882 | 5 |
| BTCUSDT | 4H | 672 | 2 | 235 | 1 |
| ETHUSDT | 4H | 672 | 3 | 263 | 1 |
| SOLUSDT | 4H | 672 | 2 | 6 | 2 |

Les 1 836 bougies reçues sur BTC 1H au lieu des 2 016 attendues sont un problème de couverture historique **à ne pas masquer**. Des fragments insuffisants ne sont jamais raccordés artificiellement. Les résultats ETH 1H sont extrêmement limités par les exclusions. Les taux sont sensibles aux biais d'échantillonnage et aux variations du feed.

## Conclusion limitée

**Ne pas intégrer ce filtre strict au Vector.** Il a rejeté la majorité des signaux et les rares candidats acceptés ont fréquemment perdu, avec un très petit échantillon. Cette observation ne signifie pas que Momentum Fusion est inutile : on l'a uniquement évalué comme **filtre instantané au moment du signal Vector**, pas comme détecteur d'essoufflement ou de divergence **cinq bougies après pivot**. Les divergences et séquences préalables peuvent rester des pistes pour **de nouveaux protocoles préenregistrés**, à valider prospectivement.

La vraie étude Vector V1.1/V1.4 demeure verrouillée et inchangée. Un workflow de développement déclenché par push ou manuellement n'est **pas** un système autonome d'actualisation toutes les quinze minutes. La passerelle TradingView Render existe mais aucune alerte TradingView vérifiée n'est nécessaire à ces résultats.

## Reproduction
- `backtest/momentum-vector-paired-gate.mjs` et `.test.mjs`
- `.github/workflows/momentum-vector-paired-historical.yml`
- [Actions #40711682866](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40711682866)
