const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let sunucuVerisi = {};
if (fs.existsSync('./ayarlar.json')) {
    try { sunucuVerisi = JSON.parse(fs.readFileSync('./ayarlar.json', 'utf8')); } catch (e) { sunucuVerisi = {}; }
}
function veriKaydet() { fs.writeFileSync('./ayarlar.json', JSON.stringify(sunucuVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Aktif!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const filter = m => m.author.id === message.author.id;
        try {
            await message.channel.send('1️⃣ **Panel kanalı?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();

            await message.channel.send('2️⃣ **Yetkili rolleri?** (@etiketle)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const roller = c2.first().mentions.roles.map(r => r.id);

            await message.channel.send('3️⃣ **Log kanalı?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();

            sunucuVerisi[message.guild.id] = { panelID: kanal.id, roller: roller, logID: logKanal.id, ticketCount: 0 };
            veriKaydet();

            const embed = new EmbedBuilder()
                .setTitle('MEM | Destek Sistemi')
                .setDescription('Sorun yaşadığınız kategoriyi seçerek bilet açabilirsiniz.\n\n⚠️ **Gereksiz ticket açmayın!**')
                .setColor('#FF0000')
                .setFooter({ text: 'MEM Ticket Sistemi' });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seçiniz...').addOptions([
                    { label: 'Şikayet / Geri Bildirim', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri / İstek', value: 'Öneri', emoji: '💡' },
                    { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' },
                    { label: 'Yetkililerle İletişim', value: 'Yetkililerle İletişim', emoji: '👑' }
                ])
            );

            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Kurulum tamamlandı!');
        } catch (e) { message.reply('⚠️ Hata oluştu.'); }
    }
});

client.on('interactionCreate', async (interaction) => {
    // --- BİLET AÇMA ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = sunucuVerisi[interaction.guild.id];
        if (!ayar) return;
        await interaction.deferReply({ ephemeral: true });
        ayar.ticketCount = (ayar.ticketCount || 0) + 1;
        veriKaydet();

        const kanalIsmi = `ticket-${ayar.ticketCount}-${interaction.user.username}`;
        const kanal = await interaction.guild.channels.create({
            name: kanalIsmi,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                ...ayar.roller.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`Bilet Açıldı | ${interaction.values[0]}`)
            .setDescription(`Hoş geldin ${interaction.user}, yetkililer yakında burada olacaktır.`)
            .setColor('Red');

        const buton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_kapat_onay').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await kanal.send({ content: `${interaction.user} | <@&${ayar.roller[0]}>`, embeds: [embed], components: [buton] });
        await interaction.editReply({ content: `Biletiniz açıldı: ${kanal}` });
    }

    // --- KAPATMA ONAYI ---
    if (interaction.isButton() && interaction.customId === 'ticket_kapat_onay') {
        const onayEmbed = new EmbedBuilder()
            .setTitle('Bilet Kapatma Onayı')
            .setDescription('Bileti kapatmaktan emin misiniz?')
            .setColor('Yellow');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_kapat_kesin').setLabel('Kapat ❌').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_vazgec').setLabel('Vazgeç ✅').setStyle(ButtonStyle.Success)
        );
        await interaction.reply({ embeds: [onayEmbed], components: [row] });
    }

    // --- KESİN KAPATMA VE TRANSCRIPT ---
    if (interaction.isButton() && interaction.customId === 'ticket_kapat_kesin') {
        await interaction.reply('🚀 Transcript alınıyor ve bilet siliniyor...');
        
        const ayar = sunucuVerisi[interaction.guild.id];
        if (ayar && ayar.logID) {
            const logKanal = interaction.guild.channels.cache.get(ayar.logID);
            if (logKanal) {
                // Mesajları çekme ve Transcript oluşturma
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                let transcriptContent = `Bilet Transcript: ${interaction.channel.name}\nKapatan: ${interaction.user.tag}\n\n`;
                
                messages.reverse().forEach(msg => {
                    transcriptContent += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
                });

                const attachment = new AttachmentBuilder(Buffer.from(transcriptContent, 'utf-8'), { name: `${interaction.channel.name}-log.txt` });

                const logEmbed = new EmbedBuilder()
                    .setTitle('Bilet Kapatıldı')
                    .addFields(
                        { name: 'Bilet Kanalı:', value: interaction.channel.name, inline: true },
                        { name: 'Kapatan:', value: interaction.user.tag, inline: true }
                    )
                    .setColor('Orange').setTimestamp();

                await logKanal.send({ embeds: [logEmbed], files: [attachment] });
            }
        }
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    if (interaction.isButton() && interaction.customId === 'ticket_vazgec') {
        await interaction.message.delete();
        await interaction.channel.send('✅ İşlem iptal edildi.');
    }
});

client.login(process.env.TOKEN);
