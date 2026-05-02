const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

// Render için Port Ayarı
const app = express();
app.get('/', (req, res) => res.send('Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

let sunucuVerisi = {};
if (fs.existsSync('./ayarlar.json')) {
    try { sunucuVerisi = JSON.parse(fs.readFileSync('./ayarlar.json', 'utf8')); } catch (e) { sunucuVerisi = {}; }
}

function veriKaydet() { fs.writeFileSync('./ayarlar.json', JSON.stringify(sunucuVerisi, null, 2)); }

client.on('ready', () => { console.log(`${client.user.tag} Hazır!`); });

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
                .setDescription('Sorun yaşadığınız kategoriyi seçerek bilet açabilirsiniz.')
                .setColor('Red');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_menu').setPlaceholder('Kategori seçiniz...').addOptions([
                    { label: 'Şikayet / Geri Bildirim', value: 'Şikayet', emoji: '📝' },
                    { label: 'Öneri / İstek', value: 'Öneri', emoji: '💡' },
                    { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' },
                    { label: 'Yetkililerle İletişim', value: 'Yetkililerle İletişim', emoji: '👑' }
                ])
            );

            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Kurulum başarıyla tamamlandı!');
        } catch (e) { message.reply('⚠️ İşlem zaman aşımına uğradı veya hata oluştu.'); }
    }
});

client.on('interactionCreate', async (interaction) => {
    // MENÜ SEÇİMİ (BİLET AÇMA)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = sunucuVerisi[interaction.guild.id];
        if (!ayar) return interaction.reply({ content: 'Lütfen önce /setup yapın!', ephemeral: true });

        // KRİTİK: "Etkileşim Başarısız" hatasını önlemek için önce yanıtı erteliyoruz
        await interaction.deferReply({ ephemeral: true });

        ayar.ticketCount = (ayar.ticketCount || 0) + 1;
        veriKaydet();

        try {
            const kanal = await interaction.guild.channels.create({
                name: `ticket-${ayar.ticketCount}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...ayar.roller.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`Bilet Açıldı | ${interaction.values[0]}`)
                .setDescription(`Hoş geldin ${interaction.user}, yetkililer kısa süre içinde burada olacaktır.`)
                .setColor('Blue');

            const buton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_kapat').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger)
            );

            await kanal.send({ content: `${interaction.user} | <@&${ayar.roller[0]}>`, embeds: [embed], components: [buton] });
            
            // Ertelenmiş yanıtı güncelliyoruz
            await interaction.editReply({ content: `Biletiniz açıldı: ${kanal}` });
        } catch (error) {
            await interaction.editReply({ content: 'Kanal oluşturulurken bir hata oluştu! Lütfen botun "Kanalları Yönet" yetkisi olduğundan emin olun.' });
        }
    }

    // BUTON (BİLET KAPATMA)
    if (interaction.isButton() && interaction.customId === 'ticket_kapat') {
        await interaction.reply('🚀 Kanal 3 saniye içinde siliniyor...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.TOKEN);
