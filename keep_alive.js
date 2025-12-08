const http = require('http');
// ======== AUTO UNSET PROXY VARIABEL ========= //
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.ALL_PROXY;
delete process.env.all_proxy;
const PORT = process.env.PORT || 8080;

function htmlPage() {
    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bot Gateway Whatsapp — Portfolio</title>

<style>
  body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #0e1525;
    color: #e6eef6;
    padding: 40px;
  }

  .card {
    max-width: 700px;
    margin: auto;
    background: rgba(255,255,255,0.03);
    padding: 32px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }

  h1 {
    margin-top: 0;
    font-size: 26px;
  }

  p {
    line-height: 1.6;
    color: #9aa4b2;
  }

  .logo {
    font-size: 60px;
    margin-bottom: 10px;
    text-align: center;
  }

  .button {
    margin-top: 20px;
    padding: 12px 18px;
    background: #22c1c3;
    border: none;
    color: #000;
    cursor: pointer;
    border-radius: 8px;
    font-weight: 600;
  }
</style>
</head>

<body>
  <div class="card">
    <div class="logo">🤖</div>
    <h1>Bot Gateway Whatsapp</h1>
    <p>
      Website portfolio sederhana ini berjalan di <strong>Node.js Native</strong>.
      Tampilan ini adalah contoh proyek Gateway WhatsApp untuk portofolio atau showcase.
    </p>

    <p>Halaman ini akan me-reload otomatis setiap <strong>15 menit</strong>.</p>

    <button class="button" onclick="location.reload()">Reload Manual</button>
  </div>

<script>
  // Auto refresh setiap 15 menit
  setInterval(() => {
    location.reload();
  }, 900000);
</script>

</body>
</html>`;
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlPage());
});

server.listen(PORT, () => {
    console.log(`Server Alive`);
});
