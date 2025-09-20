require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const puppeteer = require('puppeteer');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent]
});

const TIKTOK_USERNAME = 'oppungmedan'; // Username TikTok da monitorare
const CHANNEL_ID = process.env.CHANNEL_ID || '1417911346313564293'; // ID del canale Discord dal .env o default
let wasLive = false;

client.on('ready', () => {
  console.log(`Bot connesso come ${client.user.tag}!`);
  checkTikTokLive(); // Avvia il loop di controllo
  // Rimossa la notifica di test per evitare falsi positivi
});

async function checkTikTokLive() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 30000
  });
  const page = await browser.newPage();

  // Imposta i cookie dal file .env
  await page.setCookie({
    name: 'ttwid',
    value: process.env.TTWID,
    domain: '.tiktok.com'
  }, {
    name: 'sessionid',
    value: process.env.SESSIONID,
    domain: '.tiktok.com'
  }, {
    name: 's_v_web_id',
    value: process.env.S_V_WEB_ID,
    domain: '.tiktok.com'
  }, {
    name: 'csrf_session_id',
    value: process.env.CSRF_SESSION_ID,
    domain: '.tiktok.com'
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 720 });

  setInterval(async () => {
    try {
      console.log(`🔍 Controllando live per @${TIKTOK_USERNAME}...`);
      await page.goto(`https://www.tiktok.com/@${TIKTOK_USERNAME}/live`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`✅ Pagina caricata (status implicito: OK)`);

      let title = await page.title();
      console.log(`🔍 Titolo grezzo: ${title}`);
      if (typeof title !== 'string' || !title) {
        console.log('⚠️ Titolo non valido o vuoto.');
        title = '';
      } else {
        title = title.toLowerCase();
      }
      const isLiveFromTitle = title.includes('live') || title.includes('is live') || title.includes('in diretta') || title.includes('está live');
      console.log(`🔍 Dal titolo "${title.substring(0, 50)}...": ${isLiveFromTitle ? 'LIVE!' : 'NON LIVE'}`);

      let bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      if (typeof bodyText !== 'string' || !bodyText) {
        console.log('⚠️ Testo body non valido o vuoto.');
        bodyText = '';
      }
      bodyText = bodyText.toLowerCase().replace(/\s+/g, ' ').trim();
      console.log(`🔍 Testo body rilevato: ${bodyText.substring(0, 200)}...`);
      const isLiveFromText = bodyText.includes('live now') || bodyText.includes('is live') || bodyText.includes('in live') || bodyText.includes('watching live') || bodyText.includes('live stream') || bodyText.includes('espectadores');
      const isEnded = bodyText.includes('finalizó') || bodyText.includes('ended') || bodyText.includes('finalized') || bodyText.includes('terminó');
      console.log(`🔍 Dal testo body: ${isLiveFromText ? 'LIVE!' : 'NON LIVE'}`);
      console.log(`🔍 Live terminata rilevata: ${isEnded ? 'SÌ' : 'NO'}`);

      const isInvalidPage = title.includes('log in') || title.includes('login') || bodyText.includes('log in to follow') || bodyText.includes('please log in');
      console.log(`🔍 Pagina non valida rilevata: ${isInvalidPage ? 'SÌ' : 'NO'}`);

      // Logica aggiornata: Live solo se titolo indica live, non è terminata, e c'è supporto dal body o assenza di "ended"
      const isLive = !isInvalidPage && isLiveFromTitle && !isEnded && (isLiveFromText || bodyText.includes('espectador') || bodyText.includes('viewers'));

      console.log(`🎯 STATUS FINALE: ${isLive ? '🟢 LIVE!' : '🔴 NON LIVE'}`);

      if (isLive && !wasLive) {
        console.log('🎉 Rilevato INIZIO LIVE! Invio notifica...');
        sendLiveNotification();
        wasLive = true;
      } else if (!isLive && wasLive) {
        console.log('⏹️ Rilevato FINE LIVE! Invio notifica...');
        sendEndLiveNotification();
        wasLive = false;
      } else {
        console.log(`ℹ️ Nessun cambio status (era: ${wasLive ? 'LIVE' : 'NON LIVE'})`);
      }
    } catch (error) {
      console.error(`❌ Errore nel loop: ${error.message}`);
      if (error.name === 'TimeoutError') {
        console.log('💡 Timeout: Aumenta il timeout a 60000 ms o verifica la connessione');
      }
    }
  }, 60000); // Intervallo di 60 secondi
}

async function sendLiveNotification() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle('📢 LIVE ATTIVA su TikTok!')
      .setDescription(`🔴 **@${TIKTOK_USERNAME} è in diretta ora!** 🔴\nUnisciti subito per non perderti l'azione!`)
      .setURL(`https://www.tiktok.com/@${TIKTOK_USERNAME}/live`)
      .setColor(0xFF0000) // Rosso vivace per attirare attenzione
      .setThumbnail('https://copilot.microsoft.com/th/id/BCO.1907bf48-152f-40b3-ab6c-60286ebb42f6.png') // Logo TikTok generico (sostituiscilo con il tuo URL logo)
      .setImage('https://copilot.microsoft.com/th/id/BCO.f6a916a7-c578-4e14-a9d6-6ed96890fac8.png') // Aggiungi qui il tuo logo o immagine personalizzata (es. da Imgur)
      .setTimestamp()
      .setFooter({ text: 'Notifica coglioni', iconURL: 'https://copilot.microsoft.com/th/id/BCO.d75e85f6-176f-476d-90f2-c237195c8c68.png' })
      .addFields(
        { name: '📺 Guarda Ora', value: `[Clicca qui per unirti!](https://www.tiktok.com/@${TIKTOK_USERNAME}/live)`, inline: true },
        { name: '⏰ Stato', value: 'In Diretta', inline: true }
      );

    await channel.send({ embeds: [embed] });
  }
}

async function sendEndLiveNotification() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle('📢 LIVE TERMINATA su TikTok')
      .setDescription(`🔵 La diretta di @${TIKTOK_USERNAME} è finita. Grazie per aver guardato! 🔵`)
      .setColor(0x0000FF) // Blu per indicare la fine
      .setThumbnail('https://www.tiktok.com/favicon.ico') // Logo TikTok generico
      .setImage('https://i.imgur.com/YourCustomImageUrl.jpg') // Aggiungi qui il tuo logo o immagine personalizzata
      .setTimestamp()
      .setFooter({ text: 'Notifica Live Bot • Powered by xAI', iconURL: 'https://www.tiktok.com/favicon.ico' })
      .addFields(
        { name: '📅 Prossima Live', value: 'Resta sintonizzato per aggiornamenti!', inline: true }
      );

    await channel.send({ embeds: [embed] });
  }
}

client.login(process.env.DISCORD_TOKEN ); // Token dal .env o default