# Guide de déploiement

Ce guide mène, étape par étape, d'un hébergement cPanel vide au site en ligne, puis explique comment publier les mises à jour. Les détails de référence (Cron Jobs, sauvegardes, Cloudflare, rotation des secrets) sont dans [ops.md](ops.md).

Durée de la première mise en ligne : environ 2 h, hors propagation DNS.

Conventions utilisées ci-dessous :

- `<domaine>` : le domaine du site, par exemple `isaacakonkwa.com` ;
- `<utilisateur>` : l'identifiant cPanel (visible en haut à droite du cPanel) ;
- `<version>` : la version de Node choisie dans « Setup Node.js App » (22 de préférence).

## Vue d'ensemble

```
Poste local ──git push──> GitHub (CI : tests, build)
                              │
                     « Deploy » lancé à la main
                              │ rsync en SSH
                              v
cPanel : ~/portfolio (release)  +  ~/portfolio_data (fichiers, sauvegardes)
         Passenger lance server.js, les Cron Jobs lancent dist/cron.js
         PostgreSQL du cPanel
```

Rien n'est compilé sur le serveur : GitHub Actions construit la release, l'envoie, applique les migrations, vérifie l'installation et redémarre l'application.

## Étape 1 : préparer le domaine et l'e-mail

1. **Domaine** : dans cPanel, « Domains », ajouter `<domaine>` (ou utiliser le domaine principal du compte). Faire pointer ses DNS vers l'hébergeur, ou vers Cloudflare (étape 9).
2. **Certificat** : cPanel, « SSL/TLS Status », lancer « Run AutoSSL » une fois le domaine résolu.
3. **Boîte e-mail** : cPanel, « Email Accounts », créer `contact@<domaine>` avec un mot de passe long.
4. **Délivrabilité** : cPanel, « Email Deliverability », réparer SPF et DKIM pour `<domaine>`. Ajouter ensuite dans « Zone Editor » un enregistrement TXT :
   - nom : `_dmarc.<domaine>`
   - valeur : `v=DMARC1; p=quarantine; rua=mailto:contact@<domaine>`

Sans ces trois enregistrements, les réponses aux messages et les factures risquent d'arriver en spam.

## Étape 2 : créer la base PostgreSQL

1. cPanel, « PostgreSQL Databases » : créer la base `portfolio` (cPanel la préfixe : `<utilisateur>_portfolio`).
2. Créer un utilisateur `app` (devient `<utilisateur>_app`) avec un mot de passe long, sans caractères `@`, `:` ou `/` pour simplifier l'URL.
3. Ajouter l'utilisateur à la base avec tous les privilèges.
4. Noter l'URL :

```
postgres://<utilisateur>_app:MOT_DE_PASSE@localhost:5432/<utilisateur>_portfolio
```

## Étape 3 : activer SSH et préparer la clé de déploiement

Sur le poste local (PowerShell ou Git Bash) :

```sh
ssh-keygen -t ed25519 -C "deploy-portfolio" -f ~/.ssh/portfolio_deploy -N ""
```

