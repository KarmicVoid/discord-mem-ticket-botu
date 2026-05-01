const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const express = require('express'); // Express eklendi

// --- RENDER PORT HATASI ÇÖZÜMÜ ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('MEM Ticket Botu Aktif!'));
app.listen(port, () => console.log(`Port ${port} dinleniyor.`));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let sunucuVerisi = {};
if (fs.existsSync('./ayarlar.json')) {
    sunucuVerisi = JSON.parse(fs.readFileSync('./ayarlar.json', 'utf8'));
}

function veriKaydet() {
    fs.writeFileSync('./ayarlar.json', JSON.stringify(sunucuVerisi, null, 2));
}

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const filter = m => m.author.id === message.author.id;
        let kurulumData = { ticketCount: 0 };

        try {
            await message.channel.send('1️⃣ **Hangi kanala ticket sistemi kurulacak?** (#etiketle)');
            const cevap1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const panelKanal = cevap1.first().mentions.channels.first();
            if (!panelKanal) return message.reply('❌ Kanal etiketlenmedi.');
            kurulumData.panelID = panelKanal.id;

            await message.channel.send('2️⃣ **Ticket yetkilisi rolleri hangileri?** (@etiketle)');
            const cevap2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const yetkiliRoller = cevap2.first().mentions.roles.map(r => r.id);
            if (yetkiliRoller.length === 0) return message.reply('❌ Rol etiketlenmedi.');
            kurulumData.roller = yetkiliRoller;

            await message.channel.send('3️⃣ **Hangi kanala ticket kayıtları düşecek?** (#etiketle)');
            const cevap3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const logKanal = cevap3.first().mentions.channels.first();
            if (!logKanal) return message.reply('❌ Kanal etiketlenmedi.');
            kurulumData.logID = logKanal.id;

            sunucuVerisi[message.guild.id] = kurulumData;
            veriKaydet();

            const embed = new EmbedBuilder()
                .setTitle('MEM | Ticket Botu')
                .setDescription('Aşagıdaki kategori seç düğmesine basıp sorununuzu yaşadığınız kategoriyi seçerek bilet oluşturabilirsiniz, gereksiz yere bilet oluşturmak ve 3\'ten fazla yetkili taglamak yasaktır.')
                .setColor('Red');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_menu')
                    .setPlaceholder('Kategori seçiniz...')
                    .addOptions([
                        { label: 'Şikayet / Geri Bildirim', value: 'Şikayet/Geri Bildirim', emoji: '📝' },
                        { label: 'Öneri / İstek', value: 'Öneri/İstek', emoji: '💡' },
                        { label: 'Partnerlik', value: 'Partnerlik', emoji: '🤝' },
                        { label: 'Yetkililerle İletişim', value: 'Yetkililerle İletişim', emoji: '👑' }
                    ])
            );

            await panelKanal.send({ embeds: [embed], components: [row] });
            await message.channel.send('✅ Kurulum başarıyla bitti.');
        } catch (err) { message.channel.send('⚠️ Süre doldu.'); }
    }
});

// ... (Kanal açma ve kapatma interaction bölümleri moderasyon botundaki gibi buraya eklenecek)
// Not: Interaction kodları önceki mesajımızdakiyle aynıdır, sadece en alt satıra dikkat:

client.login(process.env.TOKEN); // TOKEN GİZLENDİ
