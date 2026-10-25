# Vector V1.3 — Protocole prospectif indépendant BTC SHORT 1H

**Préenregistré le 25 octobre 2026** après consultation des résultats historiques V1.3 du 25 octobre. **Début verrouillé des nouvelles observations : 27 octobre 2026 à 00:00 UTC (20 h le 26 octobre, heure du Québec).**

## Comparaison figée, sans optimisations

- Symbole **BTCUSDT**, timeframe **1H**, côté **SHORT** uniquement.
- Trois moteurs indépendants : **V1.1 originale**, **V1.2 `break_extreme_2`**, et **V1.3 `v13_ema50_slope`** (seule candidate exploratoire pré-choisie).
- La V1.3 prend les signaux **V1.2 confirmés après la clôture**, exige une pente EMA50 de trois chandelles orientée dans le sens du trade, le prix et l'EMA21 du bon côté de l'EMA50. Aucun alignement 4H obligatoire, aucune auto-sélection.
- Entrée **au prochain open** après la clôture du signal; stop **1,5 %**, objectif **3 %**, sortie max après **12 chandelles**, priorité au stop lors de deux niveaux touchés dans la même bougie; **0,06 % de commission par côté**.
- Trois scénarios de coûts (glissement simulé **0 / 0,05 / 0,10 % par côté**). Ces hypothèses ne sont pas des mesures des fills Bitunix.
- **35 jours de données précédant le début** exclusivement pour initialiser les indicateurs. Aucun signal initié avant le 27 octobre UTC ne peut ouvrir un trade compté dans la nouvelle observation.
- Pertes et gains par trade clôturé, win rate, signal count, trade count, meilleur/pire trade et trades censurés; **30 trades clôturés par moteur** requis pour une lecture exploratoire, mais ce seuil ne prouve ni fiabilité ni rentabilité.
- Chaque version et coût sont **simulés séparément**, avec positions non chevauchantes et sans capital composé. Les deltas ne comparent pas les mêmes transactions.
- Quarantaine des bougies Bitunix invalides, absentes ou dupliquées; aucune position ne traverse une fenêtre. Les trades incomplets ne comptent pas dans les rendements.
- Résultats **prospectifs à partir du 27 octobre seulement**. Aucune reconstruction ni optimisation de cette nouvelle période après observation.

## Protection des expériences existantes

- **Le suivi V1.2 du 26 octobre 2026 à 00:00 UTC reste inchangé.**
- Aucune modification au Pine Script ni à l'HTML CryptoJuju public. Aucun ordre, aucune API privée, aucune fusion vers `main`.
- Parité testée **CryptoJuju V1.1 frontend ↔ moteur de backtest**. La correspondance avec le **Pine Script TradingView original** reste une vérification indépendante nécessaire avant diffusion.
- Le workflow `.github/workflows/vector-v13-prospective.yml` s'exécute sur push ciblé dans `dev/v1.26.0`. **Il n'est pas automatiquement exécuté chaque jour** : GitHub Actions schedule require un workflow présent sur la branche par défaut, ce qui n'est pas autorisé ici.
- Chaque exécution produit `vector-v13-prospective.json` dans l'artefact `vector-v13-btc-short-ema50-forward`; version de commit et identifiant GitHub renseignés dans le rapport.
