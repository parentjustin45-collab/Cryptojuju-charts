# Vector V1.1 vs V1.4 — comparaison prospective verrouillée (Bitunix)

**Date de verrouillage : 26 octobre 2026.** La première chandelle éligible ne peut commencer qu'à **2026-10-28 00:00:00 UTC**. Les chandelles historiques servent **uniquement à réchauffer les deux moteurs**, et ne produisent aucune transaction comptée. **Le futur ne sera pas antidaté.**

## Échantillon et stratégie

- **BTCUSDT, ETHUSDT, SOLUSDT 1H**, vrais OHLC Bitunix futures LAST_PRICE en lecture seule via relais CryptoJuju. Aucune clé Bitunix, aucun ordre.
- Moteurs **V1.1 (Pine JS audité)** et **V1.4 structure/hysteresis inchangée**. Les deux reçoivent exactement les **mêmes chandelles clôturées et strictement continues** après quarantaine des erreurs et doublons.
- **168 chandelles antérieures au démarrage** pour initialiser les indicateurs; après chaque trou, minimum **55 chandelles consécutives** avant un nouveau signal exploitable, sans inventer de prix.
- **Deux comptes de simulation indépendants**, l'un V1.1, l'autre V1.4. **Une seule position à la fois par compte**, quel que soit le sens LONG/SHORT. Ne jamais mélanger P&L des deux comptes ou superposer fictivement leurs longs/shorts.
- Entrée **à l'OPEN de la chandelle suivant un signal confirmé à sa clôture**. Si l'open n'est pas encore connu via une bougie valide, statut `open_pending` sans prix d'entrée inventé.
- Mêmes règles fixées : **stop 1,5 %**, **take-profit 3 %**, **sortie au plus tard après 12 chandelles 1H**, frais de **0,06 % de chaque côté**, glissement supposé de **0,05 % de chaque côté**.
- **Ordre intrabar non observable en 1H : si stop et cible touchés dans une seule bougie, arrêter en premier au stop (pire cas).** Pour un saut de prix en ouverture au-delà du seuil, remplir à l'open réel avec glissement. Ne pas inventer de stop parfait.
- **Pas de sortie au signal opposé** dans cette première expérience : règle fixe identique aux deux versions pour isoler *la qualité et le délai des entrées*.
- Une transaction sans horizon complet est `open_pending` tant que le flux est simplement en attente de nouvelles chandelles. Si des chandelles manquent dans son futur historique, elle est **censurée**, jamais gagnante ou perdante artificiellement. Pour chaque trade, conserver heures, sens, version, statut, motif, prix d'entrée et net uniquement si clôturé.
- Les métriques seront séparées par crypto et version, avec effectifs, nets moyens/médians **par trade**, taux gagnants, stop, take et timeout. Les nets cumulés ne représentent **PAS** un portefeuille composé ni l'exposition au risque réelle.
- **Minimum indicatif de 30 trades clôturés par modèle et crypto** avant d'envisager un contraste; ce seuil n'est pas une preuve statistique et n'autorise pas à choisir une version après coup.

## Anti-fuite, propriété et déploiement

- Code : `backtest/vector-forward-v11-v14.mjs`, tests `.test.mjs`, workflow `.github/workflows/vector-forward-v11-v14.yml`.
- La barrière `2026-10-28T00:00:00Z`, les marchés et TOUS les frais, glissements, limites et versions sont **immuables pour ce protocole**.
- Ne jamais recalculer un P&L prospectif à partir d'une version de script modifiée pendant l'expérience. Pour verrouiller réellement le code, le **checkout du workflow est épinglé à un commit déterminé**, et toute évolution importante exige un NOUVEAU protocole.
- Le workflow est dans **`dev/v1.26.0` uniquement** et est exécutable au déclenchement manuel `workflow_dispatch`; les `schedule` GitHub Actions ne tournent **que sur la branche par défaut**, donc ne pas prétendre qu'un cron dans dev assurerait une collecte récurrente. Un déclencheur externe autorisé sera nécessaire pour une collecte automatique durable.
- **Pas d'optimisation** des V1.1/V1.4, aucune V1.6 promue ni modification du site Render de test / du site principal / de `main` dans cette étape.
- **Les données futures ne sont pas garanties inédites sans journal de provenance** : vérifier `generatedAtUtc`, le commit code fixé, le hash du protocole, la qualité OHLC et les runs GitHub.
- Toute recommandation de trading restera interdite sur les seuls chiffres préliminaires, surtout avant assez de transactions et une validation indépendante.

## Première observation

Avant le 28 octobre, le statut doit être **`ARMED_NOT_STARTED`**, avec **zéro transaction prospective** pour les trois marchés. Il est normal que les prix de marché de l'historique apparaissent dans le diagnostic de qualité d'entrée, mais ils ne doivent produire **aucune performance postérieure inventée**.
