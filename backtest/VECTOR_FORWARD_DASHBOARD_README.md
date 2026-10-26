# CryptoJuju Vector — tableau de bord des résultats prospectifs

**Tableau de bord autonome, en lecture seule**, développement sur \`dev/v1.26.0\`. Ce travail ne change **ni les moteurs de backtest verrouillés, ni \`main\`, ni Render, ni les flèches ou positions Bitunix**.

## Mode d'emploi sur Samsung ou ordinateur

1. Dans GitHub Actions, ouvre un run réussi de **LOCKED Vector V1.1 vs V1.4 forward paper comparison**, puis télécharge l'artefact \`vector-forward-paper-v11-v14-bitunix\` pour obtenir \`vector-forward-paper.json\`.
2. Télécharge l'artefact du workflow **Vector Forward Dashboard (DEV)** et ouvre le fichier autonome \`vector-forward-dashboard.html\` dans ton navigateur Android ou ordinateur. Il contient tout le CSS/JavaScript nécessaire **dans un seul fichier**, sans serveur ni CDN.
3. Choisis \`vector-forward-paper.json\` via « Importer le rapport ». Rien n'est envoyé à un serveur. BTC/ETH/SOL × V1.1/V1.4 indiquent transactions clôturées, gagnantes, en attente, censurées, net moyen/médian **par trade**, progression vers **30 transactions clôturées par groupe**.
4. Filtre les transactions par crypto et exporte un CSV local. Un nouveau rapport doit être importé manuellement pour actualiser les résultats.

## Intégrité des données

- Départ prospectif **28 octobre 2026 00:00 UTC**. Fichiers à mauvais protocole, marchés manquants, date modifiée, trades antérieurs à la date de verrouillage ou P&L inventé sur positions incomplètes sont refusés.
- **Aucun gain n'est simulé ni ajouté dans ce tableau.** Il affiche exclusivement les nombres présents dans le rapport GitHub Actions déjà calculé.
- Les transactions sont des résultats théoriques en simulation (entrée à l'open suivant, stop 1,5 %, take 3 %, 12 h maximum, commission 0,06 % par côté, glissement 0,05 % par côté), et **pas un portefeuille composé**.
- Les données prospectives peuvent encore être révisées sur l'API source; toujours garder la date et la provenance du rapport.
- Aucune clé API Bitunix, aucun ordre et **aucun fetch réseau** dans le dashboard autonome.

## Récurrence 15 min

Les tâches automatisées ChatGPT n'autorisent **au maximum qu'un contrôle par heure**. Ce tableau ne prétend pas se mettre à jour toutes les 15 minutes : il affiche les données uniquement à l'import. Ne pas créer de service Render payant ni modifier \`main\` dans cette étape.

## Fichiers

- \`backtest/vector-forward-dashboard-data.mjs\` : validation stricte et agrégation, sans recalculer les trades.
- \`backtest/vector-forward-dashboard-ui.mjs\` et \`.html\` : interface responsive sombre, vert néon.
- \`scripts/build-vector-dashboard.mjs\` : construction d'un unique HTML autonome pouvant être ouvert depuis Android.
- \`backtest/vector-forward-dashboard-data.test.mjs\`, \`backtest/vector-forward-dashboard-build.test.mjs\` : tests no-lookahead, données vides, rapport incorrect, packaging offline.
- \`.github/workflows/vector-forward-dashboard.yml\` : tests, puis artefact sur dev, sans publication.
