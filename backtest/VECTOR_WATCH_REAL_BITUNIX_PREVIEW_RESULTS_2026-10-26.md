# CryptoJuju WATCH V1.26.0 — Bitunix réel, prévisualisation indépendante (26 octobre 2026)

**Statut : tests RÉUSSIS en laboratoire, pas de publication live.** Branche `dev/v1.26.0` uniquement. Travail vérifié via [GitHub Actions #40300205854](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40300205854), statut `success`. Artefact : `vector-watch-real-bitunix-readonly-staging`, contenant les deux captures d'écran Android/ordinateur, le JSON d'observation et un ZIP de staging.

## Données réelles vérifiées

**Instantané des données : 26 octobre 2026 à 09:31:30 UTC.** Chandelles clôturées **Bitunix Futures, 1H**. Relais CryptoJuju `/api/bitunix/proxy` utilisé pour les trois marchés. Aucune donnée Bitget, OKX ou Binance.

| Marché | Prix dernière clôture disponible | Bougies clôturées continues admises | Anciennes bougies OHLC incohérentes exclues | État WATCH expérimental | Direction V1.4 confirmée |
|---|---:|---:|---:|---|---|
| BTCUSDT | **80 200,10** | **165** | **1** | **Retournement possible LONG** | **SHORT** |
| ETHUSDT | **2 324,37** | **75** | **3** | Pas d'alerte active | **LONG** |
| SOLUSDT | **101,06** | **199** | **0** | Pas d'alerte active | **SHORT** |

Les chandelles OHLC historiques suspectes sont **exclues, jamais corrigées ou interpolées**. Les données actuelles passent toutes le minimum requis de **55 bougies clôturées successives et récentes**; une séquence contenant un trou récent échouerait plutôt que de générer une WATCH de qualité inconnue. Les prix sont des **instantanés historiques de cette exécution** : ne pas les présenter comme des prix « actuellement » négociables lorsque le rapport est consulté plus tard.

## Preuves navigateur (Bitunix réel, mais écran isolé)

Le workflow a servi le vrai `index.html` dev par HTTP local avec la bibliothèque LightweightCharts 4.2.2. Les chandelles Bitunix vérifiées ont été injectées en **lecture seule** dans Chromium, réseau externe désactivé **uniquement dans le navigateur de test** (le téléchargement des données Bitunix a eu lieu avant).

- Format **ordinateur 1440 × 900** et **Android émulé 390 × 844** avec navigateur en `fr-CA`, fuseau `America/Toronto`.
- **BTC, ETH, SOL** : la pastille WATCH affichée est identique aux résultats du module de recherche calculé sur les mêmes données Bitunix.
- Le calcul des anciens marqueurs **Vector V1.1** est conservé; aucun ordre, aucune entrée/sortie, aucun nouveau LONG/SHORT n'est créé.
- La pastille **ne déborde pas du viewport** sur ordinateur ni mobile. Une nouvelle sélection de timeframe efface immédiatement l'état WATCH précédent; le bouton reste **désactivé par défaut** et persiste par carte lorsqu'activé.
- Les deux captures enregistrées représentent **BTCUSDT 1H Bitunix**, affichant un **WATCH LONG possible** tout en conservant un **SHORT confirmé par V1.4**.
- La mention `API OFF` / `aucun tick LIVE reçu` dans les captures est attendue : le réseau du navigateur a été coupé exprès. **Le flux WebSocket Bitunix live n'a pas été testé ni simulé comme réel.**

## Prévisualisation séparée

Le workflow génère `vector-watch-staging-v1.26.0.zip` avec `index.html`, les modules Vector importés dynamiquement et un README. Ce ZIP est prêt à héberger **sur un domaine ou environnement de test distinct**. Il ne constitue **pas à lui seul un site ou lien public**; ouvrir `index.html` en `file://` sur Android peut échouer à cause des restrictions des modules ES. Il faut un serveur HTTP(S).

**Aucun paramètre GitHub Pages actuel ni branche `main` n'a été modifié.** Pas de déploiement public. Il reste une vérification manuelle sur Samsung Android physique et avec flux réseau autorisé avant toute promotion ou lancement réel.

## Discipline trading

- WATCH = **alerte descriptive non tradable**, pas de prédiction ni de signal d'entrée, et pas de modification de la stratégie V1.4.
- La V1.4 n'a toujours pas démontré un avantage net fiable sur les simulations longues; la pastille ne rend pas l'algorithme profitable.
- Aucune API privée, clé, portefeuille, compte ou position Bitunix n'a été consulté ou modifié.
- Les tests de cette étape visent la provenance des données, la cohérence OHLC et la présentation de l'interface, **pas** une validation de P&L ou de WebSocket.
