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

            try {
                let start = Date.now()
                const responseir = await fetch('https://ir.pikid71.me/dev/ping')
                const latencyir = Date.now() - start

                start = Date.now()
                const responsebeta = await fetch('https://super-pancake-wr4rx65497ggf59q5-8000.app.github.dev/dev/ping')
                const latencybeta = Date.now() - start

                await interaction.editReply({
                    content: `Website: ${ responseir.ok ? 'Active' : 'Inactive' } (${latencyir}ms)\nBeta: ${ responsebeta.ok ? 'Active' : 'Inactive' } (${latencybeta}ms)`
                })
            } catch (err) {
                await interaction.editReply({
                    content: 'Failed to fetch'
                })
            }
        }
    }
]

module.exports = { commands }