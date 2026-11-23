# Simulation, données et modèle

Propriété de src/training/session.js, des données et tests métier, du pipeline Bruin et de l’entraînement. Le module exporte createSession({variant: "A" ou "B"} = {}), availableActions(state) et act(state, actionId). Une action retourne un nouvel état. Les identifiants d’actions sont stables. Chaque action affichable contient id et label. Une action invalide ou rejouée ne permet jamais de sauter une vérification.

L’état partagé contient variant, stage (observe, diagnose, repair, verify ou complete), coach (texte courant), leakActive, isolated (null, A ou B), repaired, overlay, agents et log. Chaque agent contient id (scout, mentor ou auditor), name, role et decision. Les entrées du journal contiennent agent et reason, en ordre chronologique. Documenter les champs complémentaires. Le dernier contrôle s’effectue sous pression simulée. Le retour pédagogique cite les observations du joueur et permet un deuxième cas avec une branche différente.

La génération, l’entraînement, l’évaluation et la lecture du modèle doivent être reproductibles. Séparer les incidents d’entraînement et d’évaluation. Le réseau d’eau et les relevés sont des données pédagogiques fictives.
