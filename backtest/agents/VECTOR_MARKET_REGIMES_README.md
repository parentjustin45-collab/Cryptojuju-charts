# Vector AIT — observation des régimes de marché (CryptoJuju/Bitunix)

## Mission
Compléter les essais historiques V1.1 et V1.2 par un **diagnostic**
de marchés haussiers, baissiers et périodes sans forte direction, sans
TradingView. On ne modifie pas les algorithmes ni les signaux.

## Étiquettes descriptives causales
À la fin de la chandelle de confirmation, le diagnostic utilise seulement
les clôtures déjà observées. La pente de l'EMA50 et l'alignement EMA21/34/50
définissent `uptrend` et `downtrend`. Si l'efficacité directionnelle sur
les 20 dernières chandelles ne dépasse pas 0,30, on marque
`range_candidate` ; ce n'est **pas la preuve d'un vrai range**.
Les autres cas sont `mixed`, et les périodes de warmup `warmup`.

Les historiques de 960 chandelles sont divisés en quatre segments
chronologiques non chevauchants de 240 chandelles, sans recombiner de
transactions. Pour chaque variante, chaque segment et chaque régime, le
rapport présente le nombre de signaux LONG/SHORT, les confirmations
retardées et les inversions de signe survenues à 3 chandelles ou moins.

**Limites** : plusieurs classes/segments peuvent contenir très peu de
signaux. Les taux de retour, le succès des transactions et les courbes
d'équité ne sont pas attribués à ces régimes. Les quatre segments sont
issus d'un historique déjà inspecté; ce ne sont pas quatre tests
prospectifs nouveaux. Aucune variante n'est promue automatiquement.

Sorties : `*-vector-market-regimes.json`,
`vector-market-regimes-summary.json` et
`vector-market-regimes-summary.md` dans l'artefact GitHub Actions.
Lecture seule Bitunix, aucun trading, changement public ou coût Render.

## Automatisation de la campagne de recherche
La collecte GitHub Actions de 960 chandelles par configuration
(9 combinaisons BTC/ETH/SOL × 15m/1h/4h) produit désormais aussi
`vector-market-regimes-summary.md` et `vector-market-regimes-summary.json`.
Les fichiers `*-vector-market-regimes.json` conservent les quatre blocs
chronologiques de 240 chandelles, leurs proportions de régimes et les
statistiques de chaque variante. Si une série Bitunix ou une comparaison
Vector est bloquée, le rapport reste `BLOCKED` et le workflow échoue ;
aucune version n'est promue automatiquement.
