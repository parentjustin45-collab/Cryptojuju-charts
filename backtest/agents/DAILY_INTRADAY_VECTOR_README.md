# CryptoJuju — tester le Daily comme filtre pour Vector 15M, 1H et 4H

## Hypothèse à vérifier, et non vérité absolue
Un Daily haussier peut coexister avec une correction SHORT sur le 15M ou le
1H, et inversement. Ce pilote cherche à savoir si le filtrage des signaux
intraday non alignés sur la tendance Daily est vraiment utile.

La tendance Daily est dite « haussière » si les EMA 21, 34, 50 sont
alignées dans cet ordre, que la clôture est au-dessus de l'EMA21 et que
l'EMA50 augmente sur trois journées terminées. Les conditions sont
symétriques pour « baissière ». Sinon le Daily est neutre/mixte.

Le filtre lit **seulement** les données des journées Daily Bitunix
**entièrement fermées** et applique une marge de 120 secondes après
clôture pour la disponibilité (marge de recherche, non mesurée).
Au changement de journée à 00:00 UTC, le signal sur cette toute nouvelle
journée ne peut pas connaître sa clôture. Toute lecture du jour en
cours est donc interdite.

## Campagne expérimentale
Pour BTCUSDT uniquement :
- Une fenêtre de 365 bougies Daily fermées, lue deux fois et identique.
- Trois fenêtres indépendantes de 960 bougies fermées en 15M/1H/4H,
  chacune relue entièrement avec rejet au moindre écart OHLCV.
- Les conditions de source et de précision du contrat sont revérifiées.
- Quatre modes : V1.1 inchangée, V1.1 + filtre Daily,
  V1.2 break_extreme_2 inchangée, V1.2 + filtre Daily.
- Quand une inversion est refusée et qu'une position est ouverte,
  la simulation émet FLAT à l'ouverture suivante au lieu de laisser
  courir artificiellement l'ancienne position.
- Frais/slippage identiques dans ces quatre simulations ;
  entraînement et validation historiques 70/30 sont séparés,
  sans en déduire un résultat hors échantillon prospectif.

Rapports : `BTCUSDT-daily-mtf-summary.md` et JSON détaillés dans
l'artefact GitHub Actions temporaire.

**Limites** : les signaux Daily peuvent être tardifs; les filtres
peuvent supprimer de bonnes transactions contre-tendance. La
marge 120 secondes est supposée et non chronométrée sur le flux réel.
Les fenêtres examinées ont déjà servi au développement et les
résultats ne garantissent pas de profit. Aucune variante promue.
Aucune utilisation de TradingView, trading automatique, `main`,
site public, Render ou API privée.

## Diagnostic des occasions rejetées par le Daily (nouvelle étape)
Le composant `daily-signal-veto-diagnostics.mjs` calcule, APRÈS la décision
Vector et Daily, l'évolution de chaque signal sur 3, 6 et 12 bougies
fermées : mouvement directionnel entre l'ouverture de la prochaine
bougie et la clôture à l'horizon, excursion favorable (MFE), excursion
adverse (MAE), nombre de signaux acceptés/refusés et résultats censurés
près de la fin d'échantillon. Les rejets opposés sont séparés des rejets
neutral/mixed/unknown. Le test exige l'horodatage du signal et de la
prochaine ouverture, et interdit le contexte Daily futur.

**Attention :** ces mouvements ne sont pas des transactions exécutables :
les signaux se chevauchent parfois, l'ancienne position peut être fermée
(FLAT), et les sorties à horizon fixe ne sont pas la stratégie réelle.
Aucun coût ni funding n'est appliqué au diagnostic; on ne déclare
jamais un signal gagnant, un profit raté ou une version supérieure.
La méthode sert à repérer les configurations où une expérience ciblée
avec frais, risque et validation séparée serait pertinente.

## Laboratoire de risque sur les signaux Daily rejetés (étape suivante)
`daily-veto-risk-paper.mjs` simule des **cohortes indépendantes** :
signaux V1.1 refusés car opposés au dernier Daily clos, et signaux
alignés (témoin). Une seule position par cohorte à la fois; les
signaux simultanés ou chevauchants ne sont pas exécutés deux fois.
Entrée à l'ouverture suivante. Stop = 1,5 × ATR Wilder(14) établi avec
les seules bougies déjà closes au signal; take-profit = 2R;
sortie au maximum après 12 bougies; sortie forcée en fin de phase.
Dimension avec risque nominal 1 %, exposition maximale de 100 % du
capital fictif (pas de levier). Friction par côté base : frais 0,06 %,
glissement 0,05 %; scénario stress : frais 0,10 %, glissement 0,20 %.
Si stop et objectif sont touchés dans la même bougie, appliquer STOP
en premier; si gap dépasse le stop, remplir au cours d'ouverture plus
défavorable. Drawdown calculé sur transactions clôturées seulement,
donc les risques intratrade sont SOUS-ESTIMÉS.

Ces frais, spreads et stops sont fictifs, pas des exécutions garanties.
Les positions préexistantes du portefeuille Vector ne sont PAS
reproduites : **il est interdit de qualifier ces rendements de profits
réels manqués ou de les additionner aux rendements du backtest Vector.**
Le résultat est un outil de décision pour formuler des hypothèses,
sans promotion automatique ni modification des signaux en production.


### Contrôle de causalité supplémentaire
Le simulateur de risque refuse maintenant les observations Vector présentées
hors ordre chronologique, ainsi qu'un signal prétendument aligné ou opposé
au Daily sans horodatage valide de la dernière journée fermée. Un signal
MIXED admis nécessite la politique souple. Les états Daily indisponibles
ne peuvent être déguisés en état connu. Ces contrôles interdisent des
simulations qui auraient pu attribuer incorrectement les positions et les
résultats à une chronologie réarrangée.
