# Vector V1.2 — suivi prospectif BTC 1H SHORT et analyse 24H

## Portée et verrouillage

**Recherche uniquement sur dev/v1.26.0.** Aucun changement à main, à la V1.1 originale, aux graphiques en production ou à Bitunix; aucun ordre réel.

- Début des observations : **26 octobre 2026 à 00:00 UTC**, fixé avant le nouveau suivi. Les bougies précédentes servent uniquement d'échauffement (35 jours). Aucun signal de cette période n'est compté.
- Instrument : **BTCUSDT 1h SHORT seulement**. Référence : V1.1 sans délai; candidat : V1.2 break_extreme_2 (cassure confirmée à la clôture sous le plus bas du Vector en une ou deux bougies).
- Détection Vector : 4 confirmations et autres paramètres V1.1 inchangés.
- Exécution simulée : ouverture de la bougie suivant le signal confirmé, uniquement avec bougies clôturées; positions non chevauchantes par scénario.
- Sortie identique : stop 1,5 %, cible 3 %, maximum 12 chandelles; stop prioritaire si stop et cible sont touchés dans une même bougie.
- Frais : 0,06 % par côté; scénarios de glissement : 0 % et 0,05 % par côté.
- Mesures : nombre de trades terminés, taux gagnant, rendement net moyen par trade, positions censurées, signaux en attente, qualité et lacunes des données.
- Seuil minimal de lecture préliminaire : 30 trades terminés de chaque configuration; **cela n'est pas une preuve de rentabilité**.

## Multi-timeframe : 1D -> 4H -> 1H, sans filtre automatique

- **1D (24H)** : direction Vector de la dernière chandelle quotidienne réellement clôturée en UTC.
- **4H** : direction Vector de la dernière 4H clôturée.
- **1H** : seul timeframe d'entrée du protocole verrouillé.
- **30m / 15m** : recherches à ouvrir séparément plus tard, sans modifier les règles du suivi déjà figées.

Le 1D et le 4H sont **des métadonnées descriptives des trades 1H**, pas des conditions d'achat ou de vente. Les bougies supérieures en formation ne sont jamais utilisées. Si la dernière bougie supérieure attendue manque, le contexte indique null, pas une ancienne direction. Un timeframe plus long n'est pas automatiquement plus précis : l'intérêt doit être démontré.

## Données et limites

Les données historiques Bitunix sont lues via le proxy CryptoJuju existant. Les bougies manquantes, dupliquées ou invalides sont mises en quarantaine; aucune position ne traverse un trou. Les positions inachevées ne comptent pas en P&L. Les exécutions futures relisent l'historique disponible : cela ne constitue pas une archive immuable de ticks live. Les exports GitHub par exécution permettent de comparer les résultats et repérer des révisions d'historique.

Les pourcentages sont des **moyennes nettes par transaction clôturée**, sans composition ni rendement de portefeuille. Les signaux ne sont pas encore certifiés identiques au Pine Script TradingView; aucune promotion automatique de stratégie n'est autorisée.

## Exécution sur GitHub

Le workflow de recherche est .github/workflows/vector-prospective-v12.yml. Il est limité aux pushes sur **dev/v1.26.0** des fichiers surveillés et produit un artefact nommé **vector-prospective-btc-1h-short**. Lorsqu'il est déclenché avant le début du suivi, il retourne NOT_STARTED et ne collecte pas de données futures.

**Important :** sur GitHub, les déclencheurs horaires schedule ainsi que workflow_dispatch sont liés à l'existence du workflow sur la branche par défaut. Le workflow ajouté uniquement sur dev peut s'exécuter lors d'un push correspondant sur dev, mais il ne faut pas supposer qu'il sera automatiquement lancé chaque jour ni que le bouton Run workflow sera disponible. Nous ne modifions pas main pour activer une planification sans autorisation explicite. Une programmation externe ou l'enregistrement ultérieur d'un lanceur minimal sur main nécessitera une décision distincte.

## Critère de poursuite

Observer séparément la V1.1 et la V1.2 sur l'échantillon postérieur au 26 octobre; comparer après frais et glissement, inspecter la quantité de données, censures, faiblesse d'échantillon et compatibilité Pine. Ne pas généraliser de BTC 1H SHORT à ETH/SOL, LONG ou 1D sans étude indépendante.
