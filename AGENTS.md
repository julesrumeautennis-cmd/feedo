# Feedo

Feedo est un exercice de diagnostic de fuite dans la salle 3D du hackathon. L’apprenant collecte une observation, distingue deux circuits d’exercice, intervient dans la simulation et apporte une preuve après remise en service. Trois personnages répondent aux actions de l’apprenant. L’objectif mesuré est le diagnostic et la vérification autonomes dans un deuxième cas.

La discussion principale tient les interfaces, répond aux sous-agents, intègre les branches de travail sur dev et vérifie le candidat à la publication. L’arbitrage technique lui appartient. Le passage en production et le changement de domaine attendent la confirmation explicite de Jules après la preview.

## Répartition

- [Simulation, données et modèle](docs/agents/simulation.md)
- [Salle et personnages 3D](docs/agents/scene.md)
- [Interface et parcours](docs/agents/interface.md)
- [Dépendances et livraison](COORDINATION.md)

Chaque sous-agent travaille dans son worktree sur sa propre branche. Il adresse ses questions au parent et lui transmet le commit, les tests et les limites observées. Le parent réconcilie les réponses ici ou dans la documentation du module concerné. Une tâche terminée doit pouvoir se vérifier via l’entrée normale de l’application.
