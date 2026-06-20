-- ═══════════════════════════════════════════════════════════════════════════════
-- Revenue Copilot — Row-Level Security (RLS) Policies
-- Aislamiento de datos multi-tenant a nivel de base de datos
-- Requisito 8.2: Impedir que un Tenant acceda a datos de otro Tenant
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Función para establecer el tenant actual en la sesión
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- Función auxiliar para obtener el tenant actual de forma segura
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Habilitar RLS en todas las tablas con tenant_id
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Políticas RLS — SELECT (lectura filtrada por tenant)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_select_tenants ON tenants
  FOR SELECT USING (id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_tenant_users ON tenant_users
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_leads ON leads
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_conversations ON conversations
  FOR SELECT USING (tenant_id = get_current_tenant_id());


CREATE POLICY tenant_isolation_select_messages ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_select_scoring_configs ON scoring_configs
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_score_history ON score_history
  FOR SELECT USING (
    lead_id IN (
      SELECT id FROM leads WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_select_follow_up_sequences ON follow_up_sequences
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_follow_up_steps ON follow_up_steps
  FOR SELECT USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_select_follow_up_executions ON follow_up_executions
  FOR SELECT USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_select_appointments ON appointments
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_calendar_configs ON calendar_configs
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_knowledge_entries ON knowledge_entries
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_whatsapp_configs ON whatsapp_configs
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_conversation_templates ON conversation_templates
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_select_metric_snapshots ON metric_snapshots
  FOR SELECT USING (tenant_id = get_current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Políticas RLS — INSERT (solo insertar con el tenant actual)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_insert_tenants ON tenants
  FOR INSERT WITH CHECK (id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_tenant_users ON tenant_users
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_leads ON leads
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_conversations ON conversations
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_messages ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_insert_scoring_configs ON scoring_configs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_score_history ON score_history
  FOR INSERT WITH CHECK (
    lead_id IN (
      SELECT id FROM leads WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_insert_follow_up_sequences ON follow_up_sequences
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_follow_up_steps ON follow_up_steps
  FOR INSERT WITH CHECK (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_insert_follow_up_executions ON follow_up_executions
  FOR INSERT WITH CHECK (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_insert_appointments ON appointments
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_calendar_configs ON calendar_configs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_knowledge_entries ON knowledge_entries
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_whatsapp_configs ON whatsapp_configs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_conversation_templates ON conversation_templates
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_insert_metric_snapshots ON metric_snapshots
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Políticas RLS — UPDATE (solo actualizar registros del tenant actual)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_update_tenants ON tenants
  FOR UPDATE USING (id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_tenant_users ON tenant_users
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_leads ON leads
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_conversations ON conversations
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_messages ON messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_update_scoring_configs ON scoring_configs
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_score_history ON score_history
  FOR UPDATE USING (
    lead_id IN (
      SELECT id FROM leads WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_update_follow_up_sequences ON follow_up_sequences
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_follow_up_steps ON follow_up_steps
  FOR UPDATE USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_update_follow_up_executions ON follow_up_executions
  FOR UPDATE USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_update_appointments ON appointments
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_calendar_configs ON calendar_configs
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_knowledge_entries ON knowledge_entries
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_whatsapp_configs ON whatsapp_configs
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_conversation_templates ON conversation_templates
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_update_metric_snapshots ON metric_snapshots
  FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Políticas RLS — DELETE (solo eliminar registros del tenant actual)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_delete_tenants ON tenants
  FOR DELETE USING (id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_tenant_users ON tenant_users
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_leads ON leads
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_conversations ON conversations
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_messages ON messages
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_delete_scoring_configs ON scoring_configs
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_score_history ON score_history
  FOR DELETE USING (
    lead_id IN (
      SELECT id FROM leads WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_delete_follow_up_sequences ON follow_up_sequences
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_follow_up_steps ON follow_up_steps
  FOR DELETE USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_delete_follow_up_executions ON follow_up_executions
  FOR DELETE USING (
    sequence_id IN (
      SELECT id FROM follow_up_sequences WHERE tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY tenant_isolation_delete_appointments ON appointments
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_calendar_configs ON calendar_configs
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_knowledge_entries ON knowledge_entries
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_whatsapp_configs ON whatsapp_configs
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_conversation_templates ON conversation_templates
  FOR DELETE USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_delete_metric_snapshots ON metric_snapshots
  FOR DELETE USING (tenant_id = get_current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Bypass para el rol de la aplicación (superadmin/migrations)
--    El usuario de la aplicación necesita bypass para operaciones de sistema
--    como crear tenants nuevos o ejecutar migraciones.
--    Ajustar 'app_admin' al rol real de administración.
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTA: Descomentar y ajustar según el rol de administración de tu entorno:
-- ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
-- CREATE POLICY bypass_rls_for_admin ON tenants TO app_admin USING (true);
