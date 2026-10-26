# Vector : conditions observables au signal avant les retournements manqués

**Audit uniquement dans `dev/v1.26.0` : aucune modification au Pine, aux versions V1.1–V1.5, à `index.html`, aux deux études prospectives V1.2/V1.3 déjà verrouillées, ou à `main`. Aucun ordre Bitunix.**

## Objectif

Après la V1.4/V1.5, les résultats suggèrent que **certains signaux erronés sont filtrés mais des retournements utiles restent manqués**. Avant de proposer une V1.6, étudier les **caractéristiques déjà visibles à la clôture du signal**. Les signaux rejetés peuvent ensuite être comparés selon leurs **résultats futurs, uniquement comme étiquettes rétrospectives**, sans fuite temporelle.

## Fenêtre et données figées

- Exactement la même fenêtre que le journal précédent : **2026-07-28 01:00 UTC → 2026-10-26 01:00 UTC**; coupure au **2026-09-11 01:00 UTC**. Les historiques ont déjà servi aux études précédentes : **ce n'est pas un holdout vierge**.
- Bitunix BTCUSDT, ETHUSDT, SOLUSDT, intervalle **1H**, lecture seule via CryptoJuju; trous, duplications, OHLC invalides en quarantaine, indicateurs réinitialisés par fenêtre continue.
- Seules les V1.4 et V1.5 sont évaluées comme filtres de la référence V1.1. Le code d'exécution de ces versions et les étiquettes passées `potential_missed_move`, `possibly_avoided_loss`, `ambiguous`, `censored` restent **inchangés**. Ils proviennent du `vector-event-ledger.mjs` existant.

## Caractéristiques causalement disponibles à la clôture

Toutes calculées avec l'historique jusqu'à la chandelle du signal **incluse**, jamais après :

1. **Pente EMA50 sur 3 bougies**, signée selon le LONG/SHORT envisagé : pente négative pour un SHORT devient favorable.
2. **Distance du prix à l'EMA50 en unités ATR14**, signée selon le côté visé.
3. **Progression directionnelle avant le signal**, sur 3 h et 6 h, en pourcentage signé.
4. **Volatilité** : ATR14 / prix de clôture, pourcentage; corps de la chandelle / ATR.
5. **Volume relatif** : volume du signal / moyenne SMA20 des volumes.
6. **Rupture structurelle** : la clôture a-t-elle dépassé le plus haut/bas des 4 bougies **précédentes** dans la direction envisagée?
7. **Efficacité directionnelle des 6 dernières bougies** : distance absolue parcourue entre clôtures / somme des variations de clôture; proche de 0 = allers-retours, proche de 1 = progression unidirectionnelle. Catégories **< 0,35** (haché), **0,35–0,65** (mixte), **≥ 0,65** (directionnel). Ce sont des catégories **descriptives, non des filtres recommandés**.
8. Marqueur diagnostique d'une impulsion avec corps ≥ 1,25 ATR.

Le moteur décrit des **médianes, quartiles, effectifs**, séparés par actif, côté LONG/SHORT, moitié temporelle et étiquette; **aucune recherche automatique de seuil gagnant**. Sous **10 événements par groupe**, les contrastes sont explicitement jugés trop fragiles pour guider un paramétrage.

Les exemples datés du **11 septembre (SHORT)** et du **8 octobre (LONG)** sont journalisés séparément, avec leur contexte observable au moment du signal. Leur mouvement favorable ultérieur **ne justifie pas** à lui seul de sélectionner une nouvelle règle. Les captures d'écran fournies par l'utilisateur n'ont pas encore de crosshair/timezone confirmés, et ne sont pas une validation tick par tick.

## Intégrité méthodologique

- Calcul des caractéristiques = passé et clôture du signal seulement.
- Étiquette = future excursion à 12 h, **après coup uniquement**, jamais donnée au moteur de trading.
- Une opportunité historique théorique manquée n'est **pas** un rendement réalisable : frais, glissement, stops et ordre intrabar peuvent modifier ou annuler le résultat.
- L'échantillon a subi plusieurs explorations; les séparations antérieure/récente ne sont **pas** des validations indépendantes.
- Éviter tout nouveau filtre V1.6 avant d'avoir vu les contradictions, les faibles effectifs et les pertes potentielles liées aux vrais retournements ratés.
- La version V1.2 et l'essai V1.3 EMA50 continuent leur protocole indépendant, sans toucher à leur date de début ni leurs paramètres.

## Livrables

- `backtest/vector-preconditions-audit.mjs` + `.test.mjs`
- `.github/workflows/vector-preconditions-audit.yml` ; artefact `vector-closed-bar-preconditions-90d` (JSON intégral, CSV/groupes, JSON événements).
