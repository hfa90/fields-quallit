# Fields Quallit · Central de Tutoriais

Biblioteca de soluções do time de campo: tutoriais com editor rico, anexos (PDF, Word, PowerPoint, Excel…), links, link curto de compartilhamento, QR Code e registro de **quem visualizou** cada tutorial.

## Funcionalidades

- **Editor rico** (TipTap): títulos, negrito/itálico/sublinhado, cores, marca-texto, alinhamento, listas, checklists, tabelas, blocos de código com realce de sintaxe, caixas de destaque (Info, Dica, Atenção, Cuidado, Resultado), imagens (colar/arrastar), vídeos do YouTube e **modelos prontos** (Passo a passo, VPN, Instalação de sistema).
- **Visual automático**: listas numeradas viram cartões de passos, índice lateral gerado pelos títulos, botão "Copiar" nos comandos, zoom em imagens, tempo de leitura, modo escuro e impressão/PDF.
- **Anexos** privados (download por URL assinada) com pré‑visualização de PDF, imagem, vídeo e texto; Office via Microsoft Viewer (opcional).
- **Link curto** `…/t/AbC123` + WhatsApp, Teams, e‑mail e QR Code.
- **Visualizado por**: lista de quem abriu, quando, quantas vezes e se veio por link compartilhado.
- **Busca inteligente** (Ctrl K ou /): ignora acentos, tolera erros de digitação, completa palavras enquanto digita e procura em títulos, conteúdo, comandos, anexos, links, comentários, pedidos e pessoas, com trecho destacado. Buscas sem resultado viram sugestão de pedido.
- **Comunidade**: pedidos de tutorial com votos ("eu também preciso"), respostas, ranking com pontos e níveis, perfis públicos e feed de atividade.
- **Feedback**: "Funcionou para você?" 👍/👎 e comentários por tipo (comentário, passo desatualizado, dica, pergunta) com respostas e "resolvido". O autor é avisado na hora.
- **Favoritos e vistos recentemente**, seguir categorias e pessoas.
- **Notificações** no app (tempo real) e **push no celular** (Web Push via Edge Function `kb-push`; no iPhone requer o app instalado, iOS 16.4+).
- **Captura no celular**: foto pela câmera com marcação (setas, círculos, retângulos, caneta, texto) e vídeo curto (até 50 MB).
- **App instalável (PWA)**: popup automático no celular explicando como instalar.
- **Rascunho automático**: salva no aparelho e na nuvem enquanto você escreve; oferece recuperar ao reabrir.
- **Histórico de versões**: cada edição gera uma versão; compare o que mudou e restaure com um clique.
- **Revisão periódica**: cada tutorial define a cada quantos meses deve ser revisado; lembrete automático às 8h e selo "Revisão pendente".
- **Modo offline**: salve tutoriais (com imagens, vídeos e anexos) no aparelho para abrir sem internet.
- **Importar Word (.docx) e PDF**: vira tutorial formatado; imagens do Word são enviadas automaticamente.
- **Trilhas de aprendizado**: sequências de tutoriais com progresso individual e de quem está fazendo.
- **E-mail** (Resend): resumo diário ou imediato — configure em Administração → Integrações.
- **Login com Microsoft** (Azure AD): configure em Administração → Integrações.
- **Acesso multinível**:

| Nível | Pode |
|---|---|
| Administrador | Tudo + definir o nível de cada pessoa (dono: `haydenfernandes.ti@gmail.com`) |
| Field Administrador | Editar/excluir qualquer tutorial e gerenciar categorias |
| Field | Ler tudo, criar e editar/excluir os próprios tutoriais |
| Aguardando aprovação | Cadastro feito, sem acesso até um administrador aprovar |
| Bloqueado | Sem acesso |

A segurança é garantida no banco por **Row Level Security** — não depende do front-end.

## Arquitetura

- Front-end: React 19 + Vite + TypeScript + Tailwind CSS 4, hospedado no **GitHub Pages** (deploy automático em cada push na `main`).
- Back-end: **Supabase** (Auth, Postgres, Storage). Tabelas com prefixo `kb_` no projeto `inventarioquallit`.
  - Buckets: `kb-images` (imagens do conteúdo, público por URL aleatória) e `kb-attachments` (privado).
  - Migrações em [`supabase/migrations`](supabase/migrations).

## Desenvolvimento

```bash
npm install
npm run dev
```

Variáveis (opcionais — já há valores padrão em `src/lib/supabase.ts`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.

## Configuração no Supabase (uma vez)

Em **Authentication → URL Configuration → Redirect URLs**, adicione a URL do site publicado (ex.: `https://SEU_USUARIO.github.io/fields-quallit/**`) para que os links de confirmação de cadastro e recuperação de senha voltem para esta aplicação.

## Administradores principais

O e‑mail dono fica na tabela `kb_settings` (`owner_emails`). Quem se cadastra com esse e‑mail vira Administrador automaticamente e não pode ser rebaixado.
