# CryptoJuju — moteur de portefeuille Vector intégré, laboratoire V1.3

## Première campagne contrôlée, aucun déploiement

Pilote BTCUSDT, HYPEUSDT et 1000PEPEUSDT en 1H sur 960 chandelles
fermées, avec une fenêtre Daily 365/180 chandelles fermées et
vérifiées indépendamment, chacune relue deux fois sur Bitunix.
L'étude existante `compareDailyAlignedVector` vérifie d'abord que la
source, la provenance, les signaux Vector et le filtre Daily restent
identiques aux résultats déjà validés. Aucun des indicateurs existants
n'est modifié. La recherche de parité TradingView et la latence live
ne sont PAS résolues par cette simulation.

Les quatre variantes utilisent les MÊMES signaux V1.1 de départ :

1. `v11_original` — Vector V1.1 sans Daily;
2. `v11_daily_strict` — seuls LONG Daily bull_stack ou SHORT bear_stack;
3. `v11_daily_soft` — autorise aussi les signaux lors d'un Daily MIXED
   déjà clôturé, jamais UNKNOWN;
4. `v13_ema_confirmed_recovery` — reprend strict, puis récupère
   SEULEMENT les signaux rejetés par opposition au Daily lorsque
   la *même chandelle 1H confirmée* satisfait un empilement
   EMA21/EMA34/EMA50 avec pente EMA50 dans le sens du signal.
   Aucun déplacement vers un futur signal, aucune sélection par
   rendement futur. Lorsqu'un signal opposé est récupéré, il
   remplace éventuellement la commande FLAT, sans doublon.

## Exécution et coûts identiques

Un seul portefeuille/une position à la fois pour chaque variante et marché.
Ordres hypothétiques à l'OPEN de la prochaine chandelle, aucun levier,
nominal plafonné à 100 % du capital. ATR Wilder 14 mesuré sur des
chandelles déjà closes à la confirmation; stop à 1,5 ATR;
objectif à 2R, maintien maximum de 12 bougies. Risque nominal
de 1 % du capital par position, dimensionné avec une estimation
des frais d'entrée et de sortie au stop; un gap défavorable peut
dépasser cette perte nominale. Tout signal de retournement ferme
d'abord la position existante et ouvre au besoin la nouvelle, à
la même ouverture simulée. Une commande FLAT ferme sans nouvelle
entrée. Les stops sont exécutés selon OHLC : gap adverse à l'OPEN,
stop d'abord si stop ET objectif sont touchés durant une seule
bougie. Les phases entraînement/validation de 70/30 repartent
chacune à capital neuf et SANS portage de position ni commande
exécutée à travers la frontière.

Scénarios :
- base : frais 0,06 % + slippage 0,05 % PAR CÔTÉ;
- stress : frais 0,10 % + slippage 0,20 % PAR CÔTÉ.

Rapports : capital final, rendement simulé, nombre de transactions,
taux de réussite seulement descriptif, drawdown calculé en fin
de bougie après frais de liquidation présumés, détails de chaque
entrée/sortie et stats des signaux récupérés. **Ce drawdown
ne capture pas les excursions intrabar** et ne borne pas les pertes
sur gaps, liquidation, funding, écarts ou tailles de lots réelles.
Ces frais ne sont pas des mesures d'exécution sur chaque marché.

## Portée et limites

Toutes les fenêtres, y compris leur validation historique, ont été
inspectées pendant le développement de CryptoJuju : cette campagne
**n'est pas un test prospectif indépendant**. Ne pas sélectionner
automatiquement une « meilleure variante » sur ces données. La
comparaison est un premier prototype de gestion des positions, PAS
un moteur d'ordres Bitunix, ni un conseil de trading.

Aucune clé API, aucun ordre, aucune dépense Render, aucun service
payant, aucune modification `main` ou `dev/v1.26.0` et aucun
déploiement du graphique public. Les rapports restent sur la branche
isolée et dans les artefacts GitHub Actions à durée limitée.

**Validation suivante proposée** : lorsqu'un critère est figé,
évaluer de nouvelles périodes indépendantes, puis étendre le
protocole à d'autres contrats avant d'envisager une modification
de l'indicateur.