1. cPanel, « SSH Access », « Manage SSH Keys », « Import Key » : coller le contenu de `~/.ssh/portfolio_deploy.pub`, puis « Authorize ».
2. Tester la connexion (le port est indiqué par l'hébergeur, souvent 22 ou 2222) :

```sh
ssh -i ~/.ssh/portfolio_deploy -p 22 <utilisateur>@<serveur>
```

3. Récupérer l'empreinte du serveur pour GitHub :

```sh
ssh-keyscan -p 22 <serveur>
```

## Étape 4 : créer l'application Node.js

cPanel, « Setup Node.js App », « Create Application » :

| Champ | Valeur |
|---|---|
| Node.js version | 22 (sinon 20) |
| Application mode | Production |
| Application root | `portfolio` |
| Application URL | `<domaine>` |
| Application startup file | `server.js` |

Valider. cPanel affiche en haut une commande du type `source /home/<utilisateur>/nodevenv/portfolio/<version>/bin/activate` : la noter, elle donne aussi le chemin du binaire Node, `/home/<utilisateur>/nodevenv/portfolio/<version>/bin/node`.

Ne pas cliquer sur « Run NPM Install » : les dépendances arrivent avec la release.

Créer ensuite le dossier de données, en SSH :

```sh
mkdir -p ~/portfolio_data/uploads ~/portfolio_data/private ~/portfolio_data/backups
chmod 700 ~/portfolio_data
```

## Étape 5 : variables d'environnement

Générer les secrets sur le poste local (une valeur par commande) :

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Il en faut trois : `AUTH_ENCRYPTION_KEY`, `IP_HASH_SALT_SECRET` et `BACKUP_PASSPHRASE`. Les ranger tout de suite dans un gestionnaire de mots de passe : perdre `AUTH_ENCRYPTION_KEY` oblige à refaire la double authentification, perdre `BACKUP_PASSPHRASE` rend les sauvegardes illisibles.

Valeurs à saisir, en remplaçant les exemples :

```
NODE_ENV=production
SITE_URL=https://<domaine>
NEXT_PUBLIC_SITE_URL=https://<domaine>
TZ=Africa/Lubumbashi
DATABASE_URL=postgres://<utilisateur>_app:MOT_DE_PASSE@localhost:5432/<utilisateur>_portfolio
DATABASE_POOL_MAX=5
AUTH_ENCRYPTION_KEY=<secret 1>
ADMIN_EMAIL=akonkwaushindi@gmail.com
TRUST_PROXY=true
SMTP_HOST=mail.<domaine>
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@<domaine>
SMTP_PASS=<mot de passe de la boîte>
MAIL_FROM="Isaac Akonkwa <contact@<domaine>>"
MAIL_REPLY_TO=akonkwaushindi@gmail.com
STORAGE_DRIVER=local
DATA_DIR=/home/<utilisateur>/portfolio_data
IP_HASH_SALT_SECRET=<secret 2>
BAN_SYNC=none
MONITORING_TRANSPORT=local
BACKUP_PASSPHRASE=<secret 3>
BACKUP_KEEP_DAYS=30
```

Facultatives, à ajouter plus tard : `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` (étape 9), `VAPID_*` (notifications, voir ops.md section 8), `CLOUDFLARE_*`, `GEOIP_DB_PATH`, `BACKUP_REMOTE`. La liste complète et commentée est dans `.env.example`.

Ces variables doivent exister à **deux endroits**, avec les mêmes valeurs :

1. dans « Setup Node.js App », section « Environment variables » (lues par le site), puis « Save » ;
2. dans le fichier `~/portfolio/.env` (lu par les Cron Jobs et les commandes SSH) :

```sh
nano ~/portfolio/.env      # coller les lignes, enregistrer
chmod 600 ~/portfolio/.env
```

Le déploiement n'écrase jamais `.env`.

## Étape 6 : configurer GitHub

Dans le dépôt GitHub, « Settings » :

1. « Environments », « New environment » : `production`. Facultatif : cocher « Required reviewers » pour confirmer chaque déploiement.
2. Dans cet environnement, ajouter les secrets :

| Secret | Valeur |
|---|---|
| `SSH_HOST` | le serveur de l'hébergeur |
| `SSH_PORT` | `22` ou le port indiqué |
| `SSH_USER` | `<utilisateur>` |
| `SSH_PRIVATE_KEY` | contenu complet de `~/.ssh/portfolio_deploy` (clé privée) |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan` (étape 3) |
| `APP_DIR` | `/home/<utilisateur>/portfolio` |
| `NODE_BIN` | `/home/<utilisateur>/nodevenv/portfolio/<version>/bin/node` |

`NODE_BIN` est indispensable sur la plupart des cPanel : sans lui, la commande `node` n'est pas trouvée en SSH.

## Étape 7 : premier déploiement

1. Vérifier que la CI est verte sur `develop` (onglet « Actions », workflow « CI »).
2. Fusionner `develop` dans `main` (pull request), pour que `main` reste la version en ligne.
3. Onglet « Actions », workflow « Deploy », « Run workflow », branche `main`.

Le workflow construit la release, l'envoie, puis exécute sur le serveur :

```
node dist/migrate.js            crée ou met à jour les tables
node dist/cron.js healthcheck   vérifie base, Argon2id, dossier de données, sharp, SMTP
touch tmp/restart.txt           redémarre Passenger
```

Si le healthcheck échoue, le site n'est pas redémarré : lire le journal de l'étape « Migrate, check and restart » dans GitHub, corriger (souvent une variable de `.env`), puis relancer « Deploy ».

## Étape 8 : contenu et compte administrateur

### 8.1 Transférer le contenu déjà saisi en local (recommandé)

Le contenu préparé en local (projets, FAQ, organisations du bandeau, logos, médiathèque, paramètres) se transfère en deux parties : la base et les fichiers.

**Base**, depuis le poste local (Git Bash) :

```sh
"/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" \
  "postgres://postgres:root@localhost:5432/portfolio" \
  --clean --if-exists --no-owner --no-privileges -f portfolio.sql
scp -i ~/.ssh/portfolio_deploy -P 22 portfolio.sql <utilisateur>@<serveur>:~/
```

Puis en SSH sur le serveur :

```sh
cd ~/portfolio && set -a && . ./.env && set +a
psql --version
```

Le `pg_dump` local est en version 18. Si le `psql` du serveur est plus ancien (version 17.5 ou moins), retirer d'abord les lignes qu'il ne comprend pas :

```sh
sed -i -e '/^\\restrict/d' -e '/^\\unrestrict/d' -e '/transaction_timeout/d' ~/portfolio.sql
```

Puis importer :

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ~/portfolio.sql
rm ~/portfolio.sql
```

`--clean --if-exists` remplace les tables vides créées par le premier déploiement. Si `psql` signale une erreur de droits sur un schéma ou une extension, envoyer le message à l'hébergeur ou passer par l'option 8.2.

**Fichiers** (images de la médiathèque, documents privés), depuis le poste local :

```sh
scp -i ~/.ssh/portfolio_deploy -P 22 -r portfolio_data/uploads portfolio_data/private <utilisateur>@<serveur>:~/portfolio_data/
```

Puis redémarrer : `touch ~/portfolio/tmp/restart.txt`.

Les comptes administrateurs de la base locale sont transférés avec leur mot de passe local : réinitialiser le mot de passe tout de suite (8.3). Les données de test (messages, devis, factures d'essai) partent aussi : les supprimer depuis l'administration, ou les vider avant l'export.

### 8.2 Ou partir d'une base vide

Remplir le contenu de départ depuis le poste local, à travers un tunnel SSH vers la base du serveur :

```sh
ssh -i ~/.ssh/portfolio_deploy -p 22 -N -L 6543:localhost:5432 <utilisateur>@<serveur>
```

Dans un second terminal, avec l'URL de production réécrite sur le port 6543 :

```sh
DATABASE_URL="postgres://<utilisateur>_app:MOT_DE_PASSE@localhost:6543/<utilisateur>_portfolio" \
DATA_DIR=./portfolio_data-prod pnpm seed:content
```

Les images téléchargées par le seed arrivent dans `./portfolio_data-prod/uploads` : les envoyer ensuite sur le serveur comme en 8.1 (`scp -r portfolio_data-prod/uploads ...`).

### 8.3 Compte administrateur

En SSH :

```sh
cd ~/portfolio
source ~/nodevenv/portfolio/<version>/bin/activate
node dist/cron.js create-admin --email akonkwaushindi@gmail.com
```

Sur un compte existant (cas de l'option 8.1), la commande réinitialise le mot de passe et révoque toutes les sessions. Se connecter ensuite sur `https://<domaine>/auth/login` et activer immédiatement la double authentification (« Sécurité du compte »), puis ranger les 10 codes de secours.

## Étape 9 : Cloudflare et anti-spam (recommandé)

1. Créer un compte Cloudflare (offre gratuite), ajouter `<domaine>`, puis remplacer chez le registraire les serveurs DNS par ceux indiqués par Cloudflare.
2. Vérifier que les enregistrements importés pointent vers l'IP du cPanel, avec le nuage orange pour le site et le nuage gris pour `mail`.
3. « SSL/TLS » : mode « Full (strict) ».
4. **Turnstile** : tableau de bord Cloudflare, « Turnstile », « Add site », domaine `<domaine>`, mode « Managed ». Copier la clé de site et la clé secrète dans `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` (aux deux endroits de l'étape 5), puis redémarrer.
5. Facultatif : blocage des IP bannies directement par Cloudflare (ops.md section 9).

## Étape 10 : Cron Jobs

cPanel, « Cron Jobs ». Vérifier d'abord l'heure du serveur en SSH avec `date` : les horaires ci-dessous supposent un serveur en UTC (7 h à Bukavu = 5 h UTC).

Pour chaque ligne, remplacer `N` par `/home/<utilisateur>/nodevenv/portfolio/<version>/bin/node` et `L` par `>> /home/<utilisateur>/portfolio_data/cron.log 2>&1` :

| Réglage | Commande |
|---|---|
| `*/5 * * * *` | `cd /home/<utilisateur>/portfolio && N dist/cron.js run-jobs L` |
| `0 5 * * *` | `cd /home/<utilisateur>/portfolio && N dist/cron.js daily-digest L` |
| `15 22 * * *` | `cd /home/<utilisateur>/portfolio && N dist/cron.js nightly L` |
| `30 0 * * *` | `cd /home/<utilisateur>/portfolio && sh scripts/backup.sh L` |

Rôle de chaque tâche : ops.md section 6. Après 10 minutes, Administration, Monitoring, Journaux, « Tâches planifiées » doit montrer des passages de `run-jobs` réussis.

## Étape 11 : vérifications après mise en ligne

- [ ] `https://<domaine>` et `https://<domaine>/en` s'affichent, en clair et en sombre.
- [ ] Connexion admin avec double authentification.
- [ ] Formulaire de contact envoyé depuis un téléphone avec une adresse Gmail : accusé de réception reçu en boîte de réception (pas en spam), message visible dans la Messagerie, réponse reçue dans le même fil.
- [ ] Demande de devis de bout en bout, puis suppression du test.
- [ ] Un PDF de facture ou de reçu se télécharge depuis `/f/...`.
- [ ] Monitoring, Bannissements : « Ajouter mon adresse » à la liste blanche.
- [ ] `https://<domaine>/sitemap.xml` et `https://<domaine>/robots.txt` répondent.
- [ ] Aperçu du lien sur WhatsApp ou LinkedIn avec l'image Open Graph.
- [ ] Une sauvegarde apparaît dans `~/portfolio_data/backups` le lendemain matin.
- [ ] Google Search Console : ajouter le domaine et soumettre le sitemap.

## Déploiement manuel (sans le workflow « Deploy »)

À utiliser si le déploiement automatique par SSH n'est pas possible. Trois règles :

- **Ne jamais envoyer le dossier `.next`** : il contient le cache de compilation et le serveur de développement (plusieurs Go). Seule la release (environ 130 Mo, 35 Mo compressée) va sur le serveur.
- **Ne pas compiler sur Windows pour la production** : les modules natifs (Argon2 pour les mots de passe, sharp pour les images) sont installés pour la machine qui compile. Une release construite sur Windows ne démarre pas sur le serveur Linux du cPanel. Le paquet doit être construit par GitHub, sous Linux.
- **Ne pas laisser d'archives (`.zip`) ni de copies du projet dans le dossier du projet.** Elles sont maintenant exclues de la compilation, et le script de release refuse une release de plus de 400 Mo.

Procédure :

1. GitHub, onglet « Actions », workflow « Release package », « Run workflow » sur `main`.
2. À la fin (environ 5 minutes), ouvrir l'exécution et télécharger l'artefact `portfolio-release` en bas de la page. C'est un `.zip` qui contient `portfolio-release.tar.gz` : l'extraire sur le poste pour récupérer le `.tar.gz`.
3. cPanel, « File Manager », dossier `portfolio` : envoyer `portfolio-release.tar.gz` (« Upload »).
4. Toujours dans le File Manager, clic droit sur l'archive, « Extract », dossier `/home/<utilisateur>/portfolio`. Accepter le remplacement des fichiers existants. Le fichier `.env` n'est pas dans l'archive et n'est donc pas touché.
5. Supprimer l'archive envoyée.
6. cPanel, « Terminal » (ou SSH) :

```sh
cd ~/portfolio
source ~/nodevenv/portfolio/<version>/bin/activate
node dist/migrate.js
node dist/cron.js healthcheck
mkdir -p tmp && touch tmp/restart.txt
```

L'extraction ajoute et remplace des fichiers mais n'en supprime pas : les fichiers des anciennes versions s'accumulent dans `.next`. Une fois de temps en temps, avant l'étape 4, supprimer les dossiers `.next` et `node_modules` de `~/portfolio` (jamais `.env` ni `~/portfolio_data`), puis extraire.

Pour inspecter une release en local (sans la déployer) : `pnpm build && pnpm build:cron && node scripts/assemble-release.mjs --archive`.

## Mettre à jour le site

1. Travailler sur `develop`, pousser, attendre la CI verte.
2. Fusionner `develop` dans `main`.
3. Lancer « Deploy » sur `main`.

Les migrations de base sont appliquées automatiquement. Le contenu, les fichiers de `~/portfolio_data` et `.env` ne sont jamais touchés par un déploiement.

Avant une mise à jour qui contient une migration (nouveau fichier dans `drizzle/`), lancer une sauvegarde manuelle :

```sh
cd ~/portfolio && sh scripts/backup.sh
```

Après l'ajout de nouvelles données de départ (par exemple de nouvelles questions de FAQ dans le seed), les créer avec l'option 8.2 (`pnpm seed` à travers le tunnel) : le seed n'écrase jamais un contenu existant.

## Revenir en arrière

- **Code seul** : relancer « Deploy » en choisissant un tag ou une branche de la version précédente. Bonne pratique : créer un tag à chaque mise en production (`git tag v1.3.0 && git push --tags`).
- **Code et base** : les migrations ne s'annulent pas. Restaurer la sauvegarde prise avant la mise à jour (ops.md section 7), puis redéployer l'ancienne version.

## Dépannage

| Symptôme | Où regarder, que faire |
|---|---|
| Page d'erreur Passenger ou « Incomplete response » | `~/portfolio/stderr.log`, puis `node dist/cron.js healthcheck` en SSH (après `source .../activate`) |
| Le site affiche encore l'ancienne version | `touch ~/portfolio/tmp/restart.txt`, ou « Restart » dans Setup Node.js App |
| `node: command not found` dans le workflow | secret `NODE_BIN` manquant ou mauvais chemin |
| `Permission denied (publickey)` dans le workflow | clé publique non autorisée dans « SSH Access », ou `SSH_PRIVATE_KEY` incomplète |
| Healthcheck : base injoignable | `DATABASE_URL` dans `.env` (mot de passe, préfixe cPanel du nom de base et d'utilisateur) |
| Healthcheck : SMTP en échec | `SMTP_HOST=mail.<domaine>`, port 465, `SMTP_SECURE=true`, mot de passe de la boîte |
| Images de la médiathèque absentes | dossier `~/portfolio_data/uploads` vide ou `DATA_DIR` erroné |
| Toutes les IP vues comme `0.0.0.0` | `TRUST_PROXY=true` manquant |
| Les rappels et e-mails ne partent pas | Cron Jobs absents, voir `~/portfolio_data/cron.log` et « Tâches planifiées » |
| Variable modifiée sans effet | elle doit être changée aux deux endroits (Setup Node.js App et `.env`), puis redémarrage |
| Mot de passe admin ou téléphone 2FA perdu | `node dist/cron.js create-admin --email ... --reset-2fa` en SSH |
