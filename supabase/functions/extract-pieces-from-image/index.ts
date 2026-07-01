// Edge function: lê uma imagem (foto/print de projeto) e extrai a lista
// de peças usando Gemini multimodal via Lovable AI Gateway.
// Retorna: { pieces: [{item, descricao, material, larguraMm, alturaMm, espessuraMm, quantidade, confidence}], cotasNoDesenho: number[], divergencias: string[] }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um leitor de planos de marcenaria/CNC em português do Brasil.
A imagem contém um desenho técnico com peças numeradas (1, 2, 3...) e, quando disponível, uma TABELA na parte inferior listando "Item | Descrição | Dimensão".

QUANDO HOUVER TABELA: extraia ESTRITAMENTE dela.
QUANDO NÃO HOUVER TABELA: extraia as peças usando APENAS as cotas escritas no próprio desenho (medidas visíveis, chamadas de material, títulos das vistas). Nesse caso adicione em "divergencias" o aviso: "Sem tabela de referência no desenho — leitura baseada apenas nas cotas do desenho." Descrição pode ser genérica (ex: "Porta 1", "Peça A") e material pode ficar vazio se não estiver escrito.

Campos por peça:
- item: número inteiro da peça
- descricao: texto completo exato quando houver tabela; genérico quando não houver
- material: tipo/cor do MDF SEM a palavra MDF e SEM o modelo após o hífen (ex: "Branco TX", "Louro Freijó Trend"). String vazia se não identificável.
- larguraMm, alturaMm, espessuraMm: dimensões em milímetros (LxAxE, ex "313x675x18,5" → 313, 675, 18.5). Vírgula é decimal. Se a espessura não for informada, use 18.
- quantidade: se a tabela tiver coluna Qtd use; senão conte no desenho (na dúvida, 1).
- furosDobradica: nº de furos de dobradiça visíveis (círculos de Ø35mm na borda lateral). 0 se não houver.
- confidence: 0.0–1.0.

Leia também as COTAS soltas do desenho em "cotasNoDesenho" (só o que estiver visível, sem inventar).

Em "divergencias" liste inconsistências (ex: "Peça 5 tabela diz 314 mas cota no desenho mostra 313") e, se aplicável, o aviso de ausência de tabela.

Responda APENAS JSON válido no schema solicitado, sem markdown, sem comentários.`;

const SCHEMA = {
  type: "object",
  properties: {
    pieces: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "integer" },
          descricao: { type: "string" },
          material: { type: "string" },
          larguraMm: { type: "number" },
          alturaMm: { type: "number" },
          espessuraMm: { type: "number" },
          quantidade: { type: "integer" },
          furosDobradica: { type: "integer" },
          confidence: { type: "number" },
        },
        required: ["item", "descricao", "material", "larguraMm", "alturaMm", "espessuraMm", "quantidade", "furosDobradica", "confidence"],
        additionalProperties: false,
      },
    },
    cotasNoDesenho: { type: "array", items: { type: "number" } },
    divergencias: { type: "array", items: { type: "string" } },
  },
  required: ["pieces", "cotasNoDesenho", "divergencias"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "LOVABLE_API_KEY ausente" }, { status: 500, headers: CORS });
  }

  let body: { imageDataUrl?: string; reviewMode?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: CORS });
  }
  const { imageDataUrl, reviewMode } = body;
  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return Response.json({ error: "imageDataUrl deve ser um data:image/...;base64,..." }, { status: 400, headers: CORS });
  }

  const reviewSuffix = reviewMode
    ? `\n\nMODO REVISÃO CRÍTICA: Uma primeira leitura teve baixa confiança. RELEIA a imagem com atenção redobrada. Compare CADA valor da tabela COM as cotas escritas no desenho. Se a tabela diz "313x675" mas o desenho mostra "314x675", ajuste para o valor CORRETO e liste a correção em "divergencias". Confidence só pode ser >=0.95 se você tiver certeza absoluta.`
    : "";

  const payload = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: SYSTEM_PROMPT + reviewSuffix },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia as peças desta imagem conforme as instruções." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "PiecesExtraction", schema: SCHEMA, strict: true },
    },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "raw-fetch",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) {
      return Response.json(
        { error: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." },
        { status: 429, headers: CORS },
      );
    }
    if (resp.status === 402) {
      return Response.json(
        { error: "Créditos de IA esgotados. Adicione créditos no workspace para continuar." },
        { status: 402, headers: CORS },
      );
    }
    console.error("Gateway error", resp.status, errText);
    return Response.json({ error: `Erro do gateway (${resp.status})`, detail: errText }, { status: 502, headers: CORS });
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "Resposta vazia do modelo", raw: data }, { status: 502, headers: CORS });
  }
  let parsed: unknown;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return Response.json({ error: "Resposta não é JSON válido", raw: content }, { status: 502, headers: CORS });
  }
  return Response.json(parsed, { headers: CORS });
});
