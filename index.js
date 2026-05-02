const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- RENDER PORT HATASI ÇÖZÜMÜ ---
const app = express();
app.get('/', (req, res) => res.send('Ticket Botu Aktif!'));
app.listen(process.env.PORT || 3000, () => console.log("Port Dinleniyor."));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// Veri Kayıt Sistemi
let sunucuVerisi = {};
if (fs.existsSync('./ayarlar.json')) {
    sunucuVerisi = JSON.parse(fs.readFileSync('./ayarlar.json', 'utf8'));
}

function veriKaydet() {
    fs.writeFileSync('./ayarlar.json', JSON.stringify(sunucuVerisi, null, 2));
}

client.on('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
});

// --- KURULUM KOMUTU ---
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    if (message.content === '/setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.');
        }

        const filter = m => m.author.id === message.author.id;
        
        try {
            await message.channel.send('1️⃣ **Ticket paneli hangi kanala kurulsun?** (#etiketle)');
            const c1 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const kanal = c1.first().mentions.channels.first();
            if(!kanal) return message.reply("❌ Kanal etiketlemedin, iptal edildi.");

            await message.channel.send('2️⃣ **Biletlere bakacak yetkili rolleri etiketle?** (@etiketle)');
            const c2 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const roller = c2.first().mentions.roles.map(r => r.id);
            if(roller.length === 0) return message.reply("❌ Rol etiketlemedin, iptal edildi.");

            await message.channel.send('3️⃣ **Bilet kayıtları (Log) hangi kanala gitsin?** (#etiketle)');
            const c3 = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
            const logKanal = c3.first().mentions.channels.first();
            if(!logKanal) return message.reply("❌ Log kanalı etiketlemedin, iptal edildi.");

            // Verileri Kaydet
            sunucuVerisi[message.guild.id] = {
                panelID: kanal.id,
                roller: roller,
                logID: logKanal.id,
                ticketCount: 0
            };
            veriKaydet();

            // Paneli Gönder
            const embed = new EmbedBuilder()
                .setTitle('MEM | Ticket Sistemi')
                .setDescription('Aşağıdaki menüden sorununuza uygun kategoriyi seçerek bilet açabilirsiniz.\n\n⚠️ Gereksiz bilet açmak yasaktır.')
                .setColor('Red')
                .setFooter({ text: 'MEM Destek Sistemi' });

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

            await kanal.send({ embeds: [embed], components: [row] });
            message.reply('✅ Ticket sistemi başarıyla kuruldu!');

        } catch (e) {
            message.reply('⚠️ Süre doldu veya bir hata oluştu. Lütfen tekrar deneyin.');
        }
    }
});

// --- BİLET AÇMA VE KAPATMA İŞLEMLERİ ---
client.on('interactionCreate', async (interaction) => {
    // Menü Seçimi (Bilet Açma)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const ayar = sunucuVerisi[interaction.guild.id];
        if (!ayar) return interaction.reply({ content: 'Kurulum verisi bulunamadı!', ephemeral: true });

        ayar.ticketCount++;
        veriKaydet();

        const kategori = interaction.values[0];
        
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
            .setTitle(`Bilet Açıldı | ${kategori}`)
            .setDescription(`Merhaba ${interaction.user}, biletiniz başarıyla oluşturuldu. Yetkililerimiz en kısa sürede ilgilenecektir.\n\n**Kategori:** ${kategori}`)
            .setColor('Green')
            .setTimestamp();

        const buton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_kapat').setLabel('Bileti Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await kanal.send({ content: `${interaction.user} | <@&${ayar.roller[0]}>`, embeds: [embed], components: [buton] });
        await interaction.reply({ content: `Biletiniz açıldı: ${kanal}`, ephemeral: true });
    }

    // Buton Tıklama (Bilet Kapatma)
    if (interaction.isButton() && interaction.customId === 'ticket_kapat') {
        const ayar = sunucuVerisi[interaction.guild.id];
        
        await interaction.reply('🔒 Bilet kapatılıyor... 3 saniye içinde kanal silinecek.');
        
        // Log Kanalına Bilgi Gönder
        if (ayar && ayar.logID) {
            const logKanal = interaction.guild.channels.cache.get(ayar.logID);
            if (logKanal) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Bilet Kapatıldı')
                    .addFields(
                        { name: 'Kapatan:', value: `${interaction.user.tag}`, inline: true },
                        { name: 'Kanal:', value: `${interaction.channel.name}`, inline: true }
                    )
                    .setColor('Orange')
                    .setTimestamp();
                logKanal.send({ embeds: [logEmbed] });
            }
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.TOKEN);

