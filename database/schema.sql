-- ============================================================================
-- SCHÉMA RELATIONNEL DE PRODUCTION : SYNCHRONISATION MULTI-APPAREILS (POSTGRESQL)
-- Authentification Google OAuth (sub / google_id)
-- Intégrité référentielle, Index composites et Row-Level Security (RLS)
-- ============================================================================

-- 1. Extension pour la génération d'UUID v4 sécurisés
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLE UTILISATEURS (users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) NOT NULL UNIQUE,       -- 'sub' du jeton JWT Google OAuth
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour lookup O(1) lors de la validation du token Google OAuth
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ============================================================================
-- 3. TABLE CONVERSATIONS (conversations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Nouvelle discussion',
    mode VARCHAR(50) NOT NULL DEFAULT 'general',  -- ex: general, fast, code, study, creative
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_conversations_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id) 
        ON DELETE CASCADE
);

-- Index pour lister les discussions d'un compte triées par activité récente (sans filesort)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations (user_id, updated_at DESC);

-- ============================================================================
-- 4. TABLE MESSAGES (messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,                        -- Clé utilisateur pour le RLS sans jointure coûteuse
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model VARCHAR(100),                          -- Moteur IA ayant répondu
    attachments JSONB,                            -- Métadonnées des fichiers ou images joints
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) 
        REFERENCES conversations (id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_messages_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id) 
        ON DELETE CASCADE
);

-- Index pour charger le fil chronologique ou paginer par curseur
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages (user_id, created_at DESC);

-- ============================================================================
-- 5. TRIGGERS DE MISE À JOUR DE L'HORODATAGE updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. POLITIQUES DE SÉCURITÉ ROW-LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Fonction helper extrayant l'ID de l'utilisateur courant via le JWT claim 'sub' (Google ID)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT id FROM users 
  WHERE google_id = current_setting('request.jwt.claim.sub', true)
     OR id::text = current_setting('request.jwt.claim.sub', true)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Politiques pour la table 'users'
DROP POLICY IF EXISTS "Lecture profil utilisateur" ON users;
CREATE POLICY "Lecture profil utilisateur"
    ON users FOR SELECT
    USING (id = current_user_id());

DROP POLICY IF EXISTS "Modification profil utilisateur" ON users;
CREATE POLICY "Modification profil utilisateur"
    ON users FOR UPDATE
    USING (id = current_user_id());

-- Politiques pour la table 'conversations'
DROP POLICY IF EXISTS "Lecture conversations propriétaire" ON conversations;
CREATE POLICY "Lecture conversations propriétaire"
    ON conversations FOR SELECT
    USING (user_id = current_user_id());

DROP POLICY IF EXISTS "Insertion conversations propriétaire" ON conversations;
CREATE POLICY "Insertion conversations propriétaire"
    ON conversations FOR INSERT
    WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Modification conversations propriétaire" ON conversations;
CREATE POLICY "Modification conversations propriétaire"
    ON conversations FOR UPDATE
    USING (user_id = current_user_id());

DROP POLICY IF EXISTS "Suppression conversations propriétaire" ON conversations;
CREATE POLICY "Suppression conversations propriétaire"
    ON conversations FOR DELETE
    USING (user_id = current_user_id());

-- Politiques pour la table 'messages'
DROP POLICY IF EXISTS "Lecture messages propriétaire" ON messages;
CREATE POLICY "Lecture messages propriétaire"
    ON messages FOR SELECT
    USING (user_id = current_user_id());

DROP POLICY IF EXISTS "Insertion messages propriétaire" ON messages;
CREATE POLICY "Insertion messages propriétaire"
    ON messages FOR INSERT
    WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Suppression messages propriétaire" ON messages;
CREATE POLICY "Suppression messages propriétaire"
    ON messages FOR DELETE
    USING (user_id = current_user_id());
