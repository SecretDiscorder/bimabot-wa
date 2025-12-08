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
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const keep_alive = require('./keep_alive.js')
const math = require('mathjs');
const moment = require('moment-timezone');
const config = require('./config.json');
var quranAyats = require('@kmaslesa/quran-ayats');
					
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
            const from = msg.key.remoteJid;
            if (!msg || !msg.message) return;

            // ⛔ Filter agar hanya respon ke chat pribadi (bukan grup)
            // const isGroup = msg.key.remoteJid.endsWith('@g.us');
            // if (isGroup) return;


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
            }const args = messageContent.trim().split(' ');
						
			const cmd = args[0];

			// inputUnit tetap seperti semula


			// regex quran tetap
			const cmdRegex = /^!quran\s*(\d+)\s*(\d+)?\s*(juz\s*(\d+))?$/i;
			const match = messageContent.match(cmdRegex);

			// debug msg
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
1. *!virtex*       -> virtex for loop text generator
2. *!quran*        -> Get Quran ayats
3. *!calculate*    -> Perform calculations
4. *!aritmatika*   -> Perform arithmetic operations
5. *!sin*          -> Calculate sine
6. *!cos*          -> Calculate cosine
7. *!tan*          -> Calculate tangent
8. *!pangkat*      -> Calculate exponentiation
9. *!sqrt*         -> Calculate square root
10. ~*!spam*       -> Spam infinity repeat chat~
11. ~*!atur*       -> Spam infinity chat controlled~
12. *!factorial*   -> Calculate factorial number
13. *!dadu*        -> Lempar dadu virtual
14. *!unsur-kimia* -> Informasi tabel periodik unsur
15. *!cek-prima*   -> Mengecek bilangan prima atau bukan
16. *!konversi-suhu*> Ubah ukuran suhu dalam derajat C, R, F, dan K 
17. *!modulo*      -> Sisa bagi operasi pembagian bilangan
18. *!floor*       -> Pembagian pembulatan bilangan terdekat
19. *!skala-peta*  -> HItung jarak nyata berdasarkan jarak peta dan skala
20. *!satuan*      -> Konversi satuan Peta terbesar ke Nano terkecil.
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

				case '!satuan':
					if (args.length !== 4) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !satuan --[satuan_asal] [angka] --to-[satuan_tujuan]\nContoh: !satuan --cm 150 --to-m'
						});
						return;
					}

					// Variabel khusus untuk !satuan
					const satuanInputUnit = args[1].replace('--', '').toLowerCase();
					const satuanValue = parseFloat(args[2]);
					const satuanTargetUnit = args[3].replace('--to-', '').toLowerCase();

					const units = {
						nano: 1e-9,
						mikro: 1e-6,
						mili: 1e-3,
						cm: 1e-2,
						dm: 1e-1,
						m: 1,
						km: 1e3,
						inci: 0.0254,
						kaki: 0.3048,
						yard: 0.9144,
						mil: 1609.344,
						peta: 1e15,
						tera: 1e12,
						giga: 1e9
					};

					if (!(satuanInputUnit in units) || !(satuanTargetUnit in units)) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: `Satuan tidak valid. Pilih dari: ${Object.keys(units).join(', ')}`
						});
						return;
					}

					if (isNaN(satuanValue)) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Masukkan angka valid.'
						});
						return;
					}

					const resultSatuan = satuanValue * units[satuanInputUnit] / units[satuanTargetUnit];

					await sock.sendMessage(msg.key.remoteJid, {
						text: `${satuanValue} ${satuanInputUnit} = ${resultSatuan} ${satuanTargetUnit}`
					});
					break;


				case '!konversi-suhu':
					if (args.length !== 4) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !konversi-suhu --[celcius/fahrenheit/kelvin/reamur] [angka] --to-[celcius/fahrenheit/kelvin/reamur]'
						});
						return;
					}

					// Variabel khusus untuk !konversi-suhu
					const suhuInputUnit = args[1].replace('--', '').toLowerCase();
					const suhuValue = parseFloat(args[2]);
					const suhuTargetUnit = args[3].replace('--to-', '').toLowerCase();

					if (isNaN(suhuValue)) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Masukkan angka suhu yang valid.'
						});
						return;
					}

					function convertTemperature(value, from, to) {
						let celcius;

						switch (from) {
							case 'celcius':
								celcius = value;
								break;
							case 'fahrenheit':
								celcius = (value - 32) * 5 / 9;
								break;
							case 'kelvin':
								celcius = value - 273.15;
								break;
							case 'reamur':
								celcius = value * 5 / 4;
								break;
							default:
								throw new Error('Satuan asal tidak valid');
						}

						switch (to) {
							case 'celcius': return celcius;
							case 'fahrenheit': return celcius * 9 / 5 + 32;
							case 'kelvin': return celcius + 273.15;
							case 'reamur': return celcius * 4 / 5;
							default:
								throw new Error('Satuan tujuan tidak valid');
						}
					}

					try {
						const result = convertTemperature(suhuValue, suhuInputUnit, suhuTargetUnit);
						await sock.sendMessage(msg.key.remoteJid, {
							text: `${suhuValue} ${suhuInputUnit} = ${result.toFixed(2)} ${suhuTargetUnit}`
						});
					} catch (err) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: `Terjadi kesalahan: ${err.message}`
						});
					}
					break;

				// !modulo
				case '!modulo':
					if (args.length !== 3) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !modulo [angka1] [angka2]'
						});
						return;
					}
					const b = parseFloat(args[2]);
					if (isNaN(a) || isNaN(b) || b === 0) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Masukkan angka valid dan pembagi tidak boleh 0.'
						});
						return;
					}
					await sock.sendMessage(msg.key.remoteJid, {
						text: `Hasil: ${a} % ${b} = ${a % b}`
					});
					break;

				// !floor
				case '!floor':
					if (args.length !== 2) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !floor [angka]'
						});
						return;
					}
					const numFloor = parseFloat(args[1]);
					if (isNaN(numFloor)) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Masukkan angka valid.'
						});
						return;
					}
					await sock.sendMessage(msg.key.remoteJid, {
						text: `floor(${numFloor}) = ${Math.floor(numFloor)}`
					});
					break;

				// !skala-peta
				// Format: !skala-peta [jarak_peta_cm] [skala] → jarak nyata
				// Contoh: !skala-peta 5 1:5000
				case '!skala-peta':
					if (args.length !== 3) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !skala-peta [jarak_peta_cm] [skala]\nContoh: !skala-peta 5 1:5000'
						});
						return;
					}
					const jarakPeta = parseFloat(args[1]);
					const skalaParts = args[2].split(':');
					if (isNaN(jarakPeta) || skalaParts.length !== 2 || isNaN(parseFloat(skalaParts[1]))) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Masukkan jarak peta dan skala valid. Contoh skala: 1:5000'
						});
						return;
					}
					const skala = parseFloat(skalaParts[1]);
					const jarakNyata = jarakPeta * skala / 100; // hasil dalam meter
					await sock.sendMessage(msg.key.remoteJid, {
						text: `${jarakPeta} cm di peta dengan skala ${args[2]} = ${jarakNyata.toFixed(2)} m`
					});
					break;

				
				case '!cek-prima':
					if (args.length < 2) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format yang benar: !cek-prima [angka1] [angka2] ...'
						});
						return;
					}

					function isPrime(n) {
						if (n === 1) return false;
						if (n === 2) return true;
						if (n % 2 === 0) return false;
						const sqrtN = Math.floor(Math.sqrt(n));
						for (let i = 3; i <= sqrtN; i += 2) {
							if (n % i === 0) return false;
						}
						return true;
					}

					let responses = [];
					for (let i = 1; i < args.length; i++) {
						const num = parseInt(args[i]);
						if (isNaN(num) || num < 1) {
							responses.push(`${args[i]} ❌ bukan angka positif valid`);
							continue;
						}
						responses.push(`${num} ${isPrime(num) ? '✅ bilangan prima' : '❌ bukan bilangan prima'}`);
					}

					await sock.sendMessage(msg.key.remoteJid, {
						text: responses.join('\n')
					});
					break;

					
				case '!unsur-kimia': {
					if (args.length !== 2) {
						await sock.sendMessage(msg.key.remoteJid, {
							text: 'Format: !unsur-kimia [nomorAtom|simbol]'
						});
						return;
					}

					const query = args[1].toLowerCase();

					// Array unsur kimia lengkap
					const unsur = [
					  { no: 1, simbol: "H", nama: "Hidrogen", den: 0.021 },
					  { no: 2, simbol: "He", nama: "Helium", den: 0.126 },
					  { no: 3, simbol: "Li", nama: "Litium", den: 0.53 },
					  { no: 4, simbol: "Be", nama: "Berilium", den: 1.85 },
					  { no: 5, simbol: "B", nama: "Boron", den: 2.34 },
					  { no: 6, simbol: "C", nama: "Carbon", den: 2.26 },
					  { no: 7, simbol: "N", nama: "Nitrogen", den: 0.81 },
					  { no: 8, simbol: "O", nama: "Oksigen", den: 1.14 },
					  { no: 9, simbol: "F", nama: "Flour", den: 1.506 },
					  { no: 10, simbol: "Ne", nama: "Neon", den: 1.20 },
					  { no: 11, simbol: "Na", nama: "Natrium", den: 0.97 },
					  { no: 12, simbol: "Mg", nama: "Magnesium", den: 1.74 },
					  { no: 13, simbol: "Al", nama: "Aluminium", den: 2.70 },
					  { no: 14, simbol: "Si", nama: "Silikon", den: 2.239 },
					  { no: 15, simbol: "P", nama: "Fosfor", den: 1.83 },
					  { no: 16, simbol: "S", nama: "Sulfur", den: 2.07 },
					  { no: 17, simbol: "Cl", nama: "Khlor", den: 1.58 },
					  { no: 18, simbol: "Ar", nama: "Argon", den: 1.40 },
					  { no: 19, simbol: "K", nama: "Kalium", den: 0.97 },
					  { no: 20, simbol: "Ca", nama: "Kalcium", den: 1.55 },
					  { no: 21, simbol: "Sc", nama: "Scandium", den: 3.0 },
					  { no: 22, simbol: "Ti", nama: "Titanium", den: 4.51 },
					  { no: 23, simbol: "V", nama: "Vanadium", den: 6.1 },
					  { no: 24, simbol: "Cr", nama: "Chrom", den: 7.19 },
					  { no: 25, simbol: "Mg", nama: "Magnesium", den: 7.86 },
					  { no: 26, simbol: "Fe", nama: "Besi", den: 7.86 },
					  { no: 27, simbol: "Co", nama: "Kobalt", den: 8.9 },
					  { no: 28, simbol: "Ni", nama: "Nikel", den: 6.8 },
					  { no: 29, simbol: "Cu", nama: "Tembaga", den: 8.96 },
					  { no: 30, simbol: "Zn", nama: "Seng", den: 7.14 },
					  { no: 31, simbol: "Ga", nama: "Galium", den: 5.91 },
					  { no: 32, simbol: "Ge", nama: "Germanium", den: 5.32 },
					  { no: 33, simbol: "Ar", nama: "Arsenic", den: 5.72 },
					  { no: 34, simbol: "Se", nama: "Selenium", den: 4.79 },
					  { no: 35, simbol: "Br", nama: "Brom", den: 3.12 },
					  { no: 36, simbol: "Kr", nama: "Kripton", den: 2.6 },
					  { no: 37, simbol: "Ru", nama: "Rubidium", den: 1.53 },
					  { no: 38, simbol: "Sr", nama: "Strontium", den: 2.6 },
					  { no: 39, simbol: "Y", nama: "Ytitrium", den: 4.47 },
					  { no: 40, simbol: "Zr", nama: "Zirkonium", den: 6.46 },
					  { no: 41, simbol: "Nb", nama: "Niobium", den: 8.4 },
					  { no: 42, simbol: "Mo", nama: "Molypdenum", den: 10.3 },
					  { no: 43, simbol: "Tc", nama: "Tecnetium", den: 11.5 },
					  { no: 44, simbol: "Ru", nama: "Ruthenium", den: 12.2 },
					  { no: 45, simbol: "Rh", nama: "Rhodium", den: 12.4 },
					  { no: 46, simbol: "Pd", nama: "Palladium", den: 12.0 },
					  { no: 47, simbol: "Si", nama: "Silver", den: 10.5 },
					  { no: 48, simbol: "Cd", nama: "Cadmium", den: 8.65 },
					  { no: 49, simbol: "In", nama: "Indium", den: 7.31 },
					  { no: 50, simbol: "Sn", nama: "Timah", den: 7.30 },
					  { no: 51, simbol: "Sb", nama: "Antimony", den: 6.684 },
					  { no: 52, simbol: "Te", nama: "Tellorium", den: 6.24 },
					  { no: 53, simbol: "I", nama: "Iodine", den: 4.94 },
					  { no: 54, simbol: "Xe", nama: "Xenon", den: 3.06 },
					  { no: 55, simbol: "Cs", nama: "Cesium", den: 1.90 },
					  { no: 56, simbol: "Ba", nama: "Barrium", den: 3.5 },
					  { no: 57, simbol: "La", nama: "Lathanum", den: 6.17 },
					  { no: 58, simbol: "Ce", nama: "Cerum", den: 6.67 },
					  { no: 59, simbol: "Pr", nama: "Prasecoymium", den: 6.77 },
					  { no: 60, simbol: "Nd", nama: "Noidymium", den: 7.0 },
					  { no: 61, simbol: "Pm", nama: "Promethium", den: 0 },
					  { no: 62, simbol: "Sm", nama: "Samarium", den: 7.54 },
					  { no: 63, simbol: "Eu", nama: "Europium", den: 5.26 },
					  { no: 64, simbol: "Gd", nama: "Gadolinium", den: 7.89 },
					  { no: 65, simbol: "Tb", nama: "Terbium", den: 8.27 },
					  { no: 66, simbol: "Dy", nama: "Dysprosium", den: 8.54 },
					  { no: 67, simbol: "Ho", nama: "Holmium", den: 8.54 },
					  { no: 68, simbol: "E", nama: "Erbium", den: 9.54 },
					  { no: 69, simbol: "Tm", nama: "Thulium", den: 9.33 },
					  { no: 70, simbol: "Yb", nama: "Ytterbium", den: 6.98 },
					  { no: 71, simbol: "Lu", nama: "Luthetium", den: 9.84 },
					  { no: 72, simbol: "Hf", nama: "Hafnium", den: 13.1 },
					  { no: 73, simbol: "Ta", nama: "Tantalum", den: 16.6 },
					  { no: 74, simbol: "W", nama: "Tungsen", den: 9.3 },
					  { no: 75, simbol: "Re", nama: "Renium", den: 21.0 },
					  { no: 76, simbol: "Os", nama: "Osmium", den: 22.6 },
					  { no: 77, simbol: "Ir", nama: "Iridium", den: 22.5 },
					  { no: 78, simbol: "Pt", nama: "Platinum", den: 21.4 },
					  { no: 79, simbol: "Au", nama: "Emas", den: 19.3 },
					  { no: 80, simbol: "Hg", nama: "Raksa", den: 13.6 },
					  { no: 81, simbol: "Tl", nama: "Talium", den: 11.85 },
					  { no: 82, simbol: "Pb", nama: "Timbal", den: 11.4 },
					  { no: 83, simbol: "Bi", nama: "Bismut", den: 9.8 },
					  { no: 84, simbol: "Po", nama: "Polonium", den: 9.2 },
					  { no: 85, simbol: "At", nama: "Astatine", den: 0 },
					  { no: 86, simbol: "Rn", nama: "Radon", den: 0 },
					  { no: 87, simbol: "Fr", nama: "Fransium", den: 0 },
					  { no: 88, simbol: "Ra", nama: "Radium", den: 0 },
					  { no: 89, simbol: "Ac", nama: "Actinium", den: 0 },
					  { no: 90, simbol: "Th", nama: "Thorium", den: 11.7 },
					  { no: 91, simbol: "Pa", nama: "Protactinium", den: 15.4 },
					  { no: 92, simbol: "U", nama: "Uranium", den: 19.07 },
					  { no: 93, simbol: "Np", nama: "Neptunium", den: 19.5 },
					  { no: 94, simbol: "Pu", nama: "Plutonium", den: 0 },
					  { no: 95, simbol: "Am", nama: "Amercium", den: 0 },
					  { no: 96, simbol: "Cm", nama: "Curium", den: 0 },
					  { no: 97, simbol: "Bk", nama: "Berkelium", den: 0 },
					  { no: 98, simbol: "Cf", nama: "Californium", den: 0 },
					  { no: 99, simbol: "Es", nama: "Einstenium", den: 0 },
					  { no: 100, simbol: "Fm", nama: "Fermium", den: 0 },
					  { no: 101, simbol: "Md", nama: "Mendelvium", den: 0 },
					  { no: 102, simbol: "No", nama: "Nobelium", den: 0 },
					  { no: 103, simbol: "Lw", nama: "Laerencium", den: 0 },
					  { no: 104, simbol: "Rf", nama: "Ruterfordium", den: 0 },
					  { no: 105, simbol: "Db", nama: "Dubnium", den: 0 },
					  { no: 106, simbol: "Sg", nama: "Seaborgium", den: 0 },
					  { no: 107, simbol: "Bh", nama: "Bohrium", den: 0 },
					  { no: 108, simbol: "Hs", nama: "Hassium", den: 0 },
					  { no: 109, simbol: "Mt", nama: "Meitnerium", den: 0 },
					  { no: 110, simbol: "Uun", nama: "Ununnilium", den: 0 },
					  { no: 111, simbol: "Uuu", nama: "Unununium", den: 0 },
					  { no: 112, simbol: "Uub", nama: "Ununbium", den: 0 }
					];

					// Cari berdasarkan nomor atau simbol
					let found;
					if (!isNaN(query)) {
						const nomorAtom = parseInt(query);
						found = unsur.find(u => u.no === nomorAtom);
					} else {
						found = unsur.find(u => u.simbol.toLowerCase() === query);
					}

					if (found) {
						const response = `🔬 Informasi Unsur Kimia
				Nomor atom: ${found.no}
				Simbol: ${found.simbol}
				Nama: ${found.nama}
				Densitas: ${found.den} g/cm³`;

						await sock.sendMessage(msg.key.remoteJid, { text: response });
					} else {
						await sock.sendMessage(msg.key.remoteJid, { text: "❌ Unsur tidak ditemukan" });
					}

				}
				break;


                case '!calculate':

                    const expression = args.slice(1).join(' ');

                    const result = math.evaluate(expression);

                    sock.sendMessage(msg.key.remoteJid, {
                        text: `Hasil: ${result}`
                    });

                    break;

                case '!factorial':
                    if (args.length !== 2) return sock.sendMessage(msg.key.remoteJid, {
                        text: 'Format: !factorial [angka]'
                    });
                    const numFact = parseInt(args[1]);
                    if (isNaN(numFact) || numFact < 0) return sock.sendMessage(msg.key.remoteJid, {
                        text: 'Masukkan angka valid >=0'
                    });
                    const factorial = (n) => n <= 1 ? 1 : n * factorial(n - 1);
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `Factorial dari ${numFact} adalah ${factorial(numFact)}`
                    });
                    break;

                case '!dadu':
                    const sides = parseInt(args[1]) || 6;
                    const rollResult = Math.floor(Math.random() * sides) + 1;
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `🎲 Kamu melempar dadu ${sides} sisi: ${rollResult}`
                    });
                    break;

                case '!aritmatika':

                    if (args.length !== 4) {

                        sock.sendMessage(msg.key.remoteJid, {

                            text: 'Format yang benar: !aritmatika [a] [n] [d]'

                        });

                        return;

                    }

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