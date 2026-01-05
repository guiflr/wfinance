import { googleAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

const ai = genkit({
	plugins: [googleAI({ apiKey: "AIzaSyBontOPP--wHQH5w6sjutlR7B61LTa4oiU" })],
	model: googleAI.model("gemini-2.5-flash", { temperature: 0.5 }),
});

import { z } from "zod";
import { prisma } from "./prisma/client";

// Helper function to normalize slugs (remove accents and special characters)
const normalizeSlug = (text: string): string => {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Remove accents
		.replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
		.replace(/\s+/g, "-") // Replace spaces with hyphens
		.replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
		.trim();
};

export type Flow = {
	phone_number: string;
	active: boolean;
	messages: {
		from: "model" | "user";
		message: string;
		date: Date;
	}[];
};

// In-memory store for active flows
export const activeFlows: {
	phone_number: string;
	active: boolean;
	messages: Array<{ from: "model" | "user"; message: string; date: Date }>;
}[] = [];
console.log("activeFlows: ", activeFlows);
export const getLastFiveItemsToDeleteOrEdit = ai.defineTool(
	{
		name: "getLastFiveItemsToDeleteOrEdit",
		description:
			"When the user wants to delete or edit an item, list the last 5 movements so they can choose which one to change.",
		inputSchema: z.object({
			phone_number: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
			},
			take: 5,
			orderBy: {
				createdAt: "desc",
			},
		});
	},
);

export const findSomeActiveFlow = ai.defineTool(
	{
		name: "findSomeActiveFlow",
		description:
			"Find the current state of the deletion or editing flow between the AI and the user. This tool helps the AI to know the current context of the conversation.",
		inputSchema: z.object({
			phone_number: z.string(),
		}),
		outputSchema: z.object({
			phone_number: z.string(),
			active: z.boolean(),
			messages: z.array(
				z.object({
					from: z.enum(["model", "user"]),
					message: z.string(),
					date: z.string(),
				}),
			),
		}),
	},
	async (input: any) => {
		const findedFlow = activeFlows.find(
			(flow) => flow.phone_number === input.phone_number,
		);

		if (findedFlow) {
			return {
				phone_number: findedFlow.phone_number,
				active: findedFlow.active,
				messages: findedFlow.messages.map((m) => ({
					from: m.from,
					message: m.message,
					date: m.date.toISOString(),
				})),
			};
		} else {
			return {
				phone_number: input.phone_number,
				active: false,
				messages: [],
			};
		}
	},
);

export const pushNewStateOfFlow = ai.defineTool(
	{
		name: "pushNewStateOfFlow",
		description:
			"Adds the user's message and the AI's response to the current deletion or editing flow. This creates a history of the conversation so that the AI can understand the context of the interaction.",
		inputSchema: z.object({
			phone_number: z.string(),
			from: z.enum(["model", "user"]),
			active: z.boolean(),
			message: z.string(),
		}),
		outputSchema: z.object({
			phone_number: z.string(),
			active: z.boolean(),
			messages: z.array(
				z.object({
					from: z.enum(["model", "user"]),
					message: z.string(),
					date: z.string(),
				}),
			),
		}),
	},
	async (input: any) => {
		const flow = activeFlows.find((f) => f.phone_number === input.phone_number);
		if (flow) {
			flow.active = input.active;
			flow.messages.push({
				from: input.from,
				message: input.message,
				date: new Date(),
			});
			return {
				phone_number: flow.phone_number,
				active: flow.active,
				messages: flow.messages.map((m) => ({
					from: m.from,
					message: m.message,
					date: m.date.toISOString(),
				})),
			};
		} else {
			const newFlow = {
				phone_number: input.phone_number,
				active: input.active,
				messages: [
					{ from: input.from, message: input.message, date: new Date() },
				],
			};
			activeFlows.push(newFlow);
			return {
				...newFlow,
				messages: newFlow.messages.map((m) => ({
					from: m.from,
					message: m.message,
					date: m.date.toISOString(),
				})),
			};
		}
	},
);

