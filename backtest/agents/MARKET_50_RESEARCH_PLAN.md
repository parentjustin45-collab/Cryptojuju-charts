# CryptoJuju — plan pour 50 marchés différents

Le programme lit la watchlist réelle de `index.html` et le registre
public Bitunix `trading_pairs`, puis retient exclusivement les contrats
USDT perpétuels marqués `OPEN` dans les deux listes. Il n'invente aucun
symbol, ne télécharge aucune chandelle et n'effectue aucun backtest.

La cible initiale est 10 références crypto principales, 12 cryptos
alternatives, 12 meme coins, 6 contrats liés aux métaux ou à l'énergie
et 10 contrats liés à des symboles d'entreprises. Ce sont des catégories
de recherche, pas des classements de capitalisation ni des validations
du sous-jacent. Des remplaçants sont cherchés seulement dans la même
catégorie; les manques restent affichés.

Une paire XAUUSDT/CLUSDT n'est pas automatiquement identique au marché spot
de l'or/pétrole; XAUT/PAXG peuvent aussi être des représentations tokenisées
différentes. Un contrat AAPLUSDT/NVDAUSDT n'est pas une action détenue.
La watchlist actuelle ne contient pas de paire Forex spot directe :
une source Forex devra être validée distinctement.

Prochaine étape : après admission, tester l'intégrité des 960 bougies
fermées et leur double lecture sur un petit groupe, puis faire évoluer
la campagne par vagues vers 15 et 50 symboles. Contrôler l'historique
disponible, le volume, la liquidité, le spread, le funding et le slippage
par famille. Les petits meme coins ne doivent pas partager automatiquement
les coûts simulés du BTC. Garder V1.1 comme référence et les variantes
V1.2 comme expériences non promues.

Fichiers de sortie : `market-50-admission.md` et
`market-50-admission.json` dans les artefacts GitHub Actions. Tous
les travaux restent sur `dev/ai-agents-phase1` : aucune modification
au site public, aucun trading, aucun Render payant.
