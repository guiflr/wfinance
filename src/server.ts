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

    sempre salve o estado da conversa ou quando esta dentro de um fluxo quando o assunto for sobre editar ou excluir algo.

    caso tenha outro numero de telefone no meio da mensagem, retorne uma mensagem dizendo que o número na mensagem não é permitido
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