export const deleteFlow = ai.defineTool(
	{
		name: "deleteFlow",
		description:
			"Deletes an active flow when the user no longer wants to delete or edit an item. This is useful for resetting the conversation and starting a new flow. Use it when some flow ended",
		inputSchema: z.object({
			phone_number: z.string(),
		}),
		outputSchema: z.string(),
	},
	async (input: any) => {
		const index = activeFlows.findIndex(
			(f) => f.phone_number === input.phone_number,
		);
		if (index !== -1) {
			activeFlows.splice(index, 1);
		}

		return "deleted";
	},
);

export const insertMovement = ai.defineTool(
	{
		name: "insertMovement",
		description: "Insert a new movement, it can be an expense or an entry.",
		inputSchema: z.object({
			description: z.string(),
			amount: z.number(),
			category: z.string(),
			category_slug: z.string(),
			type: z.enum(["expense", "entry"]),
			phone_number: z.string(),
		}),
		outputSchema: z.object({
			id: z.string(),
			description: z.string(),
			amount: z.number(),
			category: z.string(),
			category_slug: z.string(),
			type: z.string(),
			phone_number: z.string(),
		}),
	},
	async (input: any) => {
		const category = input.category || "general";
		const categorySlug = input.category_slug || category;

		return await prisma.movement.create({
			data: {
				description: input.description,
				amount: input.amount,
				category: category,
				category_slug: normalizeSlug(categorySlug),
				type: input.type,
				phone_number: input.phone_number,
			},
		});
	},
);

export const listLastFiveMovements = ai.defineTool(
	{
		name: "listLastFiveMovements",
		description: "List the last 5 movements for a given phone number",
		inputSchema: z.object({
			phone_number: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
			},
			take: 5,
			orderBy: {
				createdAt: "desc",
			},
		});
	},
);

export const getMovementsBetweenDates = ai.defineTool(
	{
		name: "getMovementsBetweenDates",
		description: "Get movements between two dates for a given phone number",
		inputSchema: z.object({
			phone_number: z.string(),
			startDate: z.string(),
			endDate: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
				createdAt: {
					gte: new Date(input.startDate),
					lte: new Date(input.endDate),
				},
			},
		});
	},
);

export const getMovementsBySlug = ai.defineTool(
	{
		name: "getMovementsBySlug",
		description:
			"Get movements by category slug or category name for a given phone number. You can search by exact slug (e.g., 'alimentacao') or by category name (e.g., 'Alimentação', 'alimentação'). This function will search in both category and category_slug fields.",
		inputSchema: z.object({
			phone_number: z.string(),
			slug: z
				.string()
				.describe(
					"Category slug or category name to search for. Can be partial match.",
				),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		// Try multiple search strategies to handle accents and different formats
		const searchTermLower = input.slug.toLowerCase();
		const searchWithDashes = searchTermLower.replace(/\s+/g, "-");
		const normalizedSlug = input.slug
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/\s+/g, "-");

		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
				OR: [
					// Search with original term (lowercase)
					{
						category_slug: {
							contains: searchTermLower,
						},
					},
					// Search with dashes instead of spaces
					{
						category_slug: {
							contains: searchWithDashes,
						},
					},
					// Search with normalized (no accents)
					{
						category_slug: {
							contains: normalizedSlug,
						},
					},
				],
			},
		});
	},
);

export const getMovementsBySemanticSearch = ai.defineTool(
	{
		name: "getMovementsBySemanticSearch",
		description: `Search for movements using semantic understanding and intelligent category mapping.

    Use this tool when the user searches for items by category, even if they use different words than what's stored in the database.

    You should analyze the user's search term and identify ALL semantically related categories that might match.
    Think broadly about relationships - for example:
    - "medicamento" relates to "remedio", "farmacia", "saude"
    - "bebida" relates to "bebidas", "drinks", "refrigerante", "suco"
    - "comida" relates to "alimentacao", "supermercado", "mercado"
    - "roupa" relates to "vestuario", "roupas", "moda"
    - "transporte" relates to "combustivel", "uber", "taxi", "onibus"

    The available category examples from the system are in the main prompt. Use your understanding to map user terms to those categories.`,
		inputSchema: z.object({
			phone_number: z.string(),
			searchTerm: z
				.string()
				.describe("The semantic search term provided by the user"),
			relatedSlugs: z
				.array(z.string())
				.describe(
					"Array of category slugs that you believe are semantically related to the user's search term. Include ALL variations and related terms you can think of. Be creative and inclusive - it's better to include more related terms than to miss relevant data.",
				),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		// Build OR conditions for all related slugs
		const slugConditions = input.relatedSlugs.flatMap((slug: string) => {
			const normalized = normalizeSlug(slug);
			return [
				{ category_slug: { contains: normalized } },
				{ category_slug: { contains: slug.toLowerCase() } },
				{ category: { contains: slug } },
			];
		});

		// Also search in descriptions for the original search term
		const normalizedSearchTerm = normalizeSlug(input.searchTerm);

		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
				OR: [
					...slugConditions,
					{ description: { contains: input.searchTerm } },
					{ description: { contains: normalizedSearchTerm } },
				],
			},
		});
	},
);

