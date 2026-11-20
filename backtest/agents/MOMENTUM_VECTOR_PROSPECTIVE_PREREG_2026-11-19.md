# Préenregistrement immuable — Momentum Fusion / Vector V1.1, prospective 1H

**Établi le 19 novembre 2026, avant le seuil de début.**
Statut : protocole **préenregistré seulement**, aucune observation prospective
encore accumulée, aucune promotion. Version verrouillée V1 ; ne pas réécrire
ce document après la première clôture future. Toute évolution est un
nouveau fichier versionné avec date et justification, jamais une correction
silencieuse du protocole. Les résultats historiques déjà consultés (dont
workflow 44652218854) sont **exploratoires et non prospectifs**.

## Fenêtre et sources

- **Début prospectif exclusif : 2026-11-21T00:00:00Z.**
  Toute observation comptée doit avoir `confirmedAtCloseMs >
  2026-11-21T00:00:00Z`; une bougie 1H qui clôture exactement à
  00:00:00Z ne compte **pas**. Pour 1H UTC, première bougie admissible
  ouvre à 00:00Z et clôture à 01:00Z le 21 novembre.
- Les données antérieures au seuil sont **échauffement seulement** pour
  EMA/ATR/RSI/Stoch/rang100/Vector, jamais événements, transactions,
  rendement, réussite ou échec prospectifs. Le portefeuille commence
  FLAT au premier OPEN exécutable après confirmation admissible.
- Univers figé : BTCUSDT, HYPEUSDT, 1000PEPEUSDT,
  Futures Bitunix `LAST_PRICE`, 1H. Pas de substitution d'actifs,
  pas d'ajout rétrospectif de XAU/NVDA au résultat primaire.
- Chaque lecture : **960 bougies 1H closes** (plus ancrages de
  provenance), contrôle OHLC/continuité/horodatages, deux lectures
  indépendantes de la même fenêtre, SHA bruts et dérivés. Si la fenêtre
  ne contient pas assez de bougies postérieures au seuil, elle sert
  à l'échauffement et à la surveillance de qualité **sans** bilan
  prospectif. Aucune interpolation de bougies manquantes.
- En cas de différence entre deux lectures (OHLC/volume), de retard
  de clôture non résolu, de chandelle encore en formation ou de
  provenance absente : **BLOQUÉ**, conserver les deux sources,
  timestamps, SHA et différences. Ne pas remplacer silencieusement
  la première lecture par la seconde. Le précédent incident Daily
  BTC du run 44652218692 reste documenté et non effacé.
- Le retard observé du graphique live ~90 secondes reste un problème
  distinct **non résolu** ; ce protocole historique ne le valide pas.

## Bras verrouillés et absence de retouche

1. `momentum_original` : Momentum Fusion V1 original inchangé
   (`backtest/momentum-fusion-v1.mjs`), règles d'entrée existantes,
   sans nouvelles conditions.
2. `vector_v11_original` : Vector AIT V1.1 inchangé,
   signaux d'origine et confirmation à la clôture.
3. `vector_momentum_original_strict` : Vector LONG seulement si
   Momentum composite >50 et EMA21>EMA55, SHORT si composite<50
   et EMA21<EMA55, confirmés à la **même clôture**. Un retournement
   Vector refusé met FLAT au prochain OPEN si une position inverse
   autorisée subsiste, selon le moteur d'octobre déjà utilisé.

**Aucune optimisation** du seuil 50, des EMA21/55, des longueurs,
des stops, des frais, ni sélection d'un « gagnant » sur le holdout
inspecté. Une éventuelle Momentum expérimentale V1.1 est une
**étude secondaire indépendante**, dont l'unique changement devra
être préenregistré dans un nouveau protocole avant ses données
prospectives; ne pas la substituer au bras original.

