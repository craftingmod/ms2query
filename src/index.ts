import { TOKEN, PREFIX, OWNERID } from './config.js'
import { BotInit } from './discord/botinit.js'
import { commands } from './discord/commands/index.js'

const bot = new BotInit({
	token: TOKEN,
	prefix: PREFIX,
	ownerid: OWNERID,
})
bot.addCommands(...commands)

await bot.connect()