export const getMovementsByDescription = ai.defineTool(
	{
		name: "getMovementsByDescription",
		description: "Get movements by description for a given phone number",
		inputSchema: z.object({
			phone_number: z.string(),
			description: z.string(),
		}),
		outputSchema: z.array(
			z.object({
				id: z.string(),
				description: z.string(),
				amount: z.number(),
				category: z.string(),
				type: z.string(),
			}),
		),
	},
	async (input: any) => {
		return await prisma.movement.findMany({
			where: {
				phone_number: input.phone_number,
				description: {
					contains: input.description,
				},
			},
		});
	},
);

export const updateMovement = ai.defineTool(
	{
		name: "updateMovement",
		description: "Update a movement by its ID",
		inputSchema: z.object({
			id: z.string(),
			description: z.string().optional(),
			amount: z.number().optional(),
			category: z.string().optional(),
		}),
		outputSchema: z.object({
			id: z.string(),
			description: z.string(),
			amount: z.number(),
			category: z.string(),
			type: z.string(),
		}),
	},
	async (input: any) => {
		const updateData: any = {
			description: input.description,
			amount: input.amount,
			category: input.category,
		};

		if (input.category) {
			updateData.category_slug = normalizeSlug(input.category);
		}

		return await prisma.movement.update({
			where: {
				id: input.id,
			},
			data: updateData,
		});
	},
);

export const deleteMovement = ai.defineTool(
	{
		name: "deleteMovement",
		description: "Delete a movement by its ID",
		inputSchema: z.object({
			id: z.string(),
		}),
		outputSchema: z.object({
			success: z.boolean(),
			message: z.string(),
		}),
	},
	async (input: any) => {
		await prisma.movement.delete({
			where: {
				id: input.id,
			},
		});
		return {
			success: true,
			message: "Movement deleted successfully",
		};
	},
);

export const getMovementsGroupedByCategory = ai.defineTool(
	{
		name: "getMovementsGroupedByCategory",
		description:
			"Get movements grouped by category with total amount per category. Optionally filter by date range and/or type (expense/entry)",
		inputSchema: z.object({
			phone_number: z.string(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
			type: z.enum(["expense", "entry"]).optional(),
		}),
		outputSchema: z.array(
			z.object({
				category: z.string(),
				category_slug: z.string(),
				total: z.number(),
				count: z.number(),
				type: z.string(),
			}),
		),
	},
	async (input: any): Promise<Array<{ category: string; category_slug: string; total: number; count: number; type: string }>> => {
		const whereClause: any = {
			phone_number: input.phone_number,
		};

		if (input.startDate && input.endDate) {
			whereClause.createdAt = {
				gte: new Date(input.startDate),
				lte: new Date(input.endDate),
			};
		}

		if (input.type) {
			whereClause.type = input.type;
		}

		const movements = await prisma.movement.findMany({
			where: whereClause,
		});

		const grouped = movements.reduce((acc: any, movement: any) => {
			const key = `${movement.category_slug}_${movement.type}`;
			if (!acc[key]) {
				acc[key] = {
					category: movement.category,
					category_slug: movement.category_slug,
					total: 0,
					count: 0,
					type: movement.type,
				};
			}
			acc[key].total += movement.amount;
			acc[key].count += 1;
			return acc;
		}, {});

		return Object.values(grouped) as Array<{ category: string; category_slug: string; total: number; count: number; type: string }>;
	},
);

export { ai };
