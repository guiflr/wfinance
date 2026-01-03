import { defineFlow, run } from "@genkit-ai/flow";
import * as z from "zod";
import {
	ai,
	deleteFlow,
	deleteMovement,
	findSomeActiveFlow,
	getLastFiveItemsToDeleteOrEdit,
	getMovementsBetweenDates,
	getMovementsByDescription,
	getMovementsBySemanticSearch,
	getMovementsBySlug,
	getMovementsGroupedByCategory,
	insertMovement,
	listLastFiveMovements,
	pushNewStateOfFlow,
	updateMovement,
} from "./genkit";

export const menuFlow = defineFlow(
	{
		name: "menuFlow",
		inputSchema: z.string(),
		outputSchema: z.string(),
	},
	async (prompt) => {
		const llmResponse = await run("run-llm", async () =>
			ai.generate({
				prompt: prompt,
				tools: [
					insertMovement,
					listLastFiveMovements,
					getMovementsBetweenDates,
					getMovementsBySlug,
					getMovementsBySemanticSearch,
					getMovementsByDescription,
					updateMovement,
					deleteMovement,
					getLastFiveItemsToDeleteOrEdit,
					findSomeActiveFlow,
					pushNewStateOfFlow,
					deleteFlow,
					getMovementsGroupedByCategory,
				],
			}),
		);

		return llmResponse.message!.content[0].text || "";
	},
);
