const { SlashCommandBuilder } = require('discord.js')

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Sends back `pong` back to whoever sent it'),
            
        async execute(interaction){
            await interaction.reply({
                content: 'Pong!',
                flags: 64
            })
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('status')
            .setDescription('Tells if the server is on or not'),
        async execute(interaction){
            await interaction.deferReply({
                flags: 64
            })

            const start = Date.now()

            try {
                const response = await fetch('https://ir.pikid71.me/dev/ping')

                const latency = Date.now() - start

                if(!response.ok){
                    interaction.editReply({
                        content: '# Infrared Status \nWebsite: offline \nAPI: offline \n-# >Invalid response from server',
                        flags: 64
                    })
                    return
                }

                const result = await response.text()

                if (result !== 'pong') {
                    interaction.editReply({
                        content: '# Infrared Status \nWebsite: offline \nAPI: offline',
                        flags: 64
                    })
                    return
                }

                interaction.editReply({
                    content: `# Infrared Status \nWebsite: online \nAPI: online \nLatency: ${latency}ms`
                })
            } catch (err) {
                console.log('failed /status')

                interaction.editReply({
                    content: 'Failed to fetch'
                })
            }
        }
    }
]





module.exports = { commands }