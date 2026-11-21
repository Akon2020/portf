# Exploitation et déploiement (cPanel)

Ce document décrit l'installation et l'exploitation du site sur un hébergement cPanel mutualisé avec « Setup Node.js App » (Phusion Passenger). Il couvre aussi les tâches planifiées, les notifications, la sécurité (Cloudflare, bannissements), les sauvegardes, la restauration et la rotation des secrets.

## 1. Vérifications préalables sur le cPanel

À faire une seule fois, en SSH :

```sh
node -v                      # version proposée par Setup Node.js App (20 ou 22)
psql --version               # client PostgreSQL disponible
crontab -l                   # accès aux Cron Jobs
```

Après le premier déploiement, `node dist/cron.js healthcheck` vérifie la base, Argon2id, l'écriture dans le dossier de données, `sharp` et la configuration SMTP.

## 2. Base de données

1. cPanel, « PostgreSQL Databases » : créer la base (ex. `user_portfolio`) et un utilisateur dédié avec un mot de passe long, puis lui donner tous les droits sur la base.
2. L'URL de connexion a la forme `postgres://user_portfolio:MOT_DE_PASSE@localhost:5432/user_portfolio`.
3. Les migrations sont appliquées par le pipeline (`node dist/migrate.js`), jamais à la main sauf dépannage.

## 3. Application Node.js

cPanel, « Setup Node.js App », créer une application :

| Champ | Valeur |
|---|---|
| Node.js version | 22 (ou 20) |
| Application mode | Production |
| Application root | `portfolio` (soit `~/portfolio`) |
| Application URL | le domaine du site |
| Application startup file | `server.js` |

Le fichier `server.js` est généré par le build `standalone` de Next : il n'existe pas dans le dépôt, il arrive avec la release.

### Variables d'environnement

Deux endroits, avec les mêmes valeurs :

- dans « Setup Node.js App » (lues par le site) ;
- dans `~/portfolio/.env` (lu par les tâches cron et les commandes SSH), créé à la main puis protégé :

```sh
chmod 600 ~/portfolio/.env
```

La liste complète est dans `.env.example`. Valeurs minimales : `NODE_ENV=production`, `SITE_URL` (adresse publique du site, par exemple `https://isaacakonkwa.com`), `DATABASE_URL`, `AUTH_ENCRYPTION_KEY` (32 octets en base64), `TRUST_PROXY=true`, `DATA_DIR=/home/<utilisateur>/portfolio_data`, `TZ=Africa/Lubumbashi`.

Générer `AUTH_ENCRYPTION_KEY` :

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Cette clé chiffre les secrets TOTP : la perdre oblige à reconfigurer la double authentification. La conserver dans un gestionnaire de mots de passe.

### Dossier de données

Hors du dossier de l'application pour survivre aux déploiements :

```sh
mkdir -p ~/portfolio_data/uploads ~/portfolio_data/private ~/portfolio_data/backups
chmod 700 ~/portfolio_data
```

## 4. Déploiement

Le build se fait dans GitHub Actions, jamais sur le serveur (ressources limitées).

- `.github/workflows/ci.yml` : à chaque push, contrôle typographique, lint, typecheck, tests (avec une base PostgreSQL de service), build, puis démarrage de la release comme le ferait Passenger.
- `.github/workflows/deploy.yml` : lancement manuel (onglet Actions, « Deploy », « Run workflow »). Il construit la release, l'envoie par rsync, applique les migrations, lance le healthcheck et redémarre Passenger (`touch tmp/restart.txt`).

Secrets GitHub à créer (Settings, Secrets and variables, Actions, environnement `production`) :

