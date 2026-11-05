//path: /discord/bot.js

require('dotenv').config({ quiet: true })
const token = process.env.BOT_TOKEN
const bot_id = process.env.BOT_ID
const { Client, GatewayIntentBits, Collection, Routes, REST} = require('discord.js')
const { commands } = require('./commands')

const bot = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ]
})

bot.commands = new Collection()

for (const command of commands){
    bot.commands.set(command.data.name, command)
}

const rest = new REST({ version: '10'}).setToken(token)

async function start() {
    try {
        console.log('(bot) Registering commands...')
        await rest.put(
            Routes.applicationCommands(bot_id),
            {
                body: commands.map(command => command.data.toJSON())
            }
        )
        console.log('(bot) Commands registered')

        await bot.login(token)
    } catch (err) {
        console.log('(bot) Discord bot error: ' + err)
    }
}

bot.once('clientReady', () => {
    console.log('(bot) Bot is ready, ' + bot.user.tag)
})

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return

    const command = bot.commands.get(interaction.commandName)
    if (!command) return

    try {
        await command.execute(interaction)
    } catch (err) {
        console.log('(bot) Error executing command: ' + err)

        const reply = {
            content: 'An error occoured',
            flags: 64
        }

        if(interaction.replied || interaction.deferred) {
            await interaction.followUp(reply)
        } else {
            await interaction.reply(reply)
        }
    }
})

bot.sendto = async function(channel_id, message) {
    try {
        if (!bot.isReady()){
            await new Promise(resolve => bot.once('clientReady', resolve))
        }

        const channel = await bot.channels.fetch(channel_id)

        if (!channel || !channel.isTextBased() || !channel.send) {
            throw new Error('Channel permission denied')
        }

        await channel.send({
            content: String(message)
        })

        return true
    } catch (err) {
        console.log('(bot) Discord error: ' + err)
        return false
    }
}

start()
module.exports = { bot }