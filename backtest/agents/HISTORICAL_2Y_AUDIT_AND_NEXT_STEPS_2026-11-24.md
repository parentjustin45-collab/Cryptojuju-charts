# CryptoJuju — Audit des archives historiques et préparation du rattrapage 2 ans
Date: 2026-11-24 UTC | Branche: dev/ai-agents-phase1 | **Aucune modification à main ni aux cycles Render**

## Archives récupérées et revérifiées localement
- 13 artefacts GitHub Actions; 491 références, 408 contenus SHA256 uniques; les 408 contenus ont été relus et revérifiés
- 78 objets contenant acceptedCandles, dont 77 DATA_READY_FOR_RESEARCH_ONLY et 1 BLOCKED
- Période cible fermée en UTC: 2024-11-24 00:00 à 2026-11-24 00:00, pour BTC/ETH/SOL/HYPE/1000PEPE × 15m/30m/1h/4h/1d
- 638 750 barres théoriques; **21 313 barres validées distinctes retrouvées dans ces 13 ZIP**; 16/25 couples représentés; aucun conflit OHLC observé aux mêmes ouvertures UTC
- Les 13 ZIP ne contiennent aucune série de chandelles 30m et aucune 1d en dehors de BTC. **Cela ne mesure PAS tout PostgreSQL**: les nouveaux cycles Render 5×5 n'apparaissent pas dans ces archives récupérées.
- Les archives incluent aussi des études dérivées et des simulations; une étiquette « 2 ans » n'est pas la preuve d'une série OHLC continue de 2 ans

## Vérification historique Bitunix réelle et limitée
GitHub Actions run: https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/45505801852

Tests unitaires du planificateur, bornes historiques et preuve de l'heure réelle d'extraction: **18 réussis, 0 échec**.
Double lecture des 480 premières bougies historiques cibles:
- BTCUSDT 15m : STABLE_TWO_READS, 480/480, commencé 2024-11-24
- BTCUSDT 30m : STABLE_TWO_READS, 480/480, commencé 2024-11-24
- BTCUSDT 1d : STABLE_TWO_READS, 480/480, commencé 2024-11-24
- 1000PEPEUSDT 1h : STABLE_TWO_READS, 480/480, commencé 2024-11-24
- HYPEUSDT 1h : BLOQUÉ (OHLC_PROVENANCE_OR_CONTINUITY_FAILED) sur cette période; **ne pas conclure** que 2 ans sont disponibles ni inventer les chandelles manquantes
Ces tests ponctuels ne couvrent pas les périodes intermédiaires, ne mesurent pas la disponibilité de chaque contrat et ne prouvent pas la parité TradingView.

## Modules ajoutés (branche dev uniquement)
- `backtest/agents/historical-backfill-plan.mjs`: planificateur pur, fenêtres manquantes jusqu'à 480 bougies, signalement des petits trous 1–3 bougies, pas d'insertion automatique
- `backtest/agents/historical-backfill-plan.test.mjs`: validation des 25 couples, absence de chevauchements/duplications et de futur
- `backtest/agents/bitunix-data-pilot.mjs`: option `historicalEndExclusiveMs` pour une vraie fenêtre ancienne **sans falsifier** `fetchedAtUtc`
- `backtest/agents/run-historical-backfill-probe.mjs`: test limité en lecture seule
- `.github/workflows/ai-agents-historical-backfill-probe.yml`: test vérifiable, artefact temporaire GitHub

## Prochaines étapes — non encore achevées
1. Lire **en lecture seule** les références des anciens tests + archives horaires réelles dans PostgreSQL et identifier les barres uniques `(symbol,timeframe,utc_open)`.
2. Créer l'importeur historisé et idempotent avec clé de barre, empreinte SHA256, provenance des corrections et contrôle des conflits, sans mélanger les tests et les données.
3. Faire un pilote d'import, relire et revérifier la base; dimensionner l'espace disque Render 1 Go et le débit Bitunix avant tout backfill massif.
4. Télécharger **uniquement** les fenêtres historiquement manquantes, avec reprise après échec et absence de fausse interpolation.
5. Rejouer Vector/Momentum/SPEED/Cipher sur séries continues, avec warm-up causal, périodes d'entraînement/validation hors échantillon et comparaison aux versions de référence.

**Interdictions actuelles:** pas d'ordres, pas d'activation d'un backfill massif, pas de modification main, pas de purge des anciennes archives, pas de surcoût Render sans accord.
