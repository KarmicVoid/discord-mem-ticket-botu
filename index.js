const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder, MessageFlags } = require('discord.js');
const http = require('http');

const port = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('Bot aktif!'); }).listen(port);

const YETKILI_ROLLER = ['1483795032547917972', '1483795032589992075', '1483795032719884332'];
const LOG_KANAL_ID = '1497733592069967882';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let ticketCount = 0;

client.on('messageCreate', async (message) => {
    if (message.content === '!panel') {
        const embed = new EmbedBuilder()
            .setTitle('MEM | Ticket Sistemi')
            .setDescription('Aşağıdaki menüyü kullanarak destek talebi açabilirsiniz.')
            .setColor('Blue');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('Kategori seç...')
                .addOptions([
                    { label: 'Oyun içi destek', value: 'Oyun içi destek' },
                    { label: 'Discord içi destek', value: 'Discord içi destek' },
                    { label: 'Yetkililerle iletişim', value: 'Yetkililerle iletişim' }
                ])
        );
        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        ticketCount++;
        const category = interaction.values[0];
        
        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketCount}`,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ...YETKILI_ROLLER.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle('MEM | Ticket Açıldı')
            .setDescription(`**Kullanıcı:** ${interaction.user.tag}\n**Kategori:** ${category}`)
            .setColor('Green');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger)
        );

        const yetkiliMention = YETKILI_ROLLER.map(id => `<@&${id}>`).join(' ');
        await channel.send({ content: `${interaction.user} ${yetkiliMention}`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `Biletiniz açıldı: ${channel}`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🚀 **Transcript hazırlanıyor ve kanal siliniyor...**' });

        try {
            const logChannel = await interaction.guild.channels.fetch(LOG_KANAL_ID);
            if (logChannel) {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcriptText = `--- TICKET TRANSCRIPT ---\nKanal: ${interaction.channel.name}\nSahibi: ${interaction.user.tag}\n\n`;
                
                const logData = Array.from(messages.values())
                    .reverse()
                    .map(m => `[${m.createdAt.toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content}`)
                    .join('\n');
                
                transcriptText += logData;

                const attachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), { name: `transcript-${interaction.channel.name}.txt` });

                await logChannel.send({
                    content: `📁 **${interaction.user.tag}** adlı kişinin ticket transcripti.`,
                    files: [attachment]
                });
            }
        } catch (e) {
            console.error(e);
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
