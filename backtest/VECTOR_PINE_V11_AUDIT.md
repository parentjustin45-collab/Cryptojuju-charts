# CryptoJuju Vector Always In Trade V1.1 — Audit du Pine Script original

## Provenance et portée

Le **25 octobre 2026**, l'auteur a fourni le code complet de l'indicateur TradingView **Pine Script v6**, `CryptoJuju Vector Always In Trade V1.1`. Copie de référence originale : `backtest/references/CJ_Vector_AIT_V1_1_original.pine`.

La référence historique est préservée **sans modifier ses règles**. Elle n'est **pas** un nouveau script à publier dans TradingView; elle permet de vérifier la sémantique des moteurs JS. Toute évolution V1.2/V1.3 demeure séparée.

## Paramètres par défaut confirmés depuis Pine

- SMA volume : **20**, SMA `volume × math.max(high-low, syminfo.mintick)` : **20**, ATR Wilder : **14**.
- Seuils : volume relatif ≥ **1,50**, volume×amplitude relatif ≥ **1,50**, amplitude ≥ **0,80 × ATR**, ratio du corps ≥ **0,60**, force de clôture directionnelle ≥ **0,70**.
- Minimum **4 critères sur 5**, en hausse ou en baisse selon `close > open` ou `close < open`.
- Signal confirmé par défaut seulement à `barstate.isconfirmed` (`confirmAtClose=true`). Les backtests doivent analyser uniquement des chandelles terminées. Le paramètre optionnel `confirmAtClose=false` peut produire des états intrabar temporaires qui ne sont **pas** auditables à partir des seules chandelles OHLC historiques.
- Toujours en position après la première flèche : chaque Vector confirmé **opposé** inverse la direction et clôture le trade précédent. Le Pine calcule le rendement d'un trade entre les **closes** des deux signaux; **aucun stop, cible, commission ou glissement** n'est dans cette étiquette.
- Les backtests V1.2/V1.3 utilisent en revanche une **entrée au prochain open**, le stop 1,5 %, le take 3 %, l'horizon 12 bougies et des frais. Ces chiffres doivent être nommés différemment : **ne jamais présenter le pourcentage Pine comme rendement de ces simulations**.

## Divergence de précision identifiée

La référence Pine exige **`syminfo.mintick` propre à l'instrument TradingView**. Le code du graphique CryptoJuju et la valeur par défaut du port `vectorAIT` utilisent `Number.EPSILON`, uniquement adapté à leur correspondance entre eux. Cela **ne démontre pas la parité exacte avec TradingView**, particulièrement lorsque le minimum de tick diffère, ou sur des bougies à amplitude nulle.

Le moteur de recherche accepte **déjà** `vectorAIT(candles, {minTick: tick})` : le nouveau test fournit un tick **explicite**, sans inventer la valeur BTC/ETH/SOL Bitunix/TradingView. Il ne réécrit pas le Pine original et ne modifie pas silencieusement les essais historiques ou les expériences prospectives figées. Une validation ultérieure devra récupérer le `syminfo.mintick` **réel du symbole et de sa source**, puis comparer des exports OHLC + marqueurs TradingView sur la **même source et les mêmes limites de chandelle**.

## Test de parité sémantique indépendant

`backtest/vector-pine-v11-parity.test.mjs` :

- vérifie la présence des calculs, paramètres, états et alertes dans le fichier Pine préservé;
- met les règles Pine dans une traduction JS **indépendante**, puis compare exactement les signaux, Vector bullish/bearish, sens de position, sorties et pourcentages entre le code de recherche et cette traduction;
- teste des données déterministes BTC-like, ETH-like, SOL-like, microprix avec tick explicite, paramètres Pine personnalisés, et stabilité des préfixes de données;
- confirme l'hypothèse indispensable `confirmAtClose=true` en excluant une dernière bougie incomplète.

Le test automatisé **ne fait pas tourner le compilateur Pine de TradingView**. Par conséquent, un résultat vert établit la concordance avec la **traduction des formules transmises**, et pas une identité officiellement certifiée par TradingView. Pour une preuve de bout en bout, il faudra une confrontation de données et de marqueurs issus de TradingView.

## Protection du projet

Code ajouté uniquement sur `dev/v1.26.0`; V1.1 Pine de référence inchangée; **aucun changement à l'interface en ligne, aucun ordre Bitunix, aucune fusion vers `main`**.

Workflow : `.github/workflows/vector-pine-v11-audit.yml`; tests également inclus dans la suite `backtest/*.test.mjs`.
