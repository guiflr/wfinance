import { runFlow } from "@genkit-ai/flow";
import bodyParser from "body-parser";
import express, { type Request, type Response } from "express";
import { menuFlow } from "./flow";
import { activeFlows } from "./genkit";
import { prompt } from "./prompt";

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
				findedFlow,
			)}`
		: "";

	const messageWithNumber = prompt({ flowText, from, message });

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
