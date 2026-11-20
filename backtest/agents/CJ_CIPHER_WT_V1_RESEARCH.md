# CJ Cipher — WaveTrend V1.0 : intégration laboratoire

Source canonique : `backtest/agents/cj-cipher-wavetrend-v1-source.pine`,
copie du Pine Script v6 transmis dans la conversation par l'utilisateur,
adapté à partir du WaveTrend de LazyBear comme indiqué dans le script.
**Ne pas écraser le Pine TradingView original** : le fichier sert de
référence pour comparer les résultats.

Port JS : `backtest/agents/cj-cipher-wavetrend-v1.mjs`. Les règles :
`ap=hlc3`, ESA = EMA(ap,10), D = EMA(abs(ap-ESA),10),
CI = D != 0 ? (ap-ESA)/(0,015*D) : 0,
WT1 = EMA(CI,21), WT2 = SMA(WT1,4).
Bull = `crossover(wt1,wt2)`, bear = `crossunder(wt1,wt2)`.
Les seuils ±60, ±53, 0, les points et la zone de différence sont
**uniquement visuels dans le code original** et ne filtrent aucun signal.
**Aucune divergence** dans la V1.0 source.

Les bougies doivent être DÉJÀ fermées pour ce port : le réglage
`Confirm On Candle Close=true` est celui de la version fournie. L'option
false peut déclencher des alertes INTRABAR à TradingView qui se
rétractent; les historiques OHLC ne permettent pas d'en reconstituer
le déroulement. Le port n'invente pas les croisements intrabar.
Les points sont horodatés à la bougie 1H confirmée et une transaction
hypothétique ne commence pas avant l'OPEN suivant.

Protocole exploratoire : BTC, HYPE et 1000PEPE en 1H,
960 bougies closes, double lecture REST Bitunix, qualité OHLC et
provenance conservées. Le portefeuille historique de la première
étude utilise **runFixedHoldout/next-open reversal**, SANS
stop ATR/objectif (contrairement à l'autre étude Vector). Comparer
seulement les stratégies au sein de CE protocole, avec les mêmes frais
base 0,06 % + glissement 0,05 % et stress 0,10 % + 0,20 % par côté.

Trois bras de recherche pré-déclarés :
1. CJ Cipher seul : croisement WT1/WT2;
2. Vector V1.1 original seul : signaux inchangés;
3. Vector + CJ Cipher : au moment du signal Vector confirmé,
   WT1>WT2 pour LONG, WT1<WT2 pour SHORT. Si un retournement
   Vector inverse est refusé, une ancienne position autorisée
   passe à FLAT au prochain OPEN. Hypothèse initiale, pas une
   règle reconnue optimale.

**Parité numérique TradingView/Pine non prouvée.** Pour la vérifier,
il faudra relever des valeurs WT1 et WT2 sur **les mêmes chandelles
et la même source**, y compris les détails de démarrage EMA et
des croisements avec égalités. Les autres bourses/flux ne prouvent
pas la parité du flux Bitunix.

Ne pas faire de sélection de paramètres sur le 30 % historique déjà
consulté; pré-enregistrer ensuite un test futur et le modèle de risque
avec stops/targets, puis seulement SPEED + Cipher, et enfin
SPEED + Cipher + Frank Test si les modules et la parité sont vérifiés.
Aucun déploiement, ordre réel, API privée, promotion automatique,
édition de `main` ou `dev/v1.26.0`.
