const tmi = require("tmi.js");
const settings = require("./settings").chatbot;
const log = require("./logger");
const parseCommand = require("./parseCommand");

module.exports = (io, plugins) => {
	if (!settings) {
		log.warning("No settings.chatbot found. Chatbot will not connect.");
		return;
	}
	
	let labels, clients = {};
	if (settings.credentials.username && settings.credentials.password) {
		
		labels = ["default"];
		clients["default"] = new tmi.client({
			identity: {
				username: settings.credentials.username,
				password: settings.credentials.password
			},
			channels: [
				settings.channel
			],
			connection: {
				reconnect: true
			}
		});
		
	} else {
		
		labels = Object.keys(settings.credentials);
		labels.forEach(label => {
			const credential = settings.credentials[label];
			clients[label] = new tmi.client({
				identity: {
					username: credential.username,
					password: credential.password
				},
				channels: [
					settings.channel
				],
				connection: {
					reconnect: true
				}
			});
		});
		
	};
	
	// Define chat function template to use in commands and plugins
	let getChatFunction = target => {
		return (label, message) => {
			// Respond with the specified client
			if (labels.length > 1) {
				clients[label].say(target, message);
			} else {
				clients["default"].say(target, message);
			}
		};
	};
	
	let firstClient = clients[labels[0]];
	
	// Only the first client loads command modules
	firstClient.on("message", (target, user, msg) => {
		
		// Add admin property to user to indicate admin status (mod or channel owner)
		user.admin = user.mod || user["user-id"] == user["room-id"];
		
		plugins.event(`chatbot.message`, {
			user: user, 
			message: msg,
			chat: getChatFunction(target),
			io: io
		});
		
		// Ignore commands from users with no ID (automated messages)
		if (!user["user-id"]) return;
		
		if (msg.startsWith(settings.commandPrefix)) {
			
			const {command, parameters} = parseCommand(msg);
			log.debug(`Command "${command}" received.`);
			log.debug(`Command parameters: ${parameters}`);
			
			let commandName = command.substring(settings.commandPrefix.length).toLowerCase();
			let message = msg.includes(" ")? 
				msg.substring(msg.indexOf(" ") + 1): 
				"";
				
			plugins.event(`chatbot.command.{${commandName}}`, {
				user: user, 
				command: commandName,
				parameters: parameters, 
				message: message,
				chat: getChatFunction(target),
				io: io
			});
			
		}
		
	});
	
	// Connect all clients
	let clientsConnected = 0;
	labels.forEach(label => {
		
		clients[label].on("join", (target, username, self) => {
			if (self) {
				log.info(`${label} connected to chat on channel ${settings.channel}.`);
				
				// Load the chatbotInit plugin only after all clients have connected
				if (++clientsConnected == labels.length) {
					plugins.event("chatbot.connect", {
						chat: getChatFunction(target)
					});
				}
			}
		});
		
		clients[label].connect();
	});
	
};
