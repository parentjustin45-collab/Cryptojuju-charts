# Vector AIT — V1.4 expérimentale : maintien intelligent / retournements

**Exclusivement recherche sur `dev/v1.26.0` — aucun changement à `main`, `index.html`, au Pine original, ou aux suivis prospectifs préenregistrés V1.2 (début le 26 octobre) et V1.3 (début le 27 octobre). Aucun ordre de trading.**

## Hypothèse figée avant consultation des résultats

L'utilisateur a signalé, sur des captures **BTCUSDT Bitunix en 1H**, des appels SHORT et LONG à conserver, et des impulsions isolées produisant des retournements inutiles (autour du 11–12 octobre); il a aussi identifié un SHORT utile vers le 14 octobre. Ces étiquettes sont **qualitatives et sélectionnées visuellement avec recul**. L'heure de chaque chandelle n'est pas établie au crosshair; **ne pas prétendre que ces événements ont été précisément étiquetés ou validés par l'OHLC**. Un audit événementiel affiche donc tous les signaux générés entre le 10 et le 15 octobre 2026 sans déclarer qu'un signal correspond à une étiquette donnée.

Le code `backtest/vector-v14-hysteresis.mjs` utilise les **drapeaux Vector V1.1 originaux sur chandelles clôturées** et gère sa propre direction :
- Première chandelle Vector : entrée en direction de ce signal.
- À l'apparition d'un Vector opposé : création d'un **candidat de retournement**, plutôt qu'une inversion automatique.
- **Chemin structurel** : clôture au-delà du plus haut / plus bas des **4 chandelles terminées précédentes**, avec une marge de **0,05 ATR14**, et **3 chandelles** minimum depuis le dernier retournement validé.
- **Chemin impulsion précoce** : chandelle avec **corps ≥ 1,25 ATR14** et clôture au-delà de l'extrême des **2 chandelles précédentes**. Ceci permet parfois un vrai retournement précoce, sans imposer une EMA50 en retard.
- Un candidat doit être confirmé sur la chandelle actuelle ou dans les **3 prochaines bougies 1H**, sinon il expire. Un Vector opposé annule l'autre candidat.
- Inverser la direction nécessite une confirmation **contemporaine ou plus ancienne**; aucun pivot futur, aucune EMA future, aucune utilisation d'un 4H encore ouvert.
- Une transition émise indique `why=impulse_reversal` ou `why=structure_break` et son `sourceIndex`. Les chandelles et les signaux V1.1 restent identiques dans leur propre version.

Ces seuils sont **hypothèses initiales fixes**, pas un résultat d'optimisation; les captures ne servent pas à ajuster a posteriori les paramètres pour avoir l'air de réussir deux cas.

## Deux questions distinctes

1. **Gestion du risque à 12 heures** : V1.1/V1.2/V1.3/V1.4 séparées, LONG et SHORT, entrée au prochain open, stop **1,5 %**, take **3 %**, sortie maximum **12 bougies**, commission **0,06 % par côté**, glissement simulé **0,05 % / 0,10 % par côté**. Comparaison sur 180 jours historiques BTC/ETH/SOL 1H, moitié antérieure/récente, exclusion des historiques invalides par quarantaine.
2. **Maintien de la direction jusqu'à la flèche opposée** : test en ombre de l'idée de l'utilisateur, pour mesurer si moins de changements LONG/SHORT peuvent effectivement améliorer la capture de tendance. Entrée au prochain open après le signal, sortie au prochain open après le signal opposé, commissions et glissement identiques, MAE (adverse excursion) estimé sur les fourchettes OHLC. **Pas de stop-loss** dans ce modèle : il peut produire des pertes extrêmes, n'est pas prêt pour le réel, et ses rendements **ne sont pas comparables directement** à une stratégie à sortie fixe.

On publie les raisons, fréquence de renversements rapprochés, trades fermés, rendements nets moyens, couverture des données, et épisodes censurés. Les positions traversant une coupure, un trou de données ou une fin d'historique **ne sont pas considérées comme des gains**. Le minimum d'interprétation exploratoire est **30 trades clôturés par moitié**, sans prétendre à une garantie statistique.

## Limites et décisions

- Ces 180 jours ont déjà servi aux études V1.1–V1.3 : **pas de holdout vierge**. Les résultats peuvent être suradaptés aux exemples choisis avec recul.
- Le fait de bloquer un retournement peut augmenter les pertes et le drawdown; compter les flips rejetés sans les pertes associées serait trompeur.
- Des hypothèses de frais et de glissement ne remplacent pas des prix d'exécution réels. Aucune configuration ne doit être qualifiée de gagnante uniquement sur des captures.
- **Ne pas déployer V1.4 automatiquement** même si son résultat historique est positif : enregistrer les défauts et le risque, choisir une seule candidate future, vérifier avec Pine, et accumuler des périodes inédites.

Fichiers : `backtest/vector-v14-hysteresis.mjs`, `.test.mjs`, `backtest/vector-v14-history.mjs`, `.test.mjs`, workflow `.github/workflows/vector-v14-hysteresis.yml`, résultat JSON+CSV en artefact GitHub `vector-v14-structure-180day-exploratory`.
