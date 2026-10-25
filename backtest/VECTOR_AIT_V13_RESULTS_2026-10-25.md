# Vector V1.3 — résultat historique Bitunix 365 jours (25 octobre 2026)

**Statut :** recherche exploratoire uniquement, branche `dev/v1.26.0`. V1.1, V1.2, Pine et `main` restent inchangés. Aucune promotion automatique.

## Sources et paramètres

- [GitHub Actions : Vector V1.3 EMA regime 365d research](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40241684814) — workflow **réussi** après correction d'un test synthétique. Artefact `vector-v13-365day-regime-research` avec JSON complet et CSV de synthèse.
- Période historique : **25 octobre 2025 22:00 UTC à 25 octobre 2026 22:00 UTC**; partage des deux moitiés le **26 avril 2026 10:00 UTC**. Historique déjà exploité dans d'autres recherches, **pas de holdout neuf**.
- BTCUSDT, ETHUSDT, SOLUSDT, 1H, LONG et SHORT; données futures Bitunix lues en lecture seule via le proxy CryptoJuju.
- Trois filtres V1.3 comparés à la V1.1 originale et à la V1.2 `break_extreme_2`. Exit stop 1,5 %, take 3 %, 12 chandelles, commission 0,06 % par côté; glissement simulé 0 %, 0,05 % et 0,10 % par côté.
- Toutes les statistiques ci-dessous sont des **rendements nets moyens par trade clôturé**, frais et glissement déjà soustraits, **pas des rendements composés ni de portefeuille**.

## BTCUSDT SHORT 1H

Glissement de **0,05 % par côté**, sauf colonne dernière à **0,10 % par côté** :

| Variante | Trades moitié antérieure | Net moyen antérieur | Trades moitié récente | Net moyen récent | Net moyen récent avec glissement 0,10 % |
|---|---:|---:|---:|---:|---:|
| V1.1 originale | 106 | -0,230 % | 101 | -0,360 % | -0,457 % |
| V1.2 break_extreme_2 | 40 | -0,151 % | 46 | +0,028 % | -0,094 % |
| V1.3 pente EMA50 | 14 | +0,581 % | 9 | +0,192 % | +0,108 % |
| V1.3 alignement EMA21/34/50 | 12 | +0,529 % | 7 | +0,044 % | -0,034 % |
| V1.3 EMA alignées + 4H bearish | 9 | +1,025 % | 5 | +0,286 % | +0,206 % |

**Observation :** pente EMA50 paraît prometteuse sur BTC SHORT 1H, mais neuf trades récents ne permettent pas de conclure. La version EMA + 4H compte seulement cinq trades récents : le taux/rendement moyen est hautement instable.

## Généralisation à ETH/SOL et LONG

Les résultats ne se généralisent pas :
- ETH SHORT 1H, V1.3 pente EMA50 : **15 trades antérieurs / -0,242 %**, **11 récents / -0,555 %**.
- SOL SHORT 1H, V1.3 pente EMA50 : **12 trades antérieurs / -0,244 %**, **14 récents / +0,156 %**.
- BTC LONG 1H, V1.3 pente EMA50 : **6 trades antérieurs / -1,039 %**, **9 récents / -0,532 %**.
- Plusieurs sous-groupes ETH LONG récents semblent positifs, mais seulement 2 à 8 trades, et la moitié antérieure est perdante.

**Aucune des 18 combinaisons V1.3** (3 symboles × 2 côtés × 3 filtres) ne satisfait le seuil exploratoire de **30 trades clôturés dans chaque moitié**. Il serait erroné d'annoncer une amélioration robuste ou une probabilité fiable de réussite.

## Qualité et interprétation

- Couverture valide 1H : BTC **99,269 %**, ETH **99,132 %**, SOL **99,247 %**; respectivement **114**, **204**, **126** bougies exclues après quarantaine en tenant compte des segments exploitables.
- Les EMA se calculent uniquement sur bougies clôturées; le 4H utilisé est la **dernière bougie 4H terminée**, sans anticipation.
- Les positions ouvertes en fin de fenêtre ou à une coupure sont censurées, non créditées de profit.
- Ces 365 jours avaient déjà été consultés. Le bénéfice apparent BTC SHORT peut provenir du hasard, d'un régime de marché spécifique ou de la multiplication des variantes testées. Les performances après glissement restent simulées, non mesurées à l'exécution réelle.

## Décision et prochaines étapes

1. **Conserver la V1.1 et la V1.2 inchangées en production et en référence.**
2. **Conserver la V1.3 pente EMA50 en candidat de recherche BTC 1H SHORT seulement**, sans la présenter comme une amélioration validée.
3. Ne pas promouvoir les variantes EMA21/34/50 ou alignement 4H pour l'instant : elles réduisent excessivement l'échantillon.
4. Avant un usage réel : vérifier la **parité du portage Vector avec le Pine Script TradingView**, examiner les trades individualisés et figer une seule nouvelle hypothèse à vérifier prospectivement. Le suivi BTC 1H SHORT préenregistré pour le 26 octobre 2026 reste totalement indépendant et inchangé.
5. Éviter toute décision sur les seuls taux gagnants; surveiller profit net, fréquence, échantillons, drawdown, stabilité entre actifs/régimes et risque d'exécution.

**Ce rapport décrit ce que les calculs ont montré; une réussite GitHub signifie que le code fonctionne, pas que l'indicateur gagne de l'argent.**
