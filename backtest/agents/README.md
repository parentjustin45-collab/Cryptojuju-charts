# CryptoJuju — Atelier de recherche, phase 1 (20 novembre 2026)

## Objectif
Préparer le système d'agents de backtest, sans payer un serveur, sans changer le site public et **sans exécuter d'ordres**.

Cette première phase est **déterministe**, pas encore un agent IA autonome. Elle réutilise les modules existants
`backtest/quality-gate.mjs` et `backtest/engine.mjs`. Les agents IA pourront ensuite orchestrer ces fonctions,
mais **ne doivent jamais fabriquer des chandelles, valider eux-mêmes leurs propres résultats ou inventer des signaux**.

Le rapport comprend maintenant **sept rôles déterministes**, le septième étant l'analyste de contexte multi-marchés.
Le mot « agent » décrit ici un module avec une responsabilité séparée; aucun n'est encore un LLM autonome qui
parcourt le Web ou travaille en continu. Cette étape ne déploie rien et n'ouvre aucun accès à Render.

## Responsabilités prévues
1. **Agent intégrité Bitunix** : vérifier fenêtre, unité de temps, continuité, doublons et OHLC ; bloquer si incohérent.
2. **Agent backtests** : exécuter les signaux fournis sur la **chandelle suivante**, avec frais et slippage.
3. **Agent diagnostics** : repérer les anomalies OHLC, les métriques suspectes et les contrôles manquants.
4. **Agent corrections** : préparer des pistes de correction, sans modifier les fichiers.
5. **Agent validation** : vérifier les lots de données, les tests de non-régression et les limites du rapport.
6. **Agent coordination** : assembler l'état des rôles et produire le résumé.
7. **Agent contexte multi-marchés** : résumer largeur haussière/baissière, rendements, volatilité horaire,
   corrélations et position dans la plage des dernières 24 h à partir d'au moins deux séries Bitunix 1 h acceptées.

### Données d'entrée du rôle contexte
`marketContext` contient `asOfTime`, `lookbackBars` (2–168, 24 par défaut) et `series`. Chaque série porte le
marché, une fenêtre exclusive UTC, ses chandelles normalisées fermées, ainsi qu'une provenance déclarant la
pagination complète, une répétition identique, l'exclusion de la chandelle ouverte et la parité OHLC avec la source.
Le rôle vérifie l'alignement exact des séries, les relations OHLC, le timestamp de clôture et un SHA-256 calculé
sur les colonnes normalisées `[time, open, high, low, close, volume]` dans cet ordre.

Le statut d'acceptation et les contrôles de provenance restent des assertions de l'étape amont : ce module hors
ligne ne contacte pas Bitunix et ne les authentifie pas indépendamment. Une configuration sans ces éléments,
avec des empreintes non concordantes ou avec des séries désalignées est **BLOQUÉE**. Les tests CI emploient des
fixtures clairement marquées synthétiques; leur réussite ne prouve ni la qualité de données réelles ni un avantage
de marché.

Le rôle calcule des mesures descriptives, pas le « vrai » plus bas ou sommet. Une position près du bas/haut de la
plage glissante n'est qu'une observation rétrospective. Il ne génère aucun signal, ne modifie aucun indicateur,
n'apprend pas seul et ne lit pas encore les nouvelles, actions ou sites externes. L'extension à des marchés
boursiers attendra un flux de données distinct dont la source, la licence, les timestamps de disponibilité et la
qualité OHLC seront contrôlés.

## Code disponible maintenant
`runResearchBatch` dans `research-batch.mjs` est l'interface initiale hors ligne. Il accepte uniquement
Bitunix LAST_PRICE sur **15m, 1h, 4h**, unités ayant fait l'objet d'une acceptation ciblée sur BTC/ETH/SOL.
Cela ne prouve pas que chaque fenêtre ou symbole futur est correct : la qualité est revérifiée à chaque appel.

Chaque expérience fournit :
- `id` unique et `signals: [{time,side}]` où `side` vaut `long`, `short` ou `flat`.
- `signalTimeConvention: 'confirmation-bar-open'` : `time` est l'heure d'ouverture de la chandelle sur
  laquelle le signal est confirmé **à sa clôture** ; l'ordre fictif arrive à l'ouverture de la suivante.
- `indicatorParity: 'VERIFIED'` seulement après comparaison indépendante démontrée avec TradingView ;
  sinon statut `UNVERIFIED`.

Ne transmettre à ce module que des séries **fermées et déjà normalisées avec provenance vérifiée**.
Le module ne répare aucune chandelle et refuse les trous, doublons ou incohérences OHLC.
Aucune comparaison indépendante complète TradingView n'est supposée.

### Comparaison chronologique figée (ajout)
`runFixedHoldout` dans `fixed-holdout.mjs` accepte les mêmes fenêtres et expériences ainsi qu'un
`holdoutStartTime` fixé **avant** la recherche de paramètres. Il contrôle d'abord la continuité de
**tout** l'historique, sépare les chandelles chronologiquement, puis produit deux tableaux de résultats
séparés : `training` et `holdout`. Il ne classe aucun gagnant et n'optimise aucun paramètre.

Au début de chaque phase, la position est remise à plat et le capital initial est réinitialisé.
Une alerte confirmée sur la **dernière chandelle d'entraînement** ne peut pas être exécutée sur la
première chandelle holdout : elle est rejetée de cette évaluation avec journal `droppedAtBoundary`.
Cette séparation permet la comparaison de phases indépendantes, mais **ne prouve pas** qu'un
indicateur ne repeint pas, ni que la période holdout était réellement inconnue à l'opérateur.

### Tests hors ligne
`node --test backtest/agents/*.test.mjs backtest/agents/roles/*.test.mjs` et `node backtest/agents/ci-smoke.mjs`

## Prochaines étapes (non réalisées)
- Adapter les sorties réelles de chaque indicateur à la convention temporelle (sans repaint).
- Charger l'historique Bitunix de façon traçable, avec pagination, warm-up et lots d'essais hors-échantillon.
- Comparer en backtest la **sortie 100 %** au point Cipher opposé contre **sortie 50 % + stop suiveur**.
  Le moteur actuel ne gère **pas encore** la sortie partielle ; ne pas simuler cela avec une sortie totale.
- Ajouter un ordonnanceur de jobs avec reprise, stockage PostgreSQL et suivi de coûts **seulement si nécessaire**.
- Valider une recette multi-jours et les autres timeframes avant toute livraison publique.

**Sécurité :** lecture seule, aucun trading automatique, pas de clé API de trading, pas de modification de `main`.
