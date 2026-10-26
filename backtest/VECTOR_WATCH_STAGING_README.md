# CryptoJuju V1.26.0 — Prévisualisation séparée WATCH sur données Bitunix

**Laboratoire : aucun déploiement automatique.** La branche `dev/v1.26.0` ne modifie pas `main`, le site GitHub Pages public, les moteurs V1.1–V1.5 ni un compte Bitunix.

## Nature des données

Le workflow `.github/workflows/vector-watch-real-bitunix.yml` :
1. Demande des chandelles **BTCUSDT, ETHUSDT, SOLUSDT en 1H** à Bitunix. Le relais CryptoJuju `/api/bitunix/proxy` est tenté en premier; en cas d'échec de transport seulement, l'endpoint officiel `fapi.bitunix.com` est utilisé directement. **Aucun fallback Bitget/OKX/Binance ne peut être présenté comme Bitunix.**
2. Valide heures UNIX, cohérence OHLC, absence de doublons et de trous dans la dernière plage d'au moins 55 bougies clôturées. Refuse une dernière bougie de plus de 2 heures de retard. Ne fabrique **aucune bougie**.
3. Appelle exactement `readVectorWatchState(...)` du navigateur sur ces chandelles clôturées. Les WATCH ne sont ni des entrées ni des sorties.
4. Sert le vrai site **en réseau isolé dans Chromium**; injecte uniquement ces données Bitunix vérifiées dans l'écran d'essai pour BTC, ETH, SOL. Vérifie que la pastille affiche le même état que le moteur test, que les anciens marqueurs V1.1 restent identiques, que la pastille ne déborde pas de 1440×900 ou 390×844.
5. Préserve des captures PNG, un JSON de traçabilité des bougies et un **ZIP de staging** prêt à servir sur un hébergeur indépendant.

**Important :** ces captures utilisent les prix de Bitunix relevés lors de l'exécution, mais le navigateur ne maintient **aucun WebSocket live** dans l'essai. Elles sont des **instantanés réels**, pas une validation de flux en continu. Aucune garantie de rendement n'en découle.

## Pour tester sur Android

Le ZIP `vector-watch-staging-v1.26.0.zip` contient les fichiers nécessaires (`index.html`, modules `backtest/`). Il faut le servir **depuis un serveur HTTPS ou HTTP local**, pas ouvrir le HTML directement depuis `file://`, car les imports `import()` sont limités par la sécurité du navigateur. Les contrôles Bitunix en direct du site nécessitent un accès Internet au serveur CryptoJuju.

**Le ZIP ne fournit pas à lui seul une adresse publique.** Pour un lien mobile, il faut déployer cette copie sur un **hébergement de test distinct**; NE PAS reconfigurer GitHub Pages actuel ou remplacer le site de production sans autorisation supplémentaire. Cette étape est à faire séparément.

## Critères avant fusion

- Aucun calcul n'utilise une bougie non clôturée.
- Les alertes WATCH peuvent être activées/désactivées indépendamment par carte, **OFF par défaut**.
- Le changement de symbole/timeframe élimine l'ancien WATCH.
- Les flèches Vector V1.1, les scores scanner et le régime V1.4 ne sont pas modifiés.
- Une panne ou un trou de données affiche **indisponible** et ne fabrique pas d'alerte.
- Un essai manuel sur le **Samsung réel**, avec réseau mobile et Wi-Fi, reste indispensable avant publication.
