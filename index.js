const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let sunucuVerisi = {};
if (fs.existsSync('./ayarlar.json')) sunucuVerisi = JSON.parse(fs.readFileSync('./ayarlar.json', 'utf8'));
function veriKaydet() { fs.writeFileSync('./ayarlar.json', JSON.stringify(sunucuVerisi, null, 2)); }

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yetkin yok!');
        const filter = m => m.author.id === message.author.id;
        
        try {
            await message.channel.send('1️⃣ **Panel hangi kanala kurulsun?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();

            await message.channel.send('2️⃣ **Yetkili rolleri hangileri?** (@etiketle)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const roller = c2.first().mentions.roles.map(r => r.id);

            await message.channel.send('3️⃣ **Log kanalı neresi?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();

            sunucuVerisi[message.guild.id] = { panelID: kanal.id, roller: roller, logID: logKanal.id, ticketCount: 0 };
            veriKaydet();

            const embed = new EmbedBuilder()
                .setTitle('MEM | Ticket Sistemi')
                .setDescription('Sorun yaşadığınız kategoriyi seçerek bilet açabilirsiniz.')
                .setColor('Red');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seç...').addOptions([
                    { label: 'Şikayet', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri', value: 'Öneri', emoji: '💡' },
                    { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' }
                ])
            );

            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Kurulum bitti!');
        } catch (e) { message.reply('⚠️ Süre doldu.'); }
    }
});

// --- İŞTE EKSİK OLAN KISIM BURASI (ETKİLEŞİMLER) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = sunucuVerisi[interaction.guild.id];
        if (!ayar) return interaction.reply({ content: 'Kurulum yapılmamış!', ephemeral: true });

        ayar.ticketCount++;
        veriKaydet();

        const kanal = await interaction.guild.channels.create({
            name: `ticket-${ayar.ticketCount}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                ...ayar.roller.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`Bilet Açıldı: ${interaction.values[0]}`)
            .setDescription(`Merhaba ${interaction.user}, yetkililer yakında ilgilenecektir.`)
            .setColor('Green');

        const buton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_kapat').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger)
        );

        await kanal.send({ content: `${interaction.user} | <@&${ayar.roller[0]}>`, embeds: [embed], components: [buton] });
        await interaction.reply({ content: `Biletiniz açıldı: ${kanal}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'ticket_kapat') {
        await interaction.reply('🚀 Bilet 3 saniye içinde kapatılıyor...');
        setTimeout(() => interaction.channel.delete(), 3000);
    }
});

client.login(process.env.TOKEN);
