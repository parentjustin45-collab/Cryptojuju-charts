# Test navigateur réel — WATCH (branche de développement)

**But** : vérifier les états WATCH du site HTML réel sur **Chromium 1440×900** et un **viewport Android 390×844**, sans fournir de fausses assurances fondées sur des tests purement statiques.

## Périmètre du test automatique

La suite `backtest/vector-watch-visual-smoke.mjs` :
- Sert **le vrai `index.html` de `dev/v1.26.0`** par HTTP local dans GitHub Actions, avec **LightweightCharts 4.2.2 réel** chargé depuis un paquet npm local. Les accès externes sont coupés pour réduire la variabilité (donc cette simulation **ne prouve pas** la connectivité Bitunix).
- Démarre Chromium Playwright en 1440×900 et viewport Android 390×844 (tactile, pixel ratio 2).
- Contrôle la présence de **quatre cartes**, du menu **+ Indicateurs**, de l'option WATCH **désactivée par défaut**, de la pastille invisible lorsque OFF.
- Active WATCH sur la première carte, **injecte uniquement dans le test** un historique synthétique de 75 chandelles 1H closes : première impulsion SHORT puis une contre-chandelle LONG qui doit déclencher **WATCH LONG possible sans confirmer la V1.4 SHORT**.
- Vérifie que la pastille est visible, porte le bon texte, **ne déborde pas de l'écran** et ne se déplace pas sur la zone des chandelles.
- Vérifie qu'une **chandelle encore ouverte** ne change pas l'état WATCH; que le stockage de l'option fonctionne sur `cjIndicators18_0`; que changer de timeframe efface **immédiatement** l'ancien libellé; que le moteur V1.1 original est toujours disponible.
- Sauvegarde de vraies **captures PNG** des deux viewports dans l'artefact du workflow.
- Aucun compte, ordre de trading, flux Bitunix en direct, modification de `main` ou publication de site.

**Limites :** Les données de test sont synthétiques, le marché live est inaccessible dans ce test, et le comportement sur le Samsung Android physique n'est pas automatiquement vérifié. Les captures permettent une revue visuelle, mais un essai manuel sur appareil réel reste nécessaire avant publication. Ce test ne mesure **pas** une performance de stratégie.

Workflow `.github/workflows/vector-watch-visual.yml` — **dev uniquement**.