Les futurs bras d'ablation sont **proposés, non exécutés ici** :
Momentum original seul, Momentum expérimental seul, Vector seul,
SPEED V3 seul, Vector+Momentum original/expérimental,
SPEED+Momentum original/expérimental. Une combinaison triple
n'est pas autorisée par ce préenregistrement.

## Simulateur, coûts et garde-fous

- Même portefeuille **à une position** pour tous les bras ;
  signaux calculés sur bougies **fermées seulement**, exécution
  hypothétique au **prochain OPEN** et jamais au prix de la bougie
  de confirmation. Ne pas rétrodater les entrées.
- Modèle de risque figé du pilote : ATR Wilder14,
  stop 1,5 ATR, objectif 2R, durée maximale 12 bougies,
  risque nominal 1 % par opération, allocation max 100 %,
  échauffement au moins 168 bougies.
- Scénario de base par côté : frais 0,06 %, glissement 0,05 % ;
  scénario stress par côté : frais 0,10 %, glissement 0,20 %.
  Aucune hypothèse implicite de financement, carnet d'ordres
  ou liquidité parfaite présentée comme vérifiée.
- Ne compter que les transactions dont **entrée et sortie**
  sont toutes deux postérieures au seuil, et dont les bougies
  d'entrée/sortie sont clôturées et validées. Les positions
  encore ouvertes sont rapportées séparément, jamais comme
  transactions réalisées. Exclure toute transaction coupant
  une fenêtre de données indisponible ; consigner le motif.
- Mesurer, par marché et globalement, nombre de signaux confirmés,
  admis/rejetés, entrées manquées, nombre de transactions
  complètes, gains/pertes nets, rendement simulé, drawdown,
  taux de réussite, durée, coûts base/stress, et dispersion
  entre marchés. Publier aussi les résultats négatifs.

## Conditions de publication et arrêt

- **Aucun verdict de performance** avant au moins 30 jours
  de chandelles post-seuil et au moins **30 transactions clôturées
  par bras et par marché** ; sinon statut
  `INSUFFICIENT_PROSPECTIVE_EVIDENCE` même si les rendements
  sont positifs. Ce plancher descriptif n'est pas une preuve
  statistique ni une garantie de robustesse.
- Le résultat primaire est la comparaison des trois bras
  ci-dessus, sans remplacement ni sélection après lecture.
  Rapporter les trois marchés séparément et ne pas cacher
  un marché perdant dans une moyenne.
- Tout écart de source, test de causalité échoué, différence
  de signal sur préfixes historiques ou anomalie d'horodatage
  bloque le bras touché. Conserver les artefacts bruts, la
  révision Git, les coûts, les erreurs et les résultats.
- Ne jamais prétendre à la parité TradingView ; vérifier
  plutôt la cohérence interne, l'absence de repaint/lookahead
  et la confirmation temporelle.
- Aucun ordre, aucune clé privée, aucun service payant,
  aucune modification de `main` ou `dev/v1.26.0`,
  aucun déploiement ni promotion automatique.

## Reprise par le prochain cycle

1. Lire HEAD, CI, ce préenregistrement et le rapport Momentum
   historique avant toute écriture.
2. Vérifier la CI de cette révision et l'incident Daily BTC
   du run 44652218692 ; ne pas inférer que son succès récent
   éventuel efface le défaut intermittent.
3. Ajouter **séparément** un validateur déterministe de seuil
   temporel, de provenance 960 + double lecture et de transactions
   entièrement postérieures au seuil, avec tests de frontière
   exactement à 00:00Z et 01:00Z, sans nouveau backtest inutile.
4. Exécuter uniquement après collecte suffisante de chandelles
   futures ; conserver les sources et déclarer explicitement
   `INSUFFICIENT_PROSPECTIVE_EVIDENCE` tant que les seuils
   ne sont pas atteints.

Rôles 1 à 6 : contrôle données, simulation, diagnostic, préparation
prudente, régression, coordination — **six fonctions**, pas six
agents autonomes de trading.
