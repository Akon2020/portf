# Portfolio d'Isaac Akonkwa

Site personnel bilingue (FR, EN) avec back-office, mini-CRM, facturation USD et CDF, espace client et module de sécurité, développé avec Next.js, PostgreSQL et Drizzle, déployé sur cPanel.

## Démarrage rapide

```sh
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm create-admin
pnpm dev
```

Mise en ligne pas à pas : [docs/deploiement.md](docs/deploiement.md). Le détail (base de données, tests d'intégration, Cron Jobs, sauvegardes, sécurité) est dans [docs/ops.md](docs/ops.md).

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production (`standalone`) |
| `pnpm build:cron` | compile `cron/` en `dist/cron.js` et `dist/migrate.js` |
| `pnpm cron:dev <tâche>` | exécute une tâche cron en local (`run-jobs`, `nightly`, `healthcheck`) |
| `pnpm create-admin` | crée ou réinitialise le compte super_admin |
| `pnpm db:generate` | génère une migration à partir du schéma |
| `pnpm db:migrate` | applique les migrations |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | tests unitaires et d'intégration (Vitest) |
| `pnpm check:chars` | contrôle des caractères interdits |

## Conventions

- Branche de travail `develop`, messages de commit au format `type: description` (`feat`, `fix`, `refactor`, `chore`, `update`, `docs`, `test`).
- Aucun tiret cadratin, tiret demi-cadratin, signe paragraphe ni emoji dans le code, le contenu ou les commits (contrôlé par les tests, les hooks git et la CI).
- Interface d'administration en français, code en anglais.
