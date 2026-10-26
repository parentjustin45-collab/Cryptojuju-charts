# Vector V1.5 — Recherche sur les bons retournements manqués

**Statut : laboratoire uniquement sur `dev/v1.26.0`. La V1.4, les signaux V1.1–V1.3, les suivis prospectifs verrouillés, le Pine original et la branche `main` restent intacts. Aucun ordre n'est envoyé à Bitunix.**

## La question vérifiable

Un filtre peut réduire les inversions LONG/SHORT inutiles **mais aussi rater un vrai retournement**. Les exemples choisis sur captures BTCUSDT Bitunix 1H du 11–14 octobre 2026 donnent des cas intéressants, mais sont **sélectionnés avec recul**. Ils ne sont donc ni des preuves d'exactitude, ni des données de validation inédites. Le protocole étudie les **signaux V1.1 acceptés, rejetés et déjà alignés** pour les comparer **à l'ensemble des marchés et des périodes**.

## Hypothèse nouvelle unique, fixée avant test

La candidate `vector-v15-followthrough.mjs` copie la logique générale de structure/impulsion de la V1.4 dans un **moteur séparé**, et lui ajoute **une seule possibilité de retournement**, fondée uniquement sur des clôtures déjà terminées :

- Un candidat opposé existe depuis au moins **2 bougies** (au plus 3).
- **Deux clôtures consécutives** progressent dans la nouvelle direction, et la deuxième confirme la première.
- La première clôture doit progresser d'au moins **0,15 ATR14** depuis la clôture de la chandelle candidate; la deuxième d'au moins **0,45 ATR14**.
- Les conditions structurelles V1.4 restent : rupture des **4 chandelles** précédentes avec marge **0,05 ATR**, ou impulsion avec corps **1,25 ATR** et rupture des **2 chandelles** précédentes. Un délai de **3 chandelles** entre retournements validés reste requis pour les voies non impulsives.
- Les signaux sont produits **après la clôture** de la confirmation; entrée simulée **à l'ouverture suivante**. Pas de regard dans le futur.

Ce n'est pas un moteur d'IA prédictif et **il peut encore inverser trop tard ou trop tôt**. Aucun paramètre ne sera optimisé sur les exemples photographiés.

## Comparaison historique indépendante du code V1.4

- **180 jours historiques Bitunix**, BTCUSDT/ETHUSDT/SOLUSDT, **1H**, LONG et SHORT, séparation temporelle en deux moitiés descriptives. Historiques **déjà consultés lors d'études précédentes** : **aucun holdout vierge**.
- Quatre modes, simulés indépendamment : **V1.1**, **V1.2 break_extreme_2**, **V1.4 structure**, **V1.5 continuation sur 2 clôtures**.
- Arrêt protecteur **1,5 %**, objectif **3 %**, horizon maximum **12 bougies**, commissions **0,06 % par côté** et glissement hypothétique **0,05 % / 0,10 % par côté**. Les positions non fermables avant un trou de données/coupure sont **censurées, jamais créditées comme gagnantes**.
- Pour chaque événement LONG/SHORT initial V1.1, déterminer si le mode étudié l'a `accepted`, si sa position était `alreadyAligned`, ou s'il l'a `rejected`. Ne pas appeler « manqué » un signal qui répète simplement la direction déjà détenue.
- **Diagnostic ex post uniquement** : sur les **12 chandelles suivantes**, à partir de l'open suivant le signal, mesurer mouvement directionnel brut à 12 h, excursion favorable et défavorable. Qualifier un rejet comme **opportunité potentiellement ratée** si la variation brute directionnelle atteint **+0,4 %** et l'excursion favorable **+0,8 %**. Un rejet avec variation négative ou nulle est rétrospectivement défavorable; les autres restent indécis. Les seuils sont des conventions descriptives, **pas des ordres ou garanties de gain**.
- **Interdiction de calculer cet ex post** à travers une coupure de moitié, une fenêtre de données inutilisables, ou un historique incomplet. Les sorties censurées sont distinctes des pertes/gains.
- Rendre visibles à la fois **les mauvaises inversions évitées, les bons retournements ratés, et les pertes réelles sous les sorties à risque borné**; ne pas sélectionner une version sur la seule diminution des flèches.

## Décision de recherche

Ne **promouvoir aucune version** sans validation prospective neuve; ne **réécrire aucun** protocole d'observation déjà préenregistré. Ce comparatif ne calcule pas de rendement composé sur un portefeuille et ne vérifie pas des fills réels Bitunix. La parité entre Pine V1.1 et port JavaScript est testée sur des séries synthétiques, mais ces captures n'établissent pas une correspondance au tick près sans exports datés TradingView.

Workflow : `.github/workflows/vector-v15-opportunity.yml`. Le rapport JSON conserve les détails de l'intervalle d'octobre **sans affirmer une correspondance exacte des étiquettes photographiées**.
