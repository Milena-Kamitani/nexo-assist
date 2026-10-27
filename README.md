# Nexo Assist

Um service desk demonstrativo em português: a pessoa descreve o que precisa no chat e o Nexo Assist consulta a central de ajuda, acompanha ou complementa chamados e encaminha conversas para o time humano. O sistema usa dados fictícios e persiste o estado localmente.

## Rodar localmente

Requisitos: Node.js 22.12 ou superior e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). O Vite serve a interface e encaminha `/api` para o servidor Express em `http://localhost:3001`. A senha é de demonstração: qualquer senha não vazia funciona para uma das contas cadastradas.

| Acesso | E-mail | Demonstração |
|---|---|---|
| Funcionária | `ana.souza@nexo.com` | Tem chamados em situações variadas, incluindo um com prazo vencido. |
| Funcionário | `caio.mendes@nexo.com` | Possui uma conversa crítica na fila do service desk. |
| Analista | `marina.analista@nexo.com` | Acesse o console para assumir, responder, devolver ou encerrar a conversa. |

O primeiro início cria `data/runtime.json` com funcionários, artigos, chamados e uma conversa de exemplo. Alterações ficam nesse arquivo e sobrevivem a reinicializações; ele é ignorado pelo Git para que o estado de execução não se misture aos dados de exemplo do código.

Para executar a versão compilada:

```bash
npm run build
NODE_ENV=production SESSION_SECRET="$(openssl rand -base64 32)" npm start
```

O servidor Express também entrega os arquivos compilados de `dist`. Em produção, configure um `SESSION_SECRET` próprio e forte; a aplicação não inicia sem ele. O segredo de desenvolvimento em `.env.example` não deve ser usado em produção.

## Arquitetura

- `src/`: interface React responsiva, com tela de acesso, chat do funcionário, chamados e console do analista.
- `server/agent.ts`: fluxo de decisão em LangGraph.js, separado dos serviços do sistema de chamados.
- `server/store.ts`: catálogo, persistência JSON e operações de consulta, criação e atualização.
- `server/index.ts`: API Express, autenticação demonstrativa por sessão assinada, autorização por papel e limites de entrada.

### Como o agent decide

O agent usa um workflow LangGraph com classificação determinística em TypeScript e caminhos separados para central de ajuda, consulta, abertura, atualização, confirmação, cancelamento, transferência e pedido de esclarecimento. Não depende de uma chave externa nem envia mensagens ou chamados a um provedor de modelo; esse trade-off mantém o comportamento reproduzível, rápido e sem custo por mensagem nesta demonstração. O ponto de entrada está isolado em `runAgent`, permitindo trocar ou complementar a classificação com um modelo sem misturar a interface ou o serviço de chamados.

Cada resposta do agent informa o que foi entendido, a ação, a confiança, o motivo, as etapas do workflow e, quando aplicável, as fontes consultadas. Regras importantes:

- Uma dúvida de TI com artigo correspondente usa a central de ajuda; assuntos fora de TI são redirecionados à área responsável.
- Um rascunho só é gravado após uma confirmação explícita. Cancelar descarta o rascunho sem alteração.
- O tipo é classificado como incidente (`INC`) ou requisição (`REQ`); categoria, prioridade e prazo são exibidos antes da confirmação.
- Incidentes com impacto em equipe e situações críticas são priorizados e transferidos ao service desk após confirmação. Chamados vencidos e problemas de TI sem uma decisão segura também são encaminhados a uma pessoa.
- Chamados abertos semelhantes são complementados em vez de duplicados. Complementos recalculam o prazo; chamados resolvidos nos últimos sete dias podem ser reabertos.
- Os dados de funcionários são filtrados no servidor. Uma sessão de funcionário só acessa os próprios chamados e conversas; o console exige papel de analista. Ao assumir uma conversa, o agent fica pausado.
- O chat e o console atualizam conversas em atendimento por polling curto, sem reativar o agent enquanto um analista está responsável.
- Cada conversa aceita até 30 mensagens do funcionário; mensagens têm limite de 2.000 caracteres.

### Dados de exemplo

O conjunto inicial oferece artigos de VPN, acesso, Wi-Fi, e-mail, software, impressoras, horários e equipamentos, além de chamados abertos, vencidos, resolvidos e pertencentes a outras pessoas. As contas de demonstração e a senha simplificada são exclusivas deste exercício; não representam autenticação de produção.

## Testes e qualidade

```bash
npm test
npm run build
```

Os testes do workflow cobrem respostas da base de conhecimento, privacidade na consulta, detecção de vencimento, prioridade, deduplicação, confirmação/cancelamento, transferência e pedido de esclarecimento.

## Trade-offs e próximos passos

- O armazenamento JSON simplifica o uso local, mas não é adequado a múltiplos processos simultâneos; em produção, usaria um banco transacional e controle de concorrência.
- A sessão demonstrativa aceita qualquer senha para uma lista fixa de usuários; uma entrega real integraria SSO corporativo, proteção contra CSRF, limitação de tentativas e auditoria.
- As regras determinísticas tornam as decisões explicáveis e testáveis, mas têm cobertura linguística limitada. Com mais tempo, avaliaria um classificador com saída estruturada, limiar de confiança e fallback humano, preservando as confirmações e verificações de autorização.
- Os SLAs de exemplo usam horas corridas para deixar prazos reproduzíveis no protótipo; o calendário real deve considerar expediente, feriados e plantão.
