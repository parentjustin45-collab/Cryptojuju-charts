# CJ Cipher V1.1 expérimental — une seule hypothèse, figée avant résultats

19 novembre 2026, heure du Québec. Protocole : `cj-cipher-v11-lock.json`.
Cette inscription précède l'exécution de la nouvelle comparaison ATR. L'historique
source a déjà été inspecté : aucune validation aveugle n'est revendiquée.

## Règle unique

Conserver le Pine et le JavaScript V1.0 (EMA10/EMA21/SMA4) intégralement.
Au croisement fermé LONG ou SHORT, la variante sort immédiatement l'ancienne
position à l'OPEN suivant et attend une bougie **supplémentaire fermée**.
Si WT1 est encore strictement supérieur à WT2 pour LONG, ou inférieur pour
SHORT, autoriser l'entrée à l'OPEN suivant cette confirmation : délai +1h.
Un croisement contraire ou une égalité annule le candidat. Pas de nouvelle
tentative plus tard. Un nouveau croisement crée son propre candidat.
La priorité donnée à la sortie immédiate évite de conserver l'ancienne position
pendant l'attente. Le changement testé est donc une **politique d'entrée avec
sortie à plat pendant la confirmation**, pas une simple translation des points.

Chaque phase repart à plat, avec 1 000 $ fictifs, sans candidat en attente de la
phase précédente. Les confirmations impossibles à exécuter avant la frontière
sont comptées séparément. Aucun filtre extrême, changement d'EMA ou réglage
supplémentaire. Aucun choix du meilleur délai parmi plusieurs variantes.

## Comparaison commune

BTC/HYPE/1000PEPE × 960 bougies 1H closes; séparation 672/288. Pour les deux bras,
réutiliser **le même simulateur intégré** : Wilder ATR14, stop 1,5 ATR, cible 2R,
timeout 12 bougies, risque nominal 1 %, notionnel maximal 100 %, sans levier.
Frais et glissement par côté : base 0,06 % + 0,05 %; stress 0,10 % + 0,20 %.
Règles de gap/stop, collisions stop-cible et valorisation identiques.
Le drawdown est mesuré aux clôtures, pas au pire mouvement intrabar.
Les métriques `reversal-only` précédentes ne sont pas comparables aux rendements ATR.

L'archive exacte Actions 44656240484 est conservée dans le dépôt avec SHA-256,
pour rester rejouable après l'expiration de l'artefact GitHub. Vérifier les deux
lectures, les empreintes recalculées et les commandes V1.0 originales.

Mesurer sur les deux phases, base/stress : rendements, drawdowns, trades,
LONG/SHORT, inversions effectives à ≤3h/≤6h, candidats rejetés, délai/prix d'entrée,
trades V1.0 gagnants rejetés ou devenus perdants après délai, et périodes sans trade.
Les « bons départs » sont définis **après coup** comme les trades réellement gagnants
du bras V1.0 ATR. Leur devenir dans V1.1 décrit un coût d'opportunité, pas une
capacité à connaître un futur gagnant. Un candidat accepté peut ne pas produire
de trade selon l'état du portefeuille : le rapport doit distinguer les deux.
Les séries sans position mesurent des bougies sans aucune position pendant la
bougie, et ne prétendent pas reconstituer le chemin intrabar.

## Période prospective déclarée

Du **19 novembre 2026 à 23h00 au Québec** (`2026-11-20T04:00:00Z`) au
**1 décembre 2026 à 23h00 au Québec** (`2026-12-02T04:00:00Z`), fin exclusive :
288 bougies 1H. Les 672 bougies antérieures servent au calcul/warm-up, et non
à la décision prospective. Pas de collecte des rendements futurs avant la fin.
La collecte fixe sera disponible manuellement après la fin +2 minutes.
Cette inscription **ne programme pas** un job ou une surveillance.

Critères figés pour seulement autoriser une étude plus large : au moins 20 trades
par bras et marché; au moins 80 % des trades gagnants V1.0 conservent un trade
V1.1 gagnant; rendement et drawdown non dégradés sur chacun des trois marchés
en base ET stress; rendement base strictement meilleur sur au moins deux marchés;
nombre ET proportion des sorties à signal opposé ≤6h inférieurs en base, cumulés
sur les trois marchés. Un échantillon insuffisant reste INSUFFISANT, pas un succès.
Même un succès ne valide ni une rentabilité réelle ni un déploiement.

Une seule passe sur la fenêtre historique connue, conserver aussi les échecs.
Ne pas retoucher le délai après les résultats. Si l'hypothèse déçoit, documenter
le compromis et préenregistrer une autre hypothèse sur une nouvelle période.

Branche `dev/ai-agents-phase1` uniquement; aucune modification de `main`,
`dev/v1.26.0`, du site public ou du Pine original; aucun ordre réel ni dépense.
