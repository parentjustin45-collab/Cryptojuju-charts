# CryptoJuju WATCH — isoler la prévisualisation mobile

**Objectif** : pouvoir ouvrir la V1.26.0 sur un Samsung depuis une adresse HTTPS **distincte de GitHub Pages et du service API Render existant**, sans toucher à la branche `main`.

## État

La V1.26.0 est déjà testée avec de **vraies chandelles Bitunix** et des captures Android/ordinateur; le site n'est **pas** encore hébergé publiquement par cette configuration. Le fichier `render-watch-preview.yaml` est volontairement séparé de `render.yaml` : il décrit **un nouveau site statique**, il ne modifie pas le Render existant.

## Déploiement indépendant (si Render est connecté)

- Dans Render, créer un **nouveau Blueprint** utilisant le dépôt `parentjustin45-collab/Cryptojuju-charts`, la branche **`dev/v1.26.0`**, avec **Blueprint Path : `render-watch-preview.yaml`**. Ne pas choisir le service `cryptojuju-api` déjà en place.
- Vérifier que le nouveau service porte le nom `cryptojuju-watch-v126-test`, que `runtime: static`, `staticPublishPath: ./watch-preview-dist` et `autoDeployTrigger: off` sont affichés.
- La première publication créera alors l'adresse `*.onrender.com` attribuée par Render. **Ne pas inventer ou partager l'URL avant la création réelle**.
- Le script `scripts/build-watch-preview.sh` assemble dans `watch-preview-dist` **seulement** l'HTML et les quatre modules nécessaires à l'alerte. Aucun code serveur, variable d'environnement, rapport d'expérience ou clé Bitunix n'est embarqué.
- Contrôler en HTTPS depuis **Samsung Wi-Fi puis données mobiles**, avec WATCH désactivée initialement, puis l'activer sur BTCUSDT 1H. Vérifier le libellé **SOURCE Bitunix**, le changement de symbole/TF, l'absence de nouveau signal LONG/SHORT, et noter toute erreur réseau.

## Limites et sécurité

- Le nouveau site serait **public via son sous-domaine Render** une fois créé : `robots.txt` et `X-Robots-Tag` déconseillent l'indexation **mais ne constituent pas une authentification**.
- La copie expérimentale importe un moteur V1.4 différent des flèches V1.1 affichées sur le graphique. WATCH ne donne **pas** d'ordre; ne pas l'utiliser comme conseil de trading.
- Le navigateur a besoin d'une connexion HTTPS et doit joindre le serveur de transit CryptoJuju, Bitunix et certains CDN. Le **CORS du serveur CryptoJuju pour le nouveau sous-domaine Render reste à tester** : ne pas annoncer l'intégration live validée tant que le test réel n'est pas passé.
- On ne change **ni GitHub Pages sur `main`, ni le service Render existant**. Le service de test est volontairement en **déploiement manuel**; toute mise à jour ultérieure exige une action.
