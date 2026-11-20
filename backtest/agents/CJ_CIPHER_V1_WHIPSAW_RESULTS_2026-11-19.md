# CJ Cipher WT V1.0 — Résultats vérifiés du diagnostic des croisements

**19 novembre 2026 (heure du Québec)** — analyse de l'artefact original
GitHub Actions **44656240484**, sans lire un autre intervalle de marché,
sans modifier la version Pine V1.0, ni le port JavaScript V1.0.

Workflow d'audit :
[DEV diagnose EXACT CJ Cipher V1 crosses — run 44661279539](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44661279539)
**SUCCÈS : 13/13 tests**; campagne générale GitHub
[44661279466](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44661279466) **SUCCÈS : 150/150**.
La deuxième campagne originale CJ Cipher
[44661279602](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44661279602) a aussi réussi, mais les statistiques ci-dessous sont strictement celles de l'archive originale figée.

L'artefact des descriptions complètes de chaque transaction est
[cj-CIPHER-V1-CROSS-WHIPSAW-EXACT-REPLAY](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44661279539/artifacts/14595796676)
(conservation jusqu'au 27 novembre 2026). SHA du code étudié :
\`47e3fcf4aef5c22e4cc1d1c2e78eb7a0f7c98e45\`.

## Vérifications qui doivent être satisfaites

- BTC, HYPE, 1000PEPE × 960 bougies **1H fermées** depuis Bitunix
  LAST_PRICE, contrôle de provenance brute/normalisée, deux lectures
  identiques et aucune valeur de bougie future ajoutée à la série.
- Recacul des croisements V1.0 sur les mêmes chandelles : 146 signaux BTC,
  148 HYPE, 136 PEPE (commandes finales non exécutables exclues).
- Rejeu du moteur historique original, à signal confirmé puis prochaine
  ouverture; frais 0,06 % + slippage 0,05 % PAR CÔTÉ, et scénario stress
  0,10 % + 0,20 % PAR CÔTÉ.
- **Correspondance exacte** avec les comptes de transactions et
  correspondance numérique sous 0,00001 point de pourcentage avec les
  rendements, win rates et drawdowns précédents en entraînement 70 % et
  validation historique 30 %. Pas de nouveau modèle d'exécution.
- Les fenêtres de validation sont déjà examinées, **pas prospectives**.

## Résultats sur 30 % historique en 1H, scénario de base

| Marché | Transactions | Prix brut contre la direction | Croisement opposé ≤3h | Croisement opposé ≤6h | Brut favorable mais net perdant | Durée médiane | Rendement net fictif |
|---|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 39 | 24 | 11 | 23 | 5 | 6h | −7,17 % |
| HYPEUSDT | 43 | 29 | 14 | 25 | 0 | 5h | −2,72 % |
| 1000PEPEUSDT | 39 | 26 | 12 | 23 | 1 | 5h | −26,05 % |
| **Total de cas** | **121** | **79** | **37** | **71** | **6** | — | **Non additionnable** |

Les « prix bruts contre la direction » mesurent la variation entre
l'OPEN effectif suivant le croisement et l'OPEN de la commande inverse
(ou le CLOSE final de phase) avant frais et glissement. Un signal peut
représenter une sortie valide malgré un retournement rapide : **on ne
peut pas qualifier 79 signaux de « faux »**, ni attribuer avec certitude
la perte à un mécanisme causal unique. Les 71 inversions en ≤6h
indiquent une **fréquence de changement de direction**, pas une
probabilité de mauvais trade.

Les **6 trades** dont le prix brut était un peu favorable mais le
résultat net était perdant illustrent des coûts d'exécution hypothétiques.
Cela ne prouve pas que les frais expliquent les 115 autres trades :
le problème prioritaire observé est plus large (qualité et timing des
mouvements, et incapacité à sélectionner les swings durablement
favorables dans ce modèle d'inversion).

## Résultats exploratoires sur 70 % d'entraînement

| Marché | Trades | Prix brut à contresens | Inversion en ≤6h | Brut favorable mais net perdant |
|---|---:|---:|---:|---:|
| BTC | 107 | 73 | 69 | 10 |
| HYPE | 105 | 72 | 63 | 3 |
| PEPE | 97 | 64 | 56 | 4 |
| **Total** | **309** | **209** | **188** | **17** |

Ces observations vont dans le même sens que la période de validation,
mais proviennent d'une série de marché historique commune et ne
constituent **pas** une preuve statistique indépendante.

## Ce que les résultats NOUS AUTORISENT à faire ensuite

**Ne pas modifier V1.0** à partir de ces résultats : conserver
les paramètres EMA10/EMA21/SMA4, les croisements sans divergences et
\`confirmClose=true\` comme référence.

1. Étudier **une seule hypothèse V1.1 anti-bruit** définie à l'avance,
   par exemple attendre une confirmation par une nouvelle bougie
   fermée avant d'autoriser une entrée. Cette hypothèse a un coût de
   retard ; elle risque de rater des départs qui sont bons. Les seuils
   et délais ne doivent pas être ajustés pour « sauver » ces trades
   connus.
2. Mesurer les transactions refusées ET les opportunités manquées,
   les longues périodes sans trades, les faux retournements et la
   distribution LONG vs SHORT.
3. Utiliser **le même moteur ATR** (stop, cible, timeout, allocation,
   frais base/stress) pour V1.0 et la variante expérimentale V1.1.
   Ne pas mélanger les rendements du portefeuille reversal-only actuel
   avec ceux des backtests ATR antérieurs.
4. Fixer et annoncer une nouvelle période prospective avant de lire
   ses rendements. Aucun champion sans taille d'échantillon et
   stabilité sur plusieurs contrats/timeframes.
5. Après validation individuelle, tester CJ Cipher avec SPEED et Frank
   Test séparément puis ensemble. La compatibilité en combo ne se
   déduit pas des résultats seul.
6. La parité TradingView chiffrée n'est **pas une étape obligatoire
   immédiate** dans l'orientation choisie par l'utilisateur. Vérifier
   néanmoins les calculs sur bougies fermées, la causalité et
   l'absence de repaint/anticipation.

## Portée du modèle et interdictions

La simulation 2026 d'origine sortie uniquement à l'inversion suivante
ou à la dernière clôture de chaque phase, sans stop ATR, sans objectif,
sans gestion de slippage réel, de funding et des tailles de lots.
Les pertes fictives et taux de réussite ne sont pas des résultats
d'ordres. Aucun achat, position réelle, stratégie promue, frais
Render, déploiement, modification de \`main\`, \`dev/v1.26.0\`
ou du site public. Tous les travaux sont sur
\`dev/ai-agents-phase1\`.
