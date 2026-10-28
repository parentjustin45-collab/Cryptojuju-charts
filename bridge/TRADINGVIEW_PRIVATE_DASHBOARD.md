# CryptoJuju TradingView — tableau de bord privé (prototype)

Date : 28 octobre 2026. Branche dev/v1.26.0. Aucune observation n'est divulguée publiquement.

Le récepteur Pine/TradingView existant (POST /tv/momentum) continue à utiliser son seul jeton de soumission. Le tableau privé est une interface en lecture seule avec un mot de passe de consultation distinct.

Adresse prévue :
https://cryptojuju-tv-momentum-pilot.onrender.com/private/tradingview

Route désactivée par défaut : en absence de CJ_TV_DASHBOARD_PASSWORD (32 caractères minimum) le serveur répond 404. Le mot de passe ne doit PAS être identique à CJ_TV_WEBHOOK_TOKEN, lequel ne permet que de soumettre des observations Pine.

Activation sur le service Render cryptojuju-tv-momentum-pilot :
1. Environment -> ajouter CJ_TV_DASHBOARD_PASSWORD, avec un nouveau mot de passe généré aléatoirement de 32 caractères minimum (48+ idéalement). Le conserver dans son propre gestionnaire de mots de passe.
2. Ne PAS modifier DATABASE_URL et CJ_TV_WEBHOOK_TOKEN. Ne jamais envoyer une URL contenant un mot de passe, un jeton ou la clé de dashboard dans un message ou une capture.
3. Après validation du code, enregistrer et déployer sur le serveur pilote séparé.
4. Ouvrir le lien HTTPS privé dans Chrome : utilisateur HTTP Basic owner ; mot de passe = valeur exacte de CJ_TV_DASHBOARD_PASSWORD.
5. Les données n'apparaîtront qu'après création et émission réelle d'une alerte TradingView contenant le webhook, avec la double authentification TradingView active.

L'interface affiche le nombre total de bougies reçues, les marchés/UT dans les 1000 dernières entrées, le dernier prix, le Momentum composite, les pivots et LONG/SHORT. Le fuseau affiché est Québec. La mention collecte/parité à confirmer reste visible. Un décompte de 200 bougies ne suffit pas : seules 200 bougies VRAIMENT consécutives permettraient de comparer le moteur Pine au JavaScript.

Protection de l'accès : Basic sur HTTPS, pas de données en URL, cache désactivé, aucune API de lecture publique, politique CSP limitant les scripts. Si un appareil est partagé, fermer la session privée du navigateur ou supprimer les identifiants mémorisés. Ce pilote n'est PAS un produit multiutilisateur.

Limites : le plan gratuit Render peut s'endormir et manquer des livraisons; la base de test gratuite expire le 26 novembre 2026. Les données historiques ne sont pas récupérées automatiquement par webhook. Aucun calcul de P&L et aucun ordre réel.

IMPORTANT : le jeton webhook précédent a été exposé dans une conversation; le faire tourner en privé avant une utilisation durable. Ne jamais employer ce jeton comme mot de passe du tableau.

Main, API de production, aperçu WATCH et Vector prospectif ne sont pas modifiés. Le tableau demeure non activé avant la configuration privée et la vérification des tests.
