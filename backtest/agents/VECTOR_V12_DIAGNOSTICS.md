# CryptoJuju — Diagnostics Vector natifs (sans TradingView)
Le diagnostic `vector-v12-timing-diagnostics.mjs` mesure, sur des chandelles
fermées issues de Bitunix, le **nombre de retournements opposés en trois
chandelles ou moins** pour chaque mode ainsi que le **retard de confirmation**
et l'écart de prix à la prochaine ouverture pour les signaux appariés à V1.1.

Ce ne sont pas des indicateurs de bénéfice et une inversion rapide ne
prouve pas qu'un signal était mauvais. Les valeurs sont isolées entre
entraînement et période de validation historique déjà consultée, sans
recoller une position entre les deux fenêtres. Les variantes n'ont aucune
permission de s'auto-promouvoir. Tous les rapports restent sur
`dev/ai-agents-phase1`, sans modifier `main`, avec données Bitunix
validées, sans appel à TradingView ni transaction.
