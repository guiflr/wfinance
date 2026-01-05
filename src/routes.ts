import { runFlow } from "@genkit-ai/flow";
import { type Request, type Response, Router } from "express";
import { menuFlow } from "./flow";
import { activeFlows } from "./genkit";
import { prompt } from "./prompt";

const routes = Router();

routes.post("/webhook", async (req: Request, res: Response) => {
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

export { routes };
