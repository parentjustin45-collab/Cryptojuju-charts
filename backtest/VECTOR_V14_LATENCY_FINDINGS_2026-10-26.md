# Vector V1.4 — coût du retard, confirmation de même source ou réalignement ultérieur

**Audit réalisé le 26 octobre 2026 UTC, protocole d'étude exploratoire `vector-v14-confirmation-delay-vs-v11-on-same-closed-ohlc-v1`.** Résultat GitHub Actions [#40332761230](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40332761230) **réussi**; contrôle déterministe global [#40332708314](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40332708314) **réussi**.

Artefact GitHub `vector-v14-latency-costs-btc-eth-sol-90d` (JSON d'ensemble, chaque événement individuellement, groupes LONG/SHORT × moitié temporelle en JSON et CSV).

**Code recherché** : `backtest/vector-v14-confirmation-latency.mjs` et `.test.mjs`, `.github/workflows/vector-v14-confirmation-latency.yml`. **Aucun changement aux algorithmes V1.1/V1.4, à WATCH, à Render, à Bitunix, à `main` ou à un protocole prospectif déjà verrouillé.**

## Fenêtre et méthodologie

- Vraies chandelles publiques Bitunix Futures `LAST_PRICE` de **BTCUSDT, ETHUSDT, SOLUSDT 1H**, du **28 juillet 2026 à 13:00 UTC au 26 octobre 2026 à 13:00 UTC (exclu)**, séparation le **11 septembre à 13:00 UTC**.
- Dans chaque séquence d'au moins **55 bougies clôturées valides et continues**, les deux moteurs voient **exactement les mêmes OHLC**, et leurs 55 premières bougies servent à initialiser les indicateurs. Les trous, chandelles impossibles et doublons restent en quarantaine.
- Un événement de comparaison commence lorsqu'un **nouveau changement V1.1** est dans la direction opposée à un état V1.4 déjà établi. Il cesse lorsque la V1.4 se dirige enfin du même côté, lorsque la V1.1 revient sur sa décision, ou à la limite de l'échantillon/partition.
- **Décomposition essentielle de la convergence :** la V1.4 ne peut confirmer le **même candidat source** que pendant quelques bougies (paramètre `pendingBars = 3`). Une convergence 7, 29 ou 40 bougies plus tard **ne confirme pas le candidat original** : elle vient d'une **nouvelle chandelle source**. Le champ `sourceIndex` de V1.4 est recoupé précisément avec l'index initial V1.1.
- Pour les deux types de convergence, l'audit mesure le **changement de prix hypothétique** en faveur/défaveur de la direction envisagée entre `open` suivant le signal V1.1 et `open` suivant la confirmation V1.4. Une valeur positive = **prix d'entrée plus défavorable** si l'on entrait dans la nouvelle direction à ces instants; **ce n'est pas un trade**, ni une mesure de rendement après risque ou frais.
- Pour les signaux V1.1 abandonnés avant le retournement V1.4, un **aller-retour V1.1 purement hypothétique** est chiffré avec deux frais **0,06 % par côté**, glissement **0,05 % par côté**, depuis l'ouverture suivante de l'entrée à l'ouverture suivante de la sortie. **La V1.4 continue de détenir l'ancienne direction**, donc ces chiffres ne sont pas des économies de pertes nettes attribuables à V1.4.
- Aucune position traversant une limite de données ou la séparation chronologique n'est comptée comme gagnante; les épisodes sont censurés.

**IMPORTANT :** l'histoire 90 jours, la version V1.4, les événements choisis et la séparation 45/45 jours ont déjà été explorés. **Ceci n'est PAS un jeu inédit de validation prospective.**

## Résultats contrôlés — 90 jours, LONG + SHORT réunis

| Crypto 1H | Retournements V1.1 contre V1.4 | V1.4 confirme la même source | V1.4 se réaligne depuis une autre source | V1.1 abandonne avant le réalignement | Censurés |
|---|---:|---:|---:|---:|---:|
| **BTC** | **26** | 5 | 4 | 14 | 3 |
| **ETH** | **17** | 3 | 6 | 5 | 3 |
| **SOL** | **32** | 10 | 3 | 13 | 6 |

**Aucun marché / côté / moitié temporelle n'atteint 30 observations** — prudence sur toutes les médianes et proportions.

### Délais, prix et retournements abandonnés : rétrospective descriptive

| Marché | Confirmation de la même source : médiane délai | Écart d'entrée médian de cette confirmation | Alignement depuis une autre source : médiane délai | Écart d'entrée médian de cet alignement | Médiane net hypothétique des V1.1 vite abandonnés |
|---|---:|---:|---:|---:|---:|
| **BTC 1H** | 1 bougie | +0,383 % | 14 bougies | +1,899 % | -0,706 % |
| **ETH 1H** | 2 bougies | +0,725 % | **30 bougies** | **+3,105 %** | **-1,147 %** |
| **SOL 1H** | 2 bougies | +0,942 % | 10 bougies | +1,967 % | -0,952 % |

Le +3,105 % ETH est la **médiane de six différences de prix d'entrée directionnelles après plusieurs nouveaux candidats**. **Ne pas dire « la V1.4 a raté 3,1 % de profit »** : elle pouvait être en position dans l'autre sens; ce n'est pas une transaction ni un rendement net. Le -1,147 % ETH est la médiane **après frais et glissement** de cinq hypothèses V1.1 retournées, sans règle d'arrêt protecteur pendant la détention. Une analyse avec stop, sortie, liquidation, drawdown et exposition serait nécessaire avant d'en tirer une conclusion commerciale.

### Ce qui se passe sur ETH — trois exemples

- **23 août 2026 06:00 UTC :** LONG V1.1 avec V1.4 SHORT; la V1.4 rejoint LONG **29 chandelles plus tard depuis une nouvelle source**, écart de prix directionnel hypothétique **+4,361 %**.
- **11 septembre 2026 14:00 UTC :** SHORT V1.1 avec V1.4 LONG; la V1.4 rejoint SHORT **40 chandelles plus tard, depuis un nouveau candidat**, écart hypothétique **+3,637 %**. Ce n'est pas la confirmation de la chandelle initiale.
- **13 octobre 2026 01:00 UTC :** LONG V1.1 avec V1.4 SHORT; la V1.4 confirme la **même source** deux chandelles plus tard, écart de prix directionnel **+1,820 %**.

Ces trois cas ont été sélectionnés à partir de résultats historiques, et ne doivent pas inspirer une optimisation rétrospective.

## Répartition récente / ancienne

| Marché | Période | Événements | Même source confirmée | Nouvel alignement | V1.1 rétracté | Censurés |
|---|---|---:|---:|---:|---:|---:|
| BTC | ancienne | 11 | 2 | 1 | 6 | 2 |
| BTC | récente | 15 | 3 | 3 | 8 | 1 |
| ETH | ancienne | 6 | 1 | 2 | 1 | 2 |
| ETH | récente | 11 | 2 | 4 | 4 | 1 |
| SOL | ancienne | 16 | 6 | 0 | 7 | 3 |
| SOL | récente | 16 | 4 | 3 | 6 | 3 |

## Qualité des données

| Marché | Bougies attendues | Couverture valide | Bougies non retenues par les fenêtres admissibles | Fenêtres |
|---|---:|---:|---:|---:|
| BTC 1H | 2160 | 99,120 % | 272 | 13 |
| ETH 1H | 2160 | 98,565 % | 350 | 16 |
| SOL 1H | 2160 | 99,398 % | 13 | 14 |

## Décision pour la V1.26.0

**Ne pas modifier V1.4 ni fabriquer V1.6 à partir de cet échantillon.** Le diagnostic met en lumière le compromis : conserver les signaux de V1.1 plus tôt réduit le délai sur certains mouvements, mais ferait aussi accepter des retournements V1.1 ultérieurement abandonnés. Les groupes ETH (3 mêmes sources, 6 nouvelles sources, 5 rétractations, 3 censures) sont **trop peu nombreux** pour généraliser.

La prochaine hypothèse admissible, **à figer avant les nouvelles observations**, devrait évaluer séparément le délai des **confirmations de même source**, la fréquence des faux retournements et le résultat net d'un protocole de trades à frais, stop et slippage fixes, sans prétendre qu'un seul filtre ou un indicateur WATCH constitue une stratégie profitable. Mesurer sur données **réellement futures, inédites**, avec suivi des censures et de la qualité des bougies.

Le site expérimental `cryptojuju-watch-v126-test.onrender.com` ainsi que la branche `main` sont **inchangés** par cette analyse.
