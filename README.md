# UFPR ADS Estudos

Aplicacao web de estudos para vestibular UFPR (ADS), com:

- Next.js 15 (App Router)
- SQLite + better-sqlite3
- Drizzle ORM
- shadcn/ui + Tailwind
- Vercel AI SDK + OpenAI

## Executar projeto

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Cadastro em lote sem trabalho manual

Voce pode importar varias provas PDF e deixar a IA:

- separar questoes automaticamente
- classificar disciplina e topico
- estimar dificuldade (1-5)
- tratar enunciados compartilhados (ex.: "responda as questoes 1 e 2")
- gerar imagens por pagina para questoes que dependem de grafico/figura

### 1) Coloque os PDFs

Adicione os arquivos em `data/provas/`.

### 2) Configure a chave da OpenAI

No arquivo `.env`:

```env
OPENAI_API_KEY=...
DATABASE_URL=./db.sqlite
```

### 3) Rode a ingestao

```bash
npm run ingest:pdf
```

Isso vai:

- processar todos os PDFs da pasta `data/provas`
- criar JSONs em `data/processed/<nome-da-prova>/`
- gerar relatorio em `data/processed/ingest-summary.json`
- importar automaticamente no banco

### 4) Modo teste (sem gravar no banco)

```bash
npm run ingest:pdf:dry
```

### Flags uteis

```bash
npm run ingest:pdf -- --input data/provas --chunk 6 --source-prefix UFPR
npm run ingest:pdf -- --no-images
```

- `--chunk`: quantidade de paginas por chamada da IA
- `--no-images`: nao renderiza imagens de paginas

## Importacao em lote pelo Admin (JSON)

Na pagina Admin voce pode colar JSON ou subir arquivo `.json` e importar centenas de questoes de uma vez.

Endpoint: `POST /api/admin/questions/bulk`

Formato:

```json
[
	{
		"subject": "Matematica",
		"topic": "Funcoes",
		"statement": "Se f(x)=2x+3, qual o valor de f(7)?",
		"imageUrl": "/questoes/importadas/prova-x/page-001.png",
		"source": "UFPR 2023",
		"difficulty": 2,
		"alternatives": [
			{ "label": "A", "text": "14", "isCorrect": false },
			{ "label": "B", "text": "17", "isCorrect": true },
			{ "label": "C", "text": "10", "isCorrect": false },
			{ "label": "D", "text": "21", "isCorrect": false },
			{ "label": "E", "text": "7", "isCorrect": false }
		]
	}
]
```
