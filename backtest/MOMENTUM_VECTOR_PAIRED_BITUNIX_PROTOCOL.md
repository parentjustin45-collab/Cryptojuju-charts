# CryptoJuju — Momentum Fusion + Vector : audit strict Bitunix

## But
Faire progresser CryptoJuju sans TradingView payant ni captures. Analyser les historiques Bitunix PUBLICS directement, avec Vector V1.1/V1.4 et Momentum Fusion V1.0 original. Ce diagnostic n'est pas un système de trades, ni une preuve de rentabilité, ni une validation de parité Pine.

## Protocole verrouillé avant les résultats
- Seuls BTCUSDT, ETHUSDT et SOLUSDT sur 1H et 4H.
- Historique strictement **avant le 28 octobre 2026 00:00 UTC**, début prospectif Vector. AUCUNE donnée ni sortie future post-départ utilisée.
- Fenêtres Bitunix OHLC valides, contiguës et non modifiées; segments de 180 bougies minimum, 168 bougies de préchauffage. Aucun raccordement artificiel.
- Comparaison sur chaque événement Vector V1.1/V1.4 confirmé. Sans filtre = événement original.
- Règle Momentum déterminée avant les résultats : accepter LONG si composite >50 et EMA21>EMA55; SHORT si composite <50 et EMA21<EMA55. Sinon rejeter; valeurs non disponibles sont séparées.
- Mêmes sorties et frais théoriques pour tous les candidats, y compris ceux refusés : entrée ouverture suivante, stop 1,5%, profit 3%, max 12 bougies, frais 0,06% par côté, glissement 0,05% par côté; stop-first, gaps à l'ouverture. Aucune sortie future inventée.
- Chaque événement est évalué indépendamment et les événements peuvent se chevaucher. PAS de portefeuille réaliste ou d'exécution d'ordres.
- Règle fixée sans optimiser les résultats historiques. Validation prospective indépendante indispensable avant de considérer un filtre meilleur.

## Exécution
Commande tests : node --test backtest/momentum-vector-paired-gate.test.mjs
Commande audit : node backtest/momentum-vector-paired-gate.mjs
Workflow GitHub : .github/workflows/momentum-vector-paired-historical.yml sur dev/v1.26.0 ; déclenchement sur changements ou manuellement. Archive JSON et résumé CSV.

Un workflow GitHub sur la branche dev avec workflow_dispatch n'est PAS une collecte programmée chaque 15 minutes. Ne rien ajouter à main sans autorisation. Aucun nouveau serveur payé. Aucune modification Render, Vector prospectif ou API de production.

## Interprétation
Comparer taux de filtrage, signaux gagnants rejetés et perdants conservés, effectifs, frais, trous de données. Les nombres restent rétrospectifs et ne prouvent ni précision future ni rentabilité. Aucun conseil d'investissement.
