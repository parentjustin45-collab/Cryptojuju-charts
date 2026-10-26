# CryptoJuju Vector — Deux étapes : WATCH / LONG-SHORT confirmé

**Hypothèse gelée sur `dev/v1.26.0` avant le résultat historique, 26 octobre 2026 UTC.** Recherche indépendante et lecture seule, sans modification au site public, à Pine, aux moteurs V1.1–V1.5, aux protocoles prospectifs BTC déjà verrouillés ou à la branche `main`.

## Déclenchements

1. **WATCH LONG / WATCH SHORT** : première **chandelle Vector V1.1 clôturée** opposée à la direction *déjà confirmée* et non neutre de la machine V1.4, à condition que la V1.4 ne confirme pas déjà le retournement sur cette même chandelle. Une seule WATCH active par candidat. **Ce n'est ni un signal d'entrée ni un appel de trade.** Aucun stop n'est désactivé, aucune position n'est fermée ou ouverte.
2. **CONFIRMED LONG / CONFIRMED SHORT** : exactement la sortie de **la V1.4 inchangée** sur cette même chandelle; aucune condition additionnelle, aucune utilisation des WATCH pour accélérer les inversions. Les flèches sont identiques **bit à bit** au moteur de référence.
3. L'alerte WATCH se termine si sa chandelle source est confirmée par V1.4 (mesurer le délai 1 à 3 clôtures), si une chandelle Vector opposée annule le candidat, si une autre confirmation le remplace, ou si trois bougies écoulées ne valident pas le retournement. En fin de fenêtre : `censored_end`. Aucune supposition de confirmation future.
4. Si V1.4 confirme sur la même chandelle, la WATCH est **supprimée** : aucun faux avantage d'avance.
5. Pas de classification de probabilité « IA » à partir de ces événements : un candidat LOOKAHEAD n'est jamais utilisé par l'algorithme; l'alerte précoce est **simplement l'impulsion brute d'une première chandelle Vector opposée**. C'est une distinction d'interface, pas une amélioration prédictive démontrée.

## Mesure exacte

- Bitunix BTCUSDT, ETHUSDT, SOLUSDT **1H**, historique **2026-07-28 01:00 UTC → 2026-10-26 01:00 UTC**, coupure au 11 septembre 01:00 UTC. **Ces données sont déjà explorées et ne représentent aucun holdout vierge**.
- Pour chaque WATCH : côté, direction confirmée encore conservée, heure, prix de clôture, corps/ATR, statut de résolution, délai si confirmé, correspondance éventuelle avec signal V1.1 rejeté.
- A posteriori seulement : retour directionnel brut de l'open suivant à la clôture douze heures plus tard, excursion favorable/adverse, si les douze bougies sont valides et ne traversent pas la coupure; sinon censure.
- On reprend les mêmes conventions descriptives historiques : `potential_move` si variation brute directionnelle ≥ +0,4 % ET excursion favorable ≥ +0,8 %, `negative_move` si variation ≤ 0 %, `ambiguous` sinon. **Ce ne sont pas des gains simulés avec stop**, et en aucun cas un ordre ou une probabilité.
- Rapporter les effectifs réels par crypto / moitié temporelle / sens, les WATCH confirmées, expirées, annulées, censurées, délai moyen de confirmation et la proportion des mouvements potentiels. Les échantillons limités interdisent toute conclusion de précision.
- Aucun trade n'est simulé ou déclenché sur WATCH. La performance historique des flèches confirmées reste **strictement inchangée** par construction, puisque ce sont les mêmes événements V1.4.

## Décision

**Ne pas intégrer WATCH en production et ne pas modifier la V1.4 automatiquement** même si l'analyse historique est favorable. Le gain potentiel est une **meilleure lisibilité de l'incertitude** : signaler qu'une inversion pourrait arriver tout en maintenant l'ancien état confirmé. La contrepartie est la fatigue visuelle/les alertes prématurées. Privilégier ensuite des observations **futures inédites** (point de départ proposé : **28 octobre 2026 00:00 UTC**) et ne pas assimiler un workflow GitHub déclenché sur push à une surveillance continue : une exécution de collecte future devra être organisée et vérifiée séparément. Ne pas créer de fausse automatisation.

Fichiers de recherche : `backtest/vector-watch-shadow.mjs` et tests, `backtest/vector-watch-90d-study.mjs` et tests, workflow `.github/workflows/vector-watch-shadow.yml` (push sur **dev** et déclenchement manuel uniquement).
