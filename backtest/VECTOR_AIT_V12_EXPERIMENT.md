# Vector Always-In-Trade — expérimentation V1.2 (branche dev)

## Statut
Recherche seulement. Le Pine Script **Vector Always-In-Trade V1.1** et le site CryptoJuju Charts de production ne sont pas modifiés. La V1.2 n'est **pas validée** et ne doit pas être présentée comme plus rentable avant validation indépendante.

## Hypothèse examinée
Le seuil `minimumConfirmations=4` du script Pine V1.1 pourrait être trop permissif ou trop restrictif. Comparaison contrôlée, en changeant ce seuil **seul** :

- Seuil 3 : candidat plus réactif, avec risque de faux signaux.
- Seuil 4 : **référence V1.1 inchangée**.
- Seuil 5 : candidat plus sélectif, avec risque de retard.

Tous les autres réglages Vector V1.1 sont identiques.

## Méthode
- BTCUSDT, ETHUSDT, SOLUSDT ; 15m, 30m, 1h, 4h ; jusqu'à 365 jours de données Bitunix.
- Rejeter les chandelles invalides et discontinuités sans inventer de données ; réinitialiser le calcul au début de chaque segment sain.
- Signaux uniquement sur bougies historiques clôturées ; entrée au **prochain open**.
- Sortie **identique** pour les trois candidats : stop 1,5 %, take profit 3 %, maximum 12 chandelles. Le moteur simule un stop prioritaire si stop et TP sont touchés sur la même bougie.
- Commission de 0,06 % par côté, puis sensibilité à un glissement de 0,05 % par côté.
- LONG et SHORT analysés séparément ; sélection du seuil par rendement net moyen **sur la moitié chronologique d'entraînement uniquement** ; validation ultérieure sans nouvelle optimisation.
- Au moins 30 transactions clôturées d'entraînement et 30 de validation avant d'interpréter une configuration.
- Mesures secondaires : nombre de transactions, taux gagnant, revirements opposés dans un délai de trois chandelles, fenêtres exclues et transactions censurées aux limites des segments/séparations.

## Critère de décision (préliminaire, non suffisant à lui seul)
Une variante autre que 4 doit :
1. avoir assez de transactions sur l'entraînement et sur la validation ;
2. battre la référence 4 en validation sur la **même** crypto, timeframe, direction et méthode de sortie ;
3. afficher un résultat net moyen positif **avec glissement** ;
4. résister à une revue des trous de données et de la corrélation entre transactions.

**Aucune promotion automatique.** Même après ces conditions, l'avantage doit être testé sur une période indépendante ou prospective et la parité avec les signaux TradingView doit être contrôlée.

## Fichiers
- `backtest/vector-ait-v1.mjs` : portage du Vector V1.1 et valeurs de référence.
- `backtest/vector-confirmation-study.mjs` : comparaison expérimentale 3 / 4 / 5.
- `backtest/vector-confirmation-study.test.mjs` : tests de causalité, sélection et qualité des données.
- `backtest/vector-confirmation-report.mjs` : rapport CSV/JSON dans l'artefact GitHub Actions.

Les rendements publiés sont des moyennes par transaction clôturée, **pas** des rendements de portefeuille annualisés ni composés.
