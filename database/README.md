# Base de Données Relationnelle & Synchronisation Multi-Appareils

Cette architecture assure la synchronisation temps réel des discussions et messages entre smartphones, tablettes et ordinateurs d'un même utilisateur connecté via **Google OAuth**.

---

## 1. Structure des Tables

* **`users`** :
  * `id` : Identifiant UUID généré côté serveur.
  * `google_id` : L'identifiant immuable `sub` issu du jeton JWT Google OAuth (indexé en O(1)).
  * `email` et `name` : Informations du compte Google.
* **`conversations`** :
  * Liée à l'utilisateur par clé étrangère `user_id` (`ON DELETE CASCADE`).
  * Index composite `(user_id, updated_at DESC)` pour afficher la liste des discussions sans tri mémoire lourd.
* **`messages`** :
  * Liée à `conversation_id` (`ON DELETE CASCADE`) et `user_id`.
  * Index composite `(conversation_id, created_at ASC)` pour un chargement chronologique fluide ou une pagination par curseur.

---

## 2. Déploiement SQL (PostgreSQL, Supabase, Neon, Cloud SQL)

Pour appliquer le schéma relationnel directement dans votre instance PostgreSQL :

```bash
psql -h <VOTRE_HOTE> -U <VOTRE_UTILISATEUR> -d <VOTRE_BDD> -f database/schema.sql
```

---

## 3. Déploiement Prisma ORM

Si vous utilisez Prisma :

1. Définissez votre variable d'environnement dans `.env` :
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
   ```
2. Appliquez la migration :
   ```bash
   npx prisma migrate dev --name init_multi_device_sync
   ```
3. Générez le client typé :
   ```bash
   npx prisma generate
   ```

---

## 4. Sécurité Row-Level Security (RLS)

Toutes les tables sont protégées par RLS. Aucun utilisateur ne peut lire ou insérer de données appartenant à un autre compte Google :
* Chaque requête vérifie que `user_id` correspond au `sub` extrait du token JWT de session.
* La suppression d'une conversation supprime automatiquement tous les messages rattachés via `CASCADE`.
