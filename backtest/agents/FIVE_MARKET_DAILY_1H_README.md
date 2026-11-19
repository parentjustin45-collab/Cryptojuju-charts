# CryptoJuju — cohorte cinq marchés : Daily 1D + Vector 1H

Objectif de recherche (avant samedi 21 novembre 2026) : mettre à
l'épreuve le raisonnement « tendance dominante en Daily, correction
sur des unités plus courtes ». **L'affirmation « 90 % du temps » n'est
pas prouvée** et n'est pas une probabilité de trade gagnant.

Cinq marchés représentatifs : BTCUSDT, HYPEUSDT, 1000PEPEUSDT,
XAUUSDT et NVDAUSDT. Les produits XAU et NVDA sont des dérivés
référencés, pas l'or spot ou des actions détenues.

Pour chaque symbole, vérification du contrat OPEN dans le registre
public de Bitunix et de la présence dans la watchlist CryptoJuju.
Collecte et contrôle de 365 ou 180 chandelles Daily, et 960 chandelles
1H, deux lectures de données Bitunix LAST_PRICE, provenance et SHA256
bruts et dérivés, lacunes/doublons bloquants, exclusions de la bougie
encore en cours. Le passage à 180 jours nécessite une preuve que
seul l'historique le plus ancien manque.

Comparaison des six modes sur les mêmes bougies :
- Vector V1.1 original;
- V1.1 avec Daily strict (LONG si bull_stack, SHORT si bear_stack);
- V1.1 avec Daily souple (comme strict, mais laisse passer les deux
  sens lorsque le dernier Daily clos est `mixed`);
- V1.2 break_extreme_2 original;
- V1.2 break_extreme_2 avec Daily strict;
- V1.2 break_extreme_2 avec Daily souple.

Le Daily ne devient disponible qu'après clôture UTC plus une marge
de 120 secondes *supposée*, non mesurée. Un Daily UNKNOWN ou
indisponible n'autorise jamais d'entrée. Un renversement veto
déclenche FLAT à la prochaine ouverture : on n'entretient pas
une ancienne position contre un signal ignoré.

Évaluation 70/30 déjà inspectée, coûts fixes simulés identiques
pour comparaison initiale seulement. Un rendement amélioré sur
quelques transactions ne prouve pas une version supérieure :
on veut vérifier les taux de rejet, le nombre de transactions,
le drawdown, et ensuite prolonger l'historique et examiner les
mouvements intraday contre la tendance Daily.

Rapports `five-market-daily-1h-summary.md`, JSON et toutes les
preuves-source dans l'artefact GitHub Actions de 7 jours.
Tests strictement sur `dev/ai-agents-phase1`.
Aucun ordre, déploiement, abonnement Render ni paramètre promu.
