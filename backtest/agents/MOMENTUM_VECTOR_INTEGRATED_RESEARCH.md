# CryptoJuju — Comparaison Momentum Fusion / Vector / Combinaison

Recherche isolée `dev/ai-agents-phase1` : version pilote de l'étude
**Momentum seul vs Vector V1.1 seul vs Vector + Momentum**.

Les paramètres Momentum Fusion correspondent à la base Pine Script originale
fournie par l'utilisateur (RSI14 + Stoch RSI14/SMA3 + momentum10/rang100
avec poids 1:1:1, composite EMA3, zones 30/70, filtre EMA21/55).
La transposition JS existante `backtest/momentum-fusion-v1.mjs` est
utilisée sans modifications. **Parité numérique Pine/TradingView encore
non démontrée.** Aucune annonce de performance réelle n'est permise.

La combinaison expérimentale est la même règle préexistante d'octobre 2026 :
acceptation Vector LONG si Momentum composite>50 ET EMA21>EMA55,
SHORT si composite<50 ET EMA21<EMA55. Les conclusions historiques
préexistantes indiquaient des acceptations peu nombreuses et souvent
perdantes : cela reste notre point de comparaison et constitue un
**risque connu**, pas une raison de le déclarer amélioré sans preuve.
Les signaux opposés rejetés ferment la position à FLAT au prochain open,
pour éviter de maintenir artificiellement une position inverse.

Nouveauté : contrairement aux anciennes transactions candidates indépendantes,
les trois variantes sont comparées sur un **même moteur de portefeuille
à une seule position**, avec paramètres de risque uniformes :
ATR Wilder14, stop 1,5 ATR, objectif 2R, durée max 12 bougies,
risque nominal 1 %, position max 100 % du capital, horizon commun
960 bougies fermées en 1H, warmup commun de 168 bougies,
découpage 70/30 sans report de position. Simulations base et stress
(0,06 % + 0,05 %, 0,10 % + 0,20 % de frais/slippage par côté).

Premier échantillon : BTCUSDT, HYPEUSDT, 1000PEPEUSDT, Bitunix Futures
LAST_PRICE en double lecture avec provenance SHA. Aucun Daily n'est
encore mélangé à ce premier contrôle : il sera évalué dans une
campagne différente pour attribuer l'effet de chaque filtre.

Limites : comparaison **rétrospective** et déjà influencée par les
observations antérieures; ce 30 % historique n'est pas véritablement
prospectif/aveugle. Les marchés peuvent comporter peu de signaux
Momentum. Frais, financement, carnets d'ordres, prix mark, liquidité,
règles de lots et parité TradingView non vérifiés. Les profits sont
hypothétiques. Ne pas promouvoir ou optimiser automatiquement.

La suite doit figer les règles sur un horizon FUTUR non observé,
contrôler la parité JS/Pine sur des données comparables, puis
évaluer séparément l'ajout du Daily. Aucune modification à `main`,
`dev/v1.26.0`, au graphique ou au trading réel.
