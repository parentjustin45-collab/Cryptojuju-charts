# Vector V1.4 : retard de confirmation vs V1.1 (ETH prioritaire)

## Portée et discipline

**Étude historique exploratoire, non exécutable et sans optimisation.** Branche `dev/v1.26.0` seulement; les moteurs V1.1, V1.4/WATCH, le site Render de test, `main`, le scanner et les études prospectives demeurent intacts.

Cette étude répond à la question laissée par la comparaison V1.1/V1.4 : une opposition de directions peut filtrer un mauvais retournement **ou** retarder une occasion. On ne doit pas confondre la fréquence d'opposition avec un profit après frais.

## Données et hypothèse figées avant les résultats

- Historiques **BTCUSDT, ETHUSDT, SOLUSDT 1H Bitunix LAST_PRICE** publics, en lecture seule via l'adaptateur CryptoJuju.
- 90 jours figés : **28 juillet 2026 13:00 UTC à 26 octobre 2026 13:00 UTC (exclusive)**, séparation chronologique le **11 septembre 2026 13:00 UTC**.
- Les anciennes périodes 90 jours ont **déjà été étudiées** plusieurs fois; la séparation en deux moitiés n'est **pas** un holdout inédit.
- Quarantaine : ne jamais traverser les trous, doublons ou OHLC impossibles; historique minimum **55 chandelles strictement continues**, puis examen seulement des événements après **55 chandelles de chauffe**.
- Un événement commence **uniquement lorsqu'un nouveau signal V1.1 inverse son état et que la direction V1.4 déjà établie demeure opposée**, à la clôture de la bougie du signal.
- Sur la même séquence Bitunix, trois grandes issues : `v14_aligned_later` (V1.4 finit par prendre la nouvelle direction **avant** que V1.1 se retourne à nouveau), `v11_reverted_first` (V1.1 se rétracte pendant que V1.4 garde l'ancienne direction), ou `censored` (trou de données, frontière temporelle ou absence d'ouverture de remplissage). Les changements simultanés ou ambigus ont leur propre catégorie et ne sont pas attribués gagnants.
- **Provenance indispensable :** `v14_aligned_later` est séparé entre une confirmation dont `sourceIndex` est **la même chandelle V1.1 initiale** (`sameSourceConfirmed`, théoriquement maximum 3 bougies) et un **alignement déclenché par une nouvelle chandelle source** (`newSourceAligned`, parfois plusieurs dizaines d'heures plus tard). Ces seconds cas NE sont PAS des confirmations tardives du premier candidat; leur écart de prix reste purement descriptif.
- **Coût descriptif du retard** : hypothèse d'entrée des deux versions à **l'OPEN suivant leur propre clôture confirmée**. Déplacement directionnel en % entre ces deux prix hypothétiques. Positif signifie une entrée plus défavorable dans la nouvelle direction pour V1.4; négatif signifie une entrée plus favorable. **Ce n'est ni le P&L ni une occasion de gain démontrée.**
- **Retournement V1.1 vite annulé** : on affiche le net **purement hypothétique** de V1.1 du prochain OPEN d'entrée au prochain OPEN de sortie, avec frais **0,06 % par côté** et glissement **0,05 % par côté**. Il ne faut PAS additionner ce net au rendement de V1.4 : celle-ci est déjà exposée dans son ancienne direction et n'a pas été hors marché.
- Toute la méthode compare **les deux versions existantes** : aucun seuil EMA50, ATR, délai, ni règle proposée comme gagnante; pas de V1.6 générée, aucun ordre, aucune clé de compte.

## Outputs, garde-fous et limites

Fichiers `backtest/vector-v14-confirmation-latency.mjs` et tests, workflow `.github/workflows/vector-v14-confirmation-latency.yml`. Exporte le JSON de traçabilité (OHLC période, qualité, événements, cohortes), et les CSV des événements et agrégats, classés **BTC/ETH/SOL × LONG/SHORT × moitié temporelle**.

La moyenne des gaps d'entrée ne constitue pas un backtest de positions comparable, encore moins une probabilité de succès. Une confirmation tardive peut s'accompagner d'un mouvement initial manqué **mais protéger d'un faux retournement** : la mesure des deux coûts doit être présentée conjointement. Les épisodes non résolus sont censurés et exclus des moyennes, sans survivorship implicite.

L'étape suivante admissible sera de figer **une nouvelle hypothèse observée prospectivement sur de nouvelles chandelles**, puis de réexaminer les trades net de risque et après frais, sans déplacer les dates prospectives précédemment verrouillées.
