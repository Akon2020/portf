# Exploitation et déploiement (cPanel)

Ce document décrit l'installation et l'exploitation du site sur un hébergement cPanel mutualisé avec « Setup Node.js App » (Phusion Passenger). Il sera complété en phase 7 (Cloudflare, sauvegardes externes, rotation des secrets).

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

La liste complète est dans `.env.example`. Valeurs minimales : `NODE_ENV=production`, `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `AUTH_ENCRYPTION_KEY` (32 octets en base64), `TRUST_PROXY=true`, `DATA_DIR=/home/<utilisateur>/portfolio_data`, `TZ=Africa/Lubumbashi`.

Générer `AUTH_ENCRYPTION_KEY` :

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Cette clé chiffre les secrets TOTP : la perdre oblige à reconfigurer la double authentification. La conserver dans un gestionnaire de mots de passe.

### Dossier de données

Hors du dossier de l'application pour survivre aux déploiements :

```sh
mkdir -p ~/portfolio_data/uploads ~/portfolio_data/backups
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

La commande demande l'e-mail, le nom et le mot de passe (saisie masquée). La double authentification est configurée à la première connexion sur `/admin`. Options :

- `--email adresse` pour éviter la question ;
- relancer la commande sur un compte existant réinitialise le mot de passe et révoque toutes les sessions ;
- `--reset-2fa` réinitialise aussi la double authentification (perte du téléphone et des codes de secours).

En local : `pnpm create-admin`.

## 6. Cron Jobs

cPanel, « Cron Jobs ». Toujours se placer dans le dossier de l'application pour que `.env` soit lu, et utiliser le binaire Node de l'application :

```
NODE=/home/<utilisateur>/nodevenv/portfolio/22/bin/node
cd /home/<utilisateur>/portfolio && $NODE dist/cron.js <tâche> >> /home/<utilisateur>/portfolio_data/cron.log 2>&1
```

| Fréquence | Tâche | Rôle |
|---|---|---|
| `*/5 * * * *` | `run-jobs` | file de jobs (e-mails, alertes, rappels), 4 minutes maximum par passage |
| `15 0 * * *` | `nightly` | purge des limites de débit, sessions et jetons expirés |

D'autres tâches arriveront avec les phases suivantes (`daily-digest`, `weekly`, sauvegarde). Chaque exécution de `run-jobs` et `nightly` est enregistrée dans la table `cron_runs`. Si l'hébergeur impose une fréquence plus faible, les rappels auront la précision correspondante.

L'heure du cron cPanel est souvent celle du serveur : convertir les horaires vers `Africa/Lubumbashi` (UTC+2).

## 7. Sauvegardes (version initiale)

En plus des sauvegardes cPanel, une sauvegarde quotidienne compressée :

```
30 2 * * * pg_dump "$DATABASE_URL" | gzip > ~/portfolio_data/backups/db-$(date +\%F).sql.gz && find ~/portfolio_data/backups -name 'db-*.sql.gz' -mtime +14 -delete
```

Restauration :

```sh
gunzip -c ~/portfolio_data/backups/db-AAAA-MM-JJ.sql.gz | psql "$DATABASE_URL"
```

La copie hors de l'hébergement et le chiffrement seront ajoutés en phase 7.

## 8. Développement local

Prérequis : Node 22 ou plus, pnpm, PostgreSQL local.

```sh
pnpm install
cp .env.example .env.local          # puis renseigner DATABASE_URL et AUTH_ENCRYPTION_KEY
pnpm db:migrate
pnpm create-admin
pnpm dev
```

Tests d'intégration : créer une base dont le nom contient `test` et la déclarer dans `.env.test.local` :

```
TEST_DATABASE_URL=postgres://postgres:motdepasse@localhost:5432/portfolio_test
```

Vérifications avant commit : `pnpm check:chars && pnpm lint && pnpm typecheck && pnpm test`. Les hooks git du dossier `.githooks` (activés par `pnpm install`) refusent les tirets cadratins, demi-cadratins, signes paragraphe et emoji, ainsi que les messages de commit hors format `type: description`.
