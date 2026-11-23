# Interface et parcours

Propriété de index.html, src/style.css et src/training/ui.js. L’application est en français. Le poste de formation présente la vue immersive, l’objectif courant, les actions du moteur, la décision et la justification des agents, puis le bilan et le deuxième cas. Privilégier une action principale et une hiérarchie claire. Préserver le déplacement clavier et la navigation sur mobile.

Charger src/main.js et src/training/ui.js depuis la page. Le DOM de la visite conserve #view, #status, #stations, #badge et #controls. ui.js utilise les exports du moteur. Il émet « feedo:state » après chaque changement et à « feedo:scene-ready », et « feedo:focus » pour cadrer l’incident. Un basculement de scénario remet les états précédents à zéro. Le parcours doit être opérable au clavier.
