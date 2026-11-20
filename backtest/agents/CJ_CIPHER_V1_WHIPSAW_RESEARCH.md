# CJ Cipher WT V1.0 — étude des pertes et croisements rapides

Nouvelle étape approuvée par l'utilisateur : **analyser les faiblesses
avant de créer V1.1**, en conservant les fichiers d'origine
`cj-cipher-wavetrend-v1-source.pine` et
`cj-cipher-wavetrend-v1.mjs` INCHANGÉS.

## Source / méthode

Le workflow `ai-agents-cj-cipher-whipsaw.yml` télécharge l'artefact
GitHub Actions initial `cj-CIPHER-WT-V1-INITIAL-RESEARCH`, exécution
`44656240484`. Les trois sources Bitunix BTC/HYPE/1000PEPE sont
vérifiées de nouveau en lecture double (SHA brut et dérivé)
et leurs **exactes** commandes Cipher sont recalculées. Les trois
marchés : 960 chandelles terminées en 1H, base LAST_PRICE, comme la
campagne du premier pilote.

Le moteur historique `runBacktest` est appelé sur **les mêmes
fenêtres et les mêmes frais**, 70 % entraînement / 30 % holdout
historique. Les comptages d'opérations, rendements, win rates et
drawdowns doivent reproduire EXACTEMENT la campagne originale
à une tolérance numérique de 0,00001. Sinon le replay BLOQUE.

Rapport : pour chaque opération simulée, prix réellement observé
à l'OPEN suivant son croisement, OPEN du croisement opposé (ou dernière
clôture de phase), sens LONG/SHORT, durée, WT1 et WT2 au signal,
mouvement directionnel brut du prix, PnL avec frais simulés, et
classification des trois problèmes distincts :

- prix ayant bougé **contre** la direction du signal pendant la position;
- **croisement opposé ≤3h ou ≤6h** (activité/risque de whipsaw, mais
  pas forcément un faux signal : ce peut être une bonne sortie);
- mouvement brut positif mais **perte après frais simulés**.

La zone de référence graphique WT2≤−53 (LONG) ou WT2≥+53 (SHORT)
est rapportée DESCRIPTIVEMENT, mais **aucune décision** sur un
filtre extrême ou sur la longueur de lissage ne sera prise à
partir de ces résultats déjà connus.

## Ce que l'étude ne démontre PAS

Les catégories sont **ex post**, et ce n'est pas une analyse
économétrique de causes certaines. Chaque sortie vient du modèle
historique `reversal-only`, sans stop ATR, objectif ni horizon maximum,
et les positions de fin de période sont fermées artificiellement.
L'historique a déjà été inspecté. Pas de résultat prospectif, de
parité numérique TradingView revendiquée, de preuve de trading réel
ni de promotion de Cipher V1.1.

## Prochaine décision après diagnostic

Préenregistrer au plus **une** hypothèse anti-bruit à la fois (p. ex.,
confirmation 1 barre après croisement sous conditions causales), et
la confronter à V1.0 sur périodes neuves et avec **le même
moteur ATR** incluant frais stress. Documenter latence, opérations
ratées, périodes sans trade et dispersion des marchés.

L'utilisateur privilégie désormais l'amélioration des signaux sur
CryptoJuju et **ne requiert pas** la parité chiffrée TradingView
pour chaque variation; la causalité des bougies confirmées demeure
impérative.

Branche isolée `dev/ai-agents-phase1` seulement, jamais `main`,
`dev/v1.26.0`, site public, clés privées, ordre réel ou dépense.
