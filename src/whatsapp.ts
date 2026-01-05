const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
	authStrategy: new LocalAuth(),
	puppeteer: { headless: true, args: ["--no-sandbox"] },
	webVersionCache: {
		type: "remote",
		remotePath:
			"https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
	},
});

client.on("qr", (qr: any) => qrcode.generate(qr, { small: true }));

client.on("ready", () => {
	console.log("Client is ready!");
});

client.on("message", (msg: any) => {
	console.log("msg.from: ", msg.from);
	console.log("msg.body: ", msg.body);
	if (msg.body === "!ping") {
		client.sendMessage(msg.from, "pong");
	}
});

client.on("auth_failure", (msg: any) => {
	// Fired if session restore was unsuccessful
	console.error("AUTHENTICATION FAILURE", msg);
});

export { client };
