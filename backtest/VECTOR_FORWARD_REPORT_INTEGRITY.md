# CryptoJuju — couche de contrôle indépendant du suivi prospectif

## Ce qui est créé

Une **couche séparée en lecture seule**, `backtest/vector-forward-integrity.mjs`, valide et présente les fichiers JSON produits par le **workflow déjà figé** `vector-forward-v11-v14.yml`. La couche ne réécrit **aucun** signal Vector, moteur V1.1/V1.4, stop, entrée, date de départ, frais ou glissement. Branch `dev/v1.26.0` uniquement; `main`, le site Render WATCH et l'API restent inchangés.

## Différence importante entre signaux et entrées

Le moteur figé expose un champ hérité `entries` qui peut inclure une alerte dont le prochain **OPEN n'a pas encore été enregistré** et dont `entryPrice === null`. Ce n'est **pas** une entrée remplie. Le nouveau rapport affiche séparément :

- `signalCount` : événements produits par la version testée, après exclusion des signaux déjà occupés.
- `filledEntries` : entrées avec un **prix d'ouverture réellement présent** dans le simulateur.
- `awaitingNextOpen` : dernier signal confirmé, mais pas encore d'ouverture admissible.
- `openPositions` : entrée connue, sortie pas encore observée.
- `closed` : sorties validées, seules admises dans les résultats nets.
- `censored` : avenir inconnu, bougie manquante ou fenêtre interrompue; **jamais gagnante ou perdante par défaut**.
- `unfillable` : signal définitivement dépourvu de prochaine ouverture.

## Contrôles d'intégrité qui bloquent un rapport anormal

Le validateur exige BTC, ETH, SOL, versions V1.1/V1.4, 1H Bitunix, démarrage **2026-10-28 00:00 UTC**, stop 1,5 %, take-profit 3 %, frais 0,06 % par côté, glissement 0,05 % par côté, minimum 30 clôtures.

Il recalcule les effectifs par catégorie, interdit toute entrée antérieure au démarrage, tout doublon de signal, les entrées sur chandelle non clôturée, les chevauchements de trades clôturés dans une version, les résultats nets inventés pour des positions censurées et les écarts entre rendements bruts et frais supposés. Le contrôle de frais utilise **les mêmes hypothèses** figées et ne modifie jamais l'exécution.

Une qualité Bitunix `PARTIAL_QUARANTINED` déclenche un **avertissement**, pas une déclaration de profit. Un prix ou une série indisponible doit produire un état **bloqué**, jamais une estimation. Le contrôle n'établit **pas** la rentabilité réelle; un simulateur à bougies 1H ne connaît pas l'ordre réel des touches stop/cible dans la même chandelle, d'où l'hypothèse défavorable du stop d'abord.

## Preuve avant démarrage

Le rapport GitHub Actions du **26 octobre 2026**, basé sur les chandelles publiques Bitunix et archivées sous `vector-forward-paper-v11-v14-bitunix`, rapporte correctement **zéro transaction prospective** avant le départ. L'intégrité passe avec avertissement : la fenêtre ETH contenait **54 chandelles exclues** de ses fenêtres admissibles, tout en conservant une séquence suffisante pour la vérification de pré-démarrage. Ce chiffre doit être surveillé; il ne compte pas une perte.

Le workflow `.github/workflows/vector-forward-integrity.yml` recupère **la dernière exécution disponible** du run GitHub Actions **40358145063**, effectue un contrôle indépendant, puis enregistre un Markdown et un JSON. Il se déclenche sur `dev/v1.26.0` lors de modifications du contrôleur ou manuellement; **il ne s'exécute pas automatiquement chaque jour**. Le suivi quotidien déjà configuré doit rester responsable des nouvelles observations; ne pas confondre la simple existence d'un workflow avec une tâche récurrente.

**Aucun ordre, aucun déploiement, aucun abonnement payant.**
