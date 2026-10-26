# Vector — Journal des transactions et retournements individuels (BTC/ETH/SOL 1H)

**Recherche sur `dev/v1.26.0` uniquement**, sans changer les signaux V1.1, V1.2, V1.3, V1.4, V1.5, ni les protocoles prospectifs antérieurs. Aucun ordre réel; `main` reste intacte.

## Pourquoi cet audit?

Le problème n'est pas seulement la fréquence des flèches. Il faut savoir **quel SHORT/LONG une version a réellement accepté**, si un rejet était une perte potentiellement évitée **ou une occasion potentiellement manquée**, et quels risques auraient été rencontrés dans les **trades complets réellement simulés**.

## Plan d'audit verrouillé avant les résultats

- Trois marchés Bitunix : **BTCUSDT, ETHUSDT et SOLUSDT**, données historiques **90 jours en 1H**, fenêtres OHLC continues après quarantaine.
- **Aucun nouveau réglage ni variante de trading**. Relecture des mêmes V1.1 `baseline_v11`, V1.2 `break_extreme_2`, V1.4 maintien de structure et V1.5 confirmation par deux clôtures.
- Deux périodes chronologiques distinctes, strictement séparées au milieu des 90 jours, pour faciliter la lecture; **les données ont été consultées auparavant, ce n'est PAS un holdout inédit**.
- Pour chaque signal de **retournement V1.1**, comparer les autres machines :
  - `accepted` : signal correspondant confirmé à partir de la même chandelle dans les 3 prochaines bougies;
  - `already_aligned` : le mode est déjà dans cette direction; ne pas étiqueter « occasion manquée »;
  - `rejected` : ni alignement ni confirmation correspondante.
- **Diagnostics ex post seulement** : depuis l'open suivant chaque signal, excursion favorable/adverse et retour brut après **3 h, 6 h et 12 h**, seulement si les chandelles existent dans la fenêtre historique et dans la même moitié.
- Un SHORT/LONG rejeté avec **variation directionnelle brute à 12 h ≥ +0,4 % ET excursion favorable ≥ +0,8 %** est un `potential_missed_move`; avec retour directionnel nul/négatif : `possibly_avoided_loss`; sinon `ambiguous`. **Ces labels sont rétrospectifs, ni probabilités de succès ni gains garantis**. La variable future n'entre jamais dans le calcul des signaux.
- Pour chaque signal pris en simulation : entrée au **prochain open**, stop **1,5 %**, take **3 %**, sortie après **12 chandelles**, commission **0,06 % de chaque côté**, glissement simulé **0,05 % par côté**. Retour net, raison de sortie, temps, excursion adverse/favorable pendant la transaction (basée sur OHLC), censure à la frontière/hors fenêtre.
- Journal **distinct** des épisodes directionnels « jusqu'au signal opposé », **sans stop protecteur** — seulement pour quantifier le coût du maintien; **inutilisable en production**. Les épisodes incomplets ne deviennent pas des trades gagnants artificiels.
- Liste événementielle **du 10 au 15 octobre 2026 UTC** pour explorer les captures choisies par l'utilisateur; fuseau des captures non confirmé, donc **pas de promesse de parité au pixel ou d'horodatage exact**.
- Minimum indicatif de **30 trades clôturés par côté et période**, sans prétendre à une validation statistique.

## Sources et livrables

Le fichier `backtest/vector-event-ledger.mjs` et ses tests `.test.mjs`; le workflow dev-only `.github/workflows/vector-event-ledger.yml` exporte :

- JSON intégral avec transactions, signaux acceptés/rejetés et épisodes, qualité OHLC, scénarios de censure;
- `vector-closed-trades.csv` — transactions individuelles, sorties et excursion adverse;
- `vector-rejected-signals.csv` — événements rejetés et diagnostic à terme;
- `vector-event-cases.json` — événements d'octobre à rapprocher manuellement des captures;
- `vector-event-summary.csv` / JSON — tableaux de contrôle croisé et de risque.

**Décision :** n'ajouter aucun filtre V1.6 avant d'avoir documenté les bons retournements manqués, les pertes évitées, et le risque du maintien. L'échantillon historique étant sur-exploré, une éventuelle candidate doit ensuite être figée sur des **observations futures inédites**, sans modifier les protocoles prospectifs existants.
