# Atelier nocturne — 20 novembre 2026, 04 h (Québec)

## Contrôles avant modification

- HEAD de départ : `beac44c09f5f72ad5062dfe650463b0c817213ef` sur `dev/ai-agents-phase1`.
- Dernière CI : [44692112021](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44692112021) **success**.
- Protocole prospectif `MOMENTUM_VECTOR_PROSPECTIVE_PREREG_2026-11-19.md` consulté : le signal est confirmé à la clôture, exécution hypothétique à **l'OPEN suivant**, début exclusif le 21 novembre 2026 00:00 UTC, 960 bougies fermées et double lecture obligatoires.
- Incidents historiques non effacés : double lecture Daily BTC instable du run 44652218692 et retard live d'environ 90 secondes.
- Aucune raison de relancer le pilote historique Momentum/Vector déjà réussi : aucune donnée prospective n'est encore admissible avant le 21 novembre UTC.

## Incrément unique

Le validateur `momentum-vector-prospective-gate.mjs` acceptait auparavant une entrée décalée de plusieurs chandelles après sa confirmation (`confirmationTime+H>entryTime` ne contrôlait qu'un minimum). Cette ambiguïté pouvait attribuer un trade fictif tardif au signal original, malgré le préenregistrement strict **prochain OPEN**.

Correction prudente : `entryTime === confirmationTime + 1h`, sans toucher aux indicateurs, à leurs paramètres, aux coûts, ni aux résultats historiques. Test de régression dédié : entrée à l'OPEN immédiatement suivant acceptée, entrée retardée ou sur la bougie de signal refusée.

Le contrôle des 960 chandelles, des SHA, de la double lecture, des clôtures, du seuil prospectif et des minimums 30 jours/30 trades reste intact. Tests uniquement sur fixtures **synthétiques de validation**, aucune simulation de rentabilité.

## Reprise au cycle suivant

1. Vérifier le nouveau workflow `CJ research agents phase 1` : ne pas prétendre qu'il est vert tant qu'il ne l'est pas.
2. Examiner l'incident Daily BTC original à partir de son artefact et de sa chronologie, sans réécrire le signal ni relancer un test redondant.
3. Continuer les contrôles OHLC 15m/1h/4h/1d et les travaux de matrice d'ablations, **sans** utiliser les périodes historiques inspectées pour choisir un gagnant.
4. Aucun bilan prospectif avant la date de départ et les seuils préenregistrés.

Six rôles fonctionnels, pas six traders autonomes. Pas d'édition de `main` ou `dev/v1.26.0`, pas de déploiement, ordre, Render, coût ou promotion automatique.
