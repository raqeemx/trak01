export function renderApp(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>نظام إدارة عمليات الجرد والتقييم</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <link href="/static/style.css" rel="stylesheet" />
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Cairo', 'sans-serif'] },
          colors: { brand: { DEFAULT: '#0f766e', dark: '#115e59', light: '#14b8a6' } }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-100 font-sans text-slate-800">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}
