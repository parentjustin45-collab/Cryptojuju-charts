# Vector V1.1 vs V1.4 — suivi prospectif armé et vérifié (26 octobre 2026)

**Statut : `ARMED_NOT_STARTED`.** Signal éligible uniquement depuis le **28 octobre 2026 00:00 UTC**. Aucun résultat prospectif simulé n'a été créé sur des chandelles antérieures.

## Développement / configuration vérifiée

- Code prospectif figé : **`744da2b93772f3c5dfdb8876ffcc5784058819d9`**.
- Le workflow `.github/workflows/vector-forward-v11-v14.yml` sur `dev/v1.26.0` exécute explicitement `actions/checkout@v4` avec `ref` fixé à cet **exact commit**, afin qu'une évolution ultérieure de `dev` ne change pas la stratégie, le simulateur ou les hypothèses.
- [Workflow GitHub Actions, run **#40358145063**](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40358145063) **réussi**, relancé pour vérifier la répétabilité : tentative 2, **réussie**. Le protocole a également réussi la suite complète de tests hors ligne.
- Fichiers `backtest/vector-forward-v11-v14.mjs`, `backtest/vector-forward-v11-v14.test.mjs` et [protocole](VECTOR_FORWARD_PAPER_LOCK_2026-10-26.md).
- Site WATCH expérimental Render et site principal GitHub Pages **inchangés**, pas de nouvelle version d'indicateur et aucun ordre réel.

## Préflight Bitunix avant le départ

Artefact `vector-forward-paper-v11-v14-bitunix` attaché au workflow; instantané du **26 octobre 2026 à 16:18:23 UTC**.

| Symbole 1H | État | Bougies attendues pour le préflight | Bougies reçues | Bougies exclues de l'échantillon utilisable | Transactions post-départ |
|---|---|---:|---:|---:|---:|
| BTCUSDT | Prêt | 136 | 136 | 0 | **0** |
| ETHUSDT | Prêt avec quarantaine historique | 136 | 136 | 54 | **0** |
| SOLUSDT | Prêt | 136 | 136 | 0 | **0** |

Les 54 bougies ETH exclues correspondent à la segmentation prudente de données Bitunix historiques : l'audit **ne les répare pas** et utilise uniquement la dernière fenêtre continue admissible. Aucun trade n'est généré avant la barrière prospective.

## Variables de comparaison fixées

Deux comptes papier entièrement indépendants **V1.1 et V1.4**, un seul LONG ou SHORT à la fois dans chaque compte. Chandelles Bitunix 1H clôturées et identiques, entrée à l'ouverture de la bougie suivante, **SL 1,5 % / TP 3 % / horizon maximal 12 bougies**, frais **0,06 % de chaque côté**, glissement **0,05 % de chaque côté**, stop d'abord si les deux seuils sont atteints dans une bougie. Les trous et positions encore ouvertes sont **censurés/en attente**, jamais comptés comme P&L réalisé. Les 168 bougies initiales ne comptent que pour la chauffe.

Le seuil de **30 trades terminés par version et crypto** est un minimum indicatif pour regarder les statistiques, **pas une preuve de profitabilité**. Aucun réglage ne sera choisi en fonction des premières observations.

## Exécution récurrente sans frais Render supplémentaires

Render n'offre **pas de cron en plan gratuit** (demande explicitement rejetée avec `plan=free`). **Aucun cron payant n'a été créé.**

Une tâche récurrente ChatGPT a été créée et activée, **à partir du 28 octobre 2026, approximativement 8 h (America/Toronto), chaque jour**. Elle cherchera à **relancer le job GitHub réussi sur le même commit figé**, analysera l'état et les artefacts si accessibles, et ne préviendra l'utilisateur qu'en cas de panne, de problème de données ou lorsque les deux versions atteindront le seuil d'échantillon sur un marché. La permission `rerun_workflow_job` a été **testée avec succès manuellement sur le run #40358145063**. Cette tâche dépend néanmoins de la disponibilité des outils GitHub dans ses futures exécutions; aucun résultat futur n'est promis ni anticipé.

> **Important :** GitHub Actions `schedule` agit sur la branche par défaut; nous n'avons ajouté aucune modification à `main`. La tâche ChatGPT constitue le déclencheur futur choisi. Il faut vérifier les nouvelles tentatives réelles GitHub après le début : le fait qu'une tâche soit programmée ne prouve pas à l'avance que les jobs futurs réussiront.

## Règles de décision

- Aucune transaction réelle Bitunix, aucune API privée, aucune publication sur `main`, aucune modification du service Render actuel.
- Rapporter le **nombre de transactions terminées, les censures, frais/slippage et les net/trade** séparément par actif/version.
- Ne pas mélanger les résultats aux périodes historiques inspectées; ne pas citer de P&L prospectif avant observations réellement clôturées.
- Aucune promotion automatique de V1.4 ou de la future V1.6.
