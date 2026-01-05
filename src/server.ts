import bodyParser from "body-parser";
import express from "express";
import { routes } from "./routes";
import { client } from "./whatsapp";

const PORT = process.env.PORT || 5005;

interface FlowState {
	flow: "edit" | "delete";
	state: any;
	timestamp: number;
}

const conversationState: Record<string, FlowState> = {};

const app = express();
app.use(bodyParser.json());
app.use(routes);

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
	// client.initialize();
	console.log(`Server is running on port ${PORT}`);
});
