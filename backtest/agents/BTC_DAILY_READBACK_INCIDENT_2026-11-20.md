# Diagnostic ciblé — incident Bitunix BTC Daily, 20 novembre 2026

## État vérifié avant l'incrément

- Branche exclusive `dev/ai-agents-phase1`, HEAD de départ `5fe19a9c3b14b8073b0cbe1ffe27fa562ed05a09`.
- CI de ce HEAD : [run 44707038032](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44707038032) **success**, **171/171 tests**, aucun échec.
- Dernier incrément : `MOMENTUM_VECTOR_NEXT_OPEN_AUDIT_2026-11-20.md`, entrée de transaction exclusivement à l'OPEN suivant. Aucun besoin de relancer son test.
- Ancien incident : [run 44652218692](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44652218692), échec sur BTC, tandis que HYPE et 1000PEPE sont passés. **Cet incident n'est pas effacé par une CI plus récente.**

## Nouvelle observation sur les preuves originales archivées

Artefact GitHub Actions **14591766187**, fichier `BTCUSDT-daily-two-reads.json`, téléchargé et inspecté en lecture seule pendant ce cycle.

La **première lecture** BTCUSDT `1d` de **365 chandelles fermées + 3 ancrages** a réussi : `status=DATA_READY_FOR_RESEARCH_ONLY`, `rawCount=368`, `closedBarsRequested=365`, fenêtre UTC **2025-11-20 00:00:00** à **2026-11-20 00:00:00** (borne de fin exclusive), `rawSha256=5440f3d77dd7bbfc682dc256138544fbc6d3dee38a43cc3574e22a407de3ab31`.

La **seconde lecture** demandait la **même fenêtre** et les **mêmes 365 chandelles + 3 ancrages**, mais a livré seulement **300 lignes brutes** : `status=BLOCKED`, `reason=OHLC_PROVENANCE_OR_CONTINUITY_FAILED`, `rawCount=300`, `rawSha256=6a8fcbd4a86c004ae0f85b45931cc853c6e0ece8bbccd2f4375645a3caaeb125`. Le contrôleur `compareBitunixReadbacks` a logiquement rendu `BLOCKED / ONE_OR_BOTH_SNAPSHOTS_NOT_VERIFIED`, avec **0 chandelle comparée**, et l'audit Daily a classé l'incident `DAILY_REPEATABILITY_FAILED`.

**Interprétation importante :** les preuves ne démontrent PAS que le prix d'une chandelle Daily fermée a été révisé. Elles montrent d'abord une **seconde capture incomplète de 300 lignes**, malgré la demande de 368. Le nombre 300 peut suggérer un comportement de pagination ou une limite de réponse de l'API, **mais la cause précise n'est pas établie** sans inspecter les requêtes paginées et leurs réponses. Ne pas renommer l'incident en « révision OHLC » ni le déclarer résolu.

## Décision fail-closed et prochain pas sûr

1. **Aucun changement au moteur ou aux signaux dans ce cycle.** Garder le BTC Daily bloqué pour ce run; HYPE/PEPE ne prouvent pas que BTC est sain.
2. Prochain incrément, seulement après vérification du nouveau HEAD/CI : examiner `fetchBitunixDataPilot` et le nombre de pages/lignes par réponse. Ajouter, si nécessaire, un test déterministe simulant **première lecture complète (368) puis seconde lecture tronquée (300)**, qui doit conserver le statut BLOQUÉ et les deux empreintes de provenance. Ne jamais remplir les 68 lignes manquantes par interpolation ou par la première capture.
3. Envisager ensuite un nouveau contrôle public de double lecture de la **même fenêtre ancrée**, avec pagination observée et provenance archivée. Une réussite ultérieure n'annule pas le blocage du 20 novembre.
4. Conserver séparément le protocole prospectif Momentum/Vector (début exclusif **2026-11-21T00:00:00Z**, 960 chandelles 1H, 30 jours/30 transactions avant verdict), la matrice d'ablations Momentum/SPEED/Vector et le retard live **~90 s non résolu**.
5. Les priorités 15m/1h/4h/1d et l'expansion prudente de 5 vers 15 puis 50 contrats restent ouvertes; aucune donnée Forex inventée, aucun gagnant choisi sur le holdout inspecté.

**Portée :** diagnostic d'artefact existant, pas de nouveau backtest ni de données fabriquées. Six rôles fonctionnels de contrôle/recherche/coordination, pas six agents de trading. Aucun changement de `main`, `dev/v1.26.0`, indicateurs originaux, site, Render, abonnements ou transactions.
