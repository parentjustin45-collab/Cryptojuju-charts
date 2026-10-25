# Vector V1.2 — contrôle prospectif 4H (1D descriptif) pour BTC 1H SHORT

**Branche :** `dev/v1.26.0` exclusivement. **Statut :** protocole figé le 25 octobre 2026 avant l'observation prospective commençant le **26 octobre 2026 à 00:00 UTC**. Aucun déploiement en production et aucun ordre Bitunix.

## Hypothèse déclarée (motivée par des résultats historiques déjà consultés)

Sur les signaux **BTCUSDT 1H SHORT** de la V1.2 `break_extreme_2`, observer si la direction bearish du **dernier Vector 4H clôturé** correspond à des rendements moyens nets et un taux gagnant différents de l'ensemble des trades 1H. Cette hypothèse provient d'une analyse historique antérieure : elle est **inspirée des données et non une découverte totalement indépendante**. Le 1D n'est pas imposé comme filtre; il fait partie des analyses descriptives secondaires.

Le **protocole BTC 1H SHORT original** n'est pas modifié : V1.1 sans retard comme référence; V1.2 `break_extreme_2`; quatre confirmations de base; entrée au prochain open; stop 1,5 %, objectif 3 %, horizon maximum 12 bougies 1H; frais 0,06 % par côté; scénario de glissement supplémentaire 0,05 % par côté. La mise à jour **ne relance pas les trades** et n'ajoute aucun nouveau point d'entrée. Elle utilise directement les listes de transactions terminées du rapport de suivi original.

## Cohortes observées avant de tirer des conclusions

Le rapport comporte, pour chaque mode (V1.1 / V1.2), pour chaque scénario de coût (baseline / stress), les cohortes de trades :
- tous les trades non filtrés;
- 4H bearish uniquement (hypothèse principale);
- 4H neutral ou bullish;
- 1D bearish;
- 4H **et** 1D bearish;
- dernier 4H ou 1D manquant / contexte inconnu.

Les cohortes **se recouvrent** et les trades gardent leur exécution et leur résultat originaux. Pas d'optimisation des paramètres sur la nouvelle période. Les directions 4H et 1D proviennent uniquement des **dernières bougies terminées** à la date d'entrée. Aucune bougie quotidienne ou 4H en formation n'est utilisée. Une direction indisponible n'est pas remplacée par une direction ancienne.

## Garde-fous

- Vérification de l'identité du protocole source, de BTCUSDT, du 1H, du SHORT, de la V1.2 et de la date de départ.
- Rejet des trades antérieurs au début prospectif, des clôtures postérieures à la date d'observation, des contextes non valides et des dates non alignées.
- Suivi des comptes de transactions, victoires, pertes et résultat net moyen par trade fermé, indépendamment pour V1.1 et V1.2.
- Seuil minimal **30 trades clôturés par cohorte et par mode** : nécessaire à une lecture exploratoire, **pas suffisant pour démontrer la rentabilité**. Signaler explicitement l'insuffisance d'échantillon.
- Toujours inspecter les statistiques de couverture, les transactions censurées et le glissement du protocole source.
- Les comparaisons sont conditionnelles et non appariées; un sous-ensemble profitable n'est pas une preuve d'avantage de portefeuille. Aucune promotion automatique, aucune conclusion sur la parité Pine Script.

## Exécution

`.github/workflows/vector-prospective-v12.yml` lance les tests, génère `vector-prospective-v12.json`, puis `vector-mtf-forward-summary.json`. L'artefact GitHub `vector-prospective-btc-1h-short` contient les deux. Un test avant la date de départ retourne `NOT_STARTED` sans simuler l'avenir.

**La planification automatique quotidienne n'est pas installée.** Le workflow est disponible par les pushes correspondants sur la branche dev; aucune modification à `main` pour activer un cron. Des exécutions ultérieures doivent être déclenchées explicitement ou planifiées séparément après autorisation.

## Étude suivante distincte (30M / 15M)

Comparer l'apport d'un signal d'exécution 30M puis 15M sous des contextes 1H / 4H terminés, **sans retoucher rétroactivement** le protocole prospective BTC 1H. Définir d'abord un benchmark d'entrées et sorties, horizon équivalent en heures, frais et effets de microstructure, puis réserver une période chronologique nouvelle pour validation. Les timeframes plus courts ne sont pas automatiquement plus précis et peuvent multiplier les faux signaux et les coûts.
