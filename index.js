const {
  MessageType,
  MessageOptions, MessageMedia,
  Mimetype,
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const express = require("express");
const app = express();
const qrcode = require('qrcode-terminal');

const math = require('mathjs');

const ytdl = require('ytdl-core');


const JSDOM = require('jsdom');

const axios = require('axios');

const Downloader = require('nodejs-file-downloader');

const config = require('./config.json');

var quranAyats = require('@kmaslesa/quran-ayats');

const JsFileDownloader = require('js-file-downloader');
async function connectToWhatsApp() {
  try {
    const {
      state,
      saveCreds
    } = await useMultiFileAuthState("auth_info_baileys");
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const {
        connection,
        lastDisconnect
      } = update;

      if (connection === 'close') {

        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('connection close due to, ', lastDisconnect.error, ', reconnecting', shouldReconnect);
        if (shouldReconnect) {

          await connectToWhatsApp();

        }
      } else if (connection === 'open') {
        console.log('Opened Connection');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {

      const msg = messages[0];
      var abc = JSON.stringify(msg, undefined, 2);
      console.log(abc);
      const args = msg.message.conversation.split(' ');
      const cmd = args[0];
	  
      const cmdRegex = /^!quran\s*(\d+)\s*(\d+)?\s*(juz\s*(\d+))?$/i;
 
      const match = msg.message.conversation.match(cmdRegex);

      const allAyats = quranAyats.getAllAyats();

      fs.writeFileSync('ayat.json', JSON.stringify(allAyats));



      // Fungsi sendQuranVerse diperbaiki

      async function sendQuranVerse(ayahNumber, surahNumber) {

        try {



          // Mendapatkan ayat Al-Quran berdasarkan nomor surah dan a

          const ayatData = JSON.parse(fs.readFileSync('ayat.json', 'utf8'));



          // Temukan ayat berdasarkan ayahNumber dan surahNumber.

          const ayah = ayatData.find(ayah => ayah.ayaNumber === ayahNumber && ayah.sura === surahNumber);



          if (ayah) {

            const response = `Surah ${surahNumber}, Ayah ${ayahNumber}: ${ayah.aya}`;

            await sock.sendMessage(msg.key.remoteJid, {

              text: response

            });

          } else {

            // Teks yang akan dikirim jika ayat tidak ditemukan.

            const notFoundResponse = "Ayat tidak ditemukan dalam database.";

            await sock.sendMessage(msg.key.remoteJid, {

              text: notFoundResponse

            });

          }

        } catch (error) {

          console.error(error);

          await sock.sendMessage(msg.key.remoteJid, {

            text: `Terjadi kesalahan: ${error.message}`

          });

        }

      }

      async function detailYouTube(url) {

        await sock.sendMessage(msg.key.remoteJid, {

          text: '[⏳] Loading..'

        });

        try {

          let info = await ytdl.getInfo(url);

          let data = {

            channel: {

              name: info.videoDetails.author.name,

              user: info.videoDetails.author.user,

              channelUrl: info.videoDetails.author.channel_url,

              userUrl: info.videoDetails.author.user_url,

              verified: info.videoDetails.author.verified,

              subscriber: info.videoDetails.author.subscriber_count,

            },

            video: {

              title: info.videoDetails.title,

              description: info.videoDetails.description,

              lengthSeconds: info.videoDetails.lengthSeconds,

              videoUrl: info.videoDetails.video_url,

              publishDate: info.videoDetails.publishDate,

              viewCount: info.videoDetails.viewCount,

            },

          };

          await sock.sendMessage(msg.key.remoteJid, `*CHANNEL DETAILS*\n• Name : ${data.channel.name}\n• User : ${data.channel.user}\n• Verified : ${data.channel.verified}\n• Channel : ${data.channel.channelUrl}\n• Subscriber : ${data.channel.subscriber}`);

          await sock.sendMessage(msg.key.remoteJid, `*VIDEO DETAILS*\n• Title : ${data.video.title}\n• Seconds : ${data.video.lengthSeconds}\n• VideoURL : ${data.video.videoUrl}\n• Publish : ${data.video.publishDate}\n• Viewers : ${data.video.viewCount}`)

          await sock.sendMessage(msg.key.remoteJid, '*[✅]* Successfully!');

        } catch (err) {

          console.log(err);

          await sock.sendMessage(msg.key.remoteJid, '*[❎]* Failed!');

        }

      }



      async function downloadYouTube(url, format, filter) {

        await sock.sendMessage(msg.key.remoteJid, {

          text: '[⏳] Loading..'

        });

        let timeStart = Date.now();

        try {

          let info = await ytdl.getInfo(url);

          let data = {

            channel: {

              name: info.videoDetails.author.name,

              user: info.videoDetails.author.user,

              channelUrl: info.videoDetails.author.channel_url,

              userUrl: info.videoDetails.author.user_url,

              verified: info.videoDetails.author.verified,

              subscriber: info.videoDetails.author.subscriber_count,

            },

            video: {

              title: info.videoDetails.title,

              description: info.videoDetails.description,

              lengthSeconds: info.videoDetails.lengthSeconds,

              videoUrl: info.videoDetails.video_url,

              publishDate: info.videoDetails.publishDate,

              viewCount: info.videoDetails.viewCount,

            },

          };

          ytdl(url, {

            filter: filter,

            format: format,

            quality: 'highest'

          }).pipe(fs.createWriteStream(`./download.${format}`)).on('finish', async () => {

            let timestamp = Date.now() - timeStart;

            const media = {

              "filename": `download.${format}`

            };





            media.filename = `${config.filename.mp3}.${format}`;

            await sock.sendMessage(msg.key.remoteJid, {

              audio: {

                url: 'download.mp3'

              },

              mimetype: 'audio/mp4'

            });

            await sock.sendMessage(msg.key.remoteJid, {

              text: `• Title : ${data.video.title}\n• Channel : ${data.channel.user}\n• View Count : ${data.video.viewCount}\n• TimeStamp : ${timestamp}`

            });

            await sock.sendMessage(msg.key.remoteJid, {

              text: '*[✅]* Successfully!'

            });

          });

        } catch (err) {

          console.log(err);

          await sock.sendMessage(msg.key.remoteJid, '*[❎]* Failed!');

        }

      }

      switch (cmd) {

          case '!virtex':

    if (args.length !== 3) {

        sock.sendMessage(msg.key.remoteJid, {

            text: 'Format yang benar: !virtex (string)'

        });

    } else {

        const c = args[1];

        const b = parseInt(args[2]);

        try {

            sock.sendMessage(msg.key.remoteJid, {

                text: c.repeat(b)

            });

        } catch (error) {

            sock.sendMessage(msg.key.remoteJid, {

                text: 'Terjadi kesalahan dalam membuat virtex'

            });

        }

    }

    break;



        case '!quran':

          if (args.length === 3) {

            const surahNumber = parseInt(args[1]);

            const ayahNumber = parseInt(args[2]);

            if (!isNaN(surahNumber) && !isNaN(ayahNumber)) {

              await sendQuranVerse(ayahNumber, surahNumber);

            } else {

              await sock.sendMessage(msg.key.remoteJid, {

                text: 'Nomor surah dan ayat harus berupa angka.'

              });

            }

          } else {

            await sock.sendMessage(msg.key.remoteJid, {

              text: 'Format yang benar: !quran [Nomor Surah] [Nomor Ayat]'

            });

          }


        case '.author':

         var profile = 'http://prof.bimakhzdev.my.id';

          sock.sendMessage(msg.key.remoteJid, {text: `*AUTHOR* \n *SECRETDISCORDER©* \n *myProfile*: ${profile} \n `}, {audio: {

                url: 'download.mp3', mimetype: 'audio/mp4'

          }

              

                                                                                                                       });

          break;

         case '!menu':

          sock.sendMessage(msg.key.remoteJid, { text: '*MENU BOT WA. !virtex !quran .author !calculate !aritmatika !sin !cos !tan !pangkat !sqrt !youtube !download !spam !spamV*' });

          break;



        case '!calculate':

          const expression = args.slice(1).join(' ');

          const result = math.evaluate(expression);

          sock.sendMessage(msg.key.remoteJid, { text: `Hasil: ${result}` });

          break;



        case '!aritmatika':

          if (args.length !== 4) {

            sock.sendMessage(msg.key.remoteJid, {

              text: 'Format yang benar: !aritmatika [a] [n] [d]'

            });

            return;

          }

          const a = parseFloat(args[1]);

          const n = parseFloat(args[2]);

          const d = parseFloat(args[3]);

          const nthTerm = a + (n - 1) * d;

          sock.sendMessage(msg.key.remoteJid, { text: `Suku ke-${n} dari barisan aritmatika dengan a=${a} dan d=${d} adalah ${nthTerm}` });

          break;



        case '!sin':

          if (args.length !== 2) {

            sock.sendMessage(msg.key.remoteJid, {

              text: 'Format yang benar: !sin [sudut]'

            });

            return;

          }

          const sudutSin = parseFloat(args[1]);

          try {

            const resultSin = math.sin(sudutSin);

            sock.sendMessage(msg.key.remoteJid, { text: `sin(${sudutSin} radian): ${resultSin}` });

          } catch (error) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan dalam perhitungan sin.' });

          }

          break;



        case '!cos':

          if (args.length !== 2) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !cos [sudut]' });

            return;

          }

          const sudutCos = parseFloat(args[1]);

          try {

            const resultCos = math.cos(sudutCos);

            sock.sendMessage(msg.key.remoteJid, { text: `cos(${sudutCos} radian): ${resultCos}` });

          } catch (error) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan dalam perhitungan cos.' });

          }

          break;



        case '!tan':

          if (args.length !== 2) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !tan [sudut]' });

            return;

          }

          const sudutTan = parseFloat(args[1]);

          try {

            const resultTan = math.tan(sudutTan);

            sock.sendMessage(msg.key.remoteJid, { text: `tan(${sudutTan} radian): ${resultTan}` });

          } catch (error) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan dalam perhitungan tan.' });

          }

          break;



        case '!pangkat':

          if (args.length !== 3) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !pangkat [basis] [eksponen]' });

            return;

          }

          const basis = parseFloat(args[1]);

          const eksponen = parseFloat(args[2]);

          try {

            const resultPow = math.pow(basis, eksponen);

            sock.sendMessage(msg.key.remoteJid, { text: `Hasil pangkat dari ${basis}^${eksponen}: ${resultPow}` });

          } catch (error) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan dalam perhitungan pangkat.' });

          }

          break;



        case '!sqrt':

          try {

          if (args.length !== 2) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !sqrt [angka]' });

            return;

          }

          const angkaSqrt = parseFloat(args[1]);

          if (!isNaN(angkaSqrt)) {

            const resultSqrt = math.sqrt(angkaSqrt);

            sock.sendMessage(msg.key.remoteJid, { text: `Akar kuadrat dari ${angkaSqrt}: ${resultSqrt}` });

          } else {

            sock.sendMessage(msg.key.remoteJid, { text: 'Masukkan angka yang valid.' });

          }
		   } catch (error) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Terjadi kesalahan dalam perhitungan tan.' });

		   }

          break;
          break;

