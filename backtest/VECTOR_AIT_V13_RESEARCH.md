# Vector Always-In-Trade V1.3 — laboratoire de tendance (EMA) et contexte 4H

## Statut et limites

**Expérience uniquement dans `dev/v1.26.0` — aucune modification aux scripts V1.1/V1.2 originaux, au Pine Script ou au site public, ni aucun ordre Bitunix.**

Le bilan historique 15M/30M/1H montrait des rendements nets moyens négatifs pour plusieurs variantes; la V1.2 SHORT BTC 1H n'a donné qu'un échantillon récent de 9 trades. Le but de la V1.3 n'est **pas d'augmenter artificiellement les pourcentages gagnants** par optimisation rétroactive, mais d'étudier les mauvais signaux liés à une tendance mal alignée.

### Variantes de recherche, déclarées avant les résultats

Les signaux sous-jacents demeurent les signaux V1.1 ou les confirmations de cassure V1.2 `break_extreme_2` sur chandelles complètement clôturées, puis entrées simulées au **prochain open**.

- `baseline_v11` : V1.1 originale, sans filtre.
- `break_extreme_2` : V1.2 originale, sans filtre.
- `v13_ema50_slope` : V1.2 + pente EMA50 sur 3 chandelles du bon signe, prix de clôture et EMA21 du bon côté de l'EMA50 (symétrique LONG/SHORT).
- `v13_ema_stack` : précédent + EMA21/EMA34/EMA50 strictement ordonnées et clôture du bon côté de l'EMA21.
- `v13_ema_stack_4h` : précédent + direction Vector du **dernier 4H entièrement clôturé**, alignée avec le trade. Les contextes absents sont refusés, jamais remplacés par une valeur périmée.

**Les EMA ne sont PAS ajoutées à la V1.1 ni à la V1.2 d'origine**. Les statistiques de rejet sont auditées. Aucun prétendu score de probabilité n'est inventé.

### Backtest historique comparatif

- BTCUSDT / ETHUSDT / SOLUSDT, timeframe d'entrée **1H**, et contexte Bitunix 4H; jusqu'à **365 jours** de données historiques.
- LONG et SHORT évalués **séparément**, avec la même sortie simulée : stop **1,5 %**, take **3 %**, durée maximale **12 bougies 1H**; stop exécuté prioritairement si TP et SL sont tous les deux touchés dans la même bougie.
- Frais **0,06 % par côté**, plus glissement **0 %**, **0,05 %** et **0,10 % par côté** (sensibilité).
- Le moteur simule des positions non chevauchantes indépendamment pour chaque mode, côté, symbole et scénario de frais. Les résultats peuvent être distincts entre modes parce que refuser un trade change les opportunités suivantes.
- Split chronologique en deux moitiés **exploratoires**; exclusion des positions ouvertes à la coupure, des fenêtres invalides et des trades impossibles à clôturer sans traverser les trous de données. Pas de capital fictivement composé d'une fenêtre à l'autre.
- Seuil indicatif **30 trades clôturés par moitié**. Un résultat en dessous de ce seuil est marqué `TOO_FEW_TRADES`. Ce seuil ne garantit **aucune significativité**.
- Statistiques : fréquence des trades, win rate, rendement net moyen par trade, positions censurées, rejets, taux de couverture, performances après glissement.

**AVERTISSEMENT SUR LE BIAIS HISTORIQUE :** les 365 jours ont déjà servi à des expérimentations antérieures CryptoJuju. Même la seconde moitié **n'est pas un véritable holdout vierge**. Ces chiffres servent à détecter les échecs évidents et la fragilité, pas à déclarer une stratégie gagnante. Trois filtres sont comparés; examiner plusieurs variantes peut exagérer les meilleurs résultats apparents.

### Prochain seuil avant diffusion

1. Vérifier **parité exacte** des signaux avec le Pine Script TradingView (pas encore démontrée).
2. Éviter de promouvoir toute variante qui perd après glissement, manque de trades ou n'est profitable que sur un actif/période.
3. Préenregistrer **une seule** variante candidate sur de **nouvelles données prospectives**, garder V1.1/V1.2 comme contrôles, puis comparer les résultats hors échantillon. Ne jamais réécrire l'expérience prospective BTC 1H SHORT datée du 26 octobre 2026.
4. Ne jamais fusionner sur `main` sans autorisation explicite.

### Fichiers

- `backtest/vector-v13-regime.mjs` et `.test.mjs`: portes causales de régime et tests.
- `backtest/vector-v13-365-study.mjs` et `.test.mjs`: backtest séparé et tests d'audit.
- `.github/workflows/vector-v13-research.yml`: vérification sur branche dev + collecte et export JSON/CSV comme artefact `vector-v13-365day-regime-research`.

Aucune exécution automatique quotidienne n'est créée sur `main`; le workflow se déclenche par push correspondant sur `dev/v1.26.0`.
