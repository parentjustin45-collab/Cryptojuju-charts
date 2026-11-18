# CryptoJuju — Agents de recherche, phase 1 (18 novembre 2026)

## Objectif
Préparer le système d'agents de backtest, sans payer un serveur, sans changer le site public et **sans exécuter d'ordres**.

Cette première phase est **déterministe**, pas encore un agent IA autonome. Elle réutilise les modules existants
`backtest/quality-gate.mjs` et `backtest/engine.mjs`. Les agents IA pourront ensuite orchestrer ces fonctions,
mais **ne doivent jamais fabriquer des chandelles, valider eux-mêmes leurs propres résultats ou inventer des signaux**.

## Responsabilités prévues
1. **Agent intégrité Bitunix** : vérifier fenêtre, unité de temps, continuité, doublons et OHLC ; bloquer si incohérent.
2. **Agent signaux** : recevoir les sorties versionnées de Vector, SPEED, Momentum, Frank Test et, plus tard, CJ Cipher.
   Les divergences doivent être datées de leur **confirmation effective**, pas du pivot historique.
3. **Agent backtest** : exécuter les signaux sur la **chandelle suivante** via le moteur existant, avec frais et slippage explicités.
4. **Agent rapport** : comparer des expériences indépendantes, conserver les périodes perdues, éviter l'optimisation sur les beaux exemples.

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
`node --test backtest/agents/*.test.mjs`

## Prochaines étapes (non réalisées)
- Adapter les sorties réelles de chaque indicateur à la convention temporelle (sans repaint).
- Charger l'historique Bitunix de façon traçable, avec pagination, warm-up et lots d'essais hors-échantillon.
- Comparer en backtest la **sortie 100 %** au point Cipher opposé contre **sortie 50 % + stop suiveur**.
  Le moteur actuel ne gère **pas encore** la sortie partielle ; ne pas simuler cela avec une sortie totale.
- Ajouter un ordonnanceur de jobs avec reprise, stockage PostgreSQL et suivi de coûts **seulement si nécessaire**.
- Valider une recette multi-jours et les autres timeframes avant toute livraison publique.

**Sécurité :** lecture seule, aucun trading automatique, pas de clé API de trading, pas de modification de `main`.
