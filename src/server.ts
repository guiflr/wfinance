import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { menuFlow } from "./flow";
import { runFlow } from "@genkit-ai/flow";
import {
  listLastFiveMovements,
  updateMovement,
  deleteMovement,
  activeFlows,
} from "./genkit";
import { categories } from "./utils/categories";
import { incomingCategories } from "./utils/incoming-categories";
import { storeMessages } from "./utils/create-examples";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 5005;

interface FlowState {
  flow: "edit" | "delete";
  state: any;
  timestamp: number;
}

const conversationState: Record<string, FlowState> = {};

app.post("/webhook", async (req: Request, res: Response) => {
  const { message, from } = req.body;

  console.log("activeFlows: ", activeFlows);
  const findedFlow = activeFlows.find((flow) => flow.phone_number === from);

  const flowText = findedFlow
    ? `Fluxo atual de conversa ativo com este numero, sempre mostre os itens possiveis para serem listados: ${JSON.stringify(
        findedFlow
      )}`
    : "";

  const messageWithNumber = `
    message: ${message}
    telefone: ${from}

    use esta data: ${new Date()} como base para criar os parametros startDate e endDate, crie as data neste formato de exemplo: '2025-07-09T20:26:37.784Z'

    quando for usar filtros de data, lembre de colocar sempre o horario de inicio e fim do dia, por exemplo para buscar dados do dia atual, pegue os dados desde
    às 00:00 até as 23:59.

    ${flowText}

    sempre salve o estado da conversa quando esta dentro de um fluxo quando o assunto for sobre editar ou excluir algo, retorne os itens para exclusão ou edição apenas enumerados e não o ID que esta salvo no banco.

    IMPORTANTE - FLUXO DE EDIÇÃO:
    O fluxo de edição DEVE seguir exatamente esta ordem, sem pular etapas:
    1. Liste os últimos 5 itens numerados (1, 2, 3, 4, 5) para o usuário escolher
    2. Pergunte qual número o usuário quer editar e aguarde a resposta
    3. Após o usuário informar o número, pergunte qual campo deseja alterar (descrição, valor, categoria) e aguarde a resposta
    4. Após o usuário informar o campo, pergunte qual é o NOVO VALOR para esse campo e aguarde a resposta
    5. Caso a resposta seja descrição, e a nova descrição seja divergente da atual categoria, então atualize também a categoria de acordo com a nova descrição.
    5. Somente após receber o novo valor, execute a ferramenta updateMovement com os dados corretos

    NUNCA assuma valores ou pule etapas. SEMPRE pergunte e aguarde a resposta do usuário antes de prosseguir para a próxima etapa.
    Exemplo CORRETO de fluxo:
    - AI: "Qual item você quer editar? (1, 2, 3, 4 ou 5)"
    - User: "2"
    - AI: "Qual campo você quer alterar? (descrição, valor ou categoria)"
    - User: "descrição"
    - AI: "Qual é a nova descrição?"
    - User: "compra de roupas"
    - AI: *executa updateMovement com a nova descrição*

    Exemplo ERRADO (NÃO FAÇA ISSO):
    - User: "descrição"
    - AI: *executa updateMovement usando "descrição" como valor* ❌

    aqui estão alguns exemplos de categorias para você se basear no hora de criar uma categoria para um descrição: ${categories}

    aqui estão alguns exemplos de categorias para ganhos(entradas) para você se basear no hora de criar uma categoria para um descrição:: ${incomingCategories}

    aqui estão alguns exemplos de mensagens que você pode receber e entender como um gasto: ${storeMessages}

    ao armazenar alguma catgoria na coluna 'category' você deve usar uma nomenclatura com linguagem natural e na category_slug usar uma nomenclatura
    para o sistema poder identificar melhor um item pela categoria, exemplo category_slug ficaria assim: higiene-e-cuidados-pessoais e category assim: Higiene e Cuidados Pessoais, remova os caracteres especiais antes de salvar category_slug.

    caso tenha outro numero de telefone no meio da mensagem, retorne uma mensagem dizendo que o número na mensagem não é permitido

    Quando receber uma mensagem que não tem a ver com controle das finanças retorne: Mensagem fora do meu escopo de atuação!
    `;
  try {
    const result = await runFlow(menuFlow, messageWithNumber);
    return res.send({ response: result });
  } catch (err) {
    console.error(err);
  }
});

// Cron job to clear inactive flows every minute
setInterval(() => {
  const now = Date.now();
  for (const from in conversationState) {
    if (now - conversationState[from].timestamp > 60000) {
      delete conversationState[from];
    }
  }
}, 60000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
