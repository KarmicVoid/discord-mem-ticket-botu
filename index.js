const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı ve bot şu an aktif!`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!panel') {
        message.channel.send('Bilet paneli başarıyla oluşturuldu!');
    }
});

client.login(process.env.DISCORD_TOKEN);