case '!youtube':

          if (args.length !== 2) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !youtube [URL]' });

            return;

          }

          const url = args[1];

          await detailYouTube(url);

          break;



        case '!download':

          if (args.length !== 4) {

            sock.sendMessage(msg.key.remoteJid, { text: 'Format yang benar: !download [URL] [format] [filter]' });

            return;

          }

          const downloadUrl = args[1];

          const format = args[2];

          const filter = args[3];

          await downloadYouTube(downloadUrl, format, filter);

          break;



        default:

          break;

      }

      if (cmd === '!spam') {
        if (args.length != 3) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Format yang benar !spam {string} [1]'
          });
        } else {
          const c = args[1];
          const b = parseInt(args[2]);
          while (b > 0) {
            try {
              await sock.sendMessage(msg.key.remoteJid, {
                text: c.repeat(b)

              })
            } catch (error) {
              console.log(error)
            }
          }
        }
      } else if (cmd === '!atur') {
       if (args.length != 3) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Format yang benar !spam {string} [1]'
          });
        } else {
          const c = args[1];
          const b = parseInt(args[2]);
            try {
              await sock.sendMessage(msg.key.remoteJid, {
                text: c.repeat(b)

              })
            } catch (error) {
              console.log(error)
            }
        }
      }
    })

  } catch (error) {
    console.log('terjadi kesalahan', error);

  }


}
connectToWhatsApp();