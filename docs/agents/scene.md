# Salle et personnages

Propriété de src/main.js et src/leak/. Conserver le modèle du lieu et sa navigation. Ajouter les canalisations d’exercice, le raccord, les gouttes, une flaque et trois personnages identifiables qui se déplacent selon leur mission. Utiliser les états du moteur pour choisir la fuite et ses couleurs, l’arrêt et la remise en service. L’interface de scène écoute les événements window « feedo:state » (detail = état) et « feedo:focus » (cadrer l’incident). À la fin du chargement, envoyer « feedo:scene-ready ». L’interface démarre indépendamment via un script dans index.html.

Le modèle utilise les mètres, le sol à Y = 0 et l’axe +Y en hauteur. Conserver le chargement du GLB généré ou de VITE_ROOM_MODEL_URL, les stations et les collisions. Les conduites ajoutées sont fictives.

La prise de vue réelle passe par « feedo:photograph » juste avant l’action du moteur. La scène cadre le raccord, dessine une image WebGL puis renvoie immédiatement « feedo:photo-ready » avec `detail.url` (JPEG en mémoire de 480 pixels maximum sur le grand côté, ou `null` en cas de perte du contexte ou de capture indisponible). L’image correspond donc à l’état précédant la révélation des indices.
