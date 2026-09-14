using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace MeetingAssistantLauncher
{
    public class MainForm : Form
    {
        private Label lblStatus;
        private ProgressBar progressBar;
        private System.Windows.Forms.Timer timer;
        private int retryCount = 0;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        public MainForm()
        {
            this.Text = "AI 智慧會議助理 - 啟動中";
            this.Size = new Size(420, 200);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Icon = SystemIcons.Application;

            Label lblTitle = new Label();
            lblTitle.Text = "🎙️ AI 智慧會議記錄助理";
            lblTitle.Font = new Font("Microsoft JhengHei UI", 12, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(79, 70, 229);
            lblTitle.Location = new Point(20, 20);
            lblTitle.Size = new Size(360, 28);
            this.Controls.Add(lblTitle);

            lblStatus = new Label();
            lblStatus.Text = "正在載入本地端 AI 核心與會議服務...";
            lblStatus.Font = new Font("Microsoft JhengHei UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(100, 116, 139);
            lblStatus.Location = new Point(22, 55);
            lblStatus.Size = new Size(360, 24);
            this.Controls.Add(lblStatus);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.MarqueeAnimationSpeed = 30;
            progressBar.Location = new Point(22, 85);
            progressBar.Size = new Size(360, 20);
            this.Controls.Add(progressBar);

            this.Load += MainForm_Load;
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            Thread bgThread = new Thread(StartServicesAndLaunch);
            bgThread.IsBackground = true;
            bgThread.Start();
        }

        private void StartServicesAndLaunch()
        {
            try
            {
                string baseDir = @"D:\project";
                string appDir = @"D:\project\MeetingAssistant";
                string modelsDir = @"D:\project\models";
                string llamaExe = @"D:\project\llama.cpp\llama-server.exe";
                string denoExe = @"D:\project\deno.exe";

                // 1. Check & Start llama-server (8080)
                if (!IsPortOpen("127.0.0.1", 8080))
                {
                    UpdateStatus("正在喚醒 Qwen 2.5 7B AI 大腦 (本機離線載入)...");
                    string model = Path.Combine(modelsDir, "qwen2.5-7b-instruct-q4_k_m.gguf");
                    if (!File.Exists(model)) model = Path.Combine(modelsDir, "Qwen2.5-7B-Instruct-Q4_K_M.gguf");
                    if (!File.Exists(model)) model = Path.Combine(modelsDir, "Qwen2.5-3B-Instruct-Q4_K_M.gguf");

                    ProcessStartInfo psiLlama = new ProcessStartInfo();
                    psiLlama.FileName = llamaExe;
                    psiLlama.Arguments = string.Format("-m \"{0}\" --port 8080 -c 8192 --threads 10 --host 127.0.0.1", model);
                    psiLlama.WindowStyle = ProcessWindowStyle.Hidden;
                    psiLlama.CreateNoWindow = true;
                    psiLlama.UseShellExecute = false;
                    Process.Start(psiLlama);
                }

                // 2. Check & Start Deno (8088)
                if (!IsPortOpen("127.0.0.1", 8088))
                {
                    UpdateStatus("正在啟動會議助理 Web 本機伺服器...");
                    ProcessStartInfo psiDeno = new ProcessStartInfo();
                    psiDeno.FileName = denoExe;
                    psiDeno.Arguments = "run -A --no-check server.ts";
                    psiDeno.WorkingDirectory = appDir;
                    psiDeno.WindowStyle = ProcessWindowStyle.Hidden;
                    psiDeno.CreateNoWindow = true;
                    psiDeno.UseShellExecute = false;
                    Process.Start(psiDeno);
                }

                // 3. Health Check Polling
                UpdateStatus("正在檢測服務連線狀態...");
                bool ready = false;
                for (int i = 0; i < 30; i++)
                {
                    Thread.Sleep(500);
                    if (IsWebReady("http://127.0.0.1:8088/"))
                    {
                        ready = true;
                        break;
                    }
                }

                // 4. Open Application Window
                UpdateStatus("服務就緒！正在開啟專屬應用程式視窗...");
                Thread.Sleep(300);

                string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (!File.Exists(edge)) edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";

                ProcessStartInfo psiBrowser = new ProcessStartInfo();
                if (File.Exists(edge))
                {
                    psiBrowser.FileName = edge;
                    psiBrowser.Arguments = "--app=http://127.0.0.1:8088/ --window-size=1420,920";
                }
                else
                {
                    psiBrowser.FileName = "http://127.0.0.1:8088/";
                    psiBrowser.UseShellExecute = true;
                }
                Process.Start(psiBrowser);

                Thread.Sleep(600);
                this.Invoke(new Action(() => this.Close()));
            }
            catch (Exception ex)
            {
                MessageBox.Show("啟動時發生錯誤：" + ex.Message, "錯誤", MessageBoxButtons.OK, MessageBoxIcon.Error);
                this.Invoke(new Action(() => this.Close()));
            }
        }

        private void UpdateStatus(string text)
        {
            if (this.IsHandleCreated)
            {
                this.Invoke(new Action(() => { lblStatus.Text = text; }));
            }
        }

        private bool IsPortOpen(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(300);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private bool IsWebReady(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 800;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
