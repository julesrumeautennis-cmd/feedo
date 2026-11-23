# Simulation, données et modèle

Propriété de src/training/session.js, des données et tests métier, du pipeline Bruin et de l’entraînement. Le module exporte createSession({variant: "A" ou "B"} = {}), availableActions(state) et act(state, actionId). Une action retourne un nouvel état. Les identifiants d’actions sont stables. Chaque action affichable contient id et label. Une action invalide ou rejouée ne permet jamais de sauter une vérification.

L’état partagé contient variant, stage (observe, diagnose, repair, verify ou complete), coach (texte courant), leakActive, isolated (null, A ou B), repaired, overlay, agents et log. Chaque agent contient id (scout, mentor ou auditor), name, role et decision. Les entrées du journal contiennent agent et reason, en ordre chronologique. Documenter les champs complémentaires. Le dernier contrôle s’effectue sous pression simulée. Le retour pédagogique cite les observations du joueur et permet un deuxième cas avec une branche différente.

La génération, l’entraînement, l’évaluation et la lecture du modèle doivent être reproductibles. Séparer les incidents d’entraînement et d’évaluation. Le réseau d’eau et les relevés sont des données pédagogiques fictives.

## Contrat implémenté

- Les couleurs du circuit A et B sont respectivement bleu et orange. La variante désigne le circuit fautif de la simulation. Les observations se trouvent dans readings (branch, flow et expected en L/min, pressureLoss en kPa, null si isolé). evidence contient les constats retenus. Les prompts d’interface proviennent de coach.
- Les choix stables sont photograph, inspect-A, inspect-B, hint, isolate-A, isolate-B, repair, restore et verify. availableActions tranche leur disponibilité. Les actions reconnues sont enregistrées dans history, y compris la tentative de vérifier trop tôt qui déclenche le refus de l’auditrice. Une action indisponible conserve l’objet état intact.
- Le sous-compteur rapide peut correspondre à un usage normal. Le modèle de l’agente Alma classe deux circuits grâce à l’écart débit–usage et la perte de pression. Noé donne un retour qui dépend des observations du joueur. Iris vérifie sous pression et produit un bilan. Ces politiques locales fonctionnent dans le navigateur.
- Pour le transfert, passer la variante opposée et previousResult au constructeur. Le bilan result contient feedback, comparison, diagnosisUnaided et verifiedOnFirstTry. Les métriques du deuxième cas repartent de zéro.

## Reproduction

Installer la [CLI Bruin officielle](https://github.com/bruin-data/bruin/releases/tag/v0.11.832), version validée v0.11.832. Lancer `python3 scripts/train-feedo.py --check` depuis la racine, ou passer `--bruin /chemin/vers/bruin`. Cette commande valide et exécute les trois assets DuckDB dans un répertoire temporaire, applique les contrôles de qualité, entraîne la régression logistique et contrôle l’instantané navigateur. Utiliser la même commande sans `--check` pour régénérer `src/training/calibration.json`. La CLI peut télécharger son pilote ADBC DuckDB au premier lancement.

Le jeu d’entraînement contient 160 incidents simulés, le test 40 autres incidents et les deux exercices sont réservés au navigateur. Les branches et mesures d’un même incident restent ensemble. Le score compte les incidents où la branche qui fuit est classée première. Le modèle atteint 40/40 contre 38/40 pour le choix du débit brut le plus élevé, sur ces cas synthétiques uniquement. Les actifs SQL contiennent le générateur, les contrôles et la jointure entre relevés et usages.

Les tests du parcours se lancent avec `node --test tests/training.test.js`.
