import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", { temperature: 0.5 }),
});

import { prisma } from "./prisma/client";
import { boolean, z } from "zod";

// In-memory store for active flows
export const activeFlows: {
  phone_number: string;
  active: boolean;
  messages: Array<{ from: "model" | "user", message: string; date: Date }>;
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
      })
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
  }
);

export const findSomeActiveFlow = ai.defineTool(
  {
    name: "findSomeActiveFlow",
    description:
      "Find the current state of the deletion or editing flow between the AI and the user. This tool helps the AI to know the current context of the conversation.",
    inputSchema: z.object({
      phone_number: z.string(),
    }),
    outputSchema: z
      .object({
        phone_number: z.string(),
        active: z.boolean(),
        messages: z.array(
          z.object({
            from: z.enum(["model", "user"]),
            message: z.string(),
            date: z.date(),
          })
        ),
      })
      .optional(),
  },
  async (input: any) => {
    const findedFlow = activeFlows.find(
      (flow) => flow.phone_number === input.phone_number
    );
    const flow = findedFlow
      ? findedFlow
      : { phone_number: input.phone_number, active: input.active,  messages: [] };
    return flow;
  }
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
    outputSchema: z.any(),
  },
  async (input: any) => {
    const flow = activeFlows.find((f) => f.phone_number === input.phone_number);
    if (flow) {
      flow.messages.push({
        from: input.from,        
        message: input.message,
        date: new Date(),
      });
      return {...flow, active: input.active}
    } else {
      activeFlows.push({
        phone_number: input.phone_number,
        active: input.active,
        messages: [
          { from: input.from, message: input.message, date: new Date() },
        ],
      });
      const flow = activeFlows.find((f) => f.phone_number === input.phone_number);
      return flow
    }
  }
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
      (f) => f.phone_number === input.phone_number
    );
    if (index !== -1) {
      activeFlows.splice(index, 1);
    }

    return 'deleted'
  }
);

export const insertMovement = ai.defineTool(
  {
    name: "insertMovement",
    description:
      "Insert a new movement, it can be an expense or an entry.",
    inputSchema: z.object({
      description: z.string(),
      amount: z.number(),
      category: z.string(),
      category_slug: z.string(),
      type: z.enum(["expense", "entry"]),
      phone_number: z.string(),
    }),
  },
  async (input: any) => {
    return await prisma.movement.create({
      data: {
        description: input.description,
        amount: input.amount,
        category: input.category || "general",
        category_slug: (input.category || "general")
          .toLowerCase()
          .replace(/ /g, "-"),
        type: input.type,
        phone_number: input.phone_number,
      },
    });
  }
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
      })
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
  }
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
      })
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
  }
);

export const getMovementsBySlug = ai.defineTool(
  {
    name: "getMovementsBySlug",
    description: "Get movements by category slug for a given phone number",
    inputSchema: z.object({
      phone_number: z.string(),
      slug: z.string(),
    }),
    outputSchema: z.array(
      z.object({
        id: z.string(),
        description: z.string(),
        amount: z.number(),
        category: z.string(),
        type: z.string(),
      })
    ),
  },
  async (input: any) => {
    return await prisma.movement.findMany({
      where: {
        phone_number: input.phone_number,
        category_slug: input.slug,
      },
    });
  }
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
      })
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
  }
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
    return await prisma.movement.update({
      where: {
        id: input.id,
      },
      data: {
        description: input.description,
        amount: input.amount,
        category: input.category,
        category_slug: input.category
          ? input.category.toLowerCase().replace(/ /g, "-")
          : undefined,
      },
    });
  }
);

export const deleteMovement = ai.defineTool(
  {
    name: "deleteMovement",
    description: "Delete a movement by its ID",
    inputSchema: z.object({
      id: z.string(),
    }),
    outputSchema: z.void(),
  },
  async (input: any) => {
    await prisma.movement.delete({
      where: {
        id: input.id,
      },
    });
  }
);

export const getMovementsGroupedByCategory = ai.defineTool(
  {
    name: "getMovementsGroupedByCategory",
    description: "Get movements grouped by category with total amount per category. Optionally filter by date range and/or type (expense/entry)",
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
      })
    ),
  },
  async (input: any) => {
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

    const grouped = movements.reduce((acc: any, movement) => {
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

    return Object.values(grouped);
  }
);

export { ai };
