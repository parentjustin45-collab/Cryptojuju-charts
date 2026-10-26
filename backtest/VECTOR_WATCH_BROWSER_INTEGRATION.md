# Intégration navigateur — CryptoJuju WATCH (dev V1.26.0)

**Statut : branche `dev/v1.26.0` uniquement. Pas de fusion `main`, pas de déploiement automatique du site public et pas de nouvel ordre Bitunix.**

L'utilisateur a autorisé la suite de la R&D Vector : un **petit état WATCH "Retournement possible"** au lieu de flèches supplémentaires.

## Implémentation

- Un nouveau contrôle **WATCH · Retournement possible (expérimental)** dans **« + Indicateurs »**, pour chacun des 4 graphiques possibles; **désactivé par défaut** (absent des anciennes sauvegardes, car le HTML est décoché).
- Les préférences déjà utilisées par le site sont **conservées par carte via `cjIndicators18_<i>`**. Pas de nouvelle clé de compte ni de suivi utilisateur.
- Une petite pastille dans la barre d'état `.hint`, **hors de la zone des chandelles**, signale soit « Retournement possible LONG/SHORT », soit « WATCH · LONG/SHORT maintenu · aucune alerte active », soit « historique insuffisant/non à jour ».
- La pastille affiche toujours « · labo » et son titre indique explicitement **pas un ordre**. Ne jamais afficher une flèche de trading, ne jamais toucher au scanner, score, indicateurs V1.1, bougies SPEED, couleurs, stops ou à des ordres réels.
- L'UI charge paresseusement `backtest/vector-watch-browser.mjs` **uniquement si l'utilisateur active** le contrôle. Ce module importe les moteurs **de recherche existants, inchangés** : `vector-watch-shadow.mjs`, `vector-v14-hysteresis.mjs`, `vector-ait-v1.mjs`.
- Toutes les données sont **en lecture seule** dans le navigateur. Les intervalles sont pris en charge si leurs secondes sont connues; une chandelle reste exclue tant que `time + durée > now`. L'état est **dérivé exclusivement de chandelles closes**.
- L'historique doit comporter une **suite finale sans trou d'au moins 55 chandelles**; les segments séparés par des trous ne sont **jamais raccordés artificiellement**. Afficher « données insuffisantes » plutôt que d'inventer une tendance. Un historique de plus de deux chandelles en retard sera affiché comme « non à jour ».
- En fin de jeu disponible, un `censored_end` de la machine analytique est interprété comme WATCH *actuellement possible* uniquement si la source a moins de trois bougies de retard. C'est un état instantané de recherche, **pas** une confirmation ni une entrée.
- Le rendu évite de recalculer sur chaque mise à jour d'une bougie encore ouverte, avec une clé de dernière clôture par carte. L'import et les calculs asynchrones sont protégés contre les réponses d'une ancienne carte/symbole.
- Les alertes ne sont **pas** affichées si le contrôle est OFF; le bandeau `.hint` reste identique à l'original.

## Risques / limitations

- **Ce ne sont pas les flèches V1.1 utilisées sur les graphiques du site :** la pastille suit le régime expérimental V1.4, issu des moteurs de backtest. Un SHORT V1.1 visible ne doit donc pas être confondu avec un « SHORT maintenu V1.4 ». La distinction est volontairement mentionnée dans la documentation et la pastille est étiquetée laboratoire.
- Des bougies Bitunix publiées avec une autre précision volume/tick ou des intervalles plus longs peuvent faire varier le résultat; la parité Pine d'origine n'a pas été vérifiée sur tous les instruments.
- L'expérience historique WATCH sur 90 jours a trouvé **119 alertes, 28 confirmées**, mais ce jeu a été exploré à répétition. Ce chiffre mesure l'accord avec V1.4, **pas** une précision prévisionnelle.
- En passant à une nouvelle cryptomonnaie ou un autre timeframe, la pastille doit se vider puis se recalculer uniquement sur les bougies de la nouvelle vue.
- Il n'existe **aucun lien de prévisualisation dev hébergé validé par ces tests**. GitHub Pages basé sur la branche `main` ne reçoit pas ces changements. Le simple chargement de `index.html` depuis le système de fichiers ne fonctionne pas forcément, car les imports ES modules locaux exigent un serveur HTTP(S).
- Avant une promotion future : exécuter une vraie épreuve dans un navigateur sur mobile et bureau, et mesurer les WATCH sur des données prospectives inédites. **Ne pas ajouter cette couche par défaut sans approbation de l'utilisateur.**

## Fichiers

`index.html` modifié **dans dev seulement**; `backtest/vector-watch-browser.mjs`, `backtest/vector-watch-browser.test.mjs`; workflow `.github/workflows/vector-watch-browser.yml`.

**Décision : laboratoire visible seulement lorsqu'activé ; aucun ordre ni stratégie automatique.**
