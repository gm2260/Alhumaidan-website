import os
import subprocess
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = r"C:\Users\malhomaidan\Downloads\T3 Code\الحميدان"
ASSETS_DIR = os.path.join(BASE_DIR, "pdf_docs", "assets")
TEMP_DIR = os.path.join(BASE_DIR, "pdf_docs", "temp_shots")
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 8089

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

server = HTTPServer(("127.0.0.1", PORT), QuietHandler)
thread = threading.Thread(target=server.serve_forever)
thread.daemon = True
thread.start()
print(f"HTTP Server started at http://127.0.0.1:{PORT}")

# Helper to take screenshot
def take_screenshot(html_rel_path, output_name, width=1200, height=800):
    url = f"http://127.0.0.1:{PORT}/{html_rel_path}"
    out_file = os.path.join(ASSETS_DIR, output_name)
    args = [
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        f"--window-size={width},{height}",
        f"--screenshot={out_file}",
        url
    ]
    subprocess.run(args, check=True)
    size = os.path.getsize(out_file) if os.path.exists(out_file) else 0
    print(f"Captured {output_name}: {size} bytes")

# 1. Visitor Shot 1: Mode Selection Modal
with open(os.path.join(TEMP_DIR, "shot1_mode.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/index.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const doc = frame.contentDocument;
            doc.getElementById('deviceChoiceModal').classList.add('active');
            doc.getElementById('visitorLoginModal').classList.remove('active');
        };
    </script>
</body>
</html>""")

# 2. Visitor Shot 2: Login Modal
with open(os.path.join(TEMP_DIR, "shot2_login.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/index.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const doc = frame.contentDocument;
            doc.getElementById('deviceChoiceModal').classList.remove('active');
            const login = doc.getElementById('visitorLoginModal');
            login.classList.add('active');
            doc.getElementById('modalVisitorName').value = 'صالح بن محمد الحميدان';
            doc.getElementById('modalVisitorPin').value = '1234';
            doc.getElementById('modalVisitorPhone').value = '0501234567';
        };
    </script>
</body>
</html>""")

# 3. Visitor Shot 3: Header / Event Banner
with open(os.path.join(TEMP_DIR, "shot3_header.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/index.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('deviceChoiceModal').classList.remove('active');
            doc.getElementById('visitorLoginModal').classList.remove('active');
            if (win.applyDeviceMode) win.applyDeviceMode('desktop');
            win.scrollTo(0, 0);
        };
    </script>
</body>
</html>""")

# 4. Visitor Shot 4: Calculator with numbers
with open(os.path.join(TEMP_DIR, "shot4_calc.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/index.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('deviceChoiceModal').classList.remove('active');
            doc.getElementById('visitorLoginModal').classList.remove('active');
            if (win.applyDeviceMode) win.applyDeviceMode('desktop');
            win.familyMembers = {
                head: 1,
                employed_son: 2,
                unemployed_son: 0,
                student_male: 1,
                retired_widow: 0,
                employed_daughter: 1,
                unemployed_daughter: 0
            };
            if (win.updateCalculations) win.updateCalculations();
            setTimeout(() => {
                const el = doc.getElementById('calculatorSection') || doc.querySelector('.calculator-card');
                if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }, 300);
        };
    </script>
</body>
</html>""")

# 5. Visitor Shot 5: Payment details
with open(os.path.join(TEMP_DIR, "shot5_pay.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/index.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('deviceChoiceModal').classList.remove('active');
            doc.getElementById('visitorLoginModal').classList.remove('active');
            if (win.applyDeviceMode) win.applyDeviceMode('desktop');
            setTimeout(() => {
                const el = doc.getElementById('paymentSection') || doc.querySelector('.payment-card');
                if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
            }, 300);
        };
    </script>
</body>
</html>""")

# ADMIN SHOTS

# Admin Shot 1: Login PIN modal
with open(os.path.join(TEMP_DIR, "shot_admin1_pin.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/admin.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const doc = frame.contentDocument;
            doc.getElementById('adminAuthModal').classList.add('active');
            doc.getElementById('adminAuthPinInput').value = '1448';
        };
    </script>
</body>
</html>""")

# Admin Shot 2: Dashboard KPIs & registrations
with open(os.path.join(TEMP_DIR, "shot_admin2_kpis.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/admin.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('adminAuthModal').classList.remove('active');
            win.scrollTo(0, 0);
        };
    </script>
</body>
</html>""")

# Admin Shot 3: Registrations table with sample rows
with open(os.path.join(TEMP_DIR, "shot_admin3_table.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/admin.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('adminAuthModal').classList.remove('active');
            setTimeout(() => {
                const el = doc.querySelector('.admin-card-section');
                if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
            }, 400);
        };
    </script>
</body>
</html>""")

# Admin Shot 4: Settings tab
with open(os.path.join(TEMP_DIR, "shot_admin4_settings.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/admin.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('adminAuthModal').classList.remove('active');
            if (win.switchAdminTab) win.switchAdminTab('settings');
            setTimeout(() => {
                win.scrollTo(0, 100);
            }, 300);
        };
    </script>
</body>
</html>""")

# Admin Shot 5: Expenses tab
with open(os.path.join(TEMP_DIR, "shot_admin5_expenses.html"), "w", encoding="utf-8") as f:
    f.write("""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>body { margin:0; overflow:hidden; }</style>
</head>
<body>
    <iframe id="frame" src="/admin.html" style="width:100vw; height:100vh; border:none;"></iframe>
    <script>
        const frame = document.getElementById('frame');
        frame.onload = () => {
            const win = frame.contentWindow;
            const doc = frame.contentDocument;
            doc.getElementById('adminAuthModal').classList.remove('active');
            if (win.switchAdminTab) win.switchAdminTab('expenses');
            setTimeout(() => {
                win.scrollTo(0, 100);
            }, 300);
        };
    </script>
</body>
</html>""")

# Run all captures
print("Capturing Visitor shots...")
take_screenshot("pdf_docs/temp_shots/shot1_mode.html", "visitor_shot1_mode.png", 1100, 750)
take_screenshot("pdf_docs/temp_shots/shot2_login.html", "visitor_shot2_login.png", 1100, 800)
take_screenshot("pdf_docs/temp_shots/shot3_header.html", "visitor_shot3_header.png", 1200, 700)
take_screenshot("pdf_docs/temp_shots/shot4_calc.html", "visitor_shot4_calc.png", 1200, 800)
take_screenshot("pdf_docs/temp_shots/shot5_pay.html", "visitor_shot5_pay.png", 1200, 750)

print("Capturing Admin shots...")
take_screenshot("pdf_docs/temp_shots/shot_admin1_pin.html", "admin_shot1_pin.png", 1100, 750)
take_screenshot("pdf_docs/temp_shots/shot_admin2_kpis.html", "admin_shot2_kpis.png", 1200, 650)
take_screenshot("pdf_docs/temp_shots/shot_admin3_table.html", "admin_shot3_table.png", 1200, 750)
take_screenshot("pdf_docs/temp_shots/shot_admin4_settings.html", "admin_shot4_settings.png", 1200, 800)
take_screenshot("pdf_docs/temp_shots/shot_admin5_expenses.html", "admin_shot5_expenses.png", 1200, 800)

print("All screenshots generated successfully!")
