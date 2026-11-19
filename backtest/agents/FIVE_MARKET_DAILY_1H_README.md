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

## Mesurer la persistance réelle du Daily
Le diagnostic `daily-trend-persistence.mjs` ajoute :
(1) le pourcentage de journées haussières/baissières qui conservent
leur direction catégorielle le lendemain (passage vers MIXED = fin de
la continuité), (2) la proportion de structures 1H EMA directionnelles
en accord avec le dernier Daily clos et (3) la proportion de variations
clôture-à-clôture 1H alignées avec le Daily. Les trois définitions ont
des dénominateurs différents, ne mesurent **pas** le taux de réussite
d'un trade et ne peuvent pas soutenir automatiquement un « 90 % ».
Les observations 1H sont ventilées entre les deux périodes 70/30,
sans utiliser de chandelle Daily future.

## Extension 15M / 1H / 4H sur les cinq marchés (15 comparaisons)
Le même protocole passe maintenant les cinq contrats à trois unités
inférieures : 15 minutes (10 jours avec 960 barres), 1 heure (40 jours)
et 4 heures (160 jours), chacun avec une fenêtre 1D fermée de 180 ou
365 jours validée indépendamment. L'absence d'historique en 4H sur un
contrat récent bloque SEULEMENT ce cas dans le rapport, mais la campagne
ne devient entièrement verte que lorsque les 15 cas sont validés.
Les chandelles 1H servent également au diagnostic Daily/1H des tendances
et de leur persistance, sans prétendre que 90 % des trades gagnent.
Rapport `five-market-daily-mtf-summary.md` (JSON aussi), et données
brutes/derivées dans l'artefact Actions temporaire.
