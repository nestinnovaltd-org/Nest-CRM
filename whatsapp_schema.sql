-- ==========================================
-- WhatsApp Automation & AI Module Schema
-- Run this in Supabase SQL Editor (separate from existing supabase_schema.sql)
-- This file ONLY adds new tables — it does NOT modify any existing CRM tables.
-- ==========================================

-- ─────────────────────────────────────────
-- 1. whatsapp_sessions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID NOT NULL,
    user_id         UUID NOT NULL,
    session_name    TEXT NOT NULL,
    phone_number    TEXT,
    status          TEXT DEFAULT 'DISCONNECTED'
                    CHECK (status IN ('CONNECTING','QR_REQUIRED','CONNECTED','DISCONNECTED','RECONNECTING','ERROR')),
    session_path    TEXT,
    ai_mode         TEXT DEFAULT 'AI_OFF'
                    CHECK (ai_mode IN ('AI_OFF','AI_SUGGESTION','AI_AUTO_REPLY')),
    last_connected_at    TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    last_activity_at     TIMESTAMPTZ,
    reconnect_attempts   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_org_status ON public.whatsapp_sessions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_ws_user       ON public.whatsapp_sessions(user_id);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_sessions;
CREATE POLICY "Service role full access" ON public.whatsapp_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_sessions;
CREATE POLICY "Org members read own data" ON public.whatsapp_sessions
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 2. whatsapp_lead_status
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_lead_status (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id               UUID NOT NULL,
    org_id                UUID NOT NULL,
    phone_number          TEXT,
    normalized_phone      TEXT,
    whatsapp_status       TEXT DEFAULT 'PENDING'
                          CHECK (whatsapp_status IN (
                              'PENDING','CHECKING','WHATSAPP_AVAILABLE',
                              'WHATSAPP_NOT_AVAILABLE','INVALID_NUMBER',
                              'CHECK_FAILED','UNKNOWN'
                          )),
    whatsapp_link         TEXT,
    last_checked_at       TIMESTAMPTZ,
    checked_by_session_id UUID,
    check_error           TEXT,
    opted_out             BOOLEAN DEFAULT false,
    opted_out_at          TIMESTAMPTZ,
    opted_out_reason      TEXT,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_wls_lead_id    ON public.whatsapp_lead_status(lead_id);
CREATE INDEX IF NOT EXISTS idx_wls_org_status ON public.whatsapp_lead_status(org_id, whatsapp_status);
CREATE INDEX IF NOT EXISTS idx_wls_opted_out  ON public.whatsapp_lead_status(org_id, opted_out);

ALTER TABLE public.whatsapp_lead_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_lead_status;
CREATE POLICY "Service role full access" ON public.whatsapp_lead_status
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_lead_status;
CREATE POLICY "Org members read own data" ON public.whatsapp_lead_status
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 3. whatsapp_templates
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID NOT NULL,
    user_id     UUID NOT NULL,
    name        TEXT NOT NULL,
    body        TEXT NOT NULL,
    variables   JSONB DEFAULT '[]'::jsonb,
    status      TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wt_org ON public.whatsapp_templates(org_id, status);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_templates;
CREATE POLICY "Service role full access" ON public.whatsapp_templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_templates;
CREATE POLICY "Org members read own data" ON public.whatsapp_templates
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 4. whatsapp_campaigns
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID NOT NULL,
    user_id             UUID NOT NULL,
    name                TEXT NOT NULL,
    session_id          UUID NOT NULL,
    template_id         UUID NOT NULL,
    status              TEXT DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','STOPPED','FAILED')),
    lead_filter         JSONB DEFAULT '{}'::jsonb,
    daily_limit         INT DEFAULT 200,
    min_delay_seconds   INT DEFAULT 8,
    max_delay_seconds   INT DEFAULT 20,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    paused_at           TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    pause_reason        TEXT,
    allow_resend        BOOLEAN DEFAULT false,
    consent_confirmed   BOOLEAN DEFAULT false,
    total_recipients    INT DEFAULT 0,
    sent_count          INT DEFAULT 0,
    failed_count        INT DEFAULT 0,
    skipped_count       INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc_org_status ON public.whatsapp_campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS idx_wc_session    ON public.whatsapp_campaigns(session_id, status);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_campaigns;
CREATE POLICY "Service role full access" ON public.whatsapp_campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_campaigns;
CREATE POLICY "Org members read own data" ON public.whatsapp_campaigns
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 5. whatsapp_campaign_recipients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id         UUID NOT NULL,
    lead_id             UUID NOT NULL,
    org_id              UUID NOT NULL,
    phone_number        TEXT NOT NULL,
    message_body        TEXT,
    status              TEXT DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED','PROCESSING','SENT','DELIVERED','READ','FAILED','SKIPPED','CANCELLED')),
    error_message       TEXT,
    provider_message_id TEXT,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    retry_count         INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_wcr_campaign_lead ON public.whatsapp_campaign_recipients(campaign_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_wcr_status        ON public.whatsapp_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_wcr_sent_at       ON public.whatsapp_campaign_recipients(campaign_id, sent_at);

ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Service role full access" ON public.whatsapp_campaign_recipients
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Org members read own data" ON public.whatsapp_campaign_recipients
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 6. whatsapp_conversations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID NOT NULL,
    lead_id         UUID,
    session_id      UUID NOT NULL,
    phone_number    TEXT NOT NULL,
    lead_name       TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    unread_count    INT DEFAULT 0,
    ai_status       TEXT DEFAULT 'ACTIVE'
                    CHECK (ai_status IN ('ACTIVE','SUGGESTION','MANUAL','HUMAN_REQUIRED','PAUSED')),
    assigned_to     UUID,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (lead_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_wconv_session_lead  ON public.whatsapp_conversations(session_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_wconv_org_activity  ON public.whatsapp_conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wconv_ai_status     ON public.whatsapp_conversations(org_id, ai_status);
CREATE INDEX IF NOT EXISTS idx_wconv_phone         ON public.whatsapp_conversations(phone_number);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_conversations;
CREATE POLICY "Service role full access" ON public.whatsapp_conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_conversations;
CREATE POLICY "Org members read own data" ON public.whatsapp_conversations
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 7. whatsapp_messages
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID NOT NULL,
    lead_id             UUID,
    session_id          UUID NOT NULL,
    conversation_id     UUID,
    campaign_id         UUID,
    direction           TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
    message_source      TEXT DEFAULT 'MANUAL' CHECK (message_source IN ('MANUAL','CAMPAIGN','AI')),
    message_type        TEXT DEFAULT 'text',
    message_body        TEXT,
    status              TEXT DEFAULT 'QUEUED'
                        CHECK (status IN ('QUEUED','PROCESSING','SENT','DELIVERED','READ','FAILED','CANCELLED')),
    provider_message_id TEXT,
    error_message       TEXT,
    is_ai_generated     BOOLEAN DEFAULT false,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wm_conversation ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm_lead         ON public.whatsapp_messages(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm_org_dir      ON public.whatsapp_messages(org_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm_campaign     ON public.whatsapp_messages(campaign_id);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_messages;
CREATE POLICY "Service role full access" ON public.whatsapp_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_messages;
CREATE POLICY "Org members read own data" ON public.whatsapp_messages
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 8. whatsapp_ai_settings
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_settings (
    id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                      UUID NOT NULL,
    session_id                  UUID,
    ai_mode                     TEXT DEFAULT 'AI_OFF'
                                CHECK (ai_mode IN ('AI_OFF','AI_SUGGESTION','AI_AUTO_REPLY')),
    system_prompt               TEXT,
    max_history_messages        INT DEFAULT 10,
    auto_reply_delay_seconds    INT DEFAULT 3,
    escalation_keywords         TEXT[] DEFAULT ARRAY['human','agent','manager','complaint','refund','legal','call me','sales person','মানুষ','ম্যানেজার','অভিযোগ'],
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_was_org ON public.whatsapp_ai_settings(org_id);

ALTER TABLE public.whatsapp_ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_ai_settings;
CREATE POLICY "Service role full access" ON public.whatsapp_ai_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_ai_settings;
CREATE POLICY "Org members read own data" ON public.whatsapp_ai_settings
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 9. whatsapp_ai_logs
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_logs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID NOT NULL,
    conversation_id     UUID,
    message_id          UUID,
    model               TEXT,
    prompt_tokens       INT DEFAULT 0,
    completion_tokens   INT DEFAULT 0,
    total_tokens        INT DEFAULT 0,
    input_preview       TEXT,
    output_preview      TEXT,
    was_sent            BOOLEAN DEFAULT false,
    rejection_reason    TEXT,
    escalation_detected BOOLEAN DEFAULT false,
    latency_ms          INT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wal_org          ON public.whatsapp_ai_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wal_conversation ON public.whatsapp_ai_logs(conversation_id);

ALTER TABLE public.whatsapp_ai_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.whatsapp_ai_logs;
CREATE POLICY "Service role full access" ON public.whatsapp_ai_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Org members read own data" ON public.whatsapp_ai_logs;
CREATE POLICY "Org members read own data" ON public.whatsapp_ai_logs
    FOR SELECT TO authenticated
    USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid() LIMIT 1));

-- ─────────────────────────────────────────
-- 10. updated_at auto-update trigger function
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all WhatsApp tables that have updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'whatsapp_sessions',
        'whatsapp_lead_status',
        'whatsapp_templates',
        'whatsapp_campaigns',
        'whatsapp_campaign_recipients',
        'whatsapp_conversations',
        'whatsapp_messages',
        'whatsapp_ai_settings'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;
             CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON public.%s
             FOR EACH ROW EXECUTE FUNCTION public.whatsapp_set_updated_at();',
            t, t, t, t
        );
    END LOOP;
END;
$$;

-- --- RPC helper functions (required by message worker) ----------------------
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE whatsapp_campaigns
  SET sent_count = COALESCE(sent_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id UUID)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE whatsapp_campaigns
  SET failed_count = COALESCE(failed_count, 0) + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
$$;
