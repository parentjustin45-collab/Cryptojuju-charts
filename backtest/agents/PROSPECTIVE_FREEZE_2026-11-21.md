# CryptoJuju — Préenregistrement prospectif (recherche seulement)

**Proposition approuvée :** `CJ-PROSPECTIVE-FREEZE-20261121`.
**Source de référence avant publication :** `5b3aee277c96246a0739e3a41b99a8efe854c661`.
**Date de coupure fixée :** `2026-11-21T00:00:00Z` (UTC). Le présent document est un préenregistrement de règles; il ne prétend pas rendre aveugles les données déjà observées depuis cette date. Toute observation déjà consultée est exploratoire, jamais une preuve prospective indépendante.

## Versions et variantes gelées

1. Momentum Fusion original : `backtest/momentum-fusion-v1.mjs`, sans changement de paramètres (RSI14, Stoch RSI14/SMA3, momentum10/rang100, poids 1:1:1, composite EMA3, zones 30/70, EMA21/55).
2. Vector V1.1 original : source originale inchangée, version et SHA exacts à enregistrer avant tout essai.
3. Paire Vector V1.1 + Momentum original : LONG seulement si composite > 50 et EMA21 > EMA55; SHORT seulement si composite < 50 et EMA21 < EMA55; signal opposé refusé : sortie à plat à l'ouverture suivante. Ne jamais retoucher ces seuils à partir du holdout inspecté.

Les variantes Momentum expérimentales, Vector V1.2, confirmation Vector +1 bougie, SPEED V3.0, CJ Cipher et filtres Daily strict/souple appartiennent à des cohortes **séparées**. Aucune variante n'est promue automatiquement. Parité Pine/TradingView non démontrée.

## Admission des données

- Marchés initiaux BTCUSDT, HYPEUSDT et 1000PEPEUSDT, 1H; types de contrats conservés distincts. Pas de Forex synthétique.
- Chandelles Bitunix clôturées uniquement, 960 par fenêtre exploratoire, double lecture, ordre temporel, OHLC et provenance SHA vérifiés; bloquer les fenêtres instables, manquantes ou non reproductibles. Recalculer indépendamment toute empreinte avant backtest.
- La référence BTC 960 bougies se termine exclusivement le `2026-11-20T14:00:00Z`, SHA attendu `52c4526d56663dec2984ec51d8786a591b107755ceca941dcdb14d96a4784745`; cette référence est **exploratoire**, jamais prospective.
- Les chandelles antérieures à `2026-11-21T00:00:00Z` servent uniquement à l'échauffement, jamais aux résultats prospectifs. Un signal compté doit être confirmé sur une chandelle clôturée à ou après la coupure; l'exécution simulée doit se produire à l'ouverture suivante, également après la coupure. Aucun lookahead, repaint, remplissage synthétique ou prix de clôture non exécutable.
- Ne pas prétendre à une validation aveugle pour les chandelles postérieures à la coupure qui ont déjà été inspectées : les marquer `POST_CUTOFF_ALREADY_SEEN`, et réserver une nouvelle fenêtre future jamais utilisée pour la décision finale.

## Moteur et critères figés avant évaluation

- Une seule position, ATR Wilder14, stop 1,5 ATR, objectif 2R, durée max 12 chandelles, risque nominal 1 %, position max 100 % du capital, échauffement commun 168 chandelles; aucun report entre cohortes.
- Coûts de simulation par côté : base frais 0,06 % + slippage 0,05 %; stress frais 0,10 % + slippage 0,20 %. Financement et liquidité réelle non prouvés.
- Rapporter pour chaque marché et variante : nombre de signaux et trades, signaux acceptés/rejetés, faux retournements, mouvements manqués, rendement net après coûts, drawdown maximal, exposition, délai de confirmation, sensibilité au marché, et comparaison base/stress. Archiver également les résultats négatifs.
- **Seuil minimal de lecture :** au moins 30 trades exécutés ET 30 jours calendaires de données prospectives clôturées, par variante et cohorte, avant de formuler une conclusion indicative. Même au-delà de ces seuils, aucune promotion automatique ni affirmation de rentabilité. Un échantillon insuffisant porte le statut `INSUFFICIENT_EVIDENCE`.
- Séparer entraînement, holdout historique déjà inspecté et futur jamais inspecté. Modifier au plus un paramètre Momentum expérimental à la fois, exclusivement sur entraînement; ne pas choisir Vector ou SPEED comme partenaire à partir du holdout connu.

## Journal d'exécution requis

Pour chaque expérience : SHA Git source, SHA des chandelles acceptées, UTC début/fin exclusive, provenance et pagination de chaque lecture, commande exacte, version des indicateurs, frais, nombre de signaux/trades, résultat, échecs et limites. Les quatre pistes Vector, Momentum, SPEED et Cipher doivent rester indépendantes tant qu'un lot commun n'est pas vérifié. Aucun sous-agent indépendant n'est réputé avoir tourné sans preuve d'exécution.

## Circuit de décision

Recherche et simulation uniquement sur `dev/ai-agents-phase1`. Pas de modification de `main` ni `dev/v1.26.0`, déploiement, ordre réel, dépenses, changement d'indicateur original ou promotion sans autorisation explicite distincte. Le retard du graphique live ~90 s demeure non résolu.
