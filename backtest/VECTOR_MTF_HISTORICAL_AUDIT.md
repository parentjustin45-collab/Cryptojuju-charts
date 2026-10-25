# Vector V1.2 : analyse multi-timeframe 1D → 4H → 1H

**Statut : recherche historique uniquement.** Aucun changement à `main`, au site public, aux signaux Pine V1.1 ni au protocole prospectif BTC 1H SHORT déjà verrouillé pour le 26 octobre 2026 00:00 UTC.

## Objectif
Vérifier par des mesures si la direction du Vector sur de grandes unités de temps apporte une information sur la précision et le rendement du SHORT 1H. Le 1D ne constitue pas a priori un signal « plus précis » : la fréquence, le retard et l'erreur doivent être mesurés.

## Périmètre fixé avant exécution
- BTCUSDT Bitunix, **365 jours** de données historiques, chandelles closes seulement.
- Entrées **1H SHORT** : baseline Vector V1.1 et candidat `break_extreme_2` V1.2; mêmes quatre confirmations et autres paramètres V1.1; aucune réoptimisation.
- Contexte **4H / 1D** : dernière chandelle **complètement clôturée**, calcul vectoriel propre à chaque période. En absence de la dernière chandelle nécessaire : valeur inconnue; pas d'extrapolation.
- Comparaison descriptive des trades **déjà pris sans filtre** avec les sous-groupes : tous, 4H bearish, 1D bearish, les deux bearish, les deux bullish, contexte inconnu. Ces sous-groupes **se recoupent** et ne sont pas des stratégies portefeuilles indépendantes.
- Entrée au prochain open; stop 1,5 %, objectif 3 %, maximum 12 bougies 1H, frais 0,06 % par côté, glissement 0 % et 0,05 % par côté; mêmes règles et coûts pour toutes les cohortes.
- Partage chronologique moitié antérieure / moitié récente, positions traversant la séparation exclues des rendements; trous de données isolés sans créer de bougies artificielles; au moins 30 trades clôturés requis pour une interprétation exploratoire d'un sous-groupe.

## Limitations importantes
- **Les 365 jours ont déjà servi aux travaux Vector précédents** : la moitié récente **n'est pas** un holdout indépendant pour la V1.2. Aucun avantage sur cette période ne sera traité comme validé hors échantillon.
- Les cohortes filtrées sont des analyses conditionnelles sur un flux de trades **sans filtre**. Ce n'est pas un backtest d'une nouvelle stratégie avec gestion des positions et réinvestissement.
- Moyenne nette par trade clôturé, non rendement composé d'un compte de trading. Les positions censurées, les trous de données et la faible taille d'échantillon peuvent biaiser les résultats.
- Toute éventuelle règle combinant 1D/4H et 1H devra être enregistrée à l'avance et validée sur de **nouvelles données prospectives**, après contrôle de la parité Pine Script.
- Le 30M et le 15M constituent les étapes ultérieures (analyse descendante), pas des conditions introduites sans contrôle dans l'expérience BTC 1H.
- Le workflow est déclenché par push correspondant sur `dev/v1.26.0`. Ne pas supposer qu'il fonctionne chaque jour : une planification GitHub Actions sur `main` n'est pas activée et nécessiterait une décision séparée. **Ne pas modifier `main` sans autorisation.**

## Fichiers
- `backtest/vector-mtf-history.mjs` : lecture Bitunix avec quarantaine et agrégats par sous-groupe.
- `backtest/vector-mtf-history.test.mjs` : tests anti-lookahead et contrôle des frontières temporelles.
- `.github/workflows/vector-mtf-history.yml` : job de validation et artefact `vector-mtf-history-365-days`.

Le rapport JSON GitHub doit être examiné avant de tirer une conclusion. Un workflow vert signifie que le programme a réussi, pas que la stratégie est rentable.