| Secret | Exemple |
|---|---|
| `SSH_HOST` | `serveur.hebergeur.com` |
| `SSH_PORT` | `22` |
| `SSH_USER` | utilisateur cPanel |
| `SSH_PRIVATE_KEY` | clé privée dédiée au déploiement (sans phrase de passe), clé publique ajoutée dans cPanel, « SSH Access » |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan -p 22 serveur.hebergeur.com` |
| `APP_DIR` | `/home/<utilisateur>/portfolio` |

Construire la release en local pour inspection :

```sh
pnpm build && pnpm build:cron && node scripts/assemble-release.mjs
```

## 5. Premier compte administrateur

En SSH, après le premier déploiement :

```sh
cd ~/portfolio
source ~/nodevenv/portfolio/22/bin/activate   # chemin affiché par Setup Node.js App
node dist/cron.js create-admin
```

La commande demande l'e-mail, le nom et le mot de passe (saisie masquée). La connexion se fait ensuite sur `/auth/login`. La double authentification est facultative mais fortement recommandée : l'activer dès la première connexion dans Administration, « Sécurité du compte » (QR code, puis 10 codes de secours à conserver). Options :

- `--email adresse` pour éviter la question ;
- relancer la commande sur un compte existant réinitialise le mot de passe et révoque toutes les sessions ;
- `--reset-2fa` réinitialise aussi la double authentification (perte du téléphone et des codes de secours).

En local : `pnpm create-admin`.

### Contenu initial

Après la première migration, depuis un poste ayant accès à la base :

```sh
pnpm seed:content
```

Le seed ne remplace jamais un contenu existant et peut être relancé sans risque. Le contenu de l'ancien site et les projets récents arrivent en brouillon avec une note, listés dans Administration, « À valider ». Ajouter `--no-images` pour ne pas télécharger les visuels.

## 6. Cron Jobs

cPanel, « Cron Jobs ». Toujours se placer dans le dossier de l'application pour que `.env` soit lu, et utiliser le binaire Node de l'application :

```
NODE=/home/<utilisateur>/nodevenv/portfolio/22/bin/node
cd /home/<utilisateur>/portfolio && $NODE dist/cron.js <tâche> >> /home/<utilisateur>/portfolio_data/cron.log 2>&1
```

Horaires donnés pour un serveur réglé sur UTC : 5 h UTC correspond à 7 h à Bukavu (UTC+2). Vérifier l'heure du serveur avec `date` et adapter.

| Fréquence (UTC) | Commande | Rôle |
|---|---|---|
| `*/5 * * * *` | `dist/cron.js run-jobs` | file de jobs : e-mails en attente, rappels de tâches, alertes de sécurité groupées, renvoi vers Batela, puis synchronisation des bannissements si `BAN_SYNC` est activé. 4 minutes maximum par passage |
| `0 5 * * *` | `dist/cron.js daily-digest` | récapitulatif de 7 h : tâches du jour et en retard, jalons proches, factures à suivre (e-mail et notification). Rien n'est envoyé si tout est vide |
| `15 22 * * *` | `dist/cron.js nightly` | purge des limites de débit, sessions et jetons expirés, devis échus en « expiré », factures échues en « en retard », agrégation de l'audience de la veille, rétention (audience 13 mois, sécurité 12 mois, erreurs 3 mois) |
| `30 0 * * *` | `sh scripts/backup.sh` | sauvegarde chiffrée de la base et des fichiers (section 7) |

Chaque passage est enregistré dans la table `cron_runs`, visible dans Administration, Monitoring, Journaux, « Tâches planifiées ». Si la dernière exécution de `run-jobs` date de plus de 15 minutes, le cron ne tourne plus. Les rappels ont la précision du cron (5 minutes, ou plus si l'hébergeur impose une fréquence plus faible).

Autres commandes utiles :

- `dist/cron.js healthcheck` : vérifie base, Argon2id, dossier de données, `sharp` et SMTP ;
- `dist/cron.js sync-bans` : synchronisation immédiate des bannissements ;
- `dist/cron.js nightly AAAA-MM-JJ` : recalcule l'agrégat d'un jour donné ;
- `dist/cron.js vapid-keys` : génère une paire de clés Web Push (section 8).

## 7. Sauvegardes et restauration

En plus des sauvegardes du cPanel, `scripts/backup.sh` produit chaque nuit une archive chiffrée (AES-256, clé dérivée de `BACKUP_PASSPHRASE`) contenant le dump de la base et les dossiers `uploads` et `private`. Les archives de plus de `BACKUP_KEEP_DAYS` jours (30 par défaut) sont supprimées.

Copie hors de l'hébergement : installer `rclone` dans le dossier personnel (binaire statique), configurer une destination (par exemple Cloudflare R2, Backblaze ou Google Drive) avec `rclone config`, puis renseigner `BACKUP_REMOTE` (ex. `r2:portfolio-backups`). Sans `rclone`, télécharger régulièrement le dossier `~/portfolio_data/backups`.

La phrase de passe doit être conservée hors du serveur (gestionnaire de mots de passe) : sans elle, les archives sont illisibles.

Restauration (à tester une fois par trimestre sur une base vide) :

```sh
cd ~/portfolio && set -a && . ./.env && set +a
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in ~/portfolio_data/backups/portfolio-AAAA-MM-JJ_HHMM.tar.gz.enc -out /tmp/restore.tar.gz -pass env:BACKUP_PASSPHRASE
mkdir -p /tmp/restore && tar -xzf /tmp/restore.tar.gz -C /tmp/restore
psql "$DATABASE_URL" < /tmp/restore/database.sql          # base vide ou recréée au préalable
tar -xzf /tmp/restore/files.tar.gz -C ~/portfolio_data     # uploads et private
rm -rf /tmp/restore /tmp/restore.tar.gz
touch tmp/restart.txt
```

## 8. Notifications Web Push

1. Générer les clés : `node dist/cron.js vapid-keys`.
2. Copier `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans « Setup Node.js App » et dans `.env`, avec `VAPID_SUBJECT=mailto:adresse`, puis redémarrer.
3. Dans Administration, « Tâches et agenda », cliquer « Activer les notifications » sur chaque appareil (ordinateur, téléphone). Sur iPhone, ajouter d'abord l'administration à l'écran d'accueil (iOS 16.4 ou plus).

