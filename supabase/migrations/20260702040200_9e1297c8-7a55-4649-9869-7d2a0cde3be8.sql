
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  matched_reason TEXT,
  matched_client_id TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_orders_status ON public.service_orders(status);
CREATE INDEX idx_service_orders_received ON public.service_orders(received_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO anon, authenticated;
GRANT ALL ON public.service_orders TO service_role;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so_all_access" ON public.service_orders FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.gmail_sync_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  keywords JSONB NOT NULL DEFAULT '["orçamento","orcamento","pedido","porta","projeto"]'::jsonb,
  require_attachment BOOLEAN NOT NULL DEFAULT true,
  only_known_clients BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  last_history_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.gmail_sync_config (id) VALUES (1);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_sync_config TO anon, authenticated;
GRANT ALL ON public.gmail_sync_config TO service_role;
ALTER TABLE public.gmail_sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gsc_all_access" ON public.gmail_sync_config FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_so_updated BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_gsc_updated BEFORE UPDATE ON public.gmail_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
