# CryptoJuju Vector — tableau de bord des résultats prospectifs

**Tableau de bord autonome, en lecture seule**, développement sur \`dev/v1.26.0\`. Ce travail ne change **ni les moteurs de backtest verrouillés, ni \`main\`, ni Render, ni les flèches ou positions Bitunix**.

## Tableau de bord sur Render TEST — sans import manuel

Le site de test indépendant `https://cryptojuju-watch-v126-test.onrender.com/vector-dashboard.html` propose maintenant le bouton **Actualiser Bitunix**. Cette page **recalcule la simulation dans le navigateur**, en utilisant les chandelles publiques Bitunix via le même proxy CryptoJuju utilisé par les graphiques. Aucune clé API ni ordre réel. Le protocole de recherche verrouillé est transposé pour le navigateur et sa somme de contrôle Git est validée pendant la construction; les modifications ne changent pas les règles V1.1/V1.4.

Lorsqu'elle reste ouverte et visible, la page tente une actualisation toutes les **15 minutes**. Si elle passe en arrière-plan ou si Android ferme l'onglet, les mises à jour sont suspendues; la réouverture relance un calcul. **Ce n'est pas un système autonome toutes les 15 minutes, ni une notification ChatGPT.** Les données Bitunix sont en 1H et peuvent ne pas changer entre deux rafraîchissements.

L'option d'**import JSON GitHub** reste disponible et le **fichier HTML hors ligne** reste utilisable sans réseau, mais demande toujours un fichier manuel. La version Render est publiquement accessible : ne jamais publier de clés privées ni de données personnelles dans les résultats.

L'accès Bitunix et son proxy restent dépendants du réseau, de CORS et du temps de réponse; si la lecture échoue, la page doit afficher l'erreur sans fabriquer de résultats. Le site principal `main` n'est pas concerné.

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

## Fiabilité des rafraîchissements (26 octobre 2026)

Avant d'accepter les résultats nouveaux, le tableau vérifie les **55 dernières chandelles 1H clôturées consécutives et cohérentes pour chacun de BTC/ETH/SOL**, sans accepter une duplication, un trou ou un dernier chandelier incohérent. Une quarantaine de données **anciennes** comme les 54 chandelles d'ETH peut rester admissible si les 55 dernières sont intactes; les données incomplètes **récentes** bloquent l'actualisation et le tableau conserve la dernière version horodatée. Le statut de fraîcheur correspond à la dernière heure entière clôturée, pas à une cotation en temps réel.

Le planificateur navigateur mémorise **la dernière tentative**, même lors d'un échec, afin de ne pas bombarder l'API; nouvelles tentatives automatiques seulement après 15 minutes et uniquement quand l'onglet est visible. Un onglet Android suspendu ne peut pas agir en arrière-plan. Les contrôles automatisés testent la limite des 15 minutes, les 55 clôtures, les duplications, les trous et les données historiques ETH mises en quarantaine.
