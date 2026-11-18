# SEXSI TOURNAMENTS

Българска платформа за Standoff 2 турнири.

## Проект

- Публичен сайт: https://sexsi-tournament.github.io/sexsi-tournaments/
- Supabase проект: `fyxlwcoochsuzhqostpe`
- Frontend: статични HTML/CSS/JavaScript файлове, публикувани чрез GitHub Pages.
- Backend: Supabase Database, Auth, Storage и Edge Functions.

## Проверки

При всеки push към `main` се изпълнява `.github/workflows/site-check.yml`, която проверява:
- локалните HTML/CSS/JS препратки;
- дублирани HTML ID атрибути;
- синтаксиса на inline и отделните JavaScript файлове;
- валидността на `sitemap.xml`.

## Supabase

SQL миграциите се съхраняват в `supabase/migrations/`, а изходният код на Edge Functions е в `supabase/functions/`.

Edge Functions използват Supabase secrets за Gmail SMTP:
- `GMAIL_SMTP_USER`
- `GMAIL_SMTP_APP_PASSWORD`
- `GMAIL_FROM_NAME`

Функциите за известия използват Vault secret с име `sexsi_match_hook_token`. Той трябва да бъде създаден отделно в Supabase Vault и никога да не се записва в GitHub или в публичен клиентски код. Пример за структурата на командата в SQL Editor:

```sql
select vault.create_secret('YOUR_RANDOM_TOKEN', 'sexsi_match_hook_token', 'Internal webhook authentication token');
```

Не публикувай service-role ключове, SMTP пароли или webhook токени в хранилището.
