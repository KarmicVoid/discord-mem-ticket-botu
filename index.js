const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const http = require('http');

const port = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('Bot aktif!'); }).listen(port);

const YETKILI_ROLLER = ['1483795032547917972', '1483795032589992075', '1483795032719884332'];
const LOG_KANAL_ID = '1497733592069967882'; // Transcriptlerin düşeceği kanal

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let ticketCount = 0;

client.on('messageCreate', (message) => {
    if (message.content === '!panel') {
        const embed = new EmbedBuilder()
            .setTitle('MEM | Ticket Sistemi')
            .setDescription('MEM Ticket sistemine hoş geldiniz, aşağıdaki kategori seç menüsünü kullanarak yaşadığınız sorunun kategorisine basıp bilet oluşturabilirsiniz.')
            .setColor('Blue');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('Kategori seç...')
                .addOptions([
                    { label: 'Oyun içi destek', value: 'Oyun içi destek', description: 'MEM Roblox oyununda yaşanan sorunlar ve olaylar için bu talep.' },
                    { label: 'Discord içi destek', value: 'Discord içi destek', description: 'MEM Discord sunucusunda yaşanan sorunlar ve olaylar için bu talep.' },
                    { label: 'Yetkililerle iletişim', value: 'Yetkililerle iletişim', description: 'Yetkililer ile konuşmak veya bir konuda destek almak için bu talep.' }
                ])
        );
        message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        ticketCount++;
        const category = interaction.values[0];
        
        let permissionList = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        
        YETKILI_ROLLER.forEach(roleId => {
            permissionList.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
        });

        const channel = await interaction.guild.channels.create({
            name: `ticket-${ticketCount}`,
            permissionOverwrites: permissionList
        });

        const embed = new EmbedBuilder()
            .setTitle('MEM | Ticket Botu')
            .setDescription(`Biletinizi oluşturdunuz, lütfen sorununuzu yazınız, yetkililer en kısa sürede ilgilenecektir.\n\n**Kullanıcı:** ${interaction.user.tag} (${interaction.user.id})\n**Kategori:** ${category}\n**Toplam Bilet:** ${ticketCount}`)
            .setColor('Green');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Kapat').setStyle(ButtonStyle.Danger)
        );

        const yetkiliMention = YETKILI_ROLLER.map(id => `<@&${id}>`).join(' ');
        
        await channel.send({ content: `${interaction.user} ${yetkiliMention}`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `Biletiniz açıldı: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🚀 **Bilet arşive alınıyor ve 5 saniye içinde kapatılıyor...**');

        // Transcript Oluşturma İşlemi
        const logChannel = interaction.guild.channels.cache.get(LOG_KANAL_ID);
        if (logChannel) {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcript = `TICKET TRANSCRIPT\nSunucu: ${interaction.guild.name}\nKanal: ${interaction.channel.name}\nKapatan: ${interaction.user.tag}\n--------------------------------------\n\n`;

            // Mesajları tarihe göre sıralayıp metne döküyoruz
            const logContent = messages.reverse().map(m => `[${m.createdAt.toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content}`).join('\n');
            transcript += logContent;

            const buffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

            // Logs kanalına gönderilecek mesaj
            await logChannel.send({
                content: `📁 **${interaction.user.tag}** Adlı kişinin ticket transcripti.`,
                files: [attachment]
            });
        }

        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
