const {
    MessageType,
    MessageOptions,
    MessageMedia,
    Mimetype,
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    makeInMemoryStore,
    downloadContentFromMessage,
    jidDecode,
    proto
} = require("@whiskeysockets/baileys");
const SpottyDL = require('spottydl')
const ffmpeg = require('ffmpeg-static');
process.env.YTDL_NO_UPDATE = '1';
const {
    exec
} = require('child_process');
const path = require('path');

const fs = require('fs');
const archiver = require('archiver');
const express = require("express");
const app = express();
const qrcode = require('qrcode-terminal');
const keep_alive = require('./keep_alive.js')
const math = require('mathjs');

const ytdl = require('ytdl-core');
const moment = require('moment-timezone');

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
            logger: require('pino')({
                level: 'silent'
            }),
            browser: ['Ubuntu', 'Chrome', '22.04.4']
        });


        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const {
                connection,
                qr,
                lastDisconnect
            } = update;

            if (qr) {
                qrcode.generate(qr, {
                    small: true
                }); // tampilkan QR manual
            }

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

        sock.ev.on('messages.upsert', async ({
            messages
        }) => {

            const msg = messages[0];
            if (!msg || !msg.message) return;

            // ⛔ Filter agar hanya respon ke chat pribadi (bukan grup)
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            if (isGroup) return;


            // Tangani berbagai tipe isi pesan
            const messageContent =
                msg.message.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                '';

            if (!messageContent) {
                console.error('❌ Tidak ada konten teks dalam pesan.');
                return;
            }

            const args = messageContent.trim().split(' ');
            const cmd = args[0];

            const cmdRegex = /^!quran\s*(\d+)\s*(\d+)?\s*(juz\s*(\d+))?$/i;


            const match = messageContent.match(cmdRegex);


            var abc = JSON.stringify(msg, undefined, 2);
            console.log(abc);


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

            const outputDir = path.join(__dirname, 'output');
            const rawOutput = path.join(outputDir, 'video_raw.webm');
            const finalOutput = path.join(outputDir, 'video360.mp4');


            function convertWebmToMp4(inputPath, outputPath) {
                return new Promise((resolve, reject) => {
                    const outputDir = path.dirname(outputPath);
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, {
                            recursive: true
                        });
                    }

                    const cmd = `"${ffmpeg}" -i "${inputPath}" -c:v libx264 -c:a aac -strict experimental "${outputPath}"`;
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            console.error('❌ ffmpeg error:', stderr);
                            reject(error);
                        } else {
                            resolve(outputPath);
                        }
                    });
                });
            }


            switch (cmd) {
                case '!spotify': {
                    if (args.length !== 2) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !spotify [URL]'
                        });
                        return;
                    }

                    const spotifyUrl = args[1];
                    const outputDir = 'output';
                    const outputPath = path.join(outputDir, 'output.mp3');

                    try {
                        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {
                            recursive: true
                        });
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    } catch (err) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: '❌ Tidak bisa akses folder output.'
                        });
                        return;
                    }

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '[⏳] Mengunduh lagu dari Spotify...'
                    });

                    try {
                        const track = await SpottyDL.getTrack(spotifyUrl);
                        if (!track) throw new Error('Track tidak ditemukan.');

                        const downloadedList = await SpottyDL.downloadTrack(track, outputDir, false);
                        console.log('📦 downloaded:', downloadedList);

                        if (!Array.isArray(downloadedList) || downloadedList.length === 0) {
                            throw new Error('Unduhan tidak mengembalikan file.');
                        }

                        const firstFile = downloadedList[0];
                        if (!firstFile || !firstFile.filename) {
                            throw new Error('File tidak ditemukan di hasil unduhan.');
                        }

                        const originalPath = path.resolve(firstFile.filename);
                        if (!fs.existsSync(originalPath)) {
                            throw new Error('File hasil unduhan tidak ditemukan.');
                        }

                        const stats = fs.statSync(originalPath);
                        if (!stats.isFile()) {
                            throw new Error('Hasil unduhan bukan file.');
                        }

                        // Rename ke output/output.mp3 tanpa peduli nama asli
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        fs.renameSync(originalPath, outputPath);

                        const sizeMB = fs.statSync(outputPath).size / (1024 * 1024);
                        if (sizeMB > 100) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: `⚠️ File terlalu besar (${sizeMB.toFixed(1)} MB), tidak dapat dikirim.`
                            });
                            return;
                        }

                        await sock.sendMessage(msg.key.remoteJid, {
                            audio: {
                                url: outputPath
                            },
                            mimetype: 'audio/mp4',
                            fileName: 'output.mp3'
                        });

                        await sock.sendMessage(msg.key.remoteJid, {
                            text: '✅ Lagu berhasil dikirim sebagai output.mp3'
                        });

                    } catch (err) {
                        console.error('❌ Error Spotify:', err);
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `❌ Gagal: ${err.message}`
                        });
                    }

                    break;
                }


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
                    break;

                case '!menu':
                    const timeZone = moment.tz.guess();
                    const currentTime = moment().tz(timeZone).format('YYYY-MM-DD HH:mm:ss');

                    const namabot = '*BIMBOT*';
                    const ppgroup = 'https://avatars.githubusercontent.com/u/139457966';
                    const profile = 'http://github.com/SecretDiscorder';

                    const menuText = `
🤖 *MENU BOT WA* 🤖
━━━━━━━━━━━━━━━━━━━
1. *!virtex*       -> virtex generator
2. *!quran*        -> Get Quran ayats
3. *!calculate*    -> Perform calculations
4. *!aritmatika*   -> Perform arithmetic operations
5. *!sin*          -> Calculate sine
6. *!cos*          -> Calculate cosine
7. *!tan*          -> Calculate tangent
8. *!pangkat*      -> Calculate exponentiation
9. *!sqrt*        -> Calculate square root
10. *!youtube*     -> Search videos on YouTube
11. *!download*    -> Download files
12. *!spotify*     -> Download Spotify Music
13. ~*!spam*       -> Spam infinity repeat~
14. ~*!atur*       -> Spam Infinity~
━━━━━━━━━━━━━━━━━━
`;

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `${namabot}\n*AUTHOR*\n*SECRETDISCORDER©*\n${currentTime}\n${menuText}\n*Profile:*\n${profile}`,
                        contextInfo: {
                            externalAdReply: {
                                title: `${namabot}`,
                                body: currentTime,
                                thumbnailUrl: ppgroup,
                                sourceUrl: "https://youtube.com/BimaSeven",
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    });
                    contextFile = "./ura.mp3";
                    await sock.sendMessage(msg.key.remoteJid, {
                        audio: {
                            url: contextFile
                        },
                        mimetype: 'audio/mp4',
                        fileName: `${config.filename.mp3}.mp3`
                    });

                    break;


                    /*import fs from 'fs'
                    import path from 'path'
                    import { exec } from 'child_process'

                    case '!gambar': {
                      const prompt = text.slice(command.length).trim()
                      if (!prompt) {
                        await sock.sendMessage(from, { text: 'Tolong masukkan prompt setelah perintah !gambar' })
                        break
                      }

                      await sock.sendMessage(from, { text: 'Sedang membuat gambar, mohon tunggu sebentar...' })

                      generateImage(prompt, async (err, imagePath) => {
                        if (err) {
                          console.error('Generate image error:', err)
                          await sock.sendMessage(from, { text: 'Gagal membuat gambar.' })
                          return
                        }

                        try {
                          const buffer = fs.readFileSync(imagePath)
                          await sock.sendMessage(from, { image: buffer, caption: `Prompt: ${prompt}` })
                        } catch (e) {
                          console.error('Error membaca atau mengirim gambar:', e)
                          await sock.sendMessage(from, { text: 'Gagal mengirim gambar.' })
                        }
                      })
                      break
                    }

                    function generateImage(prompt, callback) {
                      const sdFolder = 'C:/Users/User/stable-diffusion-webui'

                      // Jalankan CLI python txt2img.py dari WebUI folder
                      // --prompt "..." untuk text prompt
                      // --n_samples 1 --n_iter 1 agar cuma buat 1 gambar
                      // --plms untuk metode sampling cepat dan berkualitas
                      const command = `python scripts/txt2img.py --prompt "${prompt.replace(/"/g, '\\"')}" --n_samples 1 --n_iter 1 --plms`

                      exec(command, { cwd: sdFolder, windowsHide: true }, (error, stdout, stderr) => {
                        if (error) {
                          console.error('exec error:', error)
                          return callback(error)
                        }

                        console.log('Stable Diffusion output:', stdout)
                        if (stderr) console.error('Stable Diffusion stderr:', stderr)

                        // Default output file stable diffusion txt2img biasanya:
                        // {sdFolder}/outputs/txt2img-samples/sample.png
                        const outputImagePath = path.join(sdFolder, 'outputs', 'txt2img-samples', 'sample.png')

                        if (!fs.existsSync(outputImagePath)) {
                          return callback(new Error('Gambar output tidak ditemukan di folder output'))
                        }

                        callback(null, outputImagePath)
                      })
                    }
                    */
                case '!downloadmp4':
                    if (args.length !== 2) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !downloadmp4 [link_youtube]'
                        });
                        return;
                    }

                    const ytUrl = args[1];

                    const outputDir = path.join(__dirname, 'output');
                    const rawOutput = path.join(outputDir, 'video_raw.webm');
                    const finalOutput = path.join(outputDir, 'video360.mp4');

                    try {
                        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {
                            recursive: true
                        });
                        if (fs.existsSync(rawOutput)) fs.unlinkSync(rawOutput);
                        if (fs.existsSync(finalOutput)) fs.unlinkSync(finalOutput);
                    } catch (err) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: '❌ Gagal akses direktori output.'
                        });
                        return;
                    }

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '[⏳] Mengunduh video 360p dari YouTube...'
                    });

                    try {
                        const cmd = `"./yt-dlp.exe" -f "bestvideo[height<=360]+bestaudio/best[height<=360]" -o "${rawOutput}" "${ytUrl}"`;

                        exec(cmd, async (error) => {
                            if (error) {
                                console.error('yt-dlp error:', error);
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: '❌ Gagal mengunduh video.'
                                });
                                return;
                            }

                            if (!fs.existsSync(rawOutput)) {
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: '❌ File tidak ditemukan setelah unduhan.'
                                });
                                return;
                            }

                            try {
                                await convertWebmToMp4(rawOutput, finalOutput);

                                const stats = fs.statSync(finalOutput);
                                const sizeMB = stats.size / (1024 * 1024);

                                if (sizeMB >= 100) {
                                    await sock.sendMessage(msg.key.remoteJid, {
                                        text: `⚠️ Ukuran file terlalu besar (${sizeMB.toFixed(2)}MB). Tidak dapat dikirim.`
                                    });
                                    return;
                                }

                                await sock.sendMessage(msg.key.remoteJid, {
                                    video: {
                                        url: finalOutput
                                    },
                                    mimetype: 'video/mp4',
                                    fileName: 'video360.mp4',
                                    caption: '✅ Video berhasil dikirim dalam format 360p.'
                                });

                            } catch (err) {
                                console.error('ffmpeg error:', err);
                                await sock.sendMessage(msg.key.remoteJid, {
                                    text: '❌ Gagal mengonversi video ke .mp4'
                                });
                            }
                        });

                    } catch (err) {
                        console.error(err);
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: `❌ Error saat proses: ${err.message}`
                        });
                    }

                    break;


                case '!calculate':

                    const expression = args.slice(1).join(' ');

                    const result = math.evaluate(expression);

                    sock.sendMessage(msg.key.remoteJid, {
                        text: `Hasil: ${result}`
                    });

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

                    sock.sendMessage(msg.key.remoteJid, {
                        text: `Suku ke-${n} dari barisan aritmatika dengan a=${a} dan d=${d} adalah ${nthTerm}`
                    });

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

                        sock.sendMessage(msg.key.remoteJid, {
                            text: `sin(${sudutSin} radian): ${resultSin}`
                        });

                    } catch (error) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Terjadi kesalahan dalam perhitungan sin.'
                        });

                    }

                    break;



                case '!cos':

                    if (args.length !== 2) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !cos [sudut]'
                        });

                        return;

                    }

                    const sudutCos = parseFloat(args[1]);

                    try {

                        const resultCos = math.cos(sudutCos);

                        sock.sendMessage(msg.key.remoteJid, {
                            text: `cos(${sudutCos} radian): ${resultCos}`
                        });

                    } catch (error) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Terjadi kesalahan dalam perhitungan cos.'
                        });

                    }

                    break;



                case '!tan':

                    if (args.length !== 2) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !tan [sudut]'
                        });

                        return;

                    }

                    const sudutTan = parseFloat(args[1]);

                    try {

                        const resultTan = math.tan(sudutTan);

                        sock.sendMessage(msg.key.remoteJid, {
                            text: `tan(${sudutTan} radian): ${resultTan}`
                        });

                    } catch (error) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Terjadi kesalahan dalam perhitungan tan.'
                        });

                    }

                    break;



                case '!pangkat':

                    if (args.length !== 3) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !pangkat [basis] [eksponen]'
                        });

                        return;

                    }

                    const basis = parseFloat(args[1]);

                    const eksponen = parseFloat(args[2]);

                    try {

                        const resultPow = math.pow(basis, eksponen);

                        sock.sendMessage(msg.key.remoteJid, {
                            text: `Hasil pangkat dari ${basis}^${eksponen}: ${resultPow}`
                        });

                    } catch (error) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Terjadi kesalahan dalam perhitungan pangkat.'
                        });

                    }

                    break;



                case '!sqrt':

                    try {

                        if (args.length !== 2) {

                            sock.sendMessage(msg.key.remoteJid, {
                                text: 'Format yang benar: !sqrt [angka]'
                            });

                            return;

                        }

                        const angkaSqrt = parseFloat(args[1]);

                        if (!isNaN(angkaSqrt)) {

                            const resultSqrt = math.sqrt(angkaSqrt);

                            sock.sendMessage(msg.key.remoteJid, {
                                text: `Akar kuadrat dari ${angkaSqrt}: ${resultSqrt}`
                            });

                        } else {

                            sock.sendMessage(msg.key.remoteJid, {
                                text: 'Masukkan angka yang valid.'
                            });

                        }
                    } catch (error) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Terjadi kesalahan dalam perhitungan tan.'
                        });

                    }

                    break;
                    break;

                case '!youtube':

                    if (args.length !== 2) {

                        sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format yang benar: !youtube [URL]'
                        });

                        return;

                    }

                    const url = args[1];

                    await detailYouTube(url);

                    break;
                case '!download': {
                    const fullText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                    const tokens = fullText.trim().split(/\s+/);
                    const ytUrl = tokens[1];

                    if (!ytUrl) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'Format: !download [YouTube URL]'
                        });
                        return;
                    }

                    const filename = 'output.mp3'; // hasil output file
                    const ytdlpPath = path.join(__dirname, 'yt-dlp.exe');

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '[⏳] Mengunduh menggunakan yt-dlp...'
                    });

                    const command = `"${ytdlpPath}" -f bestaudio -o "${filename}" "${ytUrl}"`;

                    exec(command, async (err, stdout, stderr) => {
                        if (err) {
                            console.error('❌ Error yt-dlp:', stderr || err);
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: '❌ Gagal mengunduh dengan yt-dlp.'
                            });
                            return;
                        }

                        // Kirim hasil audio
                        if (fs.existsSync(filename)) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                audio: {
                                    url: filename
                                },
                                mimetype: 'audio/mp4',
                                fileName: 'YouTube_Download.mp3'
                            });

                            await sock.sendMessage(msg.key.remoteJid, {
                                text: '✅ Berhasil mengunduh audio!'
                            });

                            fs.unlinkSync(filename);
                        } else {
                            await sock.sendMessage(msg.key.remoteJid, {
                                text: '⚠️ File tidak ditemukan setelah proses selesai.'
                            });
                        }
                    });

                    break;
                }



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