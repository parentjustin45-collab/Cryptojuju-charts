# CryptoJuju V1.26.0 — Contrôle d'intégrité des données, 18 novembre 2026

## Décision
**Validation ciblée RÉUSSIE en environnement de développement** pour les chandelles BTCUSDT, ETHUSDT et SOLUSDT futures Bitunix en 15m, 1h et 4h. **Aucun déploiement sur main.**

## Données observées
- GitHub Actions [test du vrai graphique sur 9 configurations](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44314239552) : **succès**.
- 480 chandelles **fermées** comparées par symbole/timeframe, soit **4 320** chandelles au total. Le navigateur a chargé 500 chandelles par configuration.
- 62 anomalies OHLC à l'état brut : BTC 11/8/1 ; ETH 19/10/3 ; SOL 5/4/1 (15m/1h/4h).
- Après normalisation vérifiée et traçable : **0 OHLC invalide**, **0 différence de prix entre le graphique et le moteur de recherche**, **0 différence entre la série réellement affichée et les données utilisées par les indicateurs**, **0 chandelle fermée manquante** dans les fenêtres contrôlées.
- Les valeurs brutes de Bitunix restent conservées en mémoire et dans les rapports GitHub. Les OHLC ne sont dérivés que lorsque l'ouverture correspond à la fermeture précédente et qu'elle est le seul élément absent de l'enveloppe high/low. Anomalie indémontrable -> écran et signaux BLOQUÉS.
- Une chandelle au début de la fenêtre ETH 15m nécessitait un **ancrage Bitunix antérieur réel**, obtenu via le même proxy. Aucun prix fictif n'est généré.
- Le [contrôle WATCH sur données BTC/ETH/SOL 1h](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44312999696) a réussi après normalisation traçable. Aucun ordre exécuté.

## Chandelles en direct
- Le [test réel 8h00 Québec, 18 novembre](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44306946214) a réussi, avec la nouvelle chandelle BTCUSDT visible dans **225 ms** sur 1h et 15m, sans copies des valeurs O/H/L antérieures.
- Un [deuxième test du passage à l'heure](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/44314658533), lancé après intégration du traitement historique au navigateur, est **en cours** au moment de cette note. Ne pas préjuger son résultat.

## Limites et conditions avant livraison publique
- Les deux voies Bitunix direct REST et proxy CryptoJuju viennent de la même source externe. Cela ne constitue PAS une comparaison indépendante exhaustive avec TradingView ; seules quelques anomalies ont été vérifiées manuellement par captures.
- Cette validation ciblée ne couvre pas encore d'autres symboles, ni les timeframes 30m, Daily et Weekly, ni tous les événements de déconnexion/relance sur plusieurs jours.
- Les signaux de trading et la rentabilité de Vector ne sont **pas** validés par ces contrôles de données.
- La normalisation appliquée au navigateur est activée sur dev pour **15m/1h/4h** ; autres timeframes non revendiqués comme vérifiés.
- Ne pas modifier ni déployer sur `main` sans l'autorisation explicite de l'utilisateur. Avant une éventuelle promotion : confirmer le second rollover, examiner les alertes nouvelles, puis décider d'une recette plus large.

## Références
- Branches : `dev/v1.26.0` pour tests et correctifs, `main` conservée intacte.
- Tests unitaires/régression en `backtest/ohlc-frontend-history-integration.test.mjs` et `backtest/ohlc-bitunix-open-envelope.test.mjs`.
- Confrontation réelle : `backtest/ohlc-frontend-derived-parity-audit.mjs`.
