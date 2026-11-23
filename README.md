# Feedo

Feedo forme un apprenant à identifier un circuit qui fuit et à vérifier une réparation sous pression dans la reproduction 3D d’une salle. Les deux circuits et les mesures sont simulés. Chaque cas associe une vraie capture du rendu, des relevés, les décisions de l’apprenant et un bilan. Le deuxième cas mesure le transfert à une nouvelle situation.

## Démarrer

Utiliser Node 24 ou supérieur, Python 3 et npm. Depuis le dépôt :

```sh
npm ci
npm run dev
```

La construction recrée le modèle GLB de la salle depuis ses sources Three.js. Pour utiliser le modèle publié sur Vercel Blob, définir `VITE_ROOM_MODEL_URL`. Le navigateur permet de photographier la fuite, demander un indice, inspecter un raccord, isoler un circuit et vérifier la réparation. Les mesures et les indices changent avec la situation.

## Services et modèle

| Intégration | Usage vérifiable |
| --- | --- |
| Bruin + DuckDB | Le pipeline transforme les télémesures et les usages en observations par circuit. Le script d’entraînement exécute les contrôles Bruin et reproduit les paramètres du modèle utilisé dans le navigateur. |
| Telem | « Consulter la source » lit la fiche WaterSense de l’EPA. Le serveur vérifie que le contenu soutient l’indice pédagogique. La réponse inclut l’URL et l’identifiant de trace du fournisseur. |
| BAND | « Solliciter les agents » rejoue les décisions du joueur sur le serveur. L’observatrice transmet ses mesures, le mentor en déduit une hypothèse, la vérificatrice rend son avis. Chaque relais est relu par le destinataire et rattaché à un reçu BAND. |

Les trois personnages utilisent des règles de tutorat et un classifieur de diagnostic entraîné sur des incidents synthétiques. Aucune clé privée n'est intégrée au JavaScript du navigateur. Les services déconnectés sont indiqués comme tels dans le journal.

Pour connecter les fournisseurs en local, créer un fichier `.env.local` et définir `TELEM_API_KEY` et `BAND_REGISTRATION_KEY` (clé utilisateur de portée Register-only). Exécuter `npm run band:connect` pour inscrire les trois identités Feedo et préparer leur salle. Le script conserve chaque étape réussie dans `.env.band.local`, privé. Si les agents sont déjà provisionnés, renseigner directement `BAND_CHAT_ID` et les paires `BAND_SCOUT_ID/KEY`, `BAND_MENTOR_ID/KEY`, `BAND_AUDITOR_ID/KEY` dans l’environnement serveur. La clé d’inscription sert uniquement au provisionnement local. [Documentation Telem](https://docs.telem.ai/quickstart/) · [Authentification BAND](https://docs.band.ai/security/authentication)

## Vérifier un candidat

```sh
npm test
python3 scripts/train-feedo.py --bruin /chemin/vers/bruin --check
npm run build
npx playwright install chromium
npm run test:e2e
```

Le pipeline est épinglé dans la CI à Bruin v0.11.832. Le test Chromium parcourt les deux cas et le refus d’une clôture prématurée. Pour réutiliser une installation Chromium locale, définir `CHROME_PATH` au lancement des tests.

## Orchestration et livraison

Le [graphe horizontal](COORDINATION.md) et [les missions des agents](AGENTS.md) décrivent les responsabilités et les contrats. Les branches de spécialité convergent vers `dev`. Le check GitHub Actions `verify` s’exécute sur les pushes vers `dev` et `main`, ainsi que sur les pull requests. La PR vers `main` exige ce check. Les déploiements Git automatiques Vercel sont désactivés. L’orchestrateur publie le commit approuvé et vérifie le domaine après confirmation de la preview par Jules.