Changer les clés désabonne tous les appareils : il faut réactiver les notifications sur chacun.

## 9. Sécurité, Cloudflare et bannissements

Le module de sécurité fonctionne seul : chaque requête est analysée, les IP bannies reçoivent une réponse 403. Recommandations :

- **Ajouter vos IP habituelles à la liste blanche** (Monitoring, Bannissements, « Ajouter mon adresse », ou `IP_ALLOWLIST`). Elles ne sont jamais bannies et sont exclues de l'audience.
- `TRUST_PROXY=true` est indispensable derrière Apache et Cloudflare, sinon toutes les requêtes ont l'adresse `0.0.0.0` (jamais bannie, donc aucune protection par IP).
- Seuil de bannissement et alertes : Monitoring, Bannissements, « Réglages ». Durées progressives : 1 h, 24 h, 7 jours, puis permanent.

**Cloudflare (recommandé)** : créer la zone, faire pointer les serveurs DNS du domaine vers Cloudflare, enregistrement A vers l'IP du cPanel en mode proxy (nuage orange), SSL « Full (strict) » (le certificat AutoSSL du cPanel reste valide). Le pays des visiteurs vient alors de l'en-tête `CF-IPCountry`. Pour bloquer les IP bannies dès Cloudflare :

1. My Profile, API Tokens, « Create Token », modèle personnalisé avec la permission « Zone, Firewall Services, Edit » limitée à la zone du site ;
2. renseigner `BAN_SYNC=cloudflare`, `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ZONE_ID` (onglet Overview de la zone) ;
3. les bannissements sont envoyés comme règles d'accès « block » à chaque passage de `run-jobs`, et retirés à leur expiration ou levée.

**Sans Cloudflare**, `BAN_SYNC=htaccess` et `HTACCESS_PATH` (le `.htaccess` du domaine) : seul le bloc entre `# BEGIN portfolio-bans` et `# END portfolio-bans` est réécrit (500 adresses maximum), après copie de sauvegarde `.htaccess.portfolio-backup`. Le reste du fichier (règles Passenger du cPanel) n'est jamais modifié.

**Batela** : `MONITORING_TRANSPORT=batela`, `BATELA_ENDPOINT` et `BATELA_API_KEY`. Les événements restent stockés localement (tableaux de bord) et sont aussi envoyés par lots au format `{ v: 1, type, ts, app: "portfolio", data }`, avec reprise automatique en cas d'échec.

## 10. Rotation des secrets

| Secret | Procédure | Effet |
|---|---|---|
| `AUTH_ENCRYPTION_KEY` | nouvelle valeur, redémarrer, puis désactiver et réactiver la double authentification | les secrets TOTP chiffrés avec l'ancienne clé deviennent illisibles |
| `AUTH_PEPPER` | à éviter : tous les mots de passe deviennent invalides, réinitialiser avec `create-admin` | déconnexion générale |
| `SMTP_PASS` | changer dans cPanel, « Email Accounts », puis dans l'application et `.env` | aucun |
| `CLOUDFLARE_API_TOKEN` | créer un nouveau jeton, remplacer, révoquer l'ancien | aucun |
| `VAPID_*` | voir section 8 | réabonnement des appareils |
| `IP_HASH_SALT_SECRET` | remplacer | les visiteurs du jour sont comptés deux fois |
| `BACKUP_PASSPHRASE` | remplacer, garder l'ancienne tant que des archives chiffrées avec elle sont conservées | aucun |
| Clé SSH de déploiement | nouvelle paire, clé publique dans cPanel, privée dans les secrets GitHub, supprimer l'ancienne | aucun |

Après toute fuite suspectée : changer le mot de passe administrateur, « Déconnecter les autres sessions » dans Sécurité du compte, puis tourner les secrets concernés.

## 11. Développement local

Prérequis : Node 22 ou plus, pnpm, PostgreSQL local.

```sh
pnpm install
cp .env.example .env.local          # puis renseigner DATABASE_URL et AUTH_ENCRYPTION_KEY
pnpm db:migrate
pnpm seed:content
pnpm create-admin
pnpm dev
```

Tests d'intégration : créer une base dont le nom contient `test` et la déclarer dans `.env.test.local` :

```
TEST_DATABASE_URL=postgres://postgres:motdepasse@localhost:5432/portfolio_test
```

Vérifications avant commit : `pnpm check:chars && pnpm lint && pnpm typecheck && pnpm test`. Les hooks git du dossier `.githooks` (activés par `pnpm install`) refusent les tirets cadratins, demi-cadratins, signes paragraphe et emoji, ainsi que les messages de commit hors format `type: description`.
