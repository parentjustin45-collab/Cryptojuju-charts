# WATCH — validation visuelle Chromium sur desktop et Android (26 octobre 2026)

**Résultat : PASS en environnement de test isolé.** [GitHub Actions #40296998215](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40296998215), artefact `vector-watch-visual-desktop-android-dev` (captures `watch-desktop.png`, `watch-android-390.png`). Exécution du commit `508df3bb36671b3ca6e3d5e6b90f6fc6cca0e6eb` sur **`dev/v1.26.0` exclusivement**.

## Ce qui a été exécuté

- **Vrai `index.html` du dépôt** servi avec serveur HTTP local, vrai **LightweightCharts 4.2.2** depuis le paquet npm local, Chromium Playwright.
- Format **1440×900 bureau** et format **390×844 Android émulé** (DPR 2, tactile).
- **Vraies chandelles synthétiques** ajoutées au graphique dans la page de test, données déterministes avec première impulsion SHORT et dernier candidat LONG **non confirmé**. Les captures montrent des prix proches de 100 $ **fictifs**, jamais des prix BTC Bitunix.
- **Connexion aux réseaux externes volontairement désactivée**. L'indicateur `API OFF` rouge dans les captures découle de cette isolation; ce test ne mesure pas la disponibilité du backend ni la validité du flux d'échange.
- Menu `+ Indicateurs` accessible, contrôle WATCH présent **décoché par défaut**, pastille invisibile en OFF.
- Après activation et injection déterministe : `Retournement possible LONG · nouveau · labo`, tandis que la direction de recherche confirmée reste SHORT.
- Pastille **dans les limites du viewport** desktop/mobile, hors du rendu graphique (dans la ligne d'état).
- La mise à jour d'une bougie encore ouverte **ne modifie pas le WATCH**; l'option se stocke pour la carte `cjIndicators18_0` et le changement de timeframe efface immédiatement l'ancien statut.
- Les anciens marqueurs V1.1 demeurent calculables; la suite de régression standard [#40296998173](https://github.com/parentjustin45-collab/Cryptojuju-charts/actions/runs/40296998173) a également réussi.

## Ce que ce succès ne prouve pas

Il ne valide **ni les performances du Vector V1.4**, ni la précision prospective des WATCH, ni la vitesse sur téléphone Android physique. Les graphiques sont **des chandelles fabriquées exclusivement pour ce test**, et l'API et les WebSockets sont simulés hors ligne. Aucun compte Bitunix, aucun ordre, aucun site public n'a été modifié.

## Décision

**Conserver WATCH en laboratoire sur `dev/v1.26.0`, décoché par défaut.** La logique d'alerte ne change pas les signaux LONG/SHORT et le rendu bureau/mobile passe les assertions automatisées. Avant une éventuelle mise en production, prévoir une vérification manuelle sur un appareil Android physique avec des données Bitunix réelles, puis obtenir une autorisation explicite de publication sur `main`. Ne pas annoncer comme « validé en direct » ce qui a été exécuté uniquement en navigateur simulé.